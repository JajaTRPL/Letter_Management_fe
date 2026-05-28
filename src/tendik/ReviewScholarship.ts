import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import { getLetterStatusLabel, getLetterStatusTone, LETTER_WORKFLOW_STATUS } from '../shared/letter-workflow';
import { showError, showSuccess, showWarning } from '../shared/toast';
import {
    activePageForReviewerOrigin,
    goToReviewerOrigin,
    resolveReviewerOrigin,
    type ReviewerOrigin,
    type ReviewerNavigationOptions,
} from '../shared/reviewer-navigation';
import { attachProtectedPdfViewer, renderProtectedPdfViewer } from '../shared/protected-pdf-viewer';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite resolves the PDF.js worker as a URL.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Student = {
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
    term?: string | null;
    target?: string | null;
    submitted_at?: string | null;
};

type ScholarshipApplication = {
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
    transkrip_nilai_path?: string | null;
    slip_gaji_ayah_path?: string | null;
    slip_gaji_ibu_path?: string | null;
};

type ScholarshipReviewResponse = {
    application: ScholarshipApplication;
    student: Student;
    message?: string;
};

const LETTER_LABEL = 'Surat Permohonan Beasiswa';
const ACADEMIC_ROLES = new Set(['akademik', 'kaprodi', 'sekprodi', 'kadep', 'sekdep']);
const PRODI_SUB_ROLES = new Set(['kaprodi', 'sekprodi']);
const DEPARTMENT_SUB_ROLES = new Set(['kadep', 'sekdep']);
let revokeSupportingDocPreview: (() => void) | null = null;
let revokeGeneratedLetterPreview: (() => void) | null = null;

type ReviewerStage = 'tendik' | 'prodi' | 'department';

export const renderReviewScholarship = async (appId: number, options?: ReviewerNavigationOptions) => {
    cleanupSupportingDocPreviewUrl();
    cleanupGeneratedLetterPreview();

    const origin = resolveReviewerOrigin(options);
    const activePage = activePageForReviewerOrigin(origin);
    const role = localStorage.getItem('auth_role') || 'tendik';
    const subRole = localStorage.getItem('auth_sub_role') || '';
    const isAcademic = ACADEMIC_ROLES.has(role);
    // Identify academic sub-stage: kaprodi/sekprodi parafs at APPROVED_TENDIK,
    // kadep/sekdep signs at APPROVED_KAPRODI. role can equal the sub_role for
    // legacy logins, so we check both surfaces (same convention used in the
    // sister Akademik review pages).
    const isProdiReviewer = isAcademic && (PRODI_SUB_ROLES.has(role) || PRODI_SUB_ROLES.has(subRole));
    const isDepartmentReviewer = isAcademic && (DEPARTMENT_SUB_ROLES.has(role) || DEPARTMENT_SUB_ROLES.has(subRole));
    const apiPrefix = isAcademic ? 'akademik' : 'tendik';

    renderDashboardLayout(
        'Review Dokumen',
        '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-800"></div></div>',
        role,
        activePage,
    );

    try {
        const response = await apiFetch(`/api/${apiPrefix}/scholarship/${appId}`);

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server mengembalikan format non-JSON.');
        }

        const data = await response.json() as ScholarshipReviewResponse;

        if (!response.ok) {
            throw new Error(data.message || 'Gagal mengambil data pengajuan.');
        }

        const { student, application } = data;
        // Three-stage gating mirroring the sister Akademik review pages:
        // Tendik acts at SUBMITTED, Kaprodi/Sekprodi parafs at APPROVED_TENDIK,
        // Kadep/Sekdep signs the final document at APPROVED_KAPRODI.
        const canTendikAct = !isAcademic && application.status === LETTER_WORKFLOW_STATUS.SUBMITTED;
        const canProdiAct = isProdiReviewer && application.status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK;
        const canDepartmentAct = isDepartmentReviewer && application.status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI;
        const reviewerStage: ReviewerStage | null = canTendikAct
            ? 'tendik'
            : canProdiAct
                ? 'prodi'
                : canDepartmentAct
                    ? 'department'
                    : null;

        const angkatanLabel = student.angkatan ? `Angkatan ${student.angkatan}` : 'Angkatan -';
        const semesterLabel = student.current_semester ? `Semester ${student.current_semester}` : 'Semester -';
        const purpose = application.scholarship_name || valueOrDash(student.target);

        const supportingDocs: SupportingDoc[] = [];
        if (application.transkrip_nilai_path) {
            supportingDocs.push({
                field: 'transkrip_nilai',
                label: 'Transkrip Nilai',
                sublabel: fileNameFromPath(application.transkrip_nilai_path),
            });
        }
        if (application.slip_gaji_ayah_path) {
            supportingDocs.push({
                field: 'slip_gaji_ayah',
                label: 'Slip Gaji / Penghasilan Ayah/Wali',
                sublabel: fileNameFromPath(application.slip_gaji_ayah_path),
            });
        }
        if (application.slip_gaji_ibu_path) {
            supportingDocs.push({
                field: 'slip_gaji_ibu',
                label: 'Slip Gaji / Penghasilan Ibu',
                sublabel: fileNameFromPath(application.slip_gaji_ibu_path),
            });
        }

        const hasAnyAttachment = supportingDocs.length > 0;

        const content = `
            <div class="w-full max-w-5xl mx-auto pb-20 animate-fade-in space-y-6">
                <div class="flex items-center gap-4 mb-2">
                    <button id="back-to-document-list" class="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" aria-label="Kembali ke daftar dokumen">
                        ${iconArrowLeft()}
                    </button>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-800">Review ${LETTER_LABEL}</h1>
                        <p class="text-xs text-gray-500 mt-1">Data pengajuan ditampilkan untuk verifikasi ${isAcademic ? 'Akademik' : 'Tendik'}.</p>
                    </div>
                </div>

                ${renderSection('Data Mahasiswa', `
                    <div class="space-y-6">
                        <div class="flex items-center gap-5">
                            <div class="w-[72px] h-[72px] rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
                                <img id="scholarship-student-photo" src="/avatar-placeholder.png" alt="Foto mahasiswa" class="w-full h-full object-cover">
                            </div>
                            <div>
                                <h2 class="text-lg font-bold text-gray-800">${escapeHtml(valueOrDash(student.name))}</h2>
                                <p class="text-xs font-semibold text-gray-500 mb-2">${escapeHtml(valueOrDash(student.nim))}</p>
                                <div class="flex flex-wrap gap-2">
                                    <span class="bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">${escapeHtml(angkatanLabel)}</span>
                                    <span class="bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">${escapeHtml(semesterLabel)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${renderInfoBox('Program Studi', valueOrDash(student.prodi))}
                            ${renderInfoBox('Departemen', valueOrDash(student.departemen))}
                            ${renderInfoBox('Fakultas', valueOrDash(student.fakultas))}
                            ${renderInfoBox('Email', valueOrDash(student.email))}
                            ${renderInfoBox('IPK', valueOrDash(student.ipk == null ? null : String(student.ipk)))}
                            ${renderInfoBox('Telepon', valueOrDash(student.phone))}
                        </div>
                        <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
                            <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">Keperluan Surat</label>
                            <p class="text-sm font-semibold text-gray-800">${escapeHtml(purpose)}</p>
                        </div>
                        <div class="pt-2 border-t border-gray-100 border-dashed text-xs text-gray-500 font-medium">
                            Tanggal Pengajuan: ${escapeHtml(valueOrDash(student.submitted_at))}
                        </div>
                    </div>
                `)}

                ${renderSection('Status & Nomor Surat', `
                    <div class="space-y-4">
                        <div class="flex flex-wrap items-center gap-3">
                            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</span>
                            <span class="${statusClass(application.status)}">${escapeHtml(statusLabel(application.status))}</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${renderInfoBox('Nomor Surat', valueOrDash(application.nomor_surat))}
                            ${renderInfoBox('Tujuan Beasiswa', purpose)}
                        </div>
                    </div>
                `)}

                ${renderSection('Pratinjau Surat Permohonan Beasiswa', renderGeneratedPreviewViewer())}

                ${renderSection('Dokumen yang Diunggah', hasAnyAttachment
            ? renderSupportingDocsViewer(supportingDocs)
            : `<p class="text-sm font-semibold text-gray-400">Belum ada dokumen yang diunggah.</p>`,
        )}

                ${application.revision_note || application.rejection_reason ? renderSection('Catatan Pengajuan', `
                    <div class="space-y-4">
                        ${application.revision_note ? renderNotice('Catatan Revisi', application.revision_note, 'bg-yellow-50 border-yellow-200 text-yellow-900') : ''}
                        ${application.rejection_reason ? renderNotice('Alasan Penolakan', application.rejection_reason, 'bg-red-50 border-red-200 text-red-700') : ''}
                    </div>
                `) : ''}

                ${renderSection('Tahap Persetujuan', renderTimeline(application, isAcademic))}

                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <p class="text-sm font-bold text-gray-800 mb-2">Tindakan Verifikasi</p>
                    ${reviewerStage ? renderActionPanel(reviewerStage) : `
                        <p class="text-xs text-gray-500 leading-relaxed">
                            ${escapeHtml(readOnlyMessage(application.status, isAcademic, isProdiReviewer, isDepartmentReviewer))}
                        </p>
                    `}
                </div>
            </div>
            ${reviewerStage ? renderActionModals(reviewerStage, valueOrDash(student.name), valueOrDash(student.nim), purpose) : ''}
        `;

        renderDashboardLayout('Review Dokumen', content, role, activePage);

        if (supportingDocs.length > 0) {
            attachSupportingPreviewHandlers(application.id);
        }
        attachGeneratedLetterPreview(appId, apiPrefix);

        if (student.photo && student.photo.startsWith('/api/storage/')) {
            const photoImg = document.getElementById('scholarship-student-photo') as HTMLImageElement | null;
            if (photoImg) {
                apiFetch(student.photo, { headers: { Accept: '*/*' } })
                    .then((res) => res.ok ? res.blob() : Promise.reject())
                    .then((blob) => { photoImg.src = URL.createObjectURL(blob); })
                    .catch(() => { photoImg.src = '/avatar-placeholder.png'; });
            }
        }

        document.getElementById('back-to-document-list')?.addEventListener('click', () => {
            cleanupSupportingDocPreviewUrl();
            cleanupGeneratedLetterPreview();
            void goToReviewerOrigin(origin, role);
        });

        if (reviewerStage) {
            bindActionHandlers(appId, role, origin, reviewerStage, apiPrefix);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data.';
        renderDashboardLayout(
            'Error',
            `<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">${escapeHtml(message)}</div>`,
            role,
            'dokumen',
        );
    }
};

type SupportingDocField = 'transkrip_nilai' | 'slip_gaji_ayah' | 'slip_gaji_ibu';

type SupportingDoc = {
    field: SupportingDocField;
    label: string;
    sublabel: string;
};

const buildSupportingPreviewUrl = (appId: number, field: SupportingDocField): string =>
    `/api/scholarship/${appId}/supporting-documents/${field}/preview`;

const SUPPORTING_CARD_BASE = 'supporting-card text-left p-4 rounded-xl border transition-colors w-full';
const SUPPORTING_CARD_ACTIVE_CLASSES = ['border-[#115E59]', 'bg-[#F0F8F7]', 'ring-2', 'ring-[#115E59]/20'];
const SUPPORTING_CARD_INACTIVE_CLASSES = ['border-gray-200', 'bg-white', 'hover:border-gray-300'];
const SUPPORTING_PREVIEW_DEFAULT_SCALE = 1.25;
const SUPPORTING_PREVIEW_MIN_SCALE = 0.75;
const SUPPORTING_PREVIEW_MAX_SCALE = 2.5;
const SUPPORTING_PREVIEW_SCALE_STEP = 0.25;

function renderSupportingDocsViewer(docs: SupportingDoc[]): string {
    const first = docs[0];
    return `
        <p class="text-xs text-gray-400 mb-4">Pilih dokumen untuk melihat pratinjau di bawah.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            ${docs.map((doc, idx) => renderSupportingCard(doc, idx === 0)).join('')}
        </div>
        <div class="border border-gray-200 rounded-2xl overflow-hidden bg-white">
            <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 bg-[#F8FAFC]/60">
                <div class="min-w-0">
                    <p id="scholarship-preview-title" class="text-sm font-bold text-gray-800 truncate">${escapeHtml(first.label)}</p>
                    <p id="scholarship-preview-subtitle" class="text-[10px] text-gray-500 truncate">${escapeHtml(first.sublabel)}</p>
                </div>
                <div class="shrink-0 flex flex-wrap items-center justify-end gap-2">
                    <button type="button" id="scholarship-preview-prev" disabled class="supporting-pdf-control px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed">Sebelumnya</button>
                    <span id="scholarship-preview-page" class="text-xs font-bold text-gray-600 min-w-[70px] text-center">- / -</span>
                    <button type="button" id="scholarship-preview-next" disabled class="supporting-pdf-control px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed">Berikutnya</button>
                    <span class="hidden sm:block w-px h-5 bg-gray-200"></span>
                    <button type="button" id="scholarship-preview-zoom-out" disabled class="supporting-pdf-control w-8 h-8 rounded-lg border border-gray-200 text-sm font-black text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed" title="Perkecil">-</button>
                    <span id="scholarship-preview-scale" class="text-xs font-bold text-gray-500 min-w-[44px] text-center">125%</span>
                    <button type="button" id="scholarship-preview-zoom-in" disabled class="supporting-pdf-control w-8 h-8 rounded-lg border border-gray-200 text-sm font-black text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed" title="Perbesar">+</button>
                    <button type="button" id="scholarship-preview-reset" disabled class="supporting-pdf-control px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed">Reset</button>
                </div>
            </div>
            <div id="scholarship-preview-canvas-shell" class="relative bg-gray-100 overflow-auto" style="height: clamp(1200px, 100vh, 1700px);">
                <div id="scholarship-preview-loading" class="absolute inset-0 flex items-center justify-center bg-white z-10">
                    <div class="animate-spin rounded-full h-9 w-9 border-b-2 border-[#115E59]"></div>
                </div>
                <div id="scholarship-preview-error" class="hidden absolute inset-0 flex-col items-center justify-center bg-white text-center p-6 z-10">
                    <p class="text-sm font-bold text-red-600 mb-1">Pratinjau dokumen tidak tersedia.</p>
                    <p class="text-xs text-gray-500">Silakan coba lagi atau hubungi administrator.</p>
                </div>
                <div id="scholarship-preview-canvas-wrap" class="min-h-full flex items-start justify-center p-6">
                    <canvas id="scholarship-preview-canvas" class="hidden bg-white shadow-xl"></canvas>
                </div>
            </div>
        </div>
    `;
}

function renderSupportingCard(doc: SupportingDoc, active: boolean): string {
    const stateClasses = active ? SUPPORTING_CARD_ACTIVE_CLASSES.join(' ') : SUPPORTING_CARD_INACTIVE_CLASSES.join(' ');
    return `
        <button type="button" data-supporting-field="${escapeHtml(doc.field)}" data-label="${escapeHtml(doc.label)}" data-sublabel="${escapeHtml(doc.sublabel)}" class="${SUPPORTING_CARD_BASE} ${stateClasses}">
            <div class="flex items-start gap-3">
                <span class="w-9 h-9 rounded-lg bg-gray-100 text-[#115E59] flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                </span>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold text-gray-800 leading-tight">${escapeHtml(doc.label)}</p>
                    <p class="text-[10px] text-gray-500 mt-1 truncate">${escapeHtml(doc.sublabel)}</p>
                </div>
            </div>
        </button>
    `;
}

function attachSupportingPreviewHandlers(appId: number): void {
    cleanupSupportingDocPreviewUrl();

    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('.supporting-card'));
    const canvas = document.getElementById('scholarship-preview-canvas') as HTMLCanvasElement | null;
    const loading = document.getElementById('scholarship-preview-loading');
    const errorEl = document.getElementById('scholarship-preview-error');
    const titleEl = document.getElementById('scholarship-preview-title');
    const subtitleEl = document.getElementById('scholarship-preview-subtitle');
    const prevBtn = document.getElementById('scholarship-preview-prev') as HTMLButtonElement | null;
    const nextBtn = document.getElementById('scholarship-preview-next') as HTMLButtonElement | null;
    const zoomOutBtn = document.getElementById('scholarship-preview-zoom-out') as HTMLButtonElement | null;
    const zoomInBtn = document.getElementById('scholarship-preview-zoom-in') as HTMLButtonElement | null;
    const resetBtn = document.getElementById('scholarship-preview-reset') as HTMLButtonElement | null;
    const pageEl = document.getElementById('scholarship-preview-page');
    const scaleEl = document.getElementById('scholarship-preview-scale');
    if (!canvas || !loading || !errorEl || cards.length === 0) return;

    let activePdf: pdfjsLib.PDFDocumentProxy | null = null;
    let activeRenderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let activeRequestId = 0;
    let renderSequence = 0;
    let currentPage = 1;
    let totalPages = 0;
    let currentScale = SUPPORTING_PREVIEW_DEFAULT_SCALE;

    const controlButtons = [prevBtn, nextBtn, zoomOutBtn, zoomInBtn, resetBtn].filter(Boolean) as HTMLButtonElement[];

    const cancelActiveRender = () => {
        if (!activeRenderTask) return;
        try {
            activeRenderTask.cancel();
        } catch {
            // Ignore cancellation errors from PDF.js.
        }
        activeRenderTask = null;
    };

    const cleanupActivePdf = () => {
        renderSequence += 1;
        cancelActiveRender();
        const pdfToDestroy = activePdf;
        activePdf = null;
        totalPages = 0;
        currentPage = 1;
        currentScale = SUPPORTING_PREVIEW_DEFAULT_SCALE;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.width = 0;
        canvas.height = 0;
        canvas.removeAttribute('style');
        canvas.classList.add('hidden');
        if (pdfToDestroy) {
            void pdfToDestroy.destroy().catch(() => undefined);
        }
    };

    const updateControls = (loaded: boolean) => {
        controlButtons.forEach((button) => {
            button.disabled = !loaded;
        });
        if (loaded) {
            if (prevBtn) prevBtn.disabled = currentPage <= 1;
            if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
            if (zoomOutBtn) zoomOutBtn.disabled = currentScale <= SUPPORTING_PREVIEW_MIN_SCALE;
            if (zoomInBtn) zoomInBtn.disabled = currentScale >= SUPPORTING_PREVIEW_MAX_SCALE;
            if (resetBtn) resetBtn.disabled = currentScale === SUPPORTING_PREVIEW_DEFAULT_SCALE;
        }
        if (pageEl) pageEl.textContent = loaded ? `${currentPage} / ${totalPages}` : '- / -';
        if (scaleEl) scaleEl.textContent = `${Math.round(currentScale * 100)}%`;
    };

    const showLoading = () => {
        loading.classList.remove('hidden');
        errorEl.classList.add('hidden');
        errorEl.classList.remove('flex');
        canvas.classList.add('hidden');
        updateControls(false);
    };

    const showError = () => {
        loading.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorEl.classList.add('flex');
        canvas.classList.add('hidden');
        updateControls(false);
    };

    const showCanvas = () => {
        loading.classList.add('hidden');
        errorEl.classList.add('hidden');
        errorEl.classList.remove('flex');
        canvas.classList.remove('hidden');
        updateControls(true);
    };

    const setActiveCard = (card: HTMLButtonElement) => {
        cards.forEach((c) => {
            c.classList.remove(...SUPPORTING_CARD_ACTIVE_CLASSES, ...SUPPORTING_CARD_INACTIVE_CLASSES);
            if (c === card) {
                c.classList.add(...SUPPORTING_CARD_ACTIVE_CLASSES);
            } else {
                c.classList.add(...SUPPORTING_CARD_INACTIVE_CLASSES);
            }
        });
    };

    const renderCurrentPage = async (requestId: number) => {
        if (!activePdf || requestId !== activeRequestId) return;
        const sequence = ++renderSequence;
        cancelActiveRender();

        try {
            const page = await activePdf.getPage(currentPage);
            if (!activePdf || requestId !== activeRequestId || sequence !== renderSequence) return;

            const context = canvas.getContext('2d');
            if (!context) {
                showError();
                return;
            }

            const viewport = page.getViewport({ scale: currentScale });
            const pixelRatio = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * pixelRatio);
            canvas.height = Math.floor(viewport.height * pixelRatio);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);

            const renderTask = page.render({
                canvasContext: context,
                viewport,
                transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined,
            } as any);
            activeRenderTask = renderTask as { cancel: () => void; promise: Promise<unknown> };
            await activeRenderTask.promise;
            if (requestId !== activeRequestId || sequence !== renderSequence) return;
            activeRenderTask = null;
            showCanvas();
        } catch (error: any) {
            if (requestId !== activeRequestId || sequence !== renderSequence) return;
            activeRenderTask = null;
            if (error?.name === 'RenderingCancelledException') return;
            showError();
        }
    };

    const loadDoc = async (card: HTMLButtonElement) => {
        const field = (card.dataset.supportingField || '') as SupportingDocField | '';
        const label = card.dataset.label || '';
        const sublabel = card.dataset.sublabel || '';

        setActiveCard(card);
        if (titleEl) titleEl.textContent = label;
        if (subtitleEl) subtitleEl.textContent = sublabel;

        if (!field) {
            showError();
            return;
        }

        const previewUrl = buildSupportingPreviewUrl(appId, field);
        const requestId = ++activeRequestId;
        showLoading();
        cleanupActivePdf();
        try {
            const res = await apiFetch(previewUrl, { cache: 'no-store', headers: { Accept: 'application/octet-stream,*/*' } });
            if (requestId !== activeRequestId) return;
            if (!res.ok) {
                showError();
                return;
            }
            const arrayBuffer = await res.arrayBuffer();
            if (requestId !== activeRequestId) return;
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            if (requestId !== activeRequestId) {
                void pdf.destroy().catch(() => undefined);
                return;
            }
            activePdf = pdf;
            totalPages = pdf.numPages;
            currentPage = 1;
            currentScale = SUPPORTING_PREVIEW_DEFAULT_SCALE;
            updateControls(true);
            await renderCurrentPage(requestId);
        } catch {
            if (requestId !== activeRequestId) return;
            cleanupActivePdf();
            showError();
        }
    };

    cards.forEach((card) => {
        card.addEventListener('click', (event) => {
            event.preventDefault();
            void loadDoc(card);
        });
    });

    prevBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf || currentPage <= 1) return;
        currentPage -= 1;
        updateControls(true);
        void renderCurrentPage(activeRequestId);
    });

    nextBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf || currentPage >= totalPages) return;
        currentPage += 1;
        updateControls(true);
        void renderCurrentPage(activeRequestId);
    });

    zoomOutBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf || currentScale <= SUPPORTING_PREVIEW_MIN_SCALE) return;
        currentScale = Math.max(SUPPORTING_PREVIEW_MIN_SCALE, currentScale - SUPPORTING_PREVIEW_SCALE_STEP);
        updateControls(true);
        void renderCurrentPage(activeRequestId);
    });

    zoomInBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf || currentScale >= SUPPORTING_PREVIEW_MAX_SCALE) return;
        currentScale = Math.min(SUPPORTING_PREVIEW_MAX_SCALE, currentScale + SUPPORTING_PREVIEW_SCALE_STEP);
        updateControls(true);
        void renderCurrentPage(activeRequestId);
    });

    resetBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf) return;
        currentScale = SUPPORTING_PREVIEW_DEFAULT_SCALE;
        updateControls(true);
        void renderCurrentPage(activeRequestId);
    });

    revokeSupportingDocPreview = () => {
        activeRequestId += 1;
        cleanupActivePdf();
        updateControls(false);
    };

    void loadDoc(cards[0]);
}

function cleanupSupportingDocPreviewUrl(): void {
    if (!revokeSupportingDocPreview) return;
    revokeSupportingDocPreview();
    revokeSupportingDocPreview = null;
}

function renderGeneratedPreviewViewer(): string {
    return renderProtectedPdfViewer('beasiswa-generated-letter-preview', {
        title: 'Pratinjau Surat Permohonan Beasiswa',
        subtitle: 'Pratinjau PDF sesuai tahap pengajuan saat ini',
        loading: 'Memuat pratinjau surat...',
    });
}

function attachGeneratedLetterPreview(appId: number, apiPrefix: string): void {
    cleanupGeneratedLetterPreview();
    revokeGeneratedLetterPreview = attachProtectedPdfViewer({
        rootId: 'beasiswa-generated-letter-preview',
        endpointUrl: `/api/${apiPrefix}/surat-permohonan-beasiswa/${appId}/generated-preview`,
    });
}

function cleanupGeneratedLetterPreview(): void {
    if (!revokeGeneratedLetterPreview) return;
    revokeGeneratedLetterPreview();
    revokeGeneratedLetterPreview = null;
}

function renderActionPanel(reviewerStage: ReviewerStage): string {
    const approveLabel = approveButtonLabel(reviewerStage);
    const helperText = panelHelperText(reviewerStage);
    const isTendik = reviewerStage === 'tendik';

    return `
        <div class="space-y-4">
            ${isTendik ? `
                <button id="scholarship-revise-btn" type="button" class="w-full py-3.5 bg-[#FACC15] hover:bg-[#EAB308] text-yellow-900 font-bold rounded-xl transition-colors border border-[#EAB308]/50 shadow-sm active:scale-[0.98]">
                    Minta Perbaikan Dokumen (Revisi)
                </button>
            ` : ''}
            <button id="scholarship-reject-btn" type="button" class="w-full py-3.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold rounded-xl transition-colors shadow-sm active:scale-[0.98]">
                Tolak Pengajuan Surat
            </button>
            <button id="scholarship-approve-btn" type="button" class="w-full py-3.5 bg-[#115E59] hover:bg-[#0d4a46] text-white font-bold rounded-xl transition-colors shadow-sm active:scale-[0.98]">
                ${escapeHtml(approveLabel)}
            </button>
            <div class="mt-4 bg-[#FEF9C3]/50 border border-[#FEF08A] rounded-xl p-4 text-xs font-medium text-amber-900 shadow-inner">
                <p><span class="font-bold">Catatan:</span> ${escapeHtml(helperText)}</p>
            </div>
        </div>
    `;
}

function approveButtonLabel(stage: ReviewerStage): string {
    if (stage === 'department') return 'Tandatangani dan Selesaikan di Akademik';
    if (stage === 'prodi') return 'Paraf dan Teruskan ke Kadep/Sekdep';
    return 'Setujui dan Teruskan ke Pimpinan';
}

function panelHelperText(stage: ReviewerStage): string {
    if (stage === 'department') {
        return 'Tindakan ini akan membuat dokumen final dan meneruskan pengajuan ke tahap review mahasiswa.';
    }
    if (stage === 'prodi') {
        return 'Tindakan ini memparaf pengajuan dan meneruskannya ke Kadep/Sekdep untuk tanda tangan akhir.';
    }
    return 'Pastikan seluruh dokumen telah sesuai dengan persyaratan sebelum melanjutkan. Nomor surat wajib diisi manual saat menyetujui pengajuan.';
}

function readOnlyMessage(
    status: string | null | undefined,
    isAcademic: boolean,
    isProdiReviewer: boolean,
    isDepartmentReviewer: boolean,
): string {
    const statusText = statusLabel(status);
    if (isDepartmentReviewer) {
        return `Pengajuan berada pada status ${statusText}, sehingga tindakan Kadep/Sekdep tidak tersedia.`;
    }
    if (isProdiReviewer) {
        return `Pengajuan berada pada status ${statusText}, sehingga tindakan Kaprodi/Sekprodi tidak tersedia.`;
    }
    if (isAcademic) {
        return `Pengajuan berada pada status ${statusText}, sehingga tindakan Akademik tidak tersedia.`;
    }
    return `Pengajuan berada pada status ${statusText}, sehingga tindakan Tendik tidak tersedia.`;
}

function renderActionModals(reviewerStage: ReviewerStage, studentName: string, nim: string, purpose: string): string {
    const isTendik = reviewerStage === 'tendik';
    return `
        ${renderApprovalModal(reviewerStage, studentName, nim, purpose)}
        ${renderTextActionModal({
        id: 'scholarship-rejection-modal',
        title: 'Tolak Pengajuan Surat',
        headerClass: 'bg-[#EF4444] text-white',
        label: 'Alasan Penolakan',
        placeholder: 'Contoh: Berkas yang diajukan tidak memenuhi syarat dan tidak dapat diproses lebih lanjut.',
        helper: 'Berikan penjelasan yang jelas mengapa pengajuan ditolak secara permanen.',
        confirmId: 'scholarship-confirm-reject',
        cancelId: 'scholarship-cancel-reject',
        textareaId: 'scholarship-rejection-reason',
        confirmText: 'Ya, Tolak Permanen',
        confirmClass: 'bg-[#EF4444] hover:bg-[#DC2626] text-white',
        studentName,
        nim,
        warning: true,
    })}
        ${isTendik ? renderTextActionModal({
        id: 'scholarship-revision-modal',
        title: 'Permintaan Perbaikan Dokumen',
        headerClass: 'bg-[#FACC15] text-gray-900',
        label: 'Catatan Revisi untuk Mahasiswa',
        placeholder: 'Contoh: Mohon unggah ulang transkrip nilai terbaru sebelum diproses.',
        helper: 'Tuliskan instruksi revisi secara jelas agar mahasiswa mengetahui bagian yang perlu diperbaiki.',
        confirmId: 'scholarship-confirm-revise',
        cancelId: 'scholarship-cancel-revise',
        textareaId: 'scholarship-revision-note',
        confirmText: 'Kirim Permintaan Revisi',
        confirmClass: 'bg-[#FACC15] hover:bg-[#EAB308] text-yellow-900 border border-[#0D4A46]',
        studentName,
        nim,
        warning: false,
    }) : ''}
    `;
}

function renderApprovalModal(reviewerStage: ReviewerStage, studentName: string, nim: string, purpose: string): string {
    const isTendik = reviewerStage === 'tendik';
    const isDepartment = reviewerStage === 'department';
    const title = isDepartment
        ? 'Konfirmasi Tanda Tangan'
        : reviewerStage === 'prodi'
            ? 'Konfirmasi Paraf'
            : 'Konfirmasi Persetujuan';
    const banner = isDepartment
        ? { title: 'Pengajuan siap ditandatangani', body: 'Anda akan memberi tanda tangan akhir, membuat dokumen final, dan meneruskan pengajuan ke tahap review mahasiswa.' }
        : reviewerStage === 'prodi'
            ? { title: 'Pengajuan siap diparaf', body: 'Anda akan memparaf pengajuan ini dan meneruskannya ke Kadep/Sekdep untuk tanda tangan akhir.' }
            : { title: 'Dokumen telah diverifikasi', body: 'Anda akan meneruskan pengajuan surat ini ke Kaprodi/Sekprodi. Pastikan semua data sudah benar dan lengkap.' };
    const confirmLabel = isDepartment
        ? 'Ya, Tandatangani'
        : reviewerStage === 'prodi'
            ? 'Ya, Paraf Pengajuan'
            : 'Ya, Teruskan ke Kaprodi';

    return `
        <div id="scholarship-approval-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="scholarship-approval-title">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div class="bg-[#115E59] px-8 py-5 text-white">
                    <h3 id="scholarship-approval-title" class="text-lg font-bold">${escapeHtml(title)}</h3>
                </div>
                <div class="p-8 space-y-6">
                    <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-900">
                        <p class="font-bold text-sm">${escapeHtml(banner.title)}</p>
                        <p class="text-xs leading-relaxed mt-1">${escapeHtml(banner.body)}</p>
                    </div>
                    <div class="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                        ${renderModalRow('Mahasiswa', studentName)}
                        ${renderModalRow('NIM', nim)}
                        ${renderModalRow('Jenis Surat', LETTER_LABEL)}
                        ${renderModalRow('Tujuan', purpose)}
                    </div>
                    ${isTendik ? `
                        <div class="space-y-2">
                            <label for="scholarship-nomor-surat" class="text-[11px] font-black text-gray-500 uppercase tracking-widest pl-1">Tambahkan Nomor Surat</label>
                            <input
                                id="scholarship-nomor-surat"
                                type="text"
                                placeholder="Isi Nomor Surat"
                                class="w-full px-5 py-3.5 bg-white border-2 border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-sm text-sm font-medium"
                            >
                            <p class="text-[10px] text-gray-400 pl-1 italic">Nomor surat diinput manual oleh Tendik dan akan digunakan pada dokumen final.</p>
                        </div>
                    ` : ''}
                </div>
                <div class="px-8 pb-8 flex gap-3">
                    <button id="scholarship-cancel-approve" type="button" class="flex-1 px-6 py-3.5 border-2 border-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-colors text-sm shadow-sm">
                        Batal
                    </button>
                    <button id="scholarship-confirm-approve" type="button" class="flex-[1.5] px-6 py-3.5 bg-[#115E59] text-white font-bold rounded-2xl hover:bg-[#0d4a46] transition-all shadow-lg active:scale-[0.98] text-sm">
                        ${escapeHtml(confirmLabel)}
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
    warning: boolean;
};

function renderTextActionModal(config: TextActionModalConfig): string {
    return `
        <div id="${config.id}" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="${config.id}-title">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
                <div class="${config.headerClass} px-8 py-5">
                    <h3 id="${config.id}-title" class="text-lg font-bold">${escapeHtml(config.title)}</h3>
                </div>
                <div class="p-8 space-y-6">
                    ${config.warning ? `
                        <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-900 text-xs leading-relaxed">
                            <p class="font-bold text-sm mb-1">PERHATIAN - Tindakan Permanen:</p>
                            <p>Pengajuan akan ditolak permanen dan mahasiswa harus mengajukan ulang dari awal dengan data yang benar.</p>
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

function renderModalRow(label: string, value: string): string {
    return `
        <div class="flex justify-between gap-4 text-[11px]">
            <span class="text-gray-400 font-bold uppercase tracking-wider">${escapeHtml(label)}</span>
            <span class="text-gray-700 font-bold text-right">${escapeHtml(value)}</span>
        </div>
    `;
}

function bindActionHandlers(applicationId: number, role: string, origin: ReviewerOrigin, reviewerStage: ReviewerStage, apiPrefix: string): void {
    const isTendik = reviewerStage === 'tendik';
    const isAcademic = !isTendik;
    const approveSuccessFallback = reviewerStage === 'department'
        ? 'Pengajuan berhasil ditandatangani dan menunggu review mahasiswa.'
        : reviewerStage === 'prodi'
            ? 'Pengajuan berhasil diparaf dan diteruskan ke Kadep/Sekdep.'
            : 'Pengajuan berhasil diverifikasi dan diteruskan.';

    bindModalOpenClose('scholarship-approve-btn', 'scholarship-approval-modal', 'scholarship-cancel-approve');
    bindModalOpenClose('scholarship-reject-btn', 'scholarship-rejection-modal', 'scholarship-cancel-reject');
    if (isTendik) {
        bindModalOpenClose('scholarship-revise-btn', 'scholarship-revision-modal', 'scholarship-cancel-revise');
    }

    document.getElementById('scholarship-confirm-approve')?.addEventListener('click', async () => {
        const payload: Record<string, string> = {};
        if (isTendik) {
            const nomorSurat = readFieldValue('scholarship-nomor-surat');
            if (!nomorSurat) {
                showWarning('Nomor surat wajib diisi manual oleh Tendik.');
                return;
            }
            payload.nomor_surat = nomorSurat;
        }

        await submitScholarshipAction({
            applicationId,
            role,
            origin,
            isAcademic,
            apiPrefix,
            endpoint: 'approve',
            payload,
            buttonId: 'scholarship-confirm-approve',
            successFallback: approveSuccessFallback,
        });
    });

    document.getElementById('scholarship-confirm-reject')?.addEventListener('click', async () => {
        const reason = readFieldValue('scholarship-rejection-reason');
        if (!reason) {
            showWarning('Alasan penolakan wajib diisi.');
            return;
        }

        await submitScholarshipAction({
            applicationId,
            role,
            origin,
            isAcademic,
            apiPrefix,
            endpoint: 'reject',
            payload: { reason },
            buttonId: 'scholarship-confirm-reject',
            successFallback: 'Pengajuan berhasil ditolak.',
        });
    });

    if (isTendik) {
        document.getElementById('scholarship-confirm-revise')?.addEventListener('click', async () => {
            const note = readFieldValue('scholarship-revision-note');
            if (!note) {
                showWarning('Catatan revisi wajib diisi.');
                return;
            }

            await submitScholarshipAction({
                applicationId,
                role,
                origin,
                isAcademic,
                apiPrefix,
                endpoint: 'revise',
                payload: { note },
                buttonId: 'scholarship-confirm-revise',
                successFallback: 'Permintaan revisi berhasil dikirim.',
            });
        });
    }

    document.addEventListener('keydown', function closeScholarshipModalsWithEsc(event) {
        if (event.key === 'Escape') {
            closeAllScholarshipModals();
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
    isAcademic: boolean;
    apiPrefix: string;
    endpoint: 'approve' | 'revise' | 'reject';
    payload: Record<string, string>;
    buttonId: string;
    successFallback: string;
};

async function submitScholarshipAction(options: SubmitActionOptions): Promise<void> {
    const button = document.getElementById(options.buttonId) as HTMLButtonElement | null;
    const originalText = button?.innerHTML || '';

    if (button) {
        button.disabled = true;
        button.innerHTML = 'Memproses...';
    }

    try {
        const response = await apiFetch(`/api/${options.apiPrefix}/scholarship/${options.applicationId}/${options.endpoint}`, {
            method: 'PATCH',
            body: Object.keys(options.payload).length > 0 ? JSON.stringify(options.payload) : undefined,
        });
        const result = await response.json() as { message?: string; errors?: Record<string, string[]> };

        if (!response.ok) {
            throw new Error(errorMessageFromResponse(result));
        }

        showSuccess(result.message || options.successFallback);
        closeAllScholarshipModals();
        cleanupSupportingDocPreviewUrl();
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

function readFieldValue(id: string): string {
    const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    return field?.value.trim() || '';
}

function closeAllScholarshipModals(): void {
    ['scholarship-approval-modal', 'scholarship-revision-modal', 'scholarship-rejection-modal'].forEach((id) => {
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

function renderInfoBox(label: string, value: string): string {
    return `
        <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
            <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">${escapeHtml(label)}</label>
            <p class="text-sm font-semibold text-gray-800">${escapeHtml(value)}</p>
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

function renderTimeline(app: ScholarshipApplication, isAcademic: boolean): string {
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
        {
            label: 'Pengajuan Diterima',
            date: app.submitted_at || app.created_at,
            done: true,
        },
        {
            label: 'Verifikasi Tenaga Pendidik',
            date: app.tendik_approved_at,
            done: tendikDoneStatuses.includes(app.status || ''),
            current: app.status === LETTER_WORKFLOW_STATUS.SUBMITTED && !isAcademic,
        },
        {
            label: 'Paraf Kaprodi/Sekprodi',
            date: app.kaprodi_approved_at,
            done: kaprodiDoneStatuses.includes(app.status || ''),
            current: app.status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK,
        },
        {
            label: 'Tanda Tangan Kadep/Sekdep',
            date: app.kadep_approved_at,
            done: departmentDoneStatuses.includes(app.status || ''),
            current: app.status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI,
        },
        {
            label: 'Review Mahasiswa',
            date: null,
            done: app.status === LETTER_WORKFLOW_STATUS.COMPLETED,
            current: app.status === LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW,
        },
    ];

    return `
        <div class="relative pl-6 border-l-2 border-[#115E59] space-y-6 pb-2">
            ${steps.map((step) => `
                <div class="relative">
                    <div class="absolute -left-[31px] ${timelineDotClass(step.done, step.current)}">
                        ${step.done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    <p class="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">${escapeHtml(formatDate(step.date))}</p>
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
    return 'bg-white border-2 border-gray-300 w-5 h-5 rounded-full z-10 flex items-center justify-center';
}

function statusLabel(status?: string | null): string {
    return getLetterStatusLabel(status, 'tendik-review') || valueOrDash(status);
}

function statusClass(status?: string | null): string {
    const base = 'inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold border';
    return `${base} ${getLetterStatusTone(status, 'tendik-review')}`;
}

function valueOrDash(value?: string | null): string {
    const trimmed = String(value ?? '').trim();
    return trimmed || '-';
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

function fileNameFromPath(path?: string | null): string {
    if (!path) {
        return '-';
    }
    const cleanPath = path.split('?')[0] || path;
    return cleanPath.split('/').pop() || cleanPath;
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
