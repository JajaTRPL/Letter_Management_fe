import { renderDashboardLayout } from '../../dashboard/DashboardLayout';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// FIX: see protected-pdf-viewer.ts for rationale (MIME type workaround).
const workerReady: Promise<void> = (async () => {
    try {
        const response = await fetch(pdfWorker);
        if (!response.ok) throw new Error('worker fetch failed');
        const blob = await response.blob();
        const correctedBlob = new Blob([blob], { type: 'application/javascript' });
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(correctedBlob);
    } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
    }
})();

interface TemplateInfo {
    name: string;
    pdfUrl: string;
    editUrl?: string;
    pageInfo: string;
}

let currentPage = 1;
let totalPages = 0;
let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
let currentScale = 1.0;
let rendering = false;

const renderPage = async (pageNum: number) => {
    if (!pdfDoc || rendering) return;
    rendering = true;

    const page = await pdfDoc.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
    if (!canvas) { rendering = false; return; }

    const ctx = canvas.getContext('2d')!;
    const viewport = page.getViewport({ scale: currentScale });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    rendering = false;

    // Update UI
    const pageNumEl = document.getElementById('page-num');
    const pageCountEl = document.getElementById('page-count');
    const pageInfoEl = document.getElementById('page-info');
    const prevBtn = document.getElementById('btn-prev-page') as HTMLButtonElement;
    const nextBtn = document.getElementById('btn-next-page') as HTMLButtonElement;
    const scaleDisplay = document.getElementById('scale-display');

    if (pageNumEl) pageNumEl.textContent = `${pageNum}`;
    if (pageCountEl) pageCountEl.textContent = `${totalPages}`;
    if (pageInfoEl) pageInfoEl.textContent = `Halaman ${pageNum} dari ${totalPages}`;
    if (scaleDisplay) scaleDisplay.textContent = `${Math.round(currentScale * 100)}%`;
    if (prevBtn) prevBtn.disabled = pageNum <= 1;
    if (nextBtn) nextBtn.disabled = pageNum >= totalPages;
};

export const renderTemplateDetail = async (template: TemplateInfo) => {
    const content = `
        <div class="space-y-5 animate-fade-in pb-12">
            <!-- Info Card -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div class="p-5 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-gray-800">Preview Formulir Pengajuan</h2>
                            <p class="text-xs text-gray-500 mt-0.5" id="page-info">Memuat dokumen...</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="btn-edit-template" class="px-5 py-2 border-2 border-teal-600 text-teal-600 text-sm font-bold rounded-xl hover:bg-teal-50 active:scale-95 transition-all">
                            Edit
                        </button>
                        <button id="btn-delete-template" class="px-5 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 active:scale-95 transition-all shadow-sm">
                            Hapus
                        </button>
                    </div>
                </div>
            </div>

            <!-- PDF Viewer Card -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <!-- Toolbar -->
                <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-end gap-3">
                    <button id="btn-zoom-in" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors" title="Perbesar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="11" y1="8" x2="11" y2="14"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                        </svg>
                    </button>
                    <span id="scale-display" class="text-xs font-bold text-gray-600 min-w-[40px] text-center select-none">100%</span>
                    <button id="btn-zoom-out" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors" title="Perkecil">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                        </svg>
                    </button>
                    <div class="w-px h-5 bg-gray-200"></div>
                    <button id="btn-download" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors" title="Unduh">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                </div>

                <!-- PDF Canvas Area -->
                <div class="bg-gray-200 flex items-center justify-center overflow-auto" style="min-height: 600px; max-height: 75vh;">
                    <div id="pdf-loading" class="flex flex-col items-center gap-3 py-20">
                        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
                        <p class="text-sm text-gray-500 font-medium">Memuat dokumen...</p>
                    </div>
                    <canvas id="pdf-canvas" class="shadow-xl hidden"></canvas>
                </div>

                <!-- Bottom Pagination -->
                <div class="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-white">
                    <button id="btn-prev-page" disabled class="px-5 py-2 border-2 border-teal-600 text-teal-600 text-sm font-bold rounded-xl hover:bg-teal-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all">
                        Sebelumnya
                    </button>
                    <div class="flex items-center gap-2">
                        <span id="page-num" class="w-8 h-8 flex items-center justify-center bg-teal-600 text-white text-sm font-bold rounded-lg">1</span>
                        <span class="text-sm text-gray-400 font-medium">/</span>
                        <span id="page-count" class="text-sm text-gray-600 font-bold">-</span>
                    </div>
                    <button id="btn-next-page" disabled class="px-5 py-2 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm">
                        Selanjutnya
                    </button>
                </div>
            </div>
        </div>
    `;

    renderDashboardLayout(template.name, content, 'super_admin', 'template');

    // Add back button behavior to the title
    const headerTitle = document.querySelector('header h1');
    if (headerTitle) {
        headerTitle.innerHTML = `
            <button id="btn-back-template" class="inline-flex items-center gap-3 group">
                <span class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </span>
                <span>${template.name}</span>
            </button>
        `;
        document.getElementById('btn-back-template')?.addEventListener('click', () => {
            import('./TemplateDokumen').then(({ renderTemplateDokumen }) => {
                renderTemplateDokumen();
            });
        });
    }

    // Load PDF
    try {
        // Append cache buster to URL to ensure we fetch the latest version
        const cacheBuster = template.pdfUrl.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
        const finalUrl = template.pdfUrl.startsWith('/') ? `${template.pdfUrl}${cacheBuster}` : template.pdfUrl;

        await workerReady;
        pdfDoc = await pdfjsLib.getDocument(finalUrl).promise;
        totalPages = pdfDoc.numPages;
        currentPage = 1;
        currentScale = 1.0;

        const loadingEl = document.getElementById('pdf-loading');
        const canvasEl = document.getElementById('pdf-canvas');
        if (loadingEl) loadingEl.classList.add('hidden');
        if (canvasEl) canvasEl.classList.remove('hidden');

        await renderPage(currentPage);
    } catch (error) {
        console.error('Error loading PDF:', error);
        const loadingEl = document.getElementById('pdf-loading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="flex flex-col items-center gap-3 py-20">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <p class="text-sm text-red-500 font-medium">Gagal memuat dokumen</p>
                    <p class="text-xs text-gray-400">Pastikan file PDF tersedia</p>
                </div>
            `;
        }
        return;
    }

    // Navigation events
    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage(currentPage);
        }
    });

    document.getElementById('btn-next-page')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPage(currentPage);
        }
    });

    // Zoom events
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
        if (currentScale < 2.5) {
            currentScale += 0.25;
            renderPage(currentPage);
        }
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
        if (currentScale > 0.5) {
            currentScale -= 0.25;
            renderPage(currentPage);
        }
    });

    // Download
    document.getElementById('btn-download')?.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = template.pdfUrl;
        link.download = template.name + '.pdf';
        link.click();
    });

    // Edit button
    document.getElementById('btn-edit-template')?.addEventListener('click', () => {
        if (template.editUrl) {
            window.open(template.editUrl, '_blank');
        } else {
            import('./TemplateEditBeasiswa').then(({ renderTemplateEditBeasiswa }) => {
                renderTemplateEditBeasiswa({
                    name: template.name,
                    pdfUrl: template.pdfUrl
                });
            });
        }
    });
};
