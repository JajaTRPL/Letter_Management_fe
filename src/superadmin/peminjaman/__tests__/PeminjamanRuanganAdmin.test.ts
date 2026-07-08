// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    getLabs: vi.fn(),
    getBookings: vi.fn(),
    getCalendar: vi.fn(),
    getBooking: vi.fn(),
    downloadSurat: vi.fn(),
    attachViewer: vi.fn(() => () => {}),
    renderLayout: vi.fn(),
    // shared room-management api
    listRooms: vi.fn(),
    bulkDelete: vi.fn(),
    getRoom: vi.fn(),
    createRoom: vi.fn(),
    updateRoom: vi.fn(),
    activateRoom: vi.fn(),
    deactivateRoom: vi.fn(),
    listPhotos: vi.fn(),
    listFacilities: vi.fn(),
    listFacilityTypes: vi.fn(),
    getFacilityUsage: vi.fn(),
    listTemplates: vi.fn(),
    listAudit: vi.fn(),
    fetchPhoto: vi.fn(),
    toasts: [] as string[],
}));

vi.mock('../../../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: (title: string, content: string, role: string, activePage: string) => {
        m.renderLayout(title, content, role, activePage);
        document.body.innerHTML = content;
    },
}));

vi.mock('../../../mahasiswa/peminjaman/api', () => {
    class MockPeminjamanApiError extends Error {
        readonly status: number;
        readonly code?: string;
        readonly errors?: Record<string, string[]>;
        constructor(message: string, status: number, code?: string, errors?: Record<string, string[]>) {
            super(message);
            this.status = status;
            this.code = code;
            this.errors = errors;
        }
    }
    return {
        getSuperAdminLaboratories: m.getLabs,
        getSuperAdminBookings: m.getBookings,
        getSuperAdminBookingCalendar: m.getCalendar,
        getSuperAdminBooking: m.getBooking,
        downloadSuratPeminjamanPdf: m.downloadSurat,
        // transitive requester exports pulled via shared booking modules
        getMahasiswaBooking: vi.fn(),
        getPeminjamanRooms: vi.fn(),
        createMahasiswaBooking: vi.fn(),
        updateMahasiswaBooking: vi.fn(),
        cancelMahasiswaBooking: vi.fn(),
        resubmitMahasiswaBooking: vi.fn(),
        replaceSuratPeminjamanPdf: vi.fn(),
        suratPeminjamanPreviewUrl: (id: number) =>
            `/api/peminjaman-ruangan/${id}/attachment/surat-peminjaman/preview`,
        PeminjamanApiError: MockPeminjamanApiError,
    };
});

vi.mock('../../../shared/room-management/api', () => ({
    listManagedRooms: m.listRooms,
    bulkDeleteRooms: m.bulkDelete,
    getManagedRoom: m.getRoom,
    createManagedRoom: m.createRoom,
    updateManagedRoom: m.updateRoom,
    activateManagedRoom: m.activateRoom,
    deactivateManagedRoom: m.deactivateRoom,
    listRoomPhotos: m.listPhotos,
    uploadRoomPhoto: vi.fn(),
    deleteRoomPhoto: vi.fn(),
    setRoomCover: vi.fn(),
    reorderRoomPhotos: vi.fn(),
    fetchRoomPhotoObjectUrl: m.fetchPhoto,
    listFacilityTypes: m.listFacilityTypes,
    createFacilityType: vi.fn(),
    updateFacilityType: vi.fn(),
    deleteFacilityType: vi.fn(),
    getFacilityUsage: m.getFacilityUsage,
    getRoomFacilities: m.listFacilities,
    syncRoomFacilities: vi.fn(),
    listRoomTemplates: m.listTemplates,
    uploadRoomTemplate: vi.fn(),
    activateRoomTemplate: vi.fn(),
    deactivateRoomTemplate: vi.fn(),
    downloadRoomTemplate: vi.fn(),
    listRoomAuditLogs: m.listAudit,
}));

vi.mock('../../../shared/protected-pdf-viewer', () => ({
    renderProtectedPdfViewer: () => '<div data-protected-pdf-viewer></div>',
    attachProtectedPdfViewer: m.attachViewer,
}));

vi.mock('toastify-js', () => ({
    default: vi.fn((options: { text: string }) => ({
        showToast: () => m.toasts.push(options.text),
    })),
}));

import { PeminjamanApiError } from '../../../mahasiswa/peminjaman/api';
import type { Room, SuperAdminBooking } from '../../../mahasiswa/peminjaman/types';
import type { ManagedRoom } from '../../../shared/room-management/types';
import { renderPeminjamanRuanganAdmin } from '../../PeminjamanRuanganAdmin';
import pageSource from '../../PeminjamanRuanganAdmin.ts?raw';

const labs = [{ id: 7, code: 'LAB-UJI', name: 'Laboratorium <script>uji</script>' }];

const managedRoom = (overrides: Partial<ManagedRoom> = {}): ManagedRoom => ({
    id: 12,
    code: 'ROOM-12',
    name: 'Ruang <img src=x onerror=unsafe()>',
    type: 'classroom',
    capacity: 30,
    location: 'Gedung <script>unsafe()</script>',
    description: 'Deskripsi aman.',
    rules: null,
    is_active: true,
    owning_laboratory: null,
    cover_photo: null,
    facilities_summary: { count: 0, items: [] },
    has_active_template: false,
    management_flags: {
        can_edit_info: true,
        can_manage_media: true,
        can_manage_facilities: true,
        can_manage_templates: true,
        can_create: true,
        can_deactivate: true,
        can_activate: true,
    },
    ...overrides,
});

const room = (overrides: Partial<Room> = {}): Room => ({
    id: 12,
    code: 'ROOM-12',
    name: 'Ruang Booking',
    type: 'classroom',
    capacity: 30,
    location: 'Gedung Uji',
    description: 'Deskripsi aman.',
    is_active: true,
    owning_laboratory: null,
    ...overrides,
});

const booking = (overrides: Partial<SuperAdminBooking> = {}): SuperAdminBooking => ({
    id: 44,
    room: room(),
    requester: { id: 20, name: 'Pemohon <script>unsafe()</script>', email: 'pemohon@example.test' },
    activity_name: 'Kegiatan <img src=x onerror=unsafe()>',
    purpose: 'Tujuan <script>unsafe()</script>',
    participant_count: 20,
    start_at: '2026-06-25T09:00:00+07:00',
    end_at: '2026-06-25T11:00:00+07:00',
    status: 'submitted',
    reviewer: null,
    reviewed_at: null,
    revision_note: null,
    rejection_reason: null,
    cancellation_reason: null,
    created_at: '2026-06-18T09:00:00+07:00',
    updated_at: '2026-06-18T09:00:00+07:00',
    status_histories: [{
        id: 1, from_status: null, to_status: 'submitted', actor: null,
        note: 'Riwayat <b>aman</b>', created_at: '2026-06-18T09:00:00+07:00',
    }],
    ...overrides,
});

const bookingEnvelope = (items: SuperAdminBooking[] = [booking()]) => ({
    message: 'ok',
    data: items,
    meta: { current_page: 1, per_page: 10, total: items.length, last_page: 1 },
});

const currentMonthKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const calendarItem = (overrides = {}) => ({
    id: 44,
    room_id: 12,
    room_code: 'ROOM-12',
    room_name: 'Ruang Booking',
    room_type: 'classroom' as const,
    laboratory_id: null,
    laboratory_name: null,
    requester_name: 'Pemohon Kalender',
    requester_identifier: 'pemohon@example.test',
    activity_name: 'Kegiatan Kalender',
    purpose: 'Tujuan kalender aman.',
    status: 'submitted' as const,
    start_at: `${currentMonthKey()}-15T09:00:00+07:00`,
    end_at: `${currentMonthKey()}-15T11:00:00+07:00`,
    can_view: true,
    can_review: false,
    can_approve: false,
    can_reject: false,
    can_request_revision: false,
    can_cancel: false,
    can_manage_room: true,
    ...overrides,
});

const calendarEnvelope = (items = [calendarItem()]) => ({
    message: 'ok',
    month: currentMonthKey(),
    range: { start: `${currentMonthKey()}-01`, end: `${currentMonthKey()}-31` },
    items,
    summary: {
        total: items.length,
        counts_by_status: items.reduce<Record<string, number>>((counts, item) => {
            counts[item.status] = (counts[item.status] ?? 0) + 1;
            return counts;
        }, {}),
    },
});

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

const setValue = (id: string, value: string): void => {
    const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    element.value = value;
};

const changeValue = (id: string, value: string): void => {
    setValue(id, value);
    document.getElementById(id)?.dispatchEvent(new Event('change', { bubbles: true }));
};

const submit = (id: string): void => {
    document.getElementById(id)?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

const openRoomForm = (): void => {
    document.getElementById('admin-peminjaman-add-room')?.click();
};

const fillRoomForm = (type: 'classroom' | 'laboratory' = 'classroom'): void => {
    setValue('room-form-code', type === 'classroom' ? 'KLS-01' : 'LAB-01');
    setValue('room-form-name', type === 'classroom' ? 'Ruang Kelas' : 'Laboratorium');
    changeValue('room-form-type', type);
    setValue('room-form-capacity', '30');
    setValue('room-form-location', 'Gedung Uji');
    setValue('room-form-description', 'Deskripsi');
    if (type === 'laboratory') setValue('room-form-laboratory', '7');
};

const openMonitoring = (): void => {
    document.getElementById('admin-peminjaman-tab-monitoring')?.click();
};

const openCalendar = (): void => {
    document.getElementById('admin-peminjaman-tab-calendar')?.click();
};

beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    Object.values(m).forEach((value) => {
        if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
    });
    m.toasts = [];
    m.getLabs.mockResolvedValue(labs);
    m.listRooms.mockResolvedValue([managedRoom()]);
    m.bulkDelete.mockResolvedValue({ deleted: [], archived: [], summary: { deleted: 0, archived: 0, total: 0 } });
    m.getRoom.mockResolvedValue(managedRoom());
    m.createRoom.mockResolvedValue(managedRoom());
    m.updateRoom.mockResolvedValue(managedRoom());
    m.activateRoom.mockResolvedValue(managedRoom({ is_active: true }));
    m.deactivateRoom.mockResolvedValue(managedRoom({ is_active: false }));
    m.listPhotos.mockResolvedValue([]);
    m.listFacilities.mockResolvedValue([]);
    m.listFacilityTypes.mockResolvedValue([]);
    m.getFacilityUsage.mockResolvedValue({
        facility_type: { id: 1, name: 'Proyektor', slug: 'proyektor', is_predefined: true, is_active: true, usage_count: 0 },
        summary: { total: 0, classroom: 0, laboratory: 0, other: 0 },
        rooms: [],
    });
    m.listTemplates.mockResolvedValue([]);
    m.listAudit.mockResolvedValue([]);
    m.attachViewer.mockReturnValue(() => {});
    m.getBookings.mockResolvedValue(bookingEnvelope());
    m.getCalendar.mockResolvedValue(calendarEnvelope());
    m.getBooking.mockResolvedValue(booking());
});

describe('Super Admin room master management', () => {
    it('renders loading, empty, error/retry, and success room states', async () => {
        let resolveRooms!: (value: ManagedRoom[]) => void;
        m.listRooms.mockReturnValueOnce(new Promise((resolve) => { resolveRooms = resolve; }));
        const rendering = renderPeminjamanRuanganAdmin();
        expect(document.querySelector('[data-admin-room-state="loading"]')).not.toBeNull();
        resolveRooms([]);
        await rendering;
        expect(document.querySelector('[data-admin-room-state="empty"]')).not.toBeNull();

        m.listRooms
            .mockRejectedValueOnce(new Error('Data ruangan gagal.'))
            .mockResolvedValueOnce([managedRoom()]);
        await renderPeminjamanRuanganAdmin();
        expect(document.querySelector('[data-admin-room-state="error"]')).not.toBeNull();
        document.getElementById('admin-peminjaman-retry-rooms')?.click();
        await flush();
        expect(document.querySelector('[data-admin-room-state="success"]')).not.toBeNull();
    });

    it('calls room filters with type, status, search, and laboratory', async () => {
        await renderPeminjamanRuanganAdmin();
        setValue('admin-peminjaman-room-search', 'ruang uji');
        setValue('admin-peminjaman-room-type', 'laboratory');
        setValue('admin-peminjaman-room-active', 'false');
        setValue('admin-peminjaman-room-laboratory', '7');
        submit('admin-peminjaman-room-filters');
        await flush();

        expect(m.listRooms).toHaveBeenCalledWith({
            type: 'laboratory',
            laboratoryId: 7,
            active: false,
            search: 'ruang uji',
        });
    });

    it('renders health badges and safely escapes room text in the table', async () => {
        await renderPeminjamanRuanganAdmin();
        expect(document.body.textContent).toContain('Ruang <img src=x onerror=unsafe()>');
        expect(document.querySelector('script')).toBeNull();
        expect(document.querySelector('img[src="x"]')).toBeNull();
        // A room with no photo/facility/template shows all three health badges.
        expect(document.body.textContent).toContain('Belum ada foto');
        expect(document.body.textContent).toContain('Belum ada fasilitas');
        expect(document.body.textContent).toContain('Belum ada template');
    });

    it('renders and retries a denied laboratory catalog request', async () => {
        m.getLabs
            .mockRejectedValueOnce(new PeminjamanApiError('Forbidden', 403))
            .mockResolvedValueOnce(labs);
        await renderPeminjamanRuanganAdmin();

        expect(document.body.textContent).toContain('tidak memiliki akses');
        document.getElementById('admin-peminjaman-retry-laboratories')?.click();
        await flush();
        expect(document.body.textContent).toContain('LAB-UJI');
    });

    it('validates required room fields before create', async () => {
        await renderPeminjamanRuanganAdmin();
        openRoomForm();
        submit('room-form');

        expect(m.createRoom).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('Kode ruangan wajib diisi.');
        expect(document.body.textContent).toContain('Kapasitas ruangan wajib diisi.');
    });

    it('creates a classroom with rules and without a laboratory owner', async () => {
        await renderPeminjamanRuanganAdmin();
        openRoomForm();
        fillRoomForm('classroom');
        setValue('room-form-rules', 'Jaga kebersihan.');
        submit('room-form');
        await flush();

        expect(m.createRoom).toHaveBeenCalledWith({
            code: 'KLS-01',
            name: 'Ruang Kelas',
            type: 'classroom',
            capacity: 30,
            location: 'Gedung Uji',
            description: 'Deskripsi',
            rules: 'Jaga kebersihan.',
            owning_laboratory_id: null,
        });
    });

    it('requires a laboratory owner and creates a laboratory with the selected owner', async () => {
        await renderPeminjamanRuanganAdmin();
        openRoomForm();
        fillRoomForm('laboratory');
        setValue('room-form-laboratory', '');
        submit('room-form');
        expect(m.createRoom).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('Laboratorium pemilik wajib dipilih.');

        setValue('room-form-laboratory', '7');
        submit('room-form');
        await flush();
        expect(m.createRoom).toHaveBeenCalledWith(expect.objectContaining({
            type: 'laboratory',
            owning_laboratory_id: 7,
        }));
    });

    it('renders backend 422 field errors during create', async () => {
        m.createRoom.mockRejectedValueOnce(new PeminjamanApiError(
            'Validasi gagal.', 422, undefined, { code: ['Kode ruangan sudah digunakan.'] },
        ));
        await renderPeminjamanRuanganAdmin();
        openRoomForm();
        fillRoomForm();
        submit('room-form');
        await flush();

        expect(document.body.textContent).toContain('Kode ruangan sudah digunakan.');
    });

    it('opens the management drawer and edits room info', async () => {
        await renderPeminjamanRuanganAdmin();
        document.querySelector<HTMLButtonElement>('[data-room-mgmt-open="12"]')?.click();
        await flush();

        expect(document.getElementById('room-management-drawer-root')).not.toBeNull();
        expect(m.getRoom).toHaveBeenCalledWith(12);

        document.getElementById('room-mgmt-edit')?.click();
        setValue('room-form-name', 'Nama Diperbarui');
        submit('room-form');
        await flush();

        expect(m.updateRoom).toHaveBeenCalledWith(12, expect.objectContaining({ name: 'Nama Diperbarui' }));
    });

    it('mounts the Master Fasilitas tab and loads facility types', async () => {
        m.listFacilityTypes.mockResolvedValue([
            { id: 1, name: 'Proyektor', slug: 'proyektor', is_predefined: true, is_active: true, usage_count: 2 },
        ]);
        await renderPeminjamanRuanganAdmin();
        document.getElementById('admin-peminjaman-tab-facilities')?.click();
        await flush();

        expect(document.getElementById('admin-facility-master-root')).not.toBeNull();
        expect(document.body.textContent).toContain('Master Fasilitas');
        expect(document.body.textContent).toContain('Proyektor');
        expect(document.body.textContent).toContain('2 ruangan');
    });

    const openUsageDrawerFromFacilities = async (): Promise<void> => {
        m.listFacilityTypes.mockResolvedValue([
            { id: 1, name: 'Proyektor', slug: 'proyektor', is_predefined: true, is_active: true, usage_count: 1 },
        ]);
        m.getFacilityUsage.mockResolvedValue({
            facility_type: { id: 1, name: 'Proyektor', slug: 'proyektor', is_predefined: true, is_active: true, usage_count: 1 },
            summary: { total: 1, classroom: 1, laboratory: 0, other: 0 },
            rooms: [{ id: 12, code: 'CU101', name: 'Ruang CU101', type: 'classroom', is_active: true, owning_laboratory: null, quantity: 3, condition: 'baik' }],
        });
        await renderPeminjamanRuanganAdmin();
        document.getElementById('admin-peminjaman-tab-facilities')?.click();
        await flush();
        document.querySelector<HTMLElement>('[data-facility-menu="1"]')?.click();
        document.querySelector<HTMLElement>('[data-facility-usage="1"]')?.click();
        await flush();
    };

    it('jumps from facility usage to the room Kelola drawer on the Fasilitas tab', async () => {
        await openUsageDrawerFromFacilities();

        // Usage drawer shows the room with a "Kelola Ruangan" CTA.
        expect(document.getElementById('facility-usage-drawer-root')).not.toBeNull();
        const cta = document.querySelector<HTMLElement>('[data-usage-open-room="12"]');
        expect(cta).not.toBeNull();
        expect(cta?.textContent).toContain('Kelola Ruangan');

        cta?.click();
        await flush();

        // Usage drawer closed; Master Ruangan tab active; room drawer open on Fasilitas.
        expect(document.getElementById('facility-usage-drawer-root')).toBeNull();
        expect(document.getElementById('admin-peminjaman-tab-rooms')?.getAttribute('aria-selected')).toBe('true');
        expect(document.getElementById('room-management-drawer-root')).not.toBeNull();
        expect(m.getRoom).toHaveBeenCalledWith(12);
        expect(document.querySelector('[data-room-mgmt-tab="fasilitas"][aria-selected="true"]')).not.toBeNull();
    });

    it('surfaces the drawer error state when the jumped-to room cannot be fetched', async () => {
        await openUsageDrawerFromFacilities();
        m.getRoom.mockRejectedValueOnce(new PeminjamanApiError('Not found', 404));

        document.querySelector<HTMLElement>('[data-usage-open-room="12"]')?.click();
        await flush();

        expect(document.getElementById('room-management-drawer-root')).not.toBeNull();
        expect(document.body.textContent).toContain('Detail ruangan tidak tersedia');
    });

    it('activates and deactivates through the drawer Info tab', async () => {
        await renderPeminjamanRuanganAdmin();
        document.querySelector<HTMLButtonElement>('[data-room-mgmt-open="12"]')?.click();
        await flush();
        document.getElementById('room-mgmt-toggle')?.click();
        document.getElementById('room-mgmt-confirm-ok')?.click();
        await flush();
        expect(m.deactivateRoom).toHaveBeenCalledWith(12);

        m.getRoom.mockResolvedValue(managedRoom({ is_active: false }));
        document.getElementById('close-room-mgmt')?.click();
        document.querySelector<HTMLButtonElement>('[data-room-mgmt-open="12"]')?.click();
        await flush();
        document.getElementById('room-mgmt-toggle')?.click();
        document.getElementById('room-mgmt-confirm-ok')?.click();
        await flush();
        expect(m.activateRoom).toHaveBeenCalledWith(12);
    });
});

describe('Super Admin bulk room selection and delete', () => {
    const rowCheckbox = (id: number): HTMLInputElement =>
        document.querySelector(`.room-checkbox[data-room-id="${id}"]`) as HTMLInputElement;

    const check = (element: HTMLInputElement, value = true): void => {
        element.checked = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const barHidden = (): boolean =>
        document.getElementById('room-bulk-bar')?.classList.contains('hidden') ?? true;

    it('shows a checkbox per room and reveals the bulk bar on selection', async () => {
        await renderPeminjamanRuanganAdmin();

        expect(rowCheckbox(12)).not.toBeNull();
        expect(barHidden()).toBe(true);

        check(rowCheckbox(12));
        expect(barHidden()).toBe(false);
        expect(document.getElementById('room-bulk-count')?.textContent).toContain('1 ruangan dipilih');
    });

    it('select-all toggles every visible room', async () => {
        m.listRooms.mockResolvedValue([managedRoom({ id: 12 }), managedRoom({ id: 13, code: 'ROOM-13' })]);
        await renderPeminjamanRuanganAdmin();

        const selectAll = document.querySelector('[data-room-select-all]') as HTMLInputElement;
        check(selectAll);

        expect(document.getElementById('room-bulk-count')?.textContent).toContain('2 ruangan dipilih');
        expect(rowCheckbox(12).checked).toBe(true);
        expect(rowCheckbox(13).checked).toBe(true);

        check(selectAll, false);
        expect(barHidden()).toBe(true);
        expect(rowCheckbox(12).checked).toBe(false);
    });

    it('Batal clears the current selection', async () => {
        await renderPeminjamanRuanganAdmin();
        check(rowCheckbox(12));
        expect(barHidden()).toBe(false);

        document.getElementById('room-bulk-cancel')?.click();
        expect(barHidden()).toBe(true);
        expect(rowCheckbox(12).checked).toBe(false);
    });

    it('confirms then bulk-deletes the selected rooms and refreshes', async () => {
        m.bulkDelete.mockResolvedValue({
            deleted: [{ id: 12, code: 'ROOM-12' }], archived: [], summary: { deleted: 1, archived: 0, total: 1 },
        });
        await renderPeminjamanRuanganAdmin();
        check(rowCheckbox(12));

        document.getElementById('room-bulk-delete')?.click();
        expect(document.getElementById('room-bulk-confirm-root')).not.toBeNull();
        expect(document.body.textContent).toContain('Hapus Ruangan Terpilih?');
        expect(document.body.textContent).toContain('diarsipkan');

        const callsBefore = m.listRooms.mock.calls.length;
        document.getElementById('room-bulk-confirm-ok')?.click();
        await flush();

        expect(m.bulkDelete).toHaveBeenCalledWith([12]);
        expect(m.toasts.some((t) => t.includes('1 ruangan berhasil dihapus'))).toBe(true);
        expect(m.listRooms.mock.calls.length).toBeGreaterThan(callsBefore); // list refreshed
        expect(document.getElementById('room-bulk-confirm-root')).toBeNull();
        expect(barHidden()).toBe(true);
    });

    it('reports an archived-only outcome with a booking-history message', async () => {
        m.bulkDelete.mockResolvedValue({
            deleted: [], archived: [{ id: 12, code: 'ROOM-12', reason: 'Memiliki riwayat peminjaman' }],
            summary: { deleted: 0, archived: 1, total: 1 },
        });
        await renderPeminjamanRuanganAdmin();
        check(rowCheckbox(12));
        document.getElementById('room-bulk-delete')?.click();
        document.getElementById('room-bulk-confirm-ok')?.click();
        await flush();

        expect(m.toasts.some((t) => t.includes('diarsipkan karena memiliki riwayat peminjaman'))).toBe(true);
    });

    it('cancelling the confirm modal performs no deletion', async () => {
        await renderPeminjamanRuanganAdmin();
        check(rowCheckbox(12));
        document.getElementById('room-bulk-delete')?.click();
        document.getElementById('room-bulk-confirm-cancel')?.click();

        expect(document.getElementById('room-bulk-confirm-root')).toBeNull();
        expect(m.bulkDelete).not.toHaveBeenCalled();
        expect(barHidden()).toBe(false); // selection preserved
    });

    it('keeps the selection when the bulk delete fails', async () => {
        m.bulkDelete.mockRejectedValueOnce(new PeminjamanApiError('Server error', 500));
        await renderPeminjamanRuanganAdmin();
        check(rowCheckbox(12));
        document.getElementById('room-bulk-delete')?.click();
        document.getElementById('room-bulk-confirm-ok')?.click();
        await flush();

        expect(barHidden()).toBe(false); // still selected for retry
    });
});

describe('Super Admin calendar monitoring', () => {
    it('adds the calendar tab in the required order and renders calendar copy', async () => {
        await renderPeminjamanRuanganAdmin();

        const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent);
        expect(tabs).toEqual([
            'Master Ruangan',
            'Master Fasilitas',
            'Monitoring Pengajuan',
            'Kalender Peminjaman',
        ]);

        openCalendar();
        await flush();

        expect(m.getCalendar).toHaveBeenCalledWith(expect.objectContaining({
            month: expect.stringMatching(/^\d{4}-\d{2}$/),
        }));
        expect(document.body.textContent).toContain('Kalender Peminjaman Ruangan');
        expect(document.body.textContent).toContain('Pantau pengajuan dan jadwal ruangan berdasarkan tanggal, status, jenis ruangan, dan laboratorium.');
        expect(document.body.textContent).toContain('Peminjaman Terdekat');
        expect(document.body.textContent).toContain('Mengikuti filter aktif.');
        expect(document.body.textContent).not.toContain('Kalender Peminjaman Disetujui');
        expect(document.getElementById('approve-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('reject-tendik-peminjaman')).toBeNull();
    });

    it('loads calendar filters for room type, status, laboratory, room, and month navigation', async () => {
        m.listRooms.mockResolvedValue([
            managedRoom(),
            managedRoom({
                id: 13,
                code: 'LAB-13',
                name: 'Lab Uji',
                type: 'laboratory',
                owning_laboratory: { id: 7, code: 'LAB-UJI', name: 'Laboratorium Uji' },
            }),
        ]);
        await renderPeminjamanRuanganAdmin();
        openCalendar();
        await flush();

        document.querySelector<HTMLElement>('[data-admin-calendar-room-type="laboratory"]')?.click();
        await flush();
        expect(m.getCalendar).toHaveBeenLastCalledWith(expect.objectContaining({
            roomType: 'laboratory',
        }));

        document.querySelector<HTMLElement>('[data-admin-calendar-status="approved"]')?.click();
        await flush();
        expect(m.getCalendar).toHaveBeenLastCalledWith(expect.objectContaining({
            roomType: 'laboratory',
            status: 'approved',
        }));

        changeValue('admin-calendar-laboratory', '7');
        await flush();
        expect(m.getCalendar).toHaveBeenLastCalledWith(expect.objectContaining({
            laboratoryId: 7,
        }));

        changeValue('admin-calendar-room', '13');
        await flush();
        expect(m.getCalendar).toHaveBeenLastCalledWith(expect.objectContaining({
            roomId: 13,
        }));

        const beforePrev = m.getCalendar.mock.calls.at(-1)?.[0].month;
        document.getElementById('admin-calendar-prev-month')?.click();
        await flush();
        expect(m.getCalendar.mock.calls.at(-1)?.[0].month).not.toBe(beforePrev);
    });

    it('selects a date, shows matching bookings, and opens the existing monitoring detail drawer', async () => {
        await renderPeminjamanRuanganAdmin();
        openCalendar();
        await flush();

        document
            .querySelector<HTMLElement>(`[data-admin-calendar-date="${currentMonthKey()}-15"]`)
            ?.click();

        expect(document.getElementById('admin-calendar-day-drawer-root')).not.toBeNull();
        expect(document.body.textContent).toContain('Kegiatan Kalender');
        expect(document.body.textContent).toContain('Pemohon Kalender');
        expect(document.body.textContent).toContain('Diajukan');

        document
            .querySelector<HTMLElement>('#admin-calendar-day-drawer-root [data-admin-calendar-detail="44"]')
            ?.click();
        await flush();

        expect(m.getBooking).toHaveBeenCalledWith(44);
        expect(document.getElementById('admin-peminjaman-drawer-root')).not.toBeNull();
        expect(document.body.textContent).toContain('Monitoring saja');
        expect(document.getElementById('approve-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('revise-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('reject-tendik-peminjaman')).toBeNull();
    });

    it('renders clear empty states for month and selected date', async () => {
        m.getCalendar.mockResolvedValue(calendarEnvelope([]));
        await renderPeminjamanRuanganAdmin();
        openCalendar();
        await flush();

        expect(document.body.textContent).toContain('Belum ada peminjaman untuk bulan dan filter ini.');

        document
            .querySelector<HTMLElement>(`[data-admin-calendar-date="${currentMonthKey()}-15"]`)
            ?.click();

        expect(document.body.textContent).toContain('Belum ada peminjaman pada tanggal ini untuk filter aktif.');
    });
});

describe('Super Admin booking monitoring', () => {
    it('renders loading, empty, error/retry, and success monitoring states', async () => {
        let resolveBookings!: (value: ReturnType<typeof bookingEnvelope>) => void;
        m.getBookings.mockReturnValueOnce(new Promise((resolve) => { resolveBookings = resolve; }));
        const rendering = renderPeminjamanRuanganAdmin();
        openMonitoring();
        expect(document.querySelector('[data-admin-booking-state="loading"]')).not.toBeNull();
        resolveBookings(bookingEnvelope([]));
        await rendering;
        openMonitoring();
        expect(document.querySelector('[data-admin-booking-state="empty"]')).not.toBeNull();

        m.getBookings
            .mockRejectedValueOnce(new Error('Monitoring gagal.'))
            .mockResolvedValueOnce(bookingEnvelope());
        await renderPeminjamanRuanganAdmin();
        openMonitoring();
        expect(document.querySelector('[data-admin-booking-state="error"]')).not.toBeNull();
        document.getElementById('admin-peminjaman-retry-bookings')?.click();
        await flush();
        expect(document.querySelector('[data-admin-booking-state="success"]')).not.toBeNull();
    });

    it('renders all requests and calls monitoring filters', async () => {
        await renderPeminjamanRuanganAdmin();
        openMonitoring();
        expect(document.querySelector('[data-admin-booking-state="success"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Kegiatan <img src=x onerror=unsafe()>');

        setValue('admin-peminjaman-booking-status', 'approved');
        setValue('admin-peminjaman-booking-room-type', 'classroom');
        setValue('admin-peminjaman-booking-room-id', '12');
        setValue('admin-peminjaman-booking-date-from', '2026-06-20');
        setValue('admin-peminjaman-booking-date-to', '2026-06-30');
        submit('admin-peminjaman-booking-filters');
        await flush();

        expect(m.getBookings).toHaveBeenLastCalledWith({
            status: 'approved',
            roomType: 'classroom',
            roomId: 12,
            dateFrom: '2026-06-20',
            dateTo: '2026-06-30',
            page: 1,
            perPage: 10,
        });
    });

    it('renders requester, room, activity, purpose, status, and history safely', async () => {
        await renderPeminjamanRuanganAdmin();
        openMonitoring();
        document.querySelector<HTMLButtonElement>('[data-admin-booking-detail="44"]')?.click();
        await flush();

        expect(document.body.textContent).toContain('Pemohon <script>unsafe()</script>');
        expect(document.body.textContent).toContain('Riwayat <b>aman</b>');
        expect(document.body.textContent).toContain('Monitoring saja');
        expect(document.querySelector('script')).toBeNull();
        expect(document.querySelector('img[src="x"]')).toBeNull();
        expect(document.getElementById('approve-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('revise-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('reject-tendik-peminjaman')).toBeNull();
    });

    it('shows surat PDF metadata with protected preview/download and no upload/replace UI', async () => {
        const withPdf = booking({
            status: 'revision_requested',
            surat_peminjaman_pdf: {
                exists: true,
                original_name: 'Surat <b>Final</b>.pdf',
                size_bytes: 204800,
                uploaded_at: '2026-06-18T10:00:00+07:00',
            },
        });
        m.getBooking.mockResolvedValue(withPdf);
        await renderPeminjamanRuanganAdmin();
        openMonitoring();
        document.querySelector<HTMLButtonElement>('[data-admin-booking-detail="44"]')?.click();
        await flush();

        expect(document.body.textContent).toContain('Surat Peminjaman');
        expect(document.body.textContent).toContain('Surat <b>Final</b>.pdf');
        expect(document.querySelector('b')).toBeNull();
        expect(document.body.textContent).toContain('200.0 KB');
        expect(document.getElementById('peminjaman-surat-replace-input')).toBeNull();
        expect(document.getElementById('peminjaman-surat-replace-submit')).toBeNull();

        document.getElementById('peminjaman-surat-preview')?.click();
        expect(document.getElementById('peminjaman-surat-preview-root')).not.toBeNull();
        expect(m.attachViewer).toHaveBeenCalledWith(expect.objectContaining({
            endpointUrl: '/api/peminjaman-ruangan/44/attachment/surat-peminjaman/preview',
        }));

        document.getElementById('peminjaman-surat-download')?.click();
        await flush();
        expect(m.downloadSurat).toHaveBeenCalledWith(44, 'Surat <b>Final</b>.pdf');
    });

    it('shows a safe empty state when the surat is missing', async () => {
        await renderPeminjamanRuanganAdmin();
        openMonitoring();
        document.querySelector<HTMLButtonElement>('[data-admin-booking-detail="44"]')?.click();
        await flush();

        expect(document.body.textContent).toContain('Surat peminjaman belum tersedia.');
        expect(document.getElementById('peminjaman-surat-preview')).toBeNull();
        expect(document.getElementById('peminjaman-surat-download')).toBeNull();
    });

    it('renders monitoring 403 and detail 404 errors', async () => {
        m.getBookings.mockRejectedValueOnce(new PeminjamanApiError('Forbidden', 403));
        await renderPeminjamanRuanganAdmin();
        openMonitoring();
        expect(document.body.textContent).toContain('tidak memiliki akses');

        m.getBookings.mockResolvedValue(bookingEnvelope());
        m.getBooking.mockRejectedValueOnce(new PeminjamanApiError('Not found', 404));
        await renderPeminjamanRuanganAdmin();
        openMonitoring();
        document.querySelector<HTMLButtonElement>('[data-admin-booking-detail="44"]')?.click();
        await flush();
        expect(document.body.textContent).toContain('tidak ditemukan');
    });

    it('contains no approval workflow, separate API origin, or unsafe media handling', () => {
        expect(pageSource).not.toContain('approveTendikBooking');
        expect(pageSource).not.toContain('reviseTendikBooking');
        expect(pageSource).not.toContain('rejectTendikBooking');
        expect(pageSource).not.toContain('VITE_API_BASE_URL');
        expect(pageSource).not.toContain('localhost');
        expect(pageSource).not.toContain('replaceSuratPeminjamanPdf');
        expect(pageSource).not.toContain('/storage');
        expect(pageSource).not.toContain('window.open');
        expect(pageSource).not.toContain('<iframe');
    });
});
