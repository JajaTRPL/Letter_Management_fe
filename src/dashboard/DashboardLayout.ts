import { renderLogin } from '../login/Login';
import { renderSidebar } from '../components/Sidebar';
import { getGreetingName } from '../utils/nameHelper';
import Toastify from 'toastify-js';
import { apiFetch } from '../shared/api-client';

export const renderDashboardLayout = (title: string, content: string, role: string, activePage: string = 'dashboard') => {
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = `
        <div class="flex min-h-screen bg-[#F5F7F9] font-['Inter']">
            <!-- Sidebar -->
            ${renderSidebar(role, activePage)}

            <!-- Main Content -->
            <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
                <!-- Header -->
                <header class="bg-transparent px-8 py-6">
                    <div class="flex justify-between items-center">
                        <h1 class="text-[32px] font-semibold text-[#111827] font-['Inter'] drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
                            ${title}
                        </h1>
                        
                        <div class="flex items-center gap-6">
                            <button id="notif-btn" class="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                                <span class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                            
                            <div class="relative group">
                                <div class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div class="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden text-teal-700 font-bold shrink-0">
                                        <img id="header-user-avatar" src="${(role === 'mahasiswa' && localStorage.getItem('auth_photo')) || '/ugm-logo.png'}" alt="Profile" class="w-full h-full ${(role === 'mahasiswa' && localStorage.getItem('auth_photo')) ? 'object-cover' : 'w-8 h-8 object-contain'}">
                                    </div>
                                    <div class="text-right">
                                        <p class="text-sm font-semibold text-gray-900 leading-none">${getGreetingName(localStorage.getItem('auth_name'))}</p>
                                        <p class="text-[10px] text-gray-500 font-medium uppercase mt-1 tracking-wider">${role.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                
                                <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                    <a href="#/profile" id="profile-btn" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-teal-600 transition-colors">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        Profil
                                    </a>
                                    <div class="h-px bg-gray-100 my-1"></div>
                                    <button id="logout-btn" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                            <polyline points="16 17 21 12 16 7"></polyline>
                                            <line x1="21" y1="12" x2="9" y2="12"></line>
                                        </svg>
                                        Keluar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="w-full h-px bg-gray-200 mt-4"></div>
                </header>

                <!-- Page Content -->
                <main class="flex-1 overflow-y-auto px-8 pb-8">
                    <div id="dashboard-content" class="animate-fade-in">
                        ${content}
                    </div>
                </main>
            </div>
        </div>
    `;

    document.getElementById('profile-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (role === 'mahasiswa') {
            import('../mahasiswa/ProfilMahasiswa').then(({ renderProfilMahasiswa }) => {
                renderProfilMahasiswa();
            });
        } else if (role === 'super_admin') {
            import('../superadmin/ProfilSuperAdmin').then(({ renderProfilSuperAdmin }) => {
                renderProfilSuperAdmin();
            });
        } else if (role.startsWith('tendik')) {
            import('../tendik/ProfilTendik').then(({ renderProfilTendik }) => {
                renderProfilTendik(role);
            });
        } else if (['kadep', 'kaprodi', 'sekprodi', 'sekdep', 'akademik'].includes(role)) {
            import('../akademik/ProfilKaprodi').then(({ renderProfilKaprodi }) => {
                renderProfilKaprodi(role);
            });
        } else {
            Toastify({
                text: "Profil untuk role ini belum tersedia",
                duration: 2000,
                gravity: "top",
                position: "right",
                style: { background: "#F59E0B" }
            }).showToast();
        }
    });

    document.getElementById('sidebar-dashboard-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        if (role === 'mahasiswa') {
            import('../dashboard/MahasiswaDashboard').then(({ renderMahasiswaDashboard }) => {
                renderMahasiswaDashboard();
            });
        } else if (role === 'super_admin') {
            import('../dashboard/AdminDashboard').then(({ renderAdminDashboard }) => {
                renderAdminDashboard();
            });
        } else if (role.startsWith('tendik')) {
            import('../dashboard/TendikDashboard').then(({ renderTendikDashboard }) => {
                renderTendikDashboard(role);
            });
        } else if (['kadep', 'kaprodi', 'sekdep', 'sekprodi', 'akademik'].includes(role)) {
            import('../dashboard/AkademikDashboard').then(({ renderAkademikDashboard }) => {
                renderAkademikDashboard(role);
            });
        }
    });

    document.getElementById('notif-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('./Notifikasi').then(({ renderNotifikasi }) => {
            renderNotifikasi(role);
        });
    });

    document.getElementById('sidebar-users-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (role === 'super_admin') {
            (window as any).clearDashboardInterval?.();
            import('../superadmin/UserManagement').then(({ renderUserManagement }) => {
                renderUserManagement();
            });
        }
    });

    document.getElementById('sidebar-monitoring-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../superadmin/LetterMonitoring').then(({ renderLetterMonitoring }) => {
            renderLetterMonitoring();
        });
    });

    document.getElementById('sidebar-template-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../superadmin/templates/TemplateDokumen').then(({ renderTemplateDokumen }) => {
            renderTemplateDokumen();
        });
    });

    document.getElementById('sidebar-logs-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../superadmin/LogReport').then(({ renderLogReport }) => {
            renderLogReport();
        });
    });

    document.getElementById('sidebar-academic-periods-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../superadmin/AcademicPeriodManagement').then(({ renderAcademicPeriodManagement }) => {
            void renderAcademicPeriodManagement();
        });
    });

    document.getElementById('sidebar-history-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../mahasiswa/RiwayatPengajuan').then(({ renderRiwayatPengajuan }) => {
            renderRiwayatPengajuan();
        });
    });

    document.getElementById('sidebar-administrasi-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../mahasiswa/AdministrasiSurat').then(({ renderAdministrasiSurat }) => {
            renderAdministrasiSurat();
        });
    });

    document.getElementById('sidebar-peminjaman-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../mahasiswa/PeminjamanRuangan').then(({ renderPeminjamanRuangan }) => {
            renderPeminjamanRuangan();
        });
    });

    document.getElementById('sidebar-dokumen-tendik-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../tendik/DokumenTendik').then(({ renderDokumenTendik }) => {
            renderDokumenTendik(role);
        });
    });

    document.getElementById('sidebar-riwayat-tendik-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../tendik/RiwayatTendik').then(({ renderRiwayatTendik }) => {
            renderRiwayatTendik(role);
        });
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        (window as any).clearDashboardInterval?.();
        const token = localStorage.getItem('auth_token');
        if (token) {
            try {
                await apiFetch('/api/logout', { method: 'POST' });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_role');
        localStorage.removeItem('auth_name');
        localStorage.removeItem('auth_photo');
        localStorage.removeItem('auth_sub_role');
        localStorage.removeItem('auth_assigned_tasks');
        localStorage.removeItem('auth_role_level');
        localStorage.removeItem('auth_user_id');

        Toastify({
            text: "Berhasil keluar!",
            duration: 2000,
            gravity: "top",
            position: "right",
            style: {
                background: "#10B981",
            }
        }).showToast();

        setTimeout(() => {
            renderLogin();
        }, 500);
    });
};
