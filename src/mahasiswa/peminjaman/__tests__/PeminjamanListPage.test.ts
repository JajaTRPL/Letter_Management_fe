// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    getBookings: vi.fn(),
    getBooking: vi.fn(),
}));

vi.mock('../../../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: (_title: string, content: string) => {
        document.body.innerHTML = content;
    },
}));

vi.mock('../api', () => ({
    getMahasiswaBookings: m.getBookings,
    getMahasiswaBooking: m.getBooking,
    getPeminjamanRooms: vi.fn(async () => []),
    getPeminjamanAvailability: vi.fn(async () => []),
    createMahasiswaBooking: vi.fn(),
    updateMahasiswaBooking: vi.fn(),
    resubmitMahasiswaBooking: vi.fn(),
    withdrawMahasiswaBooking: vi.fn(),
    replaceSuratPeminjamanPdf: vi.fn(),
    downloadSuratPeminjamanPdf: vi.fn(),
    downloadRoomTemplate: vi.fn(),
    fetchRoomPhotoObjectUrl: vi.fn(),
    getPeminjamanRoomDetail: vi.fn(),
    suratPeminjamanPreviewUrl: (id: number) =>
        `/api/peminjaman-ruangan/${id}/attachment/surat-peminjaman/preview`,
    PeminjamanApiError: class extends Error {},
}));

vi.mock('../../../shared/protected-pdf-viewer', () => ({
    renderProtectedPdfViewer: () => '<div data-protected-pdf-viewer></div>',
    attachProtectedPdfViewer: () => () => {},
}));

vi.mock('toastify-js', () => ({
    default: vi.fn(() => ({ showToast: vi.fn() })),
}));

import { renderPeminjamanListPage } from '../list-page';
import type { MahasiswaBooking, Room } from '../types';

const room: Room = {
    id: 10,
    code: 'KLS-10',
    name: 'Ruang Kelas 10',
    type: 'classroom',
    capacity: 40,
    location: 'Gedung A',
    description: null,
    is_active: true,
    owning_laboratory: null,
};

const booking = (overrides: Partial<MahasiswaBooking> = {}): MahasiswaBooking => ({
    id: 51,
    room,
    activity_name: 'Rapat Organisasi',
    purpose: 'Koordinasi.',
    participant_count: 20,
    start_at: '2026-06-20T10:00:00+07:00',
    end_at: '2026-06-20T12:00:00+07:00',
    status: 'submitted',
    reviewer: null,
    reviewed_at: null,
    revision_note: null,
    rejection_reason: null,
    cancellation_reason: null,
    created_at: '2026-06-18T09:00:00+07:00',
    updated_at: '2026-06-18T09:00:00+07:00',
    ...overrides,
});

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    m.getBookings.mockReset();
    m.getBooking.mockReset();
});

describe('Peminjaman list page (Pengajuan Saya)', () => {
    it('shows loading, then renders cards with lifecycle badges and references', async () => {
        m.getBookings.mockResolvedValue([
            booking(),
            booking({
                id: 52,
                status: 'submitted',
                effective_status: 'under_review',
                review_started_at: '2026-06-18T11:00:00+07:00',
                submission_iteration: 2,
                created_at: '2026-06-19T09:00:00+07:00',
            }),
        ]);

        const rendering = renderPeminjamanListPage();
        expect(document.querySelector('[data-state="loading"]')).not.toBeNull();
        await rendering;
        await flush();

        expect(document.querySelector('[data-state="success"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Pengajuan #51');
        expect(document.body.textContent).toContain('Pengajuan #52');
        // Backend effective status wins over the stored status label.
        expect(document.body.textContent).toContain('Sedang Ditinjau');
        expect(document.body.textContent).toContain('Diajukan');
        // Iteration badge only when a resubmission happened.
        expect(document.body.textContent).toContain('Pengajuan ke-2');
    });

    it('renders the empty state with a create action', async () => {
        m.getBookings.mockResolvedValue([]);
        await renderPeminjamanListPage();
        await flush();

        expect(document.querySelector('[data-state="empty"]')).not.toBeNull();
        expect(document.getElementById('peminjaman-list-create-empty')).not.toBeNull();
    });

    it('renders the error state and retries successfully', async () => {
        m.getBookings
            .mockRejectedValueOnce(new Error('Gagal memuat daftar pengajuan.'))
            .mockResolvedValueOnce([booking()]);

        await renderPeminjamanListPage();
        await flush();
        expect(document.querySelector('[data-state="error"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Gagal memuat daftar pengajuan.');

        document.getElementById('peminjaman-list-retry')?.click();
        await flush();
        expect(document.querySelector('[data-state="success"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Pengajuan #51');
    });

    it('shows the pending-cancellation chip from the API summary', async () => {
        m.getBookings.mockResolvedValue([booking({
            cancellation_request: {
                id: 9,
                status: 'pending',
                reason: 'Kegiatan dibatalkan.',
                requested_at: '2026-06-19T08:00:00+07:00',
                decision_note: null,
                decided_at: null,
                responsible_role: 'sarpras',
                available_applicant_action: null,
            },
        })]);

        await renderPeminjamanListPage();
        await flush();
        expect(document.body.textContent)
            .toContain('Permohonan Pembatalan Sedang Ditinjau');
    });

    it('opens the shared detail dialog from a card', async () => {
        m.getBookings.mockResolvedValue([booking()]);
        m.getBooking.mockResolvedValue(booking());

        await renderPeminjamanListPage();
        await flush();
        document.querySelector<HTMLElement>('[data-action="open-peminjaman-detail"]')?.click();
        await flush();

        expect(m.getBooking).toHaveBeenCalledWith(51);
        expect(document.body.textContent).toContain('Detail Peminjaman Ruangan');
    });

    it('falls back safely for an unknown effective status', async () => {
        m.getBookings.mockResolvedValue([booking({
            effective_status: 'some_future_state',
        })]);

        await renderPeminjamanListPage();
        await flush();
        // Never render a raw enum; the fallback label appears instead.
        expect(document.body.textContent).not.toContain('some_future_state');
        expect(document.body.textContent).toContain('Status Tidak Dikenal');
    });
});
