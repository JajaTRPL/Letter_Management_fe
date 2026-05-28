import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderReviewScholarship } from './ReviewScholarship';
import { renderReviewProsesLuarNegeri } from './ReviewProsesLuarNegeri';
import { renderReviewSuratKeteranganAktif } from './ReviewSuratKeteranganAktif';
import { renderReviewSuratPengantarMagang } from './ReviewSuratPengantarMagang';
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

type DokumenScope = 'mine' | 'team';

const DOKUMEN_SCOPES: Record<DokumenScope, { label: string; emptyText: string }> = {
    mine: {
        label: 'Tugas Saya',
        emptyText: 'Belum ada tugas yang ditugaskan kepada Anda.',
    },
    team: {
        label: 'Semua Pengajuan',
        emptyText: 'Tidak ada pengajuan dalam antrian tim Anda saat ini.',
    },
};

export const renderDokumenTendik = async (role: string) => {
    await loadDokumenScope(role, 'mine');
};

const loadDokumenScope = async (role: string, scope: DokumenScope) => {
    renderDashboardLayout('Dokumen', renderLoadingContent(), role, 'dokumen');

    try {
        const response = await apiFetch(`/api/tendik/dashboard/tasks?scope=${scope}`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.message || 'Gagal mengambil data');

        const tasks = normalizeTaskRows(result.tasks);
        renderDashboardLayout('Dokumen', renderContent(scope, tasks), role, 'dokumen');
        bindDokumenControls(role, scope, tasks);
    } catch (error: any) {
        renderDashboardLayout(
            'Error',
            `<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">${escapeHtml(error.message || 'Gagal mengambil data')}</div>`,
            role,
            'dokumen',
        );
    }
};

const renderLoadingContent = (): string => `
    <div class="w-full max-w-6xl mx-auto pb-12 animate-fade-in space-y-6">
        <p class="text-gray-600 text-sm mb-4 font-medium">Daftar pengajuan surat mahasiswa yang menunggu verifikasi</p>
        <div class="flex items-center justify-center py-20">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D4A46]"></div>
        </div>
    </div>
`;

const renderContent = (scope: DokumenScope, tasks: TendikTaskRow[]): string => `
    <div class="w-full max-w-6xl mx-auto pb-12 animate-fade-in space-y-6">
        <p class="text-gray-600 text-sm mb-4 font-medium">Daftar pengajuan surat mahasiswa yang menunggu verifikasi</p>

        ${renderTabs(scope)}

        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-7 py-5 flex flex-wrap gap-4 items-center justify-between border-b border-gray-50 bg-[#F8FAFC]/50">
                <div class="relative flex-1 min-w-[260px] max-w-md">
                    <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </span>
                    <input
                        id="dokumen-search"
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
                            <th class="px-7 py-4 text-xs font-bold text-gray-700 whitespace-nowrap w-[180px]">Tanggal Masuk</th>
                            <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap w-[220px]">Mahasiswa</th>
                            <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Jenis Surat</th>
                            <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Status</th>
                            <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Penanggung Jawab</th>
                            <th class="px-7 py-4"></th>
                        </tr>
                    </thead>
                    <tbody data-dokumen-table-body class="divide-y divide-gray-100">
                        ${renderRows(tasks, DOKUMEN_SCOPES[scope].emptyText)}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="flex items-center justify-between mt-4 mx-2">
            <p data-dokumen-count class="text-xs font-medium text-gray-700">${renderCountText(tasks.length)}</p>
        </div>
    </div>
`;

const renderTabs = (activeScope: DokumenScope): string => `
    <div class="flex items-center gap-0 mb-6 bg-white rounded-xl overflow-hidden border border-gray-200 w-fit shadow-sm">
        ${(Object.keys(DOKUMEN_SCOPES) as DokumenScope[]).map((scope) => {
            const isActive = scope === activeScope;
            return `
                <button
                    class="dokumen-tab px-6 py-2.5 text-sm font-bold outline-none transition-colors ${isActive ? 'bg-[#0D4A46] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}"
                    data-scope="${scope}"
                    type="button"
                >
                    ${DOKUMEN_SCOPES[scope].label}
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

    return tasks.map((item) => {
        const delayHtml = item.is_overdue ? `
            <div class="flex items-center gap-1 text-[#EF4444] mt-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span class="text-[10px] font-semibold">Melebihi 24 jam</span>
            </div>
        ` : '';

        return `
            <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="px-7 py-4 align-top">
                    <p class="text-xs font-semibold text-gray-500 mt-0.5">${escapeHtml(item.submitted_at || '-')}</p>
                    ${delayHtml}
                </td>
                <td class="px-4 py-4 align-top">
                    <p class="text-xs font-bold text-gray-700 mb-0.5">${escapeHtml(item.student_name || '-')}</p>
                    <p class="text-[10px] font-medium text-gray-400">${escapeHtml(item.nim || '-')}</p>
                </td>
                <td class="px-4 py-4 align-top pt-5">
                    <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60">
                        ${escapeHtml(letterLabel(item))}
                    </span>
                </td>
                <td class="px-4 py-4 align-top pt-5 whitespace-nowrap">
                    ${renderStatusBadge(item.status, 'tendik-review')}
                </td>
                <td class="px-4 py-4 align-top pt-5">
                    <p class="text-xs font-semibold text-gray-700">${escapeHtml(item.assigned_tendik_name || 'Belum ditugaskan')}</p>
                </td>
                <td class="px-7 py-4 align-top text-right">
                    <button class="review-btn text-[11px] font-bold text-[#0D4A46] border-2 border-[#0D4A46] rounded-full px-5 py-1.5 hover:bg-[#0D4A46] hover:text-white transition-colors duration-200" data-id="${escapeAttribute(item.id)}" data-letter-type="${escapeAttribute(item.letter_type || '')}">
                        Review Dokumen
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

const bindDokumenControls = (role: string, activeScope: DokumenScope, tasks: TendikTaskRow[]) => {
    bindReviewButtons();

    document.querySelectorAll<HTMLElement>('.dokumen-tab').forEach((button) => {
        button.addEventListener('click', () => {
            const nextScope = button.dataset.scope as DokumenScope | undefined;
            if (!nextScope || nextScope === activeScope) return;
            void loadDokumenScope(role, nextScope);
        });
    });

    const searchInput = document.querySelector<HTMLInputElement>('#dokumen-search');
    searchInput?.addEventListener('input', () => {
        const filteredTasks = filterTasks(tasks, searchInput.value);
        const tbody = document.querySelector<HTMLTableSectionElement>('[data-dokumen-table-body]');
        const count = document.querySelector<HTMLElement>('[data-dokumen-count]');
        const emptyText = tasks.length === 0
            ? DOKUMEN_SCOPES[activeScope].emptyText
            : 'Tidak ada data yang sesuai pencarian.';

        if (tbody) tbody.innerHTML = renderRows(filteredTasks, emptyText);
        if (count) count.innerHTML = renderCountText(filteredTasks.length);
        bindReviewButtons();
    });
};

const bindReviewButtons = () => {
    document.querySelectorAll<HTMLElement>('.review-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const id = parseInt(target.getAttribute('data-id') || '0');
            const letterType = target.getAttribute('data-letter-type');

            if (isMagangLetter(letterType)) {
                renderReviewSuratPengantarMagang(id);
                return;
            }

            if (isAktifLetter(letterType)) {
                renderReviewSuratKeteranganAktif(id);
                return;
            }

            if (isProsesLuarNegeriLetter(letterType)) {
                renderReviewProsesLuarNegeri(id);
                return;
            }

            if (isLegacyBeasiswaFallback(letterType)) {
                renderReviewScholarship(id);
            }
        });
    });
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
        getLetterStatusLabel(item.status, 'tendik-review'),
        item.nomor_surat,
        item.assigned_tendik_name,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery)));
};

const normalizeTaskRows = (value: unknown): TendikTaskRow[] => (
    Array.isArray(value) ? value as TendikTaskRow[] : []
);

const letterLabel = (item: TendikTaskRow): string => (
    getAssignedTaskLabel(item.letter_type) || item.type || 'Surat Administrasi'
);

const renderStatusBadge = (status: string | null | undefined, variant: 'tendik-review' | 'tendik-history'): string => {
    const label = getLetterStatusLabel(status, variant) || status || '-';
    const tone = getLetterStatusTone(status, variant);
    return `<span class="inline-flex items-center justify-center min-w-[120px] px-3 py-1.5 rounded-full text-[10px] font-bold ${tone}">${escapeHtml(label)}</span>`;
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
