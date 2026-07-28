import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { hydrateSlaGovernance, slaGovernanceShell } from './sla-governance';
import { buttonClass, cx, inputClass, selectClass, surfaceClass, textClass, type UiTone } from '../shared/design-system';
import { escapeFormAttribute, escapeFormHtml } from '../shared/form-primitives';
import { renderEmptyState, renderErrorState, renderLoadingState, renderMetricCard, renderStatusBadge } from '../shared/ui-primitives';
import { showError, showSuccess } from '../shared/toast';
import {
    executeRetentionItem,
    getRetentionActions,
    getRetentionArchives,
    getRetentionAutomation,
    getRetentionCandidates,
    getRetentionOverview,
    getRetentionPolicy,
    purgeRetentionArchive,
    restoreRetentionArchive,
    runRetentionDryRun,
    updateRetentionAutomation,
    updateRetentionPolicy,
} from './retention/api';
import {
    RETENTION_CATEGORIES,
    type RetentionActionLog,
    type RetentionAutomationStatus,
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

type OperationalTab = 'candidates' | 'archives' | 'actions';

interface RetentionPanelState {
    loading: boolean;
    error: string | null;
    activeTab: OperationalTab;
    overview: RetentionOverview | null;
    automation: RetentionAutomationStatus | null;
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
    supporting_document: 'Berkas Pendukung',
    intermediate_artifact: 'File Sementara',
    final_official_pdf: 'PDF Final',
    archived_final_pdf: 'Arsip Final',
};

const POLICY_LABELS: Record<keyof RetentionPolicyValues, string> = {
    supporting_document_retention_days: 'Berkas Pendukung',
    intermediate_artifact_retention_days: 'File Sementara',
    final_pdf_active_days: 'PDF Final',
    archive_retention_days: 'Masa Simpan Arsip Final',
};

// What each masa-simpan field actually controls, in operator language.
const POLICY_DESCRIPTIONS: Record<keyof RetentionPolicyValues, string> = {
    supporting_document_retention_days: 'Lampiran yang diunggah pemohon. Dihapus otomatis setelah masa ini terlewati.',
    intermediate_artifact_retention_days: 'File proses sementara sebelum PDF final terbentuk. Dihapus setelah masa ini.',
    final_pdf_active_days: 'PDF resmi tetap aktif selama masa ini sebelum dipindahkan ke arsip.',
    archive_retention_days: 'Lama arsip PDF final disimpan sebelum boleh dihapus permanen.',
};

// Finite set of persisted action outcomes for the history filter dropdown.
const ACTION_STATUS_OPTIONS = ['completed', 'failed', 'deleted', 'archived', 'restored', 'archive_purged', 'blocked', 'already_missing'] as const;

const TRIGGER_LABELS: Record<string, string> = {
    manual: 'Manual',
    scheduler: 'Otomatis',
    system: 'Sistem',
    api: 'Manual',
};

let state: RetentionPanelState = initialState();
let pendingReasonAction: PendingReasonAction | null = null;
// Guards against double-submit of the write/destructive actions.
let policySaving = false;
let reasonSubmitting = false;
// Pending automation ON/OFF change (true = enabling) + its submit guard.
let pendingAutomation: { enabling: boolean } | null = null;
let automationSubmitting = false;

function initialState(): RetentionPanelState {
    return {
        loading: true,
        error: null,
        activeTab: 'candidates',
        overview: null,
        automation: null,
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
        const [overview, automation, policy, candidates, archives, actions] = await Promise.all([
            getRetentionOverview(),
            getRetentionAutomation(),
            getRetentionPolicy(),
            getRetentionCandidates(buildCandidateQuery(state.candidateFilters, 1)),
            getRetentionArchives(buildArchiveQuery(state.archiveFilters, 1)),
            getRetentionActions(buildActionQuery(state.actionFilters, 1)),
        ]);
        state = {
            ...state,
            loading: false,
            overview,
            automation,
            policy,
            candidates,
            archives,
            actions,
        };
    } catch (error) {
        state = {
            ...state,
            loading: false,
            error: error instanceof Error ? error.message : 'Halaman retensi surat gagal dimuat.',
        };
    }
    renderPage();
}

function renderPage(): void {
    renderDashboardLayout('Arsip & Masa Simpan', renderPanelContent(), 'super_admin', 'retention');
    attachPanelListeners();
    // Self-contained governance section: it loads/saves its own SLA policies and
    // is failure-isolated, so it never blocks the retention panel.
    if (!state.loading && !state.error) void hydrateSlaGovernance();
}

function renderPanelContent(): string {
    if (state.loading) return renderLoadingState('Memuat data retensi surat...');
    if (state.error) return renderErrorState(state.error);

    return `
        <div class="space-y-6">
            ${renderHeader()}
            ${renderOverview()}
            ${renderAutomationCard()}
            ${renderPolicy()}
            ${slaGovernanceShell()}
            ${renderOperationalSection()}
            <div id="retention-modal-container"></div>
        </div>
    `;
}

function renderHeader(): string {
    const overview = state.overview;
    // Two steady-state badges (automation + scope); the schema badge appears
    // only when there is a problem to flag. Automation status is the
    // SuperAdmin-controlled DB setting, not the raw config value.
    const badges = overview
        ? `
            ${renderStatusBadge(state.automation?.enabled ? 'success' : 'neutral', state.automation?.enabled ? 'Pengarsipan otomatis aktif' : 'Pengarsipan otomatis belum aktif')}
            ${renderStatusBadge('neutral', 'Kebijakan berlaku untuk semua jenis surat')}
            ${overview.schema_ready ? '' : renderStatusBadge('danger', 'Sistem arsip belum siap')}
        `
        : '';

    return `
        <section class="${surfaceClass('card', 'p-5 sm:p-6')}">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Kearsipan Surat</p>
                    <h2 class="mt-1 text-2xl font-bold text-gray-900">Retensi &amp; Arsip Surat</h2>
                    <p class="mt-2 max-w-3xl text-sm text-gray-500">Atur masa simpan berkas surat, cek dokumen yang sudah waktunya diarsipkan, lalu arsipkan, pulihkan, atau hapus permanen bila diperlukan.</p>
                    <p class="mt-1 max-w-3xl text-xs text-gray-400"><span class="font-semibold text-gray-500">Cek Dokumen</span> aman dan tidak mengubah data. Hanya <span class="font-semibold text-gray-500">Proses</span> dan <span class="font-semibold text-gray-500">Hapus Permanen</span> yang mengubah berkas — keduanya meminta konfirmasi dan alasan.</p>
                </div>
                ${badges ? `<div class="flex flex-wrap gap-2">${badges}</div>` : ''}
            </div>
        </section>
    `;
}

function renderOperationalSection(): string {
    const tabs: { id: OperationalTab; label: string }[] = [
        { id: 'candidates', label: 'Siap Diarsipkan' },
        { id: 'archives', label: 'Arsip Tersimpan' },
        { id: 'actions', label: 'Riwayat Tindakan' },
    ];
    const tabBar = tabs.map((tab) => `
        <button type="button" role="tab" data-retention-tab="${tab.id}" aria-selected="${state.activeTab === tab.id}" class="rounded-xl px-4 py-2.5 text-sm font-bold ${state.activeTab === tab.id ? 'bg-teal-700 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}">${tab.label}</button>
    `).join('');

    const body = state.activeTab === 'candidates'
        ? renderCandidates()
        : state.activeTab === 'archives'
            ? renderArchives()
            : renderActions();

    return `
        <section class="${surfaceClass('card', 'p-5 sm:p-6 space-y-5')}">
            <div class="flex flex-wrap gap-2" role="tablist" aria-label="Bagian arsip surat">${tabBar}</div>
            ${body}
        </section>
    `;
}

function renderTabContent(options: {
    helper: string;
    actionsHtml: string;
    filterHtml: string;
    bodyHtml: string;
    paginationHtml: string;
}): string {
    return `
        <div class="space-y-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p class="${textClass.helper} max-w-2xl">${escapeFormHtml(options.helper)}</p>
                ${options.actionsHtml ? `<div class="shrink-0">${options.actionsHtml}</div>` : ''}
            </div>
            ${options.filterHtml}
            ${options.bodyHtml}
            ${options.paginationHtml}
        </div>
    `;
}

function renderRichEmptyState(title: string, subtitle?: string): string {
    return `
        <div class="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center">
            <p class="text-sm font-bold text-gray-700">${escapeFormHtml(title)}</p>
            ${subtitle ? `<p class="mt-1 text-sm text-gray-500">${escapeFormHtml(subtitle)}</p>` : ''}
        </div>
    `;
}

function renderOverview(): string {
    const overview = state.overview;
    if (!overview) return renderEmptyState('Ringkasan arsip belum tersedia.');

    const failedActions = overview.actions.by_status.failed ?? 0;
    const policyValues = overview.policy.values;

    return `
        <section class="${surfaceClass('card', 'p-5 sm:p-6 space-y-5')}">
            <div>
                <h2 class="text-lg font-bold text-gray-900">Ringkasan Arsip</h2>
                <p class="${textClass.helper} mt-1">Gambaran cepat kondisi penyimpanan dan pengarsipan surat saat ini.</p>
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                ${renderMetricCard('Siap Diarsipkan', String(overview.candidates.total), renderCategorySummary(overview.candidates.by_category))}
                ${renderMetricCard('Arsip Tersimpan', String(overview.archives.available), `${overview.archives.purged} arsip telah dihapus permanen`)}
                ${renderMetricCard('Perlu Ditinjau', String(failedActions), `dari ${overview.actions.total} tindakan tercatat`, failedActions > 0
                    ? `<button type="button" data-retention-goto="actions" class="mt-2 text-xs font-bold text-teal-700 hover:underline">Lihat Riwayat Tindakan</button>`
                    : '')}
                ${renderMetricCard('Masa Simpan PDF Final', `${policyValues.final_pdf_active_days} hari`, 'sebelum dipindahkan ke arsip')}
            </div>
        </section>
    `;
}

function automationHealthText(auto: RetentionAutomationStatus): string {
    switch (auto.health_status) {
        case 'disabled': return 'Belum aktif.';
        case 'enabled_waiting_first_run': return 'Menunggu jadwal pertama.';
        case 'healthy': return `Terakhir berhasil: ${formatDate(auto.last_success_at)}`;
        case 'failed': return `Gagal terakhir: ${auto.last_failure_message ?? formatDate(auto.last_failure_at)}`;
        case 'needs_server_attention': return 'Jadwal server perlu dicek.';
        case 'unavailable': return 'Sistem arsip belum siap.';
        default: return '';
    }
}

function renderAutomationCard(): string {
    const auto = state.automation;
    if (!auto) return '';
    const enabled = auto.enabled;
    const unavailable = auto.health_status === 'unavailable' || !auto.schema_ready;
    const warn = auto.health_status === 'failed' || auto.health_status === 'needs_server_attention';
    const track = enabled ? 'bg-teal-600' : 'bg-gray-300';
    const knob = enabled ? 'translate-x-5' : 'translate-x-1';

    return `
        <section class="${surfaceClass('card', 'p-5 sm:p-6')}">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                    <h2 class="text-lg font-bold text-gray-900">Pengaturan Otomatis</h2>
                    <p class="${textClass.helper} mt-1 max-w-2xl">Saat aktif, sistem memeriksa dokumen sesuai jadwal server dan mengarsipkan atau menghapus berkas sesuai kebijakan.</p>
                </div>
                <div class="flex items-center gap-3 sm:shrink-0">
                    <div class="text-right">
                        <p class="text-sm font-bold text-gray-800">Pengarsipan otomatis</p>
                        <p id="retention-automation-state" class="text-xs font-semibold ${enabled ? 'text-teal-700' : 'text-gray-500'}">${enabled ? 'Aktif' : 'Belum aktif'}</p>
                    </div>
                    <button type="button" role="switch" id="retention-automation-toggle"
                        aria-checked="${enabled ? 'true' : 'false'}" aria-label="Pengarsipan otomatis"
                        ${unavailable ? 'aria-disabled="true" disabled' : ''}
                        class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${track}">
                        <span class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${knob}"></span>
                    </button>
                </div>
            </div>
            <div class="mt-4 border-t border-gray-100 pt-4">
                <p id="retention-automation-health" class="text-xs ${warn ? 'font-semibold text-amber-700' : 'text-gray-500'}">${escapeFormHtml(automationHealthText(auto))}</p>
                <p class="mt-1 max-w-2xl text-xs text-gray-400">Tombol ini mengatur pengarsipan di aplikasi. Jadwal server tetap harus berjalan agar pengarsipan otomatis dieksekusi.</p>
                ${unavailable ? '<p class="mt-1 text-xs font-semibold text-amber-700">Pengarsipan belum bisa diubah karena sistem arsip belum siap.</p>' : ''}
                ${auto.updated_by ? `<p class="mt-1 text-xs text-gray-400">Terakhir diubah oleh: <span class="font-semibold text-gray-500">${escapeFormHtml(auto.updated_by)}</span></p>` : ''}
            </div>
        </section>
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
                    <h2 class="text-lg font-bold text-gray-900">Kebijakan Penyimpanan</h2>
                    <p class="${textClass.helper} mt-1">Atur berapa lama tiap jenis berkas disimpan sebelum diarsipkan atau dihapus. Berlaku untuk semua surat.</p>
                </div>
            </div>
            <form id="retention-policy-form" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                ${renderPolicyField('supporting_document_retention_days', values.supporting_document_retention_days, policy.defaults.supporting_document_retention_days)}
                ${renderPolicyField('intermediate_artifact_retention_days', values.intermediate_artifact_retention_days, policy.defaults.intermediate_artifact_retention_days)}
                ${renderPolicyField('final_pdf_active_days', values.final_pdf_active_days, policy.defaults.final_pdf_active_days)}
                ${renderPolicyField('archive_retention_days', values.archive_retention_days, policy.defaults.archive_retention_days)}
                <div class="md:col-span-2 xl:col-span-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <p class="${textClass.helper} sm:mr-auto">Perubahan berlaku untuk pemeriksaan berikutnya, tidak menghapus dokumen yang sudah ada.</p>
                    <button type="submit" class="${buttonClass('primary', 'md')}" id="retention-policy-save">Simpan Kebijakan</button>
                </div>
            </form>
        </section>
    `;
}

function renderPolicyField(key: keyof RetentionPolicyValues, value: number, fallback: number): string {
    return `
        <label class="block rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <span class="text-sm font-bold text-gray-800">${escapeFormHtml(POLICY_LABELS[key])}</span>
            <span class="${textClass.helper} mt-1 block">${escapeFormHtml(POLICY_DESCRIPTIONS[key])}</span>
            <span class="mt-3 flex items-center gap-2">
                <input
                    id="retention-policy-${escapeFormAttribute(key)}"
                    name="${escapeFormAttribute(key)}"
                    type="number"
                    min="1"
                    max="3650"
                    value="${escapeFormAttribute(value)}"
                    class="${inputClass('default', 'w-24')}"
                />
                <span class="text-sm font-semibold text-gray-500">hari</span>
            </span>
            <span class="${textClass.helper} mt-2 block">Bawaan ${escapeFormHtml(fallback)} hari</span>
        </label>
    `;
}

function renderCandidates(): string {
    return renderTabContent({
        helper: 'Dokumen yang sudah melewati masa simpan dan siap diarsipkan atau dihapus. Sistem memeriksa ulang setiap kali tindakan dijalankan.',
        actionsHtml: `
            <div class="flex flex-col items-start gap-1 sm:items-end">
                <button type="button" id="retention-dry-run-button" class="${buttonClass('secondary', 'sm')}">Cek Dokumen</button>
                <span class="text-[11px] text-gray-400">Aman, tidak mengubah data.</span>
            </div>
        `,
        filterHtml: renderCandidateFilters(),
        bodyHtml: renderCandidateTable(),
        paginationHtml: renderPagination('candidate', state.candidates.meta),
    });
}

function renderCandidateFilters(): string {
    return `
        <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                ${renderCategorySelect('retention-candidate-category', 'Kategori berkas', state.candidateFilters.category, 'Semua kategori')}
                ${renderTextInput('retention-candidate-letter-type', 'Jenis surat', state.candidateFilters.letterType, 'text', 'mis. surat-tugas')}
                ${renderTextInput('retention-candidate-application-id', 'ID pengajuan', state.candidateFilters.applicationId, 'number', 'mis. 44')}
            </div>
            <div class="flex flex-wrap justify-end gap-3">
                <button type="button" id="retention-candidate-reset" class="${buttonClass('outline', 'sm')}">Reset</button>
                <button type="button" id="retention-candidate-filter" class="${buttonClass('primary', 'sm')}">Terapkan Filter</button>
            </div>
        </div>
    `;
}

function renderCandidateTable(): string {
    if (state.candidates.data.length === 0) {
        return renderRichEmptyState(
            'Belum ada dokumen yang sudah melewati masa simpan.',
            'Cek kembali setelah kebijakan disimpan atau setelah ada dokumen baru.',
        );
    }

    const rows = state.candidates.data.map((item, index) => `
        <tr class="border-t border-gray-100">
            <td class="px-4 py-3 text-sm font-semibold text-gray-900">${escapeFormHtml(item.letter_type)} #${escapeFormHtml(item.application_id)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(CATEGORY_LABELS[item.category] ?? item.category)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(actionLabel(item.action))}</td>
            <td class="px-4 py-3">${renderStatusBadge(statusTone(item.status), statusLabel(item.status))}</td>
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
                    Proses
                </button>
            </td>
        </tr>
    `).join('');

    return renderResponsiveTable(`
        <thead class="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
                <th class="px-4 py-3">Surat</th>
                <th class="px-4 py-3">Jenis Berkas</th>
                <th class="px-4 py-3">Tindakan</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Verifikasi</th>
                <th class="px-4 py-3">Siap Sejak</th>
                <th class="px-4 py-3">Catatan</th>
                <th class="px-4 py-3 text-right">Proses</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `);
}

function renderArchives(): string {
    return renderTabContent({
        helper: 'Arsip PDF final yang tersimpan. Anda dapat memulihkannya kembali atau menghapusnya permanen bila diperlukan.',
        actionsHtml: '',
        filterHtml: renderArchiveFilters(),
        bodyHtml: renderArchiveTable(),
        paginationHtml: renderPagination('archive', state.archives.meta),
    });
}

function renderArchiveFilters(): string {
    return `
        <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                ${renderTextInput('retention-archive-letter-type', 'Jenis surat', state.archiveFilters.letterType, 'text', 'mis. surat-tugas')}
                ${renderTextInput('retention-archive-application-id', 'ID pengajuan', state.archiveFilters.applicationId, 'number', 'mis. 44')}
            </div>
            <div class="flex flex-wrap justify-end gap-3">
                <button type="button" id="retention-archive-reset" class="${buttonClass('outline', 'sm')}">Reset</button>
                <button type="button" id="retention-archive-filter" class="${buttonClass('primary', 'sm')}">Terapkan Filter</button>
            </div>
        </div>
    `;
}

function renderArchiveTable(): string {
    if (state.archives.data.length === 0) return renderRichEmptyState('Belum ada arsip final yang tersimpan.');

    const rows = state.archives.data.map((item, index) => `
        <tr class="border-t border-gray-100">
            <td class="px-4 py-3 text-sm font-semibold text-gray-900">${escapeFormHtml(item.letter_type)} #${escapeFormHtml(item.application_id)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(item.phase)} v${escapeFormHtml(item.version)}</td>
            <td class="px-4 py-3">${renderStatusBadge(statusTone(item.retention_status ?? item.status), statusLabel(item.retention_status ?? item.status))}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(formatDate(item.archived_at))}</td>
            <td class="px-4 py-3">${renderVerificationBadge(item.verification_state)}</td>
            <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                    <button type="button" class="${buttonClass('secondary', 'sm')}" data-retention-action="restore" data-retention-index="${escapeFormAttribute(index)}">Pulihkan</button>
                    <button type="button" class="${buttonClass('danger', 'sm')}" data-retention-action="purge" data-retention-index="${escapeFormAttribute(index)}" ${item.archive_purged_at ? 'disabled' : ''}>Hapus Permanen</button>
                </div>
            </td>
        </tr>
    `).join('');

    return renderResponsiveTable(`
        <thead class="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
                <th class="px-4 py-3">Surat</th>
                <th class="px-4 py-3">Tahap</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Diarsipkan</th>
                <th class="px-4 py-3">Verifikasi</th>
                <th class="px-4 py-3 text-right">Tindakan</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `);
}

function renderActions(): string {
    return renderTabContent({
        helper: 'Catatan seluruh tindakan pengarsipan, baik yang dilakukan manual maupun otomatis oleh sistem.',
        actionsHtml: '',
        filterHtml: renderActionFilters(),
        bodyHtml: renderActionTable(),
        paginationHtml: renderPagination('action', state.actions.meta),
    });
}

function renderActionFilters(): string {
    return `
        <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                ${renderCategorySelect('retention-action-category', 'Kategori berkas', state.actionFilters.category, 'Semua kategori')}
                ${renderStatusSelect('retention-action-status', 'Status', state.actionFilters.status)}
                ${renderTextInput('retention-action-letter-type', 'Jenis surat', state.actionFilters.letterType, 'text', 'mis. surat-tugas')}
                ${renderTextInput('retention-action-application-id', 'ID pengajuan', state.actionFilters.applicationId, 'number', 'mis. 44')}
            </div>
            <div class="flex flex-wrap justify-end gap-3">
                <button type="button" id="retention-action-reset" class="${buttonClass('outline', 'sm')}">Reset</button>
                <button type="button" id="retention-action-filter" class="${buttonClass('primary', 'sm')}">Terapkan Filter</button>
            </div>
        </div>
    `;
}

function renderActionTable(): string {
    if (state.actions.data.length === 0) return renderRichEmptyState('Belum ada tindakan pengarsipan.');

    const rows = state.actions.data.map((item) => `
        <tr class="border-t border-gray-100">
            <td class="px-4 py-3 text-sm font-semibold text-gray-900">${escapeFormHtml(item.letter_type)} #${escapeFormHtml(item.application_id)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(CATEGORY_LABELS[item.category] ?? item.category)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(actionLabel(item.action))}</td>
            <td class="px-4 py-3">${renderStatusBadge(statusTone(item.status), statusLabel(item.status))}</td>
            <td class="px-4 py-3">${renderVerificationBadge(item.verification_state)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(formatDate(item.executed_at ?? item.created_at))}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(item.error_code ?? '-')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeFormHtml(triggerLabel(item.metadata.trigger))}${item.metadata.reason_present ? ' · dengan alasan' : ''}</td>
        </tr>
    `).join('');

    return renderResponsiveTable(`
        <thead class="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
                <th class="px-4 py-3">Surat</th>
                <th class="px-4 py-3">Jenis Berkas</th>
                <th class="px-4 py-3">Tindakan</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Verifikasi</th>
                <th class="px-4 py-3">Waktu</th>
                <th class="px-4 py-3">Catatan</th>
                <th class="px-4 py-3">Sumber</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `);
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
    // Single page (incl. empty list) needs no pager — avoids "Halaman 1 dari 1 · 0 data".
    if (meta.last_page <= 1) return '';
    const previousDisabled = meta.current_page <= 1;
    const nextDisabled = meta.current_page >= meta.last_page;
    const pageInfo = `Halaman ${meta.current_page} dari ${meta.last_page} · ${meta.total} data${meta.truncated ? ' (sebagian ditampilkan)' : ''}`;

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

function fieldLabel(label: string): string {
    return `<span class="text-xs font-bold text-gray-600">${escapeFormHtml(label)}</span>`;
}

function renderCategorySelect(id: string, label: string, value: CategoryFilter, placeholder: string): string {
    const options = RETENTION_CATEGORIES.map((category) => `
        <option value="${escapeFormAttribute(category)}" ${value === category ? 'selected' : ''}>${escapeFormHtml(CATEGORY_LABELS[category])}</option>
    `).join('');

    return `
        <label class="block">
            ${fieldLabel(label)}
            <select id="${escapeFormAttribute(id)}" class="${selectClass('default', 'mt-2')}">
                <option value="">${escapeFormHtml(placeholder)}</option>
                ${options}
            </select>
        </label>
    `;
}

function renderStatusSelect(id: string, label: string, value: string): string {
    const options = ACTION_STATUS_OPTIONS.map((status) => `
        <option value="${escapeFormAttribute(status)}" ${value === status ? 'selected' : ''}>${escapeFormHtml(statusLabel(status))}</option>
    `).join('');

    return `
        <label class="block">
            ${fieldLabel(label)}
            <select id="${escapeFormAttribute(id)}" class="${selectClass('default', 'mt-2')}">
                <option value="">Semua status</option>
                ${options}
            </select>
        </label>
    `;
}

function renderTextInput(id: string, label: string, value: string, type: 'text' | 'number' = 'text', placeholder = ''): string {
    return `
        <label class="block">
            ${fieldLabel(label)}
            <input id="${escapeFormAttribute(id)}" type="${escapeFormAttribute(type)}" value="${escapeFormAttribute(value)}" placeholder="${escapeFormAttribute(placeholder)}" class="${inputClass('default', 'mt-2')}" />
        </label>
    `;
}

function renderCategorySummary(counts: Partial<Record<RetentionCategory, number>>): string {
    const visible = RETENTION_CATEGORIES
        .map((category) => `${CATEGORY_LABELS[category]}: ${counts[category] ?? 0}`)
        .join(', ');
    return visible || 'Belum ada';
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
    document.getElementById('retention-automation-toggle')?.addEventListener('click', () => {
        openAutomationModal(!(state.automation?.enabled ?? false));
    });

    document.querySelectorAll<HTMLButtonElement>('[data-retention-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            const tab = button.dataset.retentionTab as OperationalTab | undefined;
            if (!tab || tab === state.activeTab) return;
            state.activeTab = tab;
            renderPage();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('[data-retention-goto]').forEach((button) => {
        button.addEventListener('click', () => {
            const tab = button.dataset.retentionGoto as OperationalTab | undefined;
            if (!tab) return;
            state.activeTab = tab;
            renderPage();
        });
    });

    document.querySelectorAll<HTMLButtonElement>('[data-retention-action]').forEach((button) => {
        button.addEventListener('click', () => openReasonModal(button.dataset.retentionAction, button.dataset.retentionIndex));
    });
    document.querySelectorAll<HTMLButtonElement>('[data-retention-page]').forEach((button) => {
        button.addEventListener('click', () => void changePage(button.dataset.retentionPage, Number(button.dataset.page)));
    });
}

async function savePolicy(): Promise<void> {
    if (policySaving) return;

    let values: RetentionPolicyValues;
    try {
        values = {
            supporting_document_retention_days: readPolicyNumber('supporting_document_retention_days'),
            intermediate_artifact_retention_days: readPolicyNumber('intermediate_artifact_retention_days'),
            final_pdf_active_days: readPolicyNumber('final_pdf_active_days'),
            archive_retention_days: readPolicyNumber('archive_retention_days'),
        };
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Nilai kebijakan tidak valid.');
        return;
    }

    // Disable the button directly so edits survive an error (no re-render yet).
    const saveButton = document.getElementById('retention-policy-save') as HTMLButtonElement | null;
    policySaving = true;
    if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Menyimpan...'; }

    try {
        state.policy = await updateRetentionPolicy(values);
        state.overview = await getRetentionOverview();
        policySaving = false;
        showSuccess('Kebijakan penyimpanan berhasil disimpan.');
        renderPage();
    } catch (error) {
        policySaving = false;
        if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Simpan Kebijakan'; }
        showError(error instanceof Error ? error.message : 'Kebijakan penyimpanan gagal disimpan.');
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
        showError(error instanceof Error ? error.message : 'Daftar dokumen gagal dimuat.');
    }
}

async function reloadArchives(page: number): Promise<void> {
    try {
        state.archives = await getRetentionArchives(buildArchiveQuery(state.archiveFilters, page));
        renderPage();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Arsip tersimpan gagal dimuat.');
    }
}

async function reloadActions(page: number): Promise<void> {
    try {
        state.actions = await getRetentionActions(buildActionQuery(state.actionFilters, page));
        renderPage();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Riwayat tindakan gagal dimuat.');
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
            showError('Pilih kategori terlebih dahulu untuk memeriksa ulang.');
            return;
        }
        const result = await runRetentionDryRun({
            ...buildRunScope(state.candidateFilters),
            category,
            batch: 100,
        });
        showSuccess(`Pemeriksaan selesai: ${result.total} dokumen siap diproses.`);
        state.candidates = await getRetentionCandidates(buildCandidateQuery(state.candidateFilters, state.candidates.meta.current_page));
        renderPage();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Pemeriksaan gagal dijalankan.');
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
            title: 'Proses Dokumen Ini?',
            summary: `${CATEGORY_LABELS[item.category]} — ${item.letter_type} #${item.application_id}. Berkas akan diarsipkan atau dihapus sesuai kebijakan.`,
            confirmLabel: 'Proses',
            item,
        };
    } else if (action === 'restore') {
        const archive = state.archives.data[itemIndex];
        if (!archive) return;
        pendingReasonAction = {
            kind: 'restore',
            title: 'Pulihkan Arsip Ini?',
            summary: `${archive.letter_type} #${archive.application_id} akan dikembalikan dari arsip.`,
            confirmLabel: 'Pulihkan',
            archiveId: archive.id,
        };
    } else if (action === 'purge') {
        const archive = state.archives.data[itemIndex];
        if (!archive || archive.archive_purged_at) return;
        pendingReasonAction = {
            kind: 'purge',
            title: 'Hapus Arsip Permanen?',
            summary: `${archive.letter_type} #${archive.application_id} akan dihapus permanen dan tidak dapat dipulihkan.`,
            confirmLabel: 'Hapus Permanen',
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
                    <span class="text-sm font-bold text-gray-800">Alasan tindakan</span>
                    <textarea id="retention-action-reason" class="${cx(inputClass(), 'mt-2 min-h-28 resize-y')}" minlength="10" maxlength="1000" placeholder="Tuliskan alasan tindakan ini"></textarea>
                    <span class="${textClass.helper} mt-2 block">Minimal 10 karakter. Alasan ini akan tercatat di riwayat.</span>
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
    reasonSubmitting = false;
    const container = document.getElementById('retention-modal-container');
    if (container) container.innerHTML = '';
}

const REASON_SUCCESS: Record<PendingReasonAction['kind'], string> = {
    execute: 'Dokumen berhasil diproses. Cek Riwayat Tindakan untuk detailnya.',
    restore: 'Arsip berhasil dipulihkan dan kembali tersedia.',
    purge: 'Arsip berhasil dihapus permanen.',
};

async function submitReasonAction(): Promise<void> {
    if (!pendingReasonAction || reasonSubmitting) return;
    const reason = readInput('retention-action-reason');
    if (reason.length < 10) {
        showError('Alasan minimal 10 karakter.');
        return;
    }

    const kind = pendingReasonAction.kind;
    // Disable both buttons for the duration to prevent a double submit.
    const confirmButton = document.getElementById('retention-modal-confirm') as HTMLButtonElement | null;
    const cancelButton = document.getElementById('retention-modal-cancel') as HTMLButtonElement | null;
    reasonSubmitting = true;
    if (confirmButton) { confirmButton.disabled = true; confirmButton.textContent = 'Memproses...'; }
    if (cancelButton) cancelButton.disabled = true;

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

        showSuccess(REASON_SUCCESS[kind]);
        closeReasonModal();
        await loadAllData();
    } catch (error) {
        reasonSubmitting = false;
        if (confirmButton) { confirmButton.disabled = false; confirmButton.textContent = pendingReasonAction?.confirmLabel ?? 'Konfirmasi'; }
        if (cancelButton) cancelButton.disabled = false;
        showError(error instanceof Error ? error.message : 'Tindakan gagal diproses.');
    }
}

function openAutomationModal(enabling: boolean): void {
    pendingAutomation = { enabling };
    automationSubmitting = false;
    renderAutomationModal();
}

function renderAutomationModal(): void {
    const container = document.getElementById('retention-modal-container');
    if (!container || !pendingAutomation) return;
    const enabling = pendingAutomation.enabling;
    const policy = state.policy?.values;

    const policySummary = enabling && policy ? `
        <ul class="mt-3 space-y-1 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
            <li>${escapeFormHtml(POLICY_LABELS.supporting_document_retention_days)}: <strong>${escapeFormHtml(policy.supporting_document_retention_days)} hari</strong></li>
            <li>${escapeFormHtml(POLICY_LABELS.intermediate_artifact_retention_days)}: <strong>${escapeFormHtml(policy.intermediate_artifact_retention_days)} hari</strong></li>
            <li>${escapeFormHtml(POLICY_LABELS.final_pdf_active_days)}: <strong>${escapeFormHtml(policy.final_pdf_active_days)} hari</strong></li>
            <li>${escapeFormHtml(POLICY_LABELS.archive_retention_days)}: <strong>${escapeFormHtml(policy.archive_retention_days)} hari</strong></li>
        </ul>
    ` : '';

    container.innerHTML = `
        <div class="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="retention-automation-title">
            <form id="retention-automation-form" class="${surfaceClass('card', 'w-full max-w-lg p-6 space-y-5')}">
                <div>
                    <h3 id="retention-automation-title" class="text-lg font-bold text-gray-900">${enabling ? 'Aktifkan Pengarsipan Otomatis?' : 'Nonaktifkan Pengarsipan Otomatis?'}</h3>
                    <p class="${textClass.helper} mt-1">${enabling
                        ? 'Saat aktif, sistem dapat mengarsipkan atau menghapus berkas secara otomatis sesuai kebijakan berikut.'
                        : 'Sistem berhenti memeriksa dan memproses dokumen secara otomatis sampai diaktifkan kembali atau diproses manual.'}</p>
                    ${policySummary}
                    ${enabling ? '<p class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">Dokumen yang sudah melewati masa simpan dapat diarsipkan atau dihapus otomatis sesuai kebijakan di atas.</p>' : ''}
                </div>
                <label class="block">
                    <span class="text-sm font-bold text-gray-800">Alasan tindakan</span>
                    <textarea id="retention-automation-reason" class="${cx(inputClass(), 'mt-2 min-h-24 resize-y')}" minlength="10" maxlength="1000" placeholder="Tuliskan alasan perubahan ini"></textarea>
                    <span class="${textClass.helper} mt-2 block">Minimal 10 karakter. Alasan ini akan tercatat di riwayat.</span>
                </label>
                <label class="flex items-start gap-2 text-sm text-gray-700">
                    <input type="checkbox" id="retention-automation-ack" class="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500">
                    <span>${enabling
                        ? 'Saya memahami dokumen dapat diarsipkan atau dihapus otomatis sesuai kebijakan.'
                        : 'Saya memahami pengarsipan otomatis akan berhenti sampai diaktifkan kembali.'}</span>
                </label>
                ${enabling ? '' : `
                    <label class="block">
                        <span class="text-sm font-bold text-gray-800">Ketik NONAKTIFKAN untuk konfirmasi</span>
                        <input id="retention-automation-phrase" type="text" autocomplete="off" class="${inputClass('default', 'mt-2')}" placeholder="NONAKTIFKAN">
                    </label>
                `}
                <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" id="retention-automation-cancel" class="${buttonClass('outline', 'md')}">Batal</button>
                    <button type="submit" id="retention-automation-confirm" class="${buttonClass(enabling ? 'primary' : 'danger', 'md')}">${enabling ? 'Aktifkan' : 'Nonaktifkan'}</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('retention-automation-cancel')?.addEventListener('click', closeAutomationModal);
    document.getElementById('retention-automation-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        void submitAutomationChange();
    });
    (document.getElementById('retention-automation-reason') as HTMLTextAreaElement | null)?.focus();
}

function closeAutomationModal(): void {
    pendingAutomation = null;
    automationSubmitting = false;
    const container = document.getElementById('retention-modal-container');
    if (container) container.innerHTML = '';
}

async function submitAutomationChange(): Promise<void> {
    if (!pendingAutomation || automationSubmitting) return;
    const enabling = pendingAutomation.enabling;
    const reason = readInput('retention-automation-reason');
    const acknowledged = (document.getElementById('retention-automation-ack') as HTMLInputElement | null)?.checked ?? false;
    const phrase = readInput('retention-automation-phrase');

    if (reason.length < 10) { showError('Alasan minimal 10 karakter.'); return; }
    if (!acknowledged) { showError('Centang kotak persetujuan untuk melanjutkan.'); return; }
    if (!enabling && phrase !== 'NONAKTIFKAN') { showError('Ketik NONAKTIFKAN untuk mengonfirmasi penonaktifan.'); return; }

    const confirmButton = document.getElementById('retention-automation-confirm') as HTMLButtonElement | null;
    const cancelButton = document.getElementById('retention-automation-cancel') as HTMLButtonElement | null;
    automationSubmitting = true;
    if (confirmButton) { confirmButton.disabled = true; confirmButton.textContent = enabling ? 'Mengaktifkan…' : 'Menonaktifkan…'; }
    if (cancelButton) cancelButton.disabled = true;

    try {
        // Bind the switch to the server: it flips only from the returned state.
        state.automation = await updateRetentionAutomation({
            enabled: enabling,
            reason,
            acknowledged,
            ...(enabling ? {} : { confirmation_phrase: phrase }),
        });
        showSuccess(enabling ? 'Pengarsipan otomatis berhasil diaktifkan.' : 'Pengarsipan otomatis berhasil dinonaktifkan.');
        closeAutomationModal();
        renderPage();
    } catch (error) {
        // Failure: the switch stays at its previous persisted state.
        automationSubmitting = false;
        if (confirmButton) { confirmButton.disabled = false; confirmButton.textContent = enabling ? 'Aktifkan' : 'Nonaktifkan'; }
        if (cancelButton) cancelButton.disabled = false;
        showError(error instanceof Error ? error.message : 'Pengaturan otomatis gagal diperbarui.');
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

const STATUS_LABELS: Record<string, string> = {
    dry_run: 'Siap diproses',
    completed: 'Selesai',
    deleted: 'Dihapus',
    archived: 'Diarsipkan',
    restored: 'Dipulihkan',
    archive_purged: 'Dihapus permanen',
    failed: 'Gagal',
    blocked: 'Tertahan',
    already_missing: 'Sudah tidak ada',
    ready: 'Tersimpan',
};

function statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
}

const ACTION_LABELS: Record<string, string> = {
    delete: 'Hapus',
    archive: 'Arsipkan',
    restore: 'Pulihkan',
    purge: 'Hapus permanen',
};

function actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
}

function triggerLabel(trigger: string): string {
    return TRIGGER_LABELS[trigger] ?? trigger;
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
