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

export const renderReviewProsesLuarNegeri = async (
    applicationId: number,
    options?: ReviewerNavigationOptions,
): Promise<void> => {
    const origin = resolveReviewerOrigin(options);
    const role = localStorage.getItem('auth_role') || 'tendik';

    await renderReviewerShell<PlnApplication>({
        role,
        activePage: activePageForReviewerOrigin(origin),
        loadApplication: () => loadPlnApplication(applicationId),
        buildView: (app) => {
            const identity = getPlnReviewerIdentity(app);
            const endpointPrefix = `/api/tendik/proses-luar-negeri/${applicationId}`;
            const canAct = app.status === LETTER_WORKFLOW_STATUS.SUBMITTED;
            const actions = canAct
                ? [
                    ...createPlnTextActions({
                        audience: 'tendik',
                        prefix: 'pln',
                        endpointPrefix,
                        identity,
                    }),
                    createApproveAction(app, identity, endpointPrefix),
                ]
                : undefined;

            return buildPlnReviewerView(app, {
                subtitle: 'Data pengajuan ditampilkan untuk verifikasi Tendik.',
                statusContext: 'tendik-review',
                backButtonId: 'back-to-document-list',
                backButtonLabel: 'Kembali ke daftar dokumen',
                generatedPreviewRootId: 'pln-tendik-generated-letter-preview',
                generatedPreviewEndpointUrl: `${endpointPrefix}/generated-preview`,
                actionTitle: 'Tindakan Verifikasi',
                unavailableMessage: `Pengajuan berada pada status ${statusLabel(app)}, sehingga tindakan Tendik tidak tersedia.`,
                actions,
                actionNote: canAct
                    ? 'Pastikan data pengajuan sudah sesuai sebelum melanjutkan. Nomor surat wajib diisi manual saat menyetujui pengajuan.'
                    : undefined,
            });
        },
        goBack: () => goToReviewerOrigin(origin, role),
    });
};

async function loadPlnApplication(applicationId: number): Promise<PlnApplication> {
    const response = await apiFetch(`/api/tendik/proses-luar-negeri/${applicationId}`);
    const data = await response.json() as PlnReviewResponse;
    if (!response.ok) {
        throw new Error(data.message || 'Gagal mengambil data pengajuan proses luar negeri');
    }
    return data.application;
}

function createApproveAction(
    app: PlnApplication,
    identity: ReturnType<typeof getPlnReviewerIdentity>,
    endpointPrefix: string,
): ReviewerShellAction {
    return {
        buttonId: 'pln-approve-btn',
        buttonText: 'Setujui dan Teruskan ke Pimpinan',
        buttonClass: 'bg-[#115E59] hover:bg-[#0d4a46] text-white',
        endpointUrl: `${endpointPrefix}/approve`,
        successFallback: 'Pengajuan berhasil diverifikasi dan diteruskan.',
        modal: {
            id: 'pln-approval-modal',
            title: 'Konfirmasi Persetujuan',
            headerClass: 'bg-[#115E59] text-white',
            cancelId: 'pln-cancel-approve',
            confirmId: 'pln-confirm-approve',
            confirmText: 'Ya, Teruskan ke Kaprodi',
            confirmClass: 'bg-[#115E59] text-white hover:bg-[#0d4a46]',
            notices: [{
                title: 'Data telah diverifikasi',
                message: 'Anda akan meneruskan pengajuan surat ini ke Kaprodi/Sekprodi. Pastikan semua data sudah benar dan lengkap.',
                classes: 'bg-amber-50 border border-amber-100 text-amber-900',
            }],
            summaryRows: plnActionSummaryRows(app, identity),
            fields: [{
                id: 'pln-nomor-surat',
                payloadKey: 'nomor_surat',
                label: 'Nomor Surat',
                type: 'text',
                placeholder: 'Isi Nomor Surat',
                helper: 'Nomor surat diinput manual oleh Tendik dan akan digunakan pada dokumen final.',
                requiredMessage: 'Nomor surat wajib diisi manual oleh Tendik.',
            }],
        },
    };
}

function statusLabel(app: PlnApplication): string {
    return getLetterStatusLabel(app.status, 'tendik-review') || app.status || '-';
}
