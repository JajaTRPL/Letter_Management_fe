import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';

const PERIODS = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: '1month', label: '1 Bulan' },
    { key: '3months', label: '3 Bulan' },
    { key: '6months', label: '6 Bulan' },
    { key: '12months', label: '12 Bulan' },
];

let activePeriod = 'today';

const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; bg: string; text: string; border: string }> = {
        'Submitted': { label: 'Menunggu Verifikasi', bg: '#FEF9C3', text: '#A16207', border: '#FDE047' },
        'Approved_Tendik': { label: 'Menunggu Persetujuan', bg: '#E0F2FE', text: '#0369A1', border: '#7DD3FC' },
        'Approved_Kaprodi': { label: 'Menunggu Tanda Tangan', bg: '#EDE9FE', text: '#6D28D9', border: '#C4B5FD' },
        'Revision': { label: 'Perlu Revisi', bg: '#FFEDD5', text: '#C2410C', border: '#FDBA74' },
    };
    const cfg = map[status] || { label: status, bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
    return `<span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold" style="background:${cfg.bg}; color:${cfg.text}; border: 1px solid ${cfg.border}">${cfg.label}</span>`;
};

async function fetchMonitoringData(period: string) {
    const response = await apiFetch(`/api/super-admin/dashboard/monitoring?period=${period}`);
    if (!response.ok) throw new Error('Failed to fetch monitoring data');
    return response.json();
}

function buildContent(stats: any, overdue: any[]) {
    const periodTabs = PERIODS.map(p => {
        const isActive = p.key === activePeriod;
        return `<button data-period="${p.key}" class="period-btn px-6 py-2 text-sm font-semibold transition-colors rounded-xl ${isActive ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}" ${isActive ? 'style="background-color: #0d4a46"' : ''}>${p.label}</button>`;
    }).join('');

    const overdueRows = overdue.length > 0
        ? overdue.map((item: any) => `
            <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="px-6 py-4">
                    <p class="text-xs font-semibold text-gray-500 mb-0.5">${item.submitted_at}</p>
                    <p class="text-[10px] font-bold text-red-500 flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        ${item.days_overdue} hari tertunda
                    </p>
                </td>
                <td class="px-4 py-4">
                    <p class="text-sm font-semibold text-gray-700 mb-0.5">${item.student_name}</p>
                    <p class="text-[11px] text-gray-400">${item.nim}</p>
                </td>
                <td class="px-4 py-4 whitespace-nowrap">
                    ${getStatusBadge(item.status)}
                </td>
                <td class="px-4 py-4">
                    <p class="text-xs font-medium text-gray-600">${item.assigned_to_name}</p>
                </td>
                <td class="px-6 py-4 text-right">
                    <span class="text-xs font-semibold text-gray-400">${item.type}</span>
                </td>
            </tr>
        `).join('')
        : `<tr><td colspan="5" class="px-6 py-16 text-center">
            <div class="flex flex-col items-center gap-2 opacity-40">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <p class="text-sm font-bold text-gray-500">Tidak ada surat yang melebihi batas proses</p>
            </div>
        </td></tr>`;

    return `
        <div class="space-y-6 animate-fade-in pb-12 w-full max-w-6xl mx-auto">
            <p class="text-gray-500 text-sm mb-6 -mt-2">Memantau status dan progres pengajuan surat dalam sistem</p>

            <!-- Time Period Tabs -->
            <div class="flex items-center gap-1 border-b border-gray-200 pb-4">
                ${periodTabs}
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                <!-- Surat Masuk -->
                <div class="bg-[#EFF6FF] border border-blue-100 p-6 rounded-2xl flex justify-between items-start hover:shadow-sm transition-all">
                    <div class="flex-1">
                        <p class="text-sm font-bold text-gray-700 mb-1">Surat Masuk</p>
                        <h3 class="text-[40px] font-black text-gray-800 mb-3 leading-none">${stats.surat_masuk}</h3>
                        <p class="text-[11px] text-gray-500 max-w-[200px] leading-snug">Jumlah pengajuan surat yang masuk pada periode yang dipilih</p>
                    </div>
                    <div class="w-[72px] h-[72px] bg-blue-300/40 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner mt-1">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
                    </div>
                </div>

                <!-- Menunggu Persetujuan -->
                <div class="bg-[#FEF9C3]/40 border border-yellow-200/50 p-6 rounded-2xl flex justify-between items-start hover:shadow-sm transition-all">
                    <div class="flex-1">
                        <p class="text-sm font-bold text-gray-700 mb-1">Menunggu Persetujuan</p>
                        <h3 class="text-[40px] font-black text-gray-800 mb-3 leading-none">${stats.menunggu_persetujuan}</h3>
                        <p class="text-[11px] text-gray-500 max-w-[220px] leading-snug">Surat yang sedang menunggu verifikasi atau persetujuan</p>
                    </div>
                    <div class="w-[72px] h-[72px] bg-yellow-300/50 rounded-2xl flex items-center justify-center text-yellow-600 shadow-inner mt-1">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                </div>

                <!-- Perlu Revisi -->
                <div class="bg-[#FFEDD5]/40 border border-orange-200/50 p-6 rounded-2xl flex justify-between items-start hover:shadow-sm transition-all">
                    <div class="flex-1">
                        <p class="text-sm font-bold text-gray-700 mb-1">Perlu Revisi</p>
                        <h3 class="text-[40px] font-black text-gray-800 mb-3 leading-none">${stats.perlu_revisi}</h3>
                        <p class="text-[11px] text-gray-500 max-w-[200px] leading-snug">Surat yang dikembalikan kepada mahasiswa untuk diperbaiki</p>
                    </div>
                    <div class="w-[72px] h-[72px] bg-orange-200/60 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner mt-1">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                </div>

                <!-- Surat Selesai -->
                <div class="bg-[#ECFDF5]/50 border border-green-200/50 p-6 rounded-2xl flex justify-between items-start hover:shadow-sm transition-all">
                    <div class="flex-1">
                        <p class="text-sm font-bold text-gray-700 mb-1">Surat Selesai</p>
                        <h3 class="text-[40px] font-black text-gray-800 mb-3 leading-none">${stats.selesai}</h3>
                        <p class="text-[11px] text-gray-500 max-w-[240px] leading-snug">Surat yang telah selesai diproses pada periode yang dipilih</p>
                    </div>
                    <div class="w-[72px] h-[72px] bg-emerald-200/60 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner mt-1">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                </div>
            </div>

            <!-- Overdue List -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm mt-10 overflow-hidden">
                <div class="px-6 py-5 border-b border-gray-100 flex gap-3">
                    <div class="w-6 h-6 rounded-full border border-red-500 text-red-500 flex flex-col items-center justify-center shrink-0 mt-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="6" x2="12" y2="14"></line><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                    </div>
                    <div>
                        <h2 class="text-base font-bold text-gray-800">Daftar Surat Melebihi Batas Proses</h2>
                        <p class="text-[11px] text-gray-500 mt-1">Pengajuan surat yang belum diproses lebih dari 3 hari</p>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left bg-white">
                        <thead>
                            <tr class="border-b border-gray-100 bg-white">
                                <th class="px-6 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Tanggal Masuk</th>
                                <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Mahasiswa</th>
                                <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Status</th>
                                <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Penanggung Jawab</th>
                                <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap text-right">Jenis</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${overdueRows}
                        </tbody>
                    </table>
                </div>

                <div class="px-6 py-5 flex items-center justify-between border-t border-gray-100">
                    <p class="text-xs font-medium text-gray-600">Menampilkan <span class="font-bold">${overdue.length}</span> surat tertunda</p>
                </div>
            </div>
        </div>
    `;
}

export const renderLetterMonitoring = async () => {
    // Show loading
    renderDashboardLayout('Monitoring Surat', `
        <div class="flex items-center justify-center min-h-[400px]">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D4A46]"></div>
        </div>
    `, 'super_admin', 'monitoring');

    try {
        const data = await fetchMonitoringData(activePeriod);
        const content = buildContent(data.stats, data.overdue || []);
        renderDashboardLayout('Monitoring Surat', content, 'super_admin', 'monitoring');

        // Attach period tab listeners
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                activePeriod = (btn as HTMLElement).dataset.period || 'today';
                await renderLetterMonitoring();
            });
        });

    } catch (error) {
        console.error('Monitoring error:', error);
        renderDashboardLayout('Monitoring Surat', `
            <div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">
                Gagal mengambil data monitoring. Pastikan server backend berjalan.
            </div>
        `, 'super_admin', 'monitoring');
    }
};
