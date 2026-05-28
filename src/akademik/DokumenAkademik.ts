import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import {
    getAkademikQueueLabel,
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

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const renderDokumenAkademik = async (role: string): Promise<void> => {
    renderDashboardLayout('Dokumen', loadingState(), role, 'dokumen');

    try {
        const response = await apiFetch('/api/akademik/dashboard/tasks');
        if (!response.ok) {
            throw new Error('Failed to fetch academic documents.');
        }

        const data = await response.json() as { tasks?: TendikTaskRow[] };
        const tasks = data.tasks ?? [];

        renderDashboardLayout('Dokumen', pageContent(tasks), role, 'dokumen');
        bindSearch(tasks.length);
        bindReviewButtons(tasks);
    } catch (error) {
        console.error(error);
        renderDashboardLayout('Dokumen', errorState(), role, 'dokumen');
    }
};

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

const emptyState = (): string => `
    <tr>
        <td colspan="5" class="px-7 py-12 text-center text-sm text-gray-400">
            Belum ada dokumen yang memerlukan tindakan Anda saat ini.
        </td>
    </tr>
`;

const pageContent = (tasks: TendikTaskRow[]): string => `
    <div class="mx-auto w-full max-w-[1200px] space-y-6 pb-12 text-sm">
        <section class="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div class="border-b border-gray-100 px-7 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="flex gap-3">
                    <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-500 text-red-500 shadow-sm">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="6" x2="12" y2="14"></line><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                    </div>
                    <div>
                        <h2 class="text-[17px] font-bold text-gray-800">Antrean Perlu Tindakan</h2>
                        <p class="mt-1 text-[11px] text-gray-500">Daftar pengajuan dalam tahap dan lingkup akademik Anda yang menunggu tindakan.</p>
                    </div>
                </div>
                <div class="relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input id="dokumen-akademik-search" type="text" placeholder="Cari nama, NIM, atau jenis surat" class="w-[260px] rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-xs font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                </div>
            </div>
            <div class="overflow-x-auto">
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
                    <tbody id="dokumen-akademik-tbody" class="divide-y divide-gray-100">
                        ${tasks.length === 0 ? emptyState() : tasks.map(taskRow).join('')}
                    </tbody>
                </table>
            </div>
            <div class="flex items-center justify-between border-t border-gray-100 px-7 py-3 text-[11px] font-medium text-gray-500">
                <span id="dokumen-akademik-count">${tasks.length === 0 ? 'Tidak ada data' : `Menampilkan ${tasks.length} dari ${tasks.length} data`}</span>
            </div>
        </section>
    </div>
`;

const taskRow = (task: TendikTaskRow): string => {
    const statusTone = getLetterStatusTone(task.status, 'akademik-review');
    const statusLabel = escapeHtml(getAkademikQueueLabel(task.status));
    const searchKey = [task.student_name, task.nim, task.type, task.letter_type].filter(Boolean).join(' ').toLowerCase();

    return `
        <tr class="dokumen-akademik-row transition-colors hover:bg-gray-50/70" data-search="${escapeHtml(searchKey)}">
            <td class="px-7 py-4 align-top">
                <p class="text-xs font-medium text-gray-500">${escapeHtml(task.submitted_at || '-')}</p>
                ${task.is_overdue ? `<p class="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-500"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> 24 jam tertunda</p>` : ''}
            </td>
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
                <span class="inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold ${statusTone}">
                    ${statusLabel}
                </span>
            </td>
            <td class="px-7 py-3 text-right align-top">
                <button
                    class="akademik-review-btn w-full max-w-[140px] rounded-xl border-2 border-[#115E59] px-4 py-2 text-xs font-bold text-[#115E59] shadow-sm transition-colors hover:bg-[#115E59] hover:text-white"
                    data-id="${task.id}"
                    data-letter-type="${escapeHtml(task.letter_type || '')}"
                >
                    Review
                </button>
            </td>
        </tr>
    `;
};

const bindSearch = (total: number): void => {
    const input = document.getElementById('dokumen-akademik-search') as HTMLInputElement | null;
    const countEl = document.getElementById('dokumen-akademik-count');
    if (!input) return;

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        let visible = 0;
        document.querySelectorAll<HTMLTableRowElement>('.dokumen-akademik-row').forEach((row) => {
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

const bindReviewButtons = (tasks: TendikTaskRow[]): void => {
    const taskByKey = new Map(tasks.map((task) => [String(task.id), task]));

    document.querySelectorAll<HTMLButtonElement>('.akademik-review-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.id || 0);
            const task = taskByKey.get(String(id));
            openReview(id, button.dataset.letterType || task?.letter_type || '');
        });
    });
};

const openReview = (id: number, letterType: string): void => {
    if (!id) return;

    if (isMagangLetter(letterType)) {
        renderReviewSuratPengantarMagangAkademik(id);
        return;
    }

    if (isAktifLetter(letterType)) {
        renderReviewSuratKeteranganAktifAkademik(id);
        return;
    }

    if (isProsesLuarNegeriLetter(letterType)) {
        renderReviewProsesLuarNegeriAkademik(id);
        return;
    }

    if (isLegacyBeasiswaFallback(letterType)) {
        renderReviewScholarship(id);
    }
};
