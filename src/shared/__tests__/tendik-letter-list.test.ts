import { describe, expect, it } from 'vitest';
import type { TendikTaskRow } from '../letter-workflow';
import {
    renderTendikActionableRow,
    renderTendikHistoryRow,
    tendikListFilters,
    tendikListFilterValue,
    tendikListSearchText,
    toTendikListItem,
    toTendikListItems,
} from '../tendik-letter-list';

const row = (overrides: Partial<TendikTaskRow> = {}): TendikTaskRow => ({
    id: 1,
    letter_type: 'surat-tugas',
    type: 'Surat Tugas',
    status: 'Submitted',
    submitted_at: '01 Jun 2026',
    student_name: 'Budi Santoso',
    nim: '24123456',
    assigned_tendik_name: 'Tendik A',
    ...overrides,
});

describe('tendik-letter-list adapter (CP6B)', () => {
    it('normalizes a raw task row preserving identity', () => {
        const item = toTendikListItem(row({ id: 7, letter_type: 'surat-pengantar-magang' }));
        expect(item.id).toBe('7');
        expect(item.letterType).toBe('surat-pengantar-magang');
        expect(item.studentName).toBe('Budi Santoso');
        expect(item.nim).toBe('24123456');
        expect(item.raw.letter_type).toBe('surat-pengantar-magang');
    });

    it('keeps Surat Tugas distinct from Surat Pengantar Magang', () => {
        const st = toTendikListItem(row({ letter_type: 'surat-tugas' }));
        const magang = toTendikListItem(row({ letter_type: 'surat-pengantar-magang' }));
        expect(st.letterType).toBe('surat-tugas');
        expect(magang.letterType).toBe('surat-pengantar-magang');
        expect(st.label).not.toBe(magang.label);
    });

    it('normalizes a non-array payload to an empty list', () => {
        expect(toTendikListItems(null)).toEqual([]);
        expect(toTendikListItems({ nope: true })).toEqual([]);
        expect(toTendikListItems([row(), row({ id: 2 })])).toHaveLength(2);
    });

    it('builds a searchable haystack from student/nim/type/status (+ actors in history)', () => {
        const item = toTendikListItem(row({
            student_name: 'Siti', nim: '24999', tendik_approved_by_name: 'Verifier Z',
        }));
        const actionable = tendikListSearchText(item, 'actionable');
        expect(actionable).toContain('Siti');
        expect(actionable).toContain('24999');
        expect(actionable).not.toContain('Verifier Z'); // approver only surfaces in history mode

        const history = tendikListSearchText(item, 'history');
        expect(history).toContain('Verifier Z');
    });

    it('resolves type/status filter values', () => {
        const item = toTendikListItem(row({ letter_type: 'proses-luar-negeri', status: 'Completed' }));
        expect(tendikListFilterValue(item, 'type')).toBe('proses-luar-negeri');
        expect(tendikListFilterValue(item, 'status')).toBe('Completed');
        expect(tendikListFilterValue(item, 'unknown')).toBe('');
    });

    it('derives status filter options from the items present, with all 5 type options', () => {
        const items = toTendikListItems([
            row({ status: 'Submitted' }),
            row({ id: 2, status: 'Completed' }),
            row({ id: 3, status: 'Submitted' }),
        ]);
        const filters = tendikListFilters(items, 'actionable');
        const typeFilter = filters.find((f) => f.key === 'type');
        const statusFilter = filters.find((f) => f.key === 'status');
        expect(typeFilter?.options).toHaveLength(5);
        // Distinct statuses only (Submitted + Completed).
        expect(statusFilter?.options.map((o) => o.value).sort()).toEqual(['Completed', 'Submitted']);
    });

    it('renders an actionable row with a Review button and escaped values', () => {
        const html = renderTendikActionableRow(toTendikListItem(row({ student_name: '<script>x</script>' })));
        expect(html).toContain('review-btn');
        expect(html).toContain('Review Dokumen');
        expect(html).toContain('data-letter-type="surat-tugas"');
        expect(html).not.toContain('<script>x</script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('renders a history row with Lihat Detail only when hasDetail is true', () => {
        const withDetail = renderTendikHistoryRow(toTendikListItem(row()), () => true);
        expect(withDetail).toContain('data-riwayat-lihat-detail');
        expect(withDetail).toContain('Lihat Detail');

        const withoutDetail = renderTendikHistoryRow(toTendikListItem(row()), () => false);
        expect(withoutDetail).not.toContain('data-riwayat-lihat-detail');
        expect(withoutDetail).toContain('>-</span>');
    });

    it('shows the actor (rejected > revised > approved > assigned) in history rows', () => {
        const rejected = renderTendikHistoryRow(toTendikListItem(row({ rejected_by_name: 'Penolak' })), () => true);
        expect(rejected).toContain('Penolak');
        expect(rejected).toContain('Ditolak oleh');
    });
});
