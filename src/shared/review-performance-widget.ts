import { apiFetch } from './api-client';
import { buttonClass, cx, textClass, type UiTone } from './design-system';
import { escapeFormHtml } from './form-primitives';
import { renderDashboardSection, renderMetricCard, renderStatusBadge } from './ui-primitives';

/**
 * "Monitoring Kinerja" — one self-hydrating panel serving TWO audiences from
 * the same code, modelled on the existing notification-widget precedent.
 *
 *   variant 'summary' — SuperAdmin: every stage of both domains, for analysis.
 *   variant 'self'    — a reviewer: their own stage only, for action.
 *
 * Wording is NOT built here. Every label, status phrase and caveat arrives from
 * the backend already written, so the governance page and a Kaprodi's own card
 * read literally the same sentences about the same stage. That matters: if the
 * dashboard called a stage "melebihi batas waktu" while the reviewer's card said
 * something softer, the softer one would be read as a cover-up.
 *
 * Design rules this file enforces:
 *  - The median is the headline; the mean is a sub-line. A single file abandoned
 *    over a semester break must not make a whole unit look negligent.
 *  - An estimate is always visibly badged and never shown as a precise figure.
 *  - "00 Hari 00 Jam 00 Menit" is unrepresentable — no measurement means no
 *    number, because a zeroed clock reads as "approved instantly".
 *  - Nothing is coloured against a deadline that SuperAdmin has not switched on.
 */

export type ReviewMetricSource = 'dynamic' | 'fallback' | 'none';

export type ReviewMetricStatus = 'within' | 'approaching' | 'beyond' | 'unknown' | 'unrated';

export interface ReviewMetric {
    source: ReviewMetricSource;
    count: number;
    revision_count: number;
    median_seconds: number | null;
    median_label: string | null;
    average_label: string | null;
    p90_label: string | null;
    estimate_label: string | null;
    sample_note: string | null;
    status: ReviewMetricStatus;
    status_label: string;
}

export interface ReviewWaitingNow {
    count: number;
    over_overdue_count: number;
    action_label?: string;
}

export interface ReviewStagePayload {
    stage: string;
    stage_label: string;
    unit_dimension: string;
    metric: ReviewMetric;
    comparison: { direction: string; label: string } | null;
    waiting_now: ReviewWaitingNow;
}

export interface ReviewScopePayload {
    scope: string;
    scope_label: string;
    sla: { enabled: boolean; warning_label: string; overdue_label: string };
    stages: ReviewStagePayload[];
}

export interface ReviewSummaryPayload {
    period: { key: string; label: string };
    basis: { measures: string; excludes: string; min_sample: number };
    scopes: ReviewScopePayload[];
}

export interface ReviewSelfPayload {
    eligible: boolean;
    reason_label?: string;
    scope_label?: string;
    stage_label?: string;
    unit_label?: string;
    period?: { label: string };
    metric?: ReviewMetric;
    comparison?: { direction: string; label: string } | null;
    waiting_now?: ReviewWaitingNow;
    note?: string;
}

export interface ReviewPerformanceWidgetConfig {
    mountId: string;
    endpoint: string;
    variant: 'summary' | 'self';
    title: string;
    subtitle: string;
    /** Optional deep link rendered as the panel's footer action. */
    action?: { label: string; onClick: () => void };
}

type WidgetState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'summary'; data: ReviewSummaryPayload }
    | { phase: 'self'; data: ReviewSelfPayload };

/** Status tone. `unrated` and `unknown` are deliberately neutral. */
const STATUS_TONE: Record<ReviewMetricStatus, UiTone> = {
    within: 'success',
    approaching: 'warning',
    beyond: 'danger',
    unknown: 'neutral',
    unrated: 'neutral',
};

export function reviewPerformanceShell(config: ReviewPerformanceWidgetConfig): string {
    return `<section id="${escapeFormHtml(config.mountId)}" aria-labelledby="${escapeFormHtml(config.mountId)}-title">${
        cardMarkup(config, { phase: 'loading' })
    }</section>`;
}

/**
 * Fetch and paint. Failure-isolated: any fault renders inside the panel with a
 * retry and never throws to the host dashboard.
 *
 * Intentionally NOT part of any auto-refresh loop. Review speed is not a
 * real-time figure, and re-rendering it every 30 seconds makes the numbers
 * flicker for no informational gain.
 */
export async function hydrateReviewPerformance(config: ReviewPerformanceWidgetConfig): Promise<void> {
    const paint = (state: WidgetState): void => {
        const mount = document.getElementById(config.mountId);
        if (!mount) return;

        // A reviewer with no reviewing role gets no empty shell and no error —
        // the card simply is not part of their dashboard.
        if (state.phase === 'self' && !state.data.eligible) {
            mount.remove();
            return;
        }

        mount.innerHTML = cardMarkup(config, state);
        bind(config, state);
    };

    paint({ phase: 'loading' });
    try {
        const response = await apiFetch(config.endpoint, { cache: 'no-store' });
        if (!response.ok) throw new Error('Gagal memuat ringkasan pemeriksaan.');
        const body = await response.json();
        const data = body?.data;
        if (!data) throw new Error('Data ringkasan tidak lengkap.');

        paint(config.variant === 'self'
            ? { phase: 'self', data: data as ReviewSelfPayload }
            : { phase: 'summary', data: data as ReviewSummaryPayload });
    } catch (error) {
        paint({ phase: 'error', message: error instanceof Error ? error.message : 'Terjadi kesalahan.' });
    }
}

// ── rendering ───────────────────────────────────────────────────────────────

function cardMarkup(config: ReviewPerformanceWidgetConfig, state: WidgetState): string {
    // Rendered through the shared dashboard section so this card sits in the same
    // visual system as the stat cards and queue tables around it — it previously
    // carried its own surface and visibly clashed with them.
    return renderDashboardSection({
        title: config.title,
        titleId: `${config.mountId}-title`,
        subtitle: config.subtitle,
        bodyHtml: `
            <p id="${escapeFormHtml(config.mountId)}-status" role="status" aria-live="polite" class="sr-only"></p>
            <div id="${escapeFormHtml(config.mountId)}-body">${bodyMarkup(config, state)}</div>
        `,
    });
}

function bodyMarkup(config: ReviewPerformanceWidgetConfig, state: WidgetState): string {
    if (state.phase === 'loading') {
        return '<div class="px-5 py-10 text-center text-sm font-semibold text-gray-400">Memuat…</div>';
    }
    if (state.phase === 'error') {
        return `
            <div role="alert" class="px-5 py-8 text-center">
                <p class="text-sm font-bold text-red-700">Gagal memuat</p>
                <p class="mt-1 text-xs text-red-600">${escapeFormHtml(state.message)}</p>
                <button id="${escapeFormHtml(config.mountId)}-retry" type="button" class="${buttonClass('primary', 'sm', 'mt-4')}">Coba Lagi</button>
            </div>
        `;
    }

    return state.phase === 'summary'
        ? summaryBody(config, state.data)
        : selfBody(config, state.data);
}

function summaryBody(config: ReviewPerformanceWidgetConfig, data: ReviewSummaryPayload): string {
    const sections = data.scopes.map((scope) => `
        <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs font-bold uppercase tracking-wide text-gray-500">${escapeFormHtml(scope.scope_label)}</p>
                ${scope.sla.enabled
                    ? `<span class="${textClass.helper}">Batas waktu ${escapeFormHtml(scope.sla.overdue_label)}</span>`
                    : `<span class="${textClass.helper}">Batas waktu belum diaktifkan</span>`}
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                ${scope.stages.map(stageTile).join('')}
            </div>
        </div>
    `).join('');

    return `
        <div class="space-y-6 px-5 py-5">
            ${sections}
            ${footnote(data.basis.excludes)}
            ${config.action ? `<button id="${escapeFormHtml(config.mountId)}-action" type="button" class="${buttonClass('secondary', 'sm', 'w-full')}">${escapeFormHtml(config.action.label)}</button>` : ''}
        </div>
    `;
}

/**
 * One stage tile. The value slot shows a measured median, or a badged estimate
 * range, or an honest empty line — never a zero.
 */
function stageTile(stage: ReviewStagePayload): string {
    const { metric } = stage;
    const value = metric.median_label ?? metric.estimate_label ?? 'Belum ada data';
    const detail = metric.sample_note
        ?? (metric.average_label ? `Rata-rata ${metric.average_label} · ${metric.count} pengajuan` : `${metric.count} pengajuan`);

    const badges = [
        metric.source === 'fallback' ? renderStatusBadge('warning', 'Estimasi') : '',
        metric.status === 'unrated' ? '' : renderStatusBadge(STATUS_TONE[metric.status], metric.status_label),
    ].filter(Boolean).join(' ');

    const extras = `
        <div class="mt-3 space-y-1">
            ${badges ? `<div class="flex flex-wrap gap-1.5">${badges}</div>` : ''}
            ${stage.comparison ? `<p class="${textClass.helper}">${escapeFormHtml(stage.comparison.label)}</p>` : ''}
            ${waitingLine(stage.waiting_now)}
        </div>
    `;

    return renderMetricCard(stage.stage_label, value, detail, extras);
}

/**
 * The actionable half. Phrased as a fact about the queue, never as an accusation
 * — "3 pengajuan menunggu lebih dari batas waktu" is something a person can go and
 * fix; "Anda terlambat" is not.
 */
function waitingLine(waiting: ReviewWaitingNow | undefined): string {
    if (!waiting || waiting.count === 0) return '';
    const overdue = waiting.over_overdue_count > 0
        ? ` · <span class="font-bold text-amber-700">${waiting.over_overdue_count} melewati batas waktu</span>`
        : '';

    return `<p class="${textClass.helper}">${waiting.count} pengajuan menunggu sekarang${overdue}</p>`;
}

function selfBody(config: ReviewPerformanceWidgetConfig, data: ReviewSelfPayload): string {
    const metric = data.metric;
    if (!metric) {
        return '<div class="px-5 py-8 text-center text-sm text-gray-500">Belum ada ringkasan untuk tahap ini.</div>';
    }

    const value = metric.median_label ?? metric.estimate_label ?? 'Belum ada data';
    const estimate = metric.source === 'fallback' ? renderStatusBadge('warning', 'Estimasi') : '';

    return `
        <div class="space-y-4 px-5 py-5">
            <div>
                <p class="text-xs font-bold uppercase tracking-wide text-gray-500">Waktu pemeriksaan ${escapeFormHtml(data.period?.label ?? '')}</p>
                <p class="mt-1 flex flex-wrap items-center gap-2 text-3xl font-bold text-gray-900">
                    ${escapeFormHtml(value)}${estimate}
                </p>
                <p class="${cx(textClass.helper, 'mt-1')}">${escapeFormHtml(metric.sample_note ?? `${metric.count} pengajuan selesai di periode ini`)}</p>
            </div>
            ${data.comparison ? `<p class="text-sm font-semibold text-teal-800">${escapeFormHtml(data.comparison.label)}</p>` : ''}
            ${selfQueueBlock(config, data.waiting_now)}
            <p class="${textClass.helper}">${escapeFormHtml(data.note ?? '')}</p>
        </div>
    `;
}

function selfQueueBlock(config: ReviewPerformanceWidgetConfig, waiting: ReviewWaitingNow | undefined): string {
    if (!waiting) return '';

    const overdue = waiting.over_overdue_count;
    const message = overdue > 0
        ? `Ada ${overdue} pengajuan yang menunggu melebihi batas waktu.`
        : waiting.count > 0
            ? `${waiting.count} pengajuan menunggu pemeriksaan Anda.`
            : 'Tidak ada pengajuan yang menunggu saat ini.';

    const tone = overdue > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50/60';
    const action = config.action
        ? `<button id="${escapeFormHtml(config.mountId)}-action" type="button" class="${buttonClass('secondary', 'sm', 'mt-3 w-full')}">${escapeFormHtml(waiting.action_label ?? config.action.label)}</button>`
        : '';

    return `
        <div class="rounded-xl border px-4 py-3 ${tone}">
            <p class="text-sm font-semibold text-gray-800">${escapeFormHtml(message)}</p>
            ${action}
        </div>
    `;
}

/**
 * The single most important sentence on any of these surfaces: it tells a
 * reviewer the number does not blame them for an applicant's delay.
 */
function footnote(excludes: string): string {
    return `
        <p class="${cx(textClass.helper, 'border-t border-gray-100 pt-4')}">
            ${escapeFormHtml(excludes)} Angka ini menggambarkan tahap, bukan penilaian individu.
        </p>
    `;
}

// ── behaviour ───────────────────────────────────────────────────────────────

function bind(config: ReviewPerformanceWidgetConfig, state: WidgetState): void {
    if (state.phase === 'error') {
        document.getElementById(`${config.mountId}-retry`)
            ?.addEventListener('click', () => void hydrateReviewPerformance(config));
        return;
    }

    if (config.action) {
        document.getElementById(`${config.mountId}-action`)
            ?.addEventListener('click', () => config.action?.onClick());
    }

    announce(config, state);
}

function announce(config: ReviewPerformanceWidgetConfig, state: WidgetState): void {
    const status = document.getElementById(`${config.mountId}-status`);
    if (!status) return;

    if (state.phase === 'summary') {
        const stages = state.data.scopes.reduce((total, scope) => total + scope.stages.length, 0);
        status.textContent = `${config.title}: ${stages} tahap pemeriksaan, periode ${state.data.period.label}.`;
    } else if (state.phase === 'self' && state.data.metric) {
        status.textContent = `${config.title}: ${state.data.metric.median_label ?? state.data.metric.estimate_label ?? 'belum ada data'}.`;
    }
}
