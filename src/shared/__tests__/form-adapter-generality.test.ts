// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS } from '../surat-tugas-form';
import { MAGANG_SUPPORTING_DOCUMENT_UPLOADS } from '../magang-form';
import { SKA_SUPPORTING_DOCUMENT_UPLOADS } from '../ska-form';
import { PLN_SUPPORTING_DOCUMENT_UPLOADS } from '../pln-form';
import { BEASISWA_SUPPORTING_DOCUMENT_UPLOADS } from '../beasiswa-form';
import {
    attachSupportingDocumentUploadSection,
    createSupportingDocumentUploadState,
    renderSupportingDocumentUploadSection,
    validateSupportingDocumentUploads,
} from '../supporting-document-upload';

/**
 * Shared-primitive generality proof: one upload module drives 0/1/2/3 supporting
 * documents across FIVE real form adapters with no letter-type branch.
 * Beasiswa = 3, Surat Tugas = 2, Magang = 1, SKA = 0, PLN = 0 (CP5C + CP5D).
 */
describe('form adapter supporting-document generality (CP5C/CP5D)', () => {
    it('exposes 3 / 2 / 1 / 0 / 0 definitions for Beasiswa / Surat Tugas / Magang / SKA / PLN', () => {
        expect(BEASISWA_SUPPORTING_DOCUMENT_UPLOADS).toHaveLength(3);
        expect(BEASISWA_SUPPORTING_DOCUMENT_UPLOADS.every((definition) => definition.requiredOnSubmit)).toBe(true);
        expect(BEASISWA_SUPPORTING_DOCUMENT_UPLOADS.map((definition) => definition.key)).not.toContain('ktm');
        expect(SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS).toHaveLength(2);
        expect(MAGANG_SUPPORTING_DOCUMENT_UPLOADS).toHaveLength(1);
        expect(SKA_SUPPORTING_DOCUMENT_UPLOADS).toEqual([]);
        expect(PLN_SUPPORTING_DOCUMENT_UPLOADS).toEqual([]);
    });

    it('omits the upload section entirely for an empty (SKA/PLN) definition list', () => {
        const state = createSupportingDocumentUploadState();
        expect(renderSupportingDocumentUploadSection(SKA_SUPPORTING_DOCUMENT_UPLOADS, state)).toBe('');
        expect(renderSupportingDocumentUploadSection(PLN_SUPPORTING_DOCUMENT_UPLOADS, state)).toBe('');
    });

    it('mounts no listener and passes validation with no document for an empty list', () => {
        const state = createSupportingDocumentUploadState();
        const dispose = attachSupportingDocumentUploadSection(SKA_SUPPORTING_DOCUMENT_UPLOADS, state);
        // No-op cleanup is safe to call.
        expect(() => dispose()).not.toThrow();

        const result = validateSupportingDocumentUploads(PLN_SUPPORTING_DOCUMENT_UPLOADS, state);
        expect(result.valid).toBe(true);
        expect(result.firstError).toBeUndefined();
    });
});
