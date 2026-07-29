import { showError, showSuccess } from '../shared/toast';
import { renderDashboardSection, renderDashboardTile } from '../shared/ui-primitives';
import {
    acknowledgeDelegatedActivity,
    DelegatedActivityApiError,
    getDelegatedActivityAcknowledgement,
    listDelegatedActivityAcknowledgements,
} from './delegated-activity-api';
import type {
    DelegatedActivityAcknowledgement,
    DelegatedActivityEffectiveStatus,
    DelegatedActivityFilters,
    DelegatedActivityListEnvelope,
    DelegatedActivityStatus,
    DelegatedActivitySummary,
    DelegatedActivityUrgency,
} from './delegated-activity-types';

const DASHBOARD_CARD_ROOT_ID = 'delegated-activity-card-root';
const DRAWER_ROOT_ID = 'delegated-activity-drawer-root';
const CONFIRM_ROOT_ID = 'delegated-activity-confirm-root';
const PER_PAGE = 10;

type DashboardCardKind = 'loading' | 'ready' | 'empty' | 'error';

export interface DelegatedActivityDashboardCardState {
    kind: DashboardCardKind;
    summary?: DelegatedActivitySummary;
    message?: string;
}

interface DelegatedActivityListState {
    items: DelegatedActivityAcknowledgement[];
    summary: DelegatedActivitySummary;
    currentPage: number;
    lastPage: number;
    total: number;
    filters: DelegatedActivityFilters;
    loading: boolean;
    error: string | null;
    errorStatus: number | null;
    selectedId: number | null;
    detail: DelegatedActivityAcknowledgement | null;
    detailLoading: boolean;
    detailError: string | null;
    actionError: string | null;
}

const emptySummary = (): DelegatedActivitySummary => ({
    pending_count: 0,
    overdue_count: 0,
    oldest_due_at: null,
    acknowledged_count: 0,
    escalated_count: 0,
});

let listState: DelegatedActivityListState = {
    items: [],
    summary: emptySummary(),
    currentPage: 1,
    lastPage: 1,
    total: 0,
    filters: { page: 1, perPage: PER_PAGE },
    loading: false,
    error: null,
    errorStatus: null,
    selectedId: null,
    detail: null,
    detailLoading: false,
    detailError: null,
    actionError: null,
};

let drawerEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
let confirmEscapeHandler: ((event: KeyboardEvent) => void) | null = null;

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const fragmentFromMarkup = (markup: string): DocumentFragment => {
    const range = document.createRange();
    return range.createContextualFragment(markup);
};

const setMarkup = (element: Element, markup: string): void => {
    element.replaceChildren(fragmentFromMarkup(markup));
};

const formatDateTime = (iso: string | null | undefined): string => {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';

    return `${date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })} WIB`;
};

const humanizeToken = (value: string | null | undefined): string => {
    if (!value) return '-';
    return value
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const statusLabel = (task: DelegatedActivityAcknowledgement): string =>
    task.labels?.status
    ?? task.status_label
    ?? humanizeToken(task.status);

const urgencyLabel = (task: DelegatedActivityAcknowledgement): string =>
    task.labels?.urgency
    ?? task.urgency_label
    ?? humanizeToken(task.urgency);

const statusTone = (status: DelegatedActivityStatus | DelegatedActivityEffectiveStatus): string => {
    switch (status) {
        case 'acknowledged':
            return 'border-green-200 bg-green-50 text-green-700';
        case 'overdue':
            return 'border-red-200 bg-red-50 text-red-700';
        case 'escalated':
            return 'border-amber-200 bg-amber-50 text-amber-800';
        case 'voided':
            return 'border-gray-200 bg-gray-50 text-gray-500';
        case 'pending_review':
        default:
            return 'border-yellow-200 bg-yellow-50 text-yellow-800';
    }
};

const urgencyTone = (urgency: DelegatedActivityUrgency): string => {
    switch (urgency) {
        case 'urgent':
            return 'border-red-200 bg-red-50 text-red-700';
        case 'low_risk':
            return 'border-blue-200 bg-blue-50 text-blue-700';
        case 'normal':
        default:
            return 'border-gray-200 bg-gray-50 text-gray-700';
    }
};

const normalizeSummary = (summary?: Partial<DelegatedActivitySummary> | null): DelegatedActivitySummary => ({
    pending_count: Number(summary?.pending_count ?? 0),
    overdue_count: Number(summary?.overdue_count ?? 0),
    oldest_due_at: summary?.oldest_due_at ?? null,
    acknowledged_count: Number(summary?.acknowledged_count ?? 0),
    escalated_count: Number(summary?.escalated_count ?? 0),
});

const deriveSummary = (items: DelegatedActivityAcknowledgement[]): DelegatedActivitySummary => {
    const pendingItems = items.filter((item) => item.status === 'pending_review');
    const oldestDue = pendingItems
        .map((item) => item.acknowledgement_due_at)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .sort()[0] ?? null;

    return {
        pending_count: pendingItems.length,
        overdue_count: items.filter((item) => item.is_overdue).length,
        oldest_due_at: oldestDue,
        acknowledged_count: items.filter((item) => item.status === 'acknowledged').length,
        escalated_count: items.filter((item) => item.status === 'escalated').length,
    };
};

const summaryFromEnvelope = (envelope: DelegatedActivityListEnvelope): DelegatedActivitySummary =>
    normalizeSummary(envelope.meta.summary ?? deriveSummary(envelope.data));

const apiErrorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof DelegatedActivityApiError)) {
        return error instanceof Error ? error.message : fallback;
    }

    const validationMessage = Object.values(error.errors ?? {})[0]?.[0];
    if (validationMessage) return validationMessage;
    if (error.status === 403) {
        return error.message || 'Peninjauan aktivitas delegasi hanya tersedia untuk Kepala Lab yang berwenang.';
    }
    if (error.status === 404) {
        return 'Aktivitas delegasi tidak ditemukan atau tidak termasuk dalam lingkup Anda.';
    }

    return error.message || fallback;
};

const dashboardCardInner = (state: DelegatedActivityDashboardCardState): string => {
    const summary = normalizeSummary(state.summary);
    const isLoading = state.kind === 'loading';
    const isError = state.kind === 'error';
    const isEmpty = state.kind === 'empty';

    return `
        <div aria-live="polite" data-delegated-activity-card-state="${state.kind}">${renderDashboardSection({
            title: 'Aktivitas Lab Perlu Ditinjau',
            subtitle: 'Tinjau aktivitas operasional laboratorium yang dilakukan melalui delegasi.',
            noteHtml: '<span class="mt-2 inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[11px] font-bold text-yellow-800">Menunggu Peninjauan Kepala Lab</span>',
            actionHtml: `<button id="delegated-activity-open" type="button" ${isLoading ? 'disabled' : ''} class="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60" aria-label="Tinjau aktivitas lab perlu ditinjau">Tinjau Aktivitas</button>`,
            bodyHtml: `<div class="p-5">${isLoading ? `
                <div role="status" class="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-600">
                    <span class="h-7 w-7 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" aria-hidden="true"></span>
                    Memuat ringkasan aktivitas delegasi...
                </div>
            ` : isError ? `
                <div role="alert" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                    ${escapeHtml(state.message ?? 'Ringkasan aktivitas delegasi belum dapat dimuat.')}
                </div>
            ` : `
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    ${renderDashboardTile({ label: 'Menunggu', value: summary.pending_count, tone: 'teal' })}
                    ${renderDashboardTile({ label: 'Melewati Batas Waktu', value: summary.overdue_count, tone: 'danger' })}
                    ${renderDashboardTile({ label: 'Batas Terlama', value: formatDateTime(summary.oldest_due_at), tone: 'neutral', size: 'sm' })}
                </div>
                ${isEmpty ? '<p class="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500">Belum ada aktivitas delegasi yang perlu ditinjau.</p>' : ''}
            `}</div>`,
        })}</div>
    `;
};

export const renderDelegatedActivityDashboardCard = (
    state: DelegatedActivityDashboardCardState = { kind: 'loading' },
): string => `
    <section id="${DASHBOARD_CARD_ROOT_ID}" class="mt-8" aria-label="Aktivitas Lab Perlu Ditinjau">
        ${dashboardCardInner(state)}
    </section>
`;

const bindDashboardCardAction = (): void => {
    document.getElementById('delegated-activity-open')?.addEventListener('click', () => {
        openDelegatedActivityAcknowledgements();
    });
};

const replaceDashboardCard = (state: DelegatedActivityDashboardCardState): void => {
    const root = document.getElementById(DASHBOARD_CARD_ROOT_ID);
    if (!root) return;
    setMarkup(root, dashboardCardInner(state));
    bindDashboardCardAction();
};

export const loadDelegatedActivityDashboardCardState = async (): Promise<DelegatedActivityDashboardCardState> => {
    const envelope = await listDelegatedActivityAcknowledgements({ perPage: PER_PAGE });
    const summary = summaryFromEnvelope(envelope);
    const hasVisibleWork = summary.pending_count > 0
        || summary.overdue_count > 0
        || envelope.data.some((item) => item.status === 'escalated');

    return {
        kind: hasVisibleWork ? 'ready' : 'empty',
        summary,
    };
};

export const refreshDelegatedActivityDashboardCard = async (): Promise<void> => {
    const root = document.getElementById(DASHBOARD_CARD_ROOT_ID);
    if (!root) return;

    try {
        replaceDashboardCard(await loadDelegatedActivityDashboardCardState());
    } catch (error) {
        replaceDashboardCard({
            kind: 'error',
            summary: emptySummary(),
            message: apiErrorMessage(error, 'Ringkasan aktivitas delegasi belum dapat dimuat.'),
        });
    }
};

export const attachDelegatedActivityDashboardCard = (): void => {
    bindDashboardCardAction();
    void refreshDelegatedActivityDashboardCard();
};

const closeConfirmDialog = (): void => {
    document.getElementById(CONFIRM_ROOT_ID)?.remove();
    if (confirmEscapeHandler) {
        document.removeEventListener('keydown', confirmEscapeHandler);
        confirmEscapeHandler = null;
    }
};

const closeDelegatedActivityDrawer = (): void => {
    closeConfirmDialog();
    document.getElementById(DRAWER_ROOT_ID)?.remove();
    if (drawerEscapeHandler) {
        document.removeEventListener('keydown', drawerEscapeHandler);
        drawerEscapeHandler = null;
    }
};

const resetListState = (): void => {
    listState = {
        items: [],
        summary: emptySummary(),
        currentPage: 1,
        lastPage: 1,
        total: 0,
        filters: { page: 1, perPage: PER_PAGE },
        loading: true,
        error: null,
        errorStatus: null,
        selectedId: null,
        detail: null,
        detailLoading: false,
        detailError: null,
        actionError: null,
    };
};

const selected = (actual: unknown, expected: unknown): string =>
    actual === expected ? 'selected' : '';

const renderFilters = (): string => `
    <form id="delegated-activity-filters" class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label class="text-xs font-bold text-gray-600">
                Status
                <select id="delegated-activity-status" aria-label="Filter status aktivitas delegasi" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                    <option value="">Semua status</option>
                    <option value="pending_review" ${selected(listState.filters.status, 'pending_review')}>Menunggu Peninjauan</option>
                    <option value="acknowledged" ${selected(listState.filters.status, 'acknowledged')}>Sudah Ditinjau</option>
                    <option value="escalated" ${selected(listState.filters.status, 'escalated')}>Perlu Atensi</option>
                    <option value="voided" ${selected(listState.filters.status, 'voided')}>Dibatalkan</option>
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                Urgensi
                <select id="delegated-activity-urgency" aria-label="Filter urgensi aktivitas delegasi" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                    <option value="">Semua urgensi</option>
                    <option value="urgent" ${selected(listState.filters.urgency, 'urgent')}>Mendesak</option>
                    <option value="normal" ${selected(listState.filters.urgency, 'normal')}>Normal</option>
                    <option value="low_risk" ${selected(listState.filters.urgency, 'low_risk')}>Risiko Rendah</option>
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                SLA
                <select id="delegated-activity-overdue" aria-label="Filter SLA aktivitas delegasi" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                    <option value="">Semua SLA</option>
                    <option value="true" ${selected(listState.filters.overdue, true)}>Melewati batas</option>
                    <option value="false" ${selected(listState.filters.overdue, false)}>Dalam batas</option>
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                Jenis Aktivitas
                <input id="delegated-activity-type" type="search" value="${escapeHtml(listState.filters.activityType ?? '')}" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700" placeholder="Contoh: room_booking">
            </label>
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-3">
            <button id="delegated-activity-reset" type="button" class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">Reset</button>
            <button type="submit" class="rounded-xl bg-teal-700 px-5 py-2 text-sm font-bold text-white hover:bg-teal-800">Terapkan Filter</button>
        </div>
    </form>
`;

const renderListItem = (item: DelegatedActivityAcknowledgement): string => {
    const active = listState.selectedId === item.id;
    const overdueBadge = item.is_overdue
        ? `<span class="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">${escapeHtml(item.labels?.overdue ?? item.overdue_label ?? 'Melewati Batas Peninjauan')}</span>`
        : '';

    return `
        <article class="rounded-2xl border ${active ? 'border-teal-300 bg-teal-50/40' : 'border-gray-100 bg-white'} p-4 shadow-sm">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0">
                    <h3 class="break-words text-sm font-bold text-gray-900">${escapeHtml(item.activity_summary)}</h3>
                    <p class="mt-1 text-xs text-gray-500">Pelaksana delegasi: ${escapeHtml(item.delegated_actor?.name ?? '-')}</p>
                    <p class="mt-1 text-xs text-gray-500">Lingkup: ${escapeHtml(scopeLabel(item))}</p>
                </div>
                <button type="button" data-delegated-activity-detail="${item.id}" class="shrink-0 rounded-xl border border-teal-700 px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50" aria-label="Lihat detail aktivitas ${escapeHtml(item.activity_summary)}">
                    Lihat Detail
                </button>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-2">
                <span class="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(item.effective_status)}">${escapeHtml(statusLabel(item))}</span>
                <span class="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${urgencyTone(item.urgency)}">${escapeHtml(urgencyLabel(item))}</span>
                ${overdueBadge}
            </div>
            <dl class="mt-4 grid grid-cols-1 gap-3 text-xs text-gray-600 sm:grid-cols-2">
                <div>
                    <dt class="font-bold text-gray-500">Dilakukan</dt>
                    <dd class="mt-1 font-semibold text-gray-800">${escapeHtml(formatDateTime(item.performed_at))}</dd>
                </div>
                <div>
                    <dt class="font-bold text-gray-500">Batas Tinjau</dt>
                    <dd class="mt-1 font-semibold text-gray-800">${escapeHtml(formatDateTime(item.acknowledgement_due_at))}</dd>
                </div>
            </dl>
        </article>
    `;
};

const renderListState = (): string => {
    if (listState.loading) {
        return `
            <div data-delegated-activity-list-state="loading" role="status" class="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" aria-hidden="true"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat aktivitas lab perlu ditinjau...</p>
            </div>
        `;
    }
    if (listState.errorStatus === 403) {
        return `
            <div data-delegated-activity-list-state="forbidden" role="alert" class="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center shadow-sm">
                <h3 class="text-base font-bold text-gray-900">Peninjauan belum tersedia</h3>
                <p class="mx-auto mt-2 max-w-lg text-sm text-amber-900">${escapeHtml(listState.error ?? 'Akses peninjauan aktivitas delegasi belum tersedia untuk akun ini.')}</p>
            </div>
        `;
    }
    if (listState.error) {
        return `
            <div data-delegated-activity-list-state="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center shadow-sm">
                <h3 class="text-base font-bold text-gray-900">Aktivitas gagal dimuat</h3>
                <p class="mx-auto mt-2 max-w-lg text-sm text-red-800">${escapeHtml(listState.error)}</p>
                <button id="delegated-activity-retry" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">Coba Lagi</button>
            </div>
        `;
    }
    if (listState.items.length === 0) {
        return `
            <div data-delegated-activity-list-state="empty" class="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
                <h3 class="text-base font-bold text-gray-900">Belum ada aktivitas delegasi</h3>
                <p class="mx-auto mt-2 max-w-lg text-sm text-gray-500">Aktivitas operasional laboratorium yang perlu ditinjau akan muncul di sini.</p>
            </div>
        `;
    }

    return `
        <div data-delegated-activity-list-state="success" class="space-y-3">
            ${listState.items.map(renderListItem).join('')}
            ${renderPagination()}
        </div>
    `;
};

const renderPagination = (): string => {
    if (listState.lastPage <= 1) return '';

    return `
        <div class="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-xs font-semibold text-gray-500">
            <span>Halaman ${listState.currentPage} dari ${listState.lastPage} - ${listState.total} aktivitas</span>
            <div class="flex gap-2">
                <button id="delegated-activity-prev" type="button" ${listState.currentPage <= 1 ? 'disabled' : ''} class="rounded-lg border border-gray-200 px-3 py-2 font-bold text-gray-600 disabled:opacity-40">Sebelumnya</button>
                <button id="delegated-activity-next" type="button" ${listState.currentPage >= listState.lastPage ? 'disabled' : ''} class="rounded-lg border border-gray-200 px-3 py-2 font-bold text-gray-600 disabled:opacity-40">Berikutnya</button>
            </div>
        </div>
    `;
};

const renderDetailPlaceholder = (): string => `
    <div data-delegated-activity-detail-state="empty" class="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
        <h3 class="text-base font-bold text-gray-900">Pilih aktivitas</h3>
        <p class="mt-2 text-sm text-gray-500">Buka detail aktivitas untuk meninjau catatan dan mengonfirmasi peninjauan.</p>
    </div>
`;

const renderDetailState = (): string => {
    if (listState.detailLoading) {
        return `
            <div data-delegated-activity-detail-state="loading" role="status" class="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" aria-hidden="true"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat detail aktivitas...</p>
            </div>
        `;
    }
    if (listState.detailError) {
        return `
            <div data-delegated-activity-detail-state="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center shadow-sm">
                <h3 class="text-base font-bold text-gray-900">Detail tidak dapat dimuat</h3>
                <p class="mx-auto mt-2 max-w-lg text-sm text-red-800">${escapeHtml(listState.detailError)}</p>
            </div>
        `;
    }
    if (!listState.detail) return renderDetailPlaceholder();

    return renderDetail(listState.detail);
};

const renderDetailRow = (label: string, value: unknown): string => `
    <div class="border-b border-gray-100 py-3 last:border-0">
        <dt class="text-xs font-bold uppercase tracking-wide text-gray-500">${escapeHtml(label)}</dt>
        <dd class="mt-1 break-words text-sm font-semibold text-gray-800">${escapeHtml(value ?? '-')}</dd>
    </div>
`;

const scopeLabel = (task: DelegatedActivityAcknowledgement): string => {
    if (!task.represented_scope_type && !task.represented_scope_id) return '-';
    const scope = humanizeToken(task.represented_scope_type);
    return task.represented_scope_id ? `${scope} #${task.represented_scope_id}` : scope;
};

const stateSummary = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const renderStateBlock = (title: string, value: unknown): string => `
    <section>
        <h4 class="text-sm font-bold text-gray-800">${escapeHtml(title)}</h4>
        <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-700">${escapeHtml(stateSummary(value))}</pre>
    </section>
`;

const renderDetail = (task: DelegatedActivityAcknowledgement): string => {
    const canAcknowledge = task.permissions?.can_acknowledge === true
        && (task.status === 'pending_review' || task.status === 'escalated');
    const finished = task.status === 'acknowledged' || task.status === 'voided';
    const readOnlyReason = finished
        ? 'Aktivitas ini sudah tidak memerlukan konfirmasi peninjauan.'
        : 'Anda tidak memiliki akses untuk mengonfirmasi peninjauan aktivitas ini.';

    return `
        <article data-delegated-activity-detail-state="success" class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone(task.effective_status)}">${escapeHtml(statusLabel(task))}</span>
                <span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${urgencyTone(task.urgency)}">${escapeHtml(urgencyLabel(task))}</span>
                ${task.is_overdue ? '<span class="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Melewati Batas Peninjauan</span>' : ''}
            </div>
            <h3 id="delegated-activity-detail-title" class="mt-4 break-words text-lg font-bold text-gray-900">${escapeHtml(task.activity_summary)}</h3>
            <p class="mt-2 text-sm text-gray-500">Pastikan aktivitas operasional sudah sesuai sebelum mengonfirmasi peninjauan.</p>
            ${task.is_overdue ? '<p class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">Peninjauan ini melewati batas waktu yang disarankan.</p>' : ''}
            ${listState.actionError ? `<p role="alert" class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${escapeHtml(listState.actionError)}</p>` : ''}
            <section class="mt-5">
                <h4 class="text-sm font-bold text-gray-800">Informasi Aktivitas</h4>
                <dl class="mt-2 rounded-xl border border-gray-100 px-4">
                    ${renderDetailRow('Pelaksana delegasi', task.delegated_actor?.name ?? '-')}
                    ${renderDetailRow('Penanggung jawab', task.accountable_user?.name ?? '-')}
                    ${renderDetailRow('Peran penanggung jawab', humanizeToken(task.accountable_role))}
                    ${renderDetailRow('Lab/lingkup', scopeLabel(task))}
                    ${renderDetailRow('Domain', humanizeToken(task.domain_type))}
                    ${renderDetailRow('Subjek', `${humanizeToken(task.subject_type)} #${task.subject_id}`)}
                    ${renderDetailRow('Jenis aktivitas', humanizeToken(task.activity_type))}
                    ${renderDetailRow('Dilakukan pada', formatDateTime(task.performed_at))}
                    ${renderDetailRow('Batas tinjau', formatDateTime(task.acknowledgement_due_at))}
                </dl>
            </section>
            <section class="mt-5">
                <h4 class="text-sm font-bold text-gray-800">Catatan Internal</h4>
                <p class="mt-2 whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">${escapeHtml(task.internal_note ?? '-')}</p>
            </section>
            <section class="mt-5">
                <h4 class="text-sm font-bold text-gray-800">Catatan untuk Mahasiswa</h4>
                <p class="mt-2 whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">${escapeHtml(task.student_facing_note ?? '-')}</p>
            </section>
            <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                ${renderStateBlock('Kondisi Sebelum', task.before_state)}
                ${renderStateBlock('Kondisi Sesudah', task.after_state)}
            </div>
            <section class="mt-5">
                <h4 class="text-sm font-bold text-gray-800">Riwayat Peninjauan</h4>
                <dl class="mt-2 rounded-xl border border-gray-100 px-4">
                    ${renderDetailRow('Status efektif', humanizeToken(task.effective_status))}
                    ${renderDetailRow('Dikonfirmasi pada', formatDateTime(task.acknowledged_at))}
                    ${renderDetailRow('Dikonfirmasi oleh', task.acknowledged_by?.name ?? '-')}
                    ${renderDetailRow('Catatan konfirmasi', task.acknowledgement_note ?? '-')}
                    ${renderDetailRow('Eskalasi pada', formatDateTime(task.escalated_at))}
                    ${renderDetailRow('Eskalasi dilihat SuperAdmin', formatDateTime(task.escalation_seen_by_superadmin_at))}
                </dl>
            </section>
            <section class="mt-5 border-t border-gray-100 pt-5">
                <label for="delegated-activity-note" class="block text-sm font-bold text-gray-800">
                    Catatan peninjauan
                </label>
                <textarea id="delegated-activity-note" rows="4" maxlength="1000" ${finished || !task.permissions?.can_acknowledge ? 'disabled' : ''} class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 disabled:bg-gray-50 disabled:text-gray-400" aria-describedby="delegated-activity-note-helper">${escapeHtml(task.acknowledgement_note ?? '')}</textarea>
                <p id="delegated-activity-note-helper" class="mt-2 text-xs text-gray-500">Opsional. Catatan ini tersimpan bersama konfirmasi peninjauan.</p>
                ${canAcknowledge ? `
                    <button id="delegated-activity-acknowledge" type="button" class="mt-4 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800" aria-label="Konfirmasi sudah ditinjau untuk aktivitas ${escapeHtml(task.activity_summary)}">
                        Konfirmasi Sudah Ditinjau
                    </button>
                ` : `
                    <p class="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">${readOnlyReason}</p>
                `}
            </section>
        </article>
    `;
};

const renderDrawer = (): void => {
    const root = document.getElementById(DRAWER_ROOT_ID);
    if (!root) return;

    setMarkup(root, `
        <div data-delegated-activity-overlay class="fixed inset-0 z-[220] bg-black/40"></div>
        <aside role="dialog" aria-modal="true" aria-labelledby="delegated-activity-title" class="fixed inset-y-0 right-0 z-[221] flex h-full w-full max-w-[1040px] flex-col bg-[#F5F7F9] shadow-2xl">
            <header class="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5">
                <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Kepala Lab</p>
                    <h2 id="delegated-activity-title" class="mt-1 text-xl font-bold text-gray-900">Aktivitas Lab Perlu Ditinjau</h2>
                    <p class="mt-1 text-sm text-gray-500">Meninjau aktivitas operasional laboratorium yang dilakukan melalui delegasi.</p>
                </div>
                <button id="delegated-activity-close" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Tutup aktivitas lab perlu ditinjau">x</button>
            </header>
            <div class="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
                    <section class="space-y-4" aria-label="Daftar aktivitas lab perlu ditinjau">
                        ${renderSummaryStrip()}
                        ${renderFilters()}
                        ${renderListState()}
                    </section>
                    <section aria-labelledby="delegated-activity-detail-title">
                        ${renderDetailState()}
                    </section>
                </div>
            </div>
        </aside>
    `);

    attachDrawerListeners();
};

const renderSummaryStrip = (): string => `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p class="text-[11px] font-bold uppercase tracking-wide text-teal-700">Menunggu</p>
            <p class="mt-1 text-2xl font-black text-teal-900">${listState.summary.pending_count}</p>
        </div>
        <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p class="text-[11px] font-bold uppercase tracking-wide text-red-700">Melewati Batas Waktu</p>
            <p class="mt-1 text-2xl font-black text-red-800">${listState.summary.overdue_count}</p>
        </div>
        <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p class="text-[11px] font-bold uppercase tracking-wide text-gray-600">Batas Terlama</p>
            <p class="mt-1 text-sm font-bold text-gray-800">${escapeHtml(formatDateTime(listState.summary.oldest_due_at))}</p>
        </div>
    </div>
`;

const attachDrawerListeners = (): void => {
    const root = document.getElementById(DRAWER_ROOT_ID);
    if (!root) return;

    root.querySelector('[data-delegated-activity-overlay]')?.addEventListener('click', closeDelegatedActivityDrawer);
    root.querySelector('#delegated-activity-close')?.addEventListener('click', closeDelegatedActivityDrawer);
    root.querySelector('#delegated-activity-retry')?.addEventListener('click', () => {
        void loadList();
    });
    root.querySelector('#delegated-activity-filters')?.addEventListener('submit', (event) => {
        event.preventDefault();
        listState.filters = readFilters(1);
        listState.selectedId = null;
        listState.detail = null;
        listState.detailError = null;
        listState.actionError = null;
        void loadList();
    });
    root.querySelector('#delegated-activity-reset')?.addEventListener('click', () => {
        listState.filters = { page: 1, perPage: PER_PAGE };
        listState.selectedId = null;
        listState.detail = null;
        listState.detailError = null;
        listState.actionError = null;
        void loadList();
    });
    root.querySelector('#delegated-activity-prev')?.addEventListener('click', () => {
        listState.filters = {
            ...listState.filters,
            page: Math.max(1, listState.currentPage - 1),
            perPage: PER_PAGE,
        };
        void loadList();
    });
    root.querySelector('#delegated-activity-next')?.addEventListener('click', () => {
        listState.filters = {
            ...listState.filters,
            page: Math.min(listState.lastPage, listState.currentPage + 1),
            perPage: PER_PAGE,
        };
        void loadList();
    });
    root.querySelectorAll<HTMLElement>('[data-delegated-activity-detail]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.delegatedActivityDetail);
            if (Number.isInteger(id) && id > 0) void openDetail(id);
        });
    });
    root.querySelector('#delegated-activity-acknowledge')?.addEventListener('click', () => {
        if (listState.detail) openAcknowledgeConfirm(listState.detail);
    });
};

const readFilters = (page: number): DelegatedActivityFilters => {
    const root = document.getElementById(DRAWER_ROOT_ID);
    const status = (root?.querySelector('#delegated-activity-status') as HTMLSelectElement | null)?.value as DelegatedActivityStatus | '';
    const urgency = (root?.querySelector('#delegated-activity-urgency') as HTMLSelectElement | null)?.value as DelegatedActivityUrgency | '';
    const overdueValue = (root?.querySelector('#delegated-activity-overdue') as HTMLSelectElement | null)?.value ?? '';
    const activityType = (root?.querySelector('#delegated-activity-type') as HTMLInputElement | null)?.value.trim() ?? '';

    return {
        ...(status ? { status } : {}),
        ...(urgency ? { urgency } : {}),
        ...(overdueValue ? { overdue: overdueValue === 'true' } : {}),
        ...(activityType ? { activityType } : {}),
        page,
        perPage: PER_PAGE,
    };
};

const loadList = async (): Promise<void> => {
    listState.loading = true;
    listState.error = null;
    listState.errorStatus = null;
    renderDrawer();

    try {
        const envelope = await listDelegatedActivityAcknowledgements(listState.filters);
        listState.items = envelope.data;
        listState.summary = summaryFromEnvelope(envelope);
        listState.currentPage = envelope.meta.current_page;
        listState.lastPage = envelope.meta.last_page;
        listState.total = envelope.meta.total;
    } catch (error) {
        listState.items = [];
        listState.summary = emptySummary();
        listState.error = apiErrorMessage(error, 'Aktivitas delegasi laboratorium belum dapat dimuat.');
        listState.errorStatus = error instanceof DelegatedActivityApiError ? error.status : null;
    } finally {
        listState.loading = false;
        renderDrawer();
    }
};

const openDetail = async (id: number): Promise<void> => {
    listState.selectedId = id;
    listState.detail = null;
    listState.detailLoading = true;
    listState.detailError = null;
    listState.actionError = null;
    renderDrawer();

    try {
        listState.detail = await getDelegatedActivityAcknowledgement(id);
    } catch (error) {
        listState.detailError = apiErrorMessage(error, 'Detail aktivitas delegasi belum dapat dimuat.');
    } finally {
        listState.detailLoading = false;
        renderDrawer();
    }
};

const updateItem = (updated: DelegatedActivityAcknowledgement): void => {
    listState.items = listState.items.map((item) => (item.id === updated.id ? updated : item));
    listState.detail = updated;
    listState.summary = deriveSummary(listState.items);
};

const openAcknowledgeConfirm = (task: DelegatedActivityAcknowledgement): void => {
    closeConfirmDialog();
    const note = (document.getElementById('delegated-activity-note') as HTMLTextAreaElement | null)?.value.trim() ?? '';
    const root = document.createElement('div');
    root.id = CONFIRM_ROOT_ID;
    document.body.appendChild(root);

    const render = (message: string | null, submitting: boolean): void => {
        setMarkup(root, `
            <div data-delegated-activity-confirm-overlay class="fixed inset-0 z-[230] bg-black/50"></div>
            <section role="alertdialog" aria-modal="true" aria-labelledby="delegated-activity-confirm-title" aria-describedby="delegated-activity-confirm-desc" class="fixed left-1/2 top-1/2 z-[231] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
                <h2 id="delegated-activity-confirm-title" class="text-lg font-bold text-gray-900">Konfirmasi Peninjauan</h2>
                <p id="delegated-activity-confirm-desc" class="mt-2 text-sm text-gray-500">Konfirmasi bahwa aktivitas operasional ini sudah ditinjau oleh Kepala Lab.</p>
                <p class="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800">${escapeHtml(task.activity_summary)}</p>
                ${message ? `<p role="alert" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${escapeHtml(message)}</p>` : ''}
                <div class="mt-5 flex justify-end gap-3">
                    <button id="delegated-activity-confirm-cancel" type="button" ${submitting ? 'disabled' : ''} class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 disabled:opacity-50">Batal</button>
                    <button id="delegated-activity-confirm-submit" type="button" ${submitting ? 'disabled' : ''} class="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">${submitting ? 'Memproses...' : 'Ya, Konfirmasi Sudah Ditinjau'}</button>
                </div>
            </section>
        `);

        root.querySelector('[data-delegated-activity-confirm-overlay]')?.addEventListener('click', () => {
            if (!submitting) closeConfirmDialog();
        });
        root.querySelector('#delegated-activity-confirm-cancel')?.addEventListener('click', closeConfirmDialog);
        root.querySelector('#delegated-activity-confirm-submit')?.addEventListener('click', async () => {
            render(null, true);
            try {
                const updated = await acknowledgeDelegatedActivity(task.id, note);
                closeConfirmDialog();
                updateItem(updated);
                listState.actionError = null;
                renderDrawer();
                await refreshDelegatedActivityDashboardCard();
                showSuccess('Aktivitas delegasi berhasil dikonfirmasi sudah ditinjau.');
            } catch (error) {
                const message = apiErrorMessage(error, 'Konfirmasi peninjauan gagal diproses.');
                if (error instanceof DelegatedActivityApiError && error.status === 403) {
                    closeConfirmDialog();
                    listState.actionError = message;
                    renderDrawer();
                    showError(message);
                    return;
                }
                render(message, false);
                showError(message);
            }
        });
        root.querySelector<HTMLButtonElement>('#delegated-activity-confirm-submit')?.focus();
    };

    confirmEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeConfirmDialog();
    };
    document.addEventListener('keydown', confirmEscapeHandler);
    render(null, false);
};

export const openDelegatedActivityAcknowledgements = (): void => {
    closeDelegatedActivityDrawer();
    resetListState();

    const root = document.createElement('div');
    root.id = DRAWER_ROOT_ID;
    document.body.appendChild(root);
    renderDrawer();

    drawerEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !document.getElementById(CONFIRM_ROOT_ID)) {
            closeDelegatedActivityDrawer();
        }
    };
    document.addEventListener('keydown', drawerEscapeHandler);
    root.querySelector<HTMLButtonElement>('#delegated-activity-close')?.focus();

    void loadList();
};
