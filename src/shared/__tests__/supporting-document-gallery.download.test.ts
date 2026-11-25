// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../supporting-document-preview', () => ({
    renderSupportingDocumentPreview: (id: string) => `<div id="${id}" data-protected-pdf-viewer></div>`,
    attachSupportingDocumentPreview: () => () => undefined,
}));

import {
    renderSupportingDocumentGallery,
    attachSupportingDocumentGallery,
    supportingDocumentDownloadName,
    type SupportingDocumentDescriptor,
} from '../supporting-document-gallery';

const docs: SupportingDocumentDescriptor[] = [
    { key: 'a', label: 'Transkrip Nilai', endpointUrl: '/api/x/a/preview', fileName: 'transkrip.pdf' },
    { key: 'b', label: 'Slip Gaji Ayah', endpointUrl: '/api/x/b/preview' },
];

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('supporting-document gallery download option', () => {
    it('does not render a download button unless allowDownload is set', () => {
        document.body.innerHTML = renderSupportingDocumentGallery('g', docs);
        expect(document.querySelector('[data-gallery-download]')).toBeNull();
    });

    it('downloads the currently selected document', async () => {
        document.body.innerHTML = renderSupportingDocumentGallery('g', docs, { allowDownload: true });
        const download = vi.fn().mockResolvedValue(undefined);
        const cleanup = attachSupportingDocumentGallery('g', docs, { attachViewer: () => () => undefined, download });

        const button = document.querySelector<HTMLButtonElement>('[data-gallery-download]')!;
        button.click();
        await flush();
        expect(download).toHaveBeenLastCalledWith(docs[0]);

        document.querySelector<HTMLButtonElement>('[data-gallery-tab][data-key="b"]')!.click();
        button.click();
        await flush();
        expect(download).toHaveBeenLastCalledWith(docs[1]);
        expect(button.disabled).toBe(false);

        cleanup();
    });

    it('reports download failures and re-enables the button', async () => {
        document.body.innerHTML = renderSupportingDocumentGallery('g', docs, { allowDownload: true });
        const onDownloadError = vi.fn();
        attachSupportingDocumentGallery('g', docs, {
            attachViewer: () => () => undefined,
            download: () => Promise.reject(new Error('Dokumen pendukung tidak tersedia.')),
            onDownloadError,
        });

        const button = document.querySelector<HTMLButtonElement>('[data-gallery-download]')!;
        button.click();
        await flush();
        expect(onDownloadError).toHaveBeenCalledWith('Dokumen pendukung tidak tersedia.');
        expect(button.disabled).toBe(false);
    });

    it('builds a safe .pdf filename', () => {
        expect(supportingDocumentDownloadName(docs[0])).toBe('transkrip.pdf');
        expect(supportingDocumentDownloadName(docs[1])).toBe('Slip Gaji Ayah.pdf');
        expect(supportingDocumentDownloadName({ key: 'c', label: 'Slip Gaji / Ibu', endpointUrl: '/x' }))
            .toBe('Slip Gaji _ Ibu.pdf');
    });
});
