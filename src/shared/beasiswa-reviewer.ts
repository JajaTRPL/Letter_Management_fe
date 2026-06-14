import { loadProtectedImageObjectUrl, revokeProtectedImageObjectUrl } from './api-client';
import { beasiswaSupportingDescriptors } from './beasiswa-supporting-documents';
import type { LetterRetentionSummary } from './retention-state';
import type { SupportingDocumentMetadataMap } from './supporting-document-metadata';
import { getLetterStatusLabel, getLetterStatusTone, LETTER_WORKFLOW_STATUS } from './letter-workflow';
import {
    escapeReviewerShellHtml,
    renderReviewerShellTimeline,
    reviewerShellValueOrDash,
    type ReviewerShellAction,
    type ReviewerShellRow,
    type ReviewerShellView,
} from './reviewer-shell';

export type BeasiswaStudent = {
    name?: string | null;
    nim?: string | null;
    photo?: string | null;
    prodi?: string | null;
    fakultas?: string | null;
    departemen?: string | null;
    email?: string | null;
    ipk?: number | string | null;
    phone?: string | null;
    angkatan?: string | number | null;
    current_semester?: string | number | null;
    target?: string | null;
    submitted_at?: string | null;
};

export type BeasiswaApplication = {
    id: number;
    status?: string | null;
    scholarship_name?: string | null;
    nomor_surat?: string | null;
    revision_note?: string | null;
    rejection_reason?: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    tendik_approved_at?: string | null;
    kaprodi_approved_at?: string | null;
    kadep_approved_at?: string | null;
    supporting_documents?: SupportingDocumentMetadataMap | null;
    retention_summary?: LetterRetentionSummary | null;
};

export type BeasiswaReviewResponse = {
    application: BeasiswaApplication;
    student: BeasiswaStudent;
    message?: string;
};

export type BeasiswaReviewerIdentity = {
    studentName: string;
    nim: string;
    purpose: string;
};

type BeasiswaViewOptions = {
    audience: 'tendik' | 'akademik';
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
};

type BeasiswaTextActionsOptions = {
    audience: 'tendik' | 'akademik';
    prefix: string;
    endpointPrefix: string;
    identity: BeasiswaReviewerIdentity;
};

export function buildBeasiswaReviewerView(
    app: BeasiswaApplication,
    student: BeasiswaStudent,
    options: BeasiswaViewOptions,
): ReviewerShellView {
    const identity = getBeasiswaReviewerIdentity(app, student);

    return {
        title: 'Review Surat Permohonan Beasiswa',
        subtitle: options.subtitle,
        backButtonId: options.backButtonId,
        backButtonLabel: options.backButtonLabel,
        status: {
            label: getLetterStatusLabel(app.status, options.statusContext) || reviewerShellValueOrDash(app.status),
            tone: getLetterStatusTone(app.status, options.statusContext),
        },
        workflowStatus: app.status,
        retentionSummary: app.retention_summary,
        profileSupplement: renderProfileSupplement(student, identity),
        profileRows: [
            { label: 'Program Studi', value: reviewerShellValueOrDash(student.prodi) },
            { label: 'Departemen', value: reviewerShellValueOrDash(student.departemen) },
            { label: 'Fakultas', value: reviewerShellValueOrDash(student.fakultas) },
            { label: 'Email', value: reviewerShellValueOrDash(student.email) },
            { label: 'IPK', value: valueOrDash(student.ipk) },
            { label: 'Telepon', value: reviewerShellValueOrDash(student.phone) },
        ],
        detailRows: [
            { label: 'Nomor Surat', value: reviewerShellValueOrDash(app.nomor_surat) },
            { label: 'Tujuan Beasiswa', value: identity.purpose },
        ],
        submittedAt: app.submitted_at || app.created_at || student.submitted_at,
        supportingDocuments: beasiswaSupportingDescriptors(app),
        supportingGalleryRootId: options.supportingGalleryRootId,
        supportingEmptyLabel: 'Belum ada dokumen yang diunggah.',
        notices: [
            app.revision_note
                ? { title: 'Catatan Revisi', message: app.revision_note, classes: 'bg-yellow-50 border-yellow-200 text-yellow-900' }
                : null,
            app.rejection_reason
                ? { title: 'Alasan Penolakan', message: app.rejection_reason, classes: 'bg-red-50 border-red-200 text-red-700' }
                : null,
        ].filter((notice): notice is NonNullable<typeof notice> => notice !== null),
        sections: [{
            title: 'Tahap Persetujuan',
            content: renderTimeline(app, options.audience),
        }],
        generatedPreview: {
            rootId: options.generatedPreviewRootId,
            endpointUrl: options.generatedPreviewEndpointUrl,
            title: 'Pratinjau Surat Permohonan Beasiswa',
            subtitle: 'Pratinjau PDF sesuai tahap pengajuan saat ini',
            loading: 'Memuat pratinjau surat...',
        },
        actionTitle: options.actionTitle,
        unavailableMessage: options.unavailableMessage,
        actions: options.actions,
        actionNote: options.actionNote,
        attachAfterRender: () => attachStudentPhoto(student.photo),
    };
}

export function getBeasiswaReviewerIdentity(
    app: BeasiswaApplication,
    student: BeasiswaStudent,
): BeasiswaReviewerIdentity {
    return {
        studentName: reviewerShellValueOrDash(student.name),
        nim: reviewerShellValueOrDash(student.nim),
        purpose: reviewerShellValueOrDash(app.scholarship_name || student.target),
    };
}

export function beasiswaReviewerEndpointPrefix(
    audience: 'tendik' | 'akademik',
    applicationId: number,
): string {
    return `/api/${audience}/scholarship/${applicationId}`;
}

export function beasiswaGeneratedPreviewEndpoint(
    audience: 'tendik' | 'akademik',
    applicationId: number,
): string {
    return `/api/${audience}/surat-permohonan-beasiswa/${applicationId}/generated-preview`;
}

export function beasiswaActionSummaryRows(identity: BeasiswaReviewerIdentity): ReviewerShellRow[] {
    return [
        { label: 'Mahasiswa', value: identity.studentName },
        { label: 'NIM', value: identity.nim },
        { label: 'Jenis Surat', value: 'Surat Permohonan Beasiswa' },
        { label: 'Tujuan', value: identity.purpose },
    ];
}

export function createBeasiswaTextActions(
    options: BeasiswaTextActionsOptions,
): ReviewerShellAction[] {
    const isTendik = options.audience === 'tendik';
    const summaryRows = beasiswaActionSummaryRows(options.identity);

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
                    placeholder: 'Contoh: Mohon unggah ulang transkrip nilai terbaru sebelum diproses.',
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
                    placeholder: 'Contoh: Berkas yang diajukan tidak memenuhi syarat dan tidak dapat diproses lebih lanjut.',
                    helper: 'Berikan penjelasan yang jelas mengapa pengajuan ditolak.',
                    requiredMessage: 'Alasan penolakan wajib diisi.',
                }],
            },
        },
    ];
}

function renderProfileSupplement(
    student: BeasiswaStudent,
    identity: BeasiswaReviewerIdentity,
): string {
    return `
        <div class="flex items-center gap-5">
            <div class="w-[72px] h-[72px] rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
                <img id="scholarship-student-photo" src="/avatar-placeholder.png" alt="Foto mahasiswa" class="w-full h-full object-cover">
            </div>
            <div>
                <h2 class="text-lg font-bold text-gray-800">${escapeReviewerShellHtml(identity.studentName)}</h2>
                <p class="text-xs font-semibold text-gray-500 mb-2">${escapeReviewerShellHtml(identity.nim)}</p>
                <div class="flex flex-wrap gap-2">
                    ${renderIdentityBadge('Angkatan', student.angkatan)}
                    ${renderIdentityBadge('Semester', student.current_semester)}
                </div>
            </div>
        </div>
    `;
}

function renderIdentityBadge(label: string, value?: string | number | null): string {
    return `<span class="bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">${escapeReviewerShellHtml(`${label} ${valueOrDash(value)}`)}</span>`;
}

function renderTimeline(app: BeasiswaApplication, audience: 'tendik' | 'akademik'): string {
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
        { label: 'Pengajuan Diterima', date: app.submitted_at || app.created_at, done: true },
        { label: 'Verifikasi Tenaga Pendidik', date: app.tendik_approved_at, done: tendikDoneStatuses.includes(app.status || ''), current: audience === 'tendik' && app.status === LETTER_WORKFLOW_STATUS.SUBMITTED },
        { label: 'Paraf Kaprodi/Sekprodi', date: app.kaprodi_approved_at, done: kaprodiDoneStatuses.includes(app.status || ''), current: app.status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK },
        { label: 'Tanda Tangan Kadep/Sekdep', date: app.kadep_approved_at, done: departmentDoneStatuses.includes(app.status || ''), current: app.status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI },
        { label: 'Review Mahasiswa', done: app.status === LETTER_WORKFLOW_STATUS.COMPLETED, current: app.status === LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW },
    ]);
}

function attachStudentPhoto(photo?: string | null): () => void {
    let active = true;
    let objectUrl: string | null = null;

    if (photo) {
        void loadProtectedImageObjectUrl(photo).then((nextUrl) => {
            if (!nextUrl) return;
            if (!active) {
                revokeProtectedImageObjectUrl(nextUrl);
                return;
            }
            const image = document.getElementById('scholarship-student-photo') as HTMLImageElement | null;
            if (!image) {
                revokeProtectedImageObjectUrl(nextUrl);
                return;
            }
            objectUrl = nextUrl;
            image.src = nextUrl;
        });
    }

    return () => {
        active = false;
        revokeProtectedImageObjectUrl(objectUrl);
        objectUrl = null;
    };
}

function valueOrDash(value?: string | number | null): string {
    return reviewerShellValueOrDash(value === null || value === undefined ? null : String(value));
}
