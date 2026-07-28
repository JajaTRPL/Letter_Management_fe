import { escapeFormAttribute, escapeFormHtml } from './form-primitives';
import {
    badgeClass,
    cx,
    SPINNER_CLASS,
    surfaceClass,
    textClass,
    type UiTone,
} from './design-system';

/**
 * Tiny semantic rendering helpers (CP7A) built on the design-system tokens.
 * Stateless string builders only — no DOM lifecycle, no fetching, no domain
 * knowledge. All caller-supplied text is HTML-escaped.
 */

export function renderStatusBadge(tone: UiTone, label: string, extra?: string): string {
    return `<span class="${badgeClass(tone, extra)}">${escapeFormHtml(label)}</span>`;
}

export function renderLoadingState(message = 'Memuat data...'): string {
    return `
        <div class="${surfaceClass('card', 'p-10')} flex items-center gap-4">
            <div class="${SPINNER_CLASS} w-9 h-9"></div>
            <p class="text-sm font-semibold text-gray-600">${escapeFormHtml(message)}</p>
        </div>
    `;
}

export function renderErrorState(message = 'Gagal memuat data. Silakan coba lagi.'): string {
    return `
        <div role="alert" class="${cx(surfaceClass('card'), 'border-red-200 bg-red-50 text-red-800 px-5 py-4')} text-sm font-semibold">
            ${escapeFormHtml(message)}
        </div>
    `;
}

export function renderEmptyState(message: string, extra?: string): string {
    return `<div class="${cx('px-6 py-10 text-center text-sm font-medium text-gray-500', extra)}">${escapeFormHtml(message)}</div>`;
}

export function renderFieldMessage(id: string, error?: string): string {
    return `
        <p id="${escapeFormHtml(id)}" class="${textClass.error} mt-2 ${error ? '' : 'hidden'}" role="alert" aria-live="polite">
            ${escapeFormHtml(error ?? '')}
        </p>
    `;
}

// ── Dashboard chrome ────────────────────────────────────────────────────────
// Every role dashboard is built from these three pieces so the product reads as
// ONE system. The markup is the Akademik dashboard verbatim — it was already the
// reference design; the others had each drifted into their own hand-rolled
// Tailwind, which is why borders, radii and shadows visibly disagreed on the
// same screen. Add a new dashboard by composing these, never by copying markup.

export type DashboardStatTone = 'info' | 'warning' | 'success';

const DASHBOARD_STAT_TONE: Record<DashboardStatTone, { card: string; value: string; icon: string }> = {
    info: { card: 'bg-[#EFF6FF] border-blue-100', value: 'text-[#0EA5E9]', icon: 'bg-blue-400/20 text-blue-600' },
    warning: { card: 'bg-[#FFF8F1] border-orange-200/60', value: 'text-[#F59E0B]', icon: 'bg-[#FEF08A]/60 text-[#D97706]' },
    success: { card: 'bg-[#F0FDF4] border-green-200/60', value: 'text-[#10B981]', icon: 'bg-green-300/40 text-green-600' },
};

/**
 * The headline number tile. `iconSvg` is trusted inline markup (a static icon),
 * everything else is escaped.
 */
export function renderDashboardStatCard(options: {
    label: string;
    value: string | number;
    tone: DashboardStatTone;
    iconSvg: string;
    extraClass?: string;
}): string {
    const tone = DASHBOARD_STAT_TONE[options.tone];

    return `
        <div class="${cx(tone.card, 'border p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all', options.extraClass)}">
            <div>
                <h3 class="text-[38px] font-black ${tone.value} leading-none mb-1">${escapeFormHtml(String(options.value))}</h3>
                <p class="text-xs font-semibold text-gray-600">${escapeFormHtml(options.label)}</p>
            </div>
            <div class="w-14 h-14 ${tone.icon} rounded-xl flex items-center justify-center">${options.iconSvg}</div>
        </div>
    `;
}

/** Wrap stat cards so every dashboard uses the same grid rhythm. */
export function renderDashboardStatGrid(cardsHtml: string): string {
    return `<div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">${cardsHtml}</div>`;
}

/**
 * The section shell used by every dashboard panel (queue, history, awareness).
 *
 * `tone: 'muted'` renders a recessed surface — reserved for panels that are
 * INFORMATION rather than assigned work. That distinction is load-bearing: a
 * read-only panel styled like an actionable one reads as "your task", and the
 * user then looks for a button that will never exist.
 */
export function renderDashboardSection(options: {
    title: string;
    /** Set when a wrapper references the heading via aria-labelledby. */
    titleId?: string;
    subtitle?: string;
    /** Trusted inline markup for the small icon left of the title. */
    iconHtml?: string;
    /** Trusted caller-built markup (search box, "Lihat Selengkapnya"). */
    actionHtml?: string;
    /** Extra line under the subtitle, e.g. a "showing N of M" note. */
    noteHtml?: string;
    /** Trusted caller-built body (usually renderDashboardTable). */
    bodyHtml: string;
    tone?: 'default' | 'muted';
    extraClass?: string;
}): string {
    const muted = options.tone === 'muted';

    return `
        <div class="${cx(
            muted ? 'bg-gray-50/70 border-gray-200' : 'bg-white border-gray-100',
            'rounded-2xl border shadow-sm overflow-hidden',
            options.extraClass,
        )}">
            <div class="px-7 py-5 border-b ${muted ? 'border-gray-200' : 'border-gray-100'} flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="flex gap-3">
                    ${options.iconHtml ?? ''}
                    <div>
                        <h2${options.titleId ? ` id="${escapeFormAttribute(options.titleId)}"` : ''} class="text-[17px] font-bold text-gray-800">${escapeFormHtml(options.title)}</h2>
                        ${options.subtitle ? `<p class="text-[11px] text-gray-500 mt-1">${escapeFormHtml(options.subtitle)}</p>` : ''}
                        ${options.noteHtml ?? ''}
                    </div>
                </div>
                ${options.actionHtml ? `<div class="flex items-center gap-3">${options.actionHtml}</div>` : ''}
            </div>
            ${options.bodyHtml}
        </div>
    `;
}

export interface DashboardTableColumn {
    label: string;
    /** Optional width/alignment utilities, e.g. 'w-[220px]' or 'text-right'. */
    className?: string;
}

/**
 * Header + body + honest empty state. The empty message spans every column so a
 * dashboard with nothing in it still reads as a table, not as a broken one.
 */
export function renderDashboardTable(options: {
    columns: readonly DashboardTableColumn[];
    /** Trusted caller-built <tr> markup. */
    rowsHtml: string;
    emptyMessage: string;
    tbodyId?: string;
}): string {
    const headers = options.columns.map((column, index) => {
        const edge = index === 0 || index === options.columns.length - 1 ? 'px-7' : 'px-4';

        return `<th class="${cx(edge, 'py-4 text-xs font-bold text-gray-700 whitespace-nowrap', column.className)}">${escapeFormHtml(column.label)}</th>`;
    }).join('');

    const body = options.rowsHtml.trim().length > 0
        ? options.rowsHtml
        : `<tr><td colspan="${options.columns.length}" class="px-7 py-12 text-center text-gray-400">${escapeFormHtml(options.emptyMessage)}</td></tr>`;

    return `
        <div class="overflow-x-auto">
            <table class="w-full text-left bg-transparent">
                <thead><tr class="border-b border-gray-100">${headers}</tr></thead>
                <tbody${options.tbodyId ? ` id="${escapeFormAttribute(options.tbodyId)}"` : ''} class="divide-y divide-gray-100">${body}</tbody>
            </table>
        </div>
    `;
}

/**
 * The house KPI tile: a label, one prominent value, and a line of context.
 *
 * `detail` is escaped like everything else; `actionHtml` is trusted caller-built
 * markup (a link or button), so callers must escape anything they interpolate
 * into it themselves.
 */
export function renderMetricCard(label: string, value: string, detail: string, actionHtml = ''): string {
    return `
        <div class="${surfaceClass('muted', 'rounded-xl p-4')}">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500">${escapeFormHtml(label)}</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">${escapeFormHtml(value)}</p>
            <p class="${textClass.helper} mt-1">${escapeFormHtml(detail)}</p>
            ${actionHtml}
        </div>
    `;
}

// ── Active-tracking card ────────────────────────────────────────────────────
// The one tile used by every "Pelacakan Pengajuan Aktif" grid. The markup is the
// Administrasi Surat card verbatim — it was the established shell — so any other
// request kind adopting it inherits that exact layout instead of a near-copy.
// Callers supply only content: their own stage labels, body blocks and actions.

/**
 * `completed` = done (check), `active` = in progress, `pending` = not reached,
 * `interrupt` = stopped here and needs attention. Visual kinds only; the caller
 * maps its own status vocabulary onto them.
 */
export type TrackingStageKind = 'completed' | 'active' | 'pending' | 'interrupt';

export interface TrackingStage {
    kind: TrackingStageKind;
    /**
     * Static, caller-owned label, rendered as trusted HTML so a stage can wrap
     * (e.g. `Tinjau<br>Dokumen`). Never pass user-supplied text here.
     */
    label: string;
}

/**
 * Build a linear stage list: `completedThrough` is the highest index rendered as
 * done, `activeIndex` the in-progress node (-1 when none). When `interrupt` is
 * given, the node at `activeIndex` becomes the attention marker instead.
 */
export function buildTrackingStages(
    labels: readonly string[],
    options: { completedThrough: number; activeIndex: number; interrupt?: { label: string } | null },
): TrackingStage[] {
    return labels.map((label, index) => {
        if (options.interrupt && index === options.activeIndex) {
            return { kind: 'interrupt', label: options.interrupt.label };
        }
        if (index <= options.completedThrough) return { kind: 'completed', label };
        if (index === options.activeIndex) return { kind: 'active', label };
        return { kind: 'pending', label };
    });
}

function renderTrackingStageNode(stage: TrackingStage): string {
    const circle =
        stage.kind === 'completed' ? `
            <div class="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>`
        : stage.kind === 'active' ? `
            <div class="w-9 h-9 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm animate-pulse">
                <div class="w-3 h-3 bg-amber-500 rounded-full"></div>
            </div>`
        : stage.kind === 'interrupt' ? `
            <div class="w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center border-4 border-white shadow-md">
                <div class="w-3 h-3 bg-white rounded-full"></div>
            </div>`
        : `
            <div class="w-9 h-9 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center border-4 border-white"></div>`;

    const labelColor =
        stage.kind === 'active' ? 'text-amber-600'
        : stage.kind === 'interrupt' ? 'text-red-600'
        : stage.kind === 'pending' ? 'text-gray-400'
        : 'text-gray-600';

    const containerOpacity = stage.kind === 'pending' ? ' opacity-30' : '';

    return `
        <div class="relative z-10 flex flex-col items-center gap-2${containerOpacity}">
            ${circle}
            <span class="text-[9px] font-bold ${labelColor} text-center leading-tight">${stage.label}</span>
        </div>
    `;
}

export interface TrackingCardParts {
    badgeLabel: string;
    badgeTone: UiTone;
    title: string;
    subtitle: string;
    statusLabel: string;
    /** Pre-resolved status-pill classes (the domain helper owns status → tone). */
    statusToneClass: string;
    stages: readonly TrackingStage[];
    /** Trusted HTML: caller-composed body blocks (already escaped). */
    bodyHtml: string;
    /** Trusted HTML: caller-composed action buttons. */
    actionsHtml: string;
}

export function renderTrackingCard(parts: TrackingCardParts): string {
    return `
    <article class="${surfaceClass('interactive', 'flex h-full flex-col p-6')}">
        <div class="flex flex-wrap items-start justify-between gap-3">
            <span class="${badgeClass(parts.badgeTone)}">${escapeFormHtml(parts.badgeLabel)}</span>
            <span data-tracking-status class="${parts.statusToneClass} px-3 py-1.5 rounded-full font-bold text-[11px] border">${escapeFormHtml(parts.statusLabel)}</span>
        </div>
        <div class="mt-5">
            <h4 class="break-words font-['Inter'] text-lg font-bold text-gray-900">${escapeFormHtml(parts.title)}</h4>
            <p class="mt-1 text-sm font-semibold text-gray-600">${escapeFormHtml(parts.subtitle)}</p>
        </div>
        <div class="mt-6 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <div class="relative flex justify-between items-start mb-8 px-1">
                <div class="absolute top-[18px] left-[8%] right-[8%] h-0.5 border-t-2 border-dashed border-gray-200 -z-0"></div>
                ${parts.stages.map(renderTrackingStageNode).join('')}
            </div>
        </div>
        <div class="mt-5 flex flex-1 flex-col justify-between gap-5">
            <div class="space-y-4">
                ${parts.bodyHtml}
            </div>
            <div>
                ${parts.actionsHtml}
            </div>
        </div>
    </article>
`;
}
