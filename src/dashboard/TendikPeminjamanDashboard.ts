import { renderDashboardLayout } from './DashboardLayout';
import { apiFetch } from '../shared/api-client';
import { getGreetingName } from '../utils/nameHelper';
import { badgeClass, buttonClass, cx, textClass } from '../shared/design-system';
import { escapeFormAttribute, escapeFormHtml } from '../shared/form-primitives';
import {
    renderDashboardSection,
    renderDashboardStatCard,
    renderDashboardStatGrid,
    renderDashboardTable,
    renderErrorState,
} from '../shared/ui-primitives';
import {
    hydrateReviewPerformance,
    reviewPerformanceShell,
    type ReviewPerformanceWidgetConfig,
} from '../shared/review-performance-widget';
import {
    attachDelegatedActivityDashboardCard,
    renderDelegatedActivityDashboardCard,
} from '../tendik/DelegatedActivityAcknowledgements';

/**
 * Dashboard for the three room-booking roles — Sarpras, Kepala Lab, Laboran.
 *
 * They previously shared the Persuratan letter dashboard, whose stat cards are
 * fed by an endpoint gated on `tendik_role === 'persuratan'`. The result was a
 * permanent 0/0/0 and an empty queue insisting nothing was assigned to them,
 * while their Peminjaman page listed real bookings. This surface reads the
 * booking feed instead.
 *
 * The three roles do genuinely different work, and the backend enforces it:
 * Sarpras approves classrooms and runs their keys; Kepala Lab approves its own
 * lab but touches no keys at all; Laboran runs its lab's keys and approves
 * nothing. The server decides which rows are work and which are merely visible —
 * this file only renders `can_act`, never re-derives it.
 */

interface DashboardRow {
    kind: string;
    kind_label: string;
    booking_id: number;
    occurrence_ref: string | null;
    title: string;
    requester_name: string | null;
    room_label: string;
    schedule_label: string;
    status_label: string;
    status_tone: string;
    waiting_label: string | null;
    is_overdue: boolean;
    can_act: boolean;
    action_label: string | null;
    responsible_label: string | null;
}

interface TodayRow {
    room_label: string;
    title: string;
    requester_name: string | null;
    time_label: string;
    status_label: string;
}

interface HistoryRow {
    acted_at_label: string;
    action_label: string;
    status_tone: string;
    title: string;
    room_label: string;
}

interface DashboardPayload {
    role: string;
    role_label: string;
    scope_label: string;
    stats: { actionable: number; overdue: number; finished_this_month: number };
    actionable: DashboardRow[];
    awareness: DashboardRow[];
    today: TodayRow[];
    history: HistoryRow[];
}

const SELF_REVIEW_CARD: ReviewPerformanceWidgetConfig = {
    mountId: 'tendik-review-performance',
    endpoint: '/api/tendik/review-performance/me?period=1month',
    variant: 'self',
    title: 'Pemeriksaan Anda Bulan Ini',
    subtitle: 'Ringkasan tahap pemeriksaan yang Anda tangani — bukan penilaian per orang.',
};

const STAT_ICON_INBOX = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>';
const STAT_ICON_ALERT = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
const STAT_ICON_DONE = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';

const SUBTITLES: Record<string, string> = {
    sarpras: 'Pantau dan verifikasi pengajuan peminjaman ruang kelas.',
    kepala_lab: 'Tinjau pengajuan peminjaman laboratorium yang menjadi tanggung jawab Anda.',
    laboran: 'Kelola serah terima kunci dan pengembalian di laboratorium Anda.',
};

const TONE_PILL: Record<string, string> = {
    info: 'bg-blue-50 text-blue-700 border-blue-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    neutral: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const renderTendikPeminjamanDashboard = async (role: string): Promise<void> => {
    const tendikRole = localStorage.getItem('auth_tendik_role') ?? '';
    const userName = getGreetingName(localStorage.getItem('auth_name'));

    renderDashboardLayout(
        'Dashboard',
        '<div id="peminjaman-dashboard-wrapper"><div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div></div></div>',
        role,
        'dashboard',
    );

    let data: DashboardPayload;
    try {
        const response = await apiFetch('/api/tendik/peminjaman-ruangan/dashboard', { cache: 'no-store' });
        if (!response.ok) throw new Error('Data dasbor peminjaman gagal dimuat.');
        const body = await response.json();
        data = body?.data;
        if (!data) throw new Error('Data dasbor peminjaman tidak lengkap.');
    } catch (error) {
        renderDashboardLayout(
            'Dashboard',
            renderErrorState(error instanceof Error ? error.message : 'Terjadi kesalahan.'),
            role,
            'dashboard',
        );
        return;
    }

    const showDelegatedCard = tendikRole === 'kepala_lab';

    const content = `
        <div class="space-y-6 animate-fade-in pb-12 w-full max-w-[1200px] mx-auto">
            <div class="mt-2">
                <h2 class="text-[28px] font-bold text-gray-800 leading-tight">Halo, ${escapeFormHtml(userName)}!</h2>
                <p class="text-xs text-gray-600 mt-1 mb-3">${escapeFormHtml(SUBTITLES[tendikRole] ?? 'Kelola peminjaman ruangan yang menjadi tanggung jawab Anda.')}</p>
                <span class="${badgeClass('primary')}">${escapeFormHtml(data.scope_label)}</span>
            </div>

            ${reviewPerformanceShell(SELF_REVIEW_CARD)}

            ${showDelegatedCard ? renderDelegatedActivityDashboardCard({ kind: 'loading' }) : ''}

            ${renderDashboardStatGrid(
                renderDashboardStatCard({ label: 'Perlu Dikerjakan', value: data.stats.actionable, tone: 'info', iconSvg: STAT_ICON_INBOX })
                + renderDashboardStatCard({ label: 'Melewati Batas Waktu', value: data.stats.overdue, tone: 'warning', iconSvg: STAT_ICON_ALERT })
                + renderDashboardStatCard({ label: 'Selesai Bulan Ini', value: data.stats.finished_this_month, tone: 'success', iconSvg: STAT_ICON_DONE }),
            )}

            <div class="mt-10">${queueSection(data)}</div>
            <div class="mt-8">${todaySection(data)}</div>
            <div class="mt-8">${historySection(data)}</div>
            ${data.awareness.length > 0 || tendikRole === 'kepala_lab' ? `<div class="mt-8">${awarenessSection(data)}</div>` : ''}
        </div>
    `;

    renderDashboardLayout('Dashboard', content, role, 'dashboard');

    void hydrateReviewPerformance(SELF_REVIEW_CARD);
    if (showDelegatedCard) attachDelegatedActivityDashboardCard();
    bindRowActions(role);
};

// ── sections ────────────────────────────────────────────────────────────────

function queueSection(data: DashboardPayload): string {
    return renderDashboardSection({
        title: 'Antrean Perlu Dikerjakan',
        subtitle: 'Pengajuan dan tugas peminjaman yang menunggu tindakan Anda',
        iconHtml: `
            <div class="w-6 h-6 rounded-full border border-red-500 text-red-500 flex flex-col items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="6" x2="12" y2="14"></line><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
            </div>`,
        actionHtml: seeMoreButton('queue'),
        bodyHtml: renderDashboardTable({
            columns: [
                { label: 'Kegiatan / Pemohon' },
                { label: 'Ruangan' },
                { label: 'Jadwal' },
                { label: 'Status' },
                { label: '', className: 'w-44' },
            ],
            rowsHtml: data.actionable.map((row) => queueRow(row, true)).join(''),
            emptyMessage: 'Tidak ada yang perlu dikerjakan saat ini.',
        }),
    });
}

/**
 * Kepala Lab only. Deliberately below Riwayat, on a muted surface, with no
 * buttons and the responsible party named on every row — because the backend
 * will not let a Kepala Lab issue a key or verify a return. Styling this like
 * the queue above would tell them they are accountable for something they
 * cannot do, and then leave them hunting for a control that does not exist.
 */
function awarenessSection(data: DashboardPayload): string {
    return renderDashboardSection({
        title: 'Kondisi Operasional Lab',
        subtitle: 'Pantauan kunci dan pengembalian di lab Anda. Tindakan dilakukan oleh Laboran.',
        tone: 'muted',
        bodyHtml: renderDashboardTable({
            columns: [
                { label: 'Kegiatan / Pemohon' },
                { label: 'Ruangan' },
                { label: 'Jadwal' },
                { label: 'Status' },
                { label: 'Penanggung Jawab', className: 'w-44' },
            ],
            rowsHtml: data.awareness.map((row) => queueRow(row, false)).join(''),
            emptyMessage: 'Tidak ada aktivitas kunci atau pengembalian di lab Anda saat ini.',
        }),
    });
}

function todaySection(data: DashboardPayload): string {
    return renderDashboardSection({
        title: 'Hari Ini',
        subtitle: 'Ruangan yang terpakai hari ini beserta statusnya',
        actionHtml: seeMoreButton('calendar'),
        bodyHtml: renderDashboardTable({
            columns: [
                { label: 'Ruangan' },
                { label: 'Kegiatan / Pemohon' },
                { label: 'Waktu' },
                { label: 'Status' },
            ],
            rowsHtml: data.today.map((row) => `
                <tr class="hover:bg-gray-50/50 transition-colors">
                    <td class="px-7 py-4 text-xs font-bold text-gray-700">${escapeFormHtml(row.room_label)}</td>
                    <td class="px-4 py-4">
                        <p class="text-xs font-semibold text-gray-700">${escapeFormHtml(row.title)}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5">${escapeFormHtml(row.requester_name ?? '-')}</p>
                    </td>
                    <td class="px-4 py-4 text-xs text-gray-600 whitespace-nowrap">${escapeFormHtml(row.time_label)}</td>
                    <td class="px-7 py-4">${statusPill(row.status_label, 'neutral')}</td>
                </tr>
            `).join(''),
            emptyMessage: 'Tidak ada ruangan yang terpakai hari ini.',
        }),
    });
}

function historySection(data: DashboardPayload): string {
    return renderDashboardSection({
        title: 'Riwayat',
        subtitle: 'Tindakan terbaru yang telah Anda lakukan',
        iconHtml: `
            <div class="w-6 h-6 rounded-full border border-blue-500 text-blue-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>`,
        actionHtml: seeMoreButton('queue'),
        bodyHtml: renderDashboardTable({
            columns: [
                { label: 'Tanggal Tindakan' },
                { label: 'Kegiatan' },
                { label: 'Ruangan' },
                { label: 'Tindakan' },
            ],
            rowsHtml: data.history.map((row) => `
                <tr class="hover:bg-gray-50/50 transition-colors">
                    <td class="px-7 py-4 text-xs font-medium text-gray-500 whitespace-nowrap">${escapeFormHtml(row.acted_at_label)}</td>
                    <td class="px-4 py-4 text-xs font-semibold text-gray-700">${escapeFormHtml(row.title)}</td>
                    <td class="px-4 py-4 text-xs text-gray-600">${escapeFormHtml(row.room_label)}</td>
                    <td class="px-7 py-4">${statusPill(row.action_label, row.status_tone)}</td>
                </tr>
            `).join(''),
            emptyMessage: 'Belum ada tindakan yang Anda lakukan.',
        }),
    });
}

// ── row helpers ─────────────────────────────────────────────────────────────

function queueRow(row: DashboardRow, actionable: boolean): string {
    // The last cell is the whole difference between work and awareness: a button
    // when the backend says this user may act, the responsible party's name when
    // it does not.
    const tail = actionable && row.can_act
        ? `<button type="button" class="peminjaman-row-action ${buttonClass('secondary', 'sm')}"
               data-kind="${escapeFormAttribute(row.kind)}"
               data-booking-id="${escapeFormAttribute(String(row.booking_id))}">${escapeFormHtml(row.action_label ?? 'Lihat Detail')}</button>`
        : `<span class="${textClass.helper}">${escapeFormHtml(row.responsible_label ?? '-')}</span>`;

    return `
        <tr class="hover:bg-gray-50/50 transition-colors">
            <td class="px-7 py-4 align-top">
                <p class="text-xs font-bold text-gray-700 mb-0.5">${escapeFormHtml(row.title)}</p>
                <p class="text-[10px] font-medium text-gray-400">${escapeFormHtml(row.requester_name ?? '-')}</p>
                <span class="${badgeClass('neutral', 'mt-1.5 text-[9px] px-2 py-0.5')}">${escapeFormHtml(row.kind_label)}</span>
            </td>
            <td class="px-4 py-4 align-top text-xs text-gray-600">${escapeFormHtml(row.room_label)}</td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs text-gray-600 whitespace-nowrap">${escapeFormHtml(row.schedule_label)}</p>
                ${row.waiting_label ? `<p class="${cx('text-[10px] mt-1', row.is_overdue ? 'font-bold text-red-500' : 'text-gray-400')}">${escapeFormHtml(row.waiting_label)}</p>` : ''}
            </td>
            <td class="px-4 py-4 align-top">${statusPill(row.status_label, row.status_tone)}</td>
            <td class="px-7 py-4 align-top text-right">${tail}</td>
        </tr>
    `;
}

function statusPill(label: string, tone: string): string {
    const classes = TONE_PILL[tone] ?? TONE_PILL.neutral;

    return `<span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold border ${classes}">${escapeFormHtml(label)}</span>`;
}

function seeMoreButton(tab: string): string {
    return `<button type="button" class="peminjaman-see-more text-xs font-bold text-[#115E59] hover:text-[#0d4a46] transition-colors underline-offset-2 hover:underline" data-tab="${escapeFormAttribute(tab)}">Lihat Selengkapnya</button>`;
}

// ── behaviour ───────────────────────────────────────────────────────────────

function bindRowActions(role: string): void {
    // Both the row actions and "Lihat Selengkapnya" go to Peminjaman Ruangan —
    // never to the letter pages the old shared dashboard linked to.
    const open = (tab: string): void => {
        void import('../tendik/PeminjamanRuanganTendik').then(({ renderPeminjamanRuanganTendik }) => {
            renderPeminjamanRuanganTendik(role, tab === 'queue' ? undefined : (tab as 'operations'));
        });
    };

    document.querySelectorAll<HTMLElement>('.peminjaman-row-action').forEach((button) => {
        button.addEventListener('click', () => {
            open(button.dataset.kind === 'approval' ? 'queue' : 'operations');
        });
    });

    document.querySelectorAll<HTMLElement>('.peminjaman-see-more').forEach((button) => {
        button.addEventListener('click', () => open(button.dataset.tab ?? 'queue'));
    });
}
