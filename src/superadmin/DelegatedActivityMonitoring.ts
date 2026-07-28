import { showError, showSuccess } from '../shared/toast';
import {
    DelegatedActivityApiError,
    getSuperAdminDelegatedActivityAcknowledgement,
    listSuperAdminDelegatedActivityAcknowledgements,
    markDelegatedActivityEscalationSeen,
} from '../shared/delegated-activity-api';
import type {
    DelegatedActivityAcknowledgement,
    DelegatedActivityEffectiveStatus,
    DelegatedActivityFilters,
    DelegatedActivityListEnvelope,
    DelegatedActivityStatus,
    DelegatedActivitySummary,
    DelegatedActivityUrgency,
} from '../shared/delegated-activity-types';

const DASHBOARD_CARD_ROOT_ID = 'superadmin-delegated-activity-card-root';
const DRAWER_ROOT_ID = 'superadmin-delegated-activity-drawer-root';
const CONFIRM_ROOT_ID = 'superadmin-delegated-activity-confirm-root';
const PER_PAGE = 10;

type DashboardCardKind = 'loading' | 'ready' | 'empty' | 'error';

export interface SuperAdminDelegatedActivityDashboardCardState {
    kind: DashboardCardKind;
    summary?: DelegatedActivitySummary;
    message?: string;
}

interface SuperAdminDelegatedActivityListState {
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

let listState: SuperAdminDelegatedActivityListState = {
    items: [],
    summary: emptySummary(),
    currentPage: 1,
    lastPage: 1,
    total: 0,
    filters: { overdue: true, page: 1, perPage: PER_PAGE },
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
    range.selectNode(document.body);
    return range.createContextualFragment(markup);
};

const setMarkup = (element: Element, markup: string): void => {
    element.replaceChildren(fragmentFromMarkup(markup));
};

const formatDateTime = (value?: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
};

const humanizeToken = (value?: string | null): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '-';

    return raw
        .split(/[_\-.]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const statusLabel = (task: DelegatedActivityAcknowledgement): string =>
    task.labels?.status ?? task.status_label ?? humanizeToken(task.effective_status);

const urgencyLabel = (task: DelegatedActivityAcknowledgement): string =>
    task.labels?.urgency ?? task.urgency_label ?? humanizeToken(task.urgency);

const statusTone = (status: DelegatedActivityStatus | DelegatedActivityEffectiveStatus): string => {
    switch (status) {
        case 'acknowledged':
            return 'border-green-200 bg-green-50 text-green-700';
        case 'escalated':
            return 'border-amber-200 bg-amber-50 text-amber-800';
        case 'overdue':
            return 'border-red-200 bg-red-50 text-red-700';
        case 'voided':
            return 'border-gray-200 bg-gray-50 text-gray-600';
        case 'pending_review':
        default:
            return 'border-teal-200 bg-teal-50 text-teal-700';
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
    pending_count: summary?.pending_count ?? 0,
    overdue_count: summary?.overdue_count ?? 0,
    oldest_due_at: summary?.oldest_due_at ?? null,
    acknowledged_count: summary?.acknowledged_count ?? 0,
    escalated_count: summary?.escalated_count ?? 0,
});

const deriveSummary = (items: DelegatedActivityAcknowledgement[]): DelegatedActivitySummary => {
    const pending = items.filter((item) => item.status === 'pending_review').length;
    const overdue = items.filter((item) => item.is_overdue).length;
    const acknowledged = items.filter((item) => item.status === 'acknowledged').length;
    const escalated = items.filter((item) => item.status === 'escalated').length;
    const dueDates = items
        .map((item) => item.acknowledgement_due_at)
        .filter((value): value is string => Boolean(value))
        .sort();

    return {
        pending_count: pending,
        overdue_count: overdue,
        oldest_due_at: dueDates[0] ?? null,
        acknowledged_count: acknowledged,
        escalated_count: escalated,
    };
};

const summaryFromEnvelope = (envelope: DelegatedActivityListEnvelope): DelegatedActivitySummary =>
    normalizeSummary(envelope.meta?.summary ?? deriveSummary(envelope.data));

const apiErrorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof DelegatedActivityApiError)) {
        return error instanceof Error ? error.message : fallback;
    }

    const validationMessage = Object.values(error.errors ?? {})[0]?.[0];
    if (validationMessage) return validationMessage;
    if (error.status === 403) {
        return error.message || 'Monitoring aktivitas delegasi hanya tersedia untuk SuperAdmin yang berwenang.';
    }
    if (error.status === 404) {
        return 'Aktivitas delegasi tidak ditemukan.';
    }

    return error.message || fallback;
};

const dashboardCardInner = (state: SuperAdminDelegatedActivityDashboardCardState): string => {
    const summary = normalizeSummary(state.summary);
    const isLoading = state.kind === 'loading';
    const isError = state.kind === 'error';
    const isEmpty = state.kind === 'empty';

    return `
        <div class="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm" aria-live="polite" data-superadmin-delegated-activity-card-state="${state.kind}">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-base font-bold text-gray-900">Aktivitas Lab Belum Ditinjau</h3>
                        <span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800">Perlu Atensi SuperAdmin</span>
                    </div>
                    <p class="mt-2 text-sm text-gray-500">Pantau aktivitas delegasi laboratorium yang melewati batas peninjauan atau membutuhkan atensi.</p>
                </div>
                <button id="superadmin-delegated-activity-open" type="button" ${isLoading ? 'disabled' : ''} class="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60" aria-label="Pantau aktivitas lab belum ditinjau">
                    Pantau Aktivitas
                </button>
            </div>
            ${isLoading ? `
                <div role="status" class="mt-5 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-600">
                    <span class="h-7 w-7 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" aria-hidden="true"></span>
                    Memuat ringkasan aktivitas delegasi...
                </div>
            ` : isError ? `
                <div role="alert" class="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                    ${escapeHtml(state.message ?? 'Ringkasan aktivitas delegasi belum dapat dimuat.')}
                </div>
            ` : `
                <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div class="rounded-xl bg-red-50 px-4 py-3">
                        <p class="text-[11px] font-bold uppercase tracking-wide text-red-700">Melewati SLA</p>
                        <p class="mt-1 text-2xl font-black text-red-800">${summary.overdue_count}</p>
                    </div>
                    <div class="rounded-xl bg-amber-50 px-4 py-3">
                        <p class="text-[11px] font-bold uppercase tracking-wide text-amber-700">Eskalasi</p>
                        <p class="mt-1 text-2xl font-black text-amber-900">${summary.escalated_count ?? 0}</p>
                    </div>
                    <div class="rounded-xl bg-teal-50 px-4 py-3">
                        <p class="text-[11px] font-bold uppercase tracking-wide text-teal-700">Menunggu</p>
                        <p class="mt-1 text-2xl font-black text-teal-900">${summary.pending_count}</p>
                    </div>
                    <div class="rounded-xl bg-gray-50 px-4 py-3">
                        <p class="text-[11px] font-bold uppercase tracking-wide text-gray-600">Batas Terlama</p>
                        <p class="mt-1 text-sm font-bold text-gray-800">${escapeHtml(formatDateTime(summary.oldest_due_at))}</p>
                    </div>
                </div>
                ${isEmpty ? '<p class="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500">Belum ada aktivitas delegasi yang melewati batas peninjauan atau membutuhkan atensi.</p>' : ''}
            `}
        </div>
    `;
};

export const renderSuperAdminDelegatedActivityDashboardCard = (
    state: SuperAdminDelegatedActivityDashboardCardState = { kind: 'loading' },
): string => `
    <section id="${DASHBOARD_CARD_ROOT_ID}" class="mt-8" aria-label="Aktivitas Lab Belum Ditinjau">
        ${dashboardCardInner(state)}
    </section>
`;

const bindDashboardCardAction = (): void => {
    document.getElementById('superadmin-delegated-activity-open')?.addEventListener('click', () => {
        openSuperAdminDelegatedActivityMonitoring();
    });
};

const replaceDashboardCard = (state: SuperAdminDelegatedActivityDashboardCardState): void => {
    const root = document.getElementById(DASHBOARD_CARD_ROOT_ID);
    if (!root) return;
    setMarkup(root, dashboardCardInner(state));
    bindDashboardCardAction();
};

export const loadSuperAdminDelegatedActivityDashboardCardState = async (): Promise<SuperAdminDelegatedActivityDashboardCardState> => {
    const envelope = await listSuperAdminDelegatedActivityAcknowledgements({ overdue: true, perPage: PER_PAGE });
    const summary = summaryFromEnvelope(envelope);
    const hasVisibleWork = summary.pending_count > 0
        || summary.overdue_count > 0
        || (summary.escalated_count ?? 0) > 0
        || envelope.data.length > 0;

    return {
        kind: hasVisibleWork ? 'ready' : 'empty',
        summary,
    };
};

export const refreshSuperAdminDelegatedActivityDashboardCard = async (): Promise<void> => {
    const root = document.getElementById(DASHBOARD_CARD_ROOT_ID);
    if (!root) return;

    try {
        replaceDashboardCard(await loadSuperAdminDelegatedActivityDashboardCardState());
    } catch (error) {
        replaceDashboardCard({
            kind: 'error',
            summary: emptySummary(),
            message: apiErrorMessage(error, 'Ringkasan aktivitas delegasi belum dapat dimuat.'),
        });
    }
};

export const attachSuperAdminDelegatedActivityDashboardCard = (): void => {
    bindDashboardCardAction();
    void refreshSuperAdminDelegatedActivityDashboardCard();
};

const closeConfirmDialog = (): void => {
    document.getElementById(CONFIRM_ROOT_ID)?.remove();
    if (confirmEscapeHandler) {
        document.removeEventListener('keydown', confirmEscapeHandler);
        confirmEscapeHandler = null;
    }
};

const closeDrawer = (): void => {
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
        filters: { overdue: true, page: 1, perPage: PER_PAGE },
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

const scopeLabel = (task: DelegatedActivityAcknowledgement): string => {
    if (!task.represented_scope_type && !task.represented_scope_id) return '-';
    const scope = humanizeToken(task.represented_scope_type);
    return task.represented_scope_id ? `${scope} #${task.represented_scope_id}` : scope;
};

const reviewStateLabel = (task: DelegatedActivityAcknowledgement): string =>
    task.acknowledged_at ? 'Sudah ditinjau Kepala Lab' : 'Belum ditinjau Kepala Lab';

const escalationSeenLabel = (task: DelegatedActivityAcknowledgement): string =>
    task.escalation_seen_by_superadmin_at
        ? formatDateTime(task.escalation_seen_by_superadmin_at)
        : 'Belum dilihat SuperAdmin';

const renderFilters = (): string => `
    <form id="superadmin-delegated-activity-filters" class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label class="text-xs font-bold text-gray-600">
                Status
                <select id="superadmin-delegated-activity-status" aria-label="Filter status monitoring aktivitas delegasi" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                    <option value="">Semua status</option>
                    <option value="pending_review" ${selected(listState.filters.status, 'pending_review')}>Menunggu Peninjauan</option>
                    <option value="acknowledged" ${selected(listState.filters.status, 'acknowledged')}>Sudah Ditinjau</option>
                    <option value="escalated" ${selected(listState.filters.status, 'escalated')}>Perlu Atensi</option>
                    <option value="voided" ${selected(listState.filters.status, 'voided')}>Dibatalkan</option>
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                Urgensi
                <select id="superadmin-delegated-activity-urgency" aria-label="Filter urgensi monitoring aktivitas delegasi" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                    <option value="">Semua urgensi</option>
                    <option value="urgent" ${selected(listState.filters.urgency, 'urgent')}>Mendesak</option>
                    <option value="normal" ${selected(listState.filters.urgency, 'normal')}>Normal</option>
                    <option value="low_risk" ${selected(listState.filters.urgency, 'low_risk')}>Risiko Rendah</option>
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                SLA
                <select id="superadmin-delegated-activity-overdue" aria-label="Filter SLA monitoring aktivitas delegasi" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                    <option value="">Semua SLA</option>
                    <option value="true" ${selected(listState.filters.overdue, true)}>Melewati batas</option>
                    <option value="false" ${selected(listState.filters.overdue, false)}>Dalam batas</option>
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                Jenis Aktivitas
                <input id="superadmin-delegated-activity-type" type="search" value="${escapeHtml(listState.filters.activityType ?? '')}" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700" placeholder="Contoh: room_booking">
            </label>
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-3">
            <button id="superadmin-delegated-activity-reset" type="button" class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">Reset</button>
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
                    <p class="mt-1 text-xs text-gray-500">Penanggung jawab: ${escapeHtml(item.accountable_user?.name ?? '-')} (${escapeHtml(humanizeToken(item.accountable_role))})</p>
                    <p class="mt-1 text-xs text-gray-500">Lingkup: ${escapeHtml(scopeLabel(item))}</p>
                </div>
                <button type="button" data-superadmin-delegated-activity-detail="${item.id}" class="shrink-0 rounded-xl border border-teal-700 px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50" aria-label="Lihat detail monitoring aktivitas ${escapeHtml(item.activity_summary)}">
                    Lihat Detail
                </button>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-2">
                <span class="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(item.effective_status)}">${escapeHtml(statusLabel(item))}</span>
                <span class="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${urgencyTone(item.urgency)}">${escapeHtml(urgencyLabel(item))}</span>
                ${overdueBadge}
                <span class="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-700">${escapeHtml(escalationSeenLabel(item))}</span>
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
            <div data-superadmin-delegated-activity-list-state="loading" role="status" class="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" aria-hidden="true"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat monitoring aktivitas delegasi...</p>
            </div>
        `;
    }
    if (listState.errorStatus === 403) {
        return `
            <div data-superadmin-delegated-activity-list-state="forbidden" role="alert" class="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center shadow-sm">
                <h3 class="text-base font-bold text-gray-900">Monitoring belum tersedia</h3>
                <p class="mx-auto mt-2 max-w-lg text-sm text-amber-900">${escapeHtml(listState.error ?? 'Akses monitoring aktivitas delegasi belum tersedia untuk akun ini.')}</p>
            </div>
        `;
    }
    if (listState.error) {
        return `
            <div data-superadmin-delegated-activity-list-state="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center shadow-sm">
                <h3 class="text-base font-bold text-gray-900">Monitoring gagal dimuat</h3>
                <p class="mx-auto mt-2 max-w-lg text-sm text-red-800">${escapeHtml(listState.error)}</p>
                <button id="superadmin-delegated-activity-retry" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">Coba Lagi</button>
            </div>
        `;
    }
    if (listState.items.length === 0) {
        return `
            <div data-superadmin-delegated-activity-list-state="empty" class="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
                <h3 class="text-base font-bold text-gray-900">Belum ada aktivitas yang perlu atensi</h3>
                <p class="mx-auto mt-2 max-w-lg text-sm text-gray-500">Aktivitas delegasi laboratorium yang melewati batas peninjauan atau membutuhkan atensi akan muncul di sini.</p>
            </div>
        `;
    }

    return `
        <div data-superadmin-delegated-activity-list-state="success" class="space-y-3">
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
                <button id="superadmin-delegated-activity-prev" type="button" ${listState.currentPage <= 1 ? 'disabled' : ''} class="rounded-lg border border-gray-200 px-3 py-2 font-bold text-gray-600 disabled:opacity-40">Sebelumnya</button>
                <button id="superadmin-delegated-activity-next" type="button" ${listState.currentPage >= listState.lastPage ? 'disabled' : ''} class="rounded-lg border border-gray-200 px-3 py-2 font-bold text-gray-600 disabled:opacity-40">Berikutnya</button>
            </div>
        </div>
    `;
};

const renderSummaryStrip = (): string => `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p class="text-[11px] font-bold uppercase tracking-wide text-red-700">Melewati SLA</p>
            <p class="mt-1 text-2xl font-black text-red-800">${listState.summary.overdue_count}</p>
        </div>
        <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p class="text-[11px] font-bold uppercase tracking-wide text-amber-700">Eskalasi</p>
            <p class="mt-1 text-2xl font-black text-amber-900">${listState.summary.escalated_count ?? 0}</p>
        </div>
        <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p class="text-[11px] font-bold uppercase tracking-wide text-teal-700">Menunggu</p>
            <p class="mt-1 text-2xl font-black text-teal-900">${listState.summary.pending_count}</p>
        </div>
        <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p class="text-[11px] font-bold uppercase tracking-wide text-gray-600">Batas Terlama</p>
            <p class="mt-1 text-sm font-bold text-gray-800">${escapeHtml(formatDateTime(listState.summary.oldest_due_at))}</p>
        </div>
    </div>
`;

const renderDetailPlaceholder = (): string => `
    <div data-superadmin-delegated-activity-detail-state="empty" class="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
        <h3 class="text-base font-bold text-gray-900">Pilih aktivitas</h3>
        <p class="mt-2 text-sm text-gray-500">Buka detail aktivitas untuk memantau konteks akuntabilitas dan status atensi.</p>
    </div>
`;

const renderDetailState = (): string => {
    if (listState.detailLoading) {
        return `
            <div data-superadmin-delegated-activity-detail-state="loading" role="status" class="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" aria-hidden="true"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat detail monitoring...</p>
            </div>
        `;
    }
    if (listState.detailError) {
        return `
            <div data-superadmin-delegated-activity-detail-state="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center shadow-sm">
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
    const canMarkSeen = task.permissions?.can_mark_escalation_seen === true;
    const seenAt = task.escalation_seen_by_superadmin_at;

    return `
        <article data-superadmin-delegated-activity-detail-state="success" class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone(task.effective_status)}">${escapeHtml(statusLabel(task))}</span>
                <span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${urgencyTone(task.urgency)}">${escapeHtml(urgencyLabel(task))}</span>
                ${task.is_overdue ? '<span class="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Melewati Batas Peninjauan</span>' : ''}
                <span class="inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-700">${escapeHtml(escalationSeenLabel(task))}</span>
            </div>
            <h3 id="superadmin-delegated-activity-detail-title" class="mt-4 break-words text-lg font-bold text-gray-900">${escapeHtml(task.activity_summary)}</h3>
            <p class="mt-2 text-sm text-gray-500">SuperAdmin dapat memantau aktivitas ini, tetapi peninjauan tetap menjadi tanggung jawab pejabat terkait.</p>
            ${task.is_overdue ? '<p class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">Aktivitas ini melewati batas waktu peninjauan yang disarankan.</p>' : ''}
            ${listState.actionError ? `<p role="alert" class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${escapeHtml(listState.actionError)}</p>` : ''}
            <section class="mt-5">
                <h4 class="text-sm font-bold text-gray-800">Konteks Akuntabilitas</h4>
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
                <h4 class="text-sm font-bold text-gray-800">Ringkasan untuk Mahasiswa</h4>
                <p class="mt-2 whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">${escapeHtml(task.student_facing_note ?? '-')}</p>
            </section>
            <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                ${renderStateBlock('Kondisi Sebelum', task.before_state)}
                ${renderStateBlock('Kondisi Sesudah', task.after_state)}
            </div>
            <section class="mt-5">
                <h4 class="text-sm font-bold text-gray-800">Status Peninjauan dan Atensi</h4>
                <dl class="mt-2 rounded-xl border border-gray-100 px-4">
                    ${renderDetailRow('Status efektif', humanizeToken(task.effective_status))}
                    ${renderDetailRow('Status peninjauan', reviewStateLabel(task))}
                    ${renderDetailRow('Ditinjau pada', formatDateTime(task.acknowledged_at))}
                    ${renderDetailRow('Ditinjau oleh', task.acknowledged_by?.name ?? '-')}
                    ${renderDetailRow('Catatan peninjauan', task.acknowledgement_note ?? '-')}
                    ${renderDetailRow('Eskalasi pada', formatDateTime(task.escalated_at))}
                    ${renderDetailRow('Atensi dilihat SuperAdmin', formatDateTime(task.escalation_seen_by_superadmin_at))}
                </dl>
            </section>
            <section class="mt-5 border-t border-gray-100 pt-5">
                <h4 class="text-sm font-bold text-gray-800">Atensi SuperAdmin</h4>
                <p class="mt-2 text-sm text-gray-500">Tindakan ini hanya menandai bahwa eskalasi sudah dilihat oleh SuperAdmin. Peninjauan aktivitas tetap dilakukan oleh Kepala Lab.</p>
                ${seenAt ? `<p class="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">Atensi sudah dilihat pada ${escapeHtml(formatDateTime(seenAt))}.</p>` : ''}
                ${canMarkSeen ? `
                    <button id="superadmin-delegated-activity-mark-seen" type="button" class="mt-4 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800" aria-label="Tandai atensi sudah dilihat untuk aktivitas ${escapeHtml(task.activity_summary)}">
                        Tandai Atensi Sudah Dilihat
                    </button>
                ` : seenAt ? '' : '<p class="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">Akun ini tidak memiliki izin menandai atensi untuk aktivitas ini.</p>'}
            </section>
        </article>
    `;
};

const renderDrawer = (): void => {
    const root = document.getElementById(DRAWER_ROOT_ID);
    if (!root) return;

    setMarkup(root, `
        <div data-superadmin-delegated-activity-overlay class="fixed inset-0 z-[220] bg-black/40"></div>
        <aside role="dialog" aria-modal="true" aria-labelledby="superadmin-delegated-activity-title" class="fixed inset-y-0 right-0 z-[221] flex h-full w-full max-w-[1080px] flex-col bg-[#F5F7F9] shadow-2xl">
            <header class="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5">
                <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-teal-700">SuperAdmin</p>
                    <h2 id="superadmin-delegated-activity-title" class="mt-1 text-xl font-bold text-gray-900">Monitoring Aktivitas Lab Belum Ditinjau</h2>
                    <p class="mt-1 text-sm text-gray-500">Pantau aktivitas delegasi laboratorium yang melewati batas peninjauan atau membutuhkan atensi.</p>
                </div>
                <button id="superadmin-delegated-activity-close" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Tutup monitoring aktivitas lab belum ditinjau">x</button>
            </header>
            <div class="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
                    <section class="space-y-4" aria-label="Daftar monitoring aktivitas lab belum ditinjau">
                        ${renderSummaryStrip()}
                        ${renderFilters()}
                        ${renderListState()}
                    </section>
                    <section aria-labelledby="superadmin-delegated-activity-detail-title">
                        ${renderDetailState()}
                    </section>
                </div>
            </div>
        </aside>
    `);

    attachDrawerListeners();
};

const readFilters = (page: number): DelegatedActivityFilters => {
    const root = document.getElementById(DRAWER_ROOT_ID);
    const status = (root?.querySelector('#superadmin-delegated-activity-status') as HTMLSelectElement | null)?.value as DelegatedActivityStatus | '';
    const urgency = (root?.querySelector('#superadmin-delegated-activity-urgency') as HTMLSelectElement | null)?.value as DelegatedActivityUrgency | '';
    const overdueValue = (root?.querySelector('#superadmin-delegated-activity-overdue') as HTMLSelectElement | null)?.value ?? '';
    const activityType = (root?.querySelector('#superadmin-delegated-activity-type') as HTMLInputElement | null)?.value.trim() ?? '';

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
        const envelope = await listSuperAdminDelegatedActivityAcknowledgements(listState.filters);
        listState.items = envelope.data;
        listState.summary = summaryFromEnvelope(envelope);
        listState.currentPage = envelope.meta.current_page;
        listState.lastPage = envelope.meta.last_page;
        listState.total = envelope.meta.total;
    } catch (error) {
        listState.items = [];
        listState.summary = emptySummary();
        listState.error = apiErrorMessage(error, 'Monitoring aktivitas delegasi laboratorium belum dapat dimuat.');
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
        listState.detail = await getSuperAdminDelegatedActivityAcknowledgement(id);
    } catch (error) {
        listState.detailError = apiErrorMessage(error, 'Detail monitoring aktivitas delegasi belum dapat dimuat.');
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

const openMarkSeenConfirm = (task: DelegatedActivityAcknowledgement): void => {
    closeConfirmDialog();
    const root = document.createElement('div');
    root.id = CONFIRM_ROOT_ID;
    document.body.appendChild(root);

    const render = (message: string | null, submitting: boolean): void => {
        setMarkup(root, `
            <div data-superadmin-delegated-activity-confirm-overlay class="fixed inset-0 z-[230] bg-black/50"></div>
            <section role="alertdialog" aria-modal="true" aria-labelledby="superadmin-delegated-activity-confirm-title" aria-describedby="superadmin-delegated-activity-confirm-desc" class="fixed left-1/2 top-1/2 z-[231] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
                <h2 id="superadmin-delegated-activity-confirm-title" class="text-lg font-bold text-gray-900">Tandai Atensi Sudah Dilihat</h2>
                <p id="superadmin-delegated-activity-confirm-desc" class="mt-2 text-sm text-gray-500">Tandai bahwa SuperAdmin sudah melihat eskalasi aktivitas ini. Tindakan ini tidak mengubah kewajiban peninjauan Kepala Lab.</p>
                <p class="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800">${escapeHtml(task.activity_summary)}</p>
                ${message ? `<p role="alert" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${escapeHtml(message)}</p>` : ''}
                <div class="mt-5 flex justify-end gap-3">
                    <button id="superadmin-delegated-activity-confirm-cancel" type="button" ${submitting ? 'disabled' : ''} class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 disabled:opacity-50">Batal</button>
                    <button id="superadmin-delegated-activity-confirm-submit" type="button" ${submitting ? 'disabled' : ''} class="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">${submitting ? 'Memproses...' : 'Tandai Sudah Dilihat'}</button>
                </div>
            </section>
        `);

        root.querySelector('[data-superadmin-delegated-activity-confirm-overlay]')?.addEventListener('click', () => {
            if (!submitting) closeConfirmDialog();
        });
        root.querySelector('#superadmin-delegated-activity-confirm-cancel')?.addEventListener('click', closeConfirmDialog);
        root.querySelector('#superadmin-delegated-activity-confirm-submit')?.addEventListener('click', async () => {
            render(null, true);
            try {
                const updated = await markDelegatedActivityEscalationSeen(task.id);
                closeConfirmDialog();
                updateItem(updated);
                listState.actionError = null;
                renderDrawer();
                await refreshSuperAdminDelegatedActivityDashboardCard();
                void loadList();
                showSuccess('Atensi SuperAdmin berhasil ditandai sudah dilihat.');
            } catch (error) {
                const message = apiErrorMessage(error, 'Atensi SuperAdmin gagal ditandai sudah dilihat.');
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
        root.querySelector<HTMLButtonElement>('#superadmin-delegated-activity-confirm-submit')?.focus();
    };

    confirmEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeConfirmDialog();
    };
    document.addEventListener('keydown', confirmEscapeHandler);
    render(null, false);
};

const attachDrawerListeners = (): void => {
    const root = document.getElementById(DRAWER_ROOT_ID);
    if (!root) return;

    root.querySelector('[data-superadmin-delegated-activity-overlay]')?.addEventListener('click', closeDrawer);
    root.querySelector('#superadmin-delegated-activity-close')?.addEventListener('click', closeDrawer);
    root.querySelector('#superadmin-delegated-activity-retry')?.addEventListener('click', () => {
        void loadList();
    });
    root.querySelector('#superadmin-delegated-activity-filters')?.addEventListener('submit', (event) => {
        event.preventDefault();
        listState.filters = readFilters(1);
        listState.selectedId = null;
        listState.detail = null;
        listState.detailError = null;
        listState.actionError = null;
        void loadList();
    });
    root.querySelector('#superadmin-delegated-activity-reset')?.addEventListener('click', () => {
        listState.filters = { overdue: true, page: 1, perPage: PER_PAGE };
        listState.selectedId = null;
        listState.detail = null;
        listState.detailError = null;
        listState.actionError = null;
        void loadList();
    });
    root.querySelector('#superadmin-delegated-activity-prev')?.addEventListener('click', () => {
        listState.filters = {
            ...listState.filters,
            page: Math.max(1, listState.currentPage - 1),
            perPage: PER_PAGE,
        };
        void loadList();
    });
    root.querySelector('#superadmin-delegated-activity-next')?.addEventListener('click', () => {
        listState.filters = {
            ...listState.filters,
            page: Math.min(listState.lastPage, listState.currentPage + 1),
            perPage: PER_PAGE,
        };
        void loadList();
    });
    root.querySelectorAll<HTMLElement>('[data-superadmin-delegated-activity-detail]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.superadminDelegatedActivityDetail);
            if (Number.isInteger(id) && id > 0) void openDetail(id);
        });
    });
    root.querySelector('#superadmin-delegated-activity-mark-seen')?.addEventListener('click', () => {
        if (listState.detail) openMarkSeenConfirm(listState.detail);
    });
};

export const openSuperAdminDelegatedActivityMonitoring = (): void => {
    closeDrawer();
    resetListState();

    const root = document.createElement('div');
    root.id = DRAWER_ROOT_ID;
    document.body.appendChild(root);
    renderDrawer();

    drawerEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !document.getElementById(CONFIRM_ROOT_ID)) {
            closeDrawer();
        }
    };
    document.addEventListener('keydown', drawerEscapeHandler);
    root.querySelector<HTMLButtonElement>('#superadmin-delegated-activity-close')?.focus();

    void loadList();
};
