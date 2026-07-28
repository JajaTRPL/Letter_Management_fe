// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    getRooms: vi.fn(),
    getAvailability: vi.fn(),
    getBookings: vi.fn(),
    getBooking: vi.fn(),
    createBooking: vi.fn(),
    updateBooking: vi.fn(),
    resubmitBooking: vi.fn(),
    cancelBooking: vi.fn(),
    renderDashboardLayout: vi.fn(),
    renderMahasiswaDashboard: vi.fn(),
    toastMessages: [] as string[],
}));

vi.mock('../../../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: (
        title: string,
        content: string,
        role: string,
        activePage: string,
    ) => {
        m.renderDashboardLayout(title, content, role, activePage);
        document.body.innerHTML = content;
    },
}));

vi.mock('../../../dashboard/MahasiswaDashboard', () => ({
    renderMahasiswaDashboard: m.renderMahasiswaDashboard,
}));

vi.mock('../api', () => ({
    getPeminjamanRooms: m.getRooms,
    getPeminjamanAvailability: m.getAvailability,
    getMahasiswaBookings: m.getBookings,
    getMahasiswaBooking: m.getBooking,
    createMahasiswaBooking: m.createBooking,
    updateMahasiswaBooking: m.updateBooking,
    resubmitMahasiswaBooking: m.resubmitBooking,
    withdrawMahasiswaBooking: m.cancelBooking,
    PeminjamanApiError: class extends Error {},
}));

vi.mock('../../../shared/protected-pdf-viewer', () => ({
    renderProtectedPdfViewer: () => '<div data-protected-pdf-viewer></div>',
    attachProtectedPdfViewer: () => () => {},
}));

vi.mock('toastify-js', () => ({
    default: vi.fn((options: { text: string }) => ({
        showToast: () => {
            m.toastMessages.push(options.text);
        },
    })),
}));

import pageSource from '../../PeminjamanRuangan.ts?raw';
import { renderPeminjamanRuangan } from '../../PeminjamanRuangan';
import type {
    AvailabilityItem,
    Room,
} from '../types';

const activeRoom: Room = {
    id: 10,
    code: 'API-KLS-10',
    name: 'Ruang API <script>unsafe()</script>',
    type: 'classroom',
    capacity: 40,
    location: 'Gedung API',
    description: null,
    is_active: true,
    owning_laboratory: null,
};

const approvedAvailability: AvailabilityItem = {
    room: {
        id: activeRoom.id,
        code: activeRoom.code,
        name: activeRoom.name,
        type: activeRoom.type,
    },
    start_at: '2026-06-20T10:00:00+07:00',
    end_at: '2026-06-20T12:00:00+07:00',
    lifecycle_category: 'approved',
    activity_titles: ['Sidang'],
    request_count: 1,
};

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T02:00:00Z'));
    document.body.innerHTML = '<div id="app"></div>';
    m.getRooms.mockReset();
    m.getAvailability.mockReset();
    m.getBookings.mockReset();
    m.getBooking.mockReset();
    m.createBooking.mockReset();
    m.updateBooking.mockReset();
    m.resubmitBooking.mockReset();
    m.cancelBooking.mockReset();
    m.getBookings.mockResolvedValue([]);
    m.renderDashboardLayout.mockReset();
    m.renderMahasiswaDashboard.mockReset();
    m.toastMessages = [];
});

afterEach(() => {
    vi.useRealTimers();
});

describe('Mahasiswa Peminjaman page API foundation', () => {
    it('renders the loading state while API requests are pending', async () => {
        const roomsRequest = deferred<Room[]>();
        const availabilityRequest = deferred<AvailabilityItem[]>();
        m.getRooms.mockReturnValue(roomsRequest.promise);
        m.getAvailability.mockReturnValue(availabilityRequest.promise);

        const rendering = renderPeminjamanRuangan();

        expect(document.querySelector('[data-state="loading"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Memuat layanan peminjaman ruangan');

        roomsRequest.resolve([]);
        availabilityRequest.resolve([]);
        await rendering;
    });

    it('renders the empty state when no active room or availability exists', async () => {
        m.getRooms.mockResolvedValue([]);
        m.getAvailability.mockResolvedValue([]);

        await renderPeminjamanRuangan();

        expect(document.querySelector('[data-state="empty"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Belum ada data peminjaman');
    });

    it('renders an API error state and retry control', async () => {
        m.getRooms.mockRejectedValue(new Error('API peminjaman tidak tersedia.'));
        m.getAvailability.mockResolvedValue([]);

        await renderPeminjamanRuangan();

        expect(document.querySelector('[data-state="error"]')).not.toBeNull();
        expect(document.body.textContent).toContain('API peminjaman tidak tersedia.');
        expect(document.getElementById('btn-retry-peminjaman')).not.toBeNull();
    });

    it('renders active rooms and approved availability without executing API HTML', async () => {
        const availabilityWithPrivateFields = {
            ...approvedAvailability,
            purpose: 'PRIVATE PURPOSE MUST NOT RENDER',
            requester: { name: 'PRIVATE REQUESTER MUST NOT RENDER' },
            reviewer: { name: 'PRIVATE REVIEWER MUST NOT RENDER' },
            revision_note: 'PRIVATE NOTE MUST NOT RENDER',
        };
        m.getRooms.mockResolvedValue([activeRoom]);
        m.getAvailability.mockResolvedValue([availabilityWithPrivateFields]);

        await renderPeminjamanRuangan();

        expect(document.querySelector('[data-state="success"]')).not.toBeNull();
        expect(document.body.textContent).toContain('API-KLS-10');
        expect(document.body.textContent).toContain('Ruang API <script>unsafe()</script>');
        expect(document.querySelector('script')).toBeNull();

        // Landing follows the Administrasi Surat pattern: personal tracking
        // lives in Dashboard/Riwayat, and the category card itself is the CTA.
        expect(document.body.textContent).not.toContain('Pengajuan Peminjaman Saya');
        expect(document.body.textContent).not.toContain('Klik untuk mengajukan');
        expect(document.body.textContent).toContain('1–2 Hari Kerja');
        expect(document.body.textContent).toContain('1 ruang aktif');
        expect(document.body.textContent).toContain('0 lab aktif');
        expect(document.querySelector('button[data-booking-cta]')).toBeNull();
        const kelasCard = document.querySelector('[data-booking-cta="classroom"]');
        expect(kelasCard?.getAttribute('role')).toBe('button');
        expect(kelasCard?.getAttribute('tabindex')).toBe('0');

        const dayButton = document.querySelector<HTMLButtonElement>(
            '[data-date="2026-06-20"]',
        );
        expect(dayButton?.getAttribute('aria-label')).toContain('1 jadwal disetujui');
        dayButton?.click();

        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        expect(document.body.textContent).toContain('10.00–12.00 WIB');
        expect(document.body.textContent).not.toContain('PRIVATE PURPOSE MUST NOT RENDER');
        expect(document.body.textContent).not.toContain('PRIVATE REQUESTER MUST NOT RENDER');
        expect(document.body.textContent).not.toContain('PRIVATE REVIEWER MUST NOT RENDER');
        expect(document.body.textContent).not.toContain('PRIVATE NOTE MUST NOT RENDER');
    });

    it('has no mock generator, prototype room names, separate API origin, or Super Admin drawer dependency', () => {
        expect(pageSource).not.toContain('getMockPeminjamanCalendar');
        expect(pageSource).not.toContain('HU 207');
        expect(pageSource).not.toContain('RPL 1');
        expect(pageSource).not.toContain('VITE_API_BASE_URL');
        expect(pageSource).not.toContain('drawer-utils');
    });

    it('keeps personal tracking off the landing page (moved to Dashboard/Riwayat)', () => {
        expect(pageSource).not.toContain('Pengajuan Peminjaman Saya');
        expect(pageSource).not.toContain('renderBookingList');
        expect(pageSource).not.toContain('Klik untuk mengajukan');
        expect(pageSource).toContain('1–2 Hari Kerja');
        expect(pageSource).toContain('2–3 Hari Kerja');
        expect(pageSource).not.toContain('Ajukan Peminjaman Ruang Kelas</button>');
        expect(pageSource).not.toContain('Ajukan Peminjaman Laboratorium</button>');
    });
});
