import {
    escapeReviewerShellHtml,
    formatReviewerShellDateOnly,
    renderReviewerShellTimeline,
    reviewerShellValueOrDash,
    type ReviewerShellAction,
    type ReviewerShellRow,
    type ReviewerShellView,
} from './reviewer-shell';
import { getLetterStatusLabel, getLetterStatusTone, LETTER_WORKFLOW_STATUS } from './letter-workflow';
import type { LetterRetentionSummary } from './retention-state';

export type SkaReviewResponse = {
    application: SkaApplication;
    message?: string;
};

export type SkaApplication = {
    id: number;
    status?: string | null;
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    jenis_kelamin?: string | null;
    keperluan?: string | null;
    nama_orang_tua_wali?: string | null;
    pekerjaan_orang_tua_wali?: string | null;
    nip_orang_tua_wali?: string | null;
    pangkat_gol_orang_tua_wali?: string | null;
    instansi_orang_tua_wali?: string | null;
    nomor_surat?: string | null;
    revision_note?: string | null;
    rejection_reason?: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    tendik_approved_at?: string | null;
    kaprodi_approved_at?: string | null;
    kadep_approved_at?: string | null;
    mahasiswa_profile?: StudentProfile | null;
    user?: StudentUser | null;
    retention_summary?: LetterRetentionSummary | null;
};

type StudentProfile = {
    nama_lengkap?: string | null;
    nim?: string | null;
    fakultas?: string | null;
    program_studi?: string | null;
    email?: string | null;
    no_hp?: string | null;
    no_telp?: string | null;
};

type StudentUser = {
    name?: string | null;
    email?: string | null;
    study_program?: {
        name?: string | null;
        department?: {
            name?: string | null;
            faculty?: {
                name?: string | null;
            } | null;
        } | null;
    } | null;
};

export type SkaReviewerIdentity = {
    studentName: string;
    nim: string;
    email: string;
};

type SkaViewOptions = {
    subtitle: string;
    statusContext: 'tendik-review' | 'akademik-review';
    backButtonId: string;
    backButtonLabel: string;
    generatedPreviewRootId: string;
    generatedPreviewEndpointUrl: string;
    actionTitle: string;
    unavailableMessage?: string;
    actions?: readonly ReviewerShellAction[];
    actionNote?: string;
};

type SkaTextActionsOptions = {
    audience: 'tendik' | 'akademik';
    prefix: string;
    endpointPrefix: string;
    identity: SkaReviewerIdentity;
};

const PHASE_BEARING_STATUSES: readonly string[] = [
    LETTER_WORKFLOW_STATUS.SUBMITTED,
    LETTER_WORKFLOW_STATUS.APPROVED_TENDIK,
    LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI,
    LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW,
    LETTER_WORKFLOW_STATUS.COMPLETED,
    LETTER_WORKFLOW_STATUS.REVISION,
    LETTER_WORKFLOW_STATUS.REJECTED,
];

export function buildSkaReviewerView(
    app: SkaApplication,
    options: SkaViewOptions,
): ReviewerShellView {
    const profile = app.mahasiswa_profile;
    const identity = getSkaReviewerIdentity(app);
    const canonicalProdi = app.user?.study_program?.name ?? profile?.program_studi ?? null;
    const canonicalFakultas = app.user?.study_program?.department?.faculty?.name ?? profile?.fakultas ?? null;
    const canonicalDepartemen = app.user?.study_program?.department?.name ?? null;

    return {
        title: 'Review Surat Keterangan Aktif',
        subtitle: options.subtitle,
        backButtonId: options.backButtonId,
        backButtonLabel: options.backButtonLabel,
        status: {
            label: getLetterStatusLabel(app.status, options.statusContext) || reviewerShellValueOrDash(app.status),
            tone: getLetterStatusTone(app.status, options.statusContext),
        },
        workflowStatus: app.status,
        retentionSummary: app.retention_summary,
        profileRows: [
            { label: 'Nama Lengkap', value: identity.studentName },
            { label: 'NIM', value: identity.nim },
            { label: 'Program Studi', value: reviewerShellValueOrDash(canonicalProdi) },
            { label: 'Fakultas', value: reviewerShellValueOrDash(canonicalFakultas) },
            { label: 'Departemen', value: reviewerShellValueOrDash(canonicalDepartemen) },
            { label: 'Email', value: identity.email },
            { label: 'No. Telepon', value: reviewerShellValueOrDash(profile?.no_hp ?? profile?.no_telp) },
        ],
        detailRows: [
            { label: 'Tempat, Tanggal Lahir', value: formatPlaceAndDate(app.tempat_lahir, app.tanggal_lahir) },
            { label: 'Jenis Kelamin', value: reviewerShellValueOrDash(app.jenis_kelamin) },
            { label: 'Keperluan', value: reviewerShellValueOrDash(app.keperluan) },
            { label: 'Nomor Surat', value: reviewerShellValueOrDash(app.nomor_surat) },
        ],
        submittedAt: app.submitted_at || app.created_at,
        supportingDocuments: [],
        notices: [
            app.revision_note
                ? { title: 'Catatan Revisi', message: app.revision_note, classes: 'bg-yellow-50 border-yellow-200 text-yellow-900' }
                : null,
            app.rejection_reason
                ? { title: 'Alasan Penolakan', message: app.rejection_reason, classes: 'bg-red-50 border-red-200 text-red-700' }
                : null,
        ].filter((notice): notice is NonNullable<typeof notice> => notice !== null),
        sections: [
            {
                title: 'Data Orang Tua/Wali',
                content: renderParentRows(app),
            },
            {
                title: 'Tahap Persetujuan',
                content: renderTimeline(app),
            },
        ],
        generatedPreview: hasGeneratedPreview(app.status)
            ? {
                rootId: options.generatedPreviewRootId,
                endpointUrl: options.generatedPreviewEndpointUrl,
                title: 'Pratinjau Surat Keterangan Aktif',
                subtitle: 'Pratinjau PDF sesuai tahap pengajuan saat ini',
                loading: 'Memuat pratinjau surat...',
            }
            : undefined,
        actionTitle: options.actionTitle,
        unavailableMessage: options.unavailableMessage,
        actions: options.actions,
        actionNote: options.actionNote,
    };
}

export function getSkaReviewerIdentity(app: SkaApplication): SkaReviewerIdentity {
    const profile = app.mahasiswa_profile;
    return {
        studentName: reviewerShellValueOrDash(profile?.nama_lengkap || app.user?.name),
        nim: reviewerShellValueOrDash(profile?.nim),
        email: reviewerShellValueOrDash(profile?.email || app.user?.email),
    };
}

export function skaActionSummaryRows(
    app: SkaApplication,
    identity: SkaReviewerIdentity,
): ReviewerShellRow[] {
    return [
        { label: 'Mahasiswa', value: identity.studentName },
        { label: 'NIM', value: identity.nim },
        { label: 'Jenis Surat', value: 'Surat Keterangan Aktif' },
        { label: 'Keperluan', value: reviewerShellValueOrDash(app.keperluan) },
    ];
}

export function createSkaTextActions(
    options: SkaTextActionsOptions,
): ReviewerShellAction[] {
    const isTendik = options.audience === 'tendik';
    const summaryRows = [
        { label: 'Mahasiswa', value: options.identity.studentName },
        { label: 'NIM', value: options.identity.nim },
        { label: 'Jenis Surat', value: 'Surat Keterangan Aktif' },
    ];

    return [
        {
            buttonId: `${options.prefix}-revise-btn`,
            buttonText: isTendik ? 'Minta Perbaikan Dokumen (Revisi)' : 'Minta Revisi',
            buttonClass: 'bg-[#FACC15] hover:bg-[#EAB308] text-yellow-900 border border-[#EAB308]/50',
            endpointUrl: `${options.endpointPrefix}/revise`,
            successFallback: 'Permintaan revisi berhasil dikirim.',
            modal: {
                id: `${options.prefix}-revision-modal`,
                title: isTendik ? 'Permintaan Perbaikan Dokumen' : 'Permintaan Revisi',
                headerClass: 'bg-[#FACC15] text-gray-900',
                cancelId: `${options.prefix}-cancel-revise`,
                confirmId: `${options.prefix}-confirm-revise`,
                confirmText: 'Kirim Permintaan Revisi',
                confirmClass: 'bg-[#FACC15] hover:bg-[#EAB308] text-yellow-900 border border-[#0D4A46]',
                summaryRows,
                fields: [{
                    id: `${options.prefix}-revision-note`,
                    payloadKey: 'note',
                    label: 'Catatan Revisi',
                    type: 'textarea',
                    placeholder: 'Tuliskan bagian pengajuan yang perlu diperbaiki.',
                    helper: 'Tuliskan instruksi revisi secara jelas agar mahasiswa mengetahui bagian yang perlu diperbaiki.',
                    requiredMessage: 'Catatan revisi wajib diisi.',
                }],
            },
        },
        {
            buttonId: `${options.prefix}-reject-btn`,
            buttonText: 'Tolak Pengajuan Surat',
            buttonClass: 'bg-[#EF4444] hover:bg-[#DC2626] text-white',
            endpointUrl: `${options.endpointPrefix}/reject`,
            successFallback: 'Pengajuan berhasil ditolak.',
            modal: {
                id: `${options.prefix}-rejection-modal`,
                title: 'Tolak Pengajuan Surat',
                headerClass: 'bg-[#EF4444] text-white',
                cancelId: `${options.prefix}-cancel-reject`,
                confirmId: `${options.prefix}-confirm-reject`,
                confirmText: isTendik ? 'Ya, Tolak Permanen' : 'Ya, Tolak Pengajuan',
                confirmClass: 'bg-[#EF4444] hover:bg-[#DC2626] text-white',
                notices: [{
                    title: isTendik ? 'PERHATIAN - Tindakan Permanen:' : 'PERHATIAN:',
                    message: isTendik
                        ? 'Pengajuan akan ditolak permanen dan mahasiswa harus mengajukan ulang dari awal dengan data yang benar.'
                        : 'Pengajuan akan ditolak dan mahasiswa dapat melihat alasan penolakan pada detail pengajuan.',
                    classes: 'bg-amber-50 border border-amber-100 text-amber-900',
                }],
                summaryRows,
                fields: [{
                    id: `${options.prefix}-rejection-reason`,
                    payloadKey: 'reason',
                    label: 'Alasan Penolakan',
                    type: 'textarea',
                    placeholder: 'Tuliskan alasan pengajuan tidak dapat diproses.',
                    helper: 'Berikan penjelasan yang jelas mengapa pengajuan ditolak.',
                    requiredMessage: 'Alasan penolakan wajib diisi.',
                }],
            },
        },
    ];
}

function renderParentRows(app: SkaApplication): string {
    const rows: ReviewerShellRow[] = [
        { label: 'Nama Orang Tua/Wali', value: reviewerShellValueOrDash(app.nama_orang_tua_wali) },
        { label: 'Pekerjaan', value: reviewerShellValueOrDash(app.pekerjaan_orang_tua_wali) },
        { label: 'NIP', value: reviewerShellValueOrDash(app.nip_orang_tua_wali) },
        { label: 'Pangkat/Golongan', value: reviewerShellValueOrDash(app.pangkat_gol_orang_tua_wali) },
        { label: 'Instansi', value: reviewerShellValueOrDash(app.instansi_orang_tua_wali) },
    ];

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${rows.map((row) => `
                <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
                    <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">${escapeReviewerShellHtml(row.label)}</label>
                    <p class="text-sm font-semibold text-gray-800">${escapeReviewerShellHtml(row.value)}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTimeline(app: SkaApplication): string {
    const tendikDoneStatuses: readonly string[] = [
        LETTER_WORKFLOW_STATUS.APPROVED_TENDIK,
        LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI,
        LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW,
        LETTER_WORKFLOW_STATUS.COMPLETED,
    ];
    const kaprodiDoneStatuses: readonly string[] = [
        LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI,
        LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW,
        LETTER_WORKFLOW_STATUS.COMPLETED,
    ];
    const departmentDoneStatuses: readonly string[] = [
        LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW,
        LETTER_WORKFLOW_STATUS.COMPLETED,
    ];

    return renderReviewerShellTimeline([
        { label: 'Diajukan', date: app.submitted_at || app.created_at, done: true },
        { label: 'Verifikasi Tenaga Pendidik', date: app.tendik_approved_at, done: tendikDoneStatuses.includes(app.status || '') },
        { label: 'Paraf Kaprodi/Sekprodi', date: app.kaprodi_approved_at, done: kaprodiDoneStatuses.includes(app.status || ''), current: app.status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK },
        { label: 'Tanda Tangan Kadep/Sekdep', date: app.kadep_approved_at, done: departmentDoneStatuses.includes(app.status || ''), current: app.status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI },
        { label: 'Review Mahasiswa', done: app.status === LETTER_WORKFLOW_STATUS.COMPLETED, current: app.status === LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW },
    ]);
}

function formatPlaceAndDate(place?: string | null, date?: string | null): string {
    const formattedDate = formatReviewerShellDateOnly(date);
    if (!place) return formattedDate;
    if (formattedDate === '-') return place;
    return `${place}, ${formattedDate}`;
}

function hasGeneratedPreview(status?: string | null): boolean {
    return typeof status === 'string' && PHASE_BEARING_STATUSES.includes(status);
}
