import { describe, expect, it } from 'vitest';
import reviewerShellSource from '../reviewer-shell.ts?raw';

describe('reviewer-shell responsive action dialogs', () => {
    it('caps the generic dialog surface to the viewport and enables vertical scrolling', () => {
        expect(reviewerShellSource).toContain('max-h-[calc(100vh-2rem)]');
        expect(reviewerShellSource).toContain('overflow-x-hidden overflow-y-auto');
    });

    it('preserves dialog accessibility, close handling, and payload mapping', () => {
        expect(reviewerShellSource).toContain('role="dialog"');
        expect(reviewerShellSource).toContain('aria-modal="true"');
        expect(reviewerShellSource).toContain("event.key === 'Escape'");
        expect(reviewerShellSource).toContain('payload[field.payloadKey] = value');
    });

    it('adds no raw file surface or native document embed', () => {
        for (const token of ['window.open', '/api/storage', '/storage/', '<iframe', '<object', '<embed']) {
            expect(reviewerShellSource).not.toContain(token);
        }
    });
});
