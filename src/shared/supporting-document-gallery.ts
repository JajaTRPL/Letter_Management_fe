import { attachSupportingDocumentPreview, renderSupportingDocumentPreview } from './supporting-document-preview';
import { apiFetch } from './api-client';
import { galleryTabClass } from './design-system';

// Global supporting-document gallery: a horizontal attachment selector above a
// SINGLE protected PDF viewer. A letter may carry 0, 1, or many supporting
// files; this avoids vertically stacking one full PDF viewer per file.
//
// Architecture: gallery owns selection + viewer lifecycle (mount/unmount,
// stale-switch safety, cleanup). The protected PDF.js viewer is REUSED via the
// shared supporting-document preview helper — never re-implemented here. Letters
// supply config-only descriptors; no letter-specific branching lives in here.

export interface SupportingDocumentDescriptor {
    /** Stable, unique-within-gallery key. */
    key: string;
    /** Human-readable attachment label (selector card text). */
    label: string;
    /** Dedicated, auth-protected preview endpoint. Never a raw /storage path. */
    endpointUrl: string;
    /** Optional display filename (selector tooltip + viewer subtitle). */
    fileName?: string | null;
    /** Optional availability flag; `false` hides the descriptor from selection. */
    available?: boolean;
}

/** Viewer attach signature — injectable so the switcher is testable without PDF.js. */
export type SupportingViewerAttach = (rootId: string, endpointUrl: string) => () => void;

export interface SupportingDocumentGalleryOptions {
    /** Defaults to the shared protected PDF.js supporting-document preview. */
    attachViewer?: SupportingViewerAttach;
    /** Optional empty-state copy. */
    emptyLabel?: string;
    /** Injectable downloader (tests). Defaults to an authenticated blob download. */
    download?: SupportingDocumentDownloader;
    /** Called when a download fails. */
    onDownloadError?: (message: string) => void;
}

export type SupportingDocumentDownloader = (descriptor: SupportingDocumentDescriptor) => Promise<void>;

export interface SupportingDocumentGalleryRenderOptions {
    emptyLabel?: string;
    /** Show an "Unduh" button that saves the active document (reviewer roles). */
    allowDownload?: boolean;
}

/** Filename for a saved supporting document; always ends in .pdf. */
export function supportingDocumentDownloadName(descriptor: SupportingDocumentDescriptor): string {
    const raw = (descriptor.fileName || descriptor.label || 'dokumen-pendukung').trim();
    // eslint-disable-next-line no-control-regex
    const cleaned = raw.replace(/[\\/:*?"<>|\x00-\x1F]+/g, '_').trim() || 'dokumen-pendukung';
    return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`;
}

/**
 * Default downloader: fetch the same auth-protected, role-scoped preview
 * endpoint the viewer uses and save the bytes via a temporary object URL.
 * Never a raw /storage href or window.open.
 */
export async function downloadSupportingDocument(descriptor: SupportingDocumentDescriptor): Promise<void> {
    const response = await apiFetch(descriptor.endpointUrl, {
        cache: 'no-store',
        headers: { Accept: 'application/pdf' },
    });
    if (!response.ok) {
        throw new Error(response.status === 404 || response.status === 410
            ? 'Dokumen pendukung tidak tersedia.'
            : 'Dokumen pendukung gagal diunduh.');
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    try {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = supportingDocumentDownloadName(descriptor);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
}

const esc = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const availableDescriptors = (
    descriptors: readonly SupportingDocumentDescriptor[],
): SupportingDocumentDescriptor[] => descriptors.filter((d) => d.available !== false);

const viewerRootId = (rootId: string): string => `${rootId}-viewer`;

// Active/inactive gallery selector tab styling now lives in the design system.
const tabClass = (active: boolean): string => galleryTabClass(active);

/**
 * Render the gallery skeleton: a horizontal selector row + a single viewer
 * container. The active viewer is mounted by attachSupportingDocumentGallery.
 */
export function renderSupportingDocumentGallery(
    rootId: string,
    descriptors: readonly SupportingDocumentDescriptor[],
    options?: SupportingDocumentGalleryRenderOptions,
): string {
    const list = availableDescriptors(descriptors);

    if (list.length === 0) {
        return `
            <div id="${esc(rootId)}" data-supporting-gallery>
                <p class="text-sm font-semibold text-gray-400">${esc(options?.emptyLabel ?? 'Belum ada dokumen pendukung.')}</p>
            </div>
        `;
    }

    const tabs = list.map((d, index) => {
        const active = index === 0;
        const tooltip = d.fileName || d.label;
        return `
            <button type="button" role="tab" data-gallery-tab data-key="${esc(d.key)}"
                aria-selected="${active ? 'true' : 'false'}" tabindex="${active ? '0' : '-1'}"
                title="${esc(tooltip)}" class="${tabClass(active)}">
                <span class="block max-w-[200px] truncate">${esc(d.label)}</span>
            </button>
        `;
    }).join('');

    const downloadButton = options?.allowDownload
        ? `
            <button type="button" data-gallery-download
                class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:border-teal-800/30 hover:text-teal-800 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Unduh dokumen yang sedang ditampilkan">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                <span data-gallery-download-label>Unduh</span>
            </button>
        `
        : '';

    // Only ONE viewer below the selector; its content is (re)mounted on switch.
    return `
        <div id="${esc(rootId)}" data-supporting-gallery>
            <div class="flex items-start gap-2">
                <div data-gallery-selector role="tablist" aria-label="Dokumen pendukung"
                    class="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto pb-3 -mx-1 px-1">
                    ${tabs}
                </div>
                ${downloadButton}
            </div>
            <div data-gallery-viewer></div>
        </div>
    `;
}

/**
 * Wire the selector to a single reused protected viewer. Auto-selects the first
 * available descriptor; switching cleans up the previous viewer (aborting any
 * in-flight load) before mounting the next. Returns a cleanup function.
 */
export function attachSupportingDocumentGallery(
    rootId: string,
    descriptors: readonly SupportingDocumentDescriptor[],
    options?: SupportingDocumentGalleryOptions,
): () => void {
    const root = document.getElementById(rootId);
    if (!root) return () => undefined;

    const list = availableDescriptors(descriptors);
    const selector = root.querySelector<HTMLElement>('[data-gallery-selector]');
    const viewerContainer = root.querySelector<HTMLElement>('[data-gallery-viewer]');
    if (list.length === 0 || !selector || !viewerContainer) return () => undefined;

    const attachViewer: SupportingViewerAttach = options?.attachViewer ?? attachSupportingDocumentPreview;
    const innerId = viewerRootId(rootId);

    let activeKey: string | null = null;
    let cleanupViewer: (() => void) | null = null;
    let disposed = false;

    const tabs = Array.from(selector.querySelectorAll<HTMLButtonElement>('[data-gallery-tab]'));

    const syncTabStates = (): void => {
        tabs.forEach((tab) => {
            const isActive = tab.dataset.key === activeKey;
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.tabIndex = isActive ? 0 : -1;
            tab.className = tabClass(isActive);
        });
    };

    const selectDocument = (key: string): void => {
        if (disposed || key === activeKey) return;
        const descriptor = list.find((d) => d.key === key);
        if (!descriptor) return;

        // Dispose the previous viewer (aborts in-flight load) before mounting the
        // next, and re-render the inner viewer HTML so old control listeners are
        // discarded with the detached DOM rather than duplicated.
        if (cleanupViewer) {
            cleanupViewer();
            cleanupViewer = null;
        }

        activeKey = key;
        syncTabStates();

        viewerContainer.innerHTML = renderSupportingDocumentPreview(innerId, {
            title: descriptor.label,
            subtitle: descriptor.fileName || 'Dokumen pendukung yang diunggah.',
            loading: 'Memuat dokumen pendukung...',
        });
        cleanupViewer = attachViewer(innerId, descriptor.endpointUrl);
    };

    const focusTab = (index: number): void => {
        const clamped = Math.max(0, Math.min(tabs.length - 1, index));
        const tab = tabs[clamped];
        if (tab) {
            tab.focus();
            selectDocument(tab.dataset.key || '');
        }
    };

    const onClick = (event: Event): void => {
        const tab = (event.target as HTMLElement)?.closest<HTMLButtonElement>('[data-gallery-tab]');
        if (tab?.dataset.key) selectDocument(tab.dataset.key);
    };

    const onKeydown = (event: KeyboardEvent): void => {
        const current = tabs.findIndex((t) => t.dataset.key === activeKey);
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            focusTab(current + 1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            focusTab(current - 1);
        }
    };

    selector.addEventListener('click', onClick);
    selector.addEventListener('keydown', onKeydown);

    // Optional download button (only rendered when allowDownload was set).
    const downloadButton = root.querySelector<HTMLButtonElement>('[data-gallery-download]');
    const downloadLabel = downloadButton?.querySelector<HTMLElement>('[data-gallery-download-label]') ?? null;
    const download = options?.download ?? downloadSupportingDocument;
    const onDownload = async (): Promise<void> => {
        if (!downloadButton || downloadButton.disabled) return;
        const descriptor = list.find((d) => d.key === activeKey);
        if (!descriptor) return;
        downloadButton.disabled = true;
        if (downloadLabel) downloadLabel.textContent = 'Mengunduh...';
        try {
            await download(descriptor);
        } catch (error) {
            const message = error instanceof Error && error.message
                ? error.message
                : 'Dokumen pendukung gagal diunduh.';
            options?.onDownloadError?.(message);
        } finally {
            if (!disposed) {
                downloadButton.disabled = false;
                if (downloadLabel) downloadLabel.textContent = 'Unduh';
            }
        }
    };
    const onDownloadClick = (): void => { void onDownload(); };
    downloadButton?.addEventListener('click', onDownloadClick);

    // Auto-select the first available document.
    selectDocument(list[0].key);

    return () => {
        disposed = true;
        selector.removeEventListener('click', onClick);
        selector.removeEventListener('keydown', onKeydown);
        downloadButton?.removeEventListener('click', onDownloadClick);
        if (cleanupViewer) {
            cleanupViewer();
            cleanupViewer = null;
        }
    };
}
