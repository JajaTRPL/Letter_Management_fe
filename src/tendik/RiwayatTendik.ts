import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import {
    isAktifLetter,
    isLegacyBeasiswaFallback,
    isMagangLetter,
    isProsesLuarNegeriLetter,
    isSuratTugasLetter,
} from '../shared/letter-workflow';
import { apiFetch } from '../shared/api-client';
import { renderReviewScholarship } from './ReviewScholarship';
import { renderReviewSuratPengantarMagang } from './ReviewSuratPengantarMagang';
import { renderReviewSuratKeteranganAktif } from './ReviewSuratKeteranganAktif';
import { renderReviewProsesLuarNegeri } from './ReviewProsesLuarNegeri';
import { renderReviewSuratTugas } from './ReviewSuratTugas';
import {
    attachListControls,
    createListQueryState,
    renderListBody,
    renderListPagination,
    renderListToolbar,
    type ListPrimitiveConfig,
} from '../shared/list-primitives';
import {
    renderTendikHistoryRow,
    tendikListFilters,
    tendikListFilterValue,
    tendikListSearchText,
    toTendikListItems,
    type TendikListItem,
} from '../shared/tendik-letter-list';

type RiwayatScope = 'mine' | 'team';

const RIWAYAT_SCOPES: Record<RiwayatScope, { label: string; emptyText: string }> = {
    mine: { label: 'Riwayat Saya', emptyText: 'Belum ada riwayat pengajuan yang Anda tangani.' },
    team: { label: 'Riwayat Tim', emptyText: 'Belum ada riwayat pengajuan dalam tim Anda.' },
};

const LIST_ID_PREFIX = 'riwayat-tendik-list';
const LIST_ROWS_ID = `${LIST_ID_PREFIX}-rows`;

type TendikReviewRenderer = (id: number, options: { origin: 'riwayat' }) => void;

const resolveTendikReviewRenderer = (letterType: string): TendikReviewRenderer | null => {
    if (isMagangLetter(letterType)) return renderReviewSuratPengantarMagang;
    if (isAktifLetter(letterType)) return renderReviewSuratKeteranganAktif;
    if (isProsesLuarNegeriLetter(letterType)) return renderReviewProsesLuarNegeri;
    if (isSuratTugasLetter(letterType)) return renderReviewSuratTugas;
    if (isLegacyBeasiswaFallback(letterType)) return renderReviewScholarship;
    return null;
};

const hasDetail = (letterType: string): boolean => resolveTendikReviewRenderer(letterType) !== null;

export const renderRiwayatTendik = async (role: string): Promise<void> => {
    await loadRiwayatScope(role, 'mine');
};

const loadRiwayatScope = async (role: string, scope: RiwayatScope): Promise<void> => {
    const shell = (rowsInner: string, items: readonly TendikListItem[], state = createListQueryState({ pageSize: 10 })): string => `
        <div class="w-full max-w-6xl mx-auto pb-12 animate-fade-in space-y-6">
            <p class="text-gray-600 text-sm mb-4">Daftar pengajuan surat yang telah diproses</p>
            ${renderTabs(scope)}
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div class="px-7 py-5 border-b border-gray-50 bg-[#F8FAFC]/50">
                    ${renderListToolbar(listConfig(scope, items), state)}
                </div>
                <div id="${LIST_ROWS_ID}" class="overflow-x-auto">${rowsInner}</div>
            </div>
            ${renderListPagination(LIST_ID_PREFIX)}
        </div>
    `;

    renderDashboardLayout('Riwayat', shell(renderLoading(), []), role, 'riwayat');

    let items: TendikListItem[] = [];
    try {
        const response = await apiFetch(`/api/tendik/riwayat?scope=${scope}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch history');
        items = toTendikListItems(data.tasks);
    } catch (error) {
        console.error(error);
        renderDashboardLayout(
            'Riwayat',
            '<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">Gagal mengambil data riwayat.</div>',
            role,
            'riwayat',
        );
        return;
    }

    const queryState = createListQueryState({ pageSize: 10 });
    const config = listConfig(scope, items);

    renderDashboardLayout('Riwayat', shell('', items, queryState), role, 'riwayat');

    const refresh = (): void => {
        renderListBody(items, queryState, config);
        bindLihatDetailButtons();
    };

    bindTabs(role, scope);
    attachListControls(queryState, config, refresh);
    refresh();
};

const listConfig = (scope: RiwayatScope, items: readonly TendikListItem[]): ListPrimitiveConfig<TendikListItem> => ({
    idPrefix: LIST_ID_PREFIX,
    searchPlaceholder: 'Cari berdasarkan Nama atau NIM',
    filters: tendikListFilters(items, 'history'),
    getSearchText: (item) => tendikListSearchText(item, 'history'),
    getFilterValue: tendikListFilterValue,
    renderItem: (item) => renderTendikHistoryRow(item, hasDetail),
    renderItemsContainer: (rowsHtml) => `
        <table class="w-full text-left bg-white">
            <thead>
                <tr class="border-b border-gray-100 bg-white">
                    <th class="px-7 py-4 text-xs font-bold text-gray-700 whitespace-nowrap w-[170px]">Tanggal Masuk</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Mahasiswa</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Jenis Surat</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Status</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Aktor</th>
                    <th class="px-7 py-4 w-32"></th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `,
    emptyMessage: RIWAYAT_SCOPES[scope].emptyText,
    resultCountLabel: (shown, total) => `Menampilkan ${shown} dari ${total} data`,
});

const renderTabs = (activeScope: RiwayatScope): string => `
    <div class="flex items-center gap-0 mb-6 bg-white rounded-xl overflow-hidden border border-gray-200 w-fit shadow-sm">
        ${(Object.keys(RIWAYAT_SCOPES) as RiwayatScope[]).map((scope) => {
            const isActive = scope === activeScope;
            return `
                <button class="riwayat-tab px-6 py-2.5 text-sm font-bold outline-none transition-colors ${isActive ? 'bg-[#0D4A46] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}" data-scope="${scope}" type="button">
                    ${RIWAYAT_SCOPES[scope].label}
                </button>
            `;
        }).join('')}
    </div>
`;

const renderLoading = (): string => `
    <div class="flex items-center justify-center min-h-[300px]">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D4A46]"></div>
    </div>
`;

const bindTabs = (role: string, activeScope: RiwayatScope): void => {
    document.querySelectorAll<HTMLElement>('.riwayat-tab').forEach((button) => {
        button.addEventListener('click', () => {
            const nextScope = button.dataset.scope as RiwayatScope | undefined;
            if (!nextScope || nextScope === activeScope) return;
            void loadRiwayatScope(role, nextScope);
        });
    });
};

const bindLihatDetailButtons = (): void => {
    const root = document.getElementById(LIST_ROWS_ID);
    if (!root) return;
    root.querySelectorAll<HTMLButtonElement>('[data-riwayat-lihat-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const letterType = btn.dataset.letterType || '';
            if (!Number.isFinite(id) || id <= 0) return;
            resolveTendikReviewRenderer(letterType)?.(id, { origin: 'riwayat' });
        });
    });
};
