import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderReviewScholarship } from './ReviewScholarship';
import { renderReviewProsesLuarNegeri } from './ReviewProsesLuarNegeri';
import { renderReviewSuratKeteranganAktif } from './ReviewSuratKeteranganAktif';
import { renderReviewSuratPengantarMagang } from './ReviewSuratPengantarMagang';
import { renderReviewSuratTugas } from './ReviewSuratTugas';
import {
    isAktifLetter,
    isLegacyBeasiswaFallback,
    isMagangLetter,
    isProsesLuarNegeriLetter,
    isSuratTugasLetter,
} from '../shared/letter-workflow';
import { apiFetch } from '../shared/api-client';
import {
    attachListControls,
    createListQueryState,
    renderListBody,
    renderListPagination,
    renderListToolbar,
    type ListPrimitiveConfig,
} from '../shared/list-primitives';
import {
    renderTendikActionableRow,
    tendikListFilters,
    tendikListFilterValue,
    tendikListSearchText,
    toTendikListItems,
    type TendikListItem,
} from '../shared/tendik-letter-list';

type DokumenScope = 'mine' | 'team';

const DOKUMEN_SCOPES: Record<DokumenScope, { label: string; emptyText: string }> = {
    mine: { label: 'Tugas Saya', emptyText: 'Belum ada tugas yang ditugaskan kepada Anda.' },
    team: { label: 'Semua Pengajuan', emptyText: 'Tidak ada pengajuan dalam antrian tim Anda saat ini.' },
};

const LIST_ID_PREFIX = 'dokumen-list';
const LIST_ROWS_ID = `${LIST_ID_PREFIX}-rows`;

// Type-based reviewer dispatch stays in the page (adapter holds data only).
const openReviewForLetter = (id: number, letterType: string | null | undefined): void => {
    if (isMagangLetter(letterType)) { void renderReviewSuratPengantarMagang(id); return; }
    if (isAktifLetter(letterType)) { void renderReviewSuratKeteranganAktif(id); return; }
    if (isProsesLuarNegeriLetter(letterType)) { void renderReviewProsesLuarNegeri(id); return; }
    if (isSuratTugasLetter(letterType)) { void renderReviewSuratTugas(id); return; }
    if (isLegacyBeasiswaFallback(letterType)) { void renderReviewScholarship(id); }
};

export const renderDokumenTendik = async (role: string): Promise<void> => {
    await loadDokumenScope(role, 'mine');
};

const loadDokumenScope = async (role: string, scope: DokumenScope): Promise<void> => {
    const shell = (rowsInner: string, toolbarItems: readonly TendikListItem[], state = createListQueryState({ pageSize: 10 })): string => `
        <div class="w-full max-w-6xl mx-auto pb-12 animate-fade-in space-y-6">
            <p class="text-gray-600 text-sm mb-4 font-medium">Daftar pengajuan surat mahasiswa yang menunggu verifikasi</p>
            ${renderTabs(scope)}
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div class="px-7 py-5 border-b border-gray-50 bg-[#F8FAFC]/50">
                    ${renderListToolbar(toolbarConfig(toolbarItems), state)}
                </div>
                <div id="${LIST_ROWS_ID}" class="overflow-x-auto">${rowsInner}</div>
            </div>
            ${renderListPagination(LIST_ID_PREFIX)}
        </div>
    `;

    renderDashboardLayout('Dokumen', shell(renderLoading(), []), role, 'dokumen');

    let items: TendikListItem[] = [];
    try {
        const response = await apiFetch(`/api/tendik/dashboard/tasks?scope=${scope}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Gagal mengambil data');
        items = toTendikListItems(result.tasks);
    } catch (error: any) {
        renderDashboardLayout(
            'Error',
            `<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">${escapeHtml(error?.message || 'Gagal mengambil data')}</div>`,
            role,
            'dokumen',
        );
        return;
    }

    const queryState = createListQueryState({ pageSize: 10 });
    const config = listConfig(scope, items);

    renderDashboardLayout('Dokumen', shell(renderTableSkeleton(), items, queryState), role, 'dokumen');

    const refresh = (): void => {
        renderListBody(items, queryState, config);
        bindReviewButtons();
    };

    bindTabs(role, scope);
    attachListControls(queryState, config, refresh);
    refresh();
};

const toolbarConfig = (items: readonly TendikListItem[]): ListPrimitiveConfig<TendikListItem> => listConfig('mine', items);

const listConfig = (scope: DokumenScope, items: readonly TendikListItem[]): ListPrimitiveConfig<TendikListItem> => ({
    idPrefix: LIST_ID_PREFIX,
    searchPlaceholder: 'Cari berdasarkan Nama atau NIM',
    filters: tendikListFilters(items, 'actionable'),
    getSearchText: (item) => tendikListSearchText(item, 'actionable'),
    getFilterValue: tendikListFilterValue,
    renderItem: renderTendikActionableRow,
    renderItemsContainer: (rowsHtml) => `
        <table class="w-full text-left bg-white">
            <thead>
                <tr class="border-b border-gray-100 bg-white">
                    <th class="px-7 py-4 text-xs font-bold text-gray-700 whitespace-nowrap w-[180px]">Tanggal Masuk</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap w-[220px]">Mahasiswa</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Jenis Surat</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Status</th>
                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Penanggung Jawab</th>
                    <th class="px-7 py-4"></th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `,
    emptyMessage: DOKUMEN_SCOPES[scope].emptyText,
    resultCountLabel: (shown, total) => `Menampilkan ${shown} dari ${total} data`,
});

const renderTabs = (activeScope: DokumenScope): string => `
    <div class="flex items-center gap-0 mb-6 bg-white rounded-xl overflow-hidden border border-gray-200 w-fit shadow-sm">
        ${(Object.keys(DOKUMEN_SCOPES) as DokumenScope[]).map((scope) => {
            const isActive = scope === activeScope;
            return `
                <button class="dokumen-tab px-6 py-2.5 text-sm font-bold outline-none transition-colors ${isActive ? 'bg-[#0D4A46] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}" data-scope="${scope}" type="button">
                    ${DOKUMEN_SCOPES[scope].label}
                </button>
            `;
        }).join('')}
    </div>
`;

const renderLoading = (): string => `
    <div class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D4A46]"></div>
    </div>
`;

const renderTableSkeleton = (): string => '';

const bindTabs = (role: string, activeScope: DokumenScope): void => {
    document.querySelectorAll<HTMLElement>('.dokumen-tab').forEach((button) => {
        button.addEventListener('click', () => {
            const nextScope = button.dataset.scope as DokumenScope | undefined;
            if (!nextScope || nextScope === activeScope) return;
            void loadDokumenScope(role, nextScope);
        });
    });
};

const bindReviewButtons = (): void => {
    const root = document.getElementById(LIST_ROWS_ID);
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.review-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const id = parseInt(target.getAttribute('data-id') || '0', 10);
            if (!Number.isFinite(id) || id <= 0) return;
            openReviewForLetter(id, target.getAttribute('data-letter-type'));
        });
    });
};

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
