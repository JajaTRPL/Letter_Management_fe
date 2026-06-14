import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import {
    isMagangLetter,
    isAktifLetter,
    isProsesLuarNegeriLetter,
    isSuratTugasLetter,
    isLegacyBeasiswaFallback,
} from '../shared/letter-workflow';
import { renderScholarshipDetail } from './ScholarshipForm';
import { renderSuratPengantarMagangDetail } from './SuratPengantarMagangForm';
import { renderSuratKeteranganAktifDetail } from './SuratKeteranganAktifForm';
import { renderProsesLuarNegeriDetail } from './ProsesLuarNegeriForm';
import { renderSuratTugasDetail } from './SuratTugasForm';
import {
    attachListControls,
    createListQueryState,
    renderListBody,
    renderListError,
    renderListLoading,
    renderListPagination,
    renderListToolbar,
    type ListPrimitiveConfig,
} from '../shared/list-primitives';
import {
    loadMahasiswaApplications,
    mahasiswaListFilters,
    mahasiswaListFilterValue,
    mahasiswaListSearchText,
    renderMahasiswaListRow,
    type MahasiswaListItem,
} from '../shared/mahasiswa-application-list';

const LIST_ID_PREFIX = 'riwayat-list';
const LIST_ROWS_ID = `${LIST_ID_PREFIX}-rows`;

// Type-based detail dispatch. Kept in the page (not the adapter) so the static
// import graph and code-splitting are preserved — the adapter holds data only.
const openDetailForApplication = (id: string, type?: string): void => {
    if (!id) return;
    if (isMagangLetter(type)) {
        renderSuratPengantarMagangDetail(id, { origin: 'riwayat' });
    } else if (isAktifLetter(type)) {
        renderSuratKeteranganAktifDetail(id, { origin: 'riwayat' });
    } else if (isProsesLuarNegeriLetter(type)) {
        renderProsesLuarNegeriDetail(id, { origin: 'riwayat' });
    } else if (isSuratTugasLetter(type)) {
        renderSuratTugasDetail(id, { origin: 'riwayat' });
    } else if (isLegacyBeasiswaFallback(type)) {
        renderScholarshipDetail(id, { origin: 'riwayat' });
    }
};

const listConfig: ListPrimitiveConfig<MahasiswaListItem> = {
    idPrefix: LIST_ID_PREFIX,
    searchPlaceholder: 'Cari berdasarkan nama surat atau status...',
    filters: mahasiswaListFilters,
    getSearchText: mahasiswaListSearchText,
    getFilterValue: mahasiswaListFilterValue,
    renderItem: renderMahasiswaListRow,
    renderItemsContainer: (rowsHtml) => `
        <table class="w-full text-left font-['Inter']">
            <thead>
                <tr class="bg-white border-b border-gray-50">
                    <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Tanggal Unggah</th>
                    <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Nama Dokumen</th>
                    <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Status</th>
                    <th class="px-8 py-5 text-[13px] font-bold text-gray-700 text-right">Aksi</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">${rowsHtml}</tbody>
        </table>
    `,
    emptyMessage: 'Belum ada riwayat pengajuan surat.',
};

export const renderRiwayatPengajuan = async (): Promise<void> => {
    const queryState = createListQueryState({ pageSize: 10 });

    // Initial shell with a loading state inside the rows container.
    const shell = (rowsInner: string): string => `
        <div class="space-y-6">
            ${renderListToolbar(listConfig, queryState)}
            <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                <div id="${LIST_ROWS_ID}" class="overflow-x-auto">${rowsInner}</div>
            </div>
            ${renderListPagination(LIST_ID_PREFIX)}
        </div>
    `;

    renderDashboardLayout('Riwayat Pengajuan', shell(renderListLoading('Memuat riwayat pengajuan...')), 'mahasiswa', 'history');

    let items: MahasiswaListItem[] = [];
    let failedEndpointCount = 0;
    try {
        const loaded = await loadMahasiswaApplications((url) => apiFetch(url, { cache: 'no-store' }));
        items = loaded.items;
        failedEndpointCount = loaded.failedEndpointCount;
    } catch (e) {
        console.error('Failed to fetch applications', e);
        renderDashboardLayout('Riwayat Pengajuan', shell(renderListError()), 'mahasiswa', 'history');
        return;
    }

    if (failedEndpointCount > 0 && items.length === 0) {
        renderDashboardLayout('Riwayat Pengajuan', shell(renderListError('Sebagian data gagal dimuat. Silakan coba lagi.')), 'mahasiswa', 'history');
        return;
    }

    // Re-render the body and (re)bind row-level detail dispatch after every
    // toolbar/pagination change.
    const refresh = (): void => {
        renderListBody(items, queryState, listConfig);
        bindRowActions();
    };

    const bindRowActions = (): void => {
        const root = document.getElementById(LIST_ROWS_ID);
        if (!root) return;

        root.querySelectorAll('[data-action="view-detail"]').forEach((button) => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const el = e.currentTarget as HTMLElement;
                if (el.dataset.id) openDetailForApplication(el.dataset.id, el.dataset.type);
            });
        });

        root.querySelectorAll('tr[data-row-action="view-detail"]').forEach((row) => {
            row.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('button, a')) return;
                const el = e.currentTarget as HTMLElement;
                if (el.dataset.id) openDetailForApplication(el.dataset.id, el.dataset.type);
            });
        });
    };

    attachListControls(queryState, listConfig, refresh);
    refresh();
};
