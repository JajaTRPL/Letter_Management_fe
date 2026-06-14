import { describe, it, expect, vi } from 'vitest';

// Keep the gallery render hermetic — no PDF.js import chain.
vi.mock('../supporting-document-preview', () => ({
    renderSupportingDocumentPreview: (id: string) => `<div id="${id}" data-protected-pdf-viewer></div>`,
    attachSupportingDocumentPreview: () => () => undefined,
}));

import {
    renderSupportingDocumentGallery,
    type SupportingDocumentDescriptor,
} from '../supporting-document-gallery';

const desc = (
    key: string,
    label: string,
    extra: Partial<SupportingDocumentDescriptor> = {},
): SupportingDocumentDescriptor => ({ key, label, endpointUrl: `/api/x/${key}/preview`, ...extra });

const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe('renderSupportingDocumentGallery', () => {
    it('renders a clean empty state for zero descriptors', () => {
        const html = renderSupportingDocumentGallery('g', []);
        expect(html).not.toContain('role="tablist"');
        expect(html).not.toContain('data-gallery-viewer');
        expect(html).toContain('Belum ada dokumen pendukung');
    });

    it('renders one tab + one single viewer container for one descriptor', () => {
        const html = renderSupportingDocumentGallery('g', [desc('proposal', 'Proposal')]);
        expect(count(html, 'data-gallery-tab')).toBe(1);
        expect(count(html, 'data-gallery-viewer')).toBe(1);
        expect(count(html, 'aria-selected="true"')).toBe(1);
    });

    it('renders 7 tabs with exactly one viewer container and no stacked viewers', () => {
        const arr = Array.from({ length: 7 }, (_, i) => desc(`k${i}`, `Dokumen ${i}`));
        const html = renderSupportingDocumentGallery('g', arr);
        expect(count(html, 'data-gallery-tab')).toBe(7);
        expect(count(html, 'data-gallery-viewer')).toBe(1);
        // Viewers mount lazily on attach — never pre-stacked in the markup.
        expect(count(html, 'data-protected-pdf-viewer')).toBe(0);
        expect(count(html, 'aria-selected="true"')).toBe(1);
    });

    it('excludes descriptors marked unavailable', () => {
        const html = renderSupportingDocumentGallery('g', [
            desc('a', 'A', { available: false }),
            desc('b', 'B'),
        ]);
        expect(html).toContain('data-key="b"');
        expect(html).not.toContain('data-key="a"');
    });

    it('escapes labels to prevent injection', () => {
        const html = renderSupportingDocumentGallery('g', [desc('x', '<script>alert(1)</script>')]);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('exposes long filename via title and truncates the visible label', () => {
        const long = `${'a'.repeat(120)}.pdf`;
        const html = renderSupportingDocumentGallery('g', [desc('x', 'Proposal', { fileName: long })]);
        expect(html).toContain(`title="${long}"`);
        expect(html).toContain('truncate');
    });

    it('never emits raw storage / iframe / window.open in the selector markup', () => {
        const html = renderSupportingDocumentGallery('g', [desc('x', 'X'), desc('y', 'Y')]);
        for (const token of ['<iframe', '<object', '<embed', '/api/storage', '/storage/', 'window.open', 'openAuthFile', 'download=']) {
            expect(html).not.toContain(token);
        }
    });
});
