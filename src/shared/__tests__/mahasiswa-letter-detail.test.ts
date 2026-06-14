import { describe, it, expect } from 'vitest';
import {
    formatDetailDateTime,
    renderDetailHeaderCard,
    renderDetailInfoCard,
    renderDetailLabelValueRow,
} from '../mahasiswa-letter-detail';

const FORBIDDEN = ['<iframe', '<object', '<embed', '/api/storage', 'window.open', 'openAuthFile'];
const assertNoForbidden = (html: string) => {
    for (const token of FORBIDDEN) {
        expect(html).not.toContain(token);
    }
};

describe('mahasiswa-letter-detail shared shell primitives', () => {
    it('header card renders back button, title, subtitle and status badge', () => {
        const html = renderDetailHeaderCard({
            backId: 'btn-back-to-docs',
            backLabel: 'Kembali ke Riwayat Pengajuan',
            title: 'Detail Pengajuan',
            subtitle: 'Surat Permohonan Beasiswa',
            statusLabel: 'Selesai',
            statusBadgeClass: 'bg-teal-50 text-teal-700 border-teal-100',
        });
        expect(html).toContain('id="btn-back-to-docs"');
        expect(html).toContain('Detail Pengajuan');
        expect(html).toContain('Surat Permohonan Beasiswa');
        expect(html).toContain('Selesai');
        expect(html).toContain('bg-teal-50 text-teal-700 border-teal-100');
        expect(html).toContain('aria-label="Kembali ke Riwayat Pengajuan"');
        assertNoForbidden(html);
    });

    it('info card renders a titled card with label/value rows', () => {
        const html = renderDetailInfoCard('Pemohon', [
            ['Nama', 'Budi Santoso'],
            ['NIM', '24123456'],
        ]);
        expect(html).toContain('Pemohon');
        expect(html).toContain('Nama');
        expect(html).toContain('Budi Santoso');
        expect(html).toContain('NIM');
        assertNoForbidden(html);
    });

    it('renders "-" for empty values (no invented data)', () => {
        const html = renderDetailLabelValueRow('No. Telepon', '');
        expect(html).toContain('No. Telepon');
        expect(html).toContain('-');
    });

    it('escapes HTML in values to prevent injection', () => {
        const html = renderDetailLabelValueRow('X', '<script>alert(1)</script>');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('formatDetailDateTime returns "-" for null/invalid and a string for valid dates', () => {
        expect(formatDetailDateTime(null)).toBe('-');
        expect(formatDetailDateTime('not-a-date')).toBe('-');
        expect(formatDetailDateTime('2026-05-25T10:07:00Z')).not.toBe('-');
    });
});
