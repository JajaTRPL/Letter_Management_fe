import { renderDashboardLayout } from './DashboardLayout';
import { renderLogin } from '../login/Login';
import Toastify from 'toastify-js';
import { apiFetch } from '../shared/api-client';

let activeTab: 'semua' | 'belum_dibaca' = 'semua';

interface NotifItem {
    title: string;
    description: string;
    date: string;
    isUnread: boolean;
}

export const renderNotifikasi = (role: string) => {
    const styleBlock = `
        <style>
            header { display: none !important; }
        </style>
    `;

    const fullName = localStorage.getItem('auth_name') || 'Pengguna';

    const allNotifications: NotifItem[] = [];

    const renderTabs = () => {
        const semuaActive = activeTab === 'semua';
        const belumActive = activeTab === 'belum_dibaca';

        const activeClass = "px-6 py-2.5 text-sm font-bold bg-[#0D4A46] text-white outline-none transition-colors";
        const inactiveClass = "px-6 py-2.5 text-sm font-bold bg-white text-gray-600 hover:bg-gray-50 outline-none transition-colors";

        return `
            <div class="flex items-center gap-0 mb-6 bg-white rounded-xl overflow-hidden border border-gray-200 w-fit">
                <button id="tab-semua" class="${semuaActive ? activeClass : inactiveClass} ${semuaActive ? '' : 'border-r border-gray-200'}"">Semua</button>
                <button id="tab-belum-dibaca" class="${belumActive ? activeClass : inactiveClass}">Belum Dibaca</button>
            </div>
        `;
    };

    const renderEmptyState = () => `
        <div class="bg-white border border-gray-100 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
            <div class="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-gray-400">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
            </div>
            <h3 class="text-base font-bold text-gray-800 mb-1">Belum ada notifikasi.</h3>
            <p class="text-sm text-gray-500 max-w-md">Fitur notifikasi akan ditampilkan setelah terhubung dengan data sistem.</p>
        </div>
    `;

    const renderNotifications = () => {
        const filtered = activeTab === 'belum_dibaca'
            ? allNotifications.filter(n => n.isUnread)
            : allNotifications;

        if (filtered.length === 0) {
            return renderEmptyState();
        }

        return filtered.map(item => `
            <div class="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-4">
                <h3 class="text-base font-bold text-gray-900">${item.title}</h3>
                <p class="text-sm text-gray-600 mt-1">${item.description}</p>
                <span class="text-[11px] font-semibold text-gray-400 mt-2 block">${item.date}</span>
            </div>
        `).join('');
    };

    const updateView = () => {
        const tabsContainer = document.getElementById('notif-tabs-container');
        if (tabsContainer) {
            tabsContainer.innerHTML = renderTabs();
        }

        const listContainer = document.getElementById('notif-list-container');
        if (listContainer) {
            listContainer.innerHTML = renderNotifications();
        }

        bindDynamicListeners();
    };

    const bindDynamicListeners = () => {
        document.getElementById('tab-semua')?.addEventListener('click', () => {
            activeTab = 'semua';
            updateView();
        });

        document.getElementById('tab-belum-dibaca')?.addEventListener('click', () => {
            activeTab = 'belum_dibaca';
            updateView();
        });
    };

    const content = `
        ${styleBlock}
        <div class="w-full max-w-5xl mx-auto py-8">
            <div class="flex justify-between items-center mb-10 pb-4 border-b border-transparent">
                <div class="flex items-center gap-3 cursor-pointer text-gray-800 hover:text-teal-800 transition-colors" id="back-btn-notif">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    <h1 class="text-3xl font-bold">Notifikasi</h1>
                </div>
                <div class="flex items-center gap-2 border-l border-gray-300 pl-6 cursor-pointer relative group">
                    <div class="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 overflow-hidden shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <span class="text-sm font-semibold text-gray-700 pr-1">${fullName}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-500"><polyline points="6 9 12 15 18 9"></polyline></svg>

                    <div class="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div class="p-2 space-y-1">
                            <button id="notif-profile-btn" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-teal-700 rounded-lg font-medium transition-colors">Profil Saya</button>
                            <button id="notif-logout-btn" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg font-medium transition-colors">Keluar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="notif-tabs-container">
                ${renderTabs()}
            </div>

            <div id="notif-list-container" class="space-y-0">
                ${renderNotifications()}
            </div>
        </div>
    `;

    renderDashboardLayout('Notifikasi', content, role, 'dashboard');

    document.getElementById('back-btn-notif')?.addEventListener('click', () => {
        (window as any).clearDashboardInterval?.();
        if (role === 'mahasiswa') {
            import('./MahasiswaDashboard').then(({ renderMahasiswaDashboard }) => renderMahasiswaDashboard());
        } else if (role === 'super_admin') {
            import('./AdminDashboard').then(({ renderAdminDashboard }) => renderAdminDashboard());
        } else if (role.startsWith('tendik')) {
            import('./TendikDashboard').then(({ renderTendikDashboard }) => renderTendikDashboard(role));
        } else if (['kadep', 'kaprodi', 'sekdep', 'sekprodi', 'akademik'].includes(role)) {
            import('./AkademikDashboard').then(({ renderAkademikDashboard }) => renderAkademikDashboard(role));
        }
    });

    document.getElementById('notif-logout-btn')?.addEventListener('click', async () => {
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

    document.getElementById('notif-profile-btn')?.addEventListener('click', () => {
        if (role === 'mahasiswa') {
            import('../mahasiswa/ProfilMahasiswa').then(({ renderProfilMahasiswa }) => renderProfilMahasiswa());
        } else if (role.startsWith('tendik')) {
            import('../tendik/ProfilTendik').then(({ renderProfilTendik }) => renderProfilTendik(role));
        } else if (['kadep', 'kaprodi', 'sekdep', 'sekprodi', 'akademik'].includes(role)) {
            import('../akademik/ProfilKaprodi').then(({ renderProfilKaprodi }) => renderProfilKaprodi(role));
        } else {
            Toastify({ text: "Profil untuk role ini belum tersedia", duration: 2000, style: { background: "#F59E0B" } }).showToast();
        }
    });

    bindDynamicListeners();
};
