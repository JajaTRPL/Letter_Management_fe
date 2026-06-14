import { describe, it, expect } from 'vitest';
import { suratTugasSupportingDescriptors } from '../surat-tugas-supporting-documents';
import { magangSupportingDescriptors } from '../magang-supporting-documents';
import type { SupportingDocumentMetadataMap } from '../supporting-document-metadata';

const present = (filename: string): SupportingDocumentMetadataMap[string] => ({
    exists: true,
    original_filename: filename,
    mime_type: 'application/pdf',
    size_bytes: 1024,
    preview_available: true,
});

describe('suratTugasSupportingDescriptors', () => {
    const full = {
        id: 7,
        supporting_documents: {
            proposal: present('proposal final.pdf'),
            surat_pengantar_magang: present('pengantar.pdf'),
        },
    };

    it('produces 2 descriptors in canonical order with protected endpoints', () => {
        const d = suratTugasSupportingDescriptors(full);
        expect(d.map((x) => x.key)).toEqual(['proposal', 'surat_pengantar_magang']);
        expect(d.map((x) => x.label)).toEqual(['Proposal Kegiatan Magang', 'Surat Pengantar Magang']);
        expect(d[0].endpointUrl).toBe('/api/surat-tugas/7/supporting-documents/proposal/preview');
        expect(d[1].endpointUrl).toBe('/api/surat-tugas/7/supporting-documents/surat_pengantar_magang/preview');
        for (const x of d) expect(x.endpointUrl).not.toContain('/api/storage');
    });

    it('marks present files available with a display filename', () => {
        const d = suratTugasSupportingDescriptors(full);
        expect(d.every((x) => x.available)).toBe(true);
        expect(d[0].fileName).toBe('proposal final.pdf');
    });

    it('marks missing metadata unavailable with stable order', () => {
        const d = suratTugasSupportingDescriptors({
            id: 9,
            supporting_documents: { proposal: present('p.pdf') },
        });
        expect(d.map((x) => x.available)).toEqual([true, false]);
        expect(d[1].fileName).toBeNull();
        expect(d.map((x) => x.key)).toEqual(['proposal', 'surat_pengantar_magang']);
    });

    it('never routes Surat Tugas through the Magang prefix', () => {
        const d = suratTugasSupportingDescriptors(full);
        for (const x of d) expect(x.endpointUrl).not.toContain('surat-pengantar-magang');
    });
});

describe('magangSupportingDescriptors', () => {
    it('produces 1 proposal descriptor with the Magang endpoint', () => {
        const d = magangSupportingDescriptors({
            id: 3,
            supporting_documents: { proposal: present('proposal.pdf') },
        });
        expect(d).toHaveLength(1);
        expect(d[0].key).toBe('proposal');
        expect(d[0].label).toBe('Proposal Kegiatan Magang');
        expect(d[0].endpointUrl).toBe('/api/surat-pengantar-magang/3/supporting-documents/proposal/preview');
        expect(d[0].available).toBe(true);
        expect(d[0].fileName).toBe('proposal.pdf');
    });

    it('marks a missing proposal unavailable with null filename (future-ready shape)', () => {
        const d = magangSupportingDescriptors({ id: 4 });
        expect(d).toHaveLength(1);
        expect(d[0].available).toBe(false);
        expect(d[0].fileName).toBeNull();
    });
});
