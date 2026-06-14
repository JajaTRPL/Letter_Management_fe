import { attachSupportingDocumentPreview, renderSupportingDocumentPreview } from './supporting-document-preview';
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
    options?: { emptyLabel?: string },
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

    // Only ONE viewer below the selector; its content is (re)mounted on switch.
    return `
        <div id="${esc(rootId)}" data-supporting-gallery>
            <div data-gallery-selector role="tablist" aria-label="Dokumen pendukung"
                class="flex items-center gap-2 overflow-x-auto pb-3 -mx-1 px-1">
                ${tabs}
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

    // Auto-select the first available document.
    selectDocument(list[0].key);

    return () => {
        disposed = true;
        selector.removeEventListener('click', onClick);
        selector.removeEventListener('keydown', onKeydown);
        if (cleanupViewer) {
            cleanupViewer();
            cleanupViewer = null;
        }
    };
}
