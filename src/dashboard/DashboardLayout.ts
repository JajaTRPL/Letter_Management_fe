// `renderLogin` is loaded lazily inside the logout handler (below) so this shared
// layout does not statically depend on the Login page. That page→page edge was the
// root of the inherited import cycle (C1); the dynamic import matches the app's
// existing navigation convention and preserves identical runtime behavior.
import { renderSidebar } from '../components/Sidebar';
import { getGreetingName } from '../utils/nameHelper';
import Toastify from 'toastify-js';
import { apiFetch, loadProtectedImageObjectUrl, revokeProtectedImageObjectUrl } from '../shared/api-client';

let dashboardLayoutAvatarObjectUrl: string | null = null;
let dashboardLayoutDrawerCleanup: (() => void) | null = null;

const isNarrowDashboardViewport = (): boolean => window.innerWidth < 1024;

export const cleanupDashboardLayout = (): void => {
    dashboardLayoutDrawerCleanup?.();
    dashboardLayoutDrawerCleanup = null;
};

const attachDashboardSidebarDrawer = (): (() => void) => {
    const sidebar = document.getElementById('dashboard-sidebar');
    const overlay = document.getElementById('dashboard-sidebar-overlay');
    const toggle = document.getElementById('dashboard-sidebar-toggle');
    const closeButton = document.getElementById('dashboard-sidebar-close');
    if (!sidebar || !overlay || !toggle || !closeButton) return () => undefined;

    const bodyWasScrollLocked = document.body.classList.contains('overflow-hidden');
    let isOpen = false;

    const restoreBodyScroll = (): void => {
        if (!bodyWasScrollLocked) document.body.classList.remove('overflow-hidden');
    };
    const syncSidebarAccessibility = (): void => {
        const shouldHideSidebar = isNarrowDashboardViewport() && !isOpen;
        sidebar.setAttribute('aria-hidden', String(shouldHideSidebar));
        sidebar.toggleAttribute('inert', shouldHideSidebar);
    };
    const closeDrawer = (restoreFocus = false): void => {
        isOpen = false;
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.remove('translate-x-0');
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        restoreBodyScroll();
        syncSidebarAccessibility();
        if (restoreFocus && isNarrowDashboardViewport()) toggle.focus();
    };
    const openDrawer = (): void => {
        if (!isNarrowDashboardViewport()) return;
        isOpen = true;
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        sidebar.setAttribute('aria-hidden', 'false');
        sidebar.removeAttribute('inert');
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('overflow-hidden');
        closeButton.focus();
    };
    const onToggle = (): void => {
        if (isOpen) closeDrawer(true);
        else openDrawer();
    };
    const onOverlayClick = (): void => closeDrawer(true);
    const onCloseClick = (): void => closeDrawer(true);
    const onKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && isOpen) closeDrawer(true);
    };
    const onResize = (): void => {
        if (!isNarrowDashboardViewport()) closeDrawer();
        else syncSidebarAccessibility();
    };
    const navigationLinks = Array.from(sidebar.querySelectorAll<HTMLAnchorElement>('nav a'));
    const onNavigation = (): void => {
        if (isNarrowDashboardViewport()) closeDrawer();
    };

    toggle.addEventListener('click', onToggle);
    overlay.addEventListener('click', onOverlayClick);
    closeButton.addEventListener('click', onCloseClick);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', onResize);
    navigationLinks.forEach((link) => link.addEventListener('click', onNavigation));
    closeDrawer();

    return (): void => {
        closeDrawer();
        toggle.removeEventListener('click', onToggle);
        overlay.removeEventListener('click', onOverlayClick);
        closeButton.removeEventListener('click', onCloseClick);
        document.removeEventListener('keydown', onKeydown);
        window.removeEventListener('resize', onResize);
        navigationLinks.forEach((link) => link.removeEventListener('click', onNavigation));
    };
};

export const renderDashboardLayout = (title: string, content: string, role: string, activePage: string = 'dashboard') => {
    cleanupDashboardLayout();
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = `
        <div class="flex min-h-screen bg-[#F5F7F9] font-['Inter']">
            <div id="dashboard-sidebar-overlay" class="hidden fixed inset-0 z-50 bg-gray-900/50 lg:hidden" aria-hidden="true"></div>

            <!-- Sidebar -->
            ${renderSidebar(role, activePage)}

            <!-- Main Content -->
            <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
                <!-- Header -->
                <header class="bg-transparent px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
                    <div class="flex justify-between items-center">
                        <div class="flex min-w-0 items-center gap-3">
                            <button id="dashboard-sidebar-toggle" type="button" class="lg:hidden shrink-0 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-teal/60" aria-label="Buka menu navigasi" aria-controls="dashboard-sidebar" aria-expanded="false">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <line x1="3" y1="6" x2="21" y2="6"></line>
                                    <line x1="3" y1="12" x2="21" y2="12"></line>
                                    <line x1="3" y1="18" x2="21" y2="18"></line>
                                </svg>
                            </button>
                            <h1 class="truncate text-2xl font-semibold text-[#111827] font-['Inter'] drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] lg:text-[32px]">
                                ${title}
                            </h1>
                        </div>
                        
                        <div class="flex items-center gap-6">
                            <button id="notif-btn" class="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                            </button>
                            
                            <div class="relative group">
                                <div class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div class="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden text-teal-700 font-bold shrink-0">
                                        <img id="header-user-avatar" src="/ugm-logo.png" alt="Profile" class="w-8 h-8 object-contain">
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
                <main class="flex-1 overflow-y-auto px-4 pb-8 sm:px-6 lg:px-8">
                    <div id="dashboard-content" class="animate-fade-in">
                        ${content}
                    </div>
                </main>
            </div>
        </div>
    `;

    dashboardLayoutDrawerCleanup = attachDashboardSidebarDrawer();

    // Async-load the header avatar from the auth-protected storage endpoint.
    // The img always renders the default logo first; if a real photo exists
    // and loads successfully, the src is swapped to an object URL. Failure
    // (no photo, 403/404) silently keeps the logo placeholder.
    const cachedPhoto = localStorage.getItem('auth_photo');
    if (cachedPhoto) {
        void loadProtectedImageObjectUrl(cachedPhoto).then((objectUrl) => {
            if (!objectUrl) return;
            const headerAvatar = document.getElementById('header-user-avatar') as HTMLImageElement | null;
            if (!headerAvatar) {
                revokeProtectedImageObjectUrl(objectUrl);
                return;
            }
            revokeProtectedImageObjectUrl(dashboardLayoutAvatarObjectUrl);
            dashboardLayoutAvatarObjectUrl = objectUrl;
            headerAvatar.src = objectUrl;
            headerAvatar.className = 'w-full h-full object-cover';
        });
    }

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

    document.getElementById('sidebar-retention-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (role === 'super_admin') {
            (window as any).clearDashboardInterval?.();
            import('../superadmin/RetentionControlPanel').then(({ renderRetentionControlPanel }) => {
                void renderRetentionControlPanel();
            });
        }
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

    document.getElementById('sidebar-dokumen-akademik-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../akademik/DokumenAkademik').then(({ renderDokumenAkademik }) => {
            void renderDokumenAkademik(role);
        });
    });

    document.getElementById('sidebar-riwayat-tendik-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../tendik/RiwayatTendik').then(({ renderRiwayatTendik }) => {
            renderRiwayatTendik(role);
        });
    });

    document.getElementById('sidebar-riwayat-akademik-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).clearDashboardInterval?.();
        import('../akademik/RiwayatAkademik').then(({ renderRiwayatAkademik }) => {
            void renderRiwayatAkademik(role);
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
            void import('../login/Login').then(({ renderLogin }) => renderLogin());
        }, 500);
    });
};
