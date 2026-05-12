import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { listAcademicPeriods } from './academic-periods/api';
import { renderAcademicPeriodTable } from './academic-periods/ui-utils';
import { setupAcademicPeriodListeners } from './academic-periods/listeners';
import type { AcademicPeriod } from './academic-periods/types';
import { showError } from '../shared/toast';

let allPeriods: AcademicPeriod[] = [];

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
