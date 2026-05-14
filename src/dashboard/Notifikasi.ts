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

const getNotificationsByRole = (role: string): NotifItem[] => {
    if (['kadep', 'kaprodi', 'sekdep', 'sekprodi', 'akademik'].includes(role)) {
        return [
            {
                title: 'Dokumen Menunggu Paraf',
                description: 'Dokumen pengajuan surat dari mahasiswa telah diverifikasi dan menunggu persetujuan serta paraf Anda',
                date: 'Kamis, 5 Maret 2026 13:00',
                isUnread: true,
            },
            {
                title: 'Pengajuan Surat Disetujui',
                description: 'Pengajuan surat telah berhasil disetujui dan diproses lebih lanjut oleh sistem',
                date: 'Rabu, 4 Maret 2026 13:00',
                isUnread: true,
            },
            {
                title: 'Pengajuan Surat Ditolak',
                description: 'Pengajuan surat telah berhasil ditolak dan dikembalikan kepada tenaga pendidik untuk ditindaklanjuti',
                date: 'Selasa, 3 Maret 2026 11:00',
                isUnread: false,
            },
        ];
    }

    // Default Tendik notifications
    return [
        {
            title: 'Pengajuan Surat Baru',
            description: 'Pengajuan surat baru dari mahasiswa telah masuk dan menunggu verifikasi Anda',
            date: 'Kamis, 5 Maret 2026 13:00',
            isUnread: true,
        },
        {
            title: 'Permintaan Revisi Dikirim',
            description: 'Permintaan perbaikan dokumen telah berhasil dikirim kepada mahasiswa',
            date: 'Rabu, 4 Maret 2026 13:00',
            isUnread: true,
        },
        {
            title: 'Pengajuan Ditolak',
            description: 'Pengajuan surat telah berhasil ditolak dan dikembalikan kepada mahasiswa',
            date: 'Selasa, 3 Maret 2026 11:00',
            isUnread: false,
        },
        {
            title: 'Pengajuan Diteruskan ke Ketua Program Studi TRPL',
            description: 'Pengajuan surat telah berhasil diverifikasi dan diteruskan ke Ketua Program Studi',
            date: 'Selasa, 3 Maret 2026 11:00',
            isUnread: false,
        },
    ];
};

export const renderNotifikasi = (role: string) => {
    // Hide standard layout header
    const styleBlock = `
        <style>
            header { display: none !important; }
        </style>
    `;

    const fullName = localStorage.getItem('auth_name') || 'Dr. Umar Taufiq S.Kom., M.Cs.';

    const allNotifications = getNotificationsByRole(role);

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

    const renderNotificationCard = (item: NotifItem) => {
        const cardBg = item.isUnread ? 'bg-[#F4F9F9]' : 'bg-white';
        const cardBorder = item.isUnread ? 'border-2 border-[#1B4332]' : 'border border-gray-200';
        const titleColor = item.isUnread ? 'text-gray-900' : 'text-gray-800';
        const descColor = item.isUnread ? 'text-gray-800 font-medium' : 'text-gray-600';

        const greenDot = item.isUnread
            ? `<div class="w-3.5 h-3.5 bg-[#10B981] rounded-full shrink-0 mt-0.5"></div>`
            : '';

        return `
            <div class="${cardBg} ${cardBorder} rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-default mb-4">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        ${greenDot}
                        <h3 class="text-base font-bold ${titleColor} ${!item.isUnread ? 'ml-5.5' : ''}">${item.title}</h3>
                    </div>
                    <span class="text-[11px] font-semibold text-gray-400 mt-1 whitespace-nowrap ml-4">${item.date}</span>
                </div>
                <p class="text-sm ${descColor} ml-5.5 mb-3">${item.description}</p>
                <div class="flex justify-end mt-2">
                    <a href="#" class="text-xs font-bold text-[#0EA5E9] hover:text-blue-700 hover:underline transition-colors">Lihat Detail</a>
                </div>
            </div>
        `;
    };

    const renderNotifications = () => {
        const filtered = activeTab === 'belum_dibaca'
            ? allNotifications.filter(n => n.isUnread)
            : allNotifications;

        return filtered.map(item => renderNotificationCard(item)).join('');
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
            <!-- Custom Header -->
            <div class="flex justify-between items-center mb-10 pb-4 border-b border-transparent">
                <!-- Left: Title -->
                <div class="flex items-center gap-3 cursor-pointer text-gray-800 hover:text-teal-800 transition-colors" id="back-btn-notif">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    <h1 class="text-3xl font-bold">Notifikasi</h1>
                </div>
                <!-- Right: Avatar dropdown mimicking the default header -->
                <div class="flex items-center gap-2 border-l border-gray-300 pl-6 cursor-pointer relative group">
                    <div class="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 overflow-hidden shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <span class="text-sm font-semibold text-gray-700 pr-1">${fullName}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-500"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    
                    <!-- Dropdown on Hover -->
                    <div class="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div class="p-2 space-y-1">
                            <button id="notif-profile-btn" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-teal-700 rounded-lg font-medium transition-colors">Profil Saya</button>
                            <button id="notif-logout-btn" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg font-medium transition-colors">Keluar</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabs Container -->
            <div id="notif-tabs-container">
                ${renderTabs()}
            </div>

            <!-- Notifications List -->
            <div id="notif-list-container" class="space-y-0">
                ${renderNotifications()}
            </div>
        </div>
    `;

    renderDashboardLayout('Notifikasi', content, role, 'dashboard');

    // Make the back button act like the sidebar link to return to the active dashboard
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
        } else {
            Toastify({ text: "Profil untuk role ini belum tersedia", duration: 2000, style: { background: "#F59E0B" } }).showToast();
        }
    });

    // Sub component listeners initial trigger
    bindDynamicListeners();
};
