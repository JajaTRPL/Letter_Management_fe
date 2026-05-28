import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import Toastify from 'toastify-js';
import { renderLogin } from '../login/Login';
import { apiFetch, loadProtectedImageObjectUrl, revokeProtectedImageObjectUrl } from '../shared/api-client';
import { getAssignedTaskLabel } from '../shared/letter-workflow';

const MAX_FOTO_PROFIL_BYTES = 2 * 1024 * 1024; // matches backend `image|max:2048` for non-mahasiswa
const FOTO_PROFIL_MIME_RE = /^image\/(jpeg|jpg|png|webp)$/i;

type ProfileUser = {
    id?: number | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    sub_role?: string | null;
    tendik_role?: string | null;
    status?: string | null;
    nip?: string | null;
    assigned_tasks?: string[] | null;
    created_at?: string | null;
};

type ProfileResponse = {
    user?: ProfileUser;
    profile?: {
        pas_foto_path?: string | null;
        tanda_tangan_path?: string | null;
    };
};

const FALLBACK_NAME = 'Pengguna';

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const showToast = (text: string, success = true) => {
    Toastify({
        text,
        duration: 3000,
        style: { background: success ? '#10B981' : '#EF4444' },
    }).showToast();
};

const roleLabel = (role?: string | null): string => {
    switch (role) {
        case 'tendik': return 'Tenaga Pendidik';
        case 'akademik': return 'Akademik';
        case 'super_admin': return 'Super Admin';
        default: return role ? role : '-';
    }
};

const statusLabel = (status?: string | null): string => {
    switch (status) {
        case 'Active': return 'Aktif';
        case 'Suspended': return 'Disuspend';
        case 'Pending_Profile': return 'Menunggu Profil';
        default: return status || '-';
    }
};

const statusBadgeTone = (status?: string | null): string => {
    switch (status) {
        case 'Active': return 'bg-[#ECFDF5] text-[#059669] border-green-100';
        case 'Suspended': return 'bg-red-50 text-red-700 border-red-100';
        case 'Pending_Profile': return 'bg-amber-50 text-amber-700 border-amber-100';
        default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
};

// Single source of truth for tendik_role display labels in this page.
// Matches the four values SuperAdmin user creation accepts
// (see SuperAdmin/UserController::store validation:
//  'tendik_role' => 'nullable|in:persuratan,sarpras,kepala_lab,laboran').
const tendikRoleLabel = (tendikRole?: string | null): string => {
    switch (tendikRole) {
        case 'persuratan': return 'Persuratan';
        case 'sarpras': return 'Sarana & Prasarana';
        case 'kepala_lab': return 'Kepala Laboratorium';
        case 'laboran': return 'Laboran';
        default: return tendikRole ? tendikRole : '-';
    }
};

const joinedYearFrom = (createdAt?: string | null): string => {
    if (!createdAt) return '-';
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '-';
    return String(d.getFullYear());
};

const renderTaskBadges = (tasks: string[] | null | undefined): string => {
    const list = Array.isArray(tasks) ? tasks : [];
    if (list.length === 0) {
        return `<span class="text-xs text-gray-400 italic">Belum ada penugasan</span>`;
    }
    return list.map((slug) => `
        <span class="bg-[#FEF08A]/60 text-yellow-800 text-[10px] font-bold px-3 py-1.5 rounded-full">
            ${escapeHtml(getAssignedTaskLabel(slug))}
        </span>
    `).join('');
};

const renderTaskList = (tasks: string[] | null | undefined): string => {
    const list = Array.isArray(tasks) ? tasks : [];
    const disabledClass = "w-full bg-[#E5E7EB]/50 border border-transparent px-4 py-2 rounded-lg text-sm text-gray-400 font-medium cursor-not-allowed";

    if (list.length === 0) {
        return `
            <input type="text" value="Belum ada penugasan" class="${disabledClass}" readonly>
            <p class="text-[10px] text-gray-700 font-bold mt-1">Tugas ditentukan oleh Super Admin</p>
        `;
    }
    return `
        ${list.map((slug) => `
            <input type="text" value="${escapeHtml(getAssignedTaskLabel(slug))}" class="${disabledClass}" readonly>
        `).join('')}
        <p class="text-[10px] text-gray-700 font-bold mt-1">Tugas ditentukan oleh Super Admin</p>
    `;
};

export const renderProfilTendik = (role: string) => {
    // Local state for this render pass.
    let isEditingData = false;
    let isEditingPassword = false;
    let isSavingData = false;
    let profileUser: ProfileUser = {
        name: localStorage.getItem('auth_name') || '',
    };
    // Field-level validation errors (populated on 422 response, cleared on edit).
    let nameError = '';
    let nipError = '';
    // Foto Profil state. `currentPhotoObjectUrl` is the auth-loaded object URL
    // displayed in the card. `pendingPhotoFile` + `pendingPhotoPreviewUrl` hold
    // the locally-selected file before save (rendered as a data: URL so we
    // don't burn a blob URL we can't easily revoke).
    let currentPhotoObjectUrl: string | null = null;
    let pendingPhotoFile: File | null = null;
    let pendingPhotoPreviewUrl: string | null = null;
    let photoError = '';

    const styleBlock = `
        <style>
            header { display: none !important; }
        </style>
    `;

    const renderFotoProfilField = () => {
        const previewSrc = pendingPhotoPreviewUrl || currentPhotoObjectUrl;
        const errorBlock = photoError
            ? `<p class="text-[10px] text-red-500 mt-1.5 font-bold">${escapeHtml(photoError)}</p>`
            : '';

        if (!isEditingData) {
            return `
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-gray-400">
                        ${previewSrc
                            ? `<img src="${escapeHtml(previewSrc)}" alt="Foto Profil" class="w-full h-full object-cover">`
                            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`}
                    </div>
                    <span class="text-sm text-gray-500 italic">${previewSrc ? 'Tersimpan' : 'Belum ada Foto Profil'}</span>
                </div>
            `;
        }

        return `
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-gray-400">
                        ${previewSrc
                            ? `<img src="${escapeHtml(previewSrc)}" alt="Foto Profil" class="w-full h-full object-cover">`
                            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`}
                    </div>
                    <label class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-teal-700 text-teal-700 text-xs font-bold hover:bg-teal-50 cursor-pointer transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <span>${previewSrc ? 'Ganti Foto Profil' : 'Unggah Foto Profil'}</span>
                        <input id="profil-tendik-foto" type="file" class="hidden" accept="image/jpeg,image/jpg,image/png,image/webp">
                    </label>
                </div>
                <p class="text-[10px] text-gray-500 font-medium">Opsional. JPG/PNG/WEBP, maksimal 2 MB.</p>
                ${errorBlock}
            </div>
        `;
    };

    const renderDataFields = () => {
        // Editable field styling vs. always-readonly (identity / account-managed) styling.
        const editableInputClass = "w-full bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all";
        const inlineReadonlyClass = "w-full bg-[#E5E7EB]/50 border border-transparent px-4 py-2 rounded-lg text-sm text-gray-500 font-medium cursor-default focus:outline-none";
        const lockedInputClass = "w-full bg-[#E5E7EB]/50 border border-transparent pl-10 pr-4 py-2 rounded-lg text-sm text-gray-500 font-medium cursor-not-allowed";
        const lockIcon = `<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>`;
        const errorTextClass = "text-[10px] text-red-500 mt-1.5 font-bold";

        const nameInputClass = isEditingData ? editableInputClass : inlineReadonlyClass;
        const nipInputClass = isEditingData ? editableInputClass : inlineReadonlyClass;

        const nameVal = escapeHtml(profileUser.name || '');
        const emailVal = escapeHtml(profileUser.email || '-');
        const nipVal = escapeHtml(profileUser.nip || '');
        const nipDisplayVal = isEditingData ? nipVal : (nipVal || '-');

        const saveLabel = isSavingData ? 'Menyimpan...' : 'Simpan Perubahan';
        const saveDisabledAttr = isSavingData ? 'disabled' : '';

        const nameAriaInvalid = nameError ? 'aria-invalid="true" aria-describedby="profil-tendik-name-error"' : '';
        const nipAriaInvalid = nipError ? 'aria-invalid="true" aria-describedby="profil-tendik-nip-error"' : '';

        return `
            <div class="space-y-4 max-w-3xl">
                <div class="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600 md:pt-2">Nama Lengkap</label>
                    <div class="flex-1">
                        <input id="profil-tendik-name" type="text" value="${nameVal}" class="${nameInputClass}" ${!isEditingData ? 'readonly' : ''} maxlength="255" ${nameAriaInvalid}>
                        ${nameError ? `<p id="profil-tendik-name-error" class="${errorTextClass}">${escapeHtml(nameError)}</p>` : ''}
                    </div>
                </div>
                <div class="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600 md:pt-2">Email</label>
                    <div class="flex-1">
                        <div class="relative">
                            ${lockIcon}
                            <input type="email" value="${emailVal}" class="${lockedInputClass}" readonly disabled aria-readonly="true" title="Email dikelola oleh Super Admin">
                        </div>
                        ${isEditingData ? `<p class="text-[10px] text-gray-500 mt-1.5 font-medium">Email dikelola oleh Super Admin.</p>` : ''}
                    </div>
                </div>
                <div class="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600 md:pt-2">NIP</label>
                    <div class="flex-1">
                        <input id="profil-tendik-nip" type="text" value="${nipDisplayVal}" class="${nipInputClass}" ${!isEditingData ? 'readonly' : ''} maxlength="50" placeholder="${isEditingData ? 'Masukkan NIP' : ''}" ${nipAriaInvalid}>
                        ${nipError ? `<p id="profil-tendik-nip-error" class="${errorTextClass}">${escapeHtml(nipError)}</p>` : ''}
                        ${isEditingData && !nipError ? `<p class="text-[10px] text-gray-500 mt-1.5 font-medium">Kosongkan jika belum tersedia.</p>` : ''}
                    </div>
                </div>
                <div class="flex flex-col md:flex-row gap-2 md:gap-4 mt-2">
                    <label class="w-40 text-sm font-semibold text-gray-600 pt-2">Tugas</label>
                    <div class="flex-1 space-y-2">
                        ${renderTaskList(profileUser.assigned_tasks)}
                    </div>
                </div>
                <div class="flex flex-col md:flex-row gap-2 md:gap-4 mt-2">
                    <label class="w-40 text-sm font-semibold text-gray-600 pt-2">Foto Profil</label>
                    <div class="flex-1">
                        ${renderFotoProfilField()}
                    </div>
                </div>
                ${isEditingData ? `
                    <p class="text-[11px] text-gray-500 italic pt-1">Nama, NIP, dan Foto Profil dapat diperbarui dari halaman ini. Role, status, dan tugas dikelola oleh Super Admin.</p>
                    <div class="flex justify-end gap-3 mt-2 pt-4">
                        <button id="cancel-data-btn" class="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors" ${saveDisabledAttr}>Batal</button>
                        <button id="save-data-btn" class="px-5 py-2 rounded-lg bg-teal-800 text-white font-semibold text-sm shadow-sm hover:bg-teal-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" ${saveDisabledAttr}>${saveLabel}</button>
                    </div>
                ` : ''}
            </div>
        `;
    };

    const renderPasswordFields = () => {
        if (!isEditingPassword) {
            return `
                <div class="flex justify-between items-center max-w-3xl">
                    <p class="text-sm text-gray-500">Kata sandi Anda dilindungi dan dienkripsi.</p>
                </div>
            `;
        }
        const inputContainerClass = "relative flex-1";
        const passInputClass = "w-full bg-white border border-gray-200 px-10 py-2.5 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all";
        const lockIcon = `<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>`;
        return `
            <div class="space-y-4 max-w-3xl">
                <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                    Fitur ubah kata sandi belum tersedia untuk Tendik. Hubungi Super Admin untuk reset kata sandi.
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Kata Sandi Saat Ini</label>
                    <div class="${inputContainerClass}">
                        ${lockIcon}
                        <input type="password" placeholder="Belum tersedia" class="${passInputClass} bg-gray-50 cursor-not-allowed" disabled>
                    </div>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Kata Sandi Baru</label>
                    <div class="${inputContainerClass}">
                        ${lockIcon}
                        <input type="password" placeholder="Belum tersedia" class="${passInputClass} bg-gray-50 cursor-not-allowed" disabled>
                    </div>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Konfirmasi Kata Sandi Baru</label>
                    <div class="${inputContainerClass}">
                        ${lockIcon}
                        <input type="password" placeholder="Belum tersedia" class="${passInputClass} bg-gray-50 cursor-not-allowed" disabled>
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-6 pt-4">
                    <button id="cancel-pwd-btn" class="px-5 py-2 rounded-lg border-2 border-teal-800 text-teal-800 font-bold text-sm hover:bg-teal-50 transition-colors">Tutup</button>
                </div>
            </div>
        `;
    };

    const renderAvatar = () => {
        // Order of precedence: locally-selected preview > loaded object URL > placeholder.
        const previewSrc = pendingPhotoPreviewUrl || currentPhotoObjectUrl;
        if (previewSrc) {
            return `<img id="tendik-foto-profil-img" src="${escapeHtml(previewSrc)}" alt="Foto Profil" class="w-full h-full object-cover">`;
        }
        return `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    };

    const renderCards = () => {
        const displayName = escapeHtml(profileUser.name || FALLBACK_NAME);
        const displayEmail = escapeHtml(profileUser.email || '-');
        const statusText = statusLabel(profileUser.status);
        const statusClass = statusBadgeTone(profileUser.status);
        const roleText = roleLabel(profileUser.role);
        const tendikRoleText = tendikRoleLabel(profileUser.tendik_role);
        const joinedYear = joinedYearFrom(profileUser.created_at);

        return `
            <div class="flex flex-col lg:flex-row gap-6 mb-6">
                <div class="bg-white rounded-[20px] p-8 flex flex-col items-center justify-center border border-gray-100 shadow-sm w-full lg:w-1/3">
                    <div class="w-24 h-24 rounded-full border-4 border-gray-100 flex items-center justify-center mb-4 text-gray-700 bg-gray-50 overflow-hidden">
                        ${renderAvatar()}
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 mb-1">${displayName}</h3>
                    <p class="text-sm text-gray-500 mb-3">${displayEmail}</p>
                    <span class="${statusClass} text-[11px] font-bold px-4 py-1.5 rounded-full border">${escapeHtml(statusText)}</span>
                </div>

                <div class="flex-1 flex flex-col gap-4">
                    <div class="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p class="text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Role</p>
                        <p class="text-sm font-semibold text-gray-800">${escapeHtml(roleText)}${profileUser.tendik_role ? ` · <span class="text-gray-500 font-medium">${escapeHtml(tendikRoleText)}</span>` : ''}</p>
                    </div>
                    <div class="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p class="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Task</p>
                        <div class="flex flex-wrap gap-2">
                            ${renderTaskBadges(profileUser.assigned_tasks)}
                        </div>
                    </div>
                    <div class="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p class="text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Bergabung Sejak</p>
                        <p class="text-sm font-semibold text-gray-800">${escapeHtml(joinedYear)}</p>
                    </div>
                </div>
            </div>
        `;
    };

    const updateUI = () => {
        const cardsContainer = document.getElementById('profile-cards-container');
        if (cardsContainer) cardsContainer.innerHTML = renderCards();

        const dataContainer = document.getElementById('data-form-container');
        if (dataContainer) dataContainer.innerHTML = renderDataFields();

        const pwdContainer = document.getElementById('pwd-form-container');
        if (pwdContainer) pwdContainer.innerHTML = renderPasswordFields();

        const dataEditBtn = document.getElementById('edit-data-btn');
        if (dataEditBtn) dataEditBtn.style.display = isEditingData ? 'none' : 'block';

        const pwdEditBtn = document.getElementById('edit-pwd-btn');
        if (pwdEditBtn) pwdEditBtn.style.display = isEditingPassword ? 'none' : 'block';

        attachDynamicListeners();
    };

    const saveProfileData = async () => {
        // Self-editable: name + nip + optional pas_foto. Email is account identity
        // and managed exclusively by Super Admin; we do not read it from the DOM here.
        const nameInput = document.getElementById('profil-tendik-name') as HTMLInputElement | null;
        const nipInput = document.getElementById('profil-tendik-nip') as HTMLInputElement | null;
        const newName = nameInput?.value.trim() || '';
        const newNip = nipInput?.value.trim() || '';

        nameError = '';
        nipError = '';
        photoError = '';

        if (!newName) {
            nameError = 'Nama tidak boleh kosong.';
            updateUI();
            return;
        }

        isSavingData = true;
        updateUI();

        try {
            const formData = new FormData();
            formData.append('name', newName);
            // Always send `nip` so blank clears the value server-side
            // (backend normalizeNip trims and turns empty into null).
            formData.append('nip', newNip);
            if (pendingPhotoFile) {
                formData.append('pas_foto', pendingPhotoFile);
            }

            const res = await apiFetch('/api/profile', {
                method: 'POST',
                body: formData,
                isFormData: true,
            });

            if (!res.ok) {
                let body: any = null;
                try { body = await res.json(); } catch { /* ignore */ }

                if (res.status === 422 && body?.errors && typeof body.errors === 'object') {
                    const nipErrors = body.errors.nip;
                    const nameErrors = body.errors.name;
                    const photoErrors = body.errors.pas_foto;
                    if (Array.isArray(nipErrors) && nipErrors.length > 0) {
                        nipError = String(nipErrors[0]);
                    }
                    if (Array.isArray(nameErrors) && nameErrors.length > 0) {
                        nameError = String(nameErrors[0]);
                    }
                    if (Array.isArray(photoErrors) && photoErrors.length > 0) {
                        photoError = String(photoErrors[0]);
                    }
                    if (!nipError && !nameError && !photoError) {
                        showToast(typeof body.message === 'string' ? body.message : 'Profil Gagal Disimpan', false);
                    }
                } else {
                    const msg = typeof body?.message === 'string' ? body.message : 'Profil Gagal Disimpan';
                    showToast(msg, false);
                }
                return;
            }

            const data = await res.json();
            profileUser = { ...profileUser, ...(data?.user || {}) };
            if (profileUser.name) localStorage.setItem('auth_name', profileUser.name);
            // Reload the displayed photo from the response's pas_foto_path so the
            // card swaps from the local data URL to the stored canonical version.
            const newPhotoPath: string | null = data?.profile?.pas_foto_path ?? null;
            pendingPhotoFile = null;
            pendingPhotoPreviewUrl = null;
            if (newPhotoPath) {
                localStorage.setItem('auth_photo', newPhotoPath);
                void loadProtectedImageObjectUrl(newPhotoPath).then((objectUrl) => {
                    revokeProtectedImageObjectUrl(currentPhotoObjectUrl);
                    currentPhotoObjectUrl = objectUrl;
                    updateUI();
                });
            } else {
                revokeProtectedImageObjectUrl(currentPhotoObjectUrl);
                currentPhotoObjectUrl = null;
            }
            isEditingData = false;
            showToast('Profil Berhasil Disimpan');
        } catch (e) {
            console.error('Failed to save tendik profile', e);
            showToast('Profil Gagal Disimpan', false);
        } finally {
            isSavingData = false;
            updateUI();
        }
    };

    function attachDynamicListeners() {
        document.getElementById('cancel-data-btn')?.addEventListener('click', () => {
            if (isSavingData) return;
            isEditingData = false;
            nameError = '';
            nipError = '';
            photoError = '';
            // Discard any locally-selected photo on cancel.
            pendingPhotoFile = null;
            pendingPhotoPreviewUrl = null;
            updateUI();
        });

        document.getElementById('save-data-btn')?.addEventListener('click', () => {
            if (isSavingData) return;
            void saveProfileData();
        });

        // Clear field-level errors as the user edits; re-render only when an
        // error was actually showing to avoid losing input focus on each keystroke.
        document.getElementById('profil-tendik-name')?.addEventListener('input', () => {
            if (nameError) { nameError = ''; updateUI(); }
        });
        document.getElementById('profil-tendik-nip')?.addEventListener('input', () => {
            if (nipError) { nipError = ''; updateUI(); }
        });

        document.getElementById('profil-tendik-foto')?.addEventListener('change', (event) => {
            const input = event.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) return;
            if (!FOTO_PROFIL_MIME_RE.test(file.type)) {
                photoError = 'Format foto harus JPG, PNG, atau WEBP.';
                input.value = '';
                updateUI();
                return;
            }
            if (file.size > MAX_FOTO_PROFIL_BYTES) {
                photoError = 'Ukuran foto maksimal 2 MB.';
                input.value = '';
                updateUI();
                return;
            }
            photoError = '';
            pendingPhotoFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                pendingPhotoPreviewUrl = typeof e.target?.result === 'string' ? e.target.result : null;
                updateUI();
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('cancel-pwd-btn')?.addEventListener('click', () => {
            isEditingPassword = false;
            updateUI();
        });
    }

    const content = `
        ${styleBlock}
        <div class="w-full max-w-5xl mx-auto py-8">
            <div class="flex justify-between items-center mb-8">
                <div class="flex items-center gap-3 cursor-pointer text-gray-800 hover:text-teal-800 transition-colors" id="back-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    <h1 class="text-3xl font-bold">Profil Saya</h1>
                </div>
                <button id="logout-btn-profil" class="flex items-center gap-2 bg-[#EF4444] hover:bg-red-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Keluar
                </button>
            </div>

            <div id="profile-cards-container">
                ${renderCards()}
            </div>

            <div class="bg-white rounded-[20px] p-8 border border-gray-100 shadow-sm mb-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold text-gray-800">Informasi Data Diri</h3>
                    <button id="edit-data-btn" class="text-teal-700 font-bold text-sm hover:text-teal-900 transition-colors">Edit</button>
                </div>
                <div id="data-form-container">
                    ${renderDataFields()}
                </div>
            </div>

            <div class="bg-white rounded-[20px] p-8 border border-gray-100 shadow-sm mb-12">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold text-gray-800">Keamanan Akun</h3>
                    <button id="edit-pwd-btn" class="text-teal-700 font-bold text-sm hover:text-teal-900 transition-colors">Lihat</button>
                </div>
                <div id="pwd-form-container">
                    ${renderPasswordFields()}
                </div>
            </div>
        </div>
    `;

    renderDashboardLayout('Profil Saya', content, role, 'dashboard');
    updateUI();

    document.getElementById('back-btn')?.addEventListener('click', () => {
        import('../dashboard/TendikDashboard').then(({ renderTendikDashboard }) => {
            renderTendikDashboard(role);
        });
    });

    document.getElementById('logout-btn-profil')?.addEventListener('click', async () => {
        (window as any).clearDashboardInterval?.();
        const token = localStorage.getItem('auth_token');
        if (token) {
            try {
                await apiFetch('/api/logout', { method: 'POST' });
            } catch { /* ignore */ }
        }
        localStorage.clear();
        Toastify({ text: 'Berhasil keluar!', duration: 2000, style: { background: '#10B981' } }).showToast();
        setTimeout(() => renderLogin(), 500);
    });

    document.getElementById('edit-data-btn')?.addEventListener('click', () => {
        isEditingData = true;
        nameError = '';
        nipError = '';
        updateUI();
    });

    document.getElementById('edit-pwd-btn')?.addEventListener('click', () => {
        isEditingPassword = true;
        updateUI();
    });

    // Fetch real profile data; render once it arrives.
    void (async () => {
        try {
            const res = await apiFetch('/api/profile', { cache: 'no-store' });
            if (!res.ok) return;
            const data: ProfileResponse = await res.json();
            profileUser = { ...profileUser, ...(data?.user || {}) };
            if (profileUser.name) localStorage.setItem('auth_name', profileUser.name);
            const photoPath = data?.profile?.pas_foto_path ?? null;
            if (photoPath) {
                localStorage.setItem('auth_photo', photoPath);
                const objectUrl = await loadProtectedImageObjectUrl(photoPath);
                revokeProtectedImageObjectUrl(currentPhotoObjectUrl);
                currentPhotoObjectUrl = objectUrl;
            }
            updateUI();
        } catch (e) {
            console.error('Failed to load tendik profile', e);
        }
    })();
};
