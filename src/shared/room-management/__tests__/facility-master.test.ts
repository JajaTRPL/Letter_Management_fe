// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    listTypes: vi.fn(),
    createType: vi.fn(),
    updateType: vi.fn(),
    deleteType: vi.fn(),
    openUsage: vi.fn(),
    toasts: [] as string[],
}));

vi.mock('../api', () => ({
    listFacilityTypes: m.listTypes,
    createFacilityType: m.createType,
    updateFacilityType: m.updateType,
    deleteFacilityType: m.deleteType,
}));

// The usage drawer lives in its own module (tested separately); here we only
// assert the wiring calls it with the right type + confirm callbacks.
vi.mock('../facility-usage-drawer', () => ({
    openFacilityUsageDrawer: m.openUsage,
}));

vi.mock('toastify-js', () => ({
    default: vi.fn((options: { text: string }) => ({ showToast: () => m.toasts.push(options.text) })),
}));

// facility-master.ts now routes through the shared toast wrapper instead of
// calling Toastify directly; re-route it back into the same `m.toasts` array.
vi.mock('../../toast', () => ({
    showSuccess: (text: string) => m.toasts.push(text),
    showError: (text: string) => m.toasts.push(text),
    showWarning: (text: string) => m.toasts.push(text),
    showInfo: (text: string) => m.toasts.push(text),
}));

import { renderFacilityMaster } from '../facility-master';
import type { FacilityTypeOption } from '../types';

const type = (over: Partial<FacilityTypeOption> = {}): FacilityTypeOption => ({
    id: 1, name: 'Proyektor', slug: 'proyektor', is_predefined: true, is_active: true, usage_count: 3, ...over,
});

const flush = async (): Promise<void> => {
    await Promise.resolve(); await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

let host: HTMLElement;

// Row actions live behind a per-row "Kelola" trigger; open its menu first.
const openMenu = (id: number): void => {
    host.querySelector<HTMLElement>(`[data-facility-menu="${id}"]`)?.click();
};

beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
    host = document.getElementById('host')!;
    m.listTypes.mockReset();
    m.createType.mockReset();
    m.updateType.mockReset();
    m.deleteType.mockReset();
    m.openUsage.mockReset();
    m.toasts = [];
    m.listTypes.mockResolvedValue([
        type(), // id 1: active, used (usage 3) → Arsipkan
        type({ id: 2, name: 'Smart TV', slug: 'smart_tv', is_predefined: false, is_active: false, usage_count: 0 }), // inactive, unused → Aktifkan + Hapus
        type({ id: 3, name: 'Kamera', slug: 'kamera', is_predefined: false, is_active: true, usage_count: 0 }), // active, unused → Hapus
    ]);
});

describe('Master Fasilitas', () => {
    it('lists facility types with jenis, usage count, and status', async () => {
        await renderFacilityMaster(host);
        await flush();

        expect(m.listTypes).toHaveBeenCalledWith(false); // all types, not active-only
        expect(host.querySelector('[data-facility-master-state="success"]')).not.toBeNull();
        expect(host.textContent).toContain('Proyektor');
        expect(host.textContent).toContain('Bawaan');
        expect(host.textContent).toContain('Kustom');
        expect(host.textContent).toContain('3 ruangan');
        expect(host.textContent).toContain('Aktif');
        expect(host.textContent).toContain('Nonaktif');
    });

    it('searches by name client-side', async () => {
        await renderFacilityMaster(host);
        await flush();

        const search = host.querySelector('#facility-master-search') as HTMLInputElement;
        search.value = 'smart';
        search.dispatchEvent(new Event('input'));
        await flush();

        expect(host.textContent).toContain('Smart TV');
        expect(host.textContent).not.toContain('Proyektor');
    });

    it('adds a new facility type', async () => {
        m.createType.mockResolvedValue(type({ id: 3, name: 'Kamera', slug: 'kamera' }));
        await renderFacilityMaster(host);
        await flush();

        (host.querySelector('#facility-master-new-name') as HTMLInputElement).value = 'Kamera';
        host.querySelector('#facility-master-add')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flush();

        expect(m.createType).toHaveBeenCalledWith('Kamera');
        expect(m.toasts).toContain('Fasilitas berhasil ditambahkan.');
    });

    it('renders exactly one action trigger per row; actions stay in the menu', async () => {
        await renderFacilityMaster(host);
        await flush();

        // One visible control per row, no inline action buttons until opened.
        expect(host.querySelectorAll('[data-facility-menu]').length).toBe(3);
        expect(host.querySelector('[data-facility-archive]')).toBeNull();
        expect(host.querySelector('[data-facility-delete]')).toBeNull();
        expect(host.querySelector('[data-facility-activate]')).toBeNull();
        expect(host.querySelector('#facility-action-menu')).toBeNull();
        expect(host.textContent).toContain('Kelola');
    });

    it('shows usage-aware menu actions: Hapus for unused, Arsipkan for used', async () => {
        await renderFacilityMaster(host);
        await flush();

        // id 1 active + used → Arsipkan, no Hapus.
        openMenu(1);
        expect(host.querySelector('[data-facility-archive="1"]')).not.toBeNull();
        expect(host.querySelector('[data-facility-delete="1"]')).toBeNull();
        // id 3 active + unused → Hapus, no Arsipkan.
        openMenu(3);
        expect(host.querySelector('[data-facility-delete="3"]')).not.toBeNull();
        expect(host.querySelector('[data-facility-archive="3"]')).toBeNull();
        // id 2 inactive → Aktifkan only (reactivate first to delete).
        openMenu(2);
        expect(host.querySelector('[data-facility-activate="2"]')).not.toBeNull();
        expect(host.querySelector('[data-facility-delete="2"]')).toBeNull();
    });

    it('closes the action menu on Escape and on outside click', async () => {
        await renderFacilityMaster(host);
        await flush();

        openMenu(3);
        expect(host.querySelector('#facility-action-menu')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(host.querySelector('#facility-action-menu')).toBeNull();

        openMenu(3);
        expect(host.querySelector('#facility-action-menu')).not.toBeNull();
        document.body.click();
        expect(host.querySelector('#facility-action-menu')).toBeNull();
    });

    it('toggles the menu closed when the same Kelola trigger is clicked again', async () => {
        await renderFacilityMaster(host);
        await flush();

        const trigger = () => host.querySelector('[data-facility-menu="1"]');
        openMenu(1);
        expect(host.querySelector('#facility-action-menu')).not.toBeNull();
        expect(trigger()?.getAttribute('aria-expanded')).toBe('true');

        openMenu(1); // same trigger again → closes
        expect(host.querySelector('#facility-action-menu')).toBeNull();
        expect(trigger()?.getAttribute('aria-expanded')).toBe('false');

        openMenu(1); // and re-opens on a third click
        expect(host.querySelector('#facility-action-menu')).not.toBeNull();
        expect(trigger()?.getAttribute('aria-expanded')).toBe('true');
    });

    it('switches the open menu when a different Kelola trigger is clicked', async () => {
        await renderFacilityMaster(host);
        await flush();

        openMenu(1);
        expect(host.querySelector('[data-facility-menu="1"]')?.getAttribute('aria-expanded')).toBe('true');

        openMenu(3);
        // Only one menu is ever open; ARIA moves to the new row.
        expect(host.querySelectorAll('#facility-action-menu').length).toBe(1);
        expect(host.querySelector('[data-facility-menu="1"]')?.getAttribute('aria-expanded')).toBe('false');
        expect(host.querySelector('[data-facility-menu="3"]')?.getAttribute('aria-expanded')).toBe('true');
        // The open menu belongs to row 3 (unused → Hapus item present).
        expect(host.querySelector('[data-facility-delete="3"]')).not.toBeNull();
    });

    it('menu shows "Lihat Penggunaan" and opens the usage drawer with confirm callbacks', async () => {
        await renderFacilityMaster(host);
        await flush();

        openMenu(1);
        const usageItem = host.querySelector<HTMLElement>('[data-facility-usage="1"]');
        expect(usageItem).not.toBeNull();
        expect(usageItem?.textContent).toContain('Lihat Penggunaan');

        usageItem?.click();
        await flush();

        expect(m.openUsage).toHaveBeenCalledTimes(1);
        const [passedType, options] = m.openUsage.mock.calls[0];
        expect(passedType.id).toBe(1);
        expect(typeof options.onArchive).toBe('function');
        expect(typeof options.onDelete).toBe('function');
    });

    it('threads the onOpenRoom callback through to the usage drawer', async () => {
        const onOpenRoom = vi.fn();
        await renderFacilityMaster(host, { onOpenRoom });
        await flush();

        openMenu(1);
        host.querySelector<HTMLElement>('[data-facility-usage="1"]')?.click();
        await flush();

        const options = m.openUsage.mock.calls[0][1];
        expect(typeof options.onOpenRoom).toBe('function');
        options.onOpenRoom(99);
        expect(onOpenRoom).toHaveBeenCalledWith(99);
    });

    it('exposes the usage count as a shortcut into the drawer (only when used)', async () => {
        await renderFacilityMaster(host);
        await flush();

        // id 1 used (3) → clickable shortcut; id 3 unused → plain "Belum digunakan".
        const shortcut = host.querySelector<HTMLElement>('[data-facility-usage-shortcut="1"]');
        expect(shortcut).not.toBeNull();
        expect(host.querySelector('[data-facility-usage-shortcut="3"]')).toBeNull();
        expect(host.textContent).toContain('Belum digunakan');

        shortcut?.click();
        await flush();
        expect(m.openUsage).toHaveBeenCalledTimes(1);
        expect(m.openUsage.mock.calls[0][0].id).toBe(1);
    });

    it('reactivates an archived type', async () => {
        m.updateType.mockResolvedValue(type({ id: 2, name: 'Smart TV', slug: 'smart_tv', is_predefined: false, is_active: true }));
        await renderFacilityMaster(host);
        await flush();

        openMenu(2);
        host.querySelector<HTMLElement>('[data-facility-activate="2"]')?.click();
        await flush();

        expect(m.updateType).toHaveBeenCalledWith(2, { is_active: true });
        expect(m.toasts).toContain('Fasilitas diaktifkan.');
    });

    it('archives a used facility via a confirm dialog (data preserved)', async () => {
        m.updateType.mockResolvedValue(type({ id: 1, is_active: false }));
        await renderFacilityMaster(host);
        await flush();

        openMenu(1);
        host.querySelector<HTMLElement>('[data-facility-archive="1"]')?.click();
        await flush();
        // Confirm dialog explains data stays recorded.
        expect(host.querySelector('#facility-confirm-root')?.textContent).toContain('Arsipkan Fasilitas?');
        expect(host.querySelector('#facility-confirm-root')?.textContent).toContain('tetap tercatat');

        host.querySelector<HTMLElement>('#facility-confirm-ok')?.click();
        await flush();

        expect(m.updateType).toHaveBeenCalledWith(1, { is_active: false });
        expect(m.toasts).toContain('Fasilitas diarsipkan.');
    });

    it('hard-deletes an unused facility via a confirm dialog', async () => {
        m.deleteType.mockResolvedValue(undefined);
        await renderFacilityMaster(host);
        await flush();

        openMenu(3);
        host.querySelector<HTMLElement>('[data-facility-delete="3"]')?.click();
        await flush();
        expect(host.querySelector('#facility-confirm-root')?.textContent).toContain('Hapus Fasilitas?');

        host.querySelector<HTMLElement>('#facility-confirm-ok')?.click();
        await flush();

        expect(m.deleteType).toHaveBeenCalledWith(3);
        expect(m.toasts).toContain('Fasilitas berhasil dihapus.');
    });

    it('cancelling the confirm dialog performs no action', async () => {
        await renderFacilityMaster(host);
        await flush();

        openMenu(3);
        host.querySelector<HTMLElement>('[data-facility-delete="3"]')?.click();
        await flush();
        host.querySelector<HTMLElement>('#facility-confirm-cancel')?.click();
        await flush();

        expect(m.deleteType).not.toHaveBeenCalled();
        expect(host.querySelector('#facility-confirm-root')).toBeNull();
    });

    it('renames a facility type inline', async () => {
        m.updateType.mockResolvedValue(type({ id: 1, name: 'Proyektor HD', slug: 'proyektor_hd' }));
        await renderFacilityMaster(host);
        await flush();

        openMenu(1);
        host.querySelector<HTMLElement>('[data-facility-rename="1"]')?.click();
        (host.querySelector('[data-facility-rename-input="1"]') as HTMLInputElement).value = 'Proyektor HD';
        host.querySelector<HTMLElement>('[data-facility-rename-save="1"]')?.click();
        await flush();

        expect(m.updateType).toHaveBeenCalledWith(1, { name: 'Proyektor HD' });
        expect(m.toasts).toContain('Nama fasilitas berhasil diperbarui.');
    });

    it('renders a retryable error state on load failure', async () => {
        m.listTypes.mockRejectedValueOnce(new Error('gagal'));
        await renderFacilityMaster(host);
        await flush();

        expect(host.querySelector('[data-facility-master-state="error"]')).not.toBeNull();
        expect(host.querySelector('#facility-master-retry')).not.toBeNull();
    });
});
