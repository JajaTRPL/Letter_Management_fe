import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import { attachProtectedPdfViewer, renderProtectedPdfViewer } from '../shared/protected-pdf-viewer';
import { getLetterStatusLabel, getLetterStatusTone, LETTER_WORKFLOW_STATUS } from '../shared/letter-workflow';
import { showError, showSuccess, showWarning } from '../shared/toast';
import {
    activePageForReviewerOrigin,
    goToReviewerOrigin,
    resolveReviewerOrigin,
    type ReviewerOrigin,
    type ReviewerNavigationOptions,
} from '../shared/reviewer-navigation';

type ProsesLuarNegeriReviewResponse = {
    application: ProsesLuarNegeriApplication;
    message?: string;
};

type ProsesLuarNegeriApplication = {
    id: number;
    status?: string | null;
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    jenis_kelamin?: string | null;
    semester?: number | string | null;
    nomor_paspor?: string | null;
    keperluan?: string | null;
    nomor_surat?: string | null;
    revision_note?: string | null;
    rejection_reason?: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    tendik_approved_at?: string | null;
    kaprodi_approved_at?: string | null;
    kadep_approved_at?: string | null;
    mahasiswa_profile?: StudentProfile | null;
    user?: StudentUser | null;
    assigned_tendik?: StudentUser | null;
};

type StudentProfile = {
    nama_lengkap?: string | null;
    nim?: string | null;
    fakultas?: string | null;
    program_studi?: string | null;
    email?: string | null;
    no_telp?: string | null;
};

type StudentUser = {
    name?: string | null;
    email?: string | null;
    study_program?: {
        id?: number | null;
        code?: string | null;
        name?: string | null;
        department?: {
            id?: number | null;
            code?: string | null;
            name?: string | null;
            faculty?: {
                id?: number | null;
                code?: string | null;
                name?: string | null;
            } | null;
        } | null;
    } | null;
};

type ReviewerStage = 'prodi' | 'department';

const LETTER_LABEL = 'Proses Luar Negeri';
const API_PREFIX = '/api/akademik/proses-luar-negeri';
const GENERATED_LETTER_PREVIEW_ROOT_ID = 'pln-akademik-generated-letter-preview';
let revokeGeneratedLetterPreview: (() => void) | null = null;

const PHASE_BEARING_STATUSES: readonly string[] = [
    LETTER_WORKFLOW_STATUS.SUBMITTED,
    LETTER_WORKFLOW_STATUS.APPROVED_TENDIK,
    LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI,
    LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW,
    LETTER_WORKFLOW_STATUS.COMPLETED,
    LETTER_WORKFLOW_STATUS.REVISION,
    LETTER_WORKFLOW_STATUS.REJECTED,
];

const hasGeneratedPreview = (status?: string | null): boolean =>
    typeof status === 'string' && PHASE_BEARING_STATUSES.includes(status);

const renderGeneratedLetterPreviewCard = (): string =>
    renderProtectedPdfViewer(GENERATED_LETTER_PREVIEW_ROOT_ID, {
        title: 'Pratinjau Proses Luar Negeri',
        subtitle: 'Pratinjau PDF sesuai tahap pengajuan saat ini',
        loading: 'Memuat pratinjau surat...',
    });

const attachGeneratedLetterPreview = (applicationId: number): void => {
    cleanupGeneratedLetterPreview();
    revokeGeneratedLetterPreview = attachProtectedPdfViewer({
        rootId: GENERATED_LETTER_PREVIEW_ROOT_ID,
        endpointUrl: `${API_PREFIX}/${applicationId}/generated-preview`,
    });
};

const cleanupGeneratedLetterPreview = (): void => {
    if (!revokeGeneratedLetterPreview) return;
    revokeGeneratedLetterPreview();
    revokeGeneratedLetterPreview = null;
};

export const renderReviewProsesLuarNegeriAkademik = async (applicationId: number, options?: ReviewerNavigationOptions) => {
    const origin = resolveReviewerOrigin(options);
    const activePage = activePageForReviewerOrigin(origin);
    const role = localStorage.getItem('auth_role') || 'akademik';
    const subRole = localStorage.getItem('auth_sub_role') || role;
    const isProdiReviewer = ['kaprodi', 'sekprodi'].includes(role) || ['kaprodi', 'sekprodi'].includes(subRole);
    const isDepartmentReviewer = ['kadep', 'sekdep'].includes(role) || ['kadep', 'sekdep'].includes(subRole);

    renderDashboardLayout(
        'Review Dokumen',
        '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-800"></div></div>',
        role,
        activePage
    );

    try {
        const response = await apiFetch(`${API_PREFIX}/${applicationId}`);
        const data = await response.json() as ProsesLuarNegeriReviewResponse;

        if (!response.ok) {
            throw new Error(data.message || 'Gagal mengambil data pengajuan Proses Luar Negeri');
        }

        const app = data.application;
        const profile = app.mahasiswa_profile;
        const studentName = valueOrDash(profile?.nama_lengkap || app.user?.name);
        const studentEmail = valueOrDash(profile?.email || app.user?.email);
        // Canonical academic display: prefer the relation tree over legacy text columns.
        const canonicalProdi = app.user?.study_program?.name ?? profile?.program_studi ?? null;
        const canonicalFakultas = app.user?.study_program?.department?.faculty?.name ?? profile?.fakultas ?? null;
        const canonicalDepartemen = app.user?.study_program?.department?.name ?? null;
        const canProdiAct = isProdiReviewer && app.status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK;
        const canDepartmentAct = isDepartmentReviewer && app.status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI;
        const reviewerStage: ReviewerStage | null = canProdiAct ? 'prodi' : canDepartmentAct ? 'department' : null;
        const canAct = reviewerStage !== null;

        const content = `
            <div class="w-full max-w-5xl mx-auto pb-20 animate-fade-in space-y-6">
                <div class="flex items-center gap-4 mb-2">
                    <button id="back-to-akademik-dashboard" class="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" aria-label="Kembali ke dashboard akademik">
                        ${iconArrowLeft()}
                    </button>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-800">Review ${LETTER_LABEL}</h1>
                        <p class="text-xs text-gray-500 mt-1">${isDepartmentReviewer ? 'Data pengajuan ditampilkan untuk tanda tangan Kadep/Sekdep.' : 'Data pengajuan ditampilkan untuk paraf Kaprodi/Sekprodi.'}</p>
                    </div>
                </div>

                ${renderSection('Profil SSO', `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${renderInfoBox('Nama Lengkap', studentName)}
                        ${renderInfoBox('NIM', valueOrDash(profile?.nim))}
                        ${renderInfoBox('Fakultas', valueOrDash(canonicalFakultas))}
                        ${renderInfoBox('Departemen', valueOrDash(canonicalDepartemen))}
                        ${renderInfoBox('Program Studi', valueOrDash(canonicalProdi))}
                        ${renderInfoBox('Email Aktif', studentEmail)}
                        ${renderInfoBox('No. Telepon', valueOrDash(profile?.no_telp))}
                    </div>
                `)}

                ${renderSection('Detail Profil & Pengajuan', `
                    <div class="space-y-5">
                        <div class="flex flex-wrap items-center gap-3">
                            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</span>
                            <span class="${statusClass(app.status)}">${statusLabel(app.status)}</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${renderInfoBox('Tempat, Tanggal Lahir', formatPlaceAndDate(app))}
                            ${renderInfoBox('Jenis Kelamin', valueOrDash(app.jenis_kelamin))}
                            ${renderInfoBox('Semester', valueOrDash(app.semester))}
                            ${renderInfoBox('Nomor Paspor', valueOrDash(app.nomor_paspor))}
                            ${renderInfoBox('Keperluan', valueOrDash(app.keperluan))}
                            ${renderInfoBox('Nomor Surat', valueOrDash(app.nomor_surat))}
                        </div>
                        <div class="pt-2 border-t border-gray-100 border-dashed text-xs text-gray-500 font-medium">
                            Tanggal Pengajuan: ${formatDate(app.submitted_at || app.created_at)}
                        </div>
                    </div>
                `)}

                ${app.revision_note || app.rejection_reason ? renderSection('Catatan Pengajuan', `
                    <div class="space-y-4">
                        ${app.revision_note ? renderNotice('Catatan Revisi', app.revision_note, 'bg-yellow-50 border-yellow-200 text-yellow-900') : ''}
                        ${app.rejection_reason ? renderNotice('Alasan Penolakan', app.rejection_reason, 'bg-red-50 border-red-200 text-red-700') : ''}
                    </div>
                `) : ''}

                ${renderSection('Tahap Persetujuan', renderTimeline(app))}

                ${hasGeneratedPreview(app.status) ? renderSection('Pratinjau Dokumen', renderGeneratedLetterPreviewCard()) : ''}

                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <p class="text-sm font-bold text-gray-800 mb-2">Tindakan Persetujuan</p>
                    ${canAct ? `
                        <div class="space-y-4">
                            <button id="pln-akademik-revise-btn" type="button" class="w-full py-3.5 bg-[#FACC15] hover:bg-[#EAB308] text-yellow-900 font-bold rounded-xl transition-colors border border-[#EAB308]/50 shadow-sm active:scale-[0.98]">
                                Minta Revisi
                            </button>
                            <button id="pln-akademik-reject-btn" type="button" class="w-full py-3.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold rounded-xl transition-colors shadow-sm active:scale-[0.98]">
                                Tolak Pengajuan Surat
                            </button>
                            <button id="pln-akademik-approve-btn" type="button" class="w-full py-3.5 bg-[#115E59] hover:bg-[#0d4a46] text-white font-bold rounded-xl transition-colors shadow-sm active:scale-[0.98]">
                                ${reviewerStage === 'department' ? 'Tandatangani dan Selesaikan di Akademik' : 'Paraf dan Teruskan ke Kadep/Sekdep'}
                            </button>
                            <div class="mt-4 bg-[#FEF9C3]/50 border border-[#FEF08A] rounded-xl p-4 text-xs font-medium text-amber-900 shadow-inner">
                                <p><span class="font-bold">Catatan:</span> ${reviewerStage === 'department' ? 'Tindakan ini akan membuat dokumen final dan meneruskan pengajuan ke tahap review mahasiswa.' : 'Tindakan ini meneruskan pengajuan ke Kadep/Sekdep untuk tanda tangan akhir.'}</p>
                            </div>
                        </div>
                    ` : `
                        <p class="text-xs text-gray-500 leading-relaxed">
                            ${readOnlyMessage(app.status, isProdiReviewer, isDepartmentReviewer)}
                        </p>
                    `}
                </div>
            </div>
            ${canAct ? renderActionModals(studentName, valueOrDash(profile?.nim), reviewerStage) : ''}
        `;

        renderDashboardLayout('Review Dokumen', content, role, activePage);
        document.getElementById('back-to-akademik-dashboard')?.addEventListener('click', () => {
            cleanupGeneratedLetterPreview();
            void goToReviewerOrigin(origin, role);
        });

        if (hasGeneratedPreview(app.status)) {
            attachGeneratedLetterPreview(applicationId);
        } else {
            cleanupGeneratedLetterPreview();
        }

        if (canAct) {
            bindActionHandlers(applicationId, role, origin, reviewerStage);
        }
    } catch (error) {
        cleanupGeneratedLetterPreview();
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data';
        renderDashboardLayout(
            'Error',
            `<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">${escapeHtml(message)}</div>`,
            role,
            'dokumen'
        );
    }
};

function renderActionModals(studentName: string, nim: string, reviewerStage: ReviewerStage): string {
    return `
        ${renderApprovalModal(studentName, nim, reviewerStage)}
        ${renderTextActionModal({
            id: 'pln-akademik-revision-modal',
            title: 'Permintaan Revisi',
            headerClass: 'bg-[#FACC15] text-gray-900',
            label: 'Catatan Revisi',
            placeholder: 'Contoh: Keperluan surat perlu diperjelas sebelum diproses lebih lanjut.',
            helper: 'Tuliskan instruksi revisi secara jelas agar mahasiswa mengetahui bagian yang perlu diperbaiki.',
            confirmId: 'pln-akademik-confirm-revise',
            cancelId: 'pln-akademik-cancel-revise',
            textareaId: 'pln-akademik-revision-note',
            confirmText: 'Kirim Permintaan Revisi',
            confirmClass: 'bg-[#FACC15] hover:bg-[#EAB308] text-yellow-900 border border-[#0D4A46]',
            studentName,
            nim,
        })}
        ${renderTextActionModal({
            id: 'pln-akademik-rejection-modal',
            title: 'Tolak Pengajuan Surat',
            headerClass: 'bg-[#EF4444] text-white',
            label: 'Alasan Penolakan',
            placeholder: 'Contoh: Data yang diajukan tidak valid dan tidak dapat diproses lebih lanjut.',
            helper: 'Berikan penjelasan yang jelas mengapa pengajuan ditolak.',
            confirmId: 'pln-akademik-confirm-reject',
            cancelId: 'pln-akademik-cancel-reject',
            textareaId: 'pln-akademik-rejection-reason',
            confirmText: 'Ya, Tolak Pengajuan',
            confirmClass: 'bg-[#EF4444] hover:bg-[#DC2626] text-white',
            studentName,
            nim,
        })}
    `;
}

function renderApprovalModal(studentName: string, nim: string, reviewerStage: ReviewerStage): string {
    const isDepartmentStage = reviewerStage === 'department';

    return `
        <div id="pln-akademik-approval-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="pln-akademik-approval-title">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div class="bg-[#115E59] px-8 py-5 text-white">
                    <h3 id="pln-akademik-approval-title" class="text-lg font-bold">${isDepartmentStage ? 'Konfirmasi Tanda Tangan' : 'Konfirmasi Paraf'}</h3>
                </div>
                <div class="p-8 space-y-6">
                    <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-900">
                        <p class="font-bold text-sm">${isDepartmentStage ? 'Pengajuan siap ditandatangani' : 'Pengajuan siap diparaf'}</p>
                        <p class="text-xs leading-relaxed mt-1">${isDepartmentStage ? 'Anda akan memberi tanda tangan akhir, membuat dokumen final, dan meneruskan pengajuan ke tahap review mahasiswa.' : 'Anda akan memparaf pengajuan ini dan meneruskannya ke Kadep/Sekdep untuk tanda tangan akhir.'}</p>
                    </div>
                    <div class="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                        ${renderModalRow('Mahasiswa', studentName)}
                        ${renderModalRow('NIM', nim)}
                        ${renderModalRow('Jenis Surat', LETTER_LABEL)}
                    </div>
                </div>
                <div class="px-8 pb-8 flex gap-3">
                    <button id="pln-akademik-cancel-approve" type="button" class="flex-1 px-6 py-3.5 border-2 border-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-colors text-sm shadow-sm">
                        Batal
                    </button>
                    <button id="pln-akademik-confirm-approve" type="button" class="flex-[1.5] px-6 py-3.5 bg-[#115E59] text-white font-bold rounded-2xl hover:bg-[#0d4a46] transition-all shadow-lg active:scale-[0.98] text-sm">
                        ${isDepartmentStage ? 'Ya, Tandatangani' : 'Ya, Paraf Pengajuan'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

type TextActionModalConfig = {
    id: string;
    title: string;
    headerClass: string;
    label: string;
    placeholder: string;
    helper: string;
    confirmId: string;
    cancelId: string;
    textareaId: string;
    confirmText: string;
    confirmClass: string;
    studentName: string;
    nim: string;
};

function renderTextActionModal(config: TextActionModalConfig): string {
    return `
        <div id="${config.id}" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="${config.id}-title">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
                <div class="${config.headerClass} px-8 py-5">
                    <h3 id="${config.id}-title" class="text-lg font-bold">${escapeHtml(config.title)}</h3>
                </div>
                <div class="p-8 space-y-6">
                    ${config.id === 'pln-akademik-rejection-modal' ? `
                        <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-900 text-xs leading-relaxed">
                            <p class="font-bold text-sm mb-1">PERHATIAN:</p>
                            <p>Pengajuan akan ditolak dan mahasiswa dapat melihat alasan penolakan pada detail pengajuan.</p>
                        </div>
                    ` : ''}
                    <div class="text-sm text-gray-700">
                        <p>Mahasiswa: <span class="font-bold">${escapeHtml(config.studentName)}</span> (${escapeHtml(config.nim)})</p>
                        <p>Jenis Surat: <span class="font-bold">${LETTER_LABEL}</span></p>
                    </div>
                    <div class="space-y-2">
                        <label for="${config.textareaId}" class="block text-sm font-bold text-gray-700">${escapeHtml(config.label)} *</label>
                        <textarea
                            id="${config.textareaId}"
                            rows="4"
                            placeholder="${escapeHtml(config.placeholder)}"
                            class="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm resize-none"
                        ></textarea>
                        <p class="text-xs font-medium text-gray-600">${escapeHtml(config.helper)}</p>
                    </div>
                </div>
                <div class="px-8 pb-8 flex gap-3">
                    <button id="${config.cancelId}" type="button" class="flex-1 px-6 py-3.5 border-2 border-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-colors text-sm">
                        Batal
                    </button>
                    <button id="${config.confirmId}" type="button" class="flex-[1.2] px-6 py-3.5 font-bold rounded-2xl transition-all active:scale-[0.98] text-sm ${config.confirmClass}">
                        ${escapeHtml(config.confirmText)}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function bindActionHandlers(applicationId: number, role: string, origin: ReviewerOrigin, reviewerStage: ReviewerStage): void {
    bindModalOpenClose('pln-akademik-approve-btn', 'pln-akademik-approval-modal', 'pln-akademik-cancel-approve');
    bindModalOpenClose('pln-akademik-revise-btn', 'pln-akademik-revision-modal', 'pln-akademik-cancel-revise');
    bindModalOpenClose('pln-akademik-reject-btn', 'pln-akademik-rejection-modal', 'pln-akademik-cancel-reject');

    document.getElementById('pln-akademik-confirm-approve')?.addEventListener('click', async () => {
        await submitProsesLuarNegeriAction({
            applicationId,
            role,
            origin,
            endpoint: 'approve',
            buttonId: 'pln-akademik-confirm-approve',
            successFallback: reviewerStage === 'department'
                ? 'Pengajuan berhasil ditandatangani dan menunggu review mahasiswa.'
                : 'Pengajuan berhasil diparaf dan diteruskan ke Kadep/Sekdep.',
        });
    });

    document.getElementById('pln-akademik-confirm-revise')?.addEventListener('click', async () => {
        const note = readTextarea('pln-akademik-revision-note');
        if (!note) {
            showWarning('Catatan revisi wajib diisi.');
            return;
        }

        await submitProsesLuarNegeriAction({
            applicationId,
            role,
            origin,
            endpoint: 'revise',
            payload: { note },
            buttonId: 'pln-akademik-confirm-revise',
            successFallback: 'Permintaan revisi berhasil dikirim.',
        });
    });

    document.getElementById('pln-akademik-confirm-reject')?.addEventListener('click', async () => {
        const reason = readTextarea('pln-akademik-rejection-reason');
        if (!reason) {
            showWarning('Alasan penolakan wajib diisi.');
            return;
        }

        await submitProsesLuarNegeriAction({
            applicationId,
            role,
            origin,
            endpoint: 'reject',
            payload: { reason },
            buttonId: 'pln-akademik-confirm-reject',
            successFallback: 'Pengajuan berhasil ditolak.',
        });
    });

    document.addEventListener('keydown', function closeProsesLuarNegeriAkademikModals(event) {
        if (event.key === 'Escape') {
            closeAllProsesLuarNegeriAkademikModals();
        }
    }, { once: true });
}

function bindModalOpenClose(buttonId: string, modalId: string, cancelId: string): void {
    document.getElementById(buttonId)?.addEventListener('click', () => {
        document.getElementById(modalId)?.classList.remove('hidden');
    });

    document.getElementById(cancelId)?.addEventListener('click', () => {
        document.getElementById(modalId)?.classList.add('hidden');
    });
}

type SubmitActionOptions = {
    applicationId: number;
    role: string;
    origin: ReviewerOrigin;
    endpoint: 'approve' | 'revise' | 'reject';
    payload?: Record<string, string>;
    buttonId: string;
    successFallback: string;
};

async function submitProsesLuarNegeriAction(options: SubmitActionOptions): Promise<void> {
    const button = document.getElementById(options.buttonId) as HTMLButtonElement | null;
    const originalText = button?.innerHTML || '';

    if (button) {
        button.disabled = true;
        button.innerHTML = 'Memproses...';
    }

    try {
        const response = await apiFetch(`${API_PREFIX}/${options.applicationId}/${options.endpoint}`, {
            method: 'PATCH',
            body: options.payload ? JSON.stringify(options.payload) : undefined,
        });
        const result = await response.json() as { message?: string; errors?: Record<string, string[]> };

        if (!response.ok) {
            throw new Error(errorMessageFromResponse(result));
        }

        showSuccess(result.message || options.successFallback);
        closeAllProsesLuarNegeriAkademikModals();
        cleanupGeneratedLetterPreview();
        void goToReviewerOrigin(options.origin, options.role);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal memproses pengajuan';
        showError(message);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

function renderSection(title: string, body: string): string {
    return `
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
            <div class="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 bg-[#F8FAFC]/50">
                ${escapeHtml(title)}
            </div>
            <div class="p-6 md:p-8">
                ${body}
            </div>
        </div>
    `;
}

function renderTimeline(app: ProsesLuarNegeriApplication): string {
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

    const steps = [
        { label: 'Diajukan', date: app.submitted_at || app.created_at, done: true },
        { label: 'Verifikasi Tenaga Pendidik', date: app.tendik_approved_at, done: tendikDoneStatuses.includes(app.status || '') },
        { label: 'Paraf Kaprodi/Sekprodi', date: app.kaprodi_approved_at, done: kaprodiDoneStatuses.includes(app.status || ''), current: app.status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK },
        { label: 'Tanda Tangan Kadep/Sekdep', date: app.kadep_approved_at, done: departmentDoneStatuses.includes(app.status || ''), current: app.status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI },
        { label: 'Review Mahasiswa', date: null, done: app.status === LETTER_WORKFLOW_STATUS.COMPLETED, current: app.status === LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW },
    ];

    return `
        <div class="relative pl-6 border-l-2 border-[#115E59] space-y-6 pb-2">
            ${steps.map((step) => `
                <div class="relative">
                    <div class="absolute -left-[31px] ${timelineDotClass(step.done, step.current)}">
                        ${step.done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    <p class="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">${formatDate(step.date)}</p>
                    <p class="text-sm font-bold ${step.current ? 'text-[#A16207]' : step.done ? 'text-gray-800' : 'text-gray-400'}">${escapeHtml(step.label)}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function timelineDotClass(done: boolean, current?: boolean): string {
    if (done) {
        return 'bg-[#115E59] rounded-full p-0.5 border-4 border-white';
    }

    if (current) {
        return 'bg-white border-2 border-yellow-400 w-5 h-5 rounded-full z-10 flex items-center justify-center';
    }

    return 'bg-gray-300 rounded-full w-5 h-5 border-4 border-white';
}

function readTextarea(id: string): string {
    const field = document.getElementById(id) as HTMLTextAreaElement | null;
    return field?.value.trim() || '';
}

function closeAllProsesLuarNegeriAkademikModals(): void {
    ['pln-akademik-approval-modal', 'pln-akademik-revision-modal', 'pln-akademik-rejection-modal'].forEach((id) => {
        document.getElementById(id)?.classList.add('hidden');
    });
}

function errorMessageFromResponse(result: { message?: string; errors?: Record<string, string[]> }): string {
    if (result.message) {
        return result.message;
    }

    const firstError = Object.values(result.errors || {})[0]?.[0];
    return firstError || 'Gagal memproses pengajuan';
}

function readOnlyMessage(status?: string | null, isProdiReviewer?: boolean, isDepartmentReviewer?: boolean): string {
    if (isDepartmentReviewer) {
        return `Pengajuan berada pada status ${statusLabel(status)}, sehingga tindakan Kadep/Sekdep tidak tersedia.`;
    }

    if (isProdiReviewer) {
        return `Pengajuan berada pada status ${statusLabel(status)}, sehingga tindakan Prodi tidak tersedia.`;
    }

    return 'Anda tidak memiliki akses tindakan untuk tahap persetujuan pengajuan ini.';
}

function renderInfoBox(label: string, value: string): string {
    return `
        <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
            <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">${escapeHtml(label)}</label>
            <p class="text-sm font-semibold text-gray-800 whitespace-pre-line">${escapeHtml(value)}</p>
        </div>
    `;
}

function renderNotice(title: string, message: string, classes: string): string {
    return `
        <div class="rounded-xl border p-4 ${classes}">
            <p class="text-xs font-black uppercase tracking-wider mb-1">${escapeHtml(title)}</p>
            <p class="text-sm font-semibold whitespace-pre-line">${escapeHtml(message)}</p>
        </div>
    `;
}

function renderModalRow(label: string, value: string): string {
    return `
        <div class="flex justify-between gap-4 text-[11px]">
            <span class="text-gray-400 font-bold uppercase tracking-wider">${escapeHtml(label)}</span>
            <span class="text-gray-700 font-bold text-right">${escapeHtml(value)}</span>
        </div>
    `;
}

function valueOrDash(value?: string | number | null): string {
    const trimmed = String(value ?? '').trim();
    return trimmed || '-';
}

function formatPlaceAndDate(app: ProsesLuarNegeriApplication): string {
    const place = valueOrDash(app.tempat_lahir);
    const date = formatBirthDate(app.tanggal_lahir);

    if (place === '-' && date === '-') {
        return '-';
    }

    return [place === '-' ? '' : place, date === '-' ? '' : date].filter(Boolean).join(', ');
}

function formatBirthDate(value?: string | null): string {
    if (!value) {
        return '-';
    }

    const clean = value.match(/\d{4}-\d{2}-\d{2}/)?.[0] || value;
    const [year, month, day] = clean.split('-');
    if (!year || !month || !day) {
        return value;
    }

    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function formatDate(value?: string | null): string {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function statusLabel(status?: string | null): string {
    return getLetterStatusLabel(status, 'akademik-review') || valueOrDash(status);
}

function statusClass(status?: string | null): string {
    const base = 'inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold border';
    return `${base} ${getLetterStatusTone(status, 'akademik-review')}`;
}

function iconArrowLeft(): string {
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
