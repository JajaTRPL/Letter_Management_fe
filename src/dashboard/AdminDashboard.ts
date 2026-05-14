import { renderDashboardLayout } from './DashboardLayout';
import { apiFetch } from '../shared/api-client';

let refreshInterval: any = null;
let activePeriod: string = 'week';

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
                        <span class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold font-['Inter'] mt-2" style="background:#F59E0B;color:#fff">
                            Super Admin
                        </span>
                    </div>

                    <!-- User Count Cards -->
                    <div>
                        <h3 class="text-base font-semibold text-gray-800 mb-1 font-['Inter']">Total Pengguna Aktif</h3>
                        <p class="text-xs text-gray-500 mb-4 font-['Inter']">Jumlah pengguna aktif berdasarkan peran dalam sistem.</p>
                        <div class="grid grid-cols-2 gap-4">
                            ${renderCountCard('Mahasiswa', stats.user_counts?.mahasiswa || 0, '#DCEFFF', '/mahasiswa-logo.png')}
                            ${renderCountCard('Tenaga Pendidik', stats.user_counts?.tendik || 0, '#ECFDF5', '/tendik-logo.png')}
                            ${renderCountCard('Akademik', stats.user_counts?.akademik || 0, '#E4DCFF', '/akademik-logo.png')}
                            ${renderCountCard('Super Admin', stats.user_counts?.super_admin || 0, '#F5F5F5', '/admin-logo.png')}
                        </div>
                    </div>

                    <!-- Account Status Section -->
                    <div>
                        <h3 class="text-base font-bold text-gray-800 mb-1">Status Akun Pengguna</h3>
                        <p class="text-xs text-gray-500 mb-4">Distribusi status akun pengguna pada sistem.</p>
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div class="space-y-3">
                                ${renderStatusBar('Aktif', activeCount, activePct, '#10B981', '#D1FAE5', '#065F46')}
                                ${renderStatusBar('Suspended', suspendedCount, suspendedPct, '#EF4444', '#FEE2E2', '#991B1B')}
                                ${renderStatusBar('Menunggu Profil', pendingCount, pendingPct, '#F59E0B', '#FEF3C7', '#92400E')}
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
                                    <span class="flex items-center gap-1"><img src="/suspended-logo.png" class="w-3 h-3 object-contain" /> Suspended</span>
                                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Menunggu Profil</span>
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
                            <button class="activity-tab py-1.5 px-5 text-sm font-bold text-white rounded-lg transition-all active-tab" data-period="week" style="background:#006666">Minggu Ini</button>
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

                        <!-- Approval Durations -->
                        <div class="rounded-2xl overflow-hidden border border-yellow-200" style="background:#FFFBEB">
                            <div class="px-6 py-4 flex items-start gap-3 border-b border-yellow-200">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" class="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                <div>
                                    <h4 class="text-sm font-bold text-gray-800">Rata-Rata Durasi Persetujuan Surat</h4>
                                    <p class="text-[10px] text-gray-500 mt-0.5">Rata-rata waktu yang dibutuhkan untuk memproses persetujuan surat</p>
                                </div>
                            </div>
                            <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${renderDurationBox('Tenaga Pendidik', stats.approval_durations?.tendik || { days: 0, hours: 0, minutes: 0 })}
                                ${renderDurationBox('Akademik', stats.approval_durations?.akademik || { days: 0, hours: 0, minutes: 0 })}
                            </div>
                            <div class="px-6 py-3 border-t border-yellow-200 flex items-center gap-2">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                <p class="text-[10px] text-amber-700 italic">Durasi dihitung sejak pengajuan masuk hingga proses persetujuan selesai. Semakin rendah durasi, semakin efisien proses persetujuan.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const container = document.getElementById('admin-dashboard-wrapper');
            if (container) {
                container.innerHTML = content;

                // Tab switching logic
                const tabBar = document.getElementById('activity-tab-bar');

                const setActiveTab = (period: string) => {
                    tabBar?.querySelectorAll('.activity-tab').forEach(b => {
                        b.classList.remove('active-tab', 'font-bold', 'text-white');
                        b.classList.add('font-medium', 'text-gray-500');
                        (b as HTMLElement).style.background = '';
                        (b as HTMLElement).style.borderRadius = '';
                    });
                    const activeBtn = tabBar?.querySelector(`.activity-tab[data-period="${period}"]`) as HTMLElement | null;
                    if (activeBtn) {
                        activeBtn.classList.add('active-tab', 'font-bold', 'text-white');
                        activeBtn.classList.remove('font-medium', 'text-gray-500');
                        activeBtn.style.background = '#006666';
                        activeBtn.style.borderRadius = '8px';
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

const renderCountCard = (title: string, count: number, bgColor: string, iconUrl: string) => `
    <div class="p-5 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow" style="background:${bgColor}">
        <div>
            <p class="text-[11px] font-bold text-gray-800 mb-2 font-['Inter']">${title}</p>
            <p class="text-3xl font-black text-gray-800 font-['Inter']">${count}</p>
            <p class="text-[10px] text-gray-600 font-medium mt-1 font-['Inter']">Total Pengguna</p>
        </div>
        <div class="w-14 h-14 rounded-xl flex items-center justify-center" style="background:${bgColor}">
            <img src="${iconUrl}" class="w-14 h-14 object-contain" />
        </div>
    </div>
`;

const renderStatusBar = (label: string, count: number, percentage: number, barColor: string, bgColor: string, textColor: string) => `
    <div class="px-5 py-4 rounded-2xl border space-y-3"
         style="background:${bgColor}; border-color:${barColor}33">

        <!-- ATAS -->
        <div class="flex justify-between items-center">
            
            <!-- KIRI -->
            <div class="flex flex-col">
                <span class="text-xs font-bold" style="color:${textColor}">
                    ${label}
                </span>
                <span class="text-lg font-black text-gray-800 mt-1">
                    ${count}
                </span>
            </div>

            <!-- KANAN (ICON sejajar dengan COUNT) -->
            <div class="w-8 h-8 rounded-lg flex items-center justify-center"
                 style="background:${barColor}20">
                ${label === 'Aktif'
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${barColor}" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        : label === 'Menunggu Profil'
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${barColor}" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${barColor}" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    }
            </div>

        </div>

        <!-- PROGRESS -->
        <div class="w-full h-1.5 rounded-full overflow-hidden" style="background:${barColor}25">
            <div class="h-full rounded-full" style="width: ${percentage}%; background:${barColor}"></div>
        </div>

        <!-- TEXT -->
        <p class="text-[10px] font-bold uppercase tracking-tighter" style="color:${textColor}">
            ${percentage}% dari total user
        </p>
    </div>
`;

const renderChartCard = (title: string, sub: string, data: any, legendLabel: string = 'Total Pengguna') => {
    const chartData = data.data?.length ? data.data : [30, 45, 28, 50, 42, 38, 48];
    const chartLabels = data.labels?.length ? data.labels : ['18 Feb', '19 Feb', '20 Feb', '21 Feb', '22 Feb', '23 Feb', '24 Feb'];
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

const renderDurationBox = (label: string, dur: any) => `
    <div class="bg-white border border-amber-200 rounded-xl p-4 flex items-center justify-between">
        <span class="text-sm font-bold text-gray-700">${label}</span>
        <div class="flex items-baseline gap-1">
            <span class="text-2xl font-black text-gray-900 leading-none">${String(dur.days).padStart(2, '0')}</span>
            <span class="text-[9px] font-bold text-gray-400">Hari</span>
            <span class="text-2xl font-black text-gray-900 leading-none ml-1">${String(dur.hours).padStart(2, '0')}</span>
            <span class="text-[9px] font-bold text-gray-400">Jam</span>
            <span class="text-2xl font-black text-gray-900 leading-none ml-1">${String(dur.minutes).padStart(2, '0')}</span>
            <span class="text-[9px] font-bold text-gray-400">Menit</span>
        </div>
    </div>
`;
