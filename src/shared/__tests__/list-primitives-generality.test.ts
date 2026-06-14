// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
    attachListControls,
    createListQueryState,
    listToolbarIds,
    renderListBody,
    renderListPagination,
    renderListToolbar,
    type ListPrimitiveConfig,
} from '../list-primitives';

interface Pet {
    name: string;
    kind: string;
}

const pets: Pet[] = [
    { name: 'Rex', kind: 'dog' },
    { name: 'Milo', kind: 'cat' },
    { name: 'Buddy', kind: 'dog' },
    { name: 'Whiskers', kind: 'cat' },
    { name: 'Spot', kind: 'dog' },
];

const config: ListPrimitiveConfig<Pet> = {
    idPrefix: 'pets',
    searchPlaceholder: 'Search pets',
    filters: [{ key: 'kind', label: 'Kind', options: [{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }] }],
    getSearchText: (p) => p.name,
    getFilterValue: (p, key) => (key === 'kind' ? p.kind : ''),
    renderItem: (p) => `<div class="pet-row" data-name="${p.name}">${p.name}</div>`,
    emptyMessage: 'No pets',
};

const mount = (pageSize = 2) => {
    const state = createListQueryState({ pageSize });
    document.body.innerHTML = `
        <div>
            ${renderListToolbar(config, state)}
            <div id="${listToolbarIds(config.idPrefix).rows}"></div>
            ${renderListPagination(config.idPrefix)}
        </div>
    `;
    return state;
};

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('list primitives generality (CP6A — not domain-specific)', () => {
    it('renders, searches, filters, and paginates an arbitrary item type with no letter knowledge', () => {
        const state = mount(2);
        let renders = 0;
        const refresh = () => { renderListBody(pets, state, config); renders++; };
        attachListControls(state, config, refresh);
        refresh();

        const ids = listToolbarIds('pets');
        // Page 1 of 3.
        expect(document.querySelectorAll('.pet-row')).toHaveLength(2);
        expect(document.getElementById(ids.pageInfo)?.textContent).toBe('Halaman 1 dari 3');
        expect((document.getElementById(ids.prev) as HTMLButtonElement).disabled).toBe(true);

        // Next page.
        (document.getElementById(ids.next) as HTMLButtonElement).click();
        expect(document.getElementById(ids.pageInfo)?.textContent).toBe('Halaman 2 dari 3');

        // Filter to cats → 2 items, 1 page, page clamps.
        const filter = document.getElementById(ids.filter('kind')) as HTMLSelectElement;
        filter.value = 'cat';
        filter.dispatchEvent(new Event('change'));
        expect(document.querySelectorAll('.pet-row')).toHaveLength(2);
        expect(Array.from(document.querySelectorAll('.pet-row')).map((e) => (e as HTMLElement).dataset.name)).toEqual(['Milo', 'Whiskers']);

        // Search within cats.
        const search = document.getElementById(ids.search) as HTMLInputElement;
        search.value = 'milo';
        search.dispatchEvent(new Event('input'));
        expect(document.querySelectorAll('.pet-row')).toHaveLength(1);
        expect(document.getElementById(ids.results)?.textContent).toBe('Menampilkan 1 dari 1 hasil');
        expect(renders).toBeGreaterThan(1);
    });

    it('supports a custom empty message and emits it when nothing matches', () => {
        const state = mount(10);
        const refresh = () => renderListBody(pets, state, config);
        attachListControls(state, config, refresh);
        refresh();

        const search = document.getElementById(listToolbarIds('pets').search) as HTMLInputElement;
        search.value = 'zzz-no-match';
        search.dispatchEvent(new Event('input'));
        expect(document.getElementById(listToolbarIds('pets').rows)?.textContent).toContain('No pets');
    });

    it('namespaces ids by idPrefix so two lists never collide', () => {
        const a = listToolbarIds('list-a');
        const b = listToolbarIds('list-b');
        expect(a.search).not.toBe(b.search);
        expect(a.rows).not.toBe(b.rows);
    });

    it('attachListControls returns a cleanup that detaches listeners', () => {
        const state = mount(2);
        let renders = 0;
        const dispose = attachListControls(state, config, () => { renders++; });
        const search = document.getElementById(listToolbarIds('pets').search) as HTMLInputElement;
        search.value = 'x';
        search.dispatchEvent(new Event('input'));
        const afterFirst = renders;
        dispose();
        search.value = 'y';
        search.dispatchEvent(new Event('input'));
        expect(renders).toBe(afterFirst); // no further callback after cleanup
    });
});
