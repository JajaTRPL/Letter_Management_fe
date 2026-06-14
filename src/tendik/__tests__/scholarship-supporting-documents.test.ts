import { describe, it, expect } from 'vitest';
import {
    scholarshipSupportingDescriptors,
    buildScholarshipSupportingPreviewUrl,
} from '../scholarship-supporting-documents';
import type { SupportingDocumentMetadataMap } from '../../shared/supporting-document-metadata';

const present = (filename: string): SupportingDocumentMetadataMap[string] => ({
    exists: true,
    original_filename: filename,
    mime_type: 'application/pdf',
    size_bytes: 1024,
    preview_available: true,
});

const fullApp = {
    id: 42,
    supporting_documents: {
        transkrip_nilai: present('transkrip nilai final.pdf'),
        slip_gaji_ayah: present('slip-ayah.pdf'),
        slip_gaji_ibu: present('slip-ibu.pdf'),
    },
};

describe('scholarshipSupportingDescriptors', () => {
    it('produces exactly 3 descriptors in the canonical order', () => {
        const d = scholarshipSupportingDescriptors(fullApp);
        expect(d).toHaveLength(3);
        expect(d.map((x) => x.key)).toEqual(['transkrip_nilai', 'slip_gaji_ayah', 'slip_gaji_ibu']);
        expect(d.map((x) => x.label)).toEqual([
            'Transkrip Nilai',
            'Slip Gaji / Penghasilan Ayah/Wali',
            'Slip Gaji / Penghasilan Ibu',
        ]);
    });

    it('builds the protected per-field preview endpoints (no raw storage)', () => {
        const d = scholarshipSupportingDescriptors(fullApp);
        expect(d[0].endpointUrl).toBe('/api/scholarship/42/supporting-documents/transkrip_nilai/preview');
        expect(d[1].endpointUrl).toBe('/api/scholarship/42/supporting-documents/slip_gaji_ayah/preview');
        expect(d[2].endpointUrl).toBe('/api/scholarship/42/supporting-documents/slip_gaji_ibu/preview');
        for (const x of d) {
            expect(x.endpointUrl).not.toContain('/api/storage');
            expect(x.endpointUrl).not.toContain('/storage/');
        }
    });

    it('marks present files available and derives a display filename', () => {
        const d = scholarshipSupportingDescriptors(fullApp);
        expect(d.every((x) => x.available)).toBe(true);
        expect(d[0].fileName).toBe('transkrip nilai final.pdf');
    });

    it('marks missing metadata unavailable (gallery will hide them) with null filename', () => {
        const d = scholarshipSupportingDescriptors({
            id: 7,
            supporting_documents: { transkrip_nilai: present('t.pdf') },
        });
        expect(d.map((x) => x.available)).toEqual([true, false, false]);
        expect(d[1].fileName).toBeNull();
        expect(d[2].fileName).toBeNull();
        expect(d.map((x) => x.key)).toEqual(['transkrip_nilai', 'slip_gaji_ayah', 'slip_gaji_ibu']);
    });

    it('exposes a stable endpoint builder', () => {
        expect(buildScholarshipSupportingPreviewUrl(9, 'slip_gaji_ibu'))
            .toBe('/api/scholarship/9/supporting-documents/slip_gaji_ibu/preview');
    });
});
