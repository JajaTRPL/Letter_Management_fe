import { apiFetch } from '../shared/api-client';
import {
    renderReviewerShell,
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

export const renderReviewSuratTugas = async (
    applicationId: number,
    options?: ReviewerNavigationOptions,
): Promise<void> => {
    const origin = resolveReviewerOrigin(options);
    const role = localStorage.getItem('auth_role') || 'tendik';

    await renderReviewerShell<SuratTugasApplication>({
        role,
        activePage: activePageForReviewerOrigin(origin),
        loadApplication: () => loadSuratTugasApplication(applicationId),
        buildView: (app) => {
            const identity = getSuratTugasReviewerIdentity(app);
            const endpointPrefix = `/api/tendik/surat-tugas/${applicationId}`;
            const canAct = app.status === LETTER_WORKFLOW_STATUS.SUBMITTED;
            const actions = canAct
                ? [
                    ...createSuratTugasTextActions({
                        audience: 'tendik',
                        prefix: 'surat-tugas',
                        endpointPrefix,
                        identity,
                    }),
                    createApproveAction(app, identity, endpointPrefix),
                ]
                : undefined;

            return buildSuratTugasReviewerView(app, {
                subtitle: 'Data pengajuan ditampilkan untuk verifikasi Tendik.',
                statusContext: 'tendik-review',
                backButtonId: 'back-to-document-list',
                backButtonLabel: 'Kembali ke daftar dokumen',
                supportingGalleryRootId: 'surat-tugas-tendik-supporting-gallery',
                generatedPreviewRootId: 'surat-tugas-tendik-generated-letter-preview',
                generatedPreviewEndpointUrl: `${endpointPrefix}/generated-preview`,
                actionTitle: 'Tindakan Verifikasi',
                unavailableMessage: `Pengajuan berada pada status ${statusLabel(app)}, sehingga tindakan Tendik tidak tersedia.`,
                actions,
                actionNote: canAct
                    ? 'Pastikan data dan dokumen pendukung sudah sesuai sebelum melanjutkan. Nomor Surat Tugas wajib diisi manual saat menyetujui pengajuan.'
                    : undefined,
            });
        },
        goBack: () => goToReviewerOrigin(origin, role),
    });
};

async function loadSuratTugasApplication(applicationId: number): Promise<SuratTugasApplication> {
    const response = await apiFetch(`/api/tendik/surat-tugas/${applicationId}`);
    const data = await response.json() as SuratTugasReviewResponse;
    if (!response.ok) {
        throw new Error(data.message || 'Gagal mengambil data pengajuan Surat Tugas');
    }
    return data.application;
}

function createApproveAction(
    app: SuratTugasApplication,
    identity: ReturnType<typeof getSuratTugasReviewerIdentity>,
    endpointPrefix: string,
): ReviewerShellAction {
    return {
        buttonId: 'surat-tugas-approve-btn',
        buttonText: 'Setujui dan Teruskan ke Pimpinan',
        buttonClass: 'bg-[#115E59] hover:bg-[#0d4a46] text-white',
        endpointUrl: `${endpointPrefix}/approve`,
        successFallback: 'Pengajuan berhasil diverifikasi dan diteruskan.',
        modal: {
            id: 'surat-tugas-approval-modal',
            title: 'Konfirmasi Persetujuan',
            headerClass: 'bg-[#115E59] text-white',
            cancelId: 'surat-tugas-cancel-approve',
            confirmId: 'surat-tugas-confirm-approve',
            confirmText: 'Ya, Teruskan ke Kaprodi',
            confirmClass: 'bg-[#115E59] text-white hover:bg-[#0d4a46]',
            notices: [{
                title: 'Dokumen telah diverifikasi',
                message: 'Anda akan meneruskan pengajuan surat ini ke Kaprodi/Sekprodi. Pastikan semua data sudah benar dan lengkap.',
                classes: 'bg-amber-50 border border-amber-100 text-amber-900',
            }],
            summaryRows: suratTugasActionSummaryRows(app, identity),
            fields: [{
                id: 'surat-tugas-nomor-surat',
                payloadKey: 'nomor_surat_tugas',
                label: 'Nomor Surat Tugas',
                type: 'text',
                placeholder: 'Contoh: 123/UN1.P.III/TM.03/2026',
                helper: 'Nomor surat tugas diinput manual oleh Tendik dan akan digunakan pada dokumen final.',
                requiredMessage: 'Nomor Surat Tugas wajib diisi manual oleh Tendik.',
            }],
        },
    };
}

function statusLabel(app: SuratTugasApplication): string {
    return getLetterStatusLabel(app.status, 'tendik-review') || app.status || '-';
}
