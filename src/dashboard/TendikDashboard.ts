import { renderDashboardLayout } from './DashboardLayout';
import { escapeFormHtml } from '../shared/form-primitives';
import {
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
import { renderReviewScholarship } from '../tendik/ReviewScholarship';
import { renderReviewProsesLuarNegeri } from '../tendik/ReviewProsesLuarNegeri';
import { renderReviewSuratKeteranganAktif } from '../tendik/ReviewSuratKeteranganAktif';
import { renderReviewSuratPengantarMagang } from '../tendik/ReviewSuratPengantarMagang';
import { renderReviewSuratTugas } from '../tendik/ReviewSuratTugas';
import {
    attachDelegatedActivityDashboardCard,
    renderDelegatedActivityDashboardCard,
} from '../tendik/DelegatedActivityAcknowledgements';
import {
    getAssignedTaskLabel,
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

/** One Antrean row. Every API-supplied value is escaped. */
const queueRow = (task: any): string => `
    <tr class="hover:bg-gray-50/50 transition-colors">
        <td class="px-7 py-4 align-top">
            <p class="text-xs font-medium text-gray-500 mb-1">${escapeHtml(task.submitted_at)}</p>
            ${task.is_overdue ? `
                <p class="text-[10px] font-bold text-red-500 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    24 jam tertunda
                </p>
            ` : ''}
        </td>
        <td class="px-4 py-4 align-top">
            <p class="text-xs font-bold text-gray-700 mb-0.5">${escapeHtml(task.student_name)}</p>
            <p class="text-[10px] font-medium text-gray-400">${escapeHtml(task.nim)}</p>
        </td>
        <td class="px-4 py-4 align-top">
            <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60">
                ${escapeHtml(task.type)}
            </span>
        </td>
        <td class="px-4 py-4 align-top whitespace-nowrap">
            <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold ${task.status === 'Menunggu Verifikasi' ? 'bg-[#FEF9C3] text-[#A16207] border border-[#FDE047]' : 'bg-green-50 text-green-600 border border-green-200'}">
                ${escapeHtml(task.status)}
            </span>
        </td>
        <td class="px-7 py-3 align-top text-right">
            <button class="review-btn inline-block text-center text-[10px] font-bold border-2 border-[#115E59] text-[#115E59] hover:bg-[#115E59] hover:text-white transition-colors rounded-xl px-4 py-2 w-full max-w-[140px] shadow-sm" data-id="${escapeHtml(task.id)}" data-letter-type="${escapeHtml(task.letter_type || '')}">
                Review Dokumen
            </button>
        </td>
    </tr>
`;

type TendikReviewRenderer = (id: number, options: { origin: 'dashboard' }) => void;

const resolveTendikReviewRenderer = (letterType: string): TendikReviewRenderer | null => {
    if (isMagangLetter(letterType)) return renderReviewSuratPengantarMagang;
    if (isAktifLetter(letterType)) return renderReviewSuratKeteranganAktif;
    if (isProsesLuarNegeriLetter(letterType)) return renderReviewProsesLuarNegeri;
    if (isSuratTugasLetter(letterType)) return renderReviewSuratTugas;
    if (isLegacyBeasiswaFallback(letterType)) return renderReviewScholarship;
    return null;
};


/**
 * A reviewer's own stage — an action prompt, not a scorecard.
 *
 * Deliberately links to their queue rather than to the analytics page: reviewers
 * get something to do, SuperAdmin gets something to analyse. The endpoint scopes
 * itself from the session, so a Sarpras sees classroom bookings and a Kepala Lab
 * sees only their own laboratory, with no parameter either could change. Roles
 * that review nothing (Laboran) get `eligible:false` and the card removes itself.
 */
const SELF_REVIEW_CARD: ReviewPerformanceWidgetConfig = {
    mountId: 'tendik-review-performance',
    endpoint: '/api/tendik/review-performance/me?period=1month',
    variant: 'self',
    title: 'Pemeriksaan Anda Bulan Ini',
    subtitle: 'Ringkasan tahap pemeriksaan yang Anda tangani — bukan penilaian per orang.',
};


// Static icons for the shared dashboard stat cards.
const STAT_ICON_INBOX = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
const STAT_ICON_ALERT = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
const STAT_ICON_DONE = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';

export const renderTendikDashboard = async (role: string) => {
    // Sarpras / Kepala Lab / Laboran work in Peminjaman Ruangan and never touch
    // letters, so the letter feed below is structurally empty for them — it is
    // gated on `tendik_role === 'persuratan'`. They get their own dashboard.
    const peminjamanRole = localStorage.getItem('auth_tendik_role') ?? '';
    if (['sarpras', 'kepala_lab', 'laboran'].includes(peminjamanRole)) {
        const { renderTendikPeminjamanDashboard } = await import('./TendikPeminjamanDashboard');
        await renderTendikPeminjamanDashboard(role);
        return;
    }

    let userName = getGreetingName(localStorage.getItem('auth_name')) || 'Pengguna';

    // Initial skeleton/loading state
    renderDashboardLayout('Dashboard', `
        <div class="flex items-center justify-center min-h-[400px]">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
    `, role, 'dashboard');

    try {
        const tendikRole = localStorage.getItem('auth_tendik_role') ?? '';
        const shouldShowDelegatedActivityCard = tendikRole === 'kepala_lab';

        // Fetch dashboard tasks/stats and the live profile in parallel.
        // /api/tendik/dashboard/tasks returns only stats+tasks+scope (no user meta),
        // so we read assigned_tasks from /api/profile — the same source the Tendik
        // Profile page uses — to keep both surfaces consistent and live with
        // Super Admin penugasan changes (localStorage is only seeded at login).
        const [response, profileResponse, riwayatResponse] = await Promise.all([
            apiFetch('/api/tendik/dashboard/tasks'),
            apiFetch('/api/profile', { cache: 'no-store' }),
            apiFetch('/api/tendik/riwayat?scope=mine'),
        ]);

        if (!response.ok) throw new Error('Data dasbor belum berhasil dimuat. Coba muat ulang halaman.');

        const data = await response.json();
        const stats = data.stats;
        const tasks = data.tasks;

        let riwayat: TendikTaskRow[] = [];
        if (riwayatResponse.ok) {
            try {
                const riwayatBody = await riwayatResponse.json();
                const rows = riwayatBody?.tasks;
                riwayat = Array.isArray(rows) ? rows as TendikTaskRow[] : [];
            } catch { /* ignore */ }
        }
        const recentRiwayat = riwayat.slice(0, 5);

        // Resolve assigned_tasks from the live profile when available; fall back
        // to the login-time cache only if /api/profile itself failed.
        let assignedTasks: string[] = [];
        if (profileResponse.ok) {
            try {
                const profileData = await profileResponse.json();
                const liveTasks = profileData?.user?.assigned_tasks;
                assignedTasks = Array.isArray(liveTasks) ? liveTasks : [];
                // Keep cached copies in sync so other surfaces stay coherent.
                localStorage.setItem('auth_assigned_tasks', JSON.stringify(assignedTasks));
                const liveName = profileData?.user?.name;
                if (typeof liveName === 'string' && liveName) {
                    localStorage.setItem('auth_name', liveName);
                    userName = getGreetingName(liveName) || userName;
                }
            } catch { /* fall through to cached */ }
        } else {
            try {
                const cached = JSON.parse(localStorage.getItem('auth_assigned_tasks') || '[]');
                if (Array.isArray(cached)) assignedTasks = cached;
            } catch { /* ignore */ }
        }

        // Sarpras/Kepala Lab/Laboran work in Peminjaman Ruangan, not surat
        // verification — their greeting must not talk about "jenis surat"
        // or show empty surat-assignment chips.
        const isPeminjamanOnlyRole = ['sarpras', 'kepala_lab', 'laboran'].includes(tendikRole);
        const welcomeSubtitle = tendikRole === 'sarpras'
            ? 'Pantau dan verifikasi pengajuan peminjaman ruang kelas.'
            : tendikRole === 'kepala_lab'
                ? 'Tinjau pengajuan peminjaman laboratorium yang menjadi tanggung jawab Anda.'
                : tendikRole === 'laboran'
                    ? 'Pantau jadwal dan pengajuan laboratorium yang berada dalam cakupan Anda.'
                    : 'Tinjau dan proses dokumen administrasi surat mahasiswa.';

        const content = `
            <div class="space-y-6 animate-fade-in pb-12 w-full max-w-[1200px] mx-auto">
                <!-- Welcome Section -->
                <div class="mt-2">
                    <h2 class="text-[28px] font-bold text-gray-800 leading-tight">Halo, ${userName}!</h2>
                    <p class="text-xs text-gray-600 mt-1 mb-3">${welcomeSubtitle}</p>
                    ${isPeminjamanOnlyRole ? '' : `
                    <div class="flex flex-wrap gap-2">
                        ${assignedTasks.length > 0
                            ? assignedTasks.map((t: string) => `<span class="bg-[#FFD700] text-gray-900 border border-yellow-400/50 text-[10px] font-bold px-3 py-1.5 rounded-md shadow-sm">${getAssignedTaskLabel(t)}</span>`).join('')
                            : '<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-3 py-1.5 rounded-md">Belum ada penugasan</span>'
                        }
                    </div>
                    `}
                </div>

                ${reviewPerformanceShell(SELF_REVIEW_CARD)}

                <!-- Stats Cards -->
                ${renderDashboardStatGrid(
                    renderDashboardStatCard({ label: 'Total Surat Masuk', value: stats.total_incoming, tone: 'info', iconSvg: STAT_ICON_INBOX, extraClass: 'cursor-pointer' })
                    + renderDashboardStatCard({ label: 'Perlu Anda Verifikasi', value: stats.needs_verification, tone: 'warning', iconSvg: STAT_ICON_ALERT, extraClass: 'cursor-pointer' })
                    + renderDashboardStatCard({ label: 'Selesai Bulan Ini', value: stats.finished_this_month, tone: 'success', iconSvg: STAT_ICON_DONE, extraClass: 'cursor-pointer' }),
                )}

                                    <!-- Total Surat Masuk -->
                    <div class="bg-[#EFF6FF] border border-blue-100 p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all cursor-pointer">
                        <div>
                            <h3 class="text-[38px] font-black text-[#0EA5E9] leading-none mb-1">${stats.total_incoming}</h3>
                            <p class="text-xs font-semibold text-gray-600">Total Surat Masuk</p>
                        </div>
                        <div class="w-14 h-14 bg-blue-400/20 rounded-xl flex items-center justify-center text-blue-600">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                    </div>

                    <!-- Perlu Anda Verifikasi -->
                    <div class="bg-[#FFF8F1] border border-orange-200/60 p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all cursor-pointer">
                        <div>
                            <h3 class="text-[38px] font-black text-[#F59E0B] leading-none mb-1">${stats.needs_verification}</h3>
                            <p class="text-xs font-semibold text-gray-600">Perlu Anda Verifikasi</p>
                        </div>
                        <div class="w-14 h-14 bg-[#FEF08A]/60 rounded-xl flex items-center justify-center text-[#D97706]">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                    </div>

                    <!-- Selesai Bulan Ini -->
                    <div class="bg-[#F0FDF4] border border-green-200/60 p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all cursor-pointer">
                        <div>
                            <h3 class="text-[38px] font-black text-[#10B981] leading-none mb-1">${stats.finished_this_month}</h3>
                            <p class="text-xs font-semibold text-gray-600">Selesai Bulan Ini</p>
                        </div>
                        <div class="w-14 h-14 bg-green-300/40 rounded-xl flex items-center justify-center text-green-600">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                    </div>
                </div>

                ${shouldShowDelegatedActivityCard ? renderDelegatedActivityDashboardCard({ kind: 'loading' }) : ''}

                <!-- Antrean Perlu Tindakan Section -->
                <div class="mt-10">
                    <div class="flex justify-end mb-2">
                        <button type="button" id="see-all-dokumen" class="text-xs font-bold text-blue-500 hover:text-blue-700 transition-colors">Lihat Selengkapnya</button>
                    </div>
                    ${renderDashboardSection({
                        title: 'Antrean Perlu Dikerjakan',
                        subtitle: 'Daftar pengajuan surat yang memerlukan tindakan atau pemrosesan dari Anda',
                        iconHtml: `
                            <div class="w-6 h-6 rounded-full border border-red-500 text-red-500 flex flex-col items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="6" x2="12" y2="14"></line><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                            </div>`,
                        bodyHtml: renderDashboardTable({
                            columns: [
                                { label: 'Tanggal Masuk', className: 'w-[220px]' },
                                { label: 'Mahasiswa' },
                                { label: 'Jenis Surat' },
                                { label: 'Status' },
                                { label: '', className: 'w-40' },
                            ],
                            rowsHtml: tasks.map((task: any) => queueRow(task)).join(''),
                            emptyMessage: 'Belum ada pengajuan masuk yang ditugaskan kepada Anda.',
                        }),
                    })}
                </div>

                <!-- Riwayat Section (top-5 recent from /api/tendik/riwayat?scope=mine) -->
                <div class="mt-12">
                    ${renderDashboardSection({
                        title: 'Riwayat',
                        subtitle: 'Pengajuan terbaru yang telah Anda proses',
                        iconHtml: `
                            <div class="w-6 h-6 rounded-full border border-blue-500 text-blue-500 flex flex-col items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </div>`,
                        actionHtml: `<button id="tendik-riwayat-see-more" type="button" class="text-xs font-bold text-[#115E59] hover:text-[#0d4a46] transition-colors underline-offset-2 hover:underline">Lihat Selengkapnya</button>`,
                        bodyHtml: renderDashboardTable({
                            columns: [
                                { label: 'Tanggal Masuk' },
                                { label: 'Nomor Surat' },
                                { label: 'Mahasiswa' },
                                { label: 'Jenis Surat' },
                                { label: 'Status' },
                                { label: 'Aksi', className: 'text-right' },
                            ],
                            rowsHtml: recentRiwayat.map(tendikRiwayatRow).join(''),
                            emptyMessage: 'Belum ada riwayat pengajuan yang Anda tangani.',
                        }),
                    })}
                </div>
            </div>
        `;
        renderDashboardLayout('Dashboard', content, role, 'dashboard');

        // Self-view only; failure-isolated and removed entirely when this
        // account reviews nothing.
        void hydrateReviewPerformance(SELF_REVIEW_CARD);

        if (shouldShowDelegatedActivityCard) {
            attachDelegatedActivityDashboardCard();
        }

        // "Lihat Selengkapnya" routes to the full Dokumen page (Tugas Saya tab).
        document.getElementById('see-all-dokumen')?.addEventListener('click', () => {
            import('../tendik/DokumenTendik').then(({ renderDokumenTendik }) => {
                renderDokumenTendik(role);
            });
        });

        // Riwayat "Lihat Selengkapnya" routes to the full Tendik Riwayat page.
        document.getElementById('tendik-riwayat-see-more')?.addEventListener('click', () => {
            import('../tendik/RiwayatTendik').then(({ renderRiwayatTendik }) => {
                renderRiwayatTendik(role);
            });
        });

        // Active-queue review buttons. Pass origin: 'dashboard' so the back
        // button returns here and the sidebar stays on "Dashboard".
        document.querySelectorAll<HTMLButtonElement>('.review-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-id') || '0');
                const letterType = btn.getAttribute('data-letter-type') || '';
                if (!Number.isFinite(id) || id <= 0) return;
                const renderer = resolveTendikReviewRenderer(letterType);
                renderer?.(id, { origin: 'dashboard' });
            });
        });

        // Riwayat-section "Lihat Detail" buttons also use dashboard origin so the
        // sidebar/back stay on Dashboard for rows opened from this surface.
        document.querySelectorAll<HTMLButtonElement>('.tendik-history-detail-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id || '0');
                const letterType = btn.dataset.letterType || '';
                if (!Number.isFinite(id) || id <= 0) return;
                const renderer = resolveTendikReviewRenderer(letterType);
                renderer?.(id, { origin: 'dashboard' });
            });
        });

    } catch (error) {
        console.error(error);
        renderDashboardLayout('Dashboard', `
            <div class="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div class="text-red-500 mb-4">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <h3 class="text-lg font-bold text-gray-800">Gagal Memuat Data</h3>
                <p class="text-sm text-gray-500 mt-1">Terjadi kesalahan saat memproses data dashboard.</p>
                <button onclick="window.location.reload()" class="mt-4 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold">Coba Lagi</button>
            </div>
        `, role, 'dashboard');
    }
};

const tendikRiwayatRow = (task: TendikTaskRow): string => {
    const statusTone = getLetterStatusTone(task.status, 'tendik-history');
    const statusLabel = escapeHtml(getLetterStatusLabel(task.status, 'tendik-history') || '-');
    const submittedAt = escapeHtml(task.submitted_at || '-');
    const studentName = escapeHtml(task.student_name || '-');
    const nim = escapeHtml(task.nim || '-');
    const letterType = (task.letter_type ?? task.type ?? '') as string;
    const typeLabel = escapeHtml(getAssignedTaskLabel(letterType) || task.type || 'Surat Administrasi');
    const nomor = escapeHtml(task.nomor_surat || '-');
    const detailButton = resolveTendikReviewRenderer(letterType)
        ? `<button class="tendik-history-detail-btn text-xs font-bold text-[#115E59] hover:underline transition-colors" data-id="${escapeHtml(String(task.id ?? ''))}" data-letter-type="${escapeHtml(letterType)}">Lihat Detail</button>`
        : '<span class="text-xs text-gray-400">-</span>';

    return `
        <tr class="hover:bg-gray-50/50 transition-colors">
            <td class="px-7 py-4 align-top text-xs font-medium text-gray-500">${submittedAt}</td>
            <td class="px-4 py-4 align-top text-xs font-semibold text-gray-600">${nomor}</td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs font-bold text-gray-700">${studentName}</p>
                <p class="mt-0.5 text-[10px] font-medium text-gray-400">${nim}</p>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full border border-gray-200 bg-[#F1F5F9] px-3 py-1.5 text-[10px] font-bold text-gray-600">${typeLabel}</span>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold ${statusTone}">${statusLabel}</span>
            </td>
            <td class="px-7 py-3 text-right align-top">${detailButton}</td>
        </tr>
    `;
};
