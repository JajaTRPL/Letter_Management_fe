import { apiFetch } from '../shared/api-client';
import {
    renderReviewerShell,
    type ReviewerShellAction,
} from '../shared/reviewer-shell';
import {
    buildMagangReviewerView,
    createMagangTextActions,
    getMagangReviewerIdentity,
    magangActionSummaryRows,
    type MagangApplication,
    type MagangReviewResponse,
} from '../shared/magang-reviewer';
import { getLetterStatusLabel, LETTER_WORKFLOW_STATUS } from '../shared/letter-workflow';
import {
    activePageForReviewerOrigin,
    goToReviewerOrigin,
    resolveReviewerOrigin,
    type ReviewerNavigationOptions,
} from '../shared/reviewer-navigation';

export const renderReviewSuratPengantarMagang = async (
    applicationId: number,
    options?: ReviewerNavigationOptions,
): Promise<void> => {
    const origin = resolveReviewerOrigin(options);
    const role = localStorage.getItem('auth_role') || 'tendik';

    await renderReviewerShell<MagangApplication>({
        role,
        activePage: activePageForReviewerOrigin(origin),
        loadApplication: () => loadMagangApplication(applicationId),
        buildView: (app) => {
            const identity = getMagangReviewerIdentity(app);
            const endpointPrefix = `/api/tendik/surat-pengantar-magang/${applicationId}`;
            const canAct = app.status === LETTER_WORKFLOW_STATUS.SUBMITTED;
            const actions = canAct
                ? [
                    ...createMagangTextActions({
                        audience: 'tendik',
                        prefix: 'magang',
                        endpointPrefix,
                        identity,
                    }),
                    createApproveAction(app, identity, endpointPrefix),
                ]
                : undefined;

            return buildMagangReviewerView(app, {
                subtitle: 'Data pengajuan ditampilkan untuk verifikasi Tendik.',
                statusContext: 'tendik-review',
                backButtonId: 'back-to-document-list',
                backButtonLabel: 'Kembali ke daftar dokumen',
                supportingGalleryRootId: 'magang-tendik-supporting-gallery',
                generatedPreviewRootId: 'magang-tendik-generated-letter-preview',
                generatedPreviewEndpointUrl: `${endpointPrefix}/generated-preview`,
                actionTitle: 'Tindakan Verifikasi',
                unavailableMessage: `Pengajuan berada pada status ${statusLabel(app)}, sehingga tindakan Tendik tidak tersedia.`,
                actions,
                actionNote: canAct
                    ? 'Pastikan data dan proposal sudah sesuai sebelum melanjutkan. Nomor surat wajib diisi manual saat menyetujui pengajuan.'
                    : undefined,
            });
        },
        goBack: () => goToReviewerOrigin(origin, role),
    });
};

async function loadMagangApplication(applicationId: number): Promise<MagangApplication> {
    const response = await apiFetch(`/api/tendik/surat-pengantar-magang/${applicationId}`);
    const data = await response.json() as MagangReviewResponse;
    if (!response.ok) {
        throw new Error(data.message || 'Gagal mengambil data pengajuan magang');
    }
    return data.application;
}

function createApproveAction(
    app: MagangApplication,
    identity: ReturnType<typeof getMagangReviewerIdentity>,
    endpointPrefix: string,
): ReviewerShellAction {
    return {
        buttonId: 'magang-approve-btn',
        buttonText: 'Setujui dan Teruskan ke Pimpinan',
        buttonClass: 'bg-[#115E59] hover:bg-[#0d4a46] text-white',
        endpointUrl: `${endpointPrefix}/approve`,
        successFallback: 'Pengajuan berhasil diverifikasi dan diteruskan.',
        modal: {
            id: 'magang-approval-modal',
            title: 'Konfirmasi Persetujuan',
            headerClass: 'bg-[#115E59] text-white',
            cancelId: 'magang-cancel-approve',
            confirmId: 'magang-confirm-approve',
            confirmText: 'Ya, Teruskan ke Kaprodi',
            confirmClass: 'bg-[#115E59] text-white hover:bg-[#0d4a46]',
            notices: [{
                title: 'Dokumen telah diverifikasi',
                message: 'Anda akan meneruskan pengajuan surat ini ke Kaprodi/Sekprodi. Pastikan semua data sudah benar dan lengkap.',
                classes: 'bg-amber-50 border border-amber-100 text-amber-900',
            }],
            summaryRows: magangActionSummaryRows(app, identity),
            fields: [{
                id: 'magang-nomor-surat-pengantar',
                payloadKey: 'nomor_surat_pengantar',
                label: 'Nomor Surat Pengantar',
                type: 'text',
                placeholder: 'Contoh: 123/UN1.P.III/TM.03/2026',
                helper: 'Nomor surat pengantar diinput manual oleh Tendik dan akan digunakan pada dokumen final.',
                requiredMessage: 'Nomor Surat Pengantar wajib diisi manual oleh Tendik.',
            }],
        },
    };
}

function statusLabel(app: MagangApplication): string {
    return getLetterStatusLabel(app.status, 'tendik-review') || app.status || '-';
}
