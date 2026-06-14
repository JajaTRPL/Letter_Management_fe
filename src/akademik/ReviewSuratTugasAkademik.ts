import { apiFetch } from '../shared/api-client';
import {
    renderReviewerShell,
    renderReviewerShellTimeline,
    type ReviewerShellAction,
} from '../shared/reviewer-shell';
import {
    buildSuratTugasReviewerView,
    createSuratTugasTextActions,
    getSuratTugasReviewerIdentity,
    suratTugasActionSummaryRows,
    type SuratTugasApplication,
    type SuratTugasReviewResponse,
} from '../shared/surat-tugas-reviewer';
import { getLetterStatusLabel, LETTER_WORKFLOW_STATUS } from '../shared/letter-workflow';
import {
    activePageForReviewerOrigin,
    goToReviewerOrigin,
    resolveReviewerOrigin,
    type ReviewerNavigationOptions,
} from '../shared/reviewer-navigation';

type ReviewerStage = 'prodi' | 'department';

export const renderReviewSuratTugasAkademik = async (
    applicationId: number,
    options?: ReviewerNavigationOptions,
): Promise<void> => {
    const origin = resolveReviewerOrigin(options);
    const role = localStorage.getItem('auth_role') || 'akademik';
    const subRole = localStorage.getItem('auth_sub_role') || role;
    const isProdiReviewer = ['kaprodi', 'sekprodi'].includes(role) || ['kaprodi', 'sekprodi'].includes(subRole);
    const isDepartmentReviewer = ['kadep', 'sekdep'].includes(role) || ['kadep', 'sekdep'].includes(subRole);

    await renderReviewerShell<SuratTugasApplication>({
        role,
        activePage: activePageForReviewerOrigin(origin),
        loadApplication: () => loadSuratTugasApplication(applicationId),
        buildView: (app) => {
            const identity = getSuratTugasReviewerIdentity(app);
            const endpointPrefix = `/api/akademik/surat-tugas/${applicationId}`;
            const reviewerStage = resolveReviewerStage(app, isProdiReviewer, isDepartmentReviewer);
            const actions = reviewerStage
                ? [
                    ...createSuratTugasTextActions({
                        audience: 'akademik',
                        prefix: 'surat-tugas-akademik',
                        endpointPrefix,
                        identity,
                    }),
                    createApproveAction(app, identity, endpointPrefix, reviewerStage),
                ]
                : undefined;

            return buildSuratTugasReviewerView(app, {
                subtitle: isDepartmentReviewer
                    ? 'Data pengajuan ditampilkan untuk tanda tangan Kadep/Sekdep.'
                    : 'Data pengajuan ditampilkan untuk paraf Kaprodi/Sekprodi.',
                statusContext: 'akademik-review',
                backButtonId: 'back-to-akademik-dashboard',
                backButtonLabel: 'Kembali ke dashboard akademik',
                supportingGalleryRootId: 'surat-tugas-akademik-supporting-gallery',
                generatedPreviewRootId: 'surat-tugas-akademik-generated-letter-preview',
                generatedPreviewEndpointUrl: `${endpointPrefix}/generated-preview`,
                sections: [{
                    title: 'Tahap Persetujuan',
                    content: renderTimeline(app),
                }],
                actionTitle: 'Tindakan Persetujuan',
                unavailableMessage: readOnlyMessage(app.status, isProdiReviewer, isDepartmentReviewer),
                actions,
                actionNote: reviewerStage
                    ? reviewerStage === 'department'
                        ? 'Tindakan ini hanya untuk Kadep/Sekdep pada status Diparaf Kaprodi/Sekprodi.'
                        : 'Tindakan ini hanya untuk Kaprodi/Sekprodi pada status Diverifikasi Tendik.'
                    : undefined,
            });
        },
        goBack: () => goToReviewerOrigin(origin, role),
    });
};

async function loadSuratTugasApplication(applicationId: number): Promise<SuratTugasApplication> {
    const response = await apiFetch(`/api/akademik/surat-tugas/${applicationId}`);
    const data = await response.json() as SuratTugasReviewResponse;
    if (!response.ok) {
        throw new Error(data.message || 'Gagal mengambil data pengajuan Surat Tugas');
    }
    return data.application;
}

function resolveReviewerStage(
    app: SuratTugasApplication,
    isProdiReviewer: boolean,
    isDepartmentReviewer: boolean,
): ReviewerStage | null {
    if (isProdiReviewer && app.status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK) return 'prodi';
    if (isDepartmentReviewer && app.status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI) return 'department';
    return null;
}

function createApproveAction(
    app: SuratTugasApplication,
    identity: ReturnType<typeof getSuratTugasReviewerIdentity>,
    endpointPrefix: string,
    reviewerStage: ReviewerStage,
): ReviewerShellAction {
    const isDepartmentStage = reviewerStage === 'department';
    return {
        buttonId: 'surat-tugas-akademik-approve-btn',
        buttonText: isDepartmentStage
            ? 'Tandatangani dan Selesaikan di Akademik'
            : 'Paraf dan Teruskan ke Kadep/Sekdep',
        buttonClass: 'bg-[#115E59] hover:bg-[#0d4a46] text-white',
        endpointUrl: `${endpointPrefix}/approve`,
        successFallback: isDepartmentStage
            ? 'Pengajuan berhasil ditandatangani dan menunggu review mahasiswa.'
            : 'Pengajuan berhasil diparaf dan diteruskan ke Kadep/Sekdep.',
        modal: {
            id: 'surat-tugas-akademik-approval-modal',
            title: isDepartmentStage ? 'Konfirmasi Tanda Tangan' : 'Konfirmasi Paraf',
            headerClass: 'bg-[#115E59] text-white',
            cancelId: 'surat-tugas-akademik-cancel-approve',
            confirmId: 'surat-tugas-akademik-confirm-approve',
            confirmText: isDepartmentStage ? 'Ya, Tandatangani' : 'Ya, Paraf Pengajuan',
            confirmClass: 'bg-[#115E59] text-white hover:bg-[#0d4a46]',
            notices: [{
                title: isDepartmentStage ? 'Pengajuan siap ditandatangani' : 'Pengajuan siap diparaf',
                message: isDepartmentStage
                    ? 'Anda akan memberi tanda tangan akhir dan meneruskan pengajuan ke tahap review mahasiswa.'
                    : 'Anda akan memparaf pengajuan ini dan meneruskannya ke Kadep/Sekdep untuk tanda tangan akhir.',
                classes: 'bg-amber-50 border border-amber-100 text-amber-900',
            }],
            summaryRows: suratTugasActionSummaryRows(app, identity),
        },
    };
}

function renderTimeline(app: SuratTugasApplication): string {
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
        { label: 'Tanda Tangan Kadep/Sekdep', done: departmentDoneStatuses.includes(app.status || ''), current: app.status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI },
        { label: 'Review Mahasiswa', done: app.status === LETTER_WORKFLOW_STATUS.COMPLETED, current: app.status === LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW },
    ]);
}

function readOnlyMessage(
    status?: string | null,
    isProdiReviewer?: boolean,
    isDepartmentReviewer?: boolean,
): string {
    const label = getLetterStatusLabel(status, 'akademik-review') || status || '-';
    if (isDepartmentReviewer) {
        return `Pengajuan berada pada status ${label}, sehingga tindakan Kadep/Sekdep tidak tersedia.`;
    }
    if (isProdiReviewer) {
        return `Pengajuan berada pada status ${label}, sehingga tindakan Prodi tidak tersedia.`;
    }
    return 'Anda tidak memiliki akses tindakan untuk tahap persetujuan pengajuan ini.';
}
