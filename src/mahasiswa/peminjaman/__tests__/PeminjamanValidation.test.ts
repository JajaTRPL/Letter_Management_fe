// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    isAvailabilityItem,
    isMahasiswaBooking,
    isMahasiswaBookingList,
    isRoom,
} from '../booking-schema';
import { navigateLazily } from '../navigation';
import {
    bookingLifecycleStatus,
    isActiveLifecycleBooking,
    MAX_CANCELLATION_REASON_LENGTH,
    MAX_SURAT_PDF_BYTES,
    validateCancellationReason,
    validateSuratPdfFile,
} from '../workflow';
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
    id: 5,
    room,
    activity_name: 'Rapat',
    purpose: 'Koordinasi.',
    participant_count: 10,
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

const fileOf = (name: string, type: string, size = 1024): File => {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
};

describe('Surat PDF validation (strict MIME)', () => {
    it('accepts a real PDF', () => {
        expect(validateSuratPdfFile(fileOf('surat.pdf', 'application/pdf'))).toBeNull();
    });

    it('accepts the .pdf extension ONLY when the browser reports no MIME', () => {
        expect(validateSuratPdfFile(fileOf('surat.pdf', ''))).toBeNull();
        expect(validateSuratPdfFile(fileOf('surat', ''))).toBe('Berkas harus berupa PDF.');
    });

    it('rejects a known non-PDF MIME even when the filename ends in .pdf', () => {
        expect(validateSuratPdfFile(fileOf('surat.pdf', 'image/png')))
            .toBe('Berkas harus berupa PDF.');
        expect(validateSuratPdfFile(fileOf('surat.pdf', 'application/x-msdownload')))
            .toBe('Berkas harus berupa PDF.');
        expect(validateSuratPdfFile(fileOf('surat.pdf.exe', 'application/octet-stream')))
            .toBe('Berkas harus berupa PDF.');
    });

    it('keeps the 5 MiB limit', () => {
        expect(validateSuratPdfFile(
            fileOf('surat.pdf', 'application/pdf', MAX_SURAT_PDF_BYTES),
        )).toBeNull();
        expect(validateSuratPdfFile(
            fileOf('surat.pdf', 'application/pdf', MAX_SURAT_PDF_BYTES + 1),
        )).toBe('Ukuran berkas melebihi 5 MB.');
    });

    it('requires a file', () => {
        expect(validateSuratPdfFile(null)).toBe('Surat peminjaman (PDF) wajib diunggah.');
    });
});

describe('Cancellation reason validation', () => {
    it('aligns the maximum with the backend (2.000 characters)', () => {
        expect(MAX_CANCELLATION_REASON_LENGTH).toBe(2000);
        expect(validateCancellationReason('a'.repeat(2000))).toBeNull();
        expect(validateCancellationReason('a'.repeat(2001)))
            .toBe('Alasan pembatalan maksimal 2000 karakter.');
    });

    it('requires a non-blank reason', () => {
        expect(validateCancellationReason('   ')).toBe('Alasan pembatalan wajib diisi.');
    });
});

describe('Booking runtime guards', () => {
    it('accepts a well-formed booking, room, and availability item', () => {
        expect(isRoom(room)).toBe(true);
        expect(isMahasiswaBooking(booking())).toBe(true);
        expect(isMahasiswaBookingList([booking(), booking({ id: 6 })])).toBe(true);
        expect(isMahasiswaBookingList([])).toBe(true);
        expect(isAvailabilityItem({
            room: { id: 10, code: 'KLS-10', name: 'R', type: 'classroom' },
            start_at: '2026-06-20T10:00:00+07:00',
            end_at: '2026-06-20T12:00:00+07:00',
            lifecycle_category: 'approved',
            activity_titles: ['Sidang'],
            request_count: 1,
        })).toBe(true);
    });

    it('rejects arrays and null where an object belongs', () => {
        expect(isMahasiswaBooking(null)).toBe(false);
        expect(isMahasiswaBooking([])).toBe(false);
        expect(isMahasiswaBooking([booking()])).toBe(false);
        expect(isRoom([])).toBe(false);
        expect(isRoom(null)).toBe(false);
    });

    it('rejects a list whose elements are malformed', () => {
        expect(isMahasiswaBookingList([booking(), { id: 2 }])).toBe(false);
        expect(isMahasiswaBookingList([null])).toBe(false);
        expect(isMahasiswaBookingList({ rows: [] })).toBe(false);
    });

    it('rejects wrong field types instead of trusting the payload', () => {
        expect(isMahasiswaBooking(booking({ id: '5' } as unknown as Partial<MahasiswaBooking>))).toBe(false);
        expect(isMahasiswaBooking(booking({ room: undefined } as unknown as Partial<MahasiswaBooking>))).toBe(false);
        expect(isMahasiswaBooking(booking({
            participant_count: '10',
        } as unknown as Partial<MahasiswaBooking>))).toBe(false);
    });
});

describe('Effective lifecycle status', () => {
    it('prefers the backend effective status and falls back to the stored one', () => {
        expect(bookingLifecycleStatus(booking({ effective_status: 'under_review' })))
            .toBe('under_review');
        expect(bookingLifecycleStatus(booking({ status: 'approved' }))).toBe('approved');
    });

    it('treats under_review as active and expired/completed as history', () => {
        const now = new Date('2026-06-19T09:00:00+07:00');
        expect(isActiveLifecycleBooking(
            booking({ effective_status: 'under_review' }),
            now,
        )).toBe(true);
        // Stored status is still `approved` — the backend already calls it done.
        expect(isActiveLifecycleBooking(
            booking({ status: 'approved', effective_status: 'completed' }),
            now,
        )).toBe(false);
        expect(isActiveLifecycleBooking(
            booking({ status: 'approved', effective_status: 'expired' }),
            now,
        )).toBe(false);
        // Legacy payload (no effective_status): schedule decides.
        expect(isActiveLifecycleBooking(booking({ status: 'approved' }), now)).toBe(true);
        expect(isActiveLifecycleBooking(
            booking({ status: 'approved' }),
            new Date('2026-06-21T09:00:00+07:00'),
        )).toBe(false);
    });
});

describe('Lazy navigation failure', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('surfaces a recoverable alert when the page chunk fails to load', async () => {
        const load = vi.fn()
            .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
            .mockResolvedValueOnce(undefined);

        await navigateLazily(load, 'Pengajuan Saya');

        const alert = document.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        expect(alert?.textContent).toContain('Pengajuan Saya');
        expect(alert?.textContent).toContain('Coba Lagi');

        // Retry re-runs the navigation and clears the alert on success.
        document.getElementById('peminjaman-nav-retry')?.click();
        await vi.waitFor(() => {
            expect(document.getElementById('peminjaman-nav-failure')).toBeNull();
        });
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('renders nothing when navigation succeeds', async () => {
        await navigateLazily(async () => undefined, 'Peminjaman Ruangan');
        expect(document.getElementById('peminjaman-nav-failure')).toBeNull();
    });
});
