import { apiFetch } from '../shared/api-client';
import {
    renderReviewerShell,
    type ReviewerShellAction,
} from '../shared/reviewer-shell';
import {
    buildPlnReviewerView,
    createPlnTextActions,
    getPlnReviewerIdentity,
    plnActionSummaryRows,
    type PlnApplication,
    type PlnReviewResponse,
} from '../shared/pln-reviewer';
import { getLetterStatusLabel, LETTER_WORKFLOW_STATUS } from '../shared/letter-workflow';
import {
    activePageForReviewerOrigin,
    goToReviewerOrigin,
    resolveReviewerOrigin,
    type ReviewerNavigationOptions,
} from '../shared/reviewer-navigation';

type ReviewerStage = 'prodi' | 'department';

export const renderReviewProsesLuarNegeriAkademik = async (
    applicationId: number,
    options?: ReviewerNavigationOptions,
): Promise<void> => {
    const origin = resolveReviewerOrigin(options);
    const role = localStorage.getItem('auth_role') || 'akademik';
    const subRole = localStorage.getItem('auth_sub_role') || role;
    const isProdiReviewer = ['kaprodi', 'sekprodi'].includes(role) || ['kaprodi', 'sekprodi'].includes(subRole);
    const isDepartmentReviewer = ['kadep', 'sekdep'].includes(role) || ['kadep', 'sekdep'].includes(subRole);

    await renderReviewerShell<PlnApplication>({
        role,
        activePage: activePageForReviewerOrigin(origin),
        loadApplication: () => loadPlnApplication(applicationId),
        buildView: (app) => {
            const identity = getPlnReviewerIdentity(app);
            const endpointPrefix = `/api/akademik/proses-luar-negeri/${applicationId}`;
            const reviewerStage = resolveReviewerStage(app, isProdiReviewer, isDepartmentReviewer);
            const actions = reviewerStage
                ? [
                    ...createPlnTextActions({
                        audience: 'akademik',
                        prefix: 'pln-akademik',
                        endpointPrefix,
                        identity,
                    }),
                    createApproveAction(app, identity, endpointPrefix, reviewerStage),
                ]
                : undefined;

            return buildPlnReviewerView(app, {
                subtitle: isDepartmentReviewer
                    ? 'Data pengajuan ditampilkan untuk tanda tangan Kadep/Sekdep.'
                    : 'Data pengajuan ditampilkan untuk paraf Kaprodi/Sekprodi.',
                statusContext: 'akademik-review',
                backButtonId: 'back-to-akademik-dashboard',
                backButtonLabel: 'Kembali ke dashboard akademik',
                generatedPreviewRootId: 'pln-akademik-generated-letter-preview',
                generatedPreviewEndpointUrl: `${endpointPrefix}/generated-preview`,
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

async function loadPlnApplication(applicationId: number): Promise<PlnApplication> {
    const response = await apiFetch(`/api/akademik/proses-luar-negeri/${applicationId}`);
    const data = await response.json() as PlnReviewResponse;
    if (!response.ok) {
        throw new Error(data.message || 'Gagal mengambil data pengajuan proses luar negeri');
    }
    return data.application;
}

function resolveReviewerStage(
    app: PlnApplication,
    isProdiReviewer: boolean,
    isDepartmentReviewer: boolean,
): ReviewerStage | null {
    if (isProdiReviewer && app.status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK) return 'prodi';
    if (isDepartmentReviewer && app.status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI) return 'department';
    return null;
}

function createApproveAction(
    app: PlnApplication,
    identity: ReturnType<typeof getPlnReviewerIdentity>,
    endpointPrefix: string,
    reviewerStage: ReviewerStage,
): ReviewerShellAction {
    const isDepartmentStage = reviewerStage === 'department';
    return {
        buttonId: 'pln-akademik-approve-btn',
        buttonText: isDepartmentStage
            ? 'Tandatangani dan Selesaikan di Akademik'
            : 'Paraf dan Teruskan ke Kadep/Sekdep',
        buttonClass: 'bg-[#115E59] hover:bg-[#0d4a46] text-white',
        endpointUrl: `${endpointPrefix}/approve`,
        successFallback: isDepartmentStage
            ? 'Pengajuan berhasil ditandatangani dan menunggu review mahasiswa.'
            : 'Pengajuan berhasil diparaf dan diteruskan ke Kadep/Sekdep.',
        modal: {
            id: 'pln-akademik-approval-modal',
            title: isDepartmentStage ? 'Konfirmasi Tanda Tangan' : 'Konfirmasi Paraf',
            headerClass: 'bg-[#115E59] text-white',
            cancelId: 'pln-akademik-cancel-approve',
            confirmId: 'pln-akademik-confirm-approve',
            confirmText: isDepartmentStage ? 'Ya, Tandatangani' : 'Ya, Paraf Pengajuan',
            confirmClass: 'bg-[#115E59] text-white hover:bg-[#0d4a46]',
            notices: [{
                title: isDepartmentStage ? 'Pengajuan siap ditandatangani' : 'Pengajuan siap diparaf',
                message: isDepartmentStage
                    ? 'Anda akan memberi tanda tangan akhir dan meneruskan pengajuan ke tahap review mahasiswa.'
                    : 'Anda akan memparaf pengajuan ini dan meneruskannya ke Kadep/Sekdep untuk tanda tangan akhir.',
                classes: 'bg-amber-50 border border-amber-100 text-amber-900',
            }],
            summaryRows: plnActionSummaryRows(app, identity),
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
        return `Pengajuan berada pada status ${label}, sehingga tindakan Prodi tidak tersedia.`;
    }
    return 'Anda tidak memiliki akses tindakan untuk tahap persetujuan pengajuan ini.';
}
