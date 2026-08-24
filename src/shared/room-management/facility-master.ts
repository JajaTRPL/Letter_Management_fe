import { showSuccess, showError } from '../toast';
import { PeminjamanApiError } from '../../mahasiswa/peminjaman/api';
import {
    createFacilityType,
    deleteFacilityType,
    listFacilityTypes,
    updateFacilityType,
} from './api';
import { openFacilityUsageDrawer } from './facility-usage-drawer';
import { escapeHtml } from './utils';
import type { FacilityTypeOption } from './types';

/**
 * Master Fasilitas surface (SuperAdmin): list/search facility types, add new
 * ones, rename, archive (deactivate), reactivate, and hard-delete. A type in
 * use can only be archived — deactivation hides it from new room assignments
 * while preserving it on rooms that already use it. An unused active type
 * (bawaan or custom) can be hard-deleted; the backend blocks deleting a type
 * that is in use (409 facility_in_use).
 *
 * Row actions live behind a single compact "Kelola" trigger per row that opens
 * a scoped floating action menu (mirrors the Users-management kebab pattern:
 * position:fixed to escape the table's overflow clipping, flips above/below,
 * closes on outside-click / Escape / scroll). This keeps every row to one
 * fixed-width control so heights and the right edge stay perfectly aligned.
 */

// Menu-item row styling (label + leading icon), toned per action.
const ITEM_BASE = 'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors';

const ICON_PENCIL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
const ICON_CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
const ICON_ARCHIVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>';
const ICON_TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
const ICON_EYE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const ICON_CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

export interface FacilityMasterOptions {
    // Jump from a usage row straight to that room's Kelola Ruangan drawer.
    onOpenRoom?: (roomId: number) => void;
}

interface MasterState {
    container: HTMLElement;
    types: FacilityTypeOption[];
    loading: boolean;
    error: string | null;
    search: string;
    renamingId: number | null;
    busyId: number | null;
    adding: boolean;
    onOpenRoom?: (roomId: number) => void;
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

export const renderFacilityMaster = async (
    container: HTMLElement,
    options: FacilityMasterOptions = {},
): Promise<void> => {
    state = {
        container,
        types: [],
        loading: true,
        error: null,
        search: '',
        renamingId: null,
        busyId: null,
        adding: false,
        onOpenRoom: options.onOpenRoom,
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
        state.types = await listFacilityTypes(false);
        state.error = null;
    } catch (error) {
        state.types = [];
        state.error = apiMessage(error, 'Data fasilitas gagal dimuat.');
    } finally {
        state.loading = false;
        paint();
    }
};

const visibleTypes = (): FacilityTypeOption[] => {
    if (!state) return [];
    const query = state.search.trim().toLowerCase();
    if (!query) return state.types;
    return state.types.filter((type) => type.name.toLowerCase().includes(query));
};

const paint = (): void => {
    if (!state) return;
    closeFacilityMenu();
    const { container } = state;

    container.innerHTML = `
        <div class="space-y-5">
            <section class="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h3 class="text-base font-bold text-gray-800">Master Fasilitas</h3>
                        <p class="mt-1 text-xs text-gray-500">Kelola daftar jenis fasilitas ruangan. Fasilitas nonaktif tetap tercatat pada ruangan yang sudah memakainya, tetapi tidak muncul saat menambah fasilitas baru.</p>
                    </div>
                </div>
                <form id="facility-master-add" class="mt-4 flex flex-wrap items-center gap-2">
                    <input id="facility-master-new-name" maxlength="100" placeholder="Nama fasilitas baru" class="min-w-[220px] flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm" ${state.adding ? 'disabled' : ''}>
                    <button type="submit" ${state.adding ? 'disabled' : ''} class="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60">${state.adding ? 'Menambahkan...' : 'Tambah Fasilitas'}</button>
                </form>
            </section>
            <section class="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm" aria-live="polite">
                <div class="border-b border-gray-100 px-5 py-4">
                    <input id="facility-master-search" type="search" maxlength="100" value="${escapeHtml(state.search)}" placeholder="Cari fasilitas..." class="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm sm:max-w-xs">
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
            <div data-facility-master-state="loading" class="px-6 py-16 text-center">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat data fasilitas...</p>
            </div>
        `;
    }
    if (state.error) {
        return `
            <div data-facility-master-state="error" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Data fasilitas gagal dimuat</h3>
                <p class="mt-2 text-sm text-gray-500">${escapeHtml(state.error)}</p>
                <button id="facility-master-retry" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">Coba Lagi</button>
            </div>
        `;
    }
    const rows = visibleTypes();
    if (rows.length === 0) {
        return `
            <div data-facility-master-state="empty" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">${state.search ? 'Fasilitas tidak ditemukan' : 'Belum ada fasilitas'}</h3>
                <p class="mt-2 text-sm text-gray-500">${state.search ? 'Coba kata kunci lain.' : 'Tambahkan jenis fasilitas di atas.'}</p>
            </div>
        `;
    }
    return `
        <div data-facility-master-state="success" class="overflow-x-auto">
            <table class="min-w-[640px] w-full text-left">
                <thead class="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <tr>
                        <th class="px-5 py-3">Nama</th>
                        <th class="px-5 py-3">Jenis</th>
                        <th class="px-5 py-3">Digunakan</th>
                        <th class="px-5 py-3">Status</th>
                        <th class="w-[160px] px-5 py-3 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody>${rows.map(renderRow).join('')}</tbody>
            </table>
        </div>
    `;
};

const renderRow = (type: FacilityTypeOption): string => {
    const active = type.is_active !== false;
    const usage = type.usage_count ?? 0;
    const renaming = state?.renamingId === type.id;
    const busy = state?.busyId === type.id;

    return `
        <tr class="border-b border-gray-100 last:border-0" data-facility-type-row="${type.id}">
            <td class="px-5 py-3 align-middle">
                ${renaming ? `
                    <div class="flex items-center gap-2">
                        <input data-facility-rename-input="${type.id}" maxlength="100" value="${escapeHtml(type.name)}" class="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                        <button type="button" data-facility-rename-save="${type.id}" class="rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-bold text-white">Simpan</button>
                        <button type="button" data-facility-rename-cancel="${type.id}" class="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-600">Batal</button>
                    </div>
                ` : `<span class="text-sm font-semibold text-gray-800">${escapeHtml(type.name)}</span>`}
            </td>
            <td class="px-5 py-3 align-middle text-xs font-semibold ${type.is_predefined ? 'text-gray-500' : 'text-teal-700'}">${type.is_predefined ? 'Bawaan' : 'Kustom'}</td>
            <td class="px-5 py-3 align-middle text-sm text-gray-600">${usage > 0
                ? `<button type="button" data-facility-usage-shortcut="${type.id}" class="rounded font-semibold text-teal-700 underline decoration-teal-200 underline-offset-2 hover:decoration-teal-500">${usage} ruangan</button>`
                : '<span class="text-gray-400">Belum digunakan</span>'}</td>
            <td class="px-5 py-3 align-middle">
                <span class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-500'}">${active ? 'Aktif' : 'Nonaktif'}</span>
            </td>
            <td class="w-[160px] px-5 py-3 align-middle">
                ${renaming ? '' : `
                    <div class="flex justify-end">
                        <button type="button" data-facility-menu="${type.id}" aria-haspopup="menu" aria-expanded="false" ${busy ? 'disabled' : ''} class="inline-flex h-9 min-w-[96px] items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-colors hover:border-teal-600 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50">${busy ? 'Memproses...' : `<span>Kelola</span>${ICON_CHEVRON}`}</button>
                    </div>
                `}
            </td>
        </tr>
    `;
};

const attachListeners = (): void => {
    if (!state) return;
    const root = state.container;

    root.querySelector('#facility-master-retry')?.addEventListener('click', () => void load());

    const search = root.querySelector('#facility-master-search') as HTMLInputElement | null;
    search?.addEventListener('input', () => {
        if (!state) return;
        closeFacilityMenu();
        state.search = search.value;
        // Repaint only the table to preserve the search input's focus/caret.
        const tableHost = root.querySelector('section:last-child');
        const tableWrap = tableHost?.querySelector('[data-facility-master-state]')?.parentElement;
        if (tableWrap) tableWrap.outerHTML = renderTable();
        else paint();
        rebindRowListeners();
    });

    root.querySelector('#facility-master-add')?.addEventListener('submit', (event) => {
        event.preventDefault();
        void handleAdd();
    });

    rebindRowListeners();
};

const rebindRowListeners = (): void => {
    if (!state) return;
    const root = state.container;
    // One visible control per row: the "Kelola" trigger. Its menu items
    // (usage/rename/activate/archive/delete) are wired in openFacilityMenu.
    root.querySelectorAll<HTMLElement>('[data-facility-menu]').forEach((button) => {
        button.addEventListener('click', (event) => {
            // stopPropagation keeps this click from reaching the outside-click
            // handler, so the toggle below is the single source of truth.
            event.stopPropagation();
            // Toggle: clicking the already-open row's trigger closes its menu.
            if (button.getAttribute('aria-expanded') === 'true') {
                closeFacilityMenu();
                return;
            }
            openFacilityMenu(Number(button.dataset.facilityMenu), button);
        });
    });
    // Clickable usage count → shortcut into the usage drawer.
    root.querySelectorAll<HTMLElement>('[data-facility-usage-shortcut]').forEach((button) => {
        button.addEventListener('click', () => openUsage(Number(button.dataset.facilityUsageShortcut)));
    });
    // Inline rename editor (lives in the Nama cell, not the action menu).
    root.querySelectorAll<HTMLElement>('[data-facility-rename-cancel]').forEach((button) => {
        button.addEventListener('click', () => {
            if (!state) return;
            state.renamingId = null;
            paint();
        });
    });
    root.querySelectorAll<HTMLElement>('[data-facility-rename-save]').forEach((button) => {
        button.addEventListener('click', () => void handleRename(Number(button.dataset.facilityRenameSave)));
    });
};

const handleAdd = async (): Promise<void> => {
    if (!state || state.adding) return;
    const input = state.container.querySelector('#facility-master-new-name') as HTMLInputElement | null;
    const name = input?.value.trim() ?? '';
    if (name.length < 2) {
        showToast('Nama fasilitas minimal 2 karakter.', false);
        return;
    }
    state.adding = true;
    paint();
    try {
        await createFacilityType(name);
        showToast('Fasilitas berhasil ditambahkan.', true);
        state.adding = false;
        await load();
    } catch (error) {
        state.adding = false;
        showToast(apiMessage(error, 'Gagal menambahkan fasilitas.'), false);
        paint();
    }
};

const handleRename = async (id: number): Promise<void> => {
    if (!state) return;
    const input = state.container.querySelector(`[data-facility-rename-input="${id}"]`) as HTMLInputElement | null;
    const name = input?.value.trim() ?? '';
    if (name.length < 2) {
        showToast('Nama fasilitas minimal 2 karakter.', false);
        return;
    }
    state.busyId = id;
    try {
        const updated = await updateFacilityType(id, { name });
        state.types = state.types.map((type) => (type.id === id ? updated : type));
        showToast('Nama fasilitas berhasil diperbarui.', true);
    } catch (error) {
        showToast(apiMessage(error, 'Gagal memperbarui fasilitas.'), false);
    } finally {
        if (state) { state.busyId = null; state.renamingId = null; paint(); }
    }
};

/** Reactivate (or, via confirm flows, archive) a facility type. */
const setActive = async (id: number, nextActive: boolean): Promise<void> => {
    if (!state) return;
    state.busyId = id;
    paint();
    try {
        const updated = await updateFacilityType(id, { is_active: nextActive });
        state.types = state.types.map((type) => (type.id === id ? updated : type));
        showToast(nextActive ? 'Fasilitas diaktifkan.' : 'Fasilitas diarsipkan.', true);
    } catch (error) {
        showToast(apiMessage(error, 'Gagal memperbarui status fasilitas.'), false);
    } finally {
        if (state) { state.busyId = null; paint(); }
    }
};

const confirmArchive = (id: number): void => {
    const type = state?.types.find((t) => t.id === id);
    if (!type) return;
    openConfirm({
        title: 'Arsipkan Fasilitas?',
        body: `Fasilitas <strong>${escapeHtml(type.name)}</strong> sedang digunakan oleh ${type.usage_count ?? 0} ruangan. `
            + 'Mengarsipkan hanya menyembunyikannya dari pilihan fasilitas baru. Data ruangan yang sudah memakainya tetap tercatat.',
        confirmLabel: 'Ya, Arsipkan',
        confirmTone: 'bg-gray-700 hover:bg-gray-800',
        onConfirm: () => setActive(id, false),
    });
};

const confirmDelete = (id: number): void => {
    const type = state?.types.find((t) => t.id === id);
    if (!type) return;
    openConfirm({
        title: 'Hapus Fasilitas?',
        body: `Fasilitas <strong>${escapeHtml(type.name)}</strong> belum digunakan oleh ruangan mana pun dan akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
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
        await deleteFacilityType(id);
        showToast('Fasilitas berhasil dihapus.', true);
        state.busyId = null;
        await load();
    } catch (error) {
        // A 409 (facility_in_use) can happen if usage changed since the list
        // loaded; surface the backend's Indonesian guidance and refresh.
        showToast(apiMessage(error, 'Gagal menghapus fasilitas.'), false);
        state.busyId = null;
        await load();
    }
};

/**
 * Build the action-menu items for a row. Only the actions relevant to the
 * row's state are offered:
 *   active + used   → Ubah Nama, Arsipkan
 *   active + unused → Ubah Nama, Hapus
 *   inactive        → Ubah Nama, Aktifkan  (reactivate first to delete)
 */
const buildMenuItems = (type: FacilityTypeOption): string => {
    const active = type.is_active !== false;
    const usage = type.usage_count ?? 0;
    const items = [
        `<button type="button" role="menuitem" data-facility-usage="${type.id}" class="${ITEM_BASE} text-gray-700 hover:bg-gray-50 hover:text-teal-700">${ICON_EYE}<span>Lihat Penggunaan</span></button>`,
        `<button type="button" role="menuitem" data-facility-rename="${type.id}" class="${ITEM_BASE} text-gray-700 hover:bg-gray-50 hover:text-teal-700">${ICON_PENCIL}<span>Ubah Nama</span></button>`,
    ];
    if (!active) {
        items.push(`<button type="button" role="menuitem" data-facility-activate="${type.id}" class="${ITEM_BASE} text-teal-700 hover:bg-teal-50">${ICON_CHECK}<span>Aktifkan</span></button>`);
    } else if (usage > 0) {
        items.push(`<button type="button" role="menuitem" data-facility-archive="${type.id}" class="${ITEM_BASE} text-amber-700 hover:bg-amber-50">${ICON_ARCHIVE}<span>Arsipkan</span></button>`);
    } else {
        items.push('<div class="my-1 h-px bg-gray-100"></div>');
        items.push(`<button type="button" role="menuitem" data-facility-delete="${type.id}" class="${ITEM_BASE} text-red-600 hover:bg-red-50">${ICON_TRASH}<span>Hapus</span></button>`);
    }
    return items.join('');
};

// Document-level listeners that live only while a menu is open, so repeated
// repaints never stack duplicates.
let menuOutsideClick: ((event: MouseEvent) => void) | null = null;
let menuKeydown: ((event: KeyboardEvent) => void) | null = null;
let menuScroll: (() => void) | null = null;

const closeFacilityMenu = (): void => {
    document.getElementById('facility-action-menu')?.remove();
    state?.container.querySelectorAll('[data-facility-menu][aria-expanded="true"]')
        .forEach((button) => button.setAttribute('aria-expanded', 'false'));
    if (menuOutsideClick) { document.removeEventListener('click', menuOutsideClick); menuOutsideClick = null; }
    if (menuKeydown) { document.removeEventListener('keydown', menuKeydown); menuKeydown = null; }
    if (menuScroll) { window.removeEventListener('scroll', menuScroll, true); menuScroll = null; }
};

/**
 * Open the floating action menu for a row, anchored to its trigger. Uses
 * position:fixed so the table's horizontal overflow can't clip it, and flips
 * above the trigger when there isn't room below. Selecting any item closes the
 * menu before running the action, so it never overlaps a confirm modal.
 */
const openFacilityMenu = (id: number, trigger: HTMLElement): void => {
    if (!state) return;
    const type = state.types.find((item) => item.id === id);
    if (!type) return;

    closeFacilityMenu(); // opening one row's menu closes any other
    trigger.setAttribute('aria-expanded', 'true');

    const menu = document.createElement('div');
    menu.id = 'facility-action-menu';
    menu.setAttribute('role', 'menu');
    menu.className = 'fixed z-[220] w-52 rounded-lg border border-gray-100 bg-white p-1.5 text-sm shadow-[0_8px_30px_rgb(0,0,0,0.12)]';
    menu.innerHTML = buildMenuItems(type);
    state.container.appendChild(menu);

    // Anchor: right-aligned to the trigger; open below unless it would overflow.
    const rect = trigger.getBoundingClientRect();
    menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    const menuHeight = menu.offsetHeight || 160;
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
            closeFacilityMenu();
            action(id);
        });
    };
    run(`[data-facility-usage="${id}"]`, (rowId) => openUsage(rowId));
    run(`[data-facility-rename="${id}"]`, (rowId) => { if (state) { state.renamingId = rowId; paint(); } });
    run(`[data-facility-activate="${id}"]`, (rowId) => void setActive(rowId, true));
    run(`[data-facility-archive="${id}"]`, (rowId) => confirmArchive(rowId));
    run(`[data-facility-delete="${id}"]`, (rowId) => confirmDelete(rowId));

    menuOutsideClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        if (!target.closest('#facility-action-menu') && !target.closest('[data-facility-menu]')) closeFacilityMenu();
    };
    menuKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') { closeFacilityMenu(); trigger.focus(); }
    };
    menuScroll = (): void => closeFacilityMenu();
    document.addEventListener('click', menuOutsideClick);
    document.addEventListener('keydown', menuKeydown);
    window.addEventListener('scroll', menuScroll, true);

    menu.querySelector<HTMLElement>('button')?.focus();
};

/**
 * Open the "Lihat Penggunaan" drawer for a type. Its contextual footer actions
 * delegate back to the same archive/delete confirmation flow used by the table.
 */
const openUsage = (id: number): void => {
    const type = state?.types.find((item) => item.id === id);
    if (!type) return;
    void openFacilityUsageDrawer(type, {
        onArchive: () => confirmArchive(id),
        onDelete: () => confirmDelete(id),
        onOpenRoom: state?.onOpenRoom,
    });
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
    const existing = state.container.querySelector('#facility-confirm-root');
    existing?.remove();
    const root = document.createElement('div');
    root.id = 'facility-confirm-root';
    root.innerHTML = `
        <div data-confirm-overlay class="fixed inset-0 z-[230] bg-black/50"></div>
        <section role="alertdialog" aria-modal="true" aria-labelledby="facility-confirm-title" class="fixed left-1/2 top-1/2 z-[231] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="facility-confirm-title" class="text-lg font-bold text-gray-900">${escapeHtml(options.title)}</h2>
            <p class="mt-3 text-sm text-gray-600">${options.body}</p>
            <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button id="facility-confirm-cancel" type="button" class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                <button id="facility-confirm-ok" type="button" class="rounded-xl px-5 py-2.5 text-sm font-bold text-white ${options.confirmTone}">${escapeHtml(options.confirmLabel)}</button>
            </div>
        </section>
    `;
    state.container.appendChild(root);
    const close = (): void => root.remove();
    root.querySelector('[data-confirm-overlay]')?.addEventListener('click', close);
    root.querySelector('#facility-confirm-cancel')?.addEventListener('click', close);
    root.querySelector('#facility-confirm-ok')?.addEventListener('click', () => {
        close();
        void options.onConfirm();
    });
    root.querySelector<HTMLButtonElement>('#facility-confirm-ok')?.focus();
};
