import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderLogin } from '../login/Login';
import Toastify from 'toastify-js';
import { apiFetch, loadProtectedImageObjectUrl, revokeProtectedImageObjectUrl } from '../shared/api-client';
import { STATUS_LABELS, type UserStatusValue } from '../shared/user-status';

const MAX_AKADEMIK_FOTO_BYTES = 2 * 1024 * 1024;
const AKADEMIK_FOTO_MIME_RE = /^image\/(jpeg|jpg|png|webp)$/i;

export const renderProfilKaprodi = async (role: string) => {
    // Hide standard layout header for custom profile header
    const styleBlock = `
        <style>
            header { display: none !important; }
            .profile-card { transition: all 0.3s ease; }
            .profile-card:hover { transform: translateY(-2px); }
            .input-focus:focus { border-color: #0D9488; ring: 4px rgba(13, 148, 136, 0.1); }
        </style>
    `;

    // Initial state
    let isEditingData = false;
    let isEditingPassword = false;
    let userData = {
        name: localStorage.getItem('auth_name') || '',
        email: '',
        nip: '',
        role: role,
        sub_role: '',
        status: '-',
        joined_since: '-',
        study_program: null as { code?: string | null; name?: string | null } | null,
        department: null as { code?: string | null; name?: string | null } | null,
        study_program_code: '',
        study_program_name: '',
        department_code: '',
        department_name: '',
    };
    // Auth-loaded object URLs for the saved Foto Profil and Tanda Tangan, plus
    // locally-selected data: URLs that preview a file before save. Render order
    // is: pending preview > stored object URL > placeholder.
    let photoObjectUrl: string | null = null;
    let signatureObjectUrl: string | null = null;
    let pendingPhotoFile: File | null = null;
    let pendingPhotoPreviewUrl: string | null = null;
    let pendingSignatureFile: File | null = null;
    let pendingSignaturePreviewUrl: string | null = null;
    // Field-level validation errors (populated on 422 response, cleared on edit).
    let nameError = '';
    let nipError = '';
    let photoError = '';
    let signatureError = '';

    const fetchProfile = async () => {
        try {
            const res = await apiFetch('/api/profile');
            if (res.ok) {
                const data = await res.json();
                const profileUser = (data?.user ?? {}) as Record<string, any>;
                userData.name = profileUser.name || '';
                userData.email = profileUser.email || '';
                userData.nip = profileUser.nip || '';
                userData.role = profileUser.role || role;
                userData.sub_role = profileUser.sub_role || localStorage.getItem('auth_sub_role') || '';
                userData.status = getStatusDisplay(profileUser.status);
                userData.joined_since = getJoinedYear(profileUser.created_at);
                userData.study_program = scopeObject(profileUser.study_program ?? profileUser.studyProgram);
                userData.department = scopeObject(profileUser.department);
                userData.study_program_code = textValue(profileUser.study_program_code);
                userData.study_program_name = textValue(profileUser.study_program_name);
                userData.department_code = textValue(profileUser.department_code);
                userData.department_name = textValue(profileUser.department_name);

                const photoPath: string | null = data?.profile?.pas_foto_path || null;
                const signaturePath: string | null = data?.profile?.tanda_tangan_path || null;
                if (photoPath) {
                    localStorage.setItem('auth_photo', photoPath);
                }

                const [nextPhoto, nextSignature] = await Promise.all([
                    photoPath ? loadProtectedImageObjectUrl(photoPath) : Promise.resolve(null),
                    signaturePath ? loadProtectedImageObjectUrl(signaturePath) : Promise.resolve(null),
                ]);
                revokeProtectedImageObjectUrl(photoObjectUrl);
                revokeProtectedImageObjectUrl(signatureObjectUrl);
                photoObjectUrl = nextPhoto;
                signatureObjectUrl = nextSignature;
                render();
            }
        } catch (e) {
            console.error('Fetch profile error:', e);
        }
    };

    const textValue = (value: unknown): string => {
        return typeof value === 'string' ? value.trim() : '';
    };

    const scopeObject = (value: unknown): { code?: string | null; name?: string | null } | null => {
        return value && typeof value === 'object'
            ? value as { code?: string | null; name?: string | null }
            : null;
    };

    const firstText = (...values: unknown[]): string => {
        for (const value of values) {
            const text = textValue(value);
            if (text) return text;
        }

        return '';
    };

    const getJoinedYear = (createdAt: unknown): string => {
        const value = textValue(createdAt);
        if (!value) return '-';

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '-' : String(date.getFullYear());
    };

    const getStatusDisplay = (status: unknown): string => {
        const value = textValue(status);
        if (!value) return '-';

        return STATUS_LABELS[value as UserStatusValue] || value;
    };

    const getStudyProgramLabel = (): string => {
        return firstText(
            userData.study_program?.code,
            userData.study_program_code,
            userData.study_program?.name,
            userData.study_program_name
        );
    };

    const getDepartmentLabel = (): string => {
        return firstText(
            userData.department?.code,
            userData.department_code,
            userData.department?.name,
            userData.department_name
        );
    };

    const formatGenericRole = (value: string): string => {
        return value
            .split('_')
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || '-';
    };

    const getRoleDisplayName = () => {
        const subRole = firstText(userData.sub_role, userData.role).toLowerCase();
        const prodiLabel = getStudyProgramLabel();
        const departmentLabel = getDepartmentLabel();

        if (subRole === 'kaprodi') return prodiLabel ? `Kaprodi ${prodiLabel}` : 'Ketua Program Studi';
        if (subRole === 'sekprodi') return prodiLabel ? `Sekprodi ${prodiLabel}` : 'Sekretaris Program Studi';
        if (subRole === 'kadep') return departmentLabel ? `Kadep ${departmentLabel}` : 'Ketua Departemen';
        if (subRole === 'sekdep') return departmentLabel ? `Sekdep ${departmentLabel}` : 'Sekretaris Departemen';
        if (subRole === 'akademik') return 'Akademik';

        return formatGenericRole(firstText(userData.role));
    };

    const render = () => {
        const content = `
            ${styleBlock}
            <div class="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-fade-in text-gray-800">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8">
                    <div class="flex items-center gap-3 cursor-pointer text-gray-800 hover:text-teal-800 transition-colors" id="back-to-dashboard">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        <h1 class="text-[32px] font-bold tracking-tight">Profil Saya</h1>
                    </div>
                    <button id="logout-profil" class="flex items-center gap-2 bg-[#EF4444] hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        Keluar
                    </button>
                </div>

                <!-- Top Grid Section -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                    <!-- Profile Card -->
                    <div class="lg:col-span-4 bg-white rounded-[24px] p-8 flex flex-col items-center justify-center border border-gray-100 shadow-sm profile-card">
                        <div class="w-32 h-32 rounded-full border-4 border-gray-50 flex items-center justify-center mb-6 text-gray-300 bg-gray-50 overflow-hidden shadow-inner font-bold">
                            ${(pendingPhotoPreviewUrl || photoObjectUrl)
                ? `<img src="${pendingPhotoPreviewUrl || photoObjectUrl}" alt="Foto Profil" class="w-full h-full object-cover">`
                : `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
            }
                        </div>
                        <h3 class="text-xl font-extrabold text-gray-900 mb-1 text-center leading-tight px-4">${userData.name}</h3>
                        <p class="text-sm text-gray-500 mb-4 font-medium">${userData.email}</p>
                        <span class="bg-[#EEFDF7] text-[#059669] text-[11px] font-bold px-5 py-1.5 rounded-full border border-green-100 uppercase tracking-wider">${userData.status}</span>
                    </div>

                    <!-- Info Details Section -->
                    <div class="lg:col-span-8 flex flex-col gap-4">
                        <div class="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm profile-card flex flex-col justify-center min-h-[100px]">
                            <p class="text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Peran</p>
                            <p class="text-base font-bold text-gray-800">${getRoleDisplayName()}</p>
                        </div>
                        <div class="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm profile-card flex flex-col justify-center min-h-[100px]">
                            <p class="text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Bergabung Sejak</p>
                            <p class="text-base font-bold text-gray-800">${userData.joined_since}</p>
                        </div>
                    </div>
                </div>

                <!-- Informasi Data Diri -->
                <div class="bg-white rounded-[24px] p-8 border border-gray-100 shadow-sm mb-6 relative overflow-hidden">
                    <div class="flex justify-between items-center mb-8">
                        <h3 class="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            Informasi Data Diri
                        </h3>
                        <button id="toggle-data-edit" class="text-teal-700 font-extrabold text-sm hover:text-teal-900 transition-colors px-3 py-1 rounded-lg hover:bg-teal-50">
                            ${isEditingData ? 'Batal' : 'Edit'}
                        </button>
                    </div>

                    <form id="personal-info-form" class="space-y-6 max-w-4xl font-bold">
                        <div class="flex flex-col md:flex-row md:items-start gap-2 md:gap-6">
                            <label class="w-48 text-sm font-bold text-gray-500 md:pt-3">Nama Lengkap</label>
                            <div class="flex-1">
                                <input id="profil-akademik-name" type="text" name="name" value="${userData.name}" maxlength="255"
                                    class="w-full ${isEditingData ? 'bg-white border-gray-300 font-bold' : 'bg-gray-100 border-transparent cursor-default font-bold'} border px-4 py-3 rounded-xl text-sm text-gray-700 font-semibold focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all"
                                    ${!isEditingData ? 'readonly' : ''} ${nameError ? 'aria-invalid="true" aria-describedby="profil-akademik-name-error"' : ''}>
                                ${nameError ? `<p id="profil-akademik-name-error" class="text-[10px] text-red-500 mt-1.5 font-bold">${nameError}</p>` : ''}
                            </div>
                        </div>
                        <div class="flex flex-col md:flex-row md:items-start gap-2 md:gap-6">
                            <label class="w-48 text-sm font-bold text-gray-500 md:pt-3">Email</label>
                            <div class="flex-1">
                                <input type="email" value="${userData.email}"
                                    class="w-full bg-gray-100 border-transparent cursor-not-allowed font-bold border px-4 py-3 rounded-xl text-sm text-gray-500 font-semibold outline-none transition-all"
                                    readonly disabled aria-readonly="true" title="Email dikelola oleh Super Admin">
                                ${isEditingData ? `<p class="text-[10px] text-gray-500 mt-1.5 font-medium">Email dikelola oleh Super Admin.</p>` : ''}
                            </div>
                        </div>
                        <div class="flex flex-col md:flex-row md:items-start gap-2 md:gap-6">
                            <label class="w-48 text-sm font-bold text-gray-500 md:pt-3">NIP</label>
                            <div class="flex-1">
                                <input id="profil-akademik-nip" type="text" name="nip" value="${userData.nip || ''}" maxlength="50" placeholder="${isEditingData ? 'Masukkan NIP' : ''}"
                                    class="w-full ${isEditingData ? 'bg-white border-gray-300 font-bold' : 'bg-gray-100 border-transparent cursor-default font-bold'} border px-4 py-3 rounded-xl text-sm text-gray-700 font-semibold focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all"
                                    ${!isEditingData ? 'readonly' : ''} ${nipError ? 'aria-invalid="true" aria-describedby="profil-akademik-nip-error"' : ''}>
                                ${nipError ? `<p id="profil-akademik-nip-error" class="text-[10px] text-red-500 mt-1.5 font-bold">${nipError}</p>` : ''}
                                ${isEditingData && !nipError ? `<p class="text-[10px] text-gray-500 mt-1.5 font-medium">Kosongkan jika belum tersedia.</p>` : ''}
                            </div>
                        </div>
                        <div class="flex flex-col md:flex-row gap-2 md:gap-6">
                            <label class="w-48 text-sm font-bold text-gray-500 pt-3">Foto Profil</label>
                            <div class="flex-1 flex flex-col gap-3">
                                <div class="flex items-center gap-4">
                                    <div class="w-20 h-20 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-gray-400">
                                        ${(pendingPhotoPreviewUrl || photoObjectUrl)
                ? `<img src="${pendingPhotoPreviewUrl || photoObjectUrl}" alt="Foto Profil" class="w-full h-full object-cover">`
                : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
            }
                                    </div>
                                    ${isEditingData ? `
                                        <label class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-teal-700 text-teal-700 text-xs font-bold hover:bg-teal-50 cursor-pointer transition-colors">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            <span>${(pendingPhotoPreviewUrl || photoObjectUrl) ? 'Ganti Foto Profil' : 'Unggah Foto Profil'}</span>
                                            <input type="file" id="foto-input" class="hidden" accept="image/jpeg,image/jpg,image/png,image/webp">
                                        </label>
                                    ` : `
                                        <span class="text-sm text-gray-500 italic">${(pendingPhotoPreviewUrl || photoObjectUrl) ? 'Tersimpan' : 'Belum ada Foto Profil'}</span>
                                    `}
                                </div>
                                <p class="text-[10px] text-gray-500 font-medium">Opsional. JPG/PNG/WEBP, maksimal 2 MB.</p>
                                ${photoError ? `<p class="text-[10px] text-red-500 font-bold">${photoError}</p>` : ''}
                            </div>
                        </div>

                        <div class="flex flex-col md:flex-row gap-2 md:gap-6">
                            <label class="w-48 text-sm font-bold text-gray-500 pt-3">Tanda Tangan (TTD)</label>
                            <div class="flex-1 flex flex-col gap-3">
                                <div class="w-full max-w-[280px] h-[120px] bg-gray-100 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                                    ${(pendingSignaturePreviewUrl || signatureObjectUrl)
                ? `<img id="sig-preview" src="${pendingSignaturePreviewUrl || signatureObjectUrl}" class="max-h-full max-w-full object-contain p-2">`
                : `<div id="sig-placeholder" class="text-gray-400 flex flex-col items-center gap-1 font-bold">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"></path></svg>
                                            <span class="text-[10px] font-bold">Belum ada Tanda Tangan</span>
                                          </div>`
            }
                                    ${isEditingData ? `
                                        <label class="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <span class="text-xs font-bold">Ganti Tanda Tangan</span>
                                            <input type="file" id="sig-input" class="hidden" accept="image/jpeg,image/jpg,image/png,image/webp">
                                        </label>
                                    ` : ''}
                                </div>
                                <p class="text-[10px] text-gray-500 font-medium">Tanda tangan digunakan untuk dokumen yang memerlukan tanda tangan pribadi. Paraf persetujuan Prodi dikelola oleh sistem.</p>
                                ${isEditingData ? `<p class="text-[10px] text-gray-400 font-medium font-bold">* Format PNG transparan sangat disarankan</p>` : ''}
                                ${signatureError ? `<p class="text-[10px] text-red-500 font-bold">${signatureError}</p>` : ''}
                            </div>
                        </div>

                        ${isEditingData ? `
                            <div class="flex justify-end pt-4">
                                <button type="submit" class="bg-teal-800 hover:bg-teal-900 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-teal-900/20 transition-all hover:scale-[1.02]">
                                    Simpan Perubahan
                                </button>
                            </div>
                        ` : ''}
                    </form>
                </div>

                <!-- Keamanan Akun -->
                <div class="bg-white rounded-[24px] p-8 border border-gray-100 shadow-sm mb-12">
                    <div class="flex justify-between items-center mb-8">
                        <h3 class="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            Keamanan Akun
                        </h3>
                        <button id="toggle-pwd-edit" class="text-teal-700 font-extrabold text-sm hover:text-teal-900 transition-colors px-3 py-1 rounded-lg hover:bg-teal-50">
                            ${isEditingPassword ? 'Batal' : 'Edit'}
                        </button>
                    </div>

                    ${!isEditingPassword ? `
                        <p class="text-sm text-gray-500 font-medium">Kata sandi Anda dilindungi secara enkripsi dan tidak dapat dilihat secara langsung.</p>
                    ` : `
                        <form id="password-form" class="space-y-5 max-w-2xl animate-slide-up font-bold">
                            <div class="space-y-1.5 font-bold">
                                <label class="text-xs font-bold text-gray-500 ml-1 font-bold">KATA SANDI BARU</label>
                                <input type="password" name="password" placeholder="Minimal 8 karakter" class="w-full bg-white border border-gray-300 px-4 py-3 rounded-xl text-sm focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all font-semibold font-bold">
                            </div>
                            <div class="space-y-1.5 font-bold">
                                <label class="text-xs font-bold text-gray-500 ml-1 font-bold">KONFIRMASI KATA SANDI BARU</label>
                                <input type="password" name="password_confirmation" placeholder="Ulangi kata sandi baru" class="w-full bg-white border border-gray-300 px-4 py-3 rounded-xl text-sm focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all font-semibold font-bold">
                            </div>
                            <div class="flex justify-end pt-2">
                                <button type="submit" class="bg-teal-800 hover:bg-teal-900 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-teal-900/20 transition-all hover:scale-[1.02]">
                                    Ganti Kata Sandi
                                </button>
                            </div>
                        </form>
                    `}
                </div>
            </div>
        `;

        renderDashboardLayout('Profil Saya', content, role, 'dashboard');
        attachListeners();
    };

    const attachListeners = () => {
        // Back Button
        document.getElementById('back-to-dashboard')?.addEventListener('click', () => {
            import('../dashboard/AkademikDashboard').then(({ renderAkademikDashboard }) => {
                renderAkademikDashboard(role);
            });
        });

        // Logout
        document.getElementById('logout-profil')?.addEventListener('click', async () => {
            const token = localStorage.getItem('auth_token');
            if (token) try { await apiFetch('/api/logout', { method: 'POST' }); } catch (e) { }
            localStorage.clear();
            Toastify({ text: "Berhasil keluar!", duration: 2000, style: { background: "#10B981" } }).showToast();
            setTimeout(() => renderLogin(), 500);
        });

        // Edit Toggles
        document.getElementById('toggle-data-edit')?.addEventListener('click', () => {
            isEditingData = !isEditingData;
            nameError = '';
            nipError = '';
            photoError = '';
            signatureError = '';
            // Discard any locally-selected files when leaving edit mode.
            if (!isEditingData) {
                pendingPhotoFile = null;
                pendingPhotoPreviewUrl = null;
                pendingSignatureFile = null;
                pendingSignaturePreviewUrl = null;
            }
            render();
        });

        // Clear field-level errors as the user edits.
        document.getElementById('profil-akademik-name')?.addEventListener('input', () => {
            if (nameError) { nameError = ''; render(); }
        });
        document.getElementById('profil-akademik-nip')?.addEventListener('input', () => {
            if (nipError) { nipError = ''; render(); }
        });

        document.getElementById('toggle-pwd-edit')?.addEventListener('click', () => {
            isEditingPassword = !isEditingPassword;
            render();
        });

        // Foto Profil Preview
        document.getElementById('foto-input')?.addEventListener('change', (e) => {
            const input = e.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) return;
            if (!AKADEMIK_FOTO_MIME_RE.test(file.type)) {
                photoError = 'Format foto harus JPG, PNG, atau WEBP.';
                input.value = '';
                render();
                return;
            }
            if (file.size > MAX_AKADEMIK_FOTO_BYTES) {
                photoError = 'Ukuran foto maksimal 2 MB.';
                input.value = '';
                render();
                return;
            }
            photoError = '';
            pendingPhotoFile = file;
            const reader = new FileReader();
            reader.onload = (re) => {
                pendingPhotoPreviewUrl = typeof re.target?.result === 'string' ? re.target.result : null;
                render();
            };
            reader.readAsDataURL(file);
        });

        // Signature Preview
        document.getElementById('sig-input')?.addEventListener('change', (e) => {
            const input = e.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) return;
            if (!AKADEMIK_FOTO_MIME_RE.test(file.type)) {
                signatureError = 'Format tanda tangan harus JPG, PNG, atau WEBP.';
                input.value = '';
                render();
                return;
            }
            if (file.size > MAX_AKADEMIK_FOTO_BYTES) {
                signatureError = 'Ukuran tanda tangan maksimal 2 MB.';
                input.value = '';
                render();
                return;
            }
            signatureError = '';
            pendingSignatureFile = file;
            const reader = new FileReader();
            reader.onload = (re) => {
                pendingSignaturePreviewUrl = typeof re.target?.result === 'string' ? re.target.result : null;
                render();
            };
            reader.readAsDataURL(file);
        });

        // Submit Personal Info
        document.getElementById('personal-info-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Build payload manually so we control exactly which fields go to the
            // backend. Email is locked here and must never be submitted; role /
            // sub_role / status / scope remain admin-managed.
            const nameInput = document.getElementById('profil-akademik-name') as HTMLInputElement | null;
            const nipInput = document.getElementById('profil-akademik-nip') as HTMLInputElement | null;
            const newName = nameInput?.value.trim() || '';
            const newNip = nipInput?.value.trim() || '';

            nameError = '';
            nipError = '';
            photoError = '';
            signatureError = '';

            if (!newName) {
                nameError = 'Nama tidak boleh kosong.';
                render();
                return;
            }

            const formData = new FormData();
            formData.append('_method', 'PUT'); // Spoofing for Laravel PUT
            formData.append('name', newName);
            // Always send `nip` so blank clears the value server-side
            // (backend normalizeNip trims and turns empty into null).
            formData.append('nip', newNip);

            if (pendingPhotoFile) {
                formData.append('pas_foto', pendingPhotoFile);
            }
            if (pendingSignatureFile) {
                formData.append('tanda_tangan', pendingSignatureFile);
            }

            try {
                const res = await apiFetch('/api/profile', { method: 'POST', isFormData: true, body: formData });
                if (res.ok) {
                    const data = await res.json().catch(() => null);
                    const updatedName = data?.user?.name;
                    if (typeof updatedName === 'string' && updatedName) {
                        localStorage.setItem('auth_name', updatedName);
                    }
                    Toastify({ text: "Profil berhasil diperbarui!", duration: 3000, style: { background: "#10B981" } }).showToast();
                    // Drop locally-selected previews; fetchProfile loads canonical object URLs.
                    pendingPhotoFile = null;
                    pendingPhotoPreviewUrl = null;
                    pendingSignatureFile = null;
                    pendingSignaturePreviewUrl = null;
                    isEditingData = false;
                    fetchProfile();
                    return;
                }

                let body: any = null;
                try { body = await res.json(); } catch { /* ignore */ }

                if (res.status === 422 && body?.errors && typeof body.errors === 'object') {
                    const nipErrors = body.errors.nip;
                    const nameErrors = body.errors.name;
                    const photoErrors = body.errors.pas_foto;
                    const signatureErrors = body.errors.tanda_tangan;
                    if (Array.isArray(nipErrors) && nipErrors.length > 0) {
                        nipError = String(nipErrors[0]);
                    }
                    if (Array.isArray(nameErrors) && nameErrors.length > 0) {
                        nameError = String(nameErrors[0]);
                    }
                    if (Array.isArray(photoErrors) && photoErrors.length > 0) {
                        photoError = String(photoErrors[0]);
                    }
                    if (Array.isArray(signatureErrors) && signatureErrors.length > 0) {
                        signatureError = String(signatureErrors[0]);
                    }
                    if (!nipError && !nameError && !photoError && !signatureError) {
                        Toastify({ text: body?.message || "Gagal memperbarui profil", duration: 3000, style: { background: "#EF4444" } }).showToast();
                    }
                    render();
                    return;
                }

                Toastify({ text: body?.message || "Gagal memperbarui profil", duration: 3000, style: { background: "#EF4444" } }).showToast();
            } catch (err) {
                Toastify({ text: "Terjadi kesalahan sistem", duration: 3000, style: { background: "#EF4444" } }).showToast();
            }
        });

        // Submit Password
        document.getElementById('password-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            formData.append('_method', 'PUT');

            try {
                const res = await apiFetch('/api/profile', { method: 'POST', isFormData: true, body: formData });
                if (res.ok) {
                    Toastify({ text: "Kata sandi berhasil diperbarui!", duration: 3000, style: { background: "#10B981" } }).showToast();
                    isEditingPassword = false;
                    render();
                } else {
                    const err = await res.json();
                    Toastify({ text: err.message || "Gagal memperbarui kata sandi", duration: 3000, style: { background: "#EF4444" } }).showToast();
                }
            } catch (err) {
                Toastify({ text: "Terjadi kesalahan sistem", duration: 3000, style: { background: "#EF4444" } }).showToast();
            }
        });
    };

    // Initial load
    fetchProfile();
    render();
};
