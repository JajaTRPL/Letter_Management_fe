import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { buttonClass, cx, inputClass, selectClass, surfaceClass, textClass, type UiTone } from '../shared/design-system';
import { escapeFormAttribute, escapeFormHtml } from '../shared/form-primitives';
import { renderEmptyState, renderErrorState, renderLoadingState, renderStatusBadge } from '../shared/ui-primitives';
import { showError, showSuccess } from '../shared/toast';
import {
    executeRetentionItem,
    getRetentionActions,
    getRetentionArchives,
    getRetentionCandidates,
    getRetentionOverview,
    getRetentionPolicy,
    purgeRetentionArchive,
    restoreRetentionArchive,
    runRetentionDryRun,
    updateRetentionPolicy,
} from './retention/api';
import {
    RETENTION_CATEGORIES,
    type RetentionActionLog,
    type RetentionActionResult,
    type RetentionArchive,
    type RetentionCategory,
    type RetentionFilters,
    type RetentionListResponse,
    type RetentionOverview,
    type RetentionPaginationMeta,
    type RetentionPolicyPayload,
    type RetentionPolicyValues,
} from './retention/types';

type CategoryFilter = RetentionCategory | '';

interface CandidateFilters {
    category: CategoryFilter;
    letterType: string;
    applicationId: string;
}

interface ArchiveFilters {
    letterType: string;
    applicationId: string;
}

interface ActionFilters extends CandidateFilters {
    status: string;
}

interface RetentionPanelState {
    loading: boolean;
    error: string | null;
    overview: RetentionOverview | null;
    policy: RetentionPolicyPayload | null;
    candidates: RetentionListResponse<RetentionActionResult>;
    archives: RetentionListResponse<RetentionArchive>;
    actions: RetentionListResponse<RetentionActionLog>;
    candidateFilters: CandidateFilters;
    archiveFilters: ArchiveFilters;
    actionFilters: ActionFilters;
}

interface PendingReasonAction {
    kind: 'execute' | 'restore' | 'purge';
    title: string;
    summary: string;
    confirmLabel: string;
    item?: RetentionActionResult;
    archiveId?: number;
}

const PER_PAGE = 10;

const EMPTY_META: RetentionPaginationMeta = {
    current_page: 1,
    per_page: PER_PAGE,
    total: 0,
    last_page: 1,
};

const CATEGORY_LABELS: Record<RetentionCategory, string> = {
    supporting_document: 'Dokumen pendukung',
    intermediate_artifact: 'Artefak antara',
    final_official_pdf: 'PDF final aktif',
    archived_final_pdf: 'Arsip PDF final',
};

const POLICY_LABELS: Record<keyof RetentionPolicyValues, string> = {
    supporting_document_retention_days: 'Dokumen pendukung',
    intermediate_artifact_retention_days: 'Artefak antara',
    final_pdf_active_days: 'PDF final aktif',
    archive_retention_days: 'Arsip PDF final',
};

let state: RetentionPanelState = initialState();
let pendingReasonAction: PendingReasonAction | null = null;

function initialState(): RetentionPanelState {
    return {
        loading: true,
        error: null,
        overview: null,
        policy: null,
        candidates: { data: [], meta: EMPTY_META },
        archives: { data: [], meta: EMPTY_META },
        actions: { data: [], meta: EMPTY_META },
        candidateFilters: { category: '', letterType: '', applicationId: '' },
        archiveFilters: { letterType: '', applicationId: '' },
        actionFilters: { category: '', letterType: '', applicationId: '', status: '' },
    };
}

export async function renderRetentionControlPanel(): Promise<void> {
    state = initialState();
    renderPage();
    await loadAllData();
}

async function loadAllData(): Promise<void> {
    try {
        state.loading = true;
        state.error = null;
        renderPage();
        const [overview, policy, candidates, archives, actions] = await Promise.all([
            getRetentionOverview(),
            getRetentionPolicy(),
            getRetentionCandidates(buildCandidateQuery(state.candidateFilters, 1)),
            getRetentionArchives(buildArchiveQuery(state.archiveFilters, 1)),
            getRetentionActions(buildActionQuery(state.actionFilters, 1)),
        ]);
        state = {
            ...state,
            loading: false,
            overview,
            policy,
            candidates,
            archives,
            actions,
        };
    } catch (error) {
        state = {
            ...state,
            loading: false,
            error: error instanceof Error ? error.message : 'Panel retensi surat gagal dimuat.',
        };
    }
    renderPage();
}

function renderPage(): void {
    renderDashboardLayout('Retensi & Arsip Surat', renderPanelContent(), 'super_admin', 'retention');
    attachPanelListeners();
}

function renderPanelContent(): string {
    if (state.loading) return renderLoadingState('Memuat kontrol retensi surat...');
    if (state.error) return renderErrorState(state.error);

    return `
        <div class="space-y-6">
            ${renderOverview()}
            ${renderPolicy()}
            ${renderCandidates()}
            ${renderArchives()}
            ${renderActions()}
            <div id="retention-modal-container"></div>
        </div>
    `;
}

function renderOverview(): string {
    const overview = state.overview;
    if (!overview) return renderEmptyState('Ikhtisar retensi belum tersedia.');

    const failedActions = overview.actions.by_status.failed ?? 0;
    const schedulerLabel = overview.scheduler.enabled ? 'Aktif dari konfigurasi' : 'Nonaktif dari konfigurasi';
    const schedulerTone: UiTone = overview.scheduler.enabled ? 'success' : 'neutral';
    const policyValues = overview.policy.values;

    return `
        <section class="${surfaceClass('card', 'p-5 sm:p-6 space-y-5')}">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 class="text-lg font-bold text-gray-900">Ikhtisar</h2>
                    <p class="${textClass.helper} mt-1">Ringkasan kandidat, arsip, aksi gagal, dan status scheduler hanya-baca.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${renderStatusBadge(overview.schema_ready ? 'success' : 'danger', overview.schema_ready ? 'Skema siap' : 'Skema belum siap')}
                    ${renderStatusBadge(schedulerTone, schedulerLabel)}
                    ${renderStatusBadge(overview.scheduler.api_managed ? 'warning' : 'neutral', overview.scheduler.api_managed ? 'API mengelola scheduler' : 'Scheduler tidak dikelola API')}
                </div>
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                ${renderMetricCard('Kandidat', String(overview.candidates.total), renderCategorySummary(overview.candidates.by_category))}
                ${renderMetricCard('Arsip aktif', String(overview.archives.available), `${overview.archives.purged} arsip sudah purge`)}
                ${renderMetricCard('Aksi gagal', String(failedActions), `${overview.actions.total} aksi tercatat`)}
                ${renderMetricCard('Policy global', `${policyValues.final_pdf_active_days} hari`, 'PDF final aktif sebelum arsip')}
            </div>
        </section>
    `;
}

function renderMetricCard(label: string, value: string, detail: string): string {
    return `
        <div class="${surfaceClass('muted', 'rounded-xl p-4')}">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500">${escapeFormHtml(label)}</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">${escapeFormHtml(value)}</p>
            <p class="${textClass.helper} mt-1">${escapeFormHtml(detail)}</p>
        </div>
    `;
}

function renderPolicy(): string {
    const policy = state.policy;
    if (!policy) return '';

    const values = policy.values;
    return `
        <section class="${surfaceClass('card', 'p-5 sm:p-6 space-y-5')}">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 class="text-lg font-bold text-gray-900">Kebijakan Global</h2>
                    <p class="${textClass.helper} mt-1">Nilai berlaku global. Panel ini tidak menyediakan override per jenis surat.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${renderStatusBadge(policy.scope === 'global' ? 'primary' : 'warning', `Scope: ${policy.scope}`)}
                    ${renderStatusBadge(policy.scheduler.enabled ? 'success' : 'neutral', policy.scheduler.enabled ? 'Scheduler aktif' : 'Scheduler nonaktif')}
                </div>
            </div>
            <form id="retention-policy-form" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                ${renderPolicyField('supporting_document_retention_days', values.supporting_document_retention_days, policy.defaults.supporting_document_retention_days)}
                ${renderPolicyField('intermediate_artifact_retention_days', values.intermediate_artifact_retention_days, policy.defaults.intermediate_artifact_retention_days)}
                ${renderPolicyField('final_pdf_active_days', values.final_pdf_active_days, policy.defaults.final_pdf_active_days)}
                ${renderPolicyField('archive_retention_days', values.archive_retention_days, policy.defaults.archive_retention_days)}
                <div class="md:col-span-2 xl:col-span-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button type="submit" class="${buttonClass('primary', 'md')}" id="retention-policy-save">Simpan Kebijakan</button>
                </div>
            </form>
        </section>
    `;
}

function renderPolicyField(key: keyof RetentionPolicyValues, value: number, fallback: number): string {
    return `
        <label class="block">
            <span class="text-sm font-bold text-gray-800">${escapeFormHtml(POLICY_LABELS[key])}</span>
            <input
                id="retention-policy-${escapeFormAttribute(key)}"
                name="${escapeFormAttribute(key)}"
                type="number"
                min="1"
                max="3650"
                value="${escapeFormAttribute(value)}"
                class="${inputClass('default', 'mt-2')}"
            />
            <span class="${textClass.helper} mt-2 block">Default ${escapeFormHtml(fallback)} hari</span>
        </label>
    `;
}

function renderCandidates(): string {
    return renderTableSection({
        title: 'Kandidat Retensi',
        helper: 'Daftar item eligible menurut dry-run server. Eksekusi selalu memeriksa ulang eligibility.',
        filterHtml: renderCandidateFilters(),
        actionsHtml: `<button type="button" id="retention-dry-run-button" class="${buttonClass('secondary', 'sm')}">Dry-run Filter</button>`,
        bodyHtml: renderCandidateTable(),
        paginationHtml: renderPagination('candidate', state.candidates.meta),
    });
}

function renderCandidateFilters(): string {
    return `
        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
            ${renderCategorySelect('retention-candidate-category', state.candidateFilters.category, 'Semua kategori')}
            ${renderTextInput('retention-candidate-letter-type', 'Jenis surat', state.candidateFilters.letterType)}
            ${renderTextInput('retention-candidate-application-id', 'ID aplikasi', state.candidateFilters.applicationId, 'number')}
            <div class="flex gap-2">
                <button type="button" id="retention-candidate-filter" class="${buttonClass('primary', 'sm', 'flex-1')}">Filter</button>
                <button type="button" id="retention-candidate-reset" class="${buttonClass('outline', 'sm')}">Reset</button>
            </div>
        </div>
    `;
}

function renderCandidateTable(): string {
    if (state.candidates.data.length === 0) return renderEmptyState('Tidak ada kandidat retensi.');

    const rows = state.candidates.data.map((item, index) => `
        <tr class="border-t border-gray-100">
            <td class="px-4 py-3 text-sm font-semibold text-gray-900">${escapeFormHtml(item.letter_type)} #${escapeFormHtml(item.application_id)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(CATEGORY_LABELS[item.category] ?? item.category)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(item.action)}</td>
            <td class="px-4 py-3">${renderStatusBadge(statusTone(item.status), item.status)}</td>
            <td class="px-4 py-3">${renderVerificationBadge(item.verification_state)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(formatDate(item.eligible_at))}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(item.error_code ?? '-')}</td>
            <td class="px-4 py-3 text-right">
                <button
                    type="button"
                    class="${buttonClass('danger', 'sm')}"
                    data-retention-action="execute"
                    data-retention-index="${escapeFormAttribute(index)}"
                    ${item.subject_id === null ? 'disabled' : ''}
                >
                    Eksekusi
                </button>
            </td>
        </tr>
    `).join('');

    return renderResponsiveTable(`
        <thead class="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
                <th class="px-4 py-3">Surat</th>
                <th class="px-4 py-3">Kategori</th>
                <th class="px-4 py-3">Aksi</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Verifikasi</th>
                <th class="px-4 py-3">Eligible</th>
                <th class="px-4 py-3">Error</th>
                <th class="px-4 py-3 text-right">Manual</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `);
}

function renderArchives(): string {
    return renderTableSection({
        title: 'Archive Pool',
        helper: 'Metadata arsip PDF final. Panel ini tidak menampilkan lokasi teknis atau browser file.',
        filterHtml: renderArchiveFilters(),
        actionsHtml: '',
        bodyHtml: renderArchiveTable(),
        paginationHtml: renderPagination('archive', state.archives.meta),
    });
}

function renderArchiveFilters(): string {
    return `
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            ${renderTextInput('retention-archive-letter-type', 'Jenis surat', state.archiveFilters.letterType)}
            ${renderTextInput('retention-archive-application-id', 'ID aplikasi', state.archiveFilters.applicationId, 'number')}
            <div class="flex gap-2">
                <button type="button" id="retention-archive-filter" class="${buttonClass('primary', 'sm', 'flex-1')}">Filter</button>
                <button type="button" id="retention-archive-reset" class="${buttonClass('outline', 'sm')}">Reset</button>
            </div>
        </div>
    `;
}

function renderArchiveTable(): string {
    if (state.archives.data.length === 0) return renderEmptyState('Belum ada arsip PDF final.');

    const rows = state.archives.data.map((item, index) => `
        <tr class="border-t border-gray-100">
            <td class="px-4 py-3 text-sm font-semibold text-gray-900">${escapeFormHtml(item.letter_type)} #${escapeFormHtml(item.application_id)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(item.phase)} v${escapeFormHtml(item.version)}</td>
            <td class="px-4 py-3">${renderStatusBadge(statusTone(item.retention_status ?? item.status), item.retention_status ?? item.status)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(formatDate(item.archived_at))}</td>
            <td class="px-4 py-3">${renderVerificationBadge(item.verification_state)}</td>
            <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                    <button type="button" class="${buttonClass('secondary', 'sm')}" data-retention-action="restore" data-retention-index="${escapeFormAttribute(index)}">Restore</button>
                    <button type="button" class="${buttonClass('danger', 'sm')}" data-retention-action="purge" data-retention-index="${escapeFormAttribute(index)}" ${item.archive_purged_at ? 'disabled' : ''}>Purge</button>
                </div>
            </td>
        </tr>
    `).join('');

    return renderResponsiveTable(`
        <thead class="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
                <th class="px-4 py-3">Surat</th>
                <th class="px-4 py-3">Fase</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Diarsipkan</th>
                <th class="px-4 py-3">Verifikasi</th>
                <th class="px-4 py-3 text-right">Aksi</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `);
}

function renderActions(): string {
    return renderTableSection({
        title: 'Audit Actions',
        helper: 'Riwayat aksi retensi manual dan sistem dengan ringkasan error aman.',
        filterHtml: renderActionFilters(),
        actionsHtml: '',
        bodyHtml: renderActionTable(),
        paginationHtml: renderPagination('action', state.actions.meta),
    });
}

function renderActionFilters(): string {
    return `
        <div class="grid grid-cols-1 gap-3 md:grid-cols-5">
            ${renderCategorySelect('retention-action-category', state.actionFilters.category, 'Semua kategori')}
            ${renderTextInput('retention-action-status', 'Status', state.actionFilters.status)}
            ${renderTextInput('retention-action-letter-type', 'Jenis surat', state.actionFilters.letterType)}
            ${renderTextInput('retention-action-application-id', 'ID aplikasi', state.actionFilters.applicationId, 'number')}
            <div class="flex gap-2">
                <button type="button" id="retention-action-filter" class="${buttonClass('primary', 'sm', 'flex-1')}">Filter</button>
                <button type="button" id="retention-action-reset" class="${buttonClass('outline', 'sm')}">Reset</button>
            </div>
        </div>
    `;
}

function renderActionTable(): string {
    if (state.actions.data.length === 0) return renderEmptyState('Belum ada aksi retensi.');

    const rows = state.actions.data.map((item) => `
        <tr class="border-t border-gray-100">
            <td class="px-4 py-3 text-sm font-semibold text-gray-900">${escapeFormHtml(item.letter_type)} #${escapeFormHtml(item.application_id)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(CATEGORY_LABELS[item.category] ?? item.category)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(item.action)}</td>
            <td class="px-4 py-3">${renderStatusBadge(statusTone(item.status), item.status)}</td>
            <td class="px-4 py-3">${renderVerificationBadge(item.verification_state)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(formatDate(item.executed_at ?? item.created_at))}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(item.error_code ?? '-')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(item.metadata.trigger)}${item.metadata.reason_present ? ' / reason' : ''}</td>
        </tr>
    `).join('');

    return renderResponsiveTable(`
        <thead class="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
                <th class="px-4 py-3">Surat</th>
                <th class="px-4 py-3">Kategori</th>
                <th class="px-4 py-3">Aksi</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Verifikasi</th>
                <th class="px-4 py-3">Waktu</th>
                <th class="px-4 py-3">Error</th>
                <th class="px-4 py-3">Sumber</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `);
}

function renderTableSection(options: {
    title: string;
    helper: string;
    filterHtml: string;
    actionsHtml: string;
    bodyHtml: string;
    paginationHtml: string;
}): string {
    return `
        <section class="${surfaceClass('card', 'p-5 sm:p-6 space-y-4')}">
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <h2 class="text-lg font-bold text-gray-900">${escapeFormHtml(options.title)}</h2>
                    <p class="${textClass.helper} mt-1">${escapeFormHtml(options.helper)}</p>
                </div>
                ${options.actionsHtml ? `<div>${options.actionsHtml}</div>` : ''}
            </div>
            ${options.filterHtml}
            ${options.bodyHtml}
            ${options.paginationHtml}
        </section>
    `;
}

function renderResponsiveTable(innerHtml: string): string {
    return `
        <div class="overflow-hidden rounded-xl border border-gray-100">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-100">${innerHtml}</table>
            </div>
        </div>
    `;
}

function renderPagination(scope: 'candidate' | 'archive' | 'action', meta: RetentionPaginationMeta): string {
    const previousDisabled = meta.current_page <= 1;
    const nextDisabled = meta.current_page >= meta.last_page;
    const pageInfo = `Halaman ${meta.current_page} dari ${meta.last_page} (${meta.total} item${meta.truncated ? ', dibatasi batch' : ''})`;

    return `
        <div class="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p class="${textClass.resultCount}">${escapeFormHtml(pageInfo)}</p>
            <div class="flex gap-2">
                <button type="button" class="${buttonClass('outline', 'sm')}" data-retention-page="${escapeFormAttribute(scope)}" data-page="${escapeFormAttribute(meta.current_page - 1)}" ${previousDisabled ? 'disabled' : ''}>Sebelumnya</button>
                <button type="button" class="${buttonClass('outline', 'sm')}" data-retention-page="${escapeFormAttribute(scope)}" data-page="${escapeFormAttribute(meta.current_page + 1)}" ${nextDisabled ? 'disabled' : ''}>Berikutnya</button>
            </div>
        </div>
    `;
}

function renderCategorySelect(id: string, value: CategoryFilter, placeholder: string): string {
    const options = RETENTION_CATEGORIES.map((category) => `
        <option value="${escapeFormAttribute(category)}" ${value === category ? 'selected' : ''}>${escapeFormHtml(CATEGORY_LABELS[category])}</option>
    `).join('');

    return `
        <label class="block">
            <span class="sr-only">${escapeFormHtml(placeholder)}</span>
            <select id="${escapeFormAttribute(id)}" class="${selectClass()}">
                <option value="">${escapeFormHtml(placeholder)}</option>
                ${options}
            </select>
        </label>
    `;
}

function renderTextInput(id: string, label: string, value: string, type: 'text' | 'number' = 'text'): string {
    return `
        <label class="block">
            <span class="sr-only">${escapeFormHtml(label)}</span>
            <input id="${escapeFormAttribute(id)}" type="${escapeFormAttribute(type)}" value="${escapeFormAttribute(value)}" placeholder="${escapeFormAttribute(label)}" class="${inputClass()}" />
        </label>
    `;
}

function renderCategorySummary(counts: Partial<Record<RetentionCategory, number>>): string {
    const visible = RETENTION_CATEGORIES
        .map((category) => `${CATEGORY_LABELS[category]}: ${counts[category] ?? 0}`)
        .join(', ');
    return visible || 'Tidak ada kandidat';
}

function attachPanelListeners(): void {
    document.getElementById('retention-policy-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        void savePolicy();
    });
    document.getElementById('retention-candidate-filter')?.addEventListener('click', () => void applyCandidateFilters());
    document.getElementById('retention-candidate-reset')?.addEventListener('click', () => void resetCandidateFilters());
    document.getElementById('retention-archive-filter')?.addEventListener('click', () => void applyArchiveFilters());
    document.getElementById('retention-archive-reset')?.addEventListener('click', () => void resetArchiveFilters());
    document.getElementById('retention-action-filter')?.addEventListener('click', () => void applyActionFilters());
    document.getElementById('retention-action-reset')?.addEventListener('click', () => void resetActionFilters());
    document.getElementById('retention-dry-run-button')?.addEventListener('click', () => void runCurrentDryRun());

    document.querySelectorAll<HTMLButtonElement>('[data-retention-action]').forEach((button) => {
        button.addEventListener('click', () => openReasonModal(button.dataset.retentionAction, button.dataset.retentionIndex));
    });
    document.querySelectorAll<HTMLButtonElement>('[data-retention-page]').forEach((button) => {
        button.addEventListener('click', () => void changePage(button.dataset.retentionPage, Number(button.dataset.page)));
    });
}

async function savePolicy(): Promise<void> {
    try {
        const values: RetentionPolicyValues = {
            supporting_document_retention_days: readPolicyNumber('supporting_document_retention_days'),
            intermediate_artifact_retention_days: readPolicyNumber('intermediate_artifact_retention_days'),
            final_pdf_active_days: readPolicyNumber('final_pdf_active_days'),
            archive_retention_days: readPolicyNumber('archive_retention_days'),
        };
        state.policy = await updateRetentionPolicy(values);
        state.overview = await getRetentionOverview();
        showSuccess('Kebijakan retensi diperbarui.');
        renderPage();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Kebijakan retensi gagal diperbarui.');
    }
}

function readPolicyNumber(key: keyof RetentionPolicyValues): number {
    const input = document.getElementById(`retention-policy-${key}`) as HTMLInputElement | null;
    const value = Number(input?.value ?? 0);
    if (!Number.isInteger(value) || value < 1 || value > 3650) {
        throw new Error(`${POLICY_LABELS[key]} harus berisi 1 sampai 3650 hari.`);
    }
    return value;
}

async function applyCandidateFilters(): Promise<void> {
    state.candidateFilters = {
        category: readCategory('retention-candidate-category'),
        letterType: readInput('retention-candidate-letter-type'),
        applicationId: readInput('retention-candidate-application-id'),
    };
    await reloadCandidates(1);
}

async function resetCandidateFilters(): Promise<void> {
    state.candidateFilters = { category: '', letterType: '', applicationId: '' };
    await reloadCandidates(1);
}

async function applyArchiveFilters(): Promise<void> {
    state.archiveFilters = {
        letterType: readInput('retention-archive-letter-type'),
        applicationId: readInput('retention-archive-application-id'),
    };
    await reloadArchives(1);
}

async function resetArchiveFilters(): Promise<void> {
    state.archiveFilters = { letterType: '', applicationId: '' };
    await reloadArchives(1);
}

async function applyActionFilters(): Promise<void> {
    state.actionFilters = {
        category: readCategory('retention-action-category'),
        status: readInput('retention-action-status'),
        letterType: readInput('retention-action-letter-type'),
        applicationId: readInput('retention-action-application-id'),
    };
    await reloadActions(1);
}

async function resetActionFilters(): Promise<void> {
    state.actionFilters = { category: '', status: '', letterType: '', applicationId: '' };
    await reloadActions(1);
}

async function reloadCandidates(page: number): Promise<void> {
    try {
        state.candidates = await getRetentionCandidates(buildCandidateQuery(state.candidateFilters, page));
        renderPage();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Kandidat retensi gagal dimuat.');
    }
}

async function reloadArchives(page: number): Promise<void> {
    try {
        state.archives = await getRetentionArchives(buildArchiveQuery(state.archiveFilters, page));
        renderPage();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Archive pool gagal dimuat.');
    }
}

async function reloadActions(page: number): Promise<void> {
    try {
        state.actions = await getRetentionActions(buildActionQuery(state.actionFilters, page));
        renderPage();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Riwayat aksi retensi gagal dimuat.');
    }
}

async function changePage(scope: string | undefined, page: number): Promise<void> {
    if (!Number.isInteger(page) || page < 1) return;
    if (scope === 'candidate') await reloadCandidates(page);
    if (scope === 'archive') await reloadArchives(page);
    if (scope === 'action') await reloadActions(page);
}

async function runCurrentDryRun(): Promise<void> {
    try {
        const category = state.candidateFilters.category;
        if (!category) {
            showError('Pilih kategori sebelum menjalankan dry-run manual.');
            return;
        }
        const result = await runRetentionDryRun({
            ...buildRunScope(state.candidateFilters),
            category,
            batch: 100,
        });
        showSuccess(`Dry-run selesai: ${result.total} aksi kandidat.`);
        state.candidates = await getRetentionCandidates(buildCandidateQuery(state.candidateFilters, state.candidates.meta.current_page));
        renderPage();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Dry-run retensi gagal dijalankan.');
    }
}

function openReasonModal(action: string | undefined, index: string | undefined): void {
    const itemIndex = Number(index);
    if (!Number.isInteger(itemIndex) || itemIndex < 0) return;

    if (action === 'execute') {
        const item = state.candidates.data[itemIndex];
        if (!item || item.subject_id === null) return;
        pendingReasonAction = {
            kind: 'execute',
            title: 'Eksekusi Kandidat Retensi',
            summary: `${CATEGORY_LABELS[item.category]} - ${item.letter_type} #${item.application_id}`,
            confirmLabel: 'Eksekusi',
            item,
        };
    } else if (action === 'restore') {
        const archive = state.archives.data[itemIndex];
        if (!archive) return;
        pendingReasonAction = {
            kind: 'restore',
            title: 'Restore Arsip PDF Final',
            summary: `${archive.letter_type} #${archive.application_id}`,
            confirmLabel: 'Restore',
            archiveId: archive.id,
        };
    } else if (action === 'purge') {
        const archive = state.archives.data[itemIndex];
        if (!archive || archive.archive_purged_at) return;
        pendingReasonAction = {
            kind: 'purge',
            title: 'Purge Arsip PDF Final',
            summary: `${archive.letter_type} #${archive.application_id}`,
            confirmLabel: 'Purge',
            archiveId: archive.id,
        };
    } else {
        return;
    }

    renderReasonModal();
}

function renderReasonModal(): void {
    const container = document.getElementById('retention-modal-container');
    if (!container || !pendingReasonAction) return;

    container.innerHTML = `
        <div class="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="retention-reason-title">
            <form id="retention-reason-form" class="${surfaceClass('card', 'w-full max-w-lg p-6 space-y-5')}">
                <div>
                    <h3 id="retention-reason-title" class="text-lg font-bold text-gray-900">${escapeFormHtml(pendingReasonAction.title)}</h3>
                    <p class="${textClass.helper} mt-1">${escapeFormHtml(pendingReasonAction.summary)}</p>
                </div>
                <label class="block">
                    <span class="text-sm font-bold text-gray-800">Alasan eksplisit</span>
                    <textarea id="retention-action-reason" class="${cx(inputClass(), 'mt-2 min-h-28 resize-y')}" minlength="10" maxlength="1000" placeholder="Tuliskan alasan aksi retensi manual"></textarea>
                    <span class="${textClass.helper} mt-2 block">Minimal 10 karakter. Alasan disimpan dalam audit backend.</span>
                </label>
                <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" id="retention-modal-cancel" class="${buttonClass('outline', 'md')}">Batal</button>
                    <button type="submit" id="retention-modal-confirm" class="${buttonClass(pendingReasonAction.kind === 'restore' ? 'primary' : 'danger', 'md')}">${escapeFormHtml(pendingReasonAction.confirmLabel)}</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('retention-modal-cancel')?.addEventListener('click', closeReasonModal);
    document.getElementById('retention-reason-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        void submitReasonAction();
    });
    (document.getElementById('retention-action-reason') as HTMLTextAreaElement | null)?.focus();
}

function closeReasonModal(): void {
    pendingReasonAction = null;
    const container = document.getElementById('retention-modal-container');
    if (container) container.innerHTML = '';
}

async function submitReasonAction(): Promise<void> {
    if (!pendingReasonAction) return;
    const reason = readInput('retention-action-reason');
    if (reason.length < 10) {
        showError('Alasan aksi retensi minimal 10 karakter.');
        return;
    }

    try {
        if (pendingReasonAction.kind === 'execute' && pendingReasonAction.item) {
            const item = pendingReasonAction.item;
            if (item.subject_id === null) return;
            await executeRetentionItem({
                category: item.category,
                letter_type: item.letter_type,
                application_id: item.application_id,
                subject_type: item.subject_type,
                subject_id: item.subject_id,
                reason,
            });
        } else if (pendingReasonAction.kind === 'restore' && pendingReasonAction.archiveId !== undefined) {
            await restoreRetentionArchive(pendingReasonAction.archiveId, reason);
        } else if (pendingReasonAction.kind === 'purge' && pendingReasonAction.archiveId !== undefined) {
            await purgeRetentionArchive(pendingReasonAction.archiveId, reason);
        }

        showSuccess('Aksi retensi selesai diproses.');
        closeReasonModal();
        await loadAllData();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Aksi retensi gagal diproses.');
    }
}

function buildCandidateQuery(filters: CandidateFilters, page: number): RetentionFilters {
    return {
        ...buildRunScope(filters),
        category: filters.category || undefined,
        page,
        per_page: PER_PAGE,
    };
}

function buildArchiveQuery(filters: ArchiveFilters, page: number): RetentionFilters {
    return {
        ...buildRunScope(filters),
        page,
        per_page: PER_PAGE,
    };
}

function buildActionQuery(filters: ActionFilters, page: number): RetentionFilters {
    return {
        ...buildRunScope(filters),
        category: filters.category || undefined,
        status: filters.status || undefined,
        page,
        per_page: PER_PAGE,
    };
}

function buildRunScope(filters: CandidateFilters | ArchiveFilters): RetentionFilters {
    const applicationId = Number(filters.applicationId);
    return {
        letter_type: filters.letterType.trim() || undefined,
        application_id: Number.isInteger(applicationId) && applicationId > 0 ? applicationId : undefined,
    };
}

function readCategory(id: string): CategoryFilter {
    const value = readInput(id);
    return RETENTION_CATEGORIES.includes(value as RetentionCategory) ? value as RetentionCategory : '';
}

function readInput(id: string): string {
    const input = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    return input?.value.trim() ?? '';
}

function statusTone(status: string): UiTone {
    if (['completed', 'deleted', 'archived', 'restored'].includes(status)) return 'success';
    if (['failed', 'blocked'].includes(status)) return 'danger';
    if (['dry_run', 'already_missing'].includes(status)) return 'info';
    if (['archive_purged'].includes(status)) return 'warning';
    return 'neutral';
}

function verificationTone(state: string): UiTone {
    if (state === 'verified') return 'success';
    if (state === 'verification_failed') return 'danger';
    if (state === 'not_available') return 'neutral';
    return 'info';
}

function verificationLabel(state: string): string {
    if (state === 'verified') return 'Terverifikasi';
    if (state === 'verification_failed') return 'Gagal verifikasi';
    if (state === 'not_available') return 'Tidak tersedia';
    return state;
}

function renderVerificationBadge(state: string): string {
    return renderStatusBadge(verificationTone(state), verificationLabel(state));
}

function formatDate(value: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}
