import {
    formatReviewerShellDateOnly,
    reviewerShellValueOrDash,
    type ReviewerShellAction,
    type ReviewerShellRow,
    type ReviewerShellSection,
    type ReviewerShellView,
} from './reviewer-shell';
import { suratTugasSupportingDescriptors } from './surat-tugas-supporting-documents';
import type { LetterRetentionSummary } from './retention-state';
import type { SupportingDocumentMetadataMap } from './supporting-document-metadata';
import { getLetterStatusLabel, getLetterStatusTone, LETTER_WORKFLOW_STATUS } from './letter-workflow';

export type SuratTugasReviewResponse = {
    application: SuratTugasApplication;
    message?: string;
};

export type SuratTugasApplication = {
    id: number;
    status?: string | null;
    nama_perusahaan?: string | null;
    kegiatan?: string | null;
    posisi?: string | null;
    dosen_pembimbing_dpa?: string | null;
    tgl_mulai?: string | null;
    tgl_selesai?: string | null;
    nomor_surat_tugas?: string | null;
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

export type SuratTugasReviewerIdentity = {
    studentName: string;
    nim: string;
    email: string;
};

type SuratTugasViewOptions = {
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

type SuratTugasTextActionsOptions = {
    audience: 'tendik' | 'akademik';
    prefix: string;
    endpointPrefix: string;
    identity: SuratTugasReviewerIdentity;
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

export function buildSuratTugasReviewerView(
    app: SuratTugasApplication,
    options: SuratTugasViewOptions,
): ReviewerShellView {
    const profile = app.mahasiswa_profile;
    const identity = getSuratTugasReviewerIdentity(app);
    const canonicalProdi = app.user?.study_program?.name ?? profile?.program_studi ?? null;
    const canonicalFakultas = app.user?.study_program?.department?.faculty?.name ?? profile?.fakultas ?? null;
    const canonicalDepartemen = app.user?.study_program?.department?.name ?? null;

    return {
        title: 'Review Surat Tugas',
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
            { label: 'Nama Perusahaan/Instansi', value: reviewerShellValueOrDash(app.nama_perusahaan) },
            { label: 'Posisi', value: reviewerShellValueOrDash(app.posisi) },
            { label: 'Tanggal Mulai', value: formatReviewerShellDateOnly(app.tgl_mulai) },
            { label: 'Tanggal Selesai', value: formatReviewerShellDateOnly(app.tgl_selesai) },
            { label: 'Dosen Pembimbing Akademik / DPA', value: reviewerShellValueOrDash(app.dosen_pembimbing_dpa) },
            { label: 'Nomor Surat Tugas', value: reviewerShellValueOrDash(app.nomor_surat_tugas) },
        ],
        detailTextBlocks: [
            { label: 'Kegiatan', value: reviewerShellValueOrDash(app.kegiatan) },
        ],
        submittedAt: app.submitted_at || app.created_at,
        supportingDocuments: suratTugasSupportingDescriptors(app),
        supportingGalleryRootId: options.supportingGalleryRootId,
        supportingEmptyLabel: 'Dokumen pendukung belum tersedia.',
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
                title: 'Pratinjau Surat Tugas',
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

export function getSuratTugasReviewerIdentity(app: SuratTugasApplication): SuratTugasReviewerIdentity {
    const profile = app.mahasiswa_profile;
    return {
        studentName: reviewerShellValueOrDash(profile?.nama_lengkap || app.user?.name),
        nim: reviewerShellValueOrDash(profile?.nim),
        email: reviewerShellValueOrDash(profile?.email || app.user?.email),
    };
}

export function suratTugasActionSummaryRows(
    app: SuratTugasApplication,
    identity: SuratTugasReviewerIdentity,
): ReviewerShellRow[] {
    return [
        { label: 'Mahasiswa', value: identity.studentName },
        { label: 'NIM', value: identity.nim },
        { label: 'Jenis Surat', value: 'Surat Tugas' },
        { label: 'Tujuan', value: reviewerShellValueOrDash(app.nama_perusahaan) },
    ];
}

export function createSuratTugasTextActions(
    options: SuratTugasTextActionsOptions,
): ReviewerShellAction[] {
    const isTendik = options.audience === 'tendik';
    const summaryRows = [
        { label: 'Mahasiswa', value: options.identity.studentName },
        { label: 'NIM', value: options.identity.nim },
        { label: 'Jenis Surat', value: 'Surat Tugas' },
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
                        ? 'Contoh: Dokumen pendukung belum lengkap. Mohon unggah kembali dokumen yang sesuai.'
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

function hasGeneratedPreview(status?: string | null): boolean {
    return typeof status === 'string' && PHASE_BEARING_STATUSES.includes(status);
}
