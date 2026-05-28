import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import {
    getAssignedTaskLabel,
    getLetterStatusLabel,
    getLetterStatusTone,
    isAktifLetter,
    isLegacyBeasiswaFallback,
    isMagangLetter,
    isProsesLuarNegeriLetter,
} from '../shared/letter-workflow';
import type { TendikTaskRow } from '../shared/letter-workflow';
import { apiFetch } from '../shared/api-client';
import { renderReviewScholarship } from './ReviewScholarship';
import { renderReviewSuratPengantarMagang } from './ReviewSuratPengantarMagang';
import { renderReviewSuratKeteranganAktif } from './ReviewSuratKeteranganAktif';
import { renderReviewProsesLuarNegeri } from './ReviewProsesLuarNegeri';

type RiwayatScope = 'mine' | 'team';

const RIWAYAT_SCOPES: Record<RiwayatScope, { label: string; emptyText: string }> = {
    mine: {
        label: 'Riwayat Saya',
        emptyText: 'Belum ada riwayat pengajuan yang Anda tangani.',
    },
    team: {
        label: 'Riwayat Tim',
        emptyText: 'Belum ada riwayat pengajuan dalam tim Anda.',
    },
};

export const renderRiwayatTendik = async (role: string) => {
    await loadRiwayatScope(role, 'mine');
};

const loadRiwayatScope = async (role: string, scope: RiwayatScope) => {
    renderDashboardLayout('Riwayat', renderLoadingContent(), role, 'riwayat');

    try {
        const response = await apiFetch(`/api/tendik/riwayat?scope=${scope}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'Failed to fetch history');

        const tasks = normalizeTaskRows(data.tasks);
        renderDashboardLayout('Riwayat', renderContent(scope, tasks), role, 'riwayat');
        bindRiwayatControls(role, scope, tasks);
    } catch (error) {
        console.error(error);
        renderDashboardLayout('Riwayat', `
            <div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">Gagal mengambil data riwayat.</div>
        `, role, 'riwayat');
    }
};

const renderLoadingContent = (): string => `
    <div class="flex items-center justify-center min-h-[400px]">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D4A46]"></div>
    </div>
`;

const renderContent = (scope: RiwayatScope, tasks: TendikTaskRow[]): string => `
    <div class="w-full max-w-6xl mx-auto pb-12 animate-fade-in space-y-6">
        <p class="text-gray-600 text-sm mb-4">Daftar pengajuan surat yang telah diproses</p>

        ${renderTabs(scope)}

        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-7 py-5 flex flex-wrap gap-4 items-center justify-between border-b border-gray-50 bg-[#F8FAFC]/50">
                <div class="relative flex-1 min-w-[260px] max-w-md">
                    <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </span>
                    <input
                        id="riwayat-search"
                        type="text"
                        placeholder="Cari berdasarkan Nama atau NIM"
                        class="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all bg-white"
                    >
                </div>
            </div>

            <div class="overflow-x-auto">
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
                    <tbody data-riwayat-table-body class="divide-y divide-gray-100">
                        ${renderRows(tasks, RIWAYAT_SCOPES[scope].emptyText)}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="flex items-center justify-between mt-4 mx-2">
            <p data-riwayat-count class="text-xs font-medium text-gray-700">${renderCountText(tasks.length)}</p>
        </div>
    </div>
`;

const renderTabs = (activeScope: RiwayatScope): string => `
    <div class="flex items-center gap-0 mb-6 bg-white rounded-xl overflow-hidden border border-gray-200 w-fit shadow-sm">
        ${(Object.keys(RIWAYAT_SCOPES) as RiwayatScope[]).map((scope) => {
            const isActive = scope === activeScope;
            return `
                <button
                    class="riwayat-tab px-6 py-2.5 text-sm font-bold outline-none transition-colors ${isActive ? 'bg-[#0D4A46] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}"
                    data-scope="${scope}"
                    type="button"
                >
                    ${RIWAYAT_SCOPES[scope].label}
                </button>
            `;
        }).join('')}
    </div>
`;

const renderRows = (tasks: TendikTaskRow[], emptyText: string): string => {
    if (tasks.length === 0) {
        return `
            <tr>
                <td colspan="6" class="px-7 py-20 text-center">
                    <div class="flex flex-col items-center gap-3 grayscale opacity-40">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        <p class="text-sm font-bold text-gray-500">${escapeHtml(emptyText)}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    return tasks.map((item) => `
        <tr class="hover:bg-gray-50/50 transition-colors">
            <td class="px-7 py-4 align-top">
                <p class="text-xs font-semibold text-gray-500">${escapeHtml(item.submitted_at || '-')}</p>
                ${item.is_overdue ? '<p class="text-[10px] font-bold text-red-500 mt-1">&gt; 24 jam tertunda</p>' : ''}
            </td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs font-bold text-gray-700 mb-0.5">${escapeHtml(item.student_name || '-')}</p>
                <p class="text-[10px] font-medium text-gray-400">${escapeHtml(item.nim || '-')}</p>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60">
                    ${escapeHtml(letterLabel(item))}
                </span>
            </td>
            <td class="px-4 py-4 align-top whitespace-nowrap">
                ${renderStatusBadge(item.status)}
            </td>
            <td class="px-4 py-4 align-top">
                ${renderActorCell(item)}
            </td>
            <td class="px-7 py-4 align-top text-right">
                ${renderLihatDetailButton(item)}
            </td>
        </tr>
    `).join('');
};

const bindRiwayatControls = (role: string, activeScope: RiwayatScope, tasks: TendikTaskRow[]) => {
    document.querySelectorAll<HTMLElement>('.riwayat-tab').forEach((button) => {
        button.addEventListener('click', () => {
            const nextScope = button.dataset.scope as RiwayatScope | undefined;
            if (!nextScope || nextScope === activeScope) return;
            void loadRiwayatScope(role, nextScope);
        });
    });

    const searchInput = document.querySelector<HTMLInputElement>('#riwayat-search');
    searchInput?.addEventListener('input', () => {
        const filteredTasks = filterTasks(tasks, searchInput.value);
        const tbody = document.querySelector<HTMLTableSectionElement>('[data-riwayat-table-body]');
        const count = document.querySelector<HTMLElement>('[data-riwayat-count]');
        const emptyText = tasks.length === 0
            ? RIWAYAT_SCOPES[activeScope].emptyText
            : 'Tidak ada data yang sesuai pencarian.';

        if (tbody) tbody.innerHTML = renderRows(filteredTasks, emptyText);
        if (count) count.innerHTML = renderCountText(filteredTasks.length);
        bindLihatDetailButtons();
    });

    bindLihatDetailButtons();
};

const renderLihatDetailButton = (item: TendikTaskRow): string => {
    const letterType = item.letter_type ?? item.type ?? '';
    if (!resolveTendikReviewRenderer(letterType)) {
        return '<span class="text-xs text-gray-400">-</span>';
    }
    const idAttr = String(item.id ?? '');
    return `
        <button type="button" data-riwayat-lihat-detail data-id="${escapeAttribute(idAttr)}" data-letter-type="${escapeAttribute(String(letterType))}" class="text-xs font-bold text-primary-teal hover:underline transition-colors">
            Lihat Detail
        </button>
    `;
};

const bindLihatDetailButtons = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-riwayat-lihat-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const letterType = btn.dataset.letterType || '';
            if (!Number.isFinite(id) || id <= 0) return;
            const renderer = resolveTendikReviewRenderer(letterType);
            renderer?.(id, { origin: 'riwayat' });
        });
    });
};

type TendikReviewRenderer = (id: number, options: { origin: 'riwayat' }) => void;

const resolveTendikReviewRenderer = (letterType: string): TendikReviewRenderer | null => {
    if (isMagangLetter(letterType)) return renderReviewSuratPengantarMagang;
    if (isAktifLetter(letterType)) return renderReviewSuratKeteranganAktif;
    if (isProsesLuarNegeriLetter(letterType)) return renderReviewProsesLuarNegeri;
    if (isLegacyBeasiswaFallback(letterType)) return renderReviewScholarship;
    return null;
};

const filterTasks = (tasks: TendikTaskRow[], query: string): TendikTaskRow[] => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return tasks;

    return tasks.filter((item) => [
        item.student_name,
        item.nim,
        item.type,
        item.letter_type,
        letterLabel(item),
        getLetterStatusLabel(item.status, 'tendik-history'),
        item.nomor_surat,
        item.assigned_tendik_name,
        item.tendik_approved_by_name,
        item.revised_by_name,
        item.rejected_by_name,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery)));
};

const renderActorCell = (item: TendikTaskRow): string => {
    const actor = actorInfo(item);
    if (!actor.name) {
        return '<span class="text-xs text-gray-400">-</span>';
    }

    return `
        <p class="text-xs font-semibold text-gray-700">${escapeHtml(actor.name)}</p>
        <p class="text-[10px] font-medium text-gray-400">${escapeHtml(actor.label)}</p>
    `;
};

const actorInfo = (item: TendikTaskRow): { label: string; name: string } => {
    if (item.rejected_by_name) {
        return { label: 'Ditolak oleh', name: item.rejected_by_name };
    }

    if (item.revised_by_name) {
        return { label: 'Direvisi oleh', name: item.revised_by_name };
    }

    if (item.tendik_approved_by_name) {
        return { label: 'Diverifikasi oleh', name: item.tendik_approved_by_name };
    }

    if (item.assigned_tendik_name) {
        return { label: 'Penanggung jawab', name: item.assigned_tendik_name };
    }

    return { label: '', name: '' };
};

const normalizeTaskRows = (value: unknown): TendikTaskRow[] => (
    Array.isArray(value) ? value as TendikTaskRow[] : []
);

const letterLabel = (item: TendikTaskRow): string => (
    getAssignedTaskLabel(item.letter_type) || item.type || 'Surat Administrasi'
);

const renderStatusBadge = (status: string | null | undefined): string => {
    const label = getLetterStatusLabel(status, 'tendik-history') || status || '-';
    const tone = getLetterStatusTone(status, 'tendik-history');
    return `<span class="inline-flex items-center justify-center min-w-[70px] px-3 py-1.5 rounded-full text-[10px] font-bold ${tone}">${escapeHtml(label)}</span>`;
};

const renderCountText = (count: number): string => {
    const start = count > 0 ? 1 : 0;
    return `Menampilkan <span class="font-bold">${start} - ${count}</span> dari <span class="font-bold">${count}</span> data`;
};

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeAttribute = escapeHtml;
