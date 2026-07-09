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
import {
    renderBookingCalendarSelectedDatePanel,
    renderBookingCalendarView,
    type BookingCalendarViewItem,
    type BookingCalendarViewConfig,
} from '../../../shared/peminjaman-calendar-view';
import type { ManagedRoom } from '../../../shared/room-management/types';
import { renderPeminjamanRuanganAdmin } from '../../PeminjamanRuanganAdmin';
import calendarViewSource from '../../../shared/peminjaman-calendar-view.ts?raw';
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

const dateKeyFromNow = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const shiftMonthDateKey = (dateKey: string, months: number): string => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    date.setMonth(date.getMonth() + months);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDateId = (date: Date): string =>
    date.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

const sharedCalendarItem = (overrides: Partial<BookingCalendarViewItem> = {}): BookingCalendarViewItem => ({
    id: 99,
    roomCode: 'LAB-99',
    roomName: 'Lab Role',
    status: 'approved',
    startAt: '2026-07-15T09:00:00+07:00',
    endAt: '2026-07-15T10:00:00+07:00',
    activityName: 'Praktikum Role',
    purpose: 'Kegiatan role.',
    requesterName: 'Pemohon Role',
    capabilities: { view: true },
    ...overrides,
});

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

const calendarEnvelope = (
    items = [calendarItem()],
    countsByStatus?: Record<string, number>,
) => {
    const summaryCounts = countsByStatus ?? items.reduce<Record<string, number>>((counts, item) => {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
        return counts;
    }, {});

    return {
        message: 'ok',
        month: currentMonthKey(),
        range: { start: `${currentMonthKey()}-01`, end: `${currentMonthKey()}-31` },
        items,
        summary: {
            total: Object.values(summaryCounts).reduce((total, count) => total + count, 0),
            counts_by_status: summaryCounts,
        },
    };
};

const calendarMonthCalls = (): Record<string, unknown>[] =>
    m.getCalendar.mock.calls
        .map(([filters]) => filters as Record<string, unknown>)
        .filter((filters) => 'month' in filters);

const latestCalendarMonthCall = (): Record<string, unknown> | undefined =>
    calendarMonthCalls().at(-1);

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

const makeSharedCalendarConfig = (): BookingCalendarViewConfig => ({
    copy: {
        title: 'Kalender Reviewer Lab',
        helper: 'Pantau jadwal untuk lingkup reviewer.',
        densityHelper: 'Kepadatan mengikuti filter reviewer.',
        totalText: '1 jadwal mengikuti filter.',
        roomTypeFilterLabel: 'Jenis Ruangan',
        roomTypeFilterAriaLabel: 'Filter jenis role',
        statusFilterLabel: 'Status',
        statusFilterAriaLabel: 'Filter status role',
        laboratoryLabel: 'Unit',
        roomLabel: 'Ruang',
        allLaboratoriesLabel: 'Semua unit',
        allRoomsLabel: 'Semua ruang',
        resetLabel: 'Reset',
        loadingText: 'Memuat kalender role...',
        errorTitle: 'Kalender role gagal dimuat',
        retryLabel: 'Coba Lagi',
        monthEmptyText: 'Belum ada jadwal role.',
    },
    ids: {
        previousMonthButton: 'role-calendar-prev',
        nextMonthButton: 'role-calendar-next',
        todayButton: 'role-calendar-today',
        resetButton: 'role-calendar-reset',
        monthHeading: 'role-calendar-heading',
        grid: 'role-calendar-grid',
        retryButton: 'role-calendar-retry',
        laboratorySelect: 'role-calendar-unit',
        roomSelect: 'role-calendar-room',
    },
    dataAttributes: {
        dateCell: 'data-role-calendar-date',
        roomTypeFilter: 'data-role-calendar-room-type',
        statusFilter: 'data-role-calendar-status',
        calendarState: 'data-role-calendar-state',
        upcomingState: 'data-role-calendar-upcoming-state',
    },
    navigation: {
        previousMonthAriaLabel: 'Bulan role sebelumnya',
        nextMonthAriaLabel: 'Bulan role berikutnya',
        todayLabel: 'Hari Ini',
        todayAriaLabel: 'Kembali ke hari ini',
    },
    state: {
        cursor: new Date(2026, 6, 1),
        selectedDateKey: null,
        items: [sharedCalendarItem()],
        loading: false,
        loaded: true,
        error: null,
    },
    filters: {
        roomTypeOptions: [
            { value: 'all', label: 'Semua', selected: true },
            { value: 'classroom', label: 'Kelas', selected: false },
            { value: 'laboratory', label: 'Lab', selected: false },
        ],
        statusOptions: [
            { value: 'all', label: 'Semua', count: 1, selected: true },
            { value: 'approved', label: 'Disetujui', count: 1, selected: false },
        ],
        laboratoryOptions: [{ value: '7', label: 'LAB - Unit Role', selected: false }],
        roomOptions: [{ value: '99', label: 'LAB-99 - Lab Role', selected: false }],
    },
    upcoming: {
        title: 'Jadwal Terdekat Role',
        subtitle: 'Mengikuti filter role.',
        loading: false,
        error: null,
        loadingText: 'Memuat jadwal role...',
        emptyText: 'Tidak ada jadwal role.',
        items: [],
    },
});

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

describe('Shared booking calendar primitives', () => {
    it('renders configurable copy and distinct empty states without leaking SuperAdmin copy', () => {
        const config = makeSharedCalendarConfig();
        config.state.items = [];
        config.upcoming.items = [];

        document.body.innerHTML = renderBookingCalendarView(config);

        expect(document.body.textContent).toContain('Kalender Reviewer Lab');
        expect(document.body.textContent).toContain('Pantau jadwal untuk lingkup reviewer.');
        expect(document.body.textContent).toContain('Kepadatan mengikuti filter reviewer.');
        expect(document.body.textContent).toContain('Belum ada jadwal role.');
        expect(document.body.textContent).toContain('Tidak ada jadwal role.');
        expect(document.body.textContent).not.toContain('Kalender Peminjaman Ruangan');
        expect(document.body.textContent).not.toContain('Pantau pengajuan dan jadwal ruangan berdasarkan tanggal');
        expect(document.querySelector('[data-role-calendar-state="empty"]')).not.toBeNull();
    });

    it('renders shared loading and error states from caller config with escaped text', () => {
        const loadingConfig = makeSharedCalendarConfig();
        loadingConfig.state.loading = true;
        loadingConfig.state.loaded = false;
        loadingConfig.upcoming.loading = true;

        document.body.innerHTML = renderBookingCalendarView(loadingConfig);

        expect(document.querySelector('[data-role-calendar-state="loading"]')?.textContent)
            .toContain('Memuat kalender role...');
        expect(document.querySelector('[data-role-calendar-upcoming-state="loading"]')?.textContent)
            .toContain('Memuat jadwal role...');

        const calendarErrorConfig = makeSharedCalendarConfig();
        calendarErrorConfig.state.error = 'Kalender role <b>gagal</b>';

        document.body.innerHTML = renderBookingCalendarView(calendarErrorConfig);

        expect(document.querySelector('[data-role-calendar-state="error"]')?.textContent)
            .toContain('Kalender role <b>gagal</b>');
        expect(document.querySelector('b')).toBeNull();

        const upcomingErrorConfig = makeSharedCalendarConfig();
        upcomingErrorConfig.upcoming.items = [];
        upcomingErrorConfig.upcoming.error = 'Terdekat <script>gagal</script>';

        document.body.innerHTML = renderBookingCalendarView(upcomingErrorConfig);

        expect(document.querySelector('[data-role-calendar-upcoming-state="error"]')?.textContent)
            .toContain('Terdekat <script>gagal</script>');
        expect(document.querySelector('script')).toBeNull();
    });

    it('defaults action slots to no actions and requires explicit item capability', () => {
        const config = makeSharedCalendarConfig();
        config.upcoming.items = [sharedCalendarItem({ capabilities: { view: true } })];

        document.body.innerHTML = renderBookingCalendarView(config);
        expect(document.querySelector('[data-role-calendar-detail]')).toBeNull();

        config.actions = [{
            label: 'Detail Role',
            dataAttribute: 'data-role-calendar-detail',
            value: (item) => item.id,
            requiredCapability: 'view',
        }];
        config.upcoming.items = [sharedCalendarItem({ capabilities: { view: false } })];

        document.body.innerHTML = renderBookingCalendarView(config);
        expect(document.querySelector('[data-role-calendar-detail]')).toBeNull();

        config.upcoming.items = [sharedCalendarItem({ capabilities: { view: true } })];

        document.body.innerHTML = renderBookingCalendarView(config);
        expect(document.querySelector('[data-role-calendar-detail="99"]')?.textContent)
            .toContain('Detail Role');
    });

    it('renders conflict badges in the shared primitive without workflow actions', () => {
        const config = makeSharedCalendarConfig();
        config.upcoming.items = [sharedCalendarItem({
            conflictStatus: 'approved_overlap',
            hasConflict: true,
            conflictLevel: 'blocking',
            conflictMessage: 'Pengajuan ini bentrok dengan peminjaman yang sudah disetujui.',
            conflicts: [{
                booking_id: 100,
                room_id: 99,
                room_name: 'Lab Role',
                status: 'approved',
                start_at: '2026-07-15T08:00:00+07:00',
                end_at: '2026-07-15T09:30:00+07:00',
            }],
        })];

        document.body.innerHTML = renderBookingCalendarView(config);

        expect(document.body.textContent).toContain('Bentrok dengan jadwal disetujui');
        expect(document.querySelector('[aria-label*="1 jadwal bertabrakan"]')).not.toBeNull();
        expect(document.querySelector('[data-role-calendar-detail]')).toBeNull();
    });

    it('renders selected-date panel shell without actions by default', () => {
        document.body.innerHTML = renderBookingCalendarSelectedDatePanel({
            dateKey: '2026-07-15',
            items: [sharedCalendarItem()],
            titleEyebrow: 'Peminjaman Role',
            titleId: 'role-date-title',
            closeButtonId: 'role-date-close',
            closeButtonLabel: 'Tutup tanggal role',
            overlayDataAttribute: 'data-role-date-overlay',
            countText: '1 jadwal role pada tanggal ini.',
            emptyText: 'Tidak ada jadwal role pada tanggal ini.',
        });

        expect(document.getElementById('role-date-title')?.textContent)
            .toContain('Rabu, 15 Juli 2026');
        expect(document.body.textContent).toContain('1 jadwal role pada tanggal ini.');
        expect(document.querySelector('[data-role-calendar-detail]')).toBeNull();
    });

    it('keeps the shared primitive source free of raw DOM sinks and workflow controls', () => {
        expect(calendarViewSource)
            .not.toMatch(/innerHTML|dangerouslySetInnerHTML|insertAdjacentHTML|eval\(|window\.open|<iframe|srcdoc/);
        expect(calendarViewSource).not.toContain('approveTendikBooking');
        expect(calendarViewSource).not.toContain('rejectTendikBooking');
        expect(calendarViewSource).not.toContain('requestRevision');
    });
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
        expect(m.getCalendar).toHaveBeenCalledWith(expect.objectContaining({
            from: dateKeyFromNow(0),
            to: dateKeyFromNow(89),
        }));
        expect(document.body.textContent).toContain('Kalender Peminjaman Ruangan');
        expect(document.body.textContent).toContain('Pantau pengajuan dan jadwal ruangan berdasarkan tanggal, status, jenis ruangan, dan laboratorium.');
        expect(document.body.textContent).toContain('Peminjaman Terdekat');
        expect(document.body.textContent).toContain('Mengikuti filter aktif, mulai hari ini.');
        expect(document.body.textContent).not.toContain('Kalender Peminjaman Disetujui');
        expect(document.getElementById('approve-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('revise-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('reject-tendik-peminjaman')).toBeNull();
    });

    it('shows status chip counts, density helper copy, and calendar accessibility labels', async () => {
        m.getCalendar.mockResolvedValue(calendarEnvelope([calendarItem()], {
            submitted: 3,
            revision_requested: 2,
            approved: 1,
            rejected: 4,
            cancelled: 5,
        }));

        await renderPeminjamanRuanganAdmin();
        openCalendar();
        await flush();

        expect(document.body.textContent).toContain('Semua (15)');
        expect(document.body.textContent).toContain('Diajukan (3)');
        expect(document.body.textContent).toContain('Perlu Revisi (2)');
        expect(document.body.textContent).toContain('Disetujui (1)');
        expect(document.body.textContent).toContain('Ditolak (4)');
        expect(document.body.textContent).toContain('Dibatalkan (5)');
        expect(document.querySelector('[data-admin-calendar-status="submitted"]')?.getAttribute('aria-label'))
            .toBe('Filter status Diajukan, 3 peminjaman.');
        expect(document.body.textContent).toContain('Kepadatan dihitung dari jumlah peminjaman sesuai filter aktif.');
        expect(document.getElementById('admin-calendar-today')?.getAttribute('aria-label'))
            .toBe('Kembali ke bulan dan tanggal hari ini');
        expect(document.getElementById('admin-calendar-prev-month')?.getAttribute('aria-label')).toBe('Bulan sebelumnya');
        expect(document.getElementById('admin-calendar-next-month')?.getAttribute('aria-label')).toBe('Bulan berikutnya');
        expect(document.getElementById('admin-calendar-month-heading')?.getAttribute('aria-live')).toBe('polite');
        expect(document.getElementById('admin-calendar-month-heading')?.textContent).toContain(currentMonthKey().slice(0, 4));

        const dayButton = document.querySelector<HTMLElement>(`[data-admin-calendar-date="${currentMonthKey()}-15"]`);
        const label = dayButton?.getAttribute('aria-label') ?? '';
        expect(label).toContain('tidak dipilih');
        expect(label).toContain('1 peminjaman');
        expect(label).toContain('kepadatan rendah');
        expect(document.body.textContent).toContain('Kegiatan Kalender');
        expect(document.body.textContent).toContain(formatDateId(new Date(`${currentMonthKey()}-15T09:00:00+07:00`)));
        expect(document.body.textContent).toContain('09.00');
        expect(document.body.textContent).toContain('11.00 WIB');
        expect(document.body.textContent).toContain('Diajukan');

        document.querySelector<HTMLElement>('[data-admin-calendar-status="approved"]')?.click();
        await flush();
        expect(document.body.textContent).toContain('Semua (15)');
        expect(document.body.textContent).toContain('Diajukan (3)');
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
        expect(latestCalendarMonthCall()).toEqual(expect.objectContaining({
            roomType: 'laboratory',
        }));

        document.querySelector<HTMLElement>('[data-admin-calendar-status="approved"]')?.click();
        await flush();
        expect(latestCalendarMonthCall()).toEqual(expect.objectContaining({
            roomType: 'laboratory',
            status: 'approved',
        }));

        changeValue('admin-calendar-laboratory', '7');
        await flush();
        expect(latestCalendarMonthCall()).toEqual(expect.objectContaining({
            laboratoryId: 7,
        }));

        changeValue('admin-calendar-room', '13');
        await flush();
        expect(latestCalendarMonthCall()).toEqual(expect.objectContaining({
            roomId: 13,
        }));

        const beforePrev = latestCalendarMonthCall()?.month;
        document.getElementById('admin-calendar-prev-month')?.click();
        await flush();
        expect(latestCalendarMonthCall()?.month).not.toBe(beforePrev);
    });

    it('resets calendar filters, month, and selected date to today', async () => {
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
        document.querySelector<HTMLElement>('[data-admin-calendar-status="approved"]')?.click();
        await flush();
        changeValue('admin-calendar-laboratory', '7');
        await flush();
        changeValue('admin-calendar-room', '13');
        await flush();
        document.getElementById('admin-calendar-prev-month')?.click();
        await flush();

        document.getElementById('admin-calendar-reset')?.click();
        await flush();

        const resetFilters = latestCalendarMonthCall();
        expect(resetFilters).toEqual(expect.objectContaining({ month: currentMonthKey() }));
        expect(resetFilters?.status).toBeUndefined();
        expect(resetFilters?.roomType).toBeUndefined();
        expect(resetFilters?.laboratoryId).toBeUndefined();
        expect(resetFilters?.roomId).toBeUndefined();
        expect((document.getElementById('admin-calendar-laboratory') as HTMLSelectElement | null)?.value).toBe('');
        expect((document.getElementById('admin-calendar-room') as HTMLSelectElement | null)?.value).toBe('');
        expect(document.querySelector(`[data-admin-calendar-date="${dateKeyFromNow(0)}"]`)?.getAttribute('aria-pressed'))
            .toBe('true');
    });

    it('selects a date, shows matching bookings, and opens the existing monitoring detail drawer', async () => {
        await renderPeminjamanRuanganAdmin();
        openCalendar();
        await flush();

        document
            .querySelector<HTMLElement>(`[data-admin-calendar-date="${currentMonthKey()}-15"]`)
            ?.click();

        expect(document.getElementById('admin-calendar-day-drawer-root')).not.toBeNull();
        expect(document.getElementById('admin-calendar-day-title')?.textContent)
            .toBe(formatDateId(new Date(`${currentMonthKey()}-15T12:00:00+07:00`)));
        expect(document.body.textContent).toContain('1 peminjaman pada tanggal ini mengikuti filter aktif.');
        expect(document.body.textContent).toContain('Kegiatan Kalender');
        expect(document.body.textContent).toContain('Pemohon Kalender');
        expect(document.body.textContent).toContain('Diajukan');
        expect(document.body.textContent).toContain(formatDateId(new Date(`${currentMonthKey()}-15T09:00:00+07:00`)));
        expect(document.body.textContent).toContain('09.00');
        expect(document.body.textContent).toContain('11.00 WIB');

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

    it('shows calendar conflict visibility as SuperAdmin monitoring only', async () => {
        const conflict = {
            booking_id: 45,
            room_id: 12,
            room_name: 'Ruang Booking',
            status: 'approved' as const,
            start_at: `${currentMonthKey()}-15T08:00:00+07:00`,
            end_at: `${currentMonthKey()}-15T10:00:00+07:00`,
            requester_name: 'Pemohon Disetujui',
            activity_name: 'Agenda Disetujui',
            purpose: 'Agenda yang sudah disetujui.',
        };
        m.getCalendar.mockResolvedValue(calendarEnvelope([calendarItem({
            conflict_status: 'approved_overlap',
            has_conflict: true,
            conflict_level: 'blocking',
            conflict_message: 'Pengajuan ini bentrok dengan peminjaman yang sudah disetujui.',
            conflicts: [conflict],
        })]));
        m.getBooking.mockResolvedValue(booking({
            conflict_status: 'approved_overlap',
            has_conflict: true,
            conflict_level: 'blocking',
            conflict_message: 'Pengajuan ini bentrok dengan peminjaman yang sudah disetujui.',
            conflicts: [conflict],
        }));

        await renderPeminjamanRuanganAdmin();
        openCalendar();
        await flush();

        expect(document.body.textContent).toContain('Bentrok dengan jadwal disetujui');

        document.querySelector<HTMLElement>('[data-admin-calendar-detail="44"]')?.click();
        await flush();

        expect(document.body.textContent).toContain('Super Admin hanya memantau');
        expect(document.body.textContent).toContain('persetujuan tetap dicegah oleh sistem');
        expect(document.getElementById('approve-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('revise-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('reject-tendik-peminjaman')).toBeNull();
        expect(document.body.textContent).not.toMatch(/Relokasi|Delegasi|Override|Prioritas/i);
    });

    it('selects calendar dates with Enter and Space', async () => {
        await renderPeminjamanRuanganAdmin();
        openCalendar();
        await flush();

        document
            .querySelector<HTMLElement>(`[data-admin-calendar-date="${currentMonthKey()}-15"]`)
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(document.getElementById('admin-calendar-day-drawer-root')).not.toBeNull();

        document.getElementById('close-admin-calendar-day')?.click();
        document
            .querySelector<HTMLElement>(`[data-admin-calendar-date="${currentMonthKey()}-15"]`)
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        expect(document.getElementById('admin-calendar-day-drawer-root')).not.toBeNull();
    });

    it('moves calendar focus with arrow keys and PageDown', async () => {
        await renderPeminjamanRuanganAdmin();
        openCalendar();
        await flush();

        const startDateKey = `${currentMonthKey()}-15`;
        const nextDateKey = `${currentMonthKey()}-16`;
        const startButton = document.querySelector<HTMLElement>(`[data-admin-calendar-date="${startDateKey}"]`);
        startButton?.focus();
        startButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

        expect(document.activeElement?.getAttribute('data-admin-calendar-date')).toBe(nextDateKey);

        const pageDownDateKey = shiftMonthDateKey(nextDateKey, 1);
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
        await flush();

        expect(latestCalendarMonthCall()?.month).toBe(pageDownDateKey.slice(0, 7));
        expect(document.activeElement?.getAttribute('data-admin-calendar-date')).toBe(pageDownDateKey);
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

        expect(document.body.textContent).toContain('0 peminjaman pada tanggal ini mengikuti filter aktif.');
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
