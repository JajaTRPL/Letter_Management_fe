// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    getProfile: vi.fn(),
    getBookings: vi.fn(),
    getBooking: vi.fn(),
    approve: vi.fn(),
    revise: vi.fn(),
    reject: vi.fn(),
    downloadSurat: vi.fn(),
    attachViewer: vi.fn(() => () => {}),
    renderLayout: vi.fn(),
    // shared room-management api
    listRooms: vi.fn(),
    bulkDelete: vi.fn(),
    getRoom: vi.fn(),
    createRoom: vi.fn(),
    listPhotos: vi.fn(),
    listFacilities: vi.fn(),
    listFacilityTypes: vi.fn(),
    listTemplates: vi.fn(),
    listAudit: vi.fn(),
    fetchPhoto: vi.fn(),
    toasts: [] as string[],
}));

vi.mock('../../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: (
        title: string,
        content: string,
        role: string,
        activePage: string,
    ) => {
        m.renderLayout(title, content, role, activePage);
        document.body.innerHTML = content;
    },
}));

vi.mock('../../mahasiswa/peminjaman/api', () => {
    class MockPeminjamanApiError extends Error {
        readonly status: number;
        readonly code?: string;
        readonly errors?: Record<string, string[]>;

        constructor(
            message: string,
            status: number,
            code?: string,
            errors?: Record<string, string[]>,
        ) {
            super(message);
            this.status = status;
            this.code = code;
            this.errors = errors;
        }
    }

    return {
        getTendikReviewerProfile: m.getProfile,
        getTendikBookings: m.getBookings,
        getTendikBooking: m.getBooking,
        approveTendikBooking: m.approve,
        reviseTendikBooking: m.revise,
        rejectTendikBooking: m.reject,
        // Requester-side exports pulled in transitively via the shared
        // booking detail/form modules — not exercised by the reviewer page.
        getMahasiswaBooking: vi.fn(),
        getPeminjamanRooms: vi.fn(),
        createMahasiswaBooking: vi.fn(),
        updateMahasiswaBooking: vi.fn(),
        cancelMahasiswaBooking: vi.fn(),
        resubmitMahasiswaBooking: vi.fn(),
        replaceSuratPeminjamanPdf: vi.fn(),
        downloadSuratPeminjamanPdf: m.downloadSurat,
        suratPeminjamanPreviewUrl: (id: number) =>
            `/api/peminjaman-ruangan/${id}/attachment/surat-peminjaman/preview`,
        PeminjamanApiError: MockPeminjamanApiError,
    };
});

vi.mock('../../shared/protected-pdf-viewer', () => ({
    renderProtectedPdfViewer: () => '<div data-protected-pdf-viewer></div>',
    attachProtectedPdfViewer: m.attachViewer,
}));

vi.mock('../../shared/room-management/api', () => ({
    listManagedRooms: m.listRooms,
    bulkDeleteRooms: m.bulkDelete,
    getManagedRoom: m.getRoom,
    createManagedRoom: m.createRoom,
    updateManagedRoom: vi.fn(),
    activateManagedRoom: vi.fn(),
    deactivateManagedRoom: vi.fn(),
    listRoomPhotos: m.listPhotos,
    uploadRoomPhoto: vi.fn(),
    deleteRoomPhoto: vi.fn(),
    setRoomCover: vi.fn(),
    reorderRoomPhotos: vi.fn(),
    fetchRoomPhotoObjectUrl: m.fetchPhoto,
    listFacilityTypes: m.listFacilityTypes,
    createFacilityType: vi.fn(),
    getRoomFacilities: m.listFacilities,
    syncRoomFacilities: vi.fn(),
    listRoomTemplates: m.listTemplates,
    uploadRoomTemplate: vi.fn(),
    activateRoomTemplate: vi.fn(),
    deactivateRoomTemplate: vi.fn(),
    downloadRoomTemplate: vi.fn(),
    listRoomAuditLogs: m.listAudit,
}));

vi.mock('toastify-js', () => ({
    default: vi.fn((options: { text: string }) => ({
        showToast: () => m.toasts.push(options.text),
    })),
}));

import { PeminjamanApiError } from '../../mahasiswa/peminjaman/api';
import type {
    TendikBooking,
    TendikReviewerRole,
} from '../../mahasiswa/peminjaman/types';
import type { ManagedRoom } from '../../shared/room-management/types';
import { renderPeminjamanRuanganTendik } from '../PeminjamanRuanganTendik';
import pageSource from '../PeminjamanRuanganTendik.ts?raw';

const room = {
    id: 9,
    code: 'KLS-09',
    name: 'Ruang <img src=x onerror=unsafe()>',
    type: 'classroom' as const,
    capacity: 40,
    location: 'Gedung A',
    description: null,
    is_active: true,
    owning_laboratory: null,
};

const booking = (overrides: Partial<TendikBooking> = {}): TendikBooking => ({
    id: 71,
    room,
    requester: {
        id: 20,
        name: 'Mahasiswa <script>unsafe()</script>',
        email: 'mahasiswa@example.test',
    },
    activity_name: 'Seminar <script>unsafe()</script>',
    purpose: 'Kegiatan akademik <img src=x onerror=unsafe()>',
    participant_count: 30,
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
        id: 1,
        from_status: null,
        to_status: 'submitted',
        actor: {
            id: 20,
            name: 'Mahasiswa <script>unsafe()</script>',
            email: 'mahasiswa@example.test',
        },
        note: 'Catatan <b>tidak dieksekusi</b>',
        created_at: '2026-06-18T09:00:00+07:00',
    }],
    ...overrides,
});

const envelope = (items: TendikBooking[] = [booking()]) => ({
    message: 'ok',
    data: items,
    meta: {
        current_page: 1,
        per_page: 10,
        total: items.length,
        last_page: 1,
    },
});

const profile = (role: TendikReviewerRole) => ({
    id: 5,
    name: 'Reviewer',
    role: 'tendik',
    tendik_role: role,
});

const managedRoom = (overrides: Partial<ManagedRoom> = {}): ManagedRoom => ({
    id: 9,
    code: 'KLS-09',
    name: 'Ruang <img src=x onerror=unsafe()>',
    type: 'classroom',
    capacity: 40,
    location: 'Gedung A',
    description: null,
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
        can_create: false,
        can_deactivate: false,
        can_activate: false,
    },
    ...overrides,
});

const openRoomsTab = async (): Promise<void> => {
    document.querySelector<HTMLElement>('[data-tendik-tab="rooms"]')?.click();
    await flush();
};

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

const setValue = (id: string, value: string): void => {
    const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    element.value = value;
};

const submit = (id: string): void => {
    document.getElementById(id)?.dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true,
    }));
};

const openDetail = async (): Promise<void> => {
    document.querySelector<HTMLButtonElement>('[data-tendik-booking-detail="71"]')?.click();
    await flush();
};

beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    Object.values(m).forEach((value) => {
        if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
    });
    m.toasts = [];
    m.getProfile.mockResolvedValue(profile('sarpras'));
    m.getBookings.mockResolvedValue(envelope());
    m.getBooking.mockResolvedValue(booking());
    m.approve.mockResolvedValue(booking({ status: 'approved' }));
    m.revise.mockResolvedValue(booking({ status: 'revision_requested' }));
    m.reject.mockResolvedValue(booking({ status: 'rejected' }));
    m.listRooms.mockResolvedValue([managedRoom()]);
    m.bulkDelete.mockResolvedValue({ deleted: [], archived: [], summary: { deleted: 0, archived: 0, total: 0 } });
    m.getRoom.mockResolvedValue(managedRoom());
    m.createRoom.mockResolvedValue(managedRoom());
    m.listPhotos.mockResolvedValue([]);
    m.listFacilities.mockResolvedValue([]);
    m.listFacilityTypes.mockResolvedValue([]);
    m.listTemplates.mockResolvedValue([]);
    m.listAudit.mockResolvedValue([]);
});

describe('Tendik Peminjaman reviewer page', () => {
    it('renders loading, empty, error/retry, and success queue states', async () => {
        let resolveQueue!: (value: ReturnType<typeof envelope>) => void;
        m.getBookings.mockReturnValueOnce(new Promise((resolve) => {
            resolveQueue = resolve;
        }));
        const rendering = renderPeminjamanRuanganTendik();
        expect(document.querySelector('[data-reviewer-queue-state="loading"]')).not.toBeNull();
        resolveQueue(envelope([]));
        await rendering;
        expect(document.querySelector('[data-reviewer-queue-state="empty"]')).not.toBeNull();

        m.getBookings
            .mockRejectedValueOnce(new Error('Antrean sementara gagal.'))
            .mockResolvedValueOnce(envelope());
        await renderPeminjamanRuanganTendik();
        expect(document.querySelector('[data-reviewer-queue-state="error"]')).not.toBeNull();
        document.getElementById('retry-tendik-peminjaman')?.click();
        await flush();
        expect(document.querySelector('[data-reviewer-queue-state="success"]')).not.toBeNull();
    });

    it('sends status, room type, room, date, and pagination filters', async () => {
        await renderPeminjamanRuanganTendik();
        setValue('tendik-peminjaman-status', 'submitted');
        setValue('tendik-peminjaman-room-type', 'classroom');
        setValue('tendik-peminjaman-room-id', '9');
        setValue('tendik-peminjaman-date-from', '2026-06-20');
        setValue('tendik-peminjaman-date-to', '2026-06-30');
        submit('tendik-peminjaman-filters');
        await flush();

        expect(m.getBookings).toHaveBeenLastCalledWith({
            status: 'submitted',
            roomType: 'classroom',
            roomId: 9,
            dateFrom: '2026-06-20',
            dateTo: '2026-06-30',
            page: 1,
            perPage: 10,
        });
    });

    it('renders requester, room, activity, purpose, and history without executing API HTML', async () => {
        await renderPeminjamanRuanganTendik();
        await openDetail();

        expect(document.body.textContent).toContain('Mahasiswa <script>unsafe()</script>');
        expect(document.body.textContent).toContain('Catatan <b>tidak dieksekusi</b>');
        expect(document.querySelector('script')).toBeNull();
        expect(document.querySelector('img[src="x"]')).toBeNull();
        expect(document.body.textContent).toContain('Riwayat Status');
    });

    it.each(['sarpras', 'kepala_lab'] as TendikReviewerRole[])(
        'shows reviewer action buttons for %s while backend remains authoritative',
        async (role) => {
            const roleRoom = role === 'kepala_lab'
                ? {
                    ...room,
                    id: 10,
                    code: 'LAB-10',
                    type: 'laboratory' as const,
                    owning_laboratory: { id: 2, code: 'LAB', name: 'Lab Uji' },
                }
                : room;
            const roleBooking = booking({ room: roleRoom });
            m.getProfile.mockResolvedValue(profile(role));
            m.getBookings.mockResolvedValue(envelope([roleBooking]));
            m.getBooking.mockResolvedValue(roleBooking);
            await renderPeminjamanRuanganTendik();
            document.querySelector<HTMLButtonElement>('[data-tendik-booking-detail="71"]')?.click();
            await flush();

            expect(document.getElementById('approve-tendik-peminjaman')).not.toBeNull();
            expect(document.getElementById('revise-tendik-peminjaman')).not.toBeNull();
            expect(document.getElementById('reject-tendik-peminjaman')).not.toBeNull();
        },
    );

    it('shows Laboran read-only mode and no mutation buttons', async () => {
        const withPdf = booking({
            surat_peminjaman_pdf: {
                exists: true,
                original_name: 'Surat Laboran.pdf',
                size_bytes: 1024,
                uploaded_at: '2026-06-18T10:00:00+07:00',
            },
        });
        m.getProfile.mockResolvedValue(profile('laboran'));
        m.getBooking.mockResolvedValue(withPdf);
        await renderPeminjamanRuanganTendik();
        await openDetail();

        expect(document.querySelector('[data-reviewer-role="laboran"]')?.textContent)
            .toContain('Akses baca saja');
        // PDF evidence is visible to the monitor role…
        expect(document.getElementById('peminjaman-surat-preview')).not.toBeNull();
        expect(document.getElementById('peminjaman-surat-download')).not.toBeNull();
        // …but preview access grants no mutation or upload authority.
        expect(document.getElementById('approve-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('revise-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('reject-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('peminjaman-surat-replace-input')).toBeNull();
    });

    it('shows surat PDF metadata with protected preview/download and no replacement uploader', async () => {
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
        await renderPeminjamanRuanganTendik();
        await openDetail();

        expect(document.body.textContent).toContain('Surat Peminjaman');
        expect(document.body.textContent).toContain('Surat <b>Final</b>.pdf');
        expect(document.querySelector('b')).toBeNull();
        expect(document.body.textContent).toContain('200.0 KB');
        // Even on revision_requested, the reviewer never gets the requester's
        // replacement uploader (owner-only endpoint).
        expect(document.getElementById('peminjaman-surat-replace-input')).toBeNull();
        expect(document.getElementById('peminjaman-surat-replace-submit')).toBeNull();

        document.getElementById('peminjaman-surat-preview')?.click();
        expect(document.getElementById('peminjaman-surat-preview-root')).not.toBeNull();
        expect(m.attachViewer).toHaveBeenCalledWith(expect.objectContaining({
            endpointUrl: '/api/peminjaman-ruangan/71/attachment/surat-peminjaman/preview',
        }));

        document.getElementById('peminjaman-surat-download')?.click();
        await flush();
        expect(m.downloadSurat).toHaveBeenCalledWith(71, 'Surat <b>Final</b>.pdf');
    });

    it('shows a safe empty state when the surat is missing and surfaces download errors', async () => {
        await renderPeminjamanRuanganTendik();
        await openDetail();
        expect(document.body.textContent).toContain('Surat peminjaman belum tersedia.');
        expect(document.getElementById('peminjaman-surat-preview')).toBeNull();
        expect(document.getElementById('peminjaman-surat-download')).toBeNull();

        const withPdf = booking({
            surat_peminjaman_pdf: { exists: true, original_name: 'Surat.pdf', size_bytes: 100 },
        });
        m.getBooking.mockResolvedValue(withPdf);
        m.downloadSurat.mockRejectedValueOnce(new Error('Anda tidak berwenang mengunduh surat ini.'));
        document.getElementById('close-tendik-peminjaman-detail')?.click();
        await openDetail();
        document.getElementById('peminjaman-surat-download')?.click();
        await flush();
        expect(m.toasts).toContain('Anda tidak berwenang mengunduh surat ini.');
    });

    it('renders the backend 403 no-access state for Persuratan Tendik', async () => {
        m.getProfile.mockResolvedValue(profile('persuratan'));
        m.getBookings.mockRejectedValue(new PeminjamanApiError('Forbidden', 403));
        await renderPeminjamanRuanganTendik();

        expect(document.querySelector('[data-reviewer-role="persuratan"]')).not.toBeNull();
        expect(document.querySelector('[data-reviewer-queue-state="unauthorized"]')).not.toBeNull();
        expect(document.body.textContent).toContain('tidak memiliki akses');
    });

    it('approves through the correct action and shows a clear 409 conflict', async () => {
        m.approve.mockRejectedValueOnce(
            new PeminjamanApiError('The room overlaps.', 409, 'booking_conflict'),
        );
        await renderPeminjamanRuanganTendik();
        await openDetail();
        document.getElementById('approve-tendik-peminjaman')?.click();
        submit('tendik-peminjaman-action-form');
        await flush();

        expect(m.approve).toHaveBeenCalledWith(71);
        expect(document.body.textContent).toContain(
            'Jadwal bertabrakan dengan peminjaman yang sudah disetujui.',
        );
    });

    it('requires a revision note, sends it, and refreshes queue/detail', async () => {
        await renderPeminjamanRuanganTendik();
        await openDetail();
        document.getElementById('revise-tendik-peminjaman')?.click();
        submit('tendik-peminjaman-action-form');
        expect(m.revise).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('Catatan revisi wajib diisi.');

        setValue('tendik-peminjaman-action-text', 'Sesuaikan jumlah peserta.');
        submit('tendik-peminjaman-action-form');
        await flush();

        expect(m.revise).toHaveBeenCalledWith(71, 'Sesuaikan jumlah peserta.');
        expect(m.getBookings.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(m.getBooking.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('requires a rejection reason and sends it', async () => {
        await renderPeminjamanRuanganTendik();
        await openDetail();
        document.getElementById('reject-tendik-peminjaman')?.click();
        submit('tendik-peminjaman-action-form');
        expect(m.reject).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('Alasan penolakan wajib diisi.');

        setValue('tendik-peminjaman-action-text', 'Ruangan dipakai agenda departemen.');
        submit('tendik-peminjaman-action-form');
        await flush();

        expect(m.reject).toHaveBeenCalledWith(71, 'Ruangan dipakai agenda departemen.');
    });

    it('renders backend 422 action errors and detail 404 errors safely', async () => {
        m.revise.mockRejectedValueOnce(new PeminjamanApiError(
            'Validasi gagal.',
            422,
            undefined,
            { note: ['Catatan revisi tidak valid.'] },
        ));
        await renderPeminjamanRuanganTendik();
        await openDetail();
        document.getElementById('revise-tendik-peminjaman')?.click();
        setValue('tendik-peminjaman-action-text', 'x');
        submit('tendik-peminjaman-action-form');
        await flush();
        expect(document.body.textContent).toContain('Catatan revisi tidak valid.');

        document.getElementById('cancel-tendik-peminjaman-action')?.click();
        document.getElementById('close-tendik-peminjaman-detail')?.click();
        m.getBooking.mockRejectedValueOnce(new PeminjamanApiError('Not found', 404));
        await openDetail();
        expect(document.body.textContent).toContain('tidak ditemukan');
    });

    it('removes mutation buttons when the backend denies an action with 403', async () => {
        m.approve.mockRejectedValueOnce(new PeminjamanApiError('Forbidden', 403));
        await renderPeminjamanRuanganTendik();
        await openDetail();
        document.getElementById('approve-tendik-peminjaman')?.click();
        submit('tendik-peminjaman-action-form');
        await flush();

        expect(document.body.textContent).toContain('tidak memiliki akses');
        expect(document.getElementById('approve-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('revise-tendik-peminjaman')).toBeNull();
        expect(document.getElementById('reject-tendik-peminjaman')).toBeNull();
    });

    it('has no separate API origin, localhost dependency, or raw HTML rendering', () => {
        expect(pageSource).not.toContain('VITE_API_BASE_URL');
        expect(pageSource).not.toContain('localhost');
        expect(pageSource).not.toContain('innerHTML = booking.');
        // Surat access must stay on the protected application API.
        expect(pageSource).not.toContain('/storage');
        expect(pageSource).not.toContain('/api/room-bookings');
        expect(pageSource).not.toContain('window.open');
        expect(pageSource).not.toContain('<iframe');
    });
});

describe('Tendik "Kelola Ruangan" management tab', () => {
    it('offers the management tab and a create button for Sarpras', async () => {
        m.getProfile.mockResolvedValue(profile('sarpras'));
        await renderPeminjamanRuanganTendik();
        await flush();

        expect(document.querySelector('[data-tendik-tab="rooms"]')).not.toBeNull();
        await openRoomsTab();

        expect(m.listRooms).toHaveBeenCalled();
        expect(document.querySelector('[data-tendik-rooms-state="success"]')).not.toBeNull();
        // Sarpras may create classrooms.
        expect(document.getElementById('tendik-rooms-add')).not.toBeNull();
    });

    it('shows the management tab for Laboran without a create button', async () => {
        m.getProfile.mockResolvedValue(profile('laboran'));
        await renderPeminjamanRuanganTendik();
        await flush();

        expect(document.querySelector('[data-tendik-tab="rooms"]')).not.toBeNull();
        await openRoomsTab();

        expect(document.querySelector('[data-tendik-rooms-state="success"]')).not.toBeNull();
        // Laboran maintains data but cannot create/deactivate rooms.
        expect(document.getElementById('tendik-rooms-add')).toBeNull();
    });

    it('shows the management tab for Kepala Lab without a create button', async () => {
        m.getProfile.mockResolvedValue(profile('kepala_lab'));
        await renderPeminjamanRuanganTendik();
        await flush();

        expect(document.querySelector('[data-tendik-tab="rooms"]')).not.toBeNull();
        await openRoomsTab();
        expect(document.getElementById('tendik-rooms-add')).toBeNull();
    });

    it('hides the management tab for Persuratan (review-only)', async () => {
        m.getProfile.mockResolvedValue(profile('persuratan'));
        await renderPeminjamanRuanganTendik();
        await flush();

        expect(document.querySelector('[data-tendik-tab="rooms"]')).toBeNull();
    });

    it('opens the management drawer from a room row', async () => {
        m.getProfile.mockResolvedValue(profile('sarpras'));
        await renderPeminjamanRuanganTendik();
        await flush();
        await openRoomsTab();

        document.querySelector<HTMLButtonElement>('[data-room-mgmt-open="9"]')?.click();
        await flush();

        expect(document.getElementById('room-management-drawer-root')).not.toBeNull();
        expect(m.getRoom).toHaveBeenCalledWith(9);
    });

    it('escapes room text and shows health badges in the management table', async () => {
        m.getProfile.mockResolvedValue(profile('sarpras'));
        await renderPeminjamanRuanganTendik();
        await flush();
        await openRoomsTab();

        expect(document.body.textContent).toContain('Ruang <img src=x onerror=unsafe()>');
        expect(document.querySelector('img[src="x"]')).toBeNull();
        expect(document.body.textContent).toContain('Belum ada foto');
    });
});

describe('Tendik room bulk selection (backend-flag gated)', () => {
    // A room the backend says this reviewer may remove (can_deactivate=true) —
    // e.g. a classroom for Sarpras.
    const deletable = (over: Partial<ManagedRoom> = {}): ManagedRoom => managedRoom({
        ...over,
        management_flags: {
            can_edit_info: true, can_manage_media: true, can_manage_facilities: true,
            can_manage_templates: true, can_create: false, can_deactivate: true, can_activate: true,
        },
    });

    const rowCheckbox = (id: number): HTMLInputElement =>
        document.querySelector(`.room-checkbox[data-room-id="${id}"]`) as HTMLInputElement;

    const check = (element: HTMLInputElement, value = true): void => {
        element.checked = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const barHidden = (): boolean =>
        document.getElementById('room-bulk-bar')?.classList.contains('hidden') ?? true;

    it('Sarpras sees a checkbox column and can bulk-delete classrooms', async () => {
        m.getProfile.mockResolvedValue(profile('sarpras'));
        m.listRooms.mockResolvedValue([deletable({ id: 9, code: 'KLS-09' })]);
        m.bulkDelete.mockResolvedValue({
            deleted: [{ id: 9, code: 'KLS-09' }], archived: [], summary: { deleted: 1, archived: 0, total: 1 },
        });
        await renderPeminjamanRuanganTendik();
        await flush();
        await openRoomsTab();

        expect(document.querySelector('[data-room-select-all]')).not.toBeNull();
        expect(rowCheckbox(9)).not.toBeNull();
        expect(barHidden()).toBe(true);

        check(rowCheckbox(9));
        expect(barHidden()).toBe(false);
        expect(document.getElementById('room-bulk-count')?.textContent).toContain('1 ruangan dipilih');

        document.getElementById('room-bulk-delete')?.click();
        expect(document.getElementById('room-bulk-confirm-root')).not.toBeNull();
        expect(document.body.textContent).toContain('Hapus Ruangan Terpilih?');
        expect(document.body.textContent).toContain('diarsipkan');

        const callsBefore = m.listRooms.mock.calls.length;
        document.getElementById('room-bulk-confirm-ok')?.click();
        await flush();

        expect(m.bulkDelete).toHaveBeenCalledWith([9]);
        expect(m.toasts.some((t) => t.includes('1 ruangan berhasil dihapus'))).toBe(true);
        expect(m.listRooms.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('select-all picks every selectable classroom for Sarpras', async () => {
        m.getProfile.mockResolvedValue(profile('sarpras'));
        m.listRooms.mockResolvedValue([deletable({ id: 9, code: 'KLS-09' }), deletable({ id: 10, code: 'KLS-10' })]);
        await renderPeminjamanRuanganTendik();
        await flush();
        await openRoomsTab();

        const selectAll = document.querySelector('[data-room-select-all]') as HTMLInputElement;
        check(selectAll);
        expect(document.getElementById('room-bulk-count')?.textContent).toContain('2 ruangan dipilih');
        expect(rowCheckbox(9).checked).toBe(true);
        expect(rowCheckbox(10).checked).toBe(true);
    });

    it('Kepala Lab sees bulk controls for own-lab rooms and can bulk-delete', async () => {
        // Backend now returns can_deactivate=true for a Kepala Lab's own-lab
        // rooms, so the flag-driven UI surfaces checkboxes automatically.
        m.getProfile.mockResolvedValue(profile('kepala_lab'));
        m.listRooms.mockResolvedValue([deletable({
            id: 30, code: 'LAB-30', type: 'laboratory', owning_laboratory: { id: 1, code: 'RPL', name: 'Lab RPL' },
        })]);
        m.bulkDelete.mockResolvedValue({
            deleted: [{ id: 30, code: 'LAB-30' }], archived: [], summary: { deleted: 1, archived: 0, total: 1 },
        });
        await renderPeminjamanRuanganTendik();
        await flush();
        await openRoomsTab();

        expect(document.querySelector('[data-room-select-all]')).not.toBeNull();
        expect(rowCheckbox(30)).not.toBeNull();

        check(rowCheckbox(30));
        expect(barHidden()).toBe(false);
        document.getElementById('room-bulk-delete')?.click();
        document.getElementById('room-bulk-confirm-ok')?.click();
        await flush();

        expect(m.bulkDelete).toHaveBeenCalledWith([30]);
        expect(m.toasts.some((t) => t.includes('1 ruangan berhasil dihapus'))).toBe(true);
    });

    it('Laboran gets no bulk controls (flag false → hidden)', async () => {
        m.getProfile.mockResolvedValue(profile('laboran'));
        m.listRooms.mockResolvedValue([managedRoom({
            id: 31, code: 'LAB-31', type: 'laboratory', owning_laboratory: { id: 2, code: 'NET', name: 'Lab Jaringan' },
        })]);
        await renderPeminjamanRuanganTendik();
        await flush();
        await openRoomsTab();

        expect(document.querySelector('[data-tendik-rooms-state="success"]')).not.toBeNull();
        expect(document.querySelector('[data-room-select-all]')).toBeNull();
        expect(document.querySelector('.room-checkbox')).toBeNull();
        expect(document.getElementById('room-bulk-bar')).toBeNull();
    });
});
