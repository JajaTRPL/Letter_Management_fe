import { escapeFormAttribute, escapeFormHtml } from './form-primitives';
import { buttonClass, inputClass, selectClass, textClass } from './design-system';
import { renderErrorState, renderLoadingState } from './ui-primitives';
import {
    applyListQuery,
    createListQueryState,
    type ListFilterDefinition,
    type ListQueryAccessors,
    type ListQueryState,
} from './list-state';

/**
 * Generic, role-agnostic list rendering primitives (CP6A).
 *
 * Owns ONLY presentation + query state: a search box, optional filter selects,
 * a result count, the rows container, pagination controls, and empty/loading/
 * error states — plus listener attachment with a returned cleanup. It knows
 * nothing about letters or applications; a page adapter supplies item rendering,
 * search/filter accessors, and an onChange callback that re-renders the rows.
 *
 * IDs are namespaced by an instance `idPrefix` so multiple lists can coexist on
 * one page without colliding.
 */

export interface ListPrimitiveConfig<T> extends ListQueryAccessors<T> {
    idPrefix: string;
    searchPlaceholder?: string;
    filters?: readonly ListFilterDefinition[];
    /** Renders one item to an HTML string (adapter-owned, already escaped). */
    renderItem: (item: T) => string;
    /** Wraps the joined item HTML (e.g. a <tbody> or a grid). Defaults to identity. */
    renderItemsContainer?: (itemsHtml: string) => string;
    emptyMessage: string;
    /** Optional "N results" label builder; defaults to a generic Indonesian label. */
    resultCountLabel?: (shown: number, total: number) => string;
}

export interface ListToolbarIds {
    search: string;
    filter: (key: string) => string;
    results: string;
    rows: string;
    prev: string;
    next: string;
    pageInfo: string;
}

export function listToolbarIds(idPrefix: string): ListToolbarIds {
    return {
        search: `${idPrefix}-search`,
        filter: (key: string) => `${idPrefix}-filter-${key}`,
        results: `${idPrefix}-results`,
        rows: `${idPrefix}-rows`,
        prev: `${idPrefix}-prev`,
        next: `${idPrefix}-next`,
        pageInfo: `${idPrefix}-page-info`,
    };
}

const defaultResultCountLabel = (shown: number, total: number): string =>
    total === 0 ? 'Tidak ada hasil' : `Menampilkan ${shown} dari ${total} hasil`;

/** Renders the toolbar (search + filters + result count). */
export function renderListToolbar<T>(config: ListPrimitiveConfig<T>, state: ListQueryState): string {
    const ids = listToolbarIds(config.idPrefix);
    const filters = config.filters ?? [];

    const searchControl = `
        <div class="relative flex-1 min-w-[200px]">
            <label for="${escapeFormAttribute(ids.search)}" class="sr-only">Cari</label>
            <input id="${escapeFormAttribute(ids.search)}" type="search" value="${escapeFormAttribute(state.search)}"
                placeholder="${escapeFormAttribute(config.searchPlaceholder ?? 'Cari...')}"
                class="${inputClass('default')}">
        </div>
    `;

    const filterControls = filters.map((filter) => {
        const id = ids.filter(filter.key);
        const current = state.filters[filter.key] ?? '';
        const options = [{ value: '', label: `Semua ${filter.label}` }, ...filter.options]
            .map((option) => `<option value="${escapeFormAttribute(option.value)}" ${option.value === current ? 'selected' : ''}>${escapeFormHtml(option.label)}</option>`)
            .join('');
        return `
            <div>
                <label for="${escapeFormAttribute(id)}" class="sr-only">${escapeFormHtml(filter.label)}</label>
                <select id="${escapeFormAttribute(id)}" class="${selectClass('default')}">
                    ${options}
                </select>
            </div>
        `;
    }).join('');

    return `
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            ${searchControl}
            ${filterControls}
            <p id="${escapeFormAttribute(ids.results)}" class="${textClass.resultCount} sm:ml-auto" aria-live="polite"></p>
        </div>
    `;
}

/** Renders the pagination footer (prev / page info / next). */
export function renderListPagination(idPrefix: string): string {
    const ids = listToolbarIds(idPrefix);
    return `
        <div class="flex items-center justify-between gap-3 px-1">
            <p id="${escapeFormAttribute(ids.pageInfo)}" class="${textClass.resultCount}" aria-live="polite"></p>
            <div class="flex items-center gap-2">
                <button id="${escapeFormAttribute(ids.prev)}" type="button" class="${buttonClass('outline', 'sm')}">Sebelumnya</button>
                <button id="${escapeFormAttribute(ids.next)}" type="button" class="${buttonClass('outline', 'sm')}">Berikutnya</button>
            </div>
        </div>
    `;
}

/**
 * Loading / error state markup helpers (caller chooses when to render them).
 * These delegate to the shared semantic ui-primitives so the surface markup has
 * a single source of truth; the named exports are kept for existing callers.
 */
export function renderListLoading(message = 'Memuat data...'): string {
    return renderLoadingState(message);
}

export function renderListError(message = 'Gagal memuat data. Silakan coba lagi.'): string {
    return renderErrorState(message);
}

/**
 * Render the current page's rows (or the empty message) into the rows container,
 * and refresh the result-count + pagination labels/disabled state. Pure DOM
 * update against the already-mounted toolbar/pagination; safe to call repeatedly.
 */
export function renderListBody<T>(
    items: readonly T[],
    state: ListQueryState,
    config: ListPrimitiveConfig<T>,
): void {
    const ids = listToolbarIds(config.idPrefix);
    const result = applyListQuery(items, state, config);
    // Keep the externally-held state page clamped in sync.
    state.page = result.page;

    const rows = document.getElementById(ids.rows);
    if (rows) {
        if (result.visibleItems.length === 0) {
            rows.innerHTML = `<div class="px-6 py-10 text-center text-sm font-medium text-gray-500">${escapeFormHtml(config.emptyMessage)}</div>`;
        } else {
            const itemsHtml = result.visibleItems.map((item) => config.renderItem(item)).join('');
            rows.innerHTML = config.renderItemsContainer ? config.renderItemsContainer(itemsHtml) : itemsHtml;
        }
    }

    const results = document.getElementById(ids.results);
    if (results) {
        const label = config.resultCountLabel ?? defaultResultCountLabel;
        results.textContent = label(result.visibleItems.length, result.totalItems);
    }

    const pageInfo = document.getElementById(ids.pageInfo);
    if (pageInfo) {
        pageInfo.textContent = result.totalItems === 0
            ? ''
            : `Halaman ${result.page} dari ${result.totalPages}`;
    }

    const prev = document.getElementById(ids.prev) as HTMLButtonElement | null;
    const next = document.getElementById(ids.next) as HTMLButtonElement | null;
    if (prev) prev.disabled = result.page <= 1;
    if (next) next.disabled = result.page >= result.totalPages;
}

/**
 * Wire toolbar + pagination listeners. The supplied `onChange` is invoked after
 * each state mutation so the page can re-render the body (via renderListBody)
 * and re-bind row actions. Returns a cleanup that removes every listener.
 */
export function attachListControls<T>(
    state: ListQueryState,
    config: ListPrimitiveConfig<T>,
    onChange: () => void,
): () => void {
    const ids = listToolbarIds(config.idPrefix);
    const cleanup: Array<() => void> = [];

    const bind = (id: string, event: string, handler: EventListener): void => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(event, handler);
        cleanup.push(() => el.removeEventListener(event, handler));
    };

    bind(ids.search, 'input', (e) => {
        state.search = (e.currentTarget as HTMLInputElement).value;
        state.page = 1;
        onChange();
    });

    for (const filter of config.filters ?? []) {
        bind(ids.filter(filter.key), 'change', (e) => {
            state.filters = { ...state.filters, [filter.key]: (e.currentTarget as HTMLSelectElement).value };
            state.page = 1;
            onChange();
        });
    }

    bind(ids.prev, 'click', () => {
        if (state.page > 1) {
            state.page -= 1;
            onChange();
        }
    });

    bind(ids.next, 'click', () => {
        state.page += 1; // renderListBody clamps; onChange re-syncs state.page.
        onChange();
    });

    return () => cleanup.forEach((dispose) => dispose());
}

export { createListQueryState };
