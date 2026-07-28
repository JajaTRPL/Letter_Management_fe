// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    getBooking: vi.fn(),
    resubmit: vi.fn(),
    cancel: vi.fn(),
}));

vi.mock('../api', () => {
    // Declared inside the factory: vi.mock is hoisted above module scope.
    class MockPeminjamanApiError extends Error {
        readonly status: number;
        readonly code?: string;
        readonly errors?: Record<string, string[]>;
        readonly data?: Record<string, unknown>;

        constructor(
            message: string,
            status: number,
            code?: string,
            errors?: Record<string, string[]>,
            data?: Record<string, unknown>,
        ) {
            super(message);
            this.status = status;
            this.code = code;
            this.errors = errors;
            this.data = data;
        }
    }

    return {
        getMahasiswaBooking: m.getBooking,
        getMahasiswaBookings: vi.fn(async () => []),
        getPeminjamanRooms: vi.fn(async () => []),
        getPeminjamanAvailability: vi.fn(async () => []),
        createMahasiswaBooking: vi.fn(),
        updateMahasiswaBooking: vi.fn(),
        resubmitMahasiswaBooking: m.resubmit,
        withdrawMahasiswaBooking: m.cancel,
        generateRoomBookingIdempotencyKey: () => 'test-idempotency-key',
        replaceSuratPeminjamanPdf: vi.fn(),
        downloadSuratPeminjamanPdf: vi.fn(),
        downloadRoomTemplate: vi.fn(),
        fetchRoomPhotoObjectUrl: vi.fn(),
        getPeminjamanRoomDetail: vi.fn(),
        suratPeminjamanPreviewUrl: (id: number) =>
            `/api/peminjaman-ruangan/${id}/attachment/surat-peminjaman/preview`,
        PeminjamanApiError: MockPeminjamanApiError,
    };
});

vi.mock('../../../shared/protected-pdf-viewer', () => ({
    renderProtectedPdfViewer: () => '<div data-protected-pdf-viewer></div>',
    attachProtectedPdfViewer: () => () => {},
}));

vi.mock('toastify-js', () => ({
    default: vi.fn(() => ({ showToast: vi.fn() })),
}));

import { PeminjamanApiError } from '../api';
import { openPeminjamanBookingDetail } from '../detail';
import type { BookingCapabilities, MahasiswaBooking, Room } from '../types';

/** Build the mocked api error with the real (message, status, code, errors, data) shape. */
const apiError = (
    message: string,
    status: number,
    code?: string,
    data?: Record<string, unknown>,
): Error => new (PeminjamanApiError as unknown as new (
    message: string,
    status: number,
    code?: string,
    errors?: Record<string, string[]>,
    data?: Record<string, unknown>,
) => Error)(message, status, code, undefined, data);

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

const capabilities = (
    overrides: Partial<BookingCapabilities> = {},
): BookingCapabilities => ({
    can_edit: false,
    can_resubmit: false,
    can_cancel: false,
    can_view_attachment: true,
    can_withdraw: false,
    can_request_cancellation: false,
    can_withdraw_cancellation_request: false,
    withdrawal_block_reason: null,
    next_action: null,
    ...overrides,
});

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
    status_histories: [{
        id: 1,
        from_status: null,
        to_status: 'submitted',
        actor: null,
        note: null,
        created_at: '2026-06-18T09:00:00+07:00',
    }],
    ...overrides,
});

beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    m.getBooking.mockReset();
    m.resubmit.mockReset();
    m.cancel.mockReset();
});

describe('Peminjaman detail lifecycle (C7B2 projection)', () => {
    it('shows the effective status, iteration, and review-start row', async () => {
        m.getBooking.mockResolvedValue(booking({
            effective_status: 'under_review',
            review_started_at: '2026-06-18T11:00:00+07:00',
            submission_iteration: 2,
        }));

        await openPeminjamanBookingDetail(51);

        const badge = document.querySelector('[data-lifecycle-status]');
        expect(badge?.textContent).toContain('Sedang Ditinjau');
        expect(document.body.textContent).toContain('Pengajuan ke-2');
        expect(document.body.textContent).toContain('Mulai Ditinjau');
        expect(document.body.textContent).toContain('#51');
    });

    it('merges review-start and cancellation events into the timeline chronologically', async () => {
        m.getBooking.mockResolvedValue(booking({
            review_started_at: '2026-06-18T11:00:00+07:00',
            cancellation_request: {
                id: 9,
                status: 'rejected',
                reason: 'Kegiatan berubah.',
                requested_at: '2026-06-18T12:00:00+07:00',
                decision_note: 'Jadwal tetap dibutuhkan.',
                decided_at: '2026-06-18T13:00:00+07:00',
                responsible_role: 'sarpras',
                available_applicant_action: null,
            },
        }));

        await openPeminjamanBookingDetail(51);

        const timeline = Array.from(document.querySelectorAll('ol li'))
            .map((item) => item.textContent ?? '');
        const labels = timeline.map((text) => text.trim());
        const submittedIndex = labels.findIndex((text) => text.includes('Pengajuan dikirim'));
        const reviewIndex = labels.findIndex((text) => text.includes('Mulai ditinjau'));
        const requestedIndex = labels.findIndex((text) => text.includes('Pembatalan diajukan'));
        const rejectedIndex = labels.findIndex((text) => text.includes('Pembatalan ditolak'));

        expect(submittedIndex).toBeGreaterThanOrEqual(0);
        expect(reviewIndex).toBeGreaterThan(submittedIndex);
        expect(requestedIndex).toBeGreaterThan(reviewIndex);
        expect(rejectedIndex).toBeGreaterThan(requestedIndex);
        expect(document.body.textContent).toContain('Jadwal tetap dibutuhkan.');
    });

    it('shows the pending cancellation panel and its responsible role', async () => {
        m.getBooking.mockResolvedValue(booking({
            cancellation_pending: true,
            cancellation_request: {
                id: 9,
                status: 'pending',
                reason: 'Kegiatan dibatalkan panitia.',
                requested_at: '2026-06-18T12:00:00+07:00',
                decision_note: null,
                decided_at: null,
                responsible_role: 'sarpras',
                available_applicant_action: 'withdraw_cancellation_request',
            },
        }));

        await openPeminjamanBookingDetail(51);

        const panel = document.querySelector('[data-cancellation-request-panel]');
        expect(panel).not.toBeNull();
        expect(panel?.textContent).toContain('Permohonan Pembatalan Sedang Ditinjau');
        expect(panel?.textContent).toContain('Sarpras');
        expect(panel?.textContent).toContain('Kegiatan dibatalkan panitia.');
    });

    it('capability flags gate the existing actions instead of status guessing', async () => {
        // Backend says: revision status but nothing is allowed (e.g. pending
        // cancellation) — no action buttons may render.
        m.getBooking.mockResolvedValue(booking({
            status: 'revision_requested',
            cancellation_pending: true,
            capabilities: capabilities(),
        }));

        await openPeminjamanBookingDetail(51);

        expect(document.getElementById('edit-peminjaman-booking')).toBeNull();
        expect(document.getElementById('resubmit-peminjaman-booking')).toBeNull();
        expect(document.getElementById('cancel-peminjaman-booking')).toBeNull();
        // The pending state itself blocks the surat replacement uploader too.
        expect(document.getElementById('peminjaman-surat-replace-input')).toBeNull();
    });

    it('capability flags enable the allowed actions', async () => {
        m.getBooking.mockResolvedValue(booking({
            status: 'revision_requested',
            revision_note: 'Perbaiki jumlah peserta.',
            capabilities: capabilities({
                can_edit: true,
                can_resubmit: true,
                can_cancel: true,
            }),
        }));

        await openPeminjamanBookingDetail(51);

        expect(document.getElementById('edit-peminjaman-booking')).not.toBeNull();
        expect(document.getElementById('resubmit-peminjaman-booking')).not.toBeNull();
        expect(document.getElementById('cancel-peminjaman-booking')).not.toBeNull();
    });

    it('does not render any C7C2 withdrawal/cancellation-request action buttons', async () => {
        m.getBooking.mockResolvedValue(booking({
            capabilities: capabilities({
                can_withdraw: true,
                can_request_cancellation: true,
            }),
        }));

        await openPeminjamanBookingDetail(51);

        // C7C1 must not ship half-built high-risk actions: withdrawal and
        // cancellation-request flows arrive in C7C2 with idempotency+version.
        const buttons = Array.from(document.querySelectorAll('button'))
            .map((button) => button.textContent?.trim() ?? '');
        expect(buttons.some((text) => text.includes('Tarik Pengajuan'))).toBe(false);
        expect(buttons.some((text) => text.includes('Ajukan Pembatalan'))).toBe(false);
    });

    it('replaces stale booking state from a 409 before re-rendering actions', async () => {
        // We are showing a booking we may still resubmit...
        m.getBooking.mockResolvedValue(booking({
            status: 'revision_requested',
            capabilities: capabilities({ can_edit: true, can_resubmit: true, can_cancel: true }),
        }));
        // ...but the workflow moved on: the 409 carries the fresh, safe booking.
        const fresh = booking({
            status: 'approved',
            effective_status: 'approved',
            workflow_version: 4,
            capabilities: capabilities(),
        });
        m.resubmit.mockRejectedValue(apiError(
            'Versi pengajuan sudah berubah.',
            409,
            'stale_workflow_version',
            { booking: fresh },
        ));

        await openPeminjamanBookingDetail(51);
        document.getElementById('resubmit-peminjaman-booking')?.click();
        await vi.waitFor(() => {
            expect(document.querySelector('[data-detail-state="error"]')).not.toBeNull();
        });

        // The error explains why...
        expect(document.body.textContent).toContain('Versi pengajuan sudah berubah.');
        // ...and every action is now recomputed from the FRESH booking: the
        // stale resubmit/edit/cancel buttons are gone, the fresh status is shown.
        expect(document.querySelector('[data-lifecycle-status]')?.textContent)
            .toContain('Disetujui');
        expect(document.getElementById('resubmit-peminjaman-booking')).toBeNull();
        expect(document.getElementById('edit-peminjaman-booking')).toBeNull();
        expect(document.getElementById('cancel-peminjaman-booking')).toBeNull();
        // The embedded booking was enough — no refetch was needed.
        expect(m.getBooking).toHaveBeenCalledTimes(1);
    });

    it('refetches the booking when a 409 carries no safe booking payload', async () => {
        m.getBooking.mockResolvedValueOnce(booking({
            status: 'revision_requested',
            capabilities: capabilities({ can_resubmit: true }),
        }));
        m.resubmit.mockRejectedValue(apiError(
            'Pengajuan sedang dalam permohonan pembatalan.',
            409,
            'pending_cancellation_request',
        ));
        m.getBooking.mockResolvedValueOnce(booking({
            status: 'revision_requested',
            cancellation_pending: true,
            capabilities: capabilities(),
        }));

        await openPeminjamanBookingDetail(51);
        document.getElementById('resubmit-peminjaman-booking')?.click();
        await vi.waitFor(() => {
            expect(m.getBooking).toHaveBeenCalledTimes(2);
        });
        await vi.waitFor(() => {
            expect(document.getElementById('resubmit-peminjaman-booking')).toBeNull();
        });
    });

    it('the cancellation reason is bounded by the backend maximum of 2.000 characters', async () => {
        m.getBooking.mockResolvedValue(booking({
            capabilities: capabilities({ can_cancel: true }),
        }));

        await openPeminjamanBookingDetail(51);
        document.getElementById('cancel-peminjaman-booking')?.click();

        const reason = document.getElementById('peminjaman-cancel-reason') as HTMLTextAreaElement;
        expect(reason.getAttribute('maxlength')).toBe('2000');

        // Blank reason: rejected client-side, nothing sent.
        document.getElementById('peminjaman-cancel-form')
            ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(document.body.textContent).toContain('Alasan pembatalan wajib diisi.');
        expect(m.cancel).not.toHaveBeenCalled();

        // A 2.000-character reason is accepted and sent.
        m.cancel.mockResolvedValue(booking({ status: 'cancelled' }));
        const maxReason = 'a'.repeat(2000);
        (document.getElementById('peminjaman-cancel-reason') as HTMLTextAreaElement).value = maxReason;
        document.getElementById('peminjaman-cancel-form')
            ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => {
            expect(m.cancel).toHaveBeenCalledWith(
                expect.objectContaining({ id: 51 }),
                maxReason,
                'test-idempotency-key',
            );
        });
    });

    it('falls back to a safe label for an unknown effective status', async () => {
        m.getBooking.mockResolvedValue(booking({
            effective_status: 'mystery_state',
        }));

        await openPeminjamanBookingDetail(51);

        const badge = document.querySelector('[data-lifecycle-status]');
        expect(badge?.textContent).toContain('Status Tidak Dikenal');
        expect(document.body.textContent).not.toContain('mystery_state');
    });
});
