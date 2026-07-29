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
import { renderReviewerShell, type ReviewerShellAction, APPROVE_ACTION_BUTTON_CLASS, APPROVE_ACTION_HEADER_CLASS, APPROVE_ACTION_CONFIRM_CLASS } from '../shared/reviewer-shell';

export const renderReviewScholarship = async (
    applicationId: number,
    options?: ReviewerNavigationOptions,
): Promise<void> => {
    const origin = resolveReviewerOrigin(options);
    const role = localStorage.getItem('auth_role') || 'tendik';

    await renderReviewerShell<BeasiswaReviewResponse>({
        role,
        activePage: activePageForReviewerOrigin(origin),
        loadApplication: () => loadBeasiswa(applicationId),
        buildView: ({ application, student }) => {
            const identity = getBeasiswaReviewerIdentity(application, student);
            const endpointPrefix = beasiswaReviewerEndpointPrefix('tendik', applicationId);
            const canAct = application.status === LETTER_WORKFLOW_STATUS.SUBMITTED;
            const actions = canAct
                ? [
                    ...createBeasiswaTextActions({
                        audience: 'tendik',
                        prefix: 'scholarship',
                        endpointPrefix,
                        identity,
                    }),
                    createApproveAction(identity, endpointPrefix),
                ]
                : undefined;

            return buildBeasiswaReviewerView(application, student, {
                audience: 'tendik',
                subtitle: 'Data pengajuan ditampilkan untuk verifikasi Tendik.',
                statusContext: 'tendik-review',
                backButtonId: 'back-to-document-list',
                backButtonLabel: 'Kembali ke daftar dokumen',
                supportingGalleryRootId: 'beasiswa-supporting-gallery',
                generatedPreviewRootId: 'beasiswa-generated-letter-preview',
                generatedPreviewEndpointUrl: beasiswaGeneratedPreviewEndpoint('tendik', applicationId),
                actionTitle: 'Tindakan Verifikasi',
                unavailableMessage: `Pengajuan berada pada status ${statusLabel(application.status)}, sehingga tindakan Tendik tidak tersedia.`,
                actions,
                actionNote: canAct
                    ? 'Pastikan seluruh dokumen telah sesuai dengan persyaratan sebelum melanjutkan. Nomor surat wajib diisi manual saat menyetujui pengajuan.'
                    : undefined,
            });
        },
        goBack: () => goToReviewerOrigin(origin, role),
    });
};

async function loadBeasiswa(applicationId: number): Promise<BeasiswaReviewResponse> {
    const response = await apiFetch(beasiswaReviewerEndpointPrefix('tendik', applicationId));
    const data = await response.json() as BeasiswaReviewResponse;
    if (!response.ok) {
        throw new Error(data.message || 'Gagal mengambil data pengajuan beasiswa.');
    }
    return data;
}

function createApproveAction(
    identity: BeasiswaReviewerIdentity,
    endpointPrefix: string,
): ReviewerShellAction {
    return {
        buttonId: 'scholarship-approve-btn',
        buttonText: 'Setujui dan Teruskan ke Pimpinan',
        buttonClass: APPROVE_ACTION_BUTTON_CLASS,
        endpointUrl: `${endpointPrefix}/approve`,
        successFallback: 'Pengajuan berhasil diverifikasi dan diteruskan.',
        modal: {
            id: 'scholarship-approval-modal',
            title: 'Konfirmasi Persetujuan',
            headerClass: APPROVE_ACTION_HEADER_CLASS,
            cancelId: 'scholarship-cancel-approve',
            confirmId: 'scholarship-confirm-approve',
            confirmText: 'Ya, Teruskan ke Ketua Program Studi',
            confirmClass: APPROVE_ACTION_CONFIRM_CLASS,
            notices: [{
                title: 'Dokumen telah diverifikasi',
                message: 'Anda akan meneruskan pengajuan surat ini ke Ketua Program Studi (Kaprodi/Sekprodi). Pastikan semua data sudah benar dan lengkap.',
                classes: 'bg-amber-50 border border-amber-100 text-amber-900',
            }],
            summaryRows: beasiswaActionSummaryRows(identity),
            fields: [{
                id: 'scholarship-nomor-surat',
                payloadKey: 'nomor_surat',
                label: 'Tambahkan Nomor Surat',
                type: 'text',
                placeholder: 'Isi Nomor Surat',
                helper: 'Nomor surat diinput manual oleh Tendik dan akan digunakan pada dokumen final.',
                requiredMessage: 'Nomor surat wajib diisi manual oleh Tendik.',
            }],
        },
    };
}

function statusLabel(status?: string | null): string {
    return getLetterStatusLabel(status, 'tendik-review') || '-';
}
