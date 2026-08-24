import { showSuccess, showError } from '../toast';
import { PeminjamanApiError } from '../../mahasiswa/peminjaman/api';
import {
    createLaboratory,
    deleteLaboratory,
    listLaboratories,
    updateLaboratory,
} from './api';
import { populateDepartmentSelect } from '../department-select';
import { escapeHtml } from './utils';
import type { LaboratoryOption } from './types';

/**
 * Master Laboratorium surface (SuperAdmin): list/search laboratories, add
 * new ones, rename/recode/reassign department, and hard-delete. Unlike
 * Master Fasilitas, a laboratory has no active/inactive concept — it is
 * either present (Ubah) or gone (Hapus). Deletion is blocked by the backend
 * (409 laboratory_in_use) whenever users (Kepala Lab/Laboran) or rooms are
 * still linked to it; the row's Hapus action reflects that up front by
 * disabling itself with an explanatory tooltip instead of firing a request
 * that is guaranteed to fail.
 *
 * Row actions live behind the same "Kelola" kebab-menu pattern as Master
 * Fasilitas (position:fixed, flips above/below, closes on outside-click /
 * Escape / scroll) for visual and structural consistency across the two
 * master-data surfaces.
 */

const ITEM_BASE = 'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors';

const ICON_PENCIL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
const ICON_TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
const ICON_CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

interface MasterState {
    container: HTMLElement;
    labs: LaboratoryOption[];
    loading: boolean;
    error: string | null;
    search: string;
    busyId: number | null;
}

let state: MasterState | null = null;

const showToast = (text: string, success: boolean): void => {
    if (success) {
        showSuccess(text);
    } else {
        showError(text);
    }
};

const apiMessage = (error: unknown, fallback: string): string => {
    if (error instanceof PeminjamanApiError) {
        const validation = Object.values(error.errors ?? {})[0]?.[0];
        return validation ?? error.message ?? fallback;
    }
    return error instanceof Error ? error.message : fallback;
};

export const renderLaboratoryMaster = async (container: HTMLElement): Promise<void> => {
    state = {
        container,
        labs: [],
        loading: true,
        error: null,
        search: '',
        busyId: null,
    };
    paint();
    await load();
};

const load = async (): Promise<void> => {
    if (!state) return;
    state.loading = true;
    state.error = null;
    paint();
    try {
        state.labs = await listLaboratories();
        state.error = null;
    } catch (error) {
        state.labs = [];
        state.error = apiMessage(error, 'Data laboratorium gagal dimuat.');
    } finally {
        state.loading = false;
        paint();
    }
};

const visibleLabs = (): LaboratoryOption[] => {
    if (!state) return [];
    const query = state.search.trim().toLowerCase();
    if (!query) return state.labs;
    return state.labs.filter((lab) =>
        lab.name.toLowerCase().includes(query)
        || lab.code.toLowerCase().includes(query)
        || (lab.department?.name.toLowerCase().includes(query) ?? false));
};

const paint = (): void => {
    if (!state) return;
    closeLaboratoryMenu();
    const { container } = state;

    container.innerHTML = `
        <div class="space-y-5">
            <section class="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h3 class="text-base font-bold text-gray-800">Master Laboratorium</h3>
                        <p class="mt-1 text-xs text-gray-500">Kelola daftar laboratorium. Data ini dipakai saat menambahkan Kepala Lab/Laboran dan saat membuat Ruangan bertipe Laboratorium.</p>
                    </div>
                    <button id="laboratory-master-open-add" type="button" class="shrink-0 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800">+ Tambah Laboratorium</button>
                </div>
            </section>
            <section class="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm" aria-live="polite">
                <div class="border-b border-gray-100 px-5 py-4">
                    <input id="laboratory-master-search" type="search" maxlength="100" value="${escapeHtml(state.search)}" placeholder="Cari laboratorium..." class="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm sm:max-w-xs">
                </div>
                ${renderTable()}
            </section>
        </div>
    `;

    attachListeners();
};

const renderTable = (): string => {
    if (!state) return '';
    if (state.loading) {
        return `
            <div data-laboratory-master-state="loading" class="px-6 py-16 text-center">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat data laboratorium...</p>
            </div>
        `;
    }
    if (state.error) {
        return `
            <div data-laboratory-master-state="error" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Data laboratorium gagal dimuat</h3>
                <p class="mt-2 text-sm text-gray-500">${escapeHtml(state.error)}</p>
                <button id="laboratory-master-retry" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">Coba Lagi</button>
            </div>
        `;
    }
    const rows = visibleLabs();
    if (rows.length === 0) {
        return `
            <div data-laboratory-master-state="empty" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">${state.search ? 'Laboratorium tidak ditemukan' : 'Belum ada laboratorium'}</h3>
                <p class="mt-2 text-sm text-gray-500">${state.search ? 'Coba kata kunci lain.' : 'Tambahkan laboratorium di atas.'}</p>
            </div>
        `;
    }
    return `
        <div data-laboratory-master-state="success" class="overflow-x-auto">
            <table class="min-w-[720px] w-full text-left">
                <thead class="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <tr>
                        <th class="px-5 py-3">Nama</th>
                        <th class="px-5 py-3">Kode</th>
                        <th class="px-5 py-3">Departemen</th>
                        <th class="px-5 py-3">Jumlah User</th>
                        <th class="px-5 py-3">Jumlah Ruangan</th>
                        <th class="w-[160px] px-5 py-3 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody>${rows.map(renderRow).join('')}</tbody>
            </table>
        </div>
    `;
};

const renderRow = (lab: LaboratoryOption): string => {
    const busy = state?.busyId === lab.id;

    return `
        <tr class="border-b border-gray-100 last:border-0" data-laboratory-row="${lab.id}">
            <td class="px-5 py-3 align-middle"><span class="text-sm font-semibold text-gray-800">${escapeHtml(lab.name)}</span></td>
            <td class="px-5 py-3 align-middle text-sm text-gray-600">${escapeHtml(lab.code)}</td>
            <td class="px-5 py-3 align-middle text-sm text-gray-600">${lab.department ? escapeHtml(lab.department.name) : '<span class="text-gray-400">-</span>'}</td>
            <td class="px-5 py-3 align-middle text-sm text-gray-600">${lab.users_count}</td>
            <td class="px-5 py-3 align-middle text-sm text-gray-600">${lab.rooms_count}</td>
            <td class="w-[160px] px-5 py-3 align-middle">
                <div class="flex justify-end">
                    <button type="button" data-laboratory-menu="${lab.id}" aria-haspopup="menu" aria-expanded="false" ${busy ? 'disabled' : ''} class="inline-flex h-9 min-w-[96px] items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-colors hover:border-teal-600 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50">${busy ? 'Memproses...' : `<span>Kelola</span>${ICON_CHEVRON}`}</button>
                </div>
            </td>
        </tr>
    `;
};

const attachListeners = (): void => {
    if (!state) return;
    const root = state.container;

    root.querySelector('#laboratory-master-retry')?.addEventListener('click', () => void load());

    const search = root.querySelector('#laboratory-master-search') as HTMLInputElement | null;
    search?.addEventListener('input', () => {
        if (!state) return;
        closeLaboratoryMenu();
        state.search = search.value;
        // Repaint only the table to preserve the search input's focus/caret.
        const tableHost = root.querySelector('section:last-child');
        const tableWrap = tableHost?.querySelector('[data-laboratory-master-state]')?.parentElement;
        if (tableWrap) tableWrap.outerHTML = renderTable();
        else paint();
        rebindRowListeners();
    });

    root.querySelector('#laboratory-master-open-add')?.addEventListener('click', () => openAddModal());

    rebindRowListeners();
};

const rebindRowListeners = (): void => {
    if (!state) return;
    const root = state.container;
    root.querySelectorAll<HTMLElement>('[data-laboratory-menu]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            if (button.getAttribute('aria-expanded') === 'true') {
                closeLaboratoryMenu();
                return;
            }
            openLaboratoryMenu(Number(button.dataset.laboratoryMenu), button);
        });
    });
};

const handleAdd = async (payload: { name: string; code: string; department_id: number }): Promise<void> => {
    if (!state) return;
    try {
        await createLaboratory(payload);
        showToast('Laboratorium berhasil ditambahkan.', true);
        await load();
    } catch (error) {
        showToast(apiMessage(error, 'Gagal menambahkan laboratorium.'), false);
    }
};

const handleUpdate = async (id: number, payload: { name: string; code: string; department_id: number }): Promise<void> => {
    if (!state) return;
    state.busyId = id;
    paint();
    try {
        const updated = await updateLaboratory(id, payload);
        state.labs = state.labs.map((lab) => (lab.id === id ? updated : lab));
        showToast('Laboratorium berhasil diperbarui.', true);
    } catch (error) {
        showToast(apiMessage(error, 'Gagal memperbarui laboratorium.'), false);
    } finally {
        if (state) { state.busyId = null; paint(); }
    }
};

const confirmDelete = (id: number): void => {
    const lab = state?.labs.find((l) => l.id === id);
    if (!lab) return;
    openConfirm({
        title: 'Hapus Laboratorium?',
        body: `Laboratorium <strong>${escapeHtml(lab.name)}</strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
        confirmLabel: 'Ya, Hapus',
        confirmTone: 'bg-red-600 hover:bg-red-700',
        onConfirm: () => handleDelete(id),
    });
};

const handleDelete = async (id: number): Promise<void> => {
    if (!state) return;
    state.busyId = id;
    paint();
    try {
        await deleteLaboratory(id);
        showToast('Laboratorium berhasil dihapus.', true);
        state.busyId = null;
        await load();
    } catch (error) {
        // A 409 (laboratory_in_use) can happen if usage changed since the
        // list loaded; surface the backend's Indonesian guidance and refresh.
        showToast(apiMessage(error, 'Gagal menghapus laboratorium.'), false);
        state.busyId = null;
        await load();
    }
};

/**
 * Build the action-menu items for a row. Hapus is disabled (with a tooltip
 * explaining why) whenever the laboratory still has users or rooms linked to
 * it — mirrors the backend's 409 laboratory_in_use guard so the UI never
 * offers an action guaranteed to fail.
 */
const buildMenuItems = (lab: LaboratoryOption): string => {
    const inUse = lab.users_count > 0 || lab.rooms_count > 0;
    const reasons: string[] = [];
    if (lab.users_count > 0) reasons.push(`${lab.users_count} user`);
    if (lab.rooms_count > 0) reasons.push(`${lab.rooms_count} ruangan`);
    const tooltip = inUse
        ? `Tidak dapat dihapus: masih digunakan oleh ${reasons.join(' dan ')}.`
        : '';

    const items = [
        `<button type="button" role="menuitem" data-laboratory-edit="${lab.id}" class="${ITEM_BASE} text-gray-700 hover:bg-gray-50 hover:text-teal-700">${ICON_PENCIL}<span>Ubah</span></button>`,
    ];
    if (inUse) {
        items.push(`<button type="button" role="menuitem" disabled title="${escapeHtml(tooltip)}" aria-disabled="true" class="${ITEM_BASE} cursor-not-allowed text-gray-300">${ICON_TRASH}<span>Hapus</span></button>`);
    } else {
        items.push(`<button type="button" role="menuitem" data-laboratory-delete="${lab.id}" class="${ITEM_BASE} text-red-600 hover:bg-red-50">${ICON_TRASH}<span>Hapus</span></button>`);
    }
    return items.join('');
};

// Document-level listeners that live only while a menu is open, so repeated
// repaints never stack duplicates.
let menuOutsideClick: ((event: MouseEvent) => void) | null = null;
let menuKeydown: ((event: KeyboardEvent) => void) | null = null;
let menuScroll: (() => void) | null = null;

const closeLaboratoryMenu = (): void => {
    document.getElementById('laboratory-action-menu')?.remove();
    state?.container.querySelectorAll('[data-laboratory-menu][aria-expanded="true"]')
        .forEach((button) => button.setAttribute('aria-expanded', 'false'));
    if (menuOutsideClick) { document.removeEventListener('click', menuOutsideClick); menuOutsideClick = null; }
    if (menuKeydown) { document.removeEventListener('keydown', menuKeydown); menuKeydown = null; }
    if (menuScroll) { window.removeEventListener('scroll', menuScroll, true); menuScroll = null; }
};

/**
 * Open the floating action menu for a row, anchored to its trigger. Uses
 * position:fixed so the table's horizontal overflow can't clip it, and flips
 * above the trigger when there isn't room below.
 */
const openLaboratoryMenu = (id: number, trigger: HTMLElement): void => {
    if (!state) return;
    const lab = state.labs.find((item) => item.id === id);
    if (!lab) return;

    closeLaboratoryMenu(); // opening one row's menu closes any other
    trigger.setAttribute('aria-expanded', 'true');

    const menu = document.createElement('div');
    menu.id = 'laboratory-action-menu';
    menu.setAttribute('role', 'menu');
    menu.className = 'fixed z-[220] w-56 rounded-lg border border-gray-100 bg-white p-1.5 text-sm shadow-[0_8px_30px_rgb(0,0,0,0.12)]';
    menu.innerHTML = buildMenuItems(lab);
    state.container.appendChild(menu);

    const rect = trigger.getBoundingClientRect();
    menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    const menuHeight = menu.offsetHeight || 100;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < menuHeight + 8 && rect.top > menuHeight) {
        menu.style.top = 'auto';
        menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
        menu.style.bottom = 'auto';
        menu.style.top = `${rect.bottom + 6}px`;
    }

    const run = (selector: string, action: (id: number) => void): void => {
        menu.querySelector<HTMLElement>(selector)?.addEventListener('click', () => {
            closeLaboratoryMenu();
            action(id);
        });
    };
    run(`[data-laboratory-edit="${id}"]`, (rowId) => openEditModal(rowId));
    run(`[data-laboratory-delete="${id}"]`, (rowId) => confirmDelete(rowId));

    menuOutsideClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        if (!target.closest('#laboratory-action-menu') && !target.closest('[data-laboratory-menu]')) closeLaboratoryMenu();
    };
    menuKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') { closeLaboratoryMenu(); trigger.focus(); }
    };
    menuScroll = (): void => closeLaboratoryMenu();
    document.addEventListener('click', menuOutsideClick);
    document.addEventListener('keydown', menuKeydown);
    window.addEventListener('scroll', menuScroll, true);

    menu.querySelector<HTMLElement>('button:not([disabled])')?.focus();
};

/**
 * Open the Tambah Laboratorium modal (empty fields). Mirrors openEditModal's
 * structure exactly — same dialog chrome, same optimistic close-then-submit
 * flow — so Tambah and Ubah feel like the same surface with different titles.
 */
const openAddModal = (): void => {
    if (!state) return;

    const existing = state.container.querySelector('#laboratory-add-root');
    existing?.remove();

    const root = document.createElement('div');
    root.id = 'laboratory-add-root';
    root.innerHTML = `
        <div data-laboratory-add-overlay class="fixed inset-0 z-[230] bg-black/50"></div>
        <section role="dialog" aria-modal="true" aria-labelledby="laboratory-add-title" class="fixed left-1/2 top-1/2 z-[231] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="laboratory-add-title" class="text-lg font-bold text-gray-900">Tambah Laboratorium</h2>
            <form id="laboratory-add-form" class="mt-4 space-y-3">
                <div class="flex flex-col gap-1">
                    <label for="laboratory-add-name" class="text-xs font-semibold text-gray-500">Nama Laboratorium</label>
                    <input id="laboratory-add-name" maxlength="255" placeholder="Nama laboratorium baru" class="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required>
                </div>
                <div class="flex flex-col gap-1">
                    <label for="laboratory-add-code" class="text-xs font-semibold text-gray-500">Kode</label>
                    <input id="laboratory-add-code" maxlength="100" placeholder="Kode" class="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required>
                </div>
                <div class="flex flex-col gap-1">
                    <label for="laboratory-add-department" class="text-xs font-semibold text-gray-500">Departemen</label>
                    <select id="laboratory-add-department" class="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required>
                        <option value="">Memuat departemen...</option>
                    </select>
                </div>
                <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button id="laboratory-add-cancel" type="button" class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                    <button type="submit" class="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Tambah</button>
                </div>
            </form>
        </section>
    `;
    state.container.appendChild(root);

    const departmentSelect = root.querySelector('#laboratory-add-department') as HTMLSelectElement | null;
    if (departmentSelect) void populateDepartmentSelect(departmentSelect);

    const close = (): void => root.remove();
    root.querySelector('[data-laboratory-add-overlay]')?.addEventListener('click', close);
    root.querySelector('#laboratory-add-cancel')?.addEventListener('click', close);
    root.querySelector('#laboratory-add-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const nameInput = root.querySelector('#laboratory-add-name') as HTMLInputElement | null;
        const codeInput = root.querySelector('#laboratory-add-code') as HTMLInputElement | null;
        const departmentValue = (root.querySelector('#laboratory-add-department') as HTMLSelectElement | null)?.value;

        const name = nameInput?.value.trim() ?? '';
        const code = codeInput?.value.trim() ?? '';
        const departmentId = departmentValue ? Number(departmentValue) : null;

        if (!name || !code || !departmentId) {
            showToast('Nama, kode, dan departemen wajib diisi.', false);
            return;
        }

        close();
        void handleAdd({ name, code, department_id: departmentId });
    });

    (root.querySelector('#laboratory-add-name') as HTMLInputElement | null)?.focus();
};

/**
 * Open the Ubah Laboratorium modal, prefilled with the row's current data.
 * Saving calls handleUpdate; the modal closes immediately (optimistic UX
 * matches the confirm-dialog flow) while the row shows a busy state until
 * the request settles.
 */
const openEditModal = (id: number): void => {
    if (!state) return;
    const lab = state.labs.find((item) => item.id === id);
    if (!lab) return;

    const existing = state.container.querySelector('#laboratory-edit-root');
    existing?.remove();

    const root = document.createElement('div');
    root.id = 'laboratory-edit-root';
    root.innerHTML = `
        <div data-laboratory-edit-overlay class="fixed inset-0 z-[230] bg-black/50"></div>
        <section role="dialog" aria-modal="true" aria-labelledby="laboratory-edit-title" class="fixed left-1/2 top-1/2 z-[231] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="laboratory-edit-title" class="text-lg font-bold text-gray-900">Ubah Laboratorium</h2>
            <form id="laboratory-edit-form" class="mt-4 space-y-3">
                <div class="flex flex-col gap-1">
                    <label for="laboratory-edit-name" class="text-xs font-semibold text-gray-500">Nama Laboratorium</label>
                    <input id="laboratory-edit-name" maxlength="255" value="${escapeHtml(lab.name)}" class="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required>
                </div>
                <div class="flex flex-col gap-1">
                    <label for="laboratory-edit-code" class="text-xs font-semibold text-gray-500">Kode</label>
                    <input id="laboratory-edit-code" maxlength="100" value="${escapeHtml(lab.code)}" class="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required>
                </div>
                <div class="flex flex-col gap-1">
                    <label for="laboratory-edit-department" class="text-xs font-semibold text-gray-500">Departemen</label>
                    <select id="laboratory-edit-department" class="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required>
                        <option value="">Memuat departemen...</option>
                    </select>
                </div>
                <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button id="laboratory-edit-cancel" type="button" class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                    <button type="submit" class="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Simpan</button>
                </div>
            </form>
        </section>
    `;
    state.container.appendChild(root);

    const departmentSelect = root.querySelector('#laboratory-edit-department') as HTMLSelectElement | null;
    if (departmentSelect) void populateDepartmentSelect(departmentSelect, lab.department_id ?? undefined);

    const close = (): void => root.remove();
    root.querySelector('[data-laboratory-edit-overlay]')?.addEventListener('click', close);
    root.querySelector('#laboratory-edit-cancel')?.addEventListener('click', close);
    root.querySelector('#laboratory-edit-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const nameInput = root.querySelector('#laboratory-edit-name') as HTMLInputElement | null;
        const codeInput = root.querySelector('#laboratory-edit-code') as HTMLInputElement | null;
        const departmentValue = (root.querySelector('#laboratory-edit-department') as HTMLSelectElement | null)?.value;

        const name = nameInput?.value.trim() ?? '';
        const code = codeInput?.value.trim() ?? '';
        const departmentId = departmentValue ? Number(departmentValue) : null;

        if (!name || !code || !departmentId) {
            showToast('Nama, kode, dan departemen wajib diisi.', false);
            return;
        }

        close();
        void handleUpdate(id, { name, code, department_id: departmentId });
    });

    (root.querySelector('#laboratory-edit-name') as HTMLInputElement | null)?.focus();
};

interface ConfirmOptions {
    title: string;
    body: string;
    confirmLabel: string;
    confirmTone: string;
    onConfirm: () => void | Promise<void>;
}

const openConfirm = (options: ConfirmOptions): void => {
    if (!state) return;
    const existing = state.container.querySelector('#laboratory-confirm-root');
    existing?.remove();
    const root = document.createElement('div');
    root.id = 'laboratory-confirm-root';
    root.innerHTML = `
        <div data-confirm-overlay class="fixed inset-0 z-[230] bg-black/50"></div>
        <section role="alertdialog" aria-modal="true" aria-labelledby="laboratory-confirm-title" class="fixed left-1/2 top-1/2 z-[231] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="laboratory-confirm-title" class="text-lg font-bold text-gray-900">${escapeHtml(options.title)}</h2>
            <p class="mt-3 text-sm text-gray-600">${options.body}</p>
            <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button id="laboratory-confirm-cancel" type="button" class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                <button id="laboratory-confirm-ok" type="button" class="rounded-xl px-5 py-2.5 text-sm font-bold text-white ${options.confirmTone}">${escapeHtml(options.confirmLabel)}</button>
            </div>
        </section>
    `;
    state.container.appendChild(root);
    const close = (): void => root.remove();
    root.querySelector('[data-confirm-overlay]')?.addEventListener('click', close);
    root.querySelector('#laboratory-confirm-cancel')?.addEventListener('click', close);
    root.querySelector('#laboratory-confirm-ok')?.addEventListener('click', () => {
        close();
        void options.onConfirm();
    });
    root.querySelector<HTMLButtonElement>('#laboratory-confirm-ok')?.focus();
};
