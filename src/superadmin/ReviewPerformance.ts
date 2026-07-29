import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { buttonClass, cx, surfaceClass, textClass, type UiTone } from '../shared/design-system';
import { escapeFormAttribute, escapeFormHtml } from '../shared/form-primitives';
import { renderEmptyState, renderErrorState, renderLoadingState, renderStatusBadge } from '../shared/ui-primitives';
import { hydrateSlaGovernance, slaGovernanceShell } from './sla-governance';
import type { ReviewStagePayload, ReviewSummaryPayload } from '../shared/review-performance-widget';
import {
    fetchReviewBreakdown,
    fetchReviewSummary,
    fetchReviewTrend,
    PERIODS,
    type ReviewBreakdownPayload,
    type ReviewTrendPayload,
} from './review-performance/api';

/**
 * "Monitoring Kinerja" — the SuperAdmin analysis surface.
 *
 * This page reports on how long each stage of each workflow takes, broken down by
 * organisational unit. It is a workload-balancing instrument, and every design
 * decision here is chosen to keep it one:
 *
 *  - Unit tables sort by VOLUME, never by duration. A duration-sorted table is a
 *    league table whatever the heading says, and the first thing a reader does
 *    with one is look at the bottom.
 *  - Every unit row shows its file count beside its time, so a "slow" unit with
 *    three files is visibly incomparable to one with three hundred.
 *  - No individual is nameable anywhere: the API cannot return a reviewer.
 *  - No CSV export. The moment this is a spreadsheet it travels without its
 *    caveats and turns into a performance-review artefact.
 *  - Words like "lambat", "terlambat", "peringkat" and "skor" are never applied
 *    to a unit; the only judgement shown is the backend's factual status label,
 *    which is measured against a threshold SuperAdmin explicitly configured.
 */

const MOUNT = 'review-performance-page';

const STATUS_TONE: Record<string, UiTone> = {
    within: 'success',
    approaching: 'warning',
    beyond: 'danger',
    unknown: 'neutral',
    unrated: 'neutral',
};

let activePeriod: string = '3months';
let activeStage: { scope: string; stage: string } | null = null;

export const renderReviewPerformance = (): void => {
    renderDashboardLayout('Monitoring Kinerja', shell(), 'super_admin', 'review-performance');
    void hydrate();
    // SLA governance is self-contained and failure-isolated; it loads its own
    // policies so it never blocks the performance summary.
    void hydrateSlaGovernance();
};

function shell(): string {
    return `
        <div id="${MOUNT}" class="space-y-6">
            <section class="${surfaceClass('card', 'p-5 sm:p-6')}">
                <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Tata Kelola</p>
                <h2 class="mt-1 text-xl font-bold text-gray-900">Monitoring Kinerja</h2>
                <p class="mt-1 text-sm text-gray-600">
                    Gambaran waktu pemeriksaan per tahap biar beban kerja lebih merata — bukan penilaian individu.
                </p>
                <div id="${MOUNT}-periods" class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Periode laporan">
                    ${PERIODS.map(periodButton).join('')}
                </div>
            </section>
            ${slaGovernanceShell()}
            <p id="${MOUNT}-status" role="status" aria-live="polite" class="sr-only"></p>
            <div id="${MOUNT}-summary">${renderLoadingState('Memuat ringkasan kinerja pemeriksaan...')}</div>
            <div id="${MOUNT}-detail"></div>
        </div>
    `;
}

function periodButton(period: { key: string; label: string }): string {
    const active = period.key === activePeriod;

    return `
        <button type="button" data-period="${escapeFormAttribute(period.key)}"
            aria-pressed="${active}"
            class="${active
                ? buttonClass('primary', 'sm')
                : buttonClass('outline', 'sm')}">${escapeFormHtml(period.label)}</button>
    `;
}

async function hydrate(): Promise<void> {
    const summaryMount = document.getElementById(`${MOUNT}-summary`);
    if (!summaryMount) return;

    summaryMount.innerHTML = renderLoadingState('Memuat ringkasan kinerja pemeriksaan...');

    try {
        const summary = await fetchReviewSummary(activePeriod);
        summaryMount.innerHTML = summaryMarkup(summary);
        bindPeriods();
        bindStageButtons();
        announce(`Ringkasan periode ${summary.period.label} dimuat.`);

        // Default the detail pane to the first stage that has any activity, so
        // the page opens on something informative rather than an empty table.
        const firstStage = summary.scopes
            .flatMap((scope) => scope.stages.map((stage) => ({ scope: scope.scope, stage: stage.stage, count: stage.metric.count })))
            .sort((a, b) => b.count - a.count)[0];
        if (firstStage) {
            activeStage = { scope: firstStage.scope, stage: firstStage.stage };
            void hydrateDetail();
        }
    } catch (error) {
        summaryMount.innerHTML = errorBlock(error, 'summary-retry');
        document.getElementById('summary-retry')?.addEventListener('click', () => void hydrate());
        bindPeriods();
        announce('Ringkasan gagal dimuat.');
    }
}

function summaryMarkup(summary: ReviewSummaryPayload): string {
    return `
        ${summary.scopes.map((scope) => `
            <section class="${surfaceClass('card', 'p-5 sm:p-6 space-y-4 mb-6')}">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 class="text-base font-bold text-gray-800">${escapeFormHtml(scope.scope_label)}</h3>
                    <span class="${textClass.helper}">${scope.sla.enabled
                        ? `Batas waktu ${escapeFormHtml(scope.sla.overdue_label)}`
                        : 'Batas waktu belum diaktifkan'}</span>
                </div>
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    ${scope.stages.map((stage) => stageCard(scope.scope, stage)).join('')}
                </div>
            </section>
        `).join('')}
        <p class="${cx(textClass.helper, 'px-1')}">
            ${escapeFormHtml(summary.basis.measures)} ${escapeFormHtml(summary.basis.excludes)}
            Angka muncul setelah minimal ${summary.basis.min_sample} pengajuan selesai; sebelum itu ditampilkan sebagai estimasi.
        </p>
    `;
}

function stageCard(scope: string, stage: ReviewStagePayload): string {
    const { metric } = stage;
    const value = metric.median_label ?? metric.estimate_label ?? 'Belum ada data';

    return `
        <div class="${surfaceClass('muted', 'rounded-xl p-4')}">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500">${escapeFormHtml(stage.stage_label)}</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">${escapeFormHtml(value)}</p>
            <p class="${cx(textClass.helper, 'mt-1')}">${escapeFormHtml(metric.sample_note ?? `${metric.count} pengajuan`)}</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
                ${metric.source === 'fallback' ? renderStatusBadge('warning', 'Estimasi') : ''}
                ${metric.status === 'unrated' ? '' : renderStatusBadge(STATUS_TONE[metric.status] ?? 'neutral', metric.status_label)}
            </div>
            ${metric.average_label ? `<p class="${cx(textClass.helper, 'mt-2')}">Rata-rata ${escapeFormHtml(metric.average_label)}</p>` : ''}
            ${stage.comparison ? `<p class="${cx(textClass.helper, 'mt-1')}">${escapeFormHtml(stage.comparison.label)}</p>` : ''}
            <button type="button" data-stage="${escapeFormAttribute(stage.stage)}" data-scope="${escapeFormAttribute(scope)}"
                class="${buttonClass('ghost', 'sm', 'mt-3 px-0')}">Lihat rincian per unit</button>
        </div>
    `;
}

async function hydrateDetail(): Promise<void> {
    const mount = document.getElementById(`${MOUNT}-detail`);
    if (!mount || !activeStage) return;

    mount.innerHTML = renderLoadingState('Memuat rincian per unit...');

    try {
        const [breakdown, trend] = await Promise.all([
            fetchReviewBreakdown(activeStage.scope, activeStage.stage, activePeriod),
            fetchReviewTrend(activeStage.scope, activeStage.stage, activePeriod),
        ]);
        mount.innerHTML = `${breakdownMarkup(breakdown)}${trendMarkup(trend)}`;
        announce(`Rincian ${breakdown.stage_label} dimuat.`);
    } catch (error) {
        mount.innerHTML = errorBlock(error, 'detail-retry');
        document.getElementById('detail-retry')?.addEventListener('click', () => void hydrateDetail());
    }
}

function breakdownMarkup(data: ReviewBreakdownPayload): string {
    const rows = data.units.length === 0
        ? `<tr><td colspan="4" class="px-6 py-8">${renderEmptyState('Belum ada pengajuan yang selesai di periode ini.')}</td></tr>`
        : data.units.map((unit) => `
            <tr class="border-t border-gray-50">
                <td class="px-6 py-4 text-sm font-semibold text-gray-800">${escapeFormHtml(unit.unit_label)}</td>
                <td class="px-6 py-4 text-sm text-gray-700">${escapeFormHtml(String(unit.metric.count))}</td>
                <td class="px-6 py-4 text-sm text-gray-700">${escapeFormHtml(unit.metric.median_label ?? unit.metric.estimate_label ?? '-')}
                    ${unit.metric.source === 'fallback' ? ` ${renderStatusBadge('warning', 'Estimasi')}` : ''}</td>
                <td class="px-6 py-4">${unit.metric.status === 'unrated'
                    ? `<span class="${textClass.helper}">-</span>`
                    : renderStatusBadge(STATUS_TONE[unit.metric.status] ?? 'neutral', unit.metric.status_label)}</td>
            </tr>
        `).join('');

    return `
        <section class="${surfaceClass('card', 'overflow-hidden mb-6')}">
            <div class="border-b border-gray-100 px-6 py-4">
                <h3 class="text-base font-bold text-gray-800">${escapeFormHtml(data.stage_label)} · per ${escapeFormHtml(data.unit_dimension_label)}</h3>
                <p class="${cx(textClass.helper, 'mt-1')}">Diurutkan berdasarkan jumlah pengajuan, bukan lama waktu — unit dengan sedikit pengajuan tidak sebanding dengan unit bervolume tinggi.</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-white">
                            <th class="px-6 py-4 text-[13px] font-bold text-gray-700">${escapeFormHtml(data.unit_dimension_label)}</th>
                            <th class="px-6 py-4 text-[13px] font-bold text-gray-700">Jumlah Pengajuan</th>
                            <th class="px-6 py-4 text-[13px] font-bold text-gray-700">Waktu Pemeriksaan</th>
                            <th class="px-6 py-4 text-[13px] font-bold text-gray-700">Status</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${data.unassigned.count > 0
                ? `<p class="${cx(textClass.helper, 'border-t border-gray-100 px-6 py-3')}">${escapeFormHtml(data.unassigned.note)}: ${data.unassigned.count} pengajuan (tidak digabungkan ke unit mana pun).</p>`
                : ''}
        </section>
    `;
}

/**
 * Trend as a labelled list rather than a plotted line. Buckets below the sample
 * floor carry no duration, and a line chart would have to interpolate straight
 * through them — inventing a trend out of two-file months.
 */
function trendMarkup(data: ReviewTrendPayload): string {
    if (data.points.length === 0) {
        return `<section class="${surfaceClass('card', 'p-5 sm:p-6')}">${renderEmptyState('Belum ada data tren pada periode ini.')}</section>`;
    }

    return `
        <section class="${surfaceClass('card', 'p-5 sm:p-6 space-y-3')}">
            <h3 class="text-base font-bold text-gray-800">Tren ${escapeFormHtml(data.stage_label)}</h3>
            <ul role="list" class="divide-y divide-gray-50">
                ${data.points.map((point) => `
                    <li class="flex flex-wrap items-baseline justify-between gap-2 py-2">
                        <span class="text-sm font-semibold text-gray-700">${escapeFormHtml(point.label)}</span>
                        <span class="text-sm text-gray-600">
                            ${point.median_label
                                ? escapeFormHtml(point.median_label)
                                : `<span class="${textClass.helper}">data belum cukup</span>`}
                            <span class="${textClass.helper}"> · ${point.count} pengajuan</span>
                        </span>
                    </li>
                `).join('')}
            </ul>
        </section>
    `;
}

function errorBlock(error: unknown, retryId: string): string {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';

    return `
        <div class="space-y-3">
            ${renderErrorState(message)}
            <button id="${escapeFormAttribute(retryId)}" type="button" class="${buttonClass('primary', 'sm')}">Coba Lagi</button>
        </div>
    `;
}

function bindPeriods(): void {
    document.querySelectorAll<HTMLElement>(`#${MOUNT}-periods [data-period]`).forEach((button) => {
        button.addEventListener('click', () => {
            const period = button.dataset.period;
            if (!period || period === activePeriod) return;
            activePeriod = period;
            const bar = document.getElementById(`${MOUNT}-periods`);
            if (bar) bar.innerHTML = PERIODS.map(periodButton).join('');
            void hydrate();
        });
    });
}

function bindStageButtons(): void {
    document.querySelectorAll<HTMLElement>(`#${MOUNT} [data-stage]`).forEach((button) => {
        button.addEventListener('click', () => {
            const stage = button.dataset.stage;
            const scope = button.dataset.scope;
            if (!stage || !scope) return;
            activeStage = { scope, stage };
            void hydrateDetail();
        });
    });
}

function announce(message: string): void {
    const status = document.getElementById(`${MOUNT}-status`);
    if (status) status.textContent = message;
}

export const __testing = { STATUS_TONE };
