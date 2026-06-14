import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import {
    isAktifLetter,
    isLegacyBeasiswaFallback,
    isMagangLetter,
    isProsesLuarNegeriLetter,
    isSuratTugasLetter,
} from '../shared/letter-workflow';
import { renderReviewScholarshipAkademik } from './ReviewScholarshipAkademik';
import { renderReviewProsesLuarNegeriAkademik } from './ReviewProsesLuarNegeriAkademik';
import { renderReviewSuratKeteranganAktifAkademik } from './ReviewSuratKeteranganAktifAkademik';
import { renderReviewSuratPengantarMagangAkademik } from './ReviewSuratPengantarMagangAkademik';
import { renderReviewSuratTugasAkademik } from './ReviewSuratTugasAkademik';
import {
    attachListControls,
    createListQueryState,
    renderListBody,
    renderListPagination,
    renderListToolbar,
    type ListPrimitiveConfig,
} from '../shared/list-primitives';
import {
    akademikListFilters,
    akademikListFilterValue,
    akademikListSearchText,
    renderAkademikHistoryRow,
    toAkademikListItems,
    type AkademikListItem,
} from '../shared/akademik-letter-list';

const LIST_ID_PREFIX = 'riwayat-akademik-list';
const LIST_ROWS_ID = `${LIST_ID_PREFIX}-rows`;

type AkademikReviewRenderer = (id: number, options: { origin: 'riwayat' }) => void;

const resolveAkademikReviewRenderer = (letterType: string): AkademikReviewRenderer | null => {
    if (isMagangLetter(letterType)) return renderReviewSuratPengantarMagangAkademik;
    if (isSuratTugasLetter(letterType)) return renderReviewSuratTugasAkademik;
    if (isAktifLetter(letterType)) return renderReviewSuratKeteranganAktifAkademik;
    if (isProsesLuarNegeriLetter(letterType)) return renderReviewProsesLuarNegeriAkademik;
    if (isLegacyBeasiswaFallback(letterType)) return renderReviewScholarshipAkademik;
    return null;
};

const hasDetail = (letterType: string): boolean => resolveAkademikReviewRenderer(letterType) !== null;

export const renderRiwayatAkademik = async (role: string): Promise<void> => {
    const queryState = createListQueryState({ pageSize: 10 });

    const shell = (rowsInner: string, items: readonly AkademikListItem[]): string => `
        <div class="mx-auto w-full max-w-[1200px] space-y-6 pb-12 text-sm">
            <section class="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div class="border-b border-gray-100 px-7 py-5 flex flex-col gap-4">
                    <div class="flex gap-3">
                        <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-500 text-blue-500 shadow-sm">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                        <div>
                            <h2 class="text-[17px] font-bold text-gray-800">Riwayat Persetujuan</h2>
                            <p class="mt-1 text-[11px] text-gray-500">Pengajuan dalam lingkup akademik Anda yang sudah melewati tahap tindakan.</p>
                        </div>
                    </div>
                    ${renderListToolbar(listConfig(items), queryState)}
                </div>
                <div id="${LIST_ROWS_ID}" class="overflow-x-auto">${rowsInner}</div>
            </section>
            ${renderListPagination(LIST_ID_PREFIX)}
        </div>
    `;

    renderDashboardLayout('Riwayat', shell(loadingState(), []), role, 'riwayat');

    let items: AkademikListItem[] = [];
    try {
        const response = await apiFetch('/api/akademik/riwayat');
        if (!response.ok) throw new Error('Failed to fetch academic history.');
        const data = await response.json() as { tasks?: unknown };
        items = toAkademikListItems(data.tasks);
    } catch (error) {
        console.error(error);
        renderDashboardLayout('Riwayat', errorState(), role, 'riwayat');
        return;
    }

    const config = listConfig(items);
    renderDashboardLayout('Riwayat', shell('', items), role, 'riwayat');

    const refresh = (): void => {
        renderListBody(items, queryState, config);
        bindLihatDetailButtons();
    };

    attachListControls(queryState, config, refresh);
    refresh();
};

const listConfig = (items: readonly AkademikListItem[]): ListPrimitiveConfig<AkademikListItem> => ({
    idPrefix: LIST_ID_PREFIX,
    searchPlaceholder: 'Cari nama, NIM, nomor surat, jenis surat',
    filters: akademikListFilters(items, 'history'),
    getSearchText: (item) => akademikListSearchText(item, 'history'),
    getFilterValue: akademikListFilterValue,
    renderItem: (item) => renderAkademikHistoryRow(item, hasDetail),
    renderItemsContainer: (rowsHtml) => `
        <table class="w-full min-w-[860px] text-left">
            <thead>
                <tr class="border-b border-gray-100 bg-gray-50/60">
                    <th class="px-7 py-4 text-xs font-bold text-gray-700">Tanggal Tindakan</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700">Nomor Surat</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700">Mahasiswa</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700">Jenis Surat</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700">Status</th>
                    <th class="px-7 py-4 text-right text-xs font-bold text-gray-700">Aksi</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `,
    emptyMessage: 'Belum ada riwayat akademik yang dapat ditampilkan.',
    resultCountLabel: (shown, total) => (total === 0 ? 'Tidak ada data' : `Menampilkan ${shown} dari ${total} data`),
});

const loadingState = (): string => `
    <div class="flex min-h-[360px] items-center justify-center">
        <div class="h-10 w-10 animate-spin rounded-full border-b-2 border-[#115E59]"></div>
    </div>
`;

const errorState = (): string => `
    <div class="rounded-xl border border-red-100 bg-red-50 p-6 text-sm font-medium text-red-600">
        Gagal mengambil data riwayat akademik.
    </div>
`;

const bindLihatDetailButtons = (): void => {
    const root = document.getElementById(LIST_ROWS_ID);
    if (!root) return;
    root.querySelectorAll<HTMLButtonElement>('[data-riwayat-lihat-detail]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.id);
            const letterType = button.dataset.letterType || '';
            if (!Number.isFinite(id) || id <= 0) return;
            resolveAkademikReviewRenderer(letterType)?.(id, { origin: 'riwayat' });
        });
    });
};
