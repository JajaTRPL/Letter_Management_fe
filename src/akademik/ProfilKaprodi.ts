import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderLogin } from '../login/Login';
import Toastify from 'toastify-js';
import { apiFetch } from '../shared/api-client';

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
        role: role,
        sub_role: '',
        status: 'Aktif',
        joined_since: '2026',
        photo: '',
        signature: ''
    };

    const fetchProfile = async () => {
        try {
            const res = await apiFetch('/api/profile');
            if (res.ok) {
                const data = await res.json();
                userData.name = data.user.name;
                userData.email = data.user.email;
                userData.sub_role = data.user.sub_role;
                userData.status = data.user.status || 'Aktif';
                userData.photo = data.profile.pas_foto_path;
                userData.signature = data.profile.tanda_tangan_path;
                render();
            }
        } catch (e) {
            console.error('Fetch profile error:', e);
        }
    };

    const getRoleDisplayName = (r: string, sub: string) => {
        if (sub === 'kaprodi') return 'Ketua Program Studi TRPL';
        if (sub === 'kadep') return 'Ketua Departemen';
        if (sub === 'sekprodi') return 'Sekretaris Program Studi';
        if (sub === 'sekdep') return 'Sekretaris Departemen';
        return r.charAt(0).toUpperCase() + r.slice(1);
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
                            ${userData.photo
                ? `<img src="${userData.photo}" class="w-full h-full object-cover">`
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
                            <p class="text-base font-bold text-gray-800">${getRoleDisplayName(userData.role, userData.sub_role)}</p>
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
                        <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                            <label class="w-48 text-sm font-bold text-gray-500">Nama Lengkap</label>
                            <div class="flex-1">
                                <input type="text" name="name" value="${userData.name}" 
                                    class="w-full ${isEditingData ? 'bg-white border-gray-300 font-bold' : 'bg-gray-100 border-transparent cursor-default font-bold'} border px-4 py-3 rounded-xl text-sm text-gray-700 font-semibold focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all" 
                                    ${!isEditingData ? 'readonly' : ''}>
                            </div>
                        </div>
                        <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                            <label class="w-48 text-sm font-bold text-gray-500">Email</label>
                            <div class="flex-1">
                                <input type="email" name="email" value="${userData.email}" 
                                    class="w-full ${isEditingData ? 'bg-white border-gray-300 font-bold' : 'bg-gray-100 border-transparent cursor-default font-bold'} border px-4 py-3 rounded-xl text-sm text-gray-700 font-semibold focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all" 
                                    ${!isEditingData ? 'readonly' : ''}>
                            </div>
                        </div>
                        <div class="flex flex-col md:flex-row gap-2 md:gap-6">
                            <label class="w-48 text-sm font-bold text-gray-500 pt-3">Paraf</label>
                            <div class="flex-1 flex flex-col gap-3">
                                <div class="w-full max-w-[280px] h-[120px] bg-gray-100 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                                    ${userData.signature
                ? `<img id="sig-preview" src="${userData.signature}" class="max-h-full max-w-full object-contain p-2">`
                : `<div id="sig-placeholder" class="text-gray-400 flex flex-col items-center gap-1 font-bold">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"></path></svg>
                                            <span class="text-[10px] font-bold">Belum ada Paraf</span>
                                          </div>`
            }
                                    ${isEditingData ? `
                                        <label class="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <span class="text-xs font-bold">Ganti Paraf</span>
                                            <input type="file" id="sig-input" class="hidden" accept="image/*">
                                        </label>
                                    ` : ''}
                                </div>
                                ${isEditingData ? `<p class="text-[10px] text-gray-400 font-medium font-bold">* Format PNG Transparan sangat disarankan</p>` : ''}
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
            render();
        });

        document.getElementById('toggle-pwd-edit')?.addEventListener('click', () => {
            isEditingPassword = !isEditingPassword;
            render();
        });

        // Signature Preview
        document.getElementById('sig-input')?.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    const preview = document.getElementById('sig-preview') as HTMLImageElement;
                    if (preview) preview.src = re.target?.result as string;
                    else {
                        const placeholder = document.getElementById('sig-placeholder');
                        if (placeholder) {
                            const newImg = document.createElement('img');
                            newImg.id = 'sig-preview';
                            newImg.src = re.target?.result as string;
                            newImg.className = 'max-h-full max-w-full object-contain p-2';
                            placeholder.replaceWith(newImg);
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        // Submit Personal Info
        document.getElementById('personal-info-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            formData.append('_method', 'PUT'); // Spoofing for Laravel PUT

            const sigInput = document.getElementById('sig-input') as HTMLInputElement;
            if (sigInput.files?.[0]) {
                formData.append('tanda_tangan', sigInput.files[0]);
            }

            try {
                const res = await apiFetch('/api/profile', { method: 'POST', isFormData: true, body: formData });
                if (res.ok) {
                    Toastify({ text: "Profil berhasil diperbarui!", duration: 3000, style: { background: "#10B981" } }).showToast();
                    isEditingData = false;
                    fetchProfile();
                } else {
                    const err = await res.json();
                    Toastify({ text: err.message || "Gagal memperbarui profil", duration: 3000, style: { background: "#EF4444" } }).showToast();
                }
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
