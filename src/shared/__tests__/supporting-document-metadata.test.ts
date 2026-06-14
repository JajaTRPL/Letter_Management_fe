import { describe, expect, it } from 'vitest';
import {
    existingSupportingDocumentValue,
    resolveSupportingDocumentState,
    type SupportingDocumentMetadataMap,
} from '../supporting-document-metadata';

const meta = (over: Partial<SupportingDocumentMetadataMap[string]> = {}): SupportingDocumentMetadataMap[string] => ({
    exists: true,
    original_filename: 'transkrip.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1024,
    preview_available: true,
    ...over,
});

describe('resolveSupportingDocumentState (D2H3E2)', () => {
    it('metadata exists=true is authoritative and exposes original_filename', () => {
        const r = resolveSupportingDocumentState({
            metadata: { transkrip_nilai: meta({ original_filename: 'meta.pdf' }) },
            documentKey: 'transkrip_nilai',
        });

        expect(r.exists).toBe(true);
        expect(r.source).toBe('metadata');
        expect(r.originalFilename).toBe('meta.pdf');
        expect(r.previewAvailable).toBe(true);
    });

    it('metadata exists=false stays false', () => {
        const r = resolveSupportingDocumentState({
            metadata: { transkrip_nilai: meta({ exists: false, original_filename: 'stale.pdf' }) },
            documentKey: 'transkrip_nilai',
        });

        expect(r.exists).toBe(false);
        expect(r.previewAvailable).toBe(false);
        expect(r.originalFilename).toBeNull();
        expect(r.source).toBe('metadata');
    });

    it('preview availability comes only from preview_available', () => {
        const r = resolveSupportingDocumentState({
            metadata: { proposal: meta({ preview_available: false }) },
            documentKey: 'proposal',
        });

        expect(r.exists).toBe(true);
        expect(r.previewAvailable).toBe(false);
        expect(r.source).toBe('metadata');
    });

    it('missing metadata key returns missing', () => {
        const r = resolveSupportingDocumentState({
            metadata: { other_key: meta() },
            documentKey: 'transkrip_nilai',
        });

        expect(r.exists).toBe(false);
        expect(r.previewAvailable).toBe(false);
        expect(r.originalFilename).toBeNull();
        expect(r.source).toBe('missing');
    });

    it('missing metadata map returns missing', () => {
        const r = resolveSupportingDocumentState({ documentKey: 'proposal' });

        expect(r.exists).toBe(false);
        expect(r.previewAvailable).toBe(false);
        expect(r.originalFilename).toBeNull();
        expect(r.source).toBe('missing');
    });

    it('empty metadata map is safe', () => {
        const r = resolveSupportingDocumentState({ metadata: {}, documentKey: 'proposal' });

        expect(r.exists).toBe(false);
        expect(r.source).toBe('missing');
    });

    it('uses only original_filename and never returns a marker, raw path, URL, or route', () => {
        for (const [filename, expected] of [
            ['attachment://proposal/p.pdf', 'p.pdf'],
            ['/storage/private/x/p.pdf', 'p.pdf'],
            ['https://example.test/storage/p.pdf?sig=1', 'p.pdf'],
            ['/api/surat-tugas/5/supporting-documents/proposal/preview', null],
        ] as const) {
            const r = resolveSupportingDocumentState({
                metadata: { proposal: meta({ original_filename: filename }) },
                documentKey: 'proposal',
            });

            expect(r.originalFilename).toBe(expected);
            expect(r.originalFilename ?? '').not.toContain('attachment://');
            expect(r.originalFilename ?? '').not.toContain('/storage/');
            expect(r.originalFilename ?? '').not.toContain('http');
            expect(r.originalFilename ?? '').not.toContain('/api/');
        }
    });

    it('malformed original_filename fails safely', () => {
        for (const bad of [null, undefined, '', '   ', '/', '.', '..']) {
            const r = resolveSupportingDocumentState({
                metadata: { proposal: meta({ original_filename: bad as string | null }) },
                documentKey: 'proposal',
            });
            expect(r.exists).toBe(true);
            expect(r.originalFilename).toBeNull();
        }
    });

    it('existingSupportingDocumentValue returns filename only when metadata exists', () => {
        expect(existingSupportingDocumentValue({
            metadata: { k: meta({ original_filename: 'f.pdf' }) },
            documentKey: 'k',
        })).toBe('f.pdf');
        expect(existingSupportingDocumentValue({
            metadata: { k: meta({ exists: false }) },
            documentKey: 'k',
        })).toBeNull();
        expect(existingSupportingDocumentValue({ documentKey: 'k' })).toBeNull();
    });
});
