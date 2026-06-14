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
    renderAkademikActionableRow,
    toAkademikListItems,
    type AkademikListItem,
} from '../shared/akademik-letter-list';

const LIST_ID_PREFIX = 'dokumen-akademik-list';
const LIST_ROWS_ID = `${LIST_ID_PREFIX}-rows`;

// Reviewer dispatch stays in the page and uses the explicit *Akademik renderers
// — Beasiswa goes to renderReviewScholarshipAkademik (never the Tendik one).
const openReview = (id: number, letterType: string | null | undefined): void => {
    if (!id) return;
    if (isMagangLetter(letterType)) { void renderReviewSuratPengantarMagangAkademik(id); return; }
    if (isAktifLetter(letterType)) { void renderReviewSuratKeteranganAktifAkademik(id); return; }
    if (isProsesLuarNegeriLetter(letterType)) { void renderReviewProsesLuarNegeriAkademik(id); return; }
    if (isSuratTugasLetter(letterType)) { void renderReviewSuratTugasAkademik(id); return; }
    if (isLegacyBeasiswaFallback(letterType)) { void renderReviewScholarshipAkademik(id); }
};

export const renderDokumenAkademik = async (role: string): Promise<void> => {
    const queryState = createListQueryState({ pageSize: 10 });

    const shell = (rowsInner: string, items: readonly AkademikListItem[]): string => `
        <div class="mx-auto w-full max-w-[1200px] space-y-6 pb-12 text-sm">
            <section class="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div class="border-b border-gray-100 px-7 py-5 flex flex-col gap-4">
                    <div class="flex gap-3">
                        <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-500 text-red-500 shadow-sm">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="6" x2="12" y2="14"></line><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                        </div>
                        <div>
                            <h2 class="text-[17px] font-bold text-gray-800">Antrean Perlu Tindakan</h2>
                            <p class="mt-1 text-[11px] text-gray-500">Daftar pengajuan dalam tahap dan lingkup akademik Anda yang menunggu tindakan.</p>
                        </div>
                    </div>
                    ${renderListToolbar(listConfig(items), queryState)}
                </div>
                <div id="${LIST_ROWS_ID}" class="overflow-x-auto">${rowsInner}</div>
            </section>
            ${renderListPagination(LIST_ID_PREFIX)}
        </div>
    `;

    renderDashboardLayout('Dokumen', shell(loadingState(), []), role, 'dokumen');

    let items: AkademikListItem[] = [];
    try {
        const response = await apiFetch('/api/akademik/dashboard/tasks');
        if (!response.ok) throw new Error('Failed to fetch academic documents.');
        const data = await response.json() as { tasks?: unknown };
        items = toAkademikListItems(data.tasks);
    } catch (error) {
        console.error(error);
        renderDashboardLayout('Dokumen', errorState(), role, 'dokumen');
        return;
    }

    const config = listConfig(items);
    renderDashboardLayout('Dokumen', shell('', items), role, 'dokumen');

    const refresh = (): void => {
        renderListBody(items, queryState, config);
        bindReviewButtons();
    };

    attachListControls(queryState, config, refresh);
    refresh();
};

const listConfig = (items: readonly AkademikListItem[]): ListPrimitiveConfig<AkademikListItem> => ({
    idPrefix: LIST_ID_PREFIX,
    searchPlaceholder: 'Cari nama, NIM, atau jenis surat',
    filters: akademikListFilters(items, 'actionable'),
    getSearchText: (item) => akademikListSearchText(item, 'actionable'),
    getFilterValue: akademikListFilterValue,
    renderItem: renderAkademikActionableRow,
    renderItemsContainer: (rowsHtml) => `
        <table class="w-full min-w-[760px] text-left">
            <thead>
                <tr class="border-b border-gray-100 bg-gray-50/60">
                    <th class="px-7 py-4 text-xs font-bold text-gray-700">Tanggal Masuk</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700">Mahasiswa</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700">Jenis Surat</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700">Status</th>
                    <th class="px-7 py-4 text-right text-xs font-bold text-gray-700">Action</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `,
    emptyMessage: 'Belum ada dokumen yang memerlukan tindakan Anda saat ini.',
    resultCountLabel: (shown, total) => (total === 0 ? 'Tidak ada data' : `Menampilkan ${shown} dari ${total} data`),
});

const loadingState = (): string => `
    <div class="flex min-h-[360px] items-center justify-center">
        <div class="h-10 w-10 animate-spin rounded-full border-b-2 border-[#115E59]"></div>
    </div>
`;

const errorState = (): string => `
    <div class="rounded-xl border border-red-100 bg-red-50 p-6 text-sm font-medium text-red-600">
        Gagal mengambil data dokumen akademik.
    </div>
`;

const bindReviewButtons = (): void => {
    const root = document.getElementById(LIST_ROWS_ID);
    if (!root) return;
    root.querySelectorAll<HTMLButtonElement>('.akademik-review-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.id || 0);
            openReview(id, button.dataset.letterType || '');
        });
    });
};
