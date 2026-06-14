import { apiFetch } from '../shared/api-client';
import {
    renderReviewerShell,
    type ReviewerShellAction,
} from '../shared/reviewer-shell';
import {
    buildSkaReviewerView,
    createSkaTextActions,
    getSkaReviewerIdentity,
    skaActionSummaryRows,
    type SkaApplication,
    type SkaReviewResponse,
} from '../shared/ska-reviewer';
import { getLetterStatusLabel, LETTER_WORKFLOW_STATUS } from '../shared/letter-workflow';
import {
    activePageForReviewerOrigin,
    goToReviewerOrigin,
    resolveReviewerOrigin,
    type ReviewerNavigationOptions,
} from '../shared/reviewer-navigation';

export const renderReviewSuratKeteranganAktif = async (
    applicationId: number,
    options?: ReviewerNavigationOptions,
): Promise<void> => {
    const origin = resolveReviewerOrigin(options);
    const role = localStorage.getItem('auth_role') || 'tendik';

    await renderReviewerShell<SkaApplication>({
        role,
        activePage: activePageForReviewerOrigin(origin),
        loadApplication: () => loadSkaApplication(applicationId),
        buildView: (app) => {
            const identity = getSkaReviewerIdentity(app);
            const endpointPrefix = `/api/tendik/surat-keterangan-aktif/${applicationId}`;
            const canAct = app.status === LETTER_WORKFLOW_STATUS.SUBMITTED;
            const actions = canAct
                ? [
                    ...createSkaTextActions({
                        audience: 'tendik',
                        prefix: 'aktif',
                        endpointPrefix,
                        identity,
                    }),
                    createApproveAction(app, identity, endpointPrefix),
                ]
                : undefined;

            return buildSkaReviewerView(app, {
                subtitle: 'Data pengajuan ditampilkan untuk verifikasi Tendik.',
                statusContext: 'tendik-review',
                backButtonId: 'back-to-document-list',
                backButtonLabel: 'Kembali ke daftar dokumen',
                generatedPreviewRootId: 'aktif-tendik-generated-letter-preview',
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

async function loadSkaApplication(applicationId: number): Promise<SkaApplication> {
    const response = await apiFetch(`/api/tendik/surat-keterangan-aktif/${applicationId}`);
    const data = await response.json() as SkaReviewResponse;
    if (!response.ok) {
        throw new Error(data.message || 'Gagal mengambil data pengajuan surat keterangan aktif');
    }
    return data.application;
}

function createApproveAction(
    app: SkaApplication,
    identity: ReturnType<typeof getSkaReviewerIdentity>,
    endpointPrefix: string,
): ReviewerShellAction {
    return {
        buttonId: 'aktif-approve-btn',
        buttonText: 'Setujui dan Teruskan ke Pimpinan',
        buttonClass: 'bg-[#115E59] hover:bg-[#0d4a46] text-white',
        endpointUrl: `${endpointPrefix}/approve`,
        successFallback: 'Pengajuan berhasil diverifikasi dan diteruskan.',
        modal: {
            id: 'aktif-approval-modal',
            title: 'Konfirmasi Persetujuan',
            headerClass: 'bg-[#115E59] text-white',
            cancelId: 'aktif-cancel-approve',
            confirmId: 'aktif-confirm-approve',
            confirmText: 'Ya, Teruskan ke Kaprodi',
            confirmClass: 'bg-[#115E59] text-white hover:bg-[#0d4a46]',
            notices: [{
                title: 'Data telah diverifikasi',
                message: 'Anda akan meneruskan pengajuan surat ini ke Kaprodi/Sekprodi. Pastikan semua data sudah benar dan lengkap.',
                classes: 'bg-amber-50 border border-amber-100 text-amber-900',
            }],
            summaryRows: skaActionSummaryRows(app, identity),
            fields: [{
                id: 'aktif-nomor-surat',
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

function statusLabel(app: SkaApplication): string {
    return getLetterStatusLabel(app.status, 'tendik-review') || app.status || '-';
}
