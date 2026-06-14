import {
    escapeReviewerShellHtml,
    formatReviewerShellDateOnly,
    reviewerShellValueOrDash,
    type ReviewerShellAction,
    type ReviewerShellRow,
    type ReviewerShellSection,
    type ReviewerShellView,
} from './reviewer-shell';
import { magangSupportingDescriptors } from './magang-supporting-documents';
import type { LetterRetentionSummary } from './retention-state';
import type { SupportingDocumentMetadataMap } from './supporting-document-metadata';
import { getLetterStatusLabel, getLetterStatusTone, LETTER_WORKFLOW_STATUS } from './letter-workflow';

export type MagangReviewResponse = {
    application: MagangApplication;
    message?: string;
};

export type MagangApplication = {
    id: number;
    status?: string | null;
    // Legacy aggregate fields, retained for old applications.
    nama_penerima?: string | null;
    alamat_perusahaan?: string | null;
    rentang_tanggal?: string | null;
    nomor_surat?: string | null;
    // Current structured contract.
    jabatan_penerima?: string | null;
    nama_perusahaan?: string | null;
    alamat_jalan?: string | null;
    alamat_kelurahan?: string | null;
    alamat_kecamatan?: string | null;
    alamat_kota_kabupaten?: string | null;
    alamat_provinsi?: string | null;
    kode_pos?: string | null;
    tgl_mulai?: string | null;
    tgl_selesai?: string | null;
    nomor_surat_pengantar?: string | null;
    peran?: string | null;
    dosen_pembimbing_dpa?: string | null;
    supporting_documents?: SupportingDocumentMetadataMap | null;
    revision_note?: string | null;
    rejection_reason?: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    tendik_approved_at?: string | null;
    kaprodi_approved_at?: string | null;
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

export type MagangReviewerIdentity = {
    studentName: string;
    nim: string;
    email: string;
};

type MagangViewOptions = {
    subtitle: string;
    statusContext: 'tendik-review' | 'akademik-review';
    backButtonId: string;
    backButtonLabel: string;
    supportingGalleryRootId: string;
    generatedPreviewRootId: string;
    generatedPreviewEndpointUrl: string;
    actionTitle: string;
    unavailableMessage?: string;
    actions?: readonly ReviewerShellAction[];
    actionNote?: string;
    sections?: readonly ReviewerShellSection[];
};

type MagangTextActionsOptions = {
    audience: 'tendik' | 'akademik';
    prefix: string;
    endpointPrefix: string;
    identity: MagangReviewerIdentity;
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

export function buildMagangReviewerView(
    app: MagangApplication,
    options: MagangViewOptions,
): ReviewerShellView {
    const profile = app.mahasiswa_profile;
    const identity = getMagangReviewerIdentity(app);
    const canonicalProdi = app.user?.study_program?.name ?? profile?.program_studi ?? null;
    const canonicalFakultas = app.user?.study_program?.department?.faculty?.name ?? profile?.fakultas ?? null;
    const canonicalDepartemen = app.user?.study_program?.department?.name ?? null;

    return {
        title: 'Review Surat Pengantar Magang',
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
            { label: 'Jabatan Penerima / Tujuan Surat', value: reviewerShellValueOrDash(app.jabatan_penerima || app.nama_penerima) },
            { label: 'Nama Perusahaan/Instansi', value: reviewerShellValueOrDash(app.nama_perusahaan) },
            { label: 'Posisi Magang', value: reviewerShellValueOrDash(app.peran) },
            { label: 'Tanggal Mulai Magang', value: formatReviewerShellDateOnly(app.tgl_mulai) },
            { label: 'Tanggal Selesai Magang', value: formatReviewerShellDateOnly(app.tgl_selesai) },
            { label: 'Dosen Pembimbing Akademik / DPA', value: reviewerShellValueOrDash(app.dosen_pembimbing_dpa) },
            { label: 'Nomor Surat Pengantar', value: reviewerShellValueOrDash(app.nomor_surat_pengantar || app.nomor_surat) },
        ],
        detailSections: [
            renderStructuredAddress(app),
            renderLegacyDateRange(app),
        ].filter(Boolean),
        submittedAt: app.submitted_at || app.created_at,
        supportingDocuments: magangSupportingDescriptors(app),
        supportingGalleryRootId: options.supportingGalleryRootId,
        supportingEmptyLabel: 'Proposal kegiatan magang belum tersedia.',
        notices: [
            app.revision_note
                ? { title: 'Catatan Revisi', message: app.revision_note, classes: 'bg-yellow-50 border-yellow-200 text-yellow-900' }
                : null,
            app.rejection_reason
                ? { title: 'Alasan Penolakan', message: app.rejection_reason, classes: 'bg-red-50 border-red-200 text-red-700' }
                : null,
        ].filter((notice): notice is NonNullable<typeof notice> => notice !== null),
        sections: options.sections,
        generatedPreview: hasGeneratedPreview(app.status)
            ? {
                rootId: options.generatedPreviewRootId,
                endpointUrl: options.generatedPreviewEndpointUrl,
                title: 'Pratinjau Surat Pengantar Magang',
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

export function getMagangReviewerIdentity(app: MagangApplication): MagangReviewerIdentity {
    const profile = app.mahasiswa_profile;
    return {
        studentName: reviewerShellValueOrDash(profile?.nama_lengkap || app.user?.name),
        nim: reviewerShellValueOrDash(profile?.nim),
        email: reviewerShellValueOrDash(profile?.email || app.user?.email),
    };
}

export function magangActionSummaryRows(
    app: MagangApplication,
    identity: MagangReviewerIdentity,
): ReviewerShellRow[] {
    return [
        { label: 'Mahasiswa', value: identity.studentName },
        { label: 'NIM', value: identity.nim },
        { label: 'Jenis Surat', value: 'Surat Pengantar Magang' },
        { label: 'Tujuan', value: reviewerShellValueOrDash(app.nama_perusahaan) },
    ];
}

export function createMagangTextActions(
    options: MagangTextActionsOptions,
): ReviewerShellAction[] {
    const isTendik = options.audience === 'tendik';
    const summaryRows = [
        { label: 'Mahasiswa', value: options.identity.studentName },
        { label: 'NIM', value: options.identity.nim },
        { label: 'Jenis Surat', value: 'Surat Pengantar Magang' },
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
                    label: isTendik ? 'Catatan Revisi untuk Mahasiswa' : 'Catatan Revisi',
                    type: 'textarea',
                    placeholder: isTendik
                        ? 'Contoh: Proposal kegiatan magang belum lengkap. Mohon unggah kembali dokumen yang sesuai.'
                        : 'Contoh: Data perusahaan perlu disesuaikan sebelum diproses lebih lanjut.',
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
                        ? 'Pengajuan akan ditolak permanen dan mahasiswa harus mengajukan ulang dari awal dengan persyaratan yang benar.'
                        : 'Pengajuan akan ditolak dan mahasiswa dapat melihat alasan penolakan pada detail pengajuan.',
                    classes: 'bg-amber-50 border border-amber-100 text-amber-900',
                }],
                summaryRows,
                fields: [{
                    id: `${options.prefix}-rejection-reason`,
                    payloadKey: 'reason',
                    label: 'Alasan Penolakan',
                    type: 'textarea',
                    placeholder: 'Contoh: Data yang diajukan tidak valid dan tidak dapat diproses lebih lanjut.',
                    helper: isTendik
                        ? 'Berikan penjelasan yang jelas mengapa pengajuan ditolak secara permanen.'
                        : 'Berikan penjelasan yang jelas mengapa pengajuan ditolak.',
                    requiredMessage: 'Alasan penolakan wajib diisi.',
                }],
            },
        },
    ];
}

function renderStructuredAddress(app: MagangApplication): string {
    const hasStructured = Boolean(
        app.alamat_jalan
        || app.alamat_kelurahan
        || app.alamat_kecamatan
        || app.alamat_kota_kabupaten
        || app.alamat_provinsi
        || app.kode_pos
    );

    if (!hasStructured) {
        return renderDetailInfoBox('Alamat Perusahaan', reviewerShellValueOrDash(app.alamat_perusahaan), true);
    }

    return `
        <div class="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Alamat Perusahaan</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${renderDetailInfoBox('Alamat Jalan', reviewerShellValueOrDash(app.alamat_jalan || app.alamat_perusahaan))}
                ${renderDetailInfoBox('Kelurahan/Desa', reviewerShellValueOrDash(app.alamat_kelurahan))}
                ${renderDetailInfoBox('Kecamatan', reviewerShellValueOrDash(app.alamat_kecamatan))}
                ${renderDetailInfoBox('Kota/Kabupaten', reviewerShellValueOrDash(app.alamat_kota_kabupaten))}
                ${renderDetailInfoBox('Provinsi', reviewerShellValueOrDash(app.alamat_provinsi))}
                ${renderDetailInfoBox('Kode Pos', reviewerShellValueOrDash(app.kode_pos))}
            </div>
        </div>
    `;
}

function renderLegacyDateRange(app: MagangApplication): string {
    if (app.tgl_mulai || app.tgl_selesai || !app.rentang_tanggal) return '';
    return `
        <div class="border border-amber-100 bg-amber-50 rounded-xl px-4 py-3">
            <label class="block text-[10px] font-medium text-amber-700 capitalize mb-1">Rentang Tanggal (data lama)</label>
            <p class="text-sm font-semibold text-amber-900">${escapeReviewerShellHtml(reviewerShellValueOrDash(app.rentang_tanggal))}</p>
        </div>
    `;
}

function renderDetailInfoBox(label: string, value: string, multiline = false): string {
    return `
        <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
            <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">${escapeReviewerShellHtml(label)}</label>
            <p class="text-sm font-semibold text-gray-800${multiline ? ' whitespace-pre-line' : ''}">${escapeReviewerShellHtml(value)}</p>
        </div>
    `;
}

function hasGeneratedPreview(status?: string | null): boolean {
    return typeof status === 'string' && PHASE_BEARING_STATUSES.includes(status);
}
