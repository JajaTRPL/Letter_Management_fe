import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import {
    getLetterStatusLabel,
    getLetterStatusTone,
    isAktifLetter,
    isLegacyBeasiswaFallback,
    isMagangLetter,
    isProsesLuarNegeriLetter,
    type TendikTaskRow,
} from '../shared/letter-workflow';
import { renderReviewScholarship } from '../tendik/ReviewScholarship';
import { renderReviewProsesLuarNegeriAkademik } from './ReviewProsesLuarNegeriAkademik';
import { renderReviewSuratKeteranganAktifAkademik } from './ReviewSuratKeteranganAktifAkademik';
import { renderReviewSuratPengantarMagangAkademik } from './ReviewSuratPengantarMagangAkademik';

interface AkademikHistoryRow extends TendikTaskRow {
    action_at?: string | null;
    kaprodi_approved_by_name?: string | null;
    kadep_approved_by_name?: string | null;
}

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const renderRiwayatAkademik = async (role: string): Promise<void> => {
    renderDashboardLayout('Riwayat', loadingState(), role, 'riwayat');

    try {
        const response = await apiFetch('/api/akademik/riwayat');
        if (!response.ok) {
            throw new Error('Failed to fetch academic history.');
        }

        const data = await response.json() as { tasks?: AkademikHistoryRow[] };
        const tasks = data.tasks ?? [];

        renderDashboardLayout('Riwayat', pageContent(tasks), role, 'riwayat');
        bindSearch(tasks.length);
        bindLihatDetailButtons();
    } catch (error) {
        console.error(error);
        renderDashboardLayout('Riwayat', errorState(), role, 'riwayat');
    }
};

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

const emptyState = (): string => `
    <tr>
        <td colspan="6" class="px-7 py-12 text-center text-sm text-gray-400">
            Belum ada riwayat akademik yang dapat ditampilkan.
        </td>
    </tr>
`;

const pageContent = (tasks: AkademikHistoryRow[]): string => `
    <div class="mx-auto w-full max-w-[1200px] space-y-6 pb-12 text-sm">
        <section class="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div class="border-b border-gray-100 px-7 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="flex gap-3">
                    <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-500 text-blue-500 shadow-sm">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div>
                        <h2 class="text-[17px] font-bold text-gray-800">Riwayat Persetujuan</h2>
                        <p class="mt-1 text-[11px] text-gray-500">Pengajuan dalam lingkup akademik Anda yang sudah melewati tahap tindakan.</p>
                    </div>
                </div>
                <div class="relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input id="riwayat-akademik-search" type="text" placeholder="Cari nama, NIM, nomor surat, jenis surat" class="w-[300px] rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-xs font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                </div>
            </div>
            <div class="overflow-x-auto">
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
                    <tbody id="riwayat-akademik-tbody" class="divide-y divide-gray-100">
                        ${tasks.length === 0 ? emptyState() : tasks.map(historyRow).join('')}
                    </tbody>
                </table>
            </div>
            <div class="flex items-center justify-between border-t border-gray-100 px-7 py-3 text-[11px] font-medium text-gray-500">
                <span id="riwayat-akademik-count">${tasks.length === 0 ? 'Tidak ada data' : `Menampilkan ${tasks.length} dari ${tasks.length} data`}</span>
            </div>
        </section>
    </div>
`;

const historyRow = (task: AkademikHistoryRow): string => {
    const statusTone = getLetterStatusTone(task.status, 'tendik-history');
    const statusLabel = escapeHtml(getLetterStatusLabel(task.status, 'tendik-history') || '-');
    const actionDate = escapeHtml(task.action_at || task.submitted_at || '-');
    const searchKey = [task.student_name, task.nim, task.type, task.letter_type, task.nomor_surat].filter(Boolean).join(' ').toLowerCase();

    return `
        <tr class="riwayat-akademik-row transition-colors hover:bg-gray-50/70" data-search="${escapeHtml(searchKey)}">
            <td class="px-7 py-4 align-top text-xs font-medium text-gray-500">${actionDate}</td>
            <td class="px-4 py-4 align-top text-xs font-semibold text-gray-600">${escapeHtml(task.nomor_surat || '-')}</td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs font-bold text-gray-700">${escapeHtml(task.student_name || '-')}</p>
                <p class="mt-0.5 text-[10px] font-medium text-gray-400">${escapeHtml(task.nim || '-')}</p>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full border border-gray-200 bg-[#F1F5F9] px-3 py-1.5 text-[10px] font-bold text-gray-600">
                    ${escapeHtml(task.type || '-')}
                </span>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold ${statusTone}">
                    ${statusLabel}
                </span>
            </td>
            <td class="px-7 py-3 text-right align-top">${renderLihatDetailButton(task)}</td>
        </tr>
    `;
};

const renderLihatDetailButton = (task: AkademikHistoryRow): string => {
    const letterType = task.letter_type ?? task.type ?? '';
    if (!resolveAkademikReviewRenderer(letterType)) {
        return '<span class="text-xs text-gray-400">-</span>';
    }
    const idAttr = String(task.id ?? '');
    return `
        <button type="button" data-riwayat-lihat-detail data-id="${escapeHtml(idAttr)}" data-letter-type="${escapeHtml(String(letterType))}" class="text-xs font-bold text-[#115E59] hover:underline transition-colors">
            Lihat Detail
        </button>
    `;
};

type AkademikReviewRenderer = (id: number, options: { origin: 'riwayat' }) => void;

const resolveAkademikReviewRenderer = (letterType: string): AkademikReviewRenderer | null => {
    if (isMagangLetter(letterType)) return renderReviewSuratPengantarMagangAkademik;
    if (isAktifLetter(letterType)) return renderReviewSuratKeteranganAktifAkademik;
    if (isProsesLuarNegeriLetter(letterType)) return renderReviewProsesLuarNegeriAkademik;
    if (isLegacyBeasiswaFallback(letterType)) return renderReviewScholarship;
    return null;
};

const bindSearch = (total: number): void => {
    const input = document.getElementById('riwayat-akademik-search') as HTMLInputElement | null;
    const countEl = document.getElementById('riwayat-akademik-count');
    if (!input) return;

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        let visible = 0;
        document.querySelectorAll<HTMLTableRowElement>('.riwayat-akademik-row').forEach((row) => {
            const key = row.dataset.search || '';
            const show = !query || key.includes(query);
            row.style.display = show ? '' : 'none';
            if (show) visible += 1;
        });
        if (countEl) {
            countEl.textContent = total === 0
                ? 'Tidak ada data'
                : `Menampilkan ${visible} dari ${total} data`;
        }
    });
};

const bindLihatDetailButtons = (): void => {
    document.querySelectorAll<HTMLButtonElement>('[data-riwayat-lihat-detail]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.id);
            const letterType = button.dataset.letterType || '';
            if (!Number.isFinite(id) || id <= 0) return;
            const renderer = resolveAkademikReviewRenderer(letterType);
            renderer?.(id, { origin: 'riwayat' });
        });
    });
};
