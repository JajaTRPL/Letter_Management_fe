// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    attachSupportingDocumentUploadSection,
    createSupportingDocumentUploadState,
    displaySupportingDocumentFilename,
    renderSupportingDocumentUploadSection,
    validateSupportingDocumentUploads,
    type SupportingDocumentUploadDefinition,
} from '../supporting-document-upload';

const definition = (
    key: string,
    overrides: Partial<SupportingDocumentUploadDefinition> = {},
): SupportingDocumentUploadDefinition => ({
    key,
    inputName: key,
    label: `Dokumen ${key}`,
    requiredOnSubmit: true,
    accept: 'application/pdf',
    maxSizeBytes: 2 * 1024 * 1024,
    ...overrides,
});

const mount = (
    definitions: readonly SupportingDocumentUploadDefinition[],
    existingValues: Record<string, string | null> = {},
    disabled = false,
) => {
    const state = createSupportingDocumentUploadState(existingValues);
    document.body.innerHTML = renderSupportingDocumentUploadSection(definitions, state, { disabled });
    return { state, dispose: attachSupportingDocumentUploadSection(definitions, state, { disabled }) };
};

const select = (id: string, file: File): void => {
    const input = document.getElementById(id) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

const file = (name: string, type = 'application/pdf', size = 16): File =>
    new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('supporting-document-upload', () => {
    it('omits the section for zero definitions', () => {
        expect(renderSupportingDocumentUploadSection([], createSupportingDocumentUploadState())).toBe('');
    });

    it('renders one associated upload field and N definitions as N unique ids', () => {
        const one = renderSupportingDocumentUploadSection([definition('proposal')], createSupportingDocumentUploadState());
        expect(one).toContain('for="proposal"');
        expect(one).toContain('id="proposal"');

        document.body.innerHTML = renderSupportingDocumentUploadSection(
            [definition('proposal'), definition('surat_pengantar_magang')],
            createSupportingDocumentUploadState(),
        );
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
        expect(inputs.map((input) => input.id)).toEqual(['proposal', 'surat_pengantar_magang']);
        expect(new Set(inputs.map((input) => input.id)).size).toBe(2);
    });

    it('accepts PDF selection and updates the visible replacement filename', () => {
        const { state } = mount([definition('proposal')], { proposal: 'attachment://proposal/old.pdf' });
        select('proposal', file('replacement.pdf'));

        expect(state.selectedFiles.proposal?.name).toBe('replacement.pdf');
        expect(document.getElementById('proposal-status')?.textContent).toContain('File dipilih: replacement.pdf');
    });

    it('rejects non-PDF selection, then clears its error after a valid replacement', () => {
        const { state } = mount([definition('proposal')]);
        select('proposal', file('notes.txt', 'text/plain'));

        expect(state.selectedFiles.proposal).toBeNull();
        expect(document.getElementById('proposal-error')?.textContent).toContain('harus berupa file PDF');
        expect(document.getElementById('proposal-error')?.classList.contains('hidden')).toBe(false);

        select('proposal', file('valid.pdf'));
        expect(document.getElementById('proposal-error')?.textContent).toBe('');
        expect(document.getElementById('proposal-error')?.classList.contains('hidden')).toBe(true);
    });

    it('rejects a PDF over the configured maximum size', () => {
        mount([definition('proposal')]);
        select('proposal', file('too-large.pdf', 'application/pdf', 2 * 1024 * 1024 + 1));

        expect(document.getElementById('proposal-error')?.textContent).toContain('maksimal 2 MB');
    });

    it('requires a configured upload unless a selected or existing document is present', () => {
        const missing = mount([definition('proposal')]);
        expect(validateSupportingDocumentUploads([definition('proposal')], missing.state)).toEqual({
            valid: false,
            firstError: 'Dokumen proposal wajib diunggah.',
        });

        const existing = mount([definition('proposal')], { proposal: 'attachment://proposal/existing.pdf' });
        expect(validateSupportingDocumentUploads([definition('proposal')], existing.state)).toEqual({ valid: true });
    });

    it('renders only the safe basename for markers, legacy paths, long names, and Unicode names', () => {
        const longName = `${'a'.repeat(200)}-dokumen.pdf`;
        const html = renderSupportingDocumentUploadSection(
            [
                definition('proposal'),
                definition('legacy'),
                definition('unicode'),
                definition('long'),
            ],
            createSupportingDocumentUploadState({
                proposal: 'attachment://proposal/proposal.pdf',
                legacy: '/storage/private/legacy.pdf',
                unicode: 'attachment://unicode/surat-%E2%9C%93.pdf',
                long: `attachment://long/${longName}`,
            }),
        );

        expect(html).toContain('File tersimpan: proposal.pdf');
        expect(html).toContain('File tersimpan: legacy.pdf');
        expect(html).toContain('File tersimpan: surat-✓.pdf');
        expect(html).toContain(longName);
        expect(html).not.toContain('attachment://');
        expect(html).not.toContain('/storage/');
    });

    it('escapes helper text and does not emit raw storage or preview markup', () => {
        const html = renderSupportingDocumentUploadSection(
            [definition('proposal', { description: '<script>/api/storage/private</script>' })],
            createSupportingDocumentUploadState(),
        );

        expect(html).toContain('&lt;script&gt;/api/storage/private&lt;/script&gt;');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<iframe');
        expect(html).not.toContain('<object');
        expect(html).not.toContain('<embed');
        expect(html).not.toContain('window.open');
    });

    it('renders disabled inputs and does not attach interactive replacement behavior', () => {
        const { state } = mount([definition('proposal')], {}, true);
        const input = document.getElementById('proposal') as HTMLInputElement;
        expect(input.disabled).toBe(true);

        select('proposal', file('ignored.pdf'));
        expect(state.selectedFiles.proposal).toBeUndefined();
    });

    it('detaches listeners during cleanup', () => {
        const { state, dispose } = mount([definition('proposal')]);
        dispose();
        select('proposal', file('ignored.pdf'));
        expect(state.selectedFiles.proposal).toBeUndefined();
    });

    it('extracts a safe display filename without rendering a compatibility marker prefix', () => {
        expect(displaySupportingDocumentFilename('attachment://proposal/surat%20tugas.pdf')).toBe('surat tugas.pdf');
        expect(displaySupportingDocumentFilename(null)).toBeNull();
    });

    it('notifies the consumer when immediate selection validation fails', () => {
        const onValidationError = vi.fn();
        const definitions = [definition('proposal')];
        const state = createSupportingDocumentUploadState();
        document.body.innerHTML = renderSupportingDocumentUploadSection(definitions, state);
        attachSupportingDocumentUploadSection(definitions, state, { onValidationError });

        select('proposal', file('invalid.txt', 'text/plain'));
        expect(onValidationError).toHaveBeenCalledWith('Dokumen proposal harus berupa file PDF.');
    });
});
