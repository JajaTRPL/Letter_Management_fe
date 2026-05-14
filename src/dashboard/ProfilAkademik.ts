import { renderDashboardLayout } from './DashboardLayout';
import Toastify from 'toastify-js';
import { renderLogin } from '../login/Login';
import { apiFetch } from '../shared/api-client';

let isEditingData = false;
let isEditingPassword = false;

export const renderProfilAkademik = (role: string) => {
    // Hide standard layout header
    const styleBlock = `
        <style>
            header { display: none !important; }
        </style>
    `;

    const fullName = localStorage.getItem('auth_name') || 'Dr. Umar Taufiq S.Kom., M.Cs.';
    const email = 'umartaufiq@mail.ugm.ac.id';

    // Map role to display label
    const roleLabels: Record<string, string> = {
        'kaprodi': 'Kaprodi',
        'sekprodi': 'Sekprodi',
        'kadep': 'Kadep',
        'sekdep': 'Sekdep',
        'akademik': 'Akademik',
    };
    const roleLabel = roleLabels[role] || roleLabels[localStorage.getItem('auth_sub_role') || ''] || 'Akademik';

    // ── Notification Banner ──
    const showNotification = (type: 'success' | 'error') => {
        const container = document.getElementById('notif-banner-container');
        if (!container) return;

        if (type === 'success') {
            container.innerHTML = `
                <div id="notif-banner" class="flex items-start gap-3 bg-white border border-green-200 rounded-2xl px-6 py-4 shadow-lg mb-4 animate-slide-down max-w-3xl mx-auto">
                    <div class="w-8 h-8 rounded-full bg-[#ECFDF5] flex items-center justify-center shrink-0 mt-0.5">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-gray-900">Kata Sandi Berhasil Diperbarui</h4>
                        <p class="text-xs text-gray-500 mt-0.5">Kata sandi akun Anda telah berhasil diperbarui</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div id="notif-banner" class="flex items-start gap-3 bg-white border border-red-200 rounded-2xl px-6 py-4 shadow-lg mb-4 animate-slide-down max-w-3xl mx-auto">
                    <div class="w-8 h-8 rounded-full bg-[#FEF2F2] flex items-center justify-center shrink-0 mt-0.5">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-gray-900">Kata Sandi Gagal Diperbarui</h4>
                        <p class="text-xs text-gray-500 mt-0.5">Kata sandi akun Anda belum berhasil diperbarui. Silakan periksa kembali data yang Anda isi atau coba beberapa saat lagi</p>
                    </div>
                </div>
            `;
        }

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const banner = document.getElementById('notif-banner');
            if (banner) {
                banner.classList.add('animate-slide-up');
                setTimeout(() => {
                    if (container) container.innerHTML = '';
                }, 400);
            }
        }, 5000);
    };

    // ── Signature SVG placeholder ──
    const signatureSvg = `
        <svg viewBox="0 0 200 100" width="160" height="80" class="text-gray-600">
            <path d="M20 70 Q40 20 60 50 T100 40 T140 60 T180 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M60 55 Q70 30 80 50" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
    `;

    // ── Data Diri Fields ──
    const renderDataFields = () => {
        const inputClass = isEditingData
            ? "w-full bg-white border border-gray-300 px-4 py-2.5 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
            : "w-full bg-[#E5E7EB]/50 border border-transparent px-4 py-2.5 rounded-lg text-sm text-gray-500 font-medium cursor-default focus:outline-none";

        return `
            <div class="space-y-5 max-w-3xl">
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <label class="w-44 text-sm font-semibold text-gray-600 shrink-0">Nama Lengkap</label>
                    <input type="text" value="${fullName}" class="${inputClass}" ${!isEditingData ? 'readonly' : ''}>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <label class="w-44 text-sm font-semibold text-gray-600 shrink-0">Email</label>
                    <input type="email" value="${email}" class="${inputClass}" ${!isEditingData ? 'readonly' : ''}>
                </div>
                <div class="flex flex-col md:flex-row gap-2 md:gap-6">
                    <label class="w-44 text-sm font-semibold text-gray-600 shrink-0 pt-2">Tanda Tangan</label>
                    <div class="bg-[#F3F4F6] border border-gray-200 rounded-xl p-4 flex items-center justify-center w-[200px] h-[100px]">
                        ${signatureSvg}
                    </div>
                </div>
                ${isEditingData ? `
                    <div class="flex justify-end gap-3 mt-6 pt-4">
                        <button id="cancel-data-btn" class="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">Batal</button>
                        <button id="save-data-btn" class="px-5 py-2 rounded-lg bg-teal-800 text-white font-semibold text-sm shadow-sm hover:bg-teal-900 transition-colors">Simpan Perubahan</button>
                    </div>
                ` : ''}
            </div>
        `;
    };

    // ── Password Fields ──
    const renderPasswordFields = () => {
        if (!isEditingPassword) {
            return '';
        }

        const inputContainerClass = "relative flex-1";
        const passInputClass = "w-full bg-white border border-gray-200 pl-10 pr-10 py-2.5 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all";
        const lockIcon = `<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>`;
        const eyeBtnClass = "toggle-pwd-visibility absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors";
        const eyeIcon = `<button type="button" class="${eyeBtnClass}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>`;

        return `
            <div class="space-y-5 max-w-3xl">
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <label class="w-44 text-sm font-semibold text-gray-600 shrink-0">Kata Sandi Saat Ini</label>
                    <div class="${inputContainerClass}">
                        ${lockIcon}
                        <input id="pwd-current" type="password" placeholder="Masukkan kata sandi" class="${passInputClass}">
                        ${eyeIcon}
                    </div>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <label class="w-44 text-sm font-semibold text-gray-600 shrink-0">Kata Sandi Baru</label>
                    <div class="${inputContainerClass}">
                        ${lockIcon}
                        <input id="pwd-new" type="password" placeholder="Masukkan kata sandi" class="${passInputClass}">
                        ${eyeIcon}
                    </div>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <label class="w-44 text-sm font-semibold text-gray-600 shrink-0">Konfirmasi Kata Sandi Baru</label>
                    <div class="${inputContainerClass}">
                        ${lockIcon}
                        <input id="pwd-confirm" type="password" placeholder="Masukkan kata sandi" class="${passInputClass}">
                        ${eyeIcon}
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-6 pt-4">
                    <button id="cancel-pwd-btn" class="px-5 py-2 rounded-lg border-2 border-teal-800 text-teal-800 font-bold text-sm hover:bg-teal-50 transition-colors">Batal</button>
                    <button id="save-pwd-btn" class="px-5 py-2 rounded-lg bg-teal-800 text-white font-bold text-sm shadow-sm hover:bg-teal-900 transition-colors">Ganti Kata Sandi</button>
                </div>
            </div>
        `;
    };

    // ── Update UI ──
    const updateUI = () => {
        const dataContainer = document.getElementById('data-form-container');
        if (dataContainer) dataContainer.innerHTML = renderDataFields();

        const pwdContainer = document.getElementById('pwd-form-container');
        if (pwdContainer) pwdContainer.innerHTML = renderPasswordFields();

        const dataEditBtn = document.getElementById('edit-data-btn');
        if (dataEditBtn) {
            dataEditBtn.style.display = isEditingData ? 'none' : 'block';
        }

        const pwdEditBtn = document.getElementById('edit-pwd-btn');
        if (pwdEditBtn) {
            pwdEditBtn.style.display = isEditingPassword ? 'none' : 'block';
        }

        attachDynamicListeners();
    };

    const content = `
        ${styleBlock}
        <style>
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-16px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideUp {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-16px); }
            }
            .animate-slide-down { animation: slideDown 0.35s ease-out forwards; }
            .animate-slide-up { animation: slideUp 0.35s ease-in forwards; }
        </style>
        <div class="w-full max-w-5xl mx-auto py-8">
            <!-- Notification Banner Container -->
            <div id="notif-banner-container"></div>

            <!-- Custom Header -->
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

            <!-- Top Cards -->
            <div class="flex flex-col lg:flex-row gap-6 mb-6">
                <!-- Profile Avatar Card -->
                <div class="bg-white rounded-[20px] p-8 flex flex-col items-center justify-center border border-gray-100 shadow-sm w-full lg:w-1/3">
                    <div class="w-24 h-24 rounded-full border-4 border-gray-100 flex items-center justify-center mb-4 text-gray-700 bg-gray-50 overflow-hidden">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-1 text-center">${fullName}</h3>
                    <p class="text-sm text-gray-500 mb-3">${email}</p>
                    <span class="bg-[#ECFDF5] text-[#059669] text-[11px] font-bold px-4 py-1.5 rounded-full border border-green-100">Aktif</span>
                </div>

                <!-- Info Cards -->
                <div class="flex-1 flex flex-col gap-4">
                    <div class="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p class="text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Peran</p>
                        <p class="text-sm font-semibold text-gray-800">${roleLabel}</p>
                    </div>
                    <div class="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p class="text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Bergabung Sejak</p>
                        <p class="text-sm font-semibold text-gray-800">2026</p>
                    </div>
                </div>
            </div>

            <!-- Informasi Data Diri -->
            <div class="bg-white rounded-[20px] p-8 border border-gray-100 shadow-sm mb-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold text-gray-800">Informasi Data Diri</h3>
                    <button id="edit-data-btn" class="text-teal-700 font-bold text-sm hover:text-teal-900 transition-colors">Edit</button>
                </div>
                <div id="data-form-container">
                    ${renderDataFields()}
                </div>
            </div>

            <!-- Keamanan Akun -->
            <div class="bg-white rounded-[20px] p-8 border border-gray-100 shadow-sm mb-12">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold text-gray-800">Keamanan Akun</h3>
                    <button id="edit-pwd-btn" class="text-teal-700 font-bold text-sm hover:text-teal-900 transition-colors">Edit</button>
                </div>
                <div id="pwd-form-container">
                    ${renderPasswordFields()}
                </div>
            </div>
        </div>
    `;

    renderDashboardLayout('Profil Saya', content, role, 'dashboard');

    // Initial UI state
    updateUI();

    // ── Static Event Listeners ──
    document.getElementById('back-btn')?.addEventListener('click', () => {
        isEditingData = false;
        isEditingPassword = false;
        import('./AkademikDashboard').then(({ renderAkademikDashboard }) => {
            renderAkademikDashboard(role);
        });
    });

    document.getElementById('logout-btn-profil')?.addEventListener('click', async () => {
        (window as any).clearDashboardInterval?.();
        const token = localStorage.getItem('auth_token');
        if (token) {
            try {
                await apiFetch('/api/logout', { method: 'POST' });
            } catch (e) {}
        }
        localStorage.clear();
        Toastify({ text: "Berhasil keluar!", duration: 2000, style: { background: "#10B981" } }).showToast();
        setTimeout(() => renderLogin(), 500);
    });

    document.getElementById('edit-data-btn')?.addEventListener('click', () => {
        isEditingData = true;
        updateUI();
    });

    document.getElementById('edit-pwd-btn')?.addEventListener('click', () => {
        isEditingPassword = true;
        updateUI();
    });

    // ── Dynamic Listeners ──
    function attachDynamicListeners() {
        // Data Diri buttons
        document.getElementById('cancel-data-btn')?.addEventListener('click', () => {
            isEditingData = false;
            updateUI();
        });

        document.getElementById('save-data-btn')?.addEventListener('click', () => {
            Toastify({ text: "Data diri berhasil disimpan", duration: 2000, gravity: "top", position: "right", style: { background: "#10B981" } }).showToast();
            isEditingData = false;
            updateUI();
        });

        // Password buttons
        document.getElementById('cancel-pwd-btn')?.addEventListener('click', () => {
            isEditingPassword = false;
            updateUI();
        });

        document.getElementById('save-pwd-btn')?.addEventListener('click', () => {
            const currentPwd = (document.getElementById('pwd-current') as HTMLInputElement)?.value || '';
            const newPwd = (document.getElementById('pwd-new') as HTMLInputElement)?.value || '';
            const confirmPwd = (document.getElementById('pwd-confirm') as HTMLInputElement)?.value || '';

            // Validation
            if (!currentPwd || !newPwd || !confirmPwd) {
                showNotification('error');
                return;
            }

            if (newPwd !== confirmPwd) {
                showNotification('error');
                return;
            }

            if (newPwd.length < 6) {
                showNotification('error');
                return;
            }

            // Success
            showNotification('success');
            isEditingPassword = false;
            updateUI();
        });

        // Toggle password visibility
        document.querySelectorAll('.toggle-pwd-visibility').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = (e.currentTarget as HTMLElement);
                const container = button.closest('.relative');
                const input = container?.querySelector('input') as HTMLInputElement;
                if (input) {
                    if (input.type === 'password') {
                        input.type = 'text';
                        button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
                    } else {
                        input.type = 'password';
                        button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
                    }
                }
            });
        });
    }
};
