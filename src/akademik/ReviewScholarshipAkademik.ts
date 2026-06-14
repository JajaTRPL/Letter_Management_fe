import { apiFetch } from '../shared/api-client';
import {
    beasiswaActionSummaryRows,
    beasiswaGeneratedPreviewEndpoint,
    beasiswaReviewerEndpointPrefix,
    buildBeasiswaReviewerView,
    createBeasiswaTextActions,
    getBeasiswaReviewerIdentity,
    type BeasiswaReviewResponse,
    type BeasiswaReviewerIdentity,
} from '../shared/beasiswa-reviewer';
import { getLetterStatusLabel, LETTER_WORKFLOW_STATUS } from '../shared/letter-workflow';
import {
    activePageForReviewerOrigin,
    goToReviewerOrigin,
    resolveReviewerOrigin,
    type ReviewerNavigationOptions,
} from '../shared/reviewer-navigation';
import { renderReviewerShell, type ReviewerShellAction } from '../shared/reviewer-shell';

type ReviewerStage = 'prodi' | 'department';

export const renderReviewScholarshipAkademik = async (
    applicationId: number,
    options?: ReviewerNavigationOptions,
): Promise<void> => {
    const origin = resolveReviewerOrigin(options);
    const role = localStorage.getItem('auth_role') || 'akademik';
    const subRole = localStorage.getItem('auth_sub_role') || role;
    const isProdiReviewer = ['kaprodi', 'sekprodi'].includes(role) || ['kaprodi', 'sekprodi'].includes(subRole);
    const isDepartmentReviewer = ['kadep', 'sekdep'].includes(role) || ['kadep', 'sekdep'].includes(subRole);

    await renderReviewerShell<BeasiswaReviewResponse>({
        role,
        activePage: activePageForReviewerOrigin(origin),
        loadApplication: () => loadBeasiswa(applicationId),
        buildView: ({ application, student }) => {
            const identity = getBeasiswaReviewerIdentity(application, student);
            const endpointPrefix = beasiswaReviewerEndpointPrefix('akademik', applicationId);
            const reviewerStage = resolveReviewerStage(application.status, isProdiReviewer, isDepartmentReviewer);
            const actions = reviewerStage
                ? [
                    ...createBeasiswaTextActions({
                        audience: 'akademik',
                        prefix: 'scholarship-akademik',
                        endpointPrefix,
                        identity,
                    }),
                    createApproveAction(identity, endpointPrefix, reviewerStage),
                ]
                : undefined;

            return buildBeasiswaReviewerView(application, student, {
                audience: 'akademik',
                subtitle: isDepartmentReviewer
                    ? 'Data pengajuan ditampilkan untuk tanda tangan Kadep/Sekdep.'
                    : 'Data pengajuan ditampilkan untuk paraf Kaprodi/Sekprodi.',
                statusContext: 'akademik-review',
                backButtonId: 'back-to-akademik-dashboard',
                backButtonLabel: 'Kembali ke dashboard akademik',
                supportingGalleryRootId: 'beasiswa-akademik-supporting-gallery',
                generatedPreviewRootId: 'beasiswa-akademik-generated-letter-preview',
                generatedPreviewEndpointUrl: beasiswaGeneratedPreviewEndpoint('akademik', applicationId),
                actionTitle: 'Tindakan Persetujuan',
                unavailableMessage: readOnlyMessage(application.status, isProdiReviewer, isDepartmentReviewer),
                actions,
                actionNote: reviewerStage
                    ? reviewerStage === 'department'
                        ? 'Tindakan ini akan membuat dokumen final dan meneruskan pengajuan ke tahap review mahasiswa.'
                        : 'Tindakan ini memparaf pengajuan dan meneruskannya ke Kadep/Sekdep untuk tanda tangan akhir.'
                    : undefined,
            });
        },
        goBack: () => goToReviewerOrigin(origin, role),
    });
};

async function loadBeasiswa(applicationId: number): Promise<BeasiswaReviewResponse> {
    const response = await apiFetch(beasiswaReviewerEndpointPrefix('akademik', applicationId));
    const data = await response.json() as BeasiswaReviewResponse;
    if (!response.ok) {
        throw new Error(data.message || 'Gagal mengambil data pengajuan beasiswa.');
    }
    return data;
}

function resolveReviewerStage(
    status: string | null | undefined,
    isProdiReviewer: boolean,
    isDepartmentReviewer: boolean,
): ReviewerStage | null {
    if (isProdiReviewer && status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK) return 'prodi';
    if (isDepartmentReviewer && status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI) return 'department';
    return null;
}

function createApproveAction(
    identity: BeasiswaReviewerIdentity,
    endpointPrefix: string,
    reviewerStage: ReviewerStage,
): ReviewerShellAction {
    const isDepartmentStage = reviewerStage === 'department';
    return {
        buttonId: 'scholarship-akademik-approve-btn',
        buttonText: isDepartmentStage
            ? 'Tandatangani dan Selesaikan di Akademik'
            : 'Paraf dan Teruskan ke Kadep/Sekdep',
        buttonClass: 'bg-[#115E59] hover:bg-[#0d4a46] text-white',
        endpointUrl: `${endpointPrefix}/approve`,
        successFallback: isDepartmentStage
            ? 'Pengajuan berhasil ditandatangani dan menunggu review mahasiswa.'
            : 'Pengajuan berhasil diparaf dan diteruskan ke Kadep/Sekdep.',
        modal: {
            id: 'scholarship-akademik-approval-modal',
            title: isDepartmentStage ? 'Konfirmasi Tanda Tangan' : 'Konfirmasi Paraf',
            headerClass: 'bg-[#115E59] text-white',
            cancelId: 'scholarship-akademik-cancel-approve',
            confirmId: 'scholarship-akademik-confirm-approve',
            confirmText: isDepartmentStage ? 'Ya, Tandatangani' : 'Ya, Paraf Pengajuan',
            confirmClass: 'bg-[#115E59] text-white hover:bg-[#0d4a46]',
            notices: [{
                title: isDepartmentStage ? 'Pengajuan siap ditandatangani' : 'Pengajuan siap diparaf',
                message: isDepartmentStage
                    ? 'Anda akan memberi tanda tangan akhir, membuat dokumen final, dan meneruskan pengajuan ke tahap review mahasiswa.'
                    : 'Anda akan memparaf pengajuan ini dan meneruskannya ke Kadep/Sekdep untuk tanda tangan akhir.',
                classes: 'bg-amber-50 border border-amber-100 text-amber-900',
            }],
            summaryRows: beasiswaActionSummaryRows(identity),
        },
    };
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
        return `Pengajuan berada pada status ${label}, sehingga tindakan Kaprodi/Sekprodi tidak tersedia.`;
    }
    return 'Anda tidak memiliki akses tindakan untuk tahap persetujuan pengajuan ini.';
}
