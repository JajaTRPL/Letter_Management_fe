import { apiFetch } from './api-client';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite resolves the PDF.js worker as a URL.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfRenderTask = {
    cancel: () => void;
    promise: Promise<unknown>;
};

type ProtectedPdfViewerCopy = {
    title: string;
    subtitle: string;
    loading: string;
};

type AttachProtectedPdfViewerOptions = {
    rootId: string;
    endpointUrl: string;
    defaultScale?: number;
    minScale?: number;
    maxScale?: number;
    scaleStep?: number;
};

const DEFAULT_SCALE = 1.2;
const MIN_SCALE = 0.7;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.2;

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export function renderProtectedPdfViewer(rootId: string, copy: ProtectedPdfViewerCopy): string {
    return `
        <div id="${escapeHtml(rootId)}" class="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden" data-protected-pdf-viewer>
            <div class="px-6 py-4 bg-teal-50/70 border-b border-teal-100 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="text-primary-teal shrink-0">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-gray-800 truncate">${escapeHtml(copy.title)}</p>
                        <p class="text-[11px] text-gray-500 truncate">${escapeHtml(copy.subtitle)}</p>
                    </div>
                </div>
                <div class="shrink-0 flex flex-wrap items-center justify-end gap-2">
                    <button type="button" data-pdf-prev disabled class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed">Sebelumnya</button>
                    <span data-pdf-page class="text-xs font-bold text-gray-600 min-w-[70px] text-center">- / -</span>
                    <button type="button" data-pdf-next disabled class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed">Berikutnya</button>
                    <span class="hidden sm:block w-px h-5 bg-gray-200"></span>
                    <button type="button" data-pdf-zoom-out disabled class="w-8 h-8 rounded-lg border border-gray-200 text-sm font-black text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed" title="Perkecil">-</button>
                    <span data-pdf-scale class="text-xs font-bold text-gray-500 min-w-[44px] text-center">120%</span>
                    <button type="button" data-pdf-zoom-in disabled class="w-8 h-8 rounded-lg border border-gray-200 text-sm font-black text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed" title="Perbesar">+</button>
                    <button type="button" data-pdf-reset disabled class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:border-[#115E59]/30 hover:text-[#115E59] disabled:opacity-40 disabled:cursor-not-allowed">Reset</button>
                </div>
            </div>
            <div class="relative bg-gray-100 overflow-auto" style="height: clamp(1200px, 100vh, 1700px);">
                <div data-pdf-loading class="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 text-center p-6">
                    <div class="animate-spin rounded-full h-9 w-9 border-b-2 border-[#115E59]"></div>
                    <p class="mt-4 text-sm font-bold text-gray-700">${escapeHtml(copy.loading)}</p>
                </div>
                <div data-pdf-error class="hidden absolute inset-0 flex-col items-center justify-center bg-white text-center p-6 z-10">
                    <div class="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <p data-pdf-error-title class="text-sm font-bold text-gray-800 mb-1">Pratinjau surat belum tersedia.</p>
                    <p data-pdf-error-body class="text-xs text-gray-500 max-w-md leading-relaxed">Silakan coba lagi beberapa saat.</p>
                </div>
                <div class="min-h-full flex items-start justify-center p-6">
                    <canvas data-pdf-canvas class="hidden bg-white shadow-xl"></canvas>
                </div>
            </div>
        </div>
    `;
}

export function attachProtectedPdfViewer(options: AttachProtectedPdfViewerOptions): () => void {
    const root = document.getElementById(options.rootId);
    if (!root) return () => undefined;

    const canvas = root.querySelector<HTMLCanvasElement>('[data-pdf-canvas]');
    const loading = root.querySelector<HTMLElement>('[data-pdf-loading]');
    const errorEl = root.querySelector<HTMLElement>('[data-pdf-error]');
    const errorTitle = root.querySelector<HTMLElement>('[data-pdf-error-title]');
    const errorBody = root.querySelector<HTMLElement>('[data-pdf-error-body]');
    const prevBtn = root.querySelector<HTMLButtonElement>('[data-pdf-prev]');
    const nextBtn = root.querySelector<HTMLButtonElement>('[data-pdf-next]');
    const zoomOutBtn = root.querySelector<HTMLButtonElement>('[data-pdf-zoom-out]');
    const zoomInBtn = root.querySelector<HTMLButtonElement>('[data-pdf-zoom-in]');
    const resetBtn = root.querySelector<HTMLButtonElement>('[data-pdf-reset]');
    const pageEl = root.querySelector<HTMLElement>('[data-pdf-page]');
    const scaleEl = root.querySelector<HTMLElement>('[data-pdf-scale]');

    if (!canvas || !loading || !errorEl) return () => undefined;

    const defaultScale = options.defaultScale ?? DEFAULT_SCALE;
    const minScale = options.minScale ?? MIN_SCALE;
    const maxScale = options.maxScale ?? MAX_SCALE;
    const scaleStep = options.scaleStep ?? SCALE_STEP;
    const buttons = [prevBtn, nextBtn, zoomOutBtn, zoomInBtn, resetBtn].filter(Boolean) as HTMLButtonElement[];

    let activePdf: pdfjsLib.PDFDocumentProxy | null = null;
    let activeRenderTask: PdfRenderTask | null = null;
    let requestId = 0;
    let renderId = 0;
    let page = 1;
    let pages = 0;
    let scale = defaultScale;

    const cancelRender = () => {
        if (!activeRenderTask) return;
        try {
            activeRenderTask.cancel();
        } catch {
            // PDF.js may already have completed the render task.
        }
        activeRenderTask = null;
    };

    const clearCanvas = () => {
        const context = canvas.getContext('2d');
        if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.width = 0;
        canvas.height = 0;
        canvas.removeAttribute('style');
        canvas.classList.add('hidden');
    };

    const destroyPdf = () => {
        renderId += 1;
        cancelRender();
        const pdf = activePdf;
        activePdf = null;
        pages = 0;
        page = 1;
        scale = defaultScale;
        clearCanvas();
        if (pdf) {
            void pdf.destroy().catch(() => undefined);
        }
    };

    const setControls = (loaded: boolean) => {
        buttons.forEach((button) => {
            button.disabled = !loaded;
        });
        if (loaded) {
            if (prevBtn) prevBtn.disabled = page <= 1;
            if (nextBtn) nextBtn.disabled = page >= pages;
            if (zoomOutBtn) zoomOutBtn.disabled = scale <= minScale;
            if (zoomInBtn) zoomInBtn.disabled = scale >= maxScale;
            if (resetBtn) resetBtn.disabled = scale === defaultScale;
        }
        if (pageEl) pageEl.textContent = loaded ? `${page} / ${pages}` : '- / -';
        if (scaleEl) scaleEl.textContent = `${Math.round(scale * 100)}%`;
    };

    const showLoading = () => {
        loading.classList.remove('hidden');
        errorEl.classList.add('hidden');
        errorEl.classList.remove('flex');
        canvas.classList.add('hidden');
        setControls(false);
    };

    const showError = (message: string, detail: string) => {
        loading.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorEl.classList.add('flex');
        canvas.classList.add('hidden');
        if (errorTitle) errorTitle.textContent = message;
        if (errorBody) errorBody.textContent = detail;
        setControls(false);
    };

    const showCanvas = () => {
        loading.classList.add('hidden');
        errorEl.classList.add('hidden');
        errorEl.classList.remove('flex');
        canvas.classList.remove('hidden');
        setControls(true);
    };

    const renderPage = async (currentRequestId: number) => {
        if (!activePdf || currentRequestId !== requestId) return;
        const currentRenderId = ++renderId;
        cancelRender();

        try {
            const pdfPage = await activePdf.getPage(page);
            if (!activePdf || currentRequestId !== requestId || currentRenderId !== renderId) return;

            const context = canvas.getContext('2d');
            if (!context) {
                showError('Pratinjau surat belum tersedia.', 'Kanvas pratinjau tidak dapat dimuat.');
                return;
            }

            const viewport = pdfPage.getViewport({ scale });
            const pixelRatio = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * pixelRatio);
            canvas.height = Math.floor(viewport.height * pixelRatio);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);

            const task = pdfPage.render({
                canvasContext: context,
                viewport,
                transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined,
            } as any);

            activeRenderTask = task as PdfRenderTask;
            await activeRenderTask.promise;
            if (currentRequestId !== requestId || currentRenderId !== renderId) return;
            activeRenderTask = null;
            showCanvas();
        } catch (error: any) {
            if (currentRequestId !== requestId || currentRenderId !== renderId) return;
            activeRenderTask = null;
            if (error?.name === 'RenderingCancelledException') return;
            showError('Pratinjau surat belum tersedia.', 'Dokumen tidak dapat dirender saat ini.');
        }
    };

    const loadPdf = async () => {
        const currentRequestId = ++requestId;
        showLoading();
        destroyPdf();

        try {
            const response = await apiFetch(options.endpointUrl, {
                cache: 'no-store',
                headers: {
                    Accept: 'application/pdf',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-DTEDI-PDFJS-Preview': '1',
                },
            });
            if (currentRequestId !== requestId) return;

            if (!response.ok) {
                const [title, detail] = await errorCopyFromResponse(response);
                showError(title, detail);
                return;
            }

            const arrayBuffer = await response.arrayBuffer();
            if (currentRequestId !== requestId) return;

            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            if (currentRequestId !== requestId) {
                void pdf.destroy().catch(() => undefined);
                return;
            }

            activePdf = pdf;
            pages = pdf.numPages;
            page = 1;
            scale = defaultScale;
            setControls(true);
            await renderPage(currentRequestId);
        } catch {
            if (currentRequestId !== requestId) return;
            destroyPdf();
            showError('Pratinjau surat belum tersedia.', 'Koneksi ke layanan pratinjau tidak dapat diproses.');
        }
    };

    prevBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf || page <= 1) return;
        page -= 1;
        setControls(true);
        void renderPage(requestId);
    });

    nextBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf || page >= pages) return;
        page += 1;
        setControls(true);
        void renderPage(requestId);
    });

    zoomOutBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf || scale <= minScale) return;
        scale = Math.max(minScale, scale - scaleStep);
        setControls(true);
        void renderPage(requestId);
    });

    zoomInBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf || scale >= maxScale) return;
        scale = Math.min(maxScale, scale + scaleStep);
        setControls(true);
        void renderPage(requestId);
    });

    resetBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (!activePdf) return;
        scale = defaultScale;
        setControls(true);
        void renderPage(requestId);
    });

    void loadPdf();

    return () => {
        requestId += 1;
        destroyPdf();
        setControls(false);
    };
}

async function errorCopyFromResponse(response: Response): Promise<[string, string]> {
    let reason = '';
    let message = '';

    try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const body = await response.json() as { message?: unknown; reason?: unknown };
            reason = typeof body.reason === 'string' ? body.reason : '';
            message = typeof body.message === 'string' ? body.message : '';
        }
    } catch {
        // Keep generic copy.
    }

    if (response.status === 403) {
        return ['Pratinjau surat tidak dapat diakses.', 'Anda tidak berwenang melihat pratinjau surat ini.'];
    }

    if (response.status === 409 || reason === 'artifact_generating') {
        return ['Pratinjau surat sedang disiapkan.', 'Silakan coba lagi beberapa saat.'];
    }

    if (response.status === 503 || reason === 'artifact_failed') {
        return ['Pratinjau surat gagal dibuat.', 'Silakan coba lagi atau hubungi administrator.'];
    }

    if (response.status === 404 || reason === 'artifact_unavailable') {
        return ['Pratinjau surat belum tersedia.', message || 'Dokumen pratinjau belum tersedia untuk tahap ini.'];
    }

    return ['Pratinjau surat belum tersedia.', message || 'Dokumen pratinjau belum dapat dimuat saat ini.'];
}
