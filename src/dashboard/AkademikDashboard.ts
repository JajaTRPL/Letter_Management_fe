import { renderDashboardLayout } from './DashboardLayout';
import { escapeFormHtml } from '../shared/form-primitives';
import {
    dashboardSectionIcon,
    renderDashboardLinkButton,
    renderDashboardSection,
    renderDashboardStatCard,
    renderDashboardStatGrid,
    renderDashboardTable,
} from '../shared/ui-primitives';
import {
    hydrateReviewPerformance,
    reviewPerformanceShell,
    type ReviewPerformanceWidgetConfig,
} from '../shared/review-performance-widget';
import { getGreetingName } from '../utils/nameHelper';
import { apiFetch } from '../shared/api-client';
import { renderReviewScholarshipAkademik } from '../akademik/ReviewScholarshipAkademik';
import { renderReviewProsesLuarNegeriAkademik } from '../akademik/ReviewProsesLuarNegeriAkademik';
import { renderReviewSuratKeteranganAktifAkademik } from '../akademik/ReviewSuratKeteranganAktifAkademik';
import { renderReviewSuratPengantarMagangAkademik } from '../akademik/ReviewSuratPengantarMagangAkademik';
import { renderReviewSuratTugasAkademik } from '../akademik/ReviewSuratTugasAkademik';
import {
    getAkademikQueueLabel,
    getLetterStatusLabel,
    getLetterStatusTone,
    isAktifLetter,
    isLegacyBeasiswaFallback,
    isMagangLetter,
    isProsesLuarNegeriLetter,
    isSuratTugasLetter,
    type TendikTaskRow,
} from '../shared/letter-workflow';

// The shared escaper is the single owner; this alias keeps the local call sites
// short without maintaining a second, drift-prone copy of the same five rules.
const escapeHtml = (value: unknown): string => escapeFormHtml(value as string | number | null | undefined);

const firstText = (...values: unknown[]): string => {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
};

const buildRoleLabel = (role: string, profileUser: Record<string, any> | null | undefined): string => {
    const subRole = (firstText(profileUser?.sub_role, profileUser?.role, role, localStorage.getItem('auth_sub_role')) || '').toLowerCase();
    const prodi = firstText(
        profileUser?.study_program?.code,
        profileUser?.study_program_code,
        profileUser?.study_program?.name,
        profileUser?.study_program_name,
    );
    const dept = firstText(
        profileUser?.department?.code,
        profileUser?.department_code,
        profileUser?.department?.name,
        profileUser?.department_name,
    );

    if (subRole === 'kaprodi') return prodi ? `Kaprodi ${prodi}` : 'Kaprodi';
    if (subRole === 'sekprodi') return prodi ? `Sekprodi ${prodi}` : 'Sekprodi';
    if (subRole === 'kadep') return dept ? `Kadep ${dept}` : 'Kadep';
    if (subRole === 'sekdep') return dept ? `Sekdep ${dept}` : 'Sekdep';
    if (subRole === 'akademik') return 'Akademik';
    return subRole ? subRole.charAt(0).toUpperCase() + subRole.slice(1) : 'Akademik';
};

interface RiwayatRow extends TendikTaskRow {
    action_at?: string | null;
}


/**
 * A reviewer's own stage — an action prompt, not a scorecard.
 *
 * Deliberately links to their queue rather than to the analytics page: reviewers
 * get something to do, SuperAdmin gets something to analyse. The endpoint scopes
 * itself from the session, so a Kaprodi sees their own program and a Kadep
 * sees their own department, with no parameter either could change. An
 * academic account with no scope resolves to `eligible:false` and the card
 * removes itself rather than rendering an empty shell.
 */
const SELF_REVIEW_CARD: ReviewPerformanceWidgetConfig = {
    mountId: 'akademik-review-performance',
    endpoint: '/api/akademik/review-performance/me?period=1month',
    variant: 'self',
    title: 'Pemeriksaan Anda Bulan Ini',
    subtitle: 'Ringkasan tahap pemeriksaan yang Anda tangani — bukan penilaian per orang.',
};


// Static icons for the shared dashboard stat cards.
const STAT_ICON_INBOX = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
const STAT_ICON_ALERT = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
const STAT_ICON_DONE = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';

export const renderAkademikDashboard = async (role: string) => {
    const fullName = localStorage.getItem('auth_name') || '';
    const userName = getGreetingName(fullName) || '';

    renderDashboardLayout('Dashboard', `
        <div class="flex items-center justify-center min-h-[400px]">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#115E59]"></div>
        </div>
    `, role, 'dashboard');

    let tasksRes: Response | null = null;
    let profileRes: Response | null = null;
    let riwayatRes: Response | null = null;

    try {
        [tasksRes, profileRes, riwayatRes] = await Promise.all([
            apiFetch('/api/akademik/dashboard/tasks'),
            apiFetch('/api/profile'),
            apiFetch('/api/akademik/riwayat'),
        ]);

        if (!tasksRes.ok) throw new Error('Data dasbor belum berhasil dimuat. Coba muat ulang halaman.');

        const data = await tasksRes.json();
        const stats = data.stats || { total_incoming: 0, needs_verification: 0, finished_this_month: 0 };
        const tasks: TendikTaskRow[] = data.tasks || [];
        const meta = data.meta as {
            displayed_tasks: number;
            total_matching_tasks: number;
            is_limited: boolean;
            limit: number;
            per_type_limit?: number;
            limit_scope?: 'per_letter_type';
        } | undefined;
        const limitedTaskNote = meta?.is_limited
            ? `Menampilkan ${meta.displayed_tasks} dari ${meta.total_matching_tasks} total tugas. Daftar dibatasi per jenis surat.`
            : '';

        let profileUser: Record<string, any> | null = null;
        if (profileRes?.ok) {
            try {
                const profileBody = await profileRes.json();
                profileUser = (profileBody?.user ?? null) as Record<string, any> | null;
            } catch { /* ignore */ }
        }
        const roleLabel = buildRoleLabel(role, profileUser);

        let riwayat: RiwayatRow[] = [];
        if (riwayatRes?.ok) {
            try {
                const riwayatBody = await riwayatRes.json();
                riwayat = (riwayatBody?.tasks ?? []) as RiwayatRow[];
            } catch { /* ignore */ }
        }
        const recentRiwayat = riwayat.slice(0, 5);

        const content = `
        <div class="space-y-6 animate-fade-in pb-12 w-full max-w-[1200px] mx-auto text-sm">
            <!-- Welcome Section -->
            <div class="mt-2">
                <h2 class="text-[28px] font-bold text-gray-800 leading-tight">Halo, ${escapeHtml(userName)}${userName ? '!' : ''}</h2>
                <p class="text-xs text-gray-600 mt-1">Tinjau pengajuan surat yang membutuhkan verifikasi Anda.</p>
                <div class="flex flex-wrap gap-2 mt-3">
                    <span class="bg-[#FFD700] text-gray-900 border border-yellow-400/50 text-[10px] font-bold px-3 py-1.5 rounded-md shadow-sm">${escapeHtml(roleLabel)}</span>
                </div>
            </div>

            ${reviewPerformanceShell(SELF_REVIEW_CARD)}

            <!-- Stats Cards -->
            ${renderDashboardStatGrid(
                    renderDashboardStatCard({ label: 'Total Antrean Masuk', value: stats.total_incoming ?? 0, tone: 'info', iconSvg: STAT_ICON_INBOX })
                    + renderDashboardStatCard({ label: 'Perlu Persetujuan Anda', value: stats.needs_verification ?? 0, tone: 'warning', iconSvg: STAT_ICON_ALERT })
                    + renderDashboardStatCard({ label: 'Selesai Bulan Ini', value: stats.finished_this_month ?? 0, tone: 'success', iconSvg: STAT_ICON_DONE }),
                )}

                            <!-- Antrean Perlu Tindakan -->
            <div class="mt-10">
                ${renderDashboardSection({
                        title: 'Antrean Perlu Dikerjakan',
                        subtitle: 'Daftar pengajuan surat yang memerlukan persetujuan Anda',
                        iconHtml: dashboardSectionIcon('attention'),
                        noteHtml: limitedTaskNote ? `<p class="text-[11px] font-medium text-amber-700 mt-2">${escapeHtml(limitedTaskNote)}</p>` : '',
                        actionHtml: `
                            <div class="relative">
                                <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input id="akademik-queue-search" type="text" placeholder="Cari nama, NIM, atau jenis surat" class="pl-9 pr-3 py-2 text-xs font-medium border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-[260px]">
                            </div>
                            ${renderDashboardLinkButton({ id: 'akademik-queue-see-more', label: 'Lihat Selengkapnya' })}`,
                        bodyHtml: renderDashboardTable({
                            columns: [
                                { label: 'Tanggal Masuk', className: 'w-[220px]' },
                                { label: 'Mahasiswa' },
                                { label: 'Jenis Surat' },
                                { label: 'Status' },
                                { label: '', className: 'w-40' },
                            ],
                            rowsHtml: tasks.map(queueRow).join(''),
                            emptyMessage: 'Belum ada pengajuan yang memerlukan persetujuan Anda saat ini.',
                            tbodyId: 'akademik-queue-tbody',
                        }),
                    })}
            </div>

            <!-- Riwayat Persetujuan (real top-5 from /api/akademik/riwayat) -->
            <div class="mt-12">
                ${renderDashboardSection({
                    title: 'Riwayat',
                    subtitle: 'Pengajuan terbaru yang telah Anda proses',
                    iconHtml: dashboardSectionIcon('history'),
                    actionHtml: renderDashboardLinkButton({ id: 'akademik-riwayat-see-more', label: 'Lihat Selengkapnya' }),
                    bodyHtml: renderDashboardTable({
                        columns: [
                            { label: 'Tanggal Tindakan' },
                            { label: 'Nomor Surat' },
                            { label: 'Mahasiswa' },
                            { label: 'Jenis Surat' },
                            { label: 'Status' },
                            { label: 'Aksi', className: 'text-right' },
                        ],
                        rowsHtml: recentRiwayat.map(riwayatRow).join(''),
                        emptyMessage: 'Belum ada riwayat persetujuan.',
                    }),
                })}
            </div>
        </div>
        `;
        renderDashboardLayout('Dashboard', content, role, 'dashboard');

        // Self-view only; failure-isolated and removed entirely when this
        // account reviews nothing.
        void hydrateReviewPerformance(SELF_REVIEW_CARD);

        bindQueueSearch();
        bindReviewButtons();
        bindRiwayatDetailButtons();
        bindSeeMoreLinks(role);

    } catch (error) {
        console.error(error);
        renderDashboardLayout('Dashboard', `
            <div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600">Gagal mengambil data dashboard akademik.</div>
        `, role, 'dashboard');
    }
};

const queueRow = (task: TendikTaskRow): string => {
    const statusTone = getLetterStatusTone(task.status, 'akademik-review');
    const statusLabel = escapeHtml(getAkademikQueueLabel(task.status));
    const studentName = escapeHtml(task.student_name || '-');
    const nim = escapeHtml(task.nim || '-');
    const submittedAt = escapeHtml(task.submitted_at || '-');
    const type = escapeHtml(task.type || '-');
    const searchKey = [task.student_name, task.nim, task.type, task.letter_type].filter(Boolean).join(' ').toLowerCase();

    return `
        <tr class="akademik-queue-row hover:bg-gray-50/50 transition-colors" data-search="${escapeHtml(searchKey)}">
            <td class="px-7 py-4 align-top">
                <p class="text-xs font-medium text-gray-500 mb-1">${submittedAt}</p>
                ${task.is_overdue ? `<p class="text-[10px] font-bold text-red-500 flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> 24 jam tertunda</p>` : ''}
            </td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs font-bold text-gray-700 mb-0.5">${studentName}</p>
                <p class="text-[10px] font-medium text-gray-400">${nim}</p>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60">
                    ${type}
                </span>
            </td>
            <td class="px-4 py-4 align-top whitespace-nowrap">
                <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold border ${statusTone}">
                    ${statusLabel}
                </span>
            </td>
            <td class="px-7 py-3 align-top text-right">
                <button class="review-btn text-xs font-bold border-2 border-[#115E59] text-[#115E59] hover:bg-[#115E59] hover:text-white transition-colors rounded-xl px-4 py-2 w-full max-w-[140px] shadow-sm" data-id="${task.id}" data-letter-type="${escapeHtml(task.letter_type || '')}">
                    Review Dokumen
                </button>
            </td>
        </tr>
    `;
};

const riwayatRow = (task: RiwayatRow): string => {
    const statusTone = getLetterStatusTone(task.status, 'tendik-history');
    const statusLabel = escapeHtml(getLetterStatusLabel(task.status, 'tendik-history') || '-');
    const actionDate = escapeHtml(task.action_at || task.submitted_at || '-');
    const studentName = escapeHtml(task.student_name || '-');
    const nim = escapeHtml(task.nim || '-');
    const type = escapeHtml(task.type || '-');
    const nomor = escapeHtml(task.nomor_surat || '-');
    const letterType = (task.letter_type ?? task.type ?? '') as string;
    const lihatDetailButton = resolveAkademikReviewRenderer(letterType)
        ? `<button class="akademik-history-detail-btn text-xs font-bold text-[#115E59] hover:underline transition-colors" data-id="${escapeHtml(String(task.id ?? ''))}" data-letter-type="${escapeHtml(letterType)}">Lihat Detail</button>`
        : '<span class="text-xs text-gray-400">-</span>';

    return `
        <tr class="hover:bg-gray-50/50 transition-colors">
            <td class="px-7 py-4 align-top text-xs font-medium text-gray-500">${actionDate}</td>
            <td class="px-4 py-4 align-top text-xs font-semibold text-gray-600">${nomor}</td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs font-bold text-gray-700">${studentName}</p>
                <p class="mt-0.5 text-[10px] font-medium text-gray-400">${nim}</p>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full border border-gray-200 bg-[#F1F5F9] px-3 py-1.5 text-[10px] font-bold text-gray-600">${type}</span>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold ${statusTone}">${statusLabel}</span>
            </td>
            <td class="px-7 py-3 text-right align-top">${lihatDetailButton}</td>
        </tr>
    `;
};

type AkademikReviewRenderer = (id: number, options: { origin: 'dashboard' }) => void;

const resolveAkademikReviewRenderer = (letterType: string): AkademikReviewRenderer | null => {
    if (isMagangLetter(letterType)) return renderReviewSuratPengantarMagangAkademik;
    if (isSuratTugasLetter(letterType)) return renderReviewSuratTugasAkademik;
    if (isAktifLetter(letterType)) return renderReviewSuratKeteranganAktifAkademik;
    if (isProsesLuarNegeriLetter(letterType)) return renderReviewProsesLuarNegeriAkademik;
    if (isLegacyBeasiswaFallback(letterType)) return renderReviewScholarshipAkademik;
    return null;
};

const bindQueueSearch = (): void => {
    const input = document.getElementById('akademik-queue-search') as HTMLInputElement | null;
    if (!input) return;
    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        document.querySelectorAll<HTMLTableRowElement>('.akademik-queue-row').forEach((row) => {
            const key = row.dataset.search || '';
            row.style.display = !query || key.includes(query) ? '' : 'none';
        });
    });
};

const bindReviewButtons = (): void => {
    document.querySelectorAll<HTMLButtonElement>('.review-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id') || '0');
            const letterType = btn.getAttribute('data-letter-type') || '';
            if (!id) return;
            const renderer = resolveAkademikReviewRenderer(letterType);
            renderer?.(id, { origin: 'dashboard' });
        });
    });
};

const bindRiwayatDetailButtons = (): void => {
    document.querySelectorAll<HTMLButtonElement>('.akademik-history-detail-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.id);
            const letterType = button.dataset.letterType || '';
            if (!Number.isFinite(id) || id <= 0) return;
            const renderer = resolveAkademikReviewRenderer(letterType);
            renderer?.(id, { origin: 'dashboard' });
        });
    });
};

const bindSeeMoreLinks = (role: string): void => {
    document.getElementById('akademik-queue-see-more')?.addEventListener('click', () => {
        import('../akademik/DokumenAkademik').then(({ renderDokumenAkademik }) => {
            renderDokumenAkademik(role);
        });
    });
    document.getElementById('akademik-riwayat-see-more')?.addEventListener('click', () => {
        import('../akademik/RiwayatAkademik').then(({ renderRiwayatAkademik }) => {
            renderRiwayatAkademik(role);
        });
    });
};
