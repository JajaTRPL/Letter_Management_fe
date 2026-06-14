// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supporting-document-preview', () => ({
    renderSupportingDocumentPreview: (id: string) => `<div id="${id}" data-protected-pdf-viewer></div>`,
    attachSupportingDocumentPreview: () => () => undefined,
}));

import {
    renderSupportingDocumentGallery,
    attachSupportingDocumentGallery,
    type SupportingDocumentDescriptor,
} from '../supporting-document-gallery';

const desc = (
    key: string,
    label: string,
    extra: Partial<SupportingDocumentDescriptor> = {},
): SupportingDocumentDescriptor => ({ key, label, endpointUrl: `/api/x/${key}/preview`, ...extra });

interface Fake {
    attach: (rootId: string, url: string) => () => void;
    urls: string[];
    cleanups: Array<ReturnType<typeof vi.fn>>;
}

const makeFake = (): Fake => {
    const urls: string[] = [];
    const cleanups: Array<ReturnType<typeof vi.fn>> = [];
    const attach = (_rootId: string, url: string): (() => void) => {
        urls.push(url);
        const c = vi.fn();
        cleanups.push(c);
        return c;
    };
    return { attach, urls, cleanups };
};

const mount = (descriptors: SupportingDocumentDescriptor[], fake: Fake): (() => void) => {
    document.body.innerHTML = renderSupportingDocumentGallery('g', descriptors);
    return attachSupportingDocumentGallery('g', descriptors, { attachViewer: fake.attach });
};

const tabByKey = (key: string): HTMLButtonElement =>
    document.querySelector<HTMLButtonElement>(`[data-gallery-tab][data-key="${key}"]`)!;

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('attachSupportingDocumentGallery', () => {
    it('auto-selects the first available document and loads only it', () => {
        const fake = makeFake();
        mount([desc('a', 'A'), desc('b', 'B'), desc('c', 'C')], fake);
        expect(fake.urls).toEqual(['/api/x/a/preview']); // only the selected one
        expect(tabByKey('a').getAttribute('aria-selected')).toBe('true');
        expect(tabByKey('b').getAttribute('aria-selected')).toBe('false');
    });

    it('switching documents cleans up the previous viewer and loads the next', () => {
        const fake = makeFake();
        mount([desc('a', 'A'), desc('b', 'B')], fake);
        tabByKey('b').click();
        expect(fake.urls).toEqual(['/api/x/a/preview', '/api/x/b/preview']);
        expect(fake.cleanups[0]).toHaveBeenCalledTimes(1); // previous viewer disposed
        expect(tabByKey('b').getAttribute('aria-selected')).toBe('true');
        expect(tabByKey('a').getAttribute('aria-selected')).toBe('false');
    });

    it('keeps exactly one mounted viewer at a time', () => {
        const fake = makeFake();
        mount([desc('a', 'A'), desc('b', 'B'), desc('c', 'C')], fake);
        tabByKey('b').click();
        tabByKey('c').click();
        expect(document.querySelectorAll('[data-protected-pdf-viewer]')).toHaveLength(1);
    });

    it('handles rapid switching without leaking viewers (each prior is disposed)', () => {
        const fake = makeFake();
        mount([desc('a', 'A'), desc('b', 'B'), desc('c', 'C')], fake);
        tabByKey('b').click();
        tabByKey('c').click();
        expect(fake.urls).toEqual(['/api/x/a/preview', '/api/x/b/preview', '/api/x/c/preview']);
        expect(fake.cleanups[0]).toHaveBeenCalledTimes(1);
        expect(fake.cleanups[1]).toHaveBeenCalledTimes(1);
        expect(tabByKey('c').getAttribute('aria-selected')).toBe('true');
    });

    it('clicking the already-active document does not reload it', () => {
        const fake = makeFake();
        mount([desc('a', 'A'), desc('b', 'B')], fake);
        tabByKey('a').click();
        expect(fake.urls).toEqual(['/api/x/a/preview']); // no duplicate load
    });

    it('skips unavailable descriptors when auto-selecting', () => {
        const fake = makeFake();
        mount([desc('a', 'A', { available: false }), desc('b', 'B')], fake);
        expect(fake.urls).toEqual(['/api/x/b/preview']);
        expect(document.querySelector('[data-key="a"]')).toBeNull();
    });

    it('supports ArrowRight keyboard navigation between tabs', () => {
        const fake = makeFake();
        mount([desc('a', 'A'), desc('b', 'B')], fake);
        const selector = document.querySelector('[data-gallery-selector]')!;
        selector.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(tabByKey('b').getAttribute('aria-selected')).toBe('true');
        expect(fake.urls).toEqual(['/api/x/a/preview', '/api/x/b/preview']);
    });

    it('cleanup disposes the active viewer and detaches listeners', () => {
        const fake = makeFake();
        const cleanup = mount([desc('a', 'A'), desc('b', 'B')], fake);
        cleanup();
        expect(fake.cleanups[fake.cleanups.length - 1]).toHaveBeenCalledTimes(1);
        // After cleanup, the selector no longer reacts.
        tabByKey('b').click();
        expect(fake.urls).toEqual(['/api/x/a/preview']);
    });

    it('renders an empty state and no viewer for zero descriptors', () => {
        const fake = makeFake();
        mount([], fake);
        expect(fake.urls).toEqual([]);
        expect(document.querySelector('[data-protected-pdf-viewer]')).toBeNull();
    });
});
