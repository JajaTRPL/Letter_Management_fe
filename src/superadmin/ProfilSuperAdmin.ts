import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import Toastify from 'toastify-js';
import { renderLogin } from '../login/Login';
import { apiFetch } from '../shared/api-client';

export const renderProfilSuperAdmin = () => {
    // Hide standard layout header
    const styleBlock = `
        <style>
            header { display: none !important; }
        </style>
    `;

    const userName = localStorage.getItem('auth_name') || 'Super Admin';
    const userEmail = localStorage.getItem('auth_email') || 'superadmin@gmail.com';

    const content = `
        ${styleBlock}
        <div class="w-full max-w-5xl mx-auto py-8">
            <!-- Custom Header -->
            <div class="flex justify-between items-center mb-8">
                <div class="flex items-center gap-3 cursor-pointer text-gray-800 hover:text-teal-800 transition-colors" id="back-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    <h1 class="text-3xl font-bold">Profil Saya</h1>
                </div>
                <button id="logout-btn-profil" class="flex items-center gap-2 bg-[#EF4444] hover:bg-red-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Keluar
                </button>
            </div>

            <!-- Profile Card -->
            <div class="bg-white rounded-[20px] p-8 border border-gray-100 shadow-sm">
                <div class="flex items-center gap-6">
                    <!-- Avatar -->
                    <div class="w-20 h-20 rounded-full border-4 border-gray-100 flex items-center justify-center text-gray-700 bg-gray-50 overflow-hidden shrink-0">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>
                    <!-- Info -->
                    <div>
                        <h3 class="text-xl font-bold text-gray-900 mb-1">${userName}</h3>
                        <p class="text-sm text-gray-500 mb-3">${userEmail}</p>
                        <span class="bg-[#ECFDF5] text-[#059669] text-[11px] font-bold px-4 py-1.5 rounded-full border border-green-100">Aktif</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    renderDashboardLayout('Profil Saya', content, 'super_admin', 'dashboard');

    // Back button - go to admin dashboard
    document.getElementById('back-btn')?.addEventListener('click', () => {
        import('../dashboard/AdminDashboard').then(({ renderAdminDashboard }) => {
            renderAdminDashboard();
        });
    });

    // Logout button - show confirmation modal
    document.getElementById('logout-btn-profil')?.addEventListener('click', () => {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'logout-modal';
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" id="modal-overlay"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md mx-4 text-center z-10 animate-fade-in">
                <h2 class="text-xl font-bold text-gray-900 mb-3">Keluar dari Akun</h2>
                <p class="text-sm text-gray-500 leading-relaxed mb-8">
                    Anda akan keluar dari sistem.<br>
                    Pastikan perubahan telah disimpan sebelum melanjutkan.
                </p>
                <div class="flex justify-center gap-4">
                    <button id="modal-cancel-btn" class="px-8 py-2.5 rounded-lg border-2 border-teal-800 text-teal-800 font-bold text-sm hover:bg-teal-50 transition-colors min-w-[120px]">
                        Batal
                    </button>
                    <button id="modal-confirm-btn" class="px-8 py-2.5 rounded-lg bg-teal-800 text-white font-bold text-sm hover:bg-teal-900 transition-colors min-w-[120px]">
                        Keluar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Cancel - close modal
        document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
            modal.remove();
        });

        // Overlay click-to-dismiss removed to prevent accidental closure

        // Confirm logout
        document.getElementById('modal-confirm-btn')?.addEventListener('click', async () => {
            (window as any).clearDashboardInterval?.();
            const token = localStorage.getItem('auth_token');
            if (token) {
                try {
                    await apiFetch('/api/logout', { method: 'POST' });
                } catch (e) { }
            }
            localStorage.clear();
            modal.remove();
            Toastify({ text: "Berhasil keluar!", duration: 2000, style: { background: "#10B981" } }).showToast();
            setTimeout(() => renderLogin(), 500);
        });
    });
};
