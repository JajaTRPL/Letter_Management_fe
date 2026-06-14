import { describe, expect, it } from 'vitest';
import { beasiswaSupportingDescriptors } from '../beasiswa-supporting-documents';
import { magangSupportingDescriptors } from '../magang-supporting-documents';
import { suratTugasSupportingDescriptors } from '../surat-tugas-supporting-documents';
import { beasiswaExistingSupportingDocumentValues } from '../beasiswa-form';
import { magangExistingSupportingDocumentValues as magangExisting } from '../magang-form';
import { suratTugasExistingSupportingDocumentValues as stExisting } from '../surat-tugas-form';
import type { SupportingDocumentMetadataMap } from '../supporting-document-metadata';

const present = (filename: string, previewAvailable = true): SupportingDocumentMetadataMap[string] => ({
    exists: true,
    original_filename: filename,
    mime_type: 'application/pdf',
    size_bytes: 10,
    preview_available: previewAvailable,
});
const absent = (): SupportingDocumentMetadataMap[string] => ({
    exists: false,
    original_filename: null,
    mime_type: null,
    size_bytes: null,
    preview_available: false,
});

describe('descriptor cutover - metadata-only (D2H3E2)', () => {
    it('Beasiswa: exactly 3 active docs from metadata; KTM excluded', () => {
        const ds = beasiswaSupportingDescriptors({
            id: 9,
            supporting_documents: {
                transkrip_nilai: present('transkrip meta.pdf'),
                slip_gaji_ayah: absent(),
                slip_gaji_ibu: present('ibu.pdf', false),
            },
        });
        expect(ds).toHaveLength(3);
        const byKey = Object.fromEntries(ds.map((d) => [d.key, d]));

        expect(Object.keys(byKey)).toEqual(['transkrip_nilai', 'slip_gaji_ayah', 'slip_gaji_ibu']);
        expect(byKey.ktm_path).toBeUndefined();
        expect(byKey.transkrip_nilai.available).toBe(true);
        expect(byKey.transkrip_nilai.fileName).toBe('transkrip meta.pdf');
        expect(byKey.slip_gaji_ayah.available).toBe(false);
        expect(byKey.slip_gaji_ayah.fileName).toBeNull();
        expect(byKey.slip_gaji_ibu.available).toBe(false);
        expect(byKey.slip_gaji_ibu.fileName).toBe('ibu.pdf');
        expect(byKey.transkrip_nilai.endpointUrl)
            .toBe('/api/scholarship/9/supporting-documents/transkrip_nilai/preview');
    });

    it('Beasiswa: missing metadata map and missing keys do not revive stale legacy fields', () => {
        const noMap = beasiswaSupportingDescriptors({
            id: 9,
            transkrip_nilai_path: 'attachment://transkrip_nilai/legacy.pdf',
        } as never);
        expect(noMap.map((d) => d.available)).toEqual([false, false, false]);
        expect(noMap.map((d) => d.fileName)).toEqual([null, null, null]);

        const missingKey = beasiswaSupportingDescriptors({
            id: 9,
            supporting_documents: { transkrip_nilai: present('saved.pdf') },
            slip_gaji_ayah_path: 'attachment://slip_gaji_ayah/stale.pdf',
        } as never);
        const byKey = Object.fromEntries(missingKey.map((d) => [d.key, d]));
        expect(byKey.transkrip_nilai.available).toBe(true);
        expect(byKey.slip_gaji_ayah.available).toBe(false);
        expect(byKey.slip_gaji_ayah.fileName).toBeNull();
    });

    it('Magang: proposal descriptor is metadata-only', () => {
        const ds = magangSupportingDescriptors({
            id: 3,
            supporting_documents: { proposal: present('proposal.pdf') },
        });
        expect(ds).toHaveLength(1);
        expect(ds[0].available).toBe(true);
        expect(ds[0].fileName).toBe('proposal.pdf');
        expect(ds[0].endpointUrl)
            .toBe('/api/surat-pengantar-magang/3/supporting-documents/proposal/preview');

        const staleOnly = magangSupportingDescriptors({
            id: 3,
            proposal_kegiatan_magang_path: 'attachment://proposal/stale.pdf',
        } as never);
        expect(staleOnly[0].available).toBe(false);
        expect(staleOnly[0].fileName).toBeNull();
    });

    it('Surat Tugas: 2 descriptors are metadata-only with distinct preview routes', () => {
        const ds = suratTugasSupportingDescriptors({
            id: 5,
            supporting_documents: {
                proposal: present('p.pdf'),
                surat_pengantar_magang: present('pengantar.pdf'),
            },
        });
        expect(ds.map((d) => d.key)).toEqual(['proposal', 'surat_pengantar_magang']);
        expect(ds.every((d) => d.available)).toBe(true);
        expect(ds[1].fileName).toBe('pengantar.pdf');
        expect(ds[0].endpointUrl).toBe('/api/surat-tugas/5/supporting-documents/proposal/preview');
        expect(ds[1].endpointUrl).toBe('/api/surat-tugas/5/supporting-documents/surat_pengantar_magang/preview');
        expect(ds[0].endpointUrl).not.toContain('surat-pengantar-magang');
    });

    it('never renders a raw path, marker, or URL from metadata original_filename', () => {
        const all = [
            ...beasiswaSupportingDescriptors({
                id: 1,
                supporting_documents: { transkrip_nilai: present('attachment://transkrip_nilai/x.pdf') },
            }),
            ...magangSupportingDescriptors({
                id: 1,
                supporting_documents: { proposal: present('/storage/x/y.pdf') },
            }),
            ...suratTugasSupportingDescriptors({
                id: 1,
                supporting_documents: { proposal: present('https://example.test/storage/z.pdf?sig=1') },
            }),
        ];
        for (const d of all) {
            expect(d.fileName ?? '').not.toContain('attachment://');
            expect(d.fileName ?? '').not.toContain('/storage/');
            expect(d.fileName ?? '').not.toContain('http');
            expect(d.fileName ?? '').not.toContain('/api/');
        }
    });
});

describe('form existing-value cutover - metadata-only (D2H3E2)', () => {
    it('Beasiswa existingValues are metadata-only', () => {
        const v = beasiswaExistingSupportingDocumentValues({
            supporting_documents: { transkrip_nilai: present('saved.pdf'), slip_gaji_ayah: absent() },
        });
        expect(v.transkrip_nilai).toBe('saved.pdf');
        expect(v.slip_gaji_ayah).toBeNull();
        expect(v.slip_gaji_ibu).toBeNull();
    });

    it('Magang/Surat Tugas existingValues require metadata', () => {
        expect(magangExisting({}).proposal).toBeNull();
        expect(magangExisting({
            supporting_documents: { proposal: present('m.pdf') },
        }).proposal).toBe('m.pdf');

        const st = stExisting({
            supporting_documents: { proposal: present('a.pdf'), surat_pengantar_magang: absent() },
        });
        expect(st.proposal).toBe('a.pdf');
        expect(st.surat_pengantar_magang).toBeNull();
    });
});
