// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    getUsage: vi.fn(),
}));

vi.mock('../api', () => ({
    getFacilityUsage: m.getUsage,
}));

import { openFacilityUsageDrawer, closeFacilityUsageDrawer } from '../facility-usage-drawer';
import type { FacilityTypeOption, FacilityUsage } from '../types';

const flush = async (): Promise<void> => {
    await Promise.resolve(); await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

const projType: FacilityTypeOption = {
    id: 1, name: 'Proyektor', slug: 'proyektor', is_predefined: true, is_active: true, usage_count: 2,
};

const usage = (over: Partial<FacilityUsage> = {}): FacilityUsage => ({
    facility_type: projType,
    summary: { total: 2, classroom: 1, laboratory: 1, other: 0 },
    rooms: [
        { id: 10, code: 'R.301', name: 'Ruang Kuliah 301', type: 'classroom', is_active: true, owning_laboratory: null, quantity: 2, condition: 'baik' },
        { id: 11, code: 'LAB.RPL', name: 'Lab RPL', type: 'laboratory', is_active: true, owning_laboratory: { id: 5, code: 'RPL', name: 'Lab RPL' }, quantity: 1, condition: 'perlu_perbaikan' },
    ],
    ...over,
});

const drawer = (): HTMLElement | null => document.getElementById('facility-usage-drawer-root');

beforeEach(() => {
    document.body.innerHTML = '';
    m.getUsage.mockReset();
});

describe('Facility usage drawer', () => {
    it('renders the header, summary counts, and room rows', async () => {
        m.getUsage.mockResolvedValue(usage());
        await openFacilityUsageDrawer(projType);
        await flush();

        expect(m.getUsage).toHaveBeenCalledWith(1);
        const root = drawer()!;
        expect(root).not.toBeNull();
        // Header: name + status pill + type badge.
        expect(root.querySelector('#facility-usage-title')?.textContent).toContain('Proyektor');
        expect(root.textContent).toContain('Aktif');
        expect(root.textContent).toContain('Bawaan');
        // Summary cards.
        expect(root.querySelector('[data-facility-usage-state="success"]')).not.toBeNull();
        expect(root.textContent).toContain('Total Ruangan');
        expect(root.textContent).toContain('Ruang Kelas');
        expect(root.textContent).toContain('Laboratorium');
        // Room rows.
        expect(root.querySelector('[data-usage-room="10"]')).not.toBeNull();
        expect(root.querySelector('[data-usage-room="11"]')).not.toBeNull();
        expect(root.textContent).toContain('R.301');
        expect(root.textContent).toContain('Lab RPL');
        expect(root.textContent).toContain('Baik');
    });

    it('shows an empty state for an unused facility', async () => {
        m.getUsage.mockResolvedValue(usage({ summary: { total: 0, classroom: 0, laboratory: 0, other: 0 }, rooms: [] }));
        await openFacilityUsageDrawer({ ...projType, usage_count: 0 });
        await flush();

        const root = drawer()!;
        expect(root.querySelector('[data-facility-usage-state="empty"]')).not.toBeNull();
        expect(root.textContent).toContain('Fasilitas ini belum digunakan di ruangan mana pun.');
        expect(root.querySelector('[data-usage-room]')).toBeNull();
    });

    it('renders a retryable error state on load failure, then recovers', async () => {
        m.getUsage.mockRejectedValueOnce(new Error('gagal memuat'));
        await openFacilityUsageDrawer(projType);
        await flush();

        const root = drawer()!;
        expect(root.querySelector('[data-facility-usage-state="error"]')).not.toBeNull();
        expect(root.textContent).toContain('gagal memuat');

        m.getUsage.mockResolvedValueOnce(usage());
        root.querySelector<HTMLElement>('#facility-usage-retry')?.click();
        await flush();
        expect(root.querySelector('[data-facility-usage-state="success"]')).not.toBeNull();
    });

    it('offers Arsipkan for a used facility and delegates to onArchive (drawer closes first)', async () => {
        m.getUsage.mockResolvedValue(usage());
        const onArchive = vi.fn();
        const onDelete = vi.fn();
        await openFacilityUsageDrawer(projType, { onArchive, onDelete });
        await flush();

        const archive = drawer()!.querySelector<HTMLElement>('#facility-usage-archive');
        expect(archive).not.toBeNull();
        expect(drawer()!.querySelector('#facility-usage-delete')).toBeNull();

        archive?.click();
        expect(onArchive).toHaveBeenCalledTimes(1);
        expect(onDelete).not.toHaveBeenCalled();
        expect(drawer()).toBeNull(); // closed before the confirm flow runs
    });

    it('offers Hapus for an unused facility and delegates to onDelete', async () => {
        m.getUsage.mockResolvedValue(usage({ summary: { total: 0, classroom: 0, laboratory: 0, other: 0 }, rooms: [] }));
        const onArchive = vi.fn();
        const onDelete = vi.fn();
        await openFacilityUsageDrawer({ ...projType, usage_count: 0 }, { onArchive, onDelete });
        await flush();

        const del = drawer()!.querySelector<HTMLElement>('#facility-usage-delete');
        expect(del).not.toBeNull();
        expect(drawer()!.querySelector('#facility-usage-archive')).toBeNull();

        del?.click();
        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onArchive).not.toHaveBeenCalled();
        expect(drawer()).toBeNull();
    });

    it('closes via Tutup, the overlay, and Escape', async () => {
        m.getUsage.mockResolvedValue(usage());

        await openFacilityUsageDrawer(projType);
        await flush();
        drawer()!.querySelector<HTMLElement>('#facility-usage-tutup')?.click();
        expect(drawer()).toBeNull();

        await openFacilityUsageDrawer(projType);
        await flush();
        drawer()!.querySelector<HTMLElement>('[data-facility-usage-overlay]')?.click();
        expect(drawer()).toBeNull();

        await openFacilityUsageDrawer(projType);
        await flush();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(drawer()).toBeNull();

        closeFacilityUsageDrawer();
    });

    it('renders a "Kelola Ruangan" CTA per room and delegates to onOpenRoom (drawer closes first)', async () => {
        m.getUsage.mockResolvedValue(usage());
        const onOpenRoom = vi.fn();
        await openFacilityUsageDrawer(projType, { onOpenRoom });
        await flush();

        const root = drawer()!;
        const cta10 = root.querySelector<HTMLElement>('[data-usage-open-room="10"]');
        const cta11 = root.querySelector<HTMLElement>('[data-usage-open-room="11"]');
        expect(cta10).not.toBeNull();
        expect(cta11).not.toBeNull();
        expect(cta10?.textContent).toContain('Kelola Ruangan');

        cta10?.click();
        expect(onOpenRoom).toHaveBeenCalledWith(10);
        expect(drawer()).toBeNull(); // closed before opening the room drawer
    });

    it('omits the room CTA when onOpenRoom is not provided', async () => {
        m.getUsage.mockResolvedValue(usage());
        await openFacilityUsageDrawer(projType);
        await flush();

        expect(drawer()!.querySelector('[data-usage-open-room]')).toBeNull();
        // Data-first row content still renders.
        expect(drawer()!.querySelector('[data-usage-room="10"]')).not.toBeNull();
        closeFacilityUsageDrawer();
    });

    it('filters the room list client-side when searching', async () => {
        // 7 rooms → search box appears (threshold > 6).
        const rooms = Array.from({ length: 7 }, (_, i) => ({
            id: 20 + i, code: `R.${400 + i}`, name: `Ruang ${400 + i}`,
            type: 'classroom' as const, is_active: true, owning_laboratory: null, quantity: 1, condition: 'baik' as const,
        }));
        rooms[0] = { ...rooms[0], code: 'LAB.NET', name: 'Lab Jaringan' };
        m.getUsage.mockResolvedValue(usage({ summary: { total: 7, classroom: 6, laboratory: 1, other: 0 }, rooms }));

        await openFacilityUsageDrawer(projType);
        await flush();

        const root = drawer()!;
        const search = root.querySelector('#facility-usage-search') as HTMLInputElement;
        expect(search).not.toBeNull();
        search.value = 'jaringan';
        search.dispatchEvent(new Event('input'));

        expect(root.textContent).toContain('Lab Jaringan');
        expect(root.textContent).not.toContain('Ruang 401');
    });
});
