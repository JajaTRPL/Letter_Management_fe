import { describe, it, expect } from 'vitest';
import {
    LETTER_REGISTRY,
    MAHASISWA_LETTER_ENDPOINTS,
    mahasiswaEndpointPrefixFor,
    resolveLetterRegistry,
} from '../letter-registry';

describe('letter-registry', () => {
    it('represents all 5 active administrative letters', () => {
        const keys = LETTER_REGISTRY.map((e) => e.key).sort();
        expect(keys).toEqual([
            'proses-luar-negeri',
            'surat-keterangan-aktif',
            'surat-pengantar-magang',
            'surat-permohonan-beasiswa',
            'surat-tugas',
        ]);
    });

    it('exposes one applications endpoint per letter', () => {
        expect(MAHASISWA_LETTER_ENDPOINTS).toHaveLength(5);
        const byType = Object.fromEntries(MAHASISWA_LETTER_ENDPOINTS.map((e) => [e.type, e.url]));
        expect(byType['surat-permohonan-beasiswa']).toBe('/api/mahasiswa/scholarship/applications');
        expect(byType['surat-pengantar-magang']).toBe('/api/mahasiswa/surat-pengantar-magang/applications');
        expect(byType['surat-keterangan-aktif']).toBe('/api/mahasiswa/surat-keterangan-aktif/applications');
        expect(byType['proses-luar-negeri']).toBe('/api/mahasiswa/proses-luar-negeri/applications');
        expect(byType['surat-tugas']).toBe('/api/mahasiswa/surat-tugas/applications');
    });

    it('resolves the Mahasiswa endpoint prefix for each canonical key', () => {
        expect(mahasiswaEndpointPrefixFor('surat-permohonan-beasiswa')).toBe('/api/mahasiswa/scholarship');
        expect(mahasiswaEndpointPrefixFor('surat-pengantar-magang')).toBe('/api/mahasiswa/surat-pengantar-magang');
        expect(mahasiswaEndpointPrefixFor('surat-keterangan-aktif')).toBe('/api/mahasiswa/surat-keterangan-aktif');
        expect(mahasiswaEndpointPrefixFor('proses-luar-negeri')).toBe('/api/mahasiswa/proses-luar-negeri');
        expect(mahasiswaEndpointPrefixFor('surat-tugas')).toBe('/api/mahasiswa/surat-tugas');
    });

    it('resolves legacy short keys to the right letter', () => {
        expect(mahasiswaEndpointPrefixFor('magang')).toBe('/api/mahasiswa/surat-pengantar-magang');
        expect(mahasiswaEndpointPrefixFor('aktif')).toBe('/api/mahasiswa/surat-keterangan-aktif');
        expect(mahasiswaEndpointPrefixFor('luar_negeri')).toBe('/api/mahasiswa/proses-luar-negeri');
        expect(mahasiswaEndpointPrefixFor('beasiswa')).toBe('/api/mahasiswa/scholarship');
    });

    it('treats empty/unknown letter types as the Beasiswa fallback (legacy parity)', () => {
        expect(resolveLetterRegistry('')?.key).toBe('surat-permohonan-beasiswa');
        expect(mahasiswaEndpointPrefixFor('')).toBe('/api/mahasiswa/scholarship');
    });

    it('never resolves Surat Tugas through the Magang prefix', () => {
        expect(mahasiswaEndpointPrefixFor('surat-tugas')).not.toContain('surat-pengantar-magang');
    });
});
