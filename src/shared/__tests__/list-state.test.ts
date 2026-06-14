import { describe, expect, it } from 'vitest';
import {
    applyListQuery,
    createListQueryState,
    normalizeSearchText,
    type ListQueryAccessors,
} from '../list-state';

interface Row {
    name: string;
    status: string;
}

const rows: Row[] = [
    { name: 'Beasiswa Unggulan', status: 'Submitted' },
    { name: 'Surat Keterangan Aktif', status: 'Completed' },
    { name: 'Surat Pengantar Magang', status: 'Submitted' },
    { name: 'Proses Luar Negeri', status: 'Revision' },
    { name: 'Surat Tugas', status: 'Completed' },
];

const accessors: ListQueryAccessors<Row> = {
    getSearchText: (r) => r.name,
    getFilterValue: (r, key) => (key === 'status' ? r.status : ''),
};

describe('list-state applyListQuery (CP6A pure engine)', () => {
    it('returns all items on an empty query', () => {
        const result = applyListQuery(rows, createListQueryState({ pageSize: 50 }), accessors);
        expect(result.totalItems).toBe(5);
        expect(result.visibleItems).toHaveLength(5);
        expect(result.totalPages).toBe(1);
    });

    it('searches case-insensitively and with whitespace normalization', () => {
        const result = applyListQuery(rows, createListQueryState({ search: '  surat  ' }), accessors);
        expect(result.totalItems).toBe(3);
        const upper = applyListQuery(rows, createListQueryState({ search: 'BEASISWA' }), accessors);
        expect(upper.totalItems).toBe(1);
        expect(upper.visibleItems[0].name).toBe('Beasiswa Unggulan');
    });

    it('filters by an exact filter value', () => {
        const result = applyListQuery(rows, createListQueryState({ filters: { status: 'Completed' } }), accessors);
        expect(result.totalItems).toBe(2);
        expect(result.visibleItems.every((r) => r.status === 'Completed')).toBe(true);
    });

    it('combines search and filter', () => {
        // "surat" matches SKA + Magang + Surat Tugas; status=Completed narrows to
        // SKA + Surat Tugas (both Completed).
        const result = applyListQuery(rows, createListQueryState({ search: 'surat', filters: { status: 'Completed' } }), accessors);
        expect(result.totalItems).toBe(2);
        expect(result.visibleItems.map((r) => r.name)).toEqual(['Surat Keterangan Aktif', 'Surat Tugas']);

        // A narrower search + filter combination returns exactly one.
        const single = applyListQuery(rows, createListQueryState({ search: 'keterangan', filters: { status: 'Completed' } }), accessors);
        expect(single.totalItems).toBe(1);
        expect(single.visibleItems[0].name).toBe('Surat Keterangan Aktif');
    });

    it('preserves source order', () => {
        const result = applyListQuery(rows, createListQueryState({ pageSize: 50 }), accessors);
        expect(result.visibleItems.map((r) => r.name)).toEqual(rows.map((r) => r.name));
    });

    it('paginates and exposes total pages', () => {
        const page1 = applyListQuery(rows, createListQueryState({ page: 1, pageSize: 2 }), accessors);
        expect(page1.visibleItems).toHaveLength(2);
        expect(page1.totalPages).toBe(3);
        expect(page1.visibleItems[0].name).toBe('Beasiswa Unggulan');

        const page3 = applyListQuery(rows, createListQueryState({ page: 3, pageSize: 2 }), accessors);
        expect(page3.visibleItems).toHaveLength(1);
        expect(page3.visibleItems[0].name).toBe('Surat Tugas');
    });

    it('clamps an over-range page (e.g. after a filter shrinks results)', () => {
        const result = applyListQuery(rows, createListQueryState({ page: 9, pageSize: 2, filters: { status: 'Revision' } }), accessors);
        expect(result.totalItems).toBe(1);
        expect(result.page).toBe(1);
        expect(result.visibleItems).toHaveLength(1);
    });

    it('handles an empty source array', () => {
        const result = applyListQuery([], createListQueryState(), accessors);
        expect(result.totalItems).toBe(0);
        expect(result.totalPages).toBe(1);
        expect(result.visibleItems).toEqual([]);
    });

    it('does not mutate the source array', () => {
        const snapshot = [...rows];
        applyListQuery(rows, createListQueryState({ search: 'surat', page: 2, pageSize: 1 }), accessors);
        expect(rows).toEqual(snapshot);
    });

    it('is letter-agnostic — works for arbitrary item shapes', () => {
        const numbers = [{ v: 'one' }, { v: 'two' }, { v: 'three' }];
        const result = applyListQuery(numbers, createListQueryState({ search: 't', pageSize: 1 }), { getSearchText: (n) => n.v });
        expect(result.totalItems).toBe(2); // two, three
        expect(result.visibleItems).toHaveLength(1);
    });

    it('normalizeSearchText collapses whitespace and lowercases', () => {
        expect(normalizeSearchText('  HeLLo   World  ')).toBe('hello world');
    });
});
