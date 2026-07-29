import { renderDashboardLayout } from './DashboardLayout';
import { apiFetch } from '../shared/api-client';
import {
    attachSuperAdminDelegatedActivityDashboardCard,
    renderSuperAdminDelegatedActivityDashboardCard,
} from '../superadmin/DelegatedActivityMonitoring';
import {
    hydrateNotificationWidget,
    notificationWidgetShell,
    type NotificationWidgetConfig,
} from '../shared/notification-widget';
import {
    hydrateReviewPerformance,
    reviewPerformanceShell,
    type ReviewPerformanceWidgetConfig,
} from '../shared/review-performance-widget';
import { renderDashboardStatCard, type DashboardStatTone } from '../shared/ui-primitives';

/**
 * Replaces the old "Rata-Rata Durasi Persetujuan Surat" card, which showed two
 * boxes permanently reading 00 Hari 00 Jam 00 Menit — one of them because it read
 * a database column nothing has written since the workflow moved to Kaprodi/Kadep.
 *
 * "Pemeriksaan" rather than "Persetujuan": the same vocabulary the SLA governance
 * panel already uses, and it correctly covers files that were returned for
 * revision rather than approved.
 */
const REVIEW_PERFORMANCE_CARD: ReviewPerformanceWidgetConfig = {
    mountId: 'admin-review-performance',
    endpoint: '/api/super-admin/review-performance?period=3months',
    variant: 'summary',
    title: 'Monitoring Kinerja',
    subtitle: 'Waktu pemeriksaan per tahap untuk surat administrasi dan peminjaman ruangan.',
    action: {
        label: 'Lihat Monitoring Kinerja',
        onClick: () => {
            void import('../superadmin/ReviewPerformance').then(({ renderReviewPerformance }) => {
                renderReviewPerformance();
            });
        },
    },
};

// SuperAdmin's ONLY notification stream is system-health anomalies (the recipient
// resolver never routes business notifications here) — so it gets a dedicated
// health panel on the dashboard, not a business feed buried in the bell.
const ADMIN_HEALTH_WIDGET: NotificationWidgetConfig = {
    mountId: 'admin-health-widget',
    category: 'system',
    role: 'super_admin',
    title: 'Status Sistem',
    subtitle: 'Anomali alur kerja yang perlu ditangani admin (mis. penerima tugas tidak tersedia).',
    emptyTitle: 'Sistem sehat',
    emptyBody: 'Tidak ada anomali kesehatan sistem saat ini.',
    limit: 5,
    accent: 'alert',
};

let refreshInterval: any = null;
let activePeriod: string = 'week';

const fragmentFromMarkup = (markup: string): DocumentFragment => {
    const range = document.createRange();
    range.selectNode(document.body);
    return range.createContextualFragment(markup);
};

const setMarkup = (element: Element, markup: string): void => {
    element.replaceChildren(fragmentFromMarkup(markup));
};

export const renderAdminDashboard = async () => {
    // Clear existing interval if any
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    // Set global clear function for other components to use
    (window as any).clearDashboardInterval = () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    };

    // Initial loading state
    renderDashboardLayout('Dashboard', '<div id="admin-dashboard-wrapper"><div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div></div></div>', 'super_admin');

    const updateDashboardData = async (isInitial = false) => {
        // Self-cleanup: stop interval and abort if user navigated away
        if (!isInitial && !document.getElementById('admin-dashboard-wrapper')) {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
            return;
        }

        try {
            const response = await apiFetch('/api/super-admin/dashboard/stats');
            const stats = await response.json();

            const activeCount = stats.status_distribution?.active?.count || 0;
            const suspendedCount = stats.status_distribution?.suspended?.count || 0;
            const pendingCount = stats.status_distribution?.pending?.count || 0;
            const totalStatus = activeCount + suspendedCount + pendingCount || 1;
            const activePct = Math.round((activeCount / totalStatus) * 100);
            const suspendedPct = Math.round((suspendedCount / totalStatus) * 100);
            const pendingPct = Math.round((pendingCount / totalStatus) * 100);

            // Build multi-segment donut
            const radius = 16;
            const circumference = 2 * Math.PI * radius;
            const activeLen = (activePct / 100) * circumference;
            const suspendedLen = (suspendedPct / 100) * circumference;
            const pendingLen = (pendingPct / 100) * circumference;
            const activeOffset = 0;
            const suspendedOffset = activeLen;
            const pendingOffset = activeLen + suspendedLen;

            const content = `
                <div class="space-y-8 animate-fade-in pb-12">
                    <!-- Welcome Section -->
                    <div>
                        <h2 class="text-2xl font-semibold text-gray-800 font-['Inter']">Halo, Super Admin!</h2>
                        <p class="mt-1 text-sm text-gray-500">Kelola pengguna, data master, dan pantau aktivitas sistem.</p>
                        <span class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold font-['Inter'] mt-2 bg-amber-500 text-white">
                            Super Admin
                        </span>
                    </div>

                    ${notificationWidgetShell(ADMIN_HEALTH_WIDGET)}

                    ${renderSuperAdminDelegatedActivityDashboardCard({ kind: 'loading' })}

                    <!-- User Count Cards -->
                    <div>
                        <h3 class="text-base font-semibold text-gray-800 mb-1 font-['Inter']">Total Pengguna Aktif</h3>
                        <p class="text-xs text-gray-500 mb-4 font-['Inter']">Jumlah pengguna aktif berdasarkan peran dalam sistem.</p>
                        <div class="grid grid-cols-2 gap-4">
                            ${renderCountCard('Mahasiswa', stats.user_counts?.mahasiswa || 0, 'info', '/mahasiswa-logo.png')}
                            ${renderCountCard('Tenaga Pendidik', stats.user_counts?.tendik || 0, 'success', '/tendik-logo.png')}
                            ${renderCountCard('Akademik', stats.user_counts?.akademik || 0, 'accent', '/akademik-logo.png')}
                            ${renderCountCard('Super Admin', stats.user_counts?.super_admin || 0, 'neutral', '/admin-logo.png')}
                        </div>
                    </div>

                    <!-- Account Status Section -->
                    <div>
                        <h3 class="text-base font-bold text-gray-800 mb-1">Status Akun Pengguna</h3>
                        <p class="text-xs text-gray-500 mb-4">Distribusi status akun pengguna pada sistem.</p>
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div class="space-y-3">
                                ${renderStatusBar('Aktif', activeCount, activePct, 'active')}
                                ${renderStatusBar('Ditangguhkan', suspendedCount, suspendedPct, 'suspended')}
                                ${renderStatusBar('Profil belum lengkap', pendingCount, pendingPct, 'pending')}
                            </div>

                            <div class="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center shadow-sm">
                                <div class="relative w-44 h-44">
                                    <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
                                        <circle cx="18" cy="18" r="${radius}" fill="transparent" stroke="#E5E7EB" stroke-width="3.5"></circle>
                                        <circle cx="18" cy="18" r="${radius}" fill="transparent" stroke="#10B981" stroke-width="3.5"
                                            stroke-dasharray="${activeLen.toFixed(2)} ${circumference.toFixed(2)}"
                                            stroke-dashoffset="-${activeOffset.toFixed(2)}"></circle>
                                        <circle cx="18" cy="18" r="${radius}" fill="transparent" stroke="#EF4444" stroke-width="3.5"
                                            stroke-dasharray="${suspendedLen.toFixed(2)} ${circumference.toFixed(2)}"
                                            stroke-dashoffset="-${suspendedOffset.toFixed(2)}"></circle>
                                        <circle cx="18" cy="18" r="${radius}" fill="transparent" stroke="#F59E0B" stroke-width="3.5"
                                            stroke-dasharray="${pendingLen.toFixed(2)} ${circumference.toFixed(2)}"
                                            stroke-dashoffset="-${pendingOffset.toFixed(2)}"></circle>
                                    </svg>
                                    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span class="text-3xl font-black text-gray-800">${stats.user_counts?.total || 0}</span>
                                        <span class="text-[10px] font-bold text-gray-500 mt-1">Total Pengguna</span>
                                    </div>
                                </div>
                                <div class="flex gap-4 mt-4 text-[10px]">
                                    <span class="flex items-center gap-1"><img src="/aktif-logo.png" class="w-3 h-3 object-contain" /> Aktif</span>
                                    <span class="flex items-center gap-1"><img src="/suspended-logo.png" class="w-3 h-3 object-contain" /> Ditangguhkan</span>
                                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Profil belum lengkap</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Separator -->
                    <hr class="border-gray-200">

                    <!-- Activity Line Charts -->
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-base font-bold text-gray-800">Laporan Aktivitas Sistem</h3>
                            <p class="text-xs text-gray-500">Menampilkan aktivitas penggunaan sistem pada periode yang dipilih</p>
                        </div>

                        <!-- Period Tabs -->
                        <div id="activity-tab-bar" class="flex items-center justify-between w-full">
                            <button class="activity-tab py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors" data-period="today">Hari Ini</button>
                            <button class="activity-tab py-1.5 px-5 text-sm font-bold text-white rounded-lg transition-all active-tab bg-primary-teal" data-period="week">Minggu Ini</button>
                            <button class="activity-tab py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors" data-period="1month">1 Bulan</button>
                            <button class="activity-tab py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors" data-period="3months">3 Bulan</button>
                            <button class="activity-tab py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors" data-period="6months">6 Bulan</button>
                            <button class="activity-tab py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors" data-period="12months">12 Bulan</button>
                        </div>

                        <!-- Charts -->
                        <div class="space-y-4">
                            ${renderChartCard('Aktivitas Login', 'Total aktivitas login pengguna ke sistem pada periode yang dipilih', stats.activity_stats || { labels: [], data: [] }, 'Total Pengguna')}
                            ${renderChartCard('Pengajuan Surat', 'Jumlah pengajuan surat yang masuk ke sistem pada periode yang dipilih', stats.scholarship_stats || { labels: [], data: [] }, 'Total Pengajuan Surat')}
                        </div>

                        <!-- Review speed: all five stages of both workflow
                             domains, from the review-performance backbone. -->
                        ${reviewPerformanceShell(REVIEW_PERFORMANCE_CARD)}
                    </div>
                </div>
            `;

            const container = document.getElementById('admin-dashboard-wrapper');
            if (container) {
                setMarkup(container, content);

                // Hydrate the system-health panel from the C7N1 backbone. Best-effort
                // and self-contained: a notification fault renders only inside the
                // panel and never blocks the dashboard. Re-runs on each 30s refresh.
                void hydrateNotificationWidget(ADMIN_HEALTH_WIDGET);

                // Review speed is a governance figure over months, not a live
                // gauge: re-fetching it every 30s would only make the numbers
                // flicker. The payload carries its own cache TTL instead.
                void hydrateReviewPerformance(REVIEW_PERFORMANCE_CARD);

                // Tab switching logic
                const tabBar = document.getElementById('activity-tab-bar');
                attachSuperAdminDelegatedActivityDashboardCard();

                const setActiveTab = (period: string) => {
                    // Class toggles rather than inline style, so the active tab
                    // follows the brand token instead of a second hex that has
                    // to be remembered separately from the markup above.
                    tabBar?.querySelectorAll('.activity-tab').forEach(b => {
                        b.classList.remove('active-tab', 'font-bold', 'text-white', 'bg-primary-teal', 'rounded-lg');
                        b.classList.add('font-medium', 'text-gray-500');
                    });
                    const activeBtn = tabBar?.querySelector(`.activity-tab[data-period="${period}"]`) as HTMLElement | null;
                    if (activeBtn) {
                        activeBtn.classList.add('active-tab', 'font-bold', 'text-white', 'bg-primary-teal', 'rounded-lg');
                        activeBtn.classList.remove('font-medium', 'text-gray-500');
                    }
                };

                // Restore previously selected tab after re-render
                setActiveTab(activePeriod);

                tabBar?.querySelectorAll('.activity-tab').forEach(btn => {
                    btn.addEventListener('click', () => {
                        activePeriod = (btn as HTMLElement).dataset.period || 'week';
                        setActiveTab(activePeriod);
                    });
                });
            }
        } catch (error) {
            console.error('Error updating dashboard data:', error);
            if (isInitial) {
                renderDashboardLayout('Dashboard', '<div class="p-8 text-center text-red-600 bg-red-50 rounded-2xl">Gagal memuat statistik dashboard.</div>', 'super_admin');
            }
        }
    };

    // Initial fetch
    await updateDashboardData(true);

    // Set interval for refreshes
    refreshInterval = setInterval(() => updateDashboardData(), 30000);
};

// The role-count cards now come from the same primitive as every other
// dashboard's stat cards. The old "Total Pengguna" sub-line is dropped: the
// section heading directly above already says "Total Pengguna Aktif", and the
// primitive puts the label under the number instead of above it.
const renderCountCard = (title: string, count: number, tone: DashboardStatTone, iconUrl: string) =>
    renderDashboardStatCard({
        label: title,
        value: count,
        tone,
        iconSvg: `<img src="${iconUrl}" alt="" class="w-14 h-14 object-contain" />`,
    });

/**
 * Account-status bars. Every colour here used to be an inline hex passed in from
 * the call site, which put six literals per row outside the token system — the
 * one thing that guarantees a surface drifts when the palette moves. The kind is
 * now a name and the palette lives in one map.
 *
 * The bar's WIDTH stays inline: it is a computed percentage, not a colour.
 */
type StatusBarKind = 'active' | 'suspended' | 'pending';

const STATUS_BAR_TONE: Record<StatusBarKind, {
    surface: string; label: string; iconBox: string; track: string; fill: string; glyph: string;
}> = {
    active: {
        surface: 'bg-emerald-100/70 border-emerald-200',
        label: 'text-emerald-800',
        iconBox: 'bg-emerald-500/20 text-emerald-600',
        track: 'bg-emerald-500/25',
        fill: 'bg-emerald-500',
        glyph: '<polyline points="20 6 9 17 4 12"></polyline>',
    },
    suspended: {
        surface: 'bg-red-100/70 border-red-200',
        label: 'text-red-800',
        iconBox: 'bg-red-500/20 text-red-600',
        track: 'bg-red-500/25',
        fill: 'bg-red-500',
        glyph: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
    },
    pending: {
        surface: 'bg-amber-100/70 border-amber-200',
        label: 'text-amber-800',
        iconBox: 'bg-amber-500/20 text-amber-600',
        track: 'bg-amber-500/25',
        fill: 'bg-amber-500',
        glyph: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    },
};

const renderStatusBar = (label: string, count: number, percentage: number, kind: StatusBarKind) => {
    const tone = STATUS_BAR_TONE[kind];

    return `
    <div class="px-5 py-4 rounded-2xl border space-y-3 ${tone.surface}">
        <div class="flex justify-between items-center">
            <div class="flex flex-col">
                <span class="text-xs font-bold ${tone.label}">${label}</span>
                <span class="text-lg font-black text-gray-800 mt-1">${count}</span>
            </div>
            <div class="w-8 h-8 rounded-lg flex items-center justify-center ${tone.iconBox}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${tone.glyph}</svg>
            </div>
        </div>

        <div class="w-full h-1.5 rounded-full overflow-hidden ${tone.track}">
            <div class="h-full rounded-full ${tone.fill}" style="width: ${percentage}%"></div>
        </div>

        <p class="text-[10px] font-bold uppercase tracking-tighter ${tone.label}">
            ${percentage}% dari total user
        </p>
    </div>
`;
};

const renderChartCard = (title: string, sub: string, data: any, legendLabel: string = 'Total Pengguna') => {
    const chartData: number[] = data.data?.length ? data.data : [];
    const chartLabels: string[] = data.labels?.length ? data.labels : [];

    // An empty period says so. This used to fall back to a hardcoded seven-point
    // curve with February labels, so a SuperAdmin looking at a quiet week — or a
    // freshly installed system — saw a confident line describing activity that
    // never happened, on dates that were not in the selected period.
    if (chartData.length === 0) {
        return `
            <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div class="flex items-start gap-3 mb-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F766E" stroke-width="2" class="mt-0.5 shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    <div>
                        <h4 class="text-sm font-bold text-gray-800">${title}</h4>
                        <p class="text-[10px] text-gray-500 mt-0.5">${sub}</p>
                    </div>
                </div>
                <p class="py-12 text-center text-sm text-gray-400">Belum ada aktivitas pada periode ini.</p>
            </div>
        `;
    }

    const maxVal = Math.max(...chartData, 1);
    const svgWidth = 700;
    const svgHeight = 120;
    const padLeft = 50;
    const padRight = 10;
    const padTop = 10;
    const padBottom = 25;
    const chartW = svgWidth - padLeft - padRight;
    const chartH = svgHeight - padTop - padBottom;
    const stepX = chartData.length > 1 ? chartW / (chartData.length - 1) : 0;
    const yTicks = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];

    const points = chartData.map((d: number, i: number) => {
        const x = padLeft + i * stepX;
        const y = padTop + chartH - (d / maxVal) * chartH;
        return { x, y, d };
    });
    const linePath = points.map((p: any, i: number) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padTop + chartH} L ${padLeft} ${padTop + chartH} Z`;

    return `
    <div class="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <div class="px-6 py-4 border-b border-gray-50">
            <div class="flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <h4 class="text-sm font-bold text-gray-800">${title}</h4>
            </div>
            <p class="text-[10px] text-gray-400 mt-0.5 ml-6">${sub}</p>
        </div>
        <div class="p-6">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="w-full" style="height:140px">
                <!-- Y-axis grid lines and labels -->
                ${yTicks.map((v: number) => {
        const y = padTop + chartH - (v / maxVal) * chartH;
        return `<line x1="${padLeft}" y1="${y}" x2="${svgWidth - padRight}" y2="${y}" stroke="#F3F4F6" stroke-width="1"/>
                    <text x="${padLeft - 5}" y="${y + 4}" text-anchor="end" font-size="8" fill="#9CA3AF">${v}</text>`;
    }).join('')}
                <!-- Area fill -->
                <defs><linearGradient id="grad-${title.replace(/\s/g, '')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0D9488" stop-opacity="0.15"/><stop offset="100%" stop-color="#0D9488" stop-opacity="0"/></linearGradient></defs>
                <path d="${areaPath}" fill="url(#grad-${title.replace(/\s/g, '')})"/>
                <!-- Line -->
                <path d="${linePath}" fill="none" stroke="#0D9488" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                <!-- Points -->
                ${points.map((p: any) => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="white" stroke="#0D9488" stroke-width="2"/>`).join('')}
                <!-- X-axis labels -->
                ${chartLabels.map((l: string, i: number) => {
        const x = padLeft + i * stepX;
        return `<text x="${x}" y="${svgHeight - 5}" text-anchor="middle" font-size="8" fill="#9CA3AF">${l}</text>`;
    }).join('')}
            </svg>
            <div class="flex items-center gap-2 mt-2">
                <span class="w-6 h-0.5 bg-teal-500 inline-block"></span>
                <span class="text-[10px] font-medium text-gray-400">${legendLabel}</span>
            </div>
        </div>
    </div>
    `;
};

