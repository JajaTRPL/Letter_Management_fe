/**
 * Generic, letter-agnostic client-side list query engine (CP6A).
 *
 * Pure functions only — no DOM, no fetching, no knowledge of any specific
 * domain (letters, applications, roles). A page adapter supplies the items plus
 * accessors for searchable text and filter values; this module applies search +
 * filters, preserves the adapter's input ordering, and slices the visible page.
 *
 * Honest pagination: this is CLIENT-SIDE only. It operates on an already-fetched
 * array and never invents server query params.
 */

export interface ListOption {
    value: string;
    label: string;
}

export interface ListFilterDefinition {
    /** Filter key, also used as the filters[key] entry in the query state. */
    key: string;
    label: string;
    /** Selectable options. The "all" sentinel ('') is rendered by the toolbar. */
    options: readonly ListOption[];
}

export interface ListQueryState {
    search: string;
    filters: Record<string, string>;
    page: number;
    pageSize: number;
}

export interface ListQueryAccessors<T> {
    /** Free-text haystack for the search box (already-joined string per item). */
    getSearchText: (item: T) => string;
    /** Resolve an item's value for a given filter key (compared case-sensitively). */
    getFilterValue?: (item: T, filterKey: string) => string;
}

export interface ListQueryResult<T> {
    /** Items on the current (clamped) page, in the source order. */
    visibleItems: T[];
    /** Count after search + filters, before pagination. */
    totalItems: number;
    totalPages: number;
    /** Page actually used after clamping into [1, totalPages]. */
    page: number;
    pageSize: number;
}

export const DEFAULT_LIST_PAGE_SIZE = 10;

export function createListQueryState(overrides: Partial<ListQueryState> = {}): ListQueryState {
    return {
        search: '',
        filters: {},
        page: 1,
        pageSize: DEFAULT_LIST_PAGE_SIZE,
        ...overrides,
    };
}

/** Lower-cased, whitespace-collapsed, trimmed search needle. */
export function normalizeSearchText(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Apply search + filters + pagination to a source array WITHOUT mutating it.
 * Source ordering is preserved (the adapter is responsible for sort order).
 */
export function applyListQuery<T>(
    items: readonly T[],
    state: ListQueryState,
    accessors: ListQueryAccessors<T>,
): ListQueryResult<T> {
    const needle = normalizeSearchText(state.search ?? '');
    const activeFilters = Object.entries(state.filters ?? {}).filter(([, value]) => value !== '' && value != null);

    const matched = items.filter((item) => {
        if (needle) {
            const haystack = normalizeSearchText(accessors.getSearchText(item));
            if (!haystack.includes(needle)) return false;
        }
        for (const [key, value] of activeFilters) {
            const itemValue = accessors.getFilterValue ? accessors.getFilterValue(item, key) : '';
            if (itemValue !== value) return false;
        }
        return true;
    });

    const totalItems = matched.length;
    const pageSize = Math.max(1, state.pageSize || DEFAULT_LIST_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(Math.max(1, state.page || 1), totalPages);

    const start = (page - 1) * pageSize;
    const visibleItems = matched.slice(start, start + pageSize);

    return { visibleItems, totalItems, totalPages, page, pageSize };
}
