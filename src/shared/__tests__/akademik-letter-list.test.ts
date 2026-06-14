import { describe, expect, it } from 'vitest';
import {
    akademikListFilters,
    akademikListFilterValue,
    akademikListSearchText,
    renderAkademikActionableRow,
    renderAkademikHistoryRow,
    toAkademikListItem,
    toAkademikListItems,
    type AkademikHistoryRowShape,
} from '../akademik-letter-list';

const row = (overrides: Partial<AkademikHistoryRowShape> = {}): AkademikHistoryRowShape => ({
    id: 1,
    letter_type: 'surat-tugas',
    type: 'Surat Tugas',
    status: 'Approved_Tendik',
    submitted_at: '01 Jun 2026',
    student_name: 'Budi Santoso',
    nim: '24123456',
    nomor_surat: 'ST/001',
    action_at: '02 Jun 2026',
    ...overrides,
});

describe('akademik-letter-list adapter (CP6C)', () => {
    it('normalizes a raw row, preserving identity and history fields', () => {
        const item = toAkademikListItem(row({ id: 4, letter_type: 'proses-luar-negeri' }));
        expect(item.id).toBe('4');
        expect(item.letterType).toBe('proses-luar-negeri');
        expect(item.nomorSurat).toBe('ST/001');
        expect(item.actionAt).toBe('02 Jun 2026');
        expect(item.raw.letter_type).toBe('proses-luar-negeri');
    });

    it('keeps Surat Tugas distinct from Surat Pengantar Magang', () => {
        const st = toAkademikListItem(row({ letter_type: 'surat-tugas', type: 'Surat Tugas' }));
        const magang = toAkademikListItem(row({ letter_type: 'surat-pengantar-magang', type: 'Surat Pengantar Magang' }));
        expect(st.letterType).toBe('surat-tugas');
        expect(magang.letterType).toBe('surat-pengantar-magang');
    });

    it('normalizes a non-array payload to an empty list', () => {
        expect(toAkademikListItems(null)).toEqual([]);
        expect(toAkademikListItems([row(), row({ id: 2 })])).toHaveLength(2);
    });

    it('search includes nomor_surat only in history mode', () => {
        const item = toAkademikListItem(row({ nomor_surat: 'ST/UNIQUE/99' }));
        expect(akademikListSearchText(item, 'actionable')).not.toContain('ST/UNIQUE/99');
        expect(akademikListSearchText(item, 'history')).toContain('ST/UNIQUE/99');
    });

    it('resolves type/status filter values', () => {
        const item = toAkademikListItem(row({ letter_type: 'surat-keterangan-aktif', status: 'Approved_Kaprodi' }));
        expect(akademikListFilterValue(item, 'type')).toBe('surat-keterangan-aktif');
        expect(akademikListFilterValue(item, 'status')).toBe('Approved_Kaprodi');
    });

    it('derives status options from data with 5 type options (Prodi vs Departemen stages coexist)', () => {
        const items = toAkademikListItems([
            row({ status: 'Approved_Tendik' }),   // Prodi-stage actionable
            row({ id: 2, status: 'Approved_Kaprodi' }), // Departemen-stage actionable
            row({ id: 3, status: 'Approved_Tendik' }),
        ]);
        const filters = akademikListFilters(items, 'actionable');
        expect(filters.find((f) => f.key === 'type')?.options).toHaveLength(5);
        expect(filters.find((f) => f.key === 'status')?.options.map((o) => o.value).sort())
            .toEqual(['Approved_Kaprodi', 'Approved_Tendik']);
    });

    it('renders an actionable row with a Review button and escaped values', () => {
        const html = renderAkademikActionableRow(toAkademikListItem(row({ student_name: '<b>x</b>' })));
        expect(html).toContain('akademik-review-btn');
        expect(html).toContain('data-letter-type="surat-tugas"');
        expect(html).not.toContain('<b>x</b>');
        expect(html).toContain('&lt;b&gt;');
    });

    it('renders a history row with Lihat Detail gated by hasDetail and a nomor surat column', () => {
        const withDetail = renderAkademikHistoryRow(toAkademikListItem(row()), () => true);
        expect(withDetail).toContain('data-riwayat-lihat-detail');
        expect(withDetail).toContain('ST/001');
        const withoutDetail = renderAkademikHistoryRow(toAkademikListItem(row()), () => false);
        expect(withoutDetail).not.toContain('data-riwayat-lihat-detail');
    });
});
