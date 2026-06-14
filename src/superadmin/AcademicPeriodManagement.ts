import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { listAcademicPeriods } from './academic-periods/api';
import { renderAcademicPeriodTable } from './academic-periods/ui-utils';
import { setupAcademicPeriodListeners } from './academic-periods/listeners';
import type { AcademicPeriod } from './academic-periods/types';
import { summarizeAcademicPeriods } from './academic-periods/state';
import { showError } from '../shared/toast';

let allPeriods: AcademicPeriod[] = [];

/**
 * Top banners that surface manual-operation pitfalls of the hybrid backend
 * resolver (is_active=true AND today within start/end date). These are
 * read-only awareness signals — no auto-fix actions.
 */
const renderTopBanners = (periods: AcademicPeriod[]): string => {
    if (periods.length === 0) return '';
    const summary = summarizeAcademicPeriods(periods);
    const banners: string[] = [];

    if (summary.hasNoCurrentToday) {
        banners.push(`
            <div role="alert" class="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                <svg class="shrink-0 mt-0.5 text-amber-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <div>
                    <p class="text-sm font-semibold text-amber-800">Tidak ada periode akademik berjalan hari ini</p>
                    <p class="text-xs text-amber-700 mt-1 leading-relaxed">Pengajuan surat yang membutuhkan periode akademik (misal Surat Keterangan Aktif) dapat menampilkan nilai kosong. Pastikan ada satu periode dicentang <strong>Aktif</strong> dengan tanggal yang mencakup hari ini.</p>
                </div>
            </div>
        `);
    }

    if (summary.hasMultipleActive) {
        banners.push(`
            <div role="alert" class="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
                <svg class="shrink-0 mt-0.5 text-rose-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <div>
                    <p class="text-sm font-semibold text-rose-800">Lebih dari satu periode berstatus Aktif terdeteksi</p>
                    <p class="text-xs text-rose-700 mt-1 leading-relaxed">Sistem akan memakai periode yang memenuhi tanggal hari ini; jika lebih dari satu cocok, hasilnya dapat membingungkan. Mohon periksa kembali daftar di bawah.</p>
                </div>
            </div>
        `);
    }

    return banners.join('');
};

export const renderAcademicPeriodManagement = async (): Promise<void> => {
    renderDashboardLayout(
        'Periode Akademik',
        '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div></div>',
        'super_admin',
        'academic-periods'
    );

    try {
        const result = await listAcademicPeriods();
        allPeriods = result.data ?? [];
    } catch (err) {
        console.error(err);
        showError('Gagal memuat data periode akademik');
        allPeriods = [];
    }

    renderContent(allPeriods);
};

function renderContent(periods: AcademicPeriod[]): void {
    const content = `
        <div class="space-y-5 animate-fade-in pb-12">
            ${renderTopBanners(periods)}
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
                <div class="px-6 py-5 border-b border-gray-100">
                    <div class="flex items-center gap-3 mb-1">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <h2 class="text-base font-bold text-gray-800">Daftar Periode Akademik</h2>
                    </div>
                    <p class="text-xs text-gray-400 ml-7">Kelola periode akademik aktif. Semester mahasiswa dihitung otomatis dari angkatan/NIM dan periode akademik aktif.</p>
                </div>

                <div class="px-6 py-4 flex flex-wrap gap-3 items-center justify-between border-b border-gray-50">
                    <div class="relative flex-1 min-w-[200px] max-w-sm">
                        <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <input type="text" id="ap-search" placeholder="Cari tahun akademik..." class="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                    </div>
                    <div class="flex items-center gap-3">
                        <select id="ap-type-filter" class="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer bg-white text-gray-600">
                            <option value="">Semua Semester</option>
                            <option value="ganjil">Ganjil</option>
                            <option value="genap">Genap</option>
                        </select>
                        <select id="ap-active-filter" class="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer bg-white text-gray-600">
                            <option value="">Semua Status</option>
                            <option value="true">Aktif</option>
                            <option value="false">Nonaktif</option>
                        </select>
                        <button id="ap-add-btn" class="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Tambah
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b border-gray-100">
                                <th class="px-4 py-3 text-xs font-semibold text-gray-500">Tahun Akademik</th>
                                <th class="px-4 py-3 text-xs font-semibold text-gray-500">Semester</th>
                                <th class="px-4 py-3 text-xs font-semibold text-gray-500">Periode</th>
                                <th class="px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 sticky right-0 bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.03)] z-10">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="ap-table-body" class="divide-y divide-gray-50">
                            ${renderAcademicPeriodTable(periods)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div id="modal-container"></div>
    `;

    renderDashboardLayout('Periode Akademik', content, 'super_admin', 'academic-periods');

    const onRefresh = async (): Promise<void> => {
        try {
            const result = await listAcademicPeriods();
            allPeriods = result.data ?? [];
        } catch (err) {
            console.error(err);
            showError('Gagal memuat data terbaru');
        }
        renderContent(allPeriods);
    };

    setupAcademicPeriodListeners(periods, onRefresh);
}
