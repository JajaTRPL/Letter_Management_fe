// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    getRooms: vi.fn(),
    getAvailability: vi.fn(),
    getBooking: vi.fn(),
    getBookings: vi.fn(),
    createBooking: vi.fn(),
    generateKey: vi.fn(),
    fetchRoomPhoto: vi.fn(),
    downloadSurat: vi.fn(),
}));

vi.mock('../../../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: (_title: string, content: string) => {
        document.body.innerHTML = content;
    },
}));

vi.mock('../api', () => {
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
        MALFORMED_RESPONSE_CODE: 'malformed_response',
        isUncertainOutcome: (error: unknown): boolean => {
            if (error instanceof MockPeminjamanApiError) {
                return error.code === 'malformed_response'
                    || error.status >= 500
                    || error.status === 0;
            }
            return true;
        },
        getPeminjamanRooms: m.getRooms,
        getPeminjamanAvailability: m.getAvailability,
        getMahasiswaBooking: m.getBooking,
        getMahasiswaBookings: m.getBookings,
        createMahasiswaBooking: m.createBooking,
        generateRoomBookingIdempotencyKey: m.generateKey,
        updateMahasiswaBooking: vi.fn(),
        resubmitMahasiswaBooking: vi.fn(),
        withdrawMahasiswaBooking: vi.fn(),
        replaceSuratPeminjamanPdf: vi.fn(),
        downloadSuratPeminjamanPdf: m.downloadSurat,
        downloadRoomTemplate: vi.fn(),
        fetchRoomPhotoObjectUrl: m.fetchRoomPhoto,
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
import {
    closePeminjamanApplicationPage,
    renderPeminjamanApplicationPage,
} from '../application-page';
import type { AvailabilityItem, MahasiswaBooking, Room } from '../types';

const classroom: Room = {
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

const labRoom: Room = {
    id: 21,
    code: 'LAB-21',
    name: 'Lab Jaringan',
    type: 'laboratory',
    capacity: 30,
    location: 'Gedung B',
    description: null,
    is_active: true,
    owning_laboratory: { id: 3, code: 'TAJ', name: 'Lab Teknologi Jaringan' },
};

const submittedBooking: MahasiswaBooking = {
    id: 77,
    room: classroom,
    activity_name: 'Rapat Kerja',
    purpose: 'Koordinasi.',
    participant_count: 15,
    start_at: '2026-06-20T10:00:00+07:00',
    end_at: '2026-06-20T12:00:00+07:00',
    status: 'submitted',
    stored_status: 'submitted',
    effective_status: 'submitted',
    workflow_version: 1,
    submission_iteration: 1,
    reviewer: null,
    reviewed_at: null,
    revision_note: null,
    rejection_reason: null,
    cancellation_reason: null,
    created_at: '2026-06-18T09:00:00+07:00',
    updated_at: '2026-06-18T09:00:00+07:00',
    surat_peminjaman_pdf: {
        exists: true,
        original_name: 'surat.pdf',
        size_bytes: 1024,
    },
};

const approvedSlot: AvailabilityItem = {
    room: { id: 10, code: 'KLS-10', name: 'Ruang Kelas 10', type: 'classroom' },
    start_at: '2026-06-20T09:00:00+07:00',
    end_at: '2026-06-20T11:00:00+07:00',
    lifecycle_category: 'approved',
    activity_titles: ['Rapat terjadwal'],
    request_count: 1,
};

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

const setValue = (id: string, value: string): void => {
    const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
};

const submitForm = (): void => {
    document.getElementById('peminjaman-booking-form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
    );
};

const selectPdf = (name = 'surat.pdf'): void => {
    const input = document.getElementById('peminjaman-surat-pdf') as HTMLInputElement;
    const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

const fillAll = (): void => {
    setValue('peminjaman-room-id', String(classroom.id));
    setValue('peminjaman-date', '2026-06-20');
    setValue('peminjaman-start-time', '13:00');
    setValue('peminjaman-end-time', '15:00');
    setValue('peminjaman-activity-name', 'Rapat Kerja');
    setValue('peminjaman-purpose', 'Koordinasi.');
    setValue('peminjaman-participant-count', '15');
    selectPdf();
};

const goToReview = async (): Promise<void> => {
    document.getElementById('peminjaman-next-1')?.click();
    await flush();
    document.getElementById('peminjaman-next-2')?.click();
    await flush();
};

const runAvailabilityDebounce = async (): Promise<void> => {
    vi.advanceTimersByTime(260);
    await flush();
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T02:00:00Z'));
    document.body.innerHTML = '<div id="app"></div>';
    closePeminjamanApplicationPage();
    Object.values(m).forEach((mock) => mock.mockReset());
    m.getRooms.mockResolvedValue([classroom, labRoom]);
    m.getAvailability.mockResolvedValue([]);
    m.createBooking.mockResolvedValue(submittedBooking);
    m.generateKey
        .mockReturnValueOnce('booking-intent-test-001')
        .mockReturnValueOnce('booking-intent-test-002')
        .mockReturnValue('booking-intent-test-003');
    m.getBooking.mockResolvedValue(submittedBooking);
    m.getBookings.mockResolvedValue([]);
});

describe('Peminjaman application page', () => {
    it('renders the three sections with the review step and section navigation', async () => {
        await renderPeminjamanApplicationPage();
        await flush();

        expect(document.querySelectorAll('[data-app-section]').length).toBe(3);
        expect(document.querySelector('[data-app-section="1"]')?.hasAttribute('hidden')).toBe(false);
        expect(document.querySelector('[data-app-section="2"]')?.hasAttribute('hidden')).toBe(true);
        expect(document.body.textContent).toContain('Ruangan dan Jadwal');
        expect(document.body.textContent).toContain('Kegiatan dan Dokumen');
        expect(document.body.textContent).toContain('Periksa dan Konfirmasi');

        // Section 1 gate blocks empty schedule fields.
        document.getElementById('peminjaman-next-1')?.click();
        await flush();
        expect(document.querySelector('[data-app-section="1"]')?.hasAttribute('hidden')).toBe(false);
        expect(document.body.textContent).toContain('Tanggal peminjaman wajib diisi.');
    });

    it('review edit links jump back to the owning section', async () => {
        await renderPeminjamanApplicationPage();
        await flush();
        fillAll();
        await goToReview();

        expect(document.querySelector('[data-app-section="3"]')?.hasAttribute('hidden')).toBe(false);
        document.querySelector<HTMLElement>('[data-edit-section="1"]')?.click();
        await flush();
        expect(document.querySelector('[data-app-section="1"]')?.hasAttribute('hidden')).toBe(false);
    });

    it('prevents duplicate submission while the request is active', async () => {
        let resolveCreate: (value: MahasiswaBooking) => void = () => {};
        m.createBooking.mockImplementation(() => new Promise((resolve) => {
            resolveCreate = resolve;
        }));

        await renderPeminjamanApplicationPage();
        await flush();
        fillAll();
        await goToReview();

        submitForm();
        await flush();
        // Second submit while pending must not fire another request.
        submitForm();
        await flush();
        expect(m.createBooking).toHaveBeenCalledTimes(1);
        expect(
            (document.getElementById('submit-peminjaman-booking') as HTMLButtonElement).disabled,
        ).toBe(true);

        resolveCreate(submittedBooking);
        await flush();
        expect(document.querySelector('[data-app-confirmation]')).not.toBeNull();
    });

    it.each([
        ['a 500', () => new PeminjamanApiError('Server error', 500)],
        ['a network fault', () => new TypeError('Failed to fetch')],
        ['a malformed 2xx body', () => new PeminjamanApiError(
            'Gagal membuat pengajuan peminjaman.', 201, 'malformed_response',
        )],
    ])('locks submission in submission_outcome_unknown after %s', async (_name, makeError) => {
        m.createBooking.mockRejectedValue(makeError());

        await renderPeminjamanApplicationPage();
        await flush();
        fillAll();
        await goToReview();
        submitForm();
        await flush();
        await flush();

        // The outcome is unknown — never presented as success or as a clean fail.
        expect(document.querySelector('[data-submission-outcome="unknown"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Hasil pengajuan belum dapat dipastikan.');
        expect(document.querySelector('[data-app-confirmation]')).toBeNull();

        // Normal submission and every edit path are gone while the intent is frozen.
        expect(document.getElementById('submit-peminjaman-booking')).toBeNull();
        expect(document.querySelector('[data-edit-section]')).toBeNull();
        expect(document.getElementById('peminjaman-back-3')).toBeNull();
        expect(
            (document.getElementById('peminjaman-surat-pdf') as HTMLInputElement).disabled,
        ).toBe(true);
        expect(document.getElementById('peminjaman-outcome-acknowledge')).toBeNull();
        expect(document.getElementById('peminjaman-outcome-reconcile')).toBeNull();
        expect(document.getElementById('peminjaman-outcome-retry')?.textContent)
            .toContain('Coba Dapatkan Hasil dengan Aman');
        expect(document.getElementById('peminjaman-outcome-list')).not.toBeNull();

        // Nothing was retried automatically.
        submitForm();
        await flush();
        expect(m.createBooking).toHaveBeenCalledTimes(1);
    });

    it('reuses the exact frozen key, payload, and PDF for a safe retry and accepts replay success', async () => {
        m.createBooking.mockRejectedValueOnce(new PeminjamanApiError('Server error', 500));

        await renderPeminjamanApplicationPage();
        await flush();
        fillAll();
        await goToReview();
        submitForm();
        await flush();
        await flush();

        m.createBooking.mockResolvedValueOnce(submittedBooking);
        document.getElementById('peminjaman-outcome-retry')?.click();
        await flush();
        await flush();

        expect(m.createBooking).toHaveBeenCalledTimes(2);
        const first = m.createBooking.mock.calls[0];
        const replay = m.createBooking.mock.calls[1];
        expect(replay[0]).toEqual(first[0]);
        expect(replay[1]).toBe(first[1]);
        expect(replay[2]).toBe(first[2]);
        expect(first[2]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
        expect(document.querySelector('[data-app-confirmation]')).not.toBeNull();
    });

    it('stops an idempotency-key conflict until a new intent creates a different key', async () => {
        m.createBooking
            .mockRejectedValueOnce(new PeminjamanApiError(
                'Kunci idempotensi sudah digunakan dengan data yang berbeda.',
                409,
                'idempotency_key_reused',
            ))
            .mockResolvedValueOnce(submittedBooking);

        await renderPeminjamanApplicationPage();
        await flush();
        fillAll();
        await goToReview();
        submitForm();
        await flush();
        await flush();

        const originalKey = m.createBooking.mock.calls[0][2];
        expect(document.body.textContent).toContain('Kunci pengajuan ini sudah terikat');
        expect(document.getElementById('submit-peminjaman-booking')).toBeNull();
        expect(m.createBooking).toHaveBeenCalledTimes(1);

        document.getElementById('peminjaman-new-intent')?.click();
        await flush();
        submitForm();
        await flush();
        await flush();

        expect(m.createBooking).toHaveBeenCalledTimes(2);
        expect(m.createBooking.mock.calls[1][2]).not.toBe(originalKey);
        expect(document.querySelector('[data-app-confirmation]')).not.toBeNull();
    });

    it('keeps the unconsumed key across a 422 correction', async () => {
        m.createBooking
            .mockRejectedValueOnce(new PeminjamanApiError(
                'Validasi gagal.',
                422,
                undefined,
                { start_at: ['Jadwal harus diperbaiki.'] },
            ))
            .mockResolvedValueOnce(submittedBooking);

        await renderPeminjamanApplicationPage();
        await flush();
        fillAll();
        await goToReview();
        submitForm();
        await flush();
        await flush();

        const validationKey = m.createBooking.mock.calls[0][2];
        setValue('peminjaman-start-time', '13:30');
        document.getElementById('peminjaman-next-1')?.click();
        await flush();
        document.getElementById('peminjaman-next-2')?.click();
        await flush();
        submitForm();
        await flush();

        expect(m.createBooking).toHaveBeenCalledTimes(2);
        expect(m.createBooking.mock.calls[1][2]).toBe(validationKey);
        expect(document.querySelector('[data-app-confirmation]')).not.toBeNull();
    });

    it('maps 422 field errors into the summary and jumps to the owning section', async () => {
        m.createBooking.mockRejectedValue(new PeminjamanApiError(
            'Validasi gagal.',
            422,
            undefined,
            { start_at: ['Jadwal peminjaman harus dimulai setelah waktu saat ini.'] },
        ));

        await renderPeminjamanApplicationPage();
        await flush();
        fillAll();
        await goToReview();
        submitForm();
        await flush();
        await flush();

        const summary = document.getElementById('peminjaman-error-summary');
        expect(summary).not.toBeNull();
        expect(summary?.textContent).toContain('Jadwal peminjaman harus dimulai setelah waktu saat ini.');
        // start_at belongs to section 1.
        expect(document.querySelector('[data-app-section="1"]')?.hasAttribute('hidden')).toBe(false);
    });

    it('guards unsaved changes and releases the guard after success', async () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        await renderPeminjamanApplicationPage();
        await flush();

        expect(addSpy.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false);
        setValue('peminjaman-activity-name', 'Draft kegiatan');
        document.getElementById('peminjaman-activity-name')
            ?.dispatchEvent(new Event('input', { bubbles: true }));
        expect(addSpy.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true);

        // Internal navigation asks for confirmation while dirty.
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        document.getElementById('peminjaman-application-back')?.click();
        expect(confirmSpy).toHaveBeenCalled();
        // Declined: still on the page.
        expect(document.getElementById('peminjaman-booking-form')).not.toBeNull();

        fillAll();
        await goToReview();
        submitForm();
        await flush();
        await flush();
        expect(document.querySelector('[data-app-confirmation]')).not.toBeNull();
        expect(removeSpy.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true);
        confirmSpy.mockRestore();
    });

    it('shows availability states and an inline conflict warning for overlapping times', async () => {
        m.getAvailability.mockResolvedValue([approvedSlot]);

        await renderPeminjamanApplicationPage({ roomId: classroom.id, date: '2026-06-20' });
        await flush();

        // Debounced request → loading, then ready with the approved slot.
        expect(document.querySelector('[data-availability-state="loading"]')).not.toBeNull();
        await runAvailabilityDebounce();
        expect(document.querySelector('[data-availability-state="ready"]')).not.toBeNull();
        expect(document.getElementById('peminjaman-availability')?.textContent)
            .toContain('09.00');

        // Overlapping chosen time → inline conflict warning.
        setValue('peminjaman-start-time', '10:00');
        setValue('peminjaman-end-time', '12:00');
        expect(document.querySelector('[data-availability-state="hard-conflict"]')).not.toBeNull();

        document.getElementById('peminjaman-next-1')?.click();
        expect(document.querySelector('[data-app-section="1"]')?.hasAttribute('hidden')).toBe(false);

        // Privacy: only room/time/status are shown — no requester data leaks.
        expect(document.getElementById('peminjaman-availability')?.textContent)
            .not.toContain('requester');
    });

    it('ignores a stale availability response after the selection changes', async () => {
        let resolveFirst: (items: AvailabilityItem[]) => void = () => {};
        m.getAvailability
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveFirst = resolve;
            }))
            .mockResolvedValueOnce([]);

        await renderPeminjamanApplicationPage({ roomId: classroom.id, date: '2026-06-20' });
        await flush();
        await runAvailabilityDebounce();

        // Selection changes while the first request is still in flight.
        setValue('peminjaman-date', '2026-06-21');
        await runAvailabilityDebounce();

        // The late first response must not overwrite the newer state.
        resolveFirst([approvedSlot]);
        await flush();
        expect(document.getElementById('peminjaman-availability')?.textContent)
            .not.toContain('09.00');
    });

    it('A → B → A never accepts the first A response (generation is invalidated on change)', async () => {
        const slotForA: AvailabilityItem = {
            ...approvedSlot,
            start_at: '2026-06-20T09:00:00+07:00',
            end_at: '2026-06-20T11:00:00+07:00',
        };
        let resolveFirstA: (items: AvailabilityItem[]) => void = () => {};

        m.getAvailability
            // A (first): left in flight.
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveFirstA = resolve;
            }))
            // B.
            .mockResolvedValueOnce([])
            // A (second): the authoritative answer for the re-selected date.
            .mockResolvedValueOnce([]);

        await renderPeminjamanApplicationPage({ roomId: classroom.id, date: '2026-06-20' });
        await flush();
        await runAvailabilityDebounce();

        // A → B → A, each change invalidating the previous generation.
        setValue('peminjaman-date', '2026-06-21');
        await runAvailabilityDebounce();
        setValue('peminjaman-date', '2026-06-20');
        await runAvailabilityDebounce();

        // The stale first-A response lands last and must be discarded, even
        // though its key matches the current selection again.
        resolveFirstA([slotForA]);
        await flush();
        await flush();

        expect(document.getElementById('peminjaman-availability')?.textContent)
            .not.toContain('09.00');
        expect(document.querySelector('[data-availability-state="empty"]')).not.toBeNull();
        // Three lookups: A, B, and the fresh A — no result was reused blindly.
        expect(m.getAvailability).toHaveBeenCalledTimes(3);
    });

    it('offers retry when the availability check fails without blocking the form', async () => {
        m.getAvailability
            .mockRejectedValueOnce(new PeminjamanApiError('Gagal.', 500))
            .mockResolvedValueOnce([]);

        await renderPeminjamanApplicationPage({ roomId: classroom.id, date: '2026-06-20' });
        await flush();
        await runAvailabilityDebounce();

        expect(document.querySelector('[data-availability-state="error"]')).not.toBeNull();
        document.getElementById('peminjaman-availability-retry')?.click();
        await flush();
        expect(document.querySelector('[data-availability-state="ready"]')).not.toBeNull();
    });

    it('shows pending demand as a non-blocking warning with aggregate titles', async () => {
        m.getAvailability.mockResolvedValue([{
            ...approvedSlot,
            lifecycle_category: 'pending',
            activity_titles: ['Diskusi A', 'Diskusi B'],
            request_count: 2,
        }]);

        await renderPeminjamanApplicationPage({ roomId: classroom.id, date: '2026-06-20' });
        await runAvailabilityDebounce();
        setValue('peminjaman-start-time', '10:00');
        setValue('peminjaman-end-time', '12:00');

        expect(document.querySelector('[data-availability-state="soft-warning"]')?.textContent)
            .toContain('2 pengajuan lain');
        expect(document.getElementById('peminjaman-availability')?.textContent)
            .toContain('Diskusi A');
        expect(document.getElementById('peminjaman-availability')?.textContent)
            .toContain('Diskusi B');

        document.getElementById('peminjaman-next-1')?.click();
        expect(document.querySelector('[data-app-section="2"]')?.hasAttribute('hidden')).toBe(false);
    });

    it('previews every consecutive date, warns per date, and focuses the conflict summary', async () => {
        m.getAvailability.mockResolvedValue([
            {
                ...approvedSlot,
                start_at: '2026-06-21T09:30:00+07:00',
                end_at: '2026-06-21T10:30:00+07:00',
            },
            {
                ...approvedSlot,
                start_at: '2026-06-22T09:30:00+07:00',
                end_at: '2026-06-22T10:30:00+07:00',
                lifecycle_category: 'pending',
                activity_titles: ['Permintaan lain'],
            },
        ]);

        await renderPeminjamanApplicationPage({ roomId: classroom.id, date: '2026-06-20' });
        await flush();
        const multiMode = document.getElementById('peminjaman-booking-mode-multi') as HTMLInputElement;
        multiMode.checked = true;
        multiMode.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        setValue('peminjaman-end-date', '2026-06-22');
        setValue('peminjaman-start-time', '09:00');
        setValue('peminjaman-end-time', '12:00');
        await runAvailabilityDebounce();

        const preview = document.querySelector('[data-occurrence-preview]');
        expect(preview?.textContent).toContain('3 hari');
        expect(preview?.textContent).toContain('9 jam total');
        expect(document.querySelectorAll('[data-occurrence-availability]')).toHaveLength(3);
        expect(document.querySelector('[data-occurrence-availability="2026-06-21"] [data-availability-state="hard-conflict"]')).not.toBeNull();
        expect(document.querySelector('[data-occurrence-availability="2026-06-22"] [data-availability-state="soft-warning"]')).not.toBeNull();
        expect(m.getAvailability).toHaveBeenLastCalledWith(expect.objectContaining({
            roomId: classroom.id,
            from: '2026-06-20',
            to: '2026-06-22',
        }));

        document.getElementById('peminjaman-next-1')?.click();
        expect(document.querySelector('[data-app-section="1"]')?.hasAttribute('hidden')).toBe(false);
        expect(document.activeElement?.id).toBe('peminjaman-availability');
    });

    it('renders the selected room context and reuses the detail drawer entry point', async () => {
        const roomWithContext: Room = {
            ...classroom,
            cover_photo: {
                id: 91,
                original_name: 'kelas.jpg',
                display_url: '/api/rooms/10/photo',
                thumb_url: '/api/rooms/10/photo/thumb',
                is_cover: true,
            },
            facilities_summary: {
                count: 7,
                items: ['Proyektor', 'AC', 'Papan tulis', 'Wi-Fi', 'Kursi fleksibel'],
            },
            has_active_template: true,
        };
        m.getRooms.mockResolvedValue([roomWithContext, labRoom]);
        m.fetchRoomPhoto.mockRejectedValue(new Error('media unavailable'));

        await renderPeminjamanApplicationPage({ roomId: classroom.id });
        await flush();

        const context = document.getElementById('peminjaman-room-context');
        expect(context?.textContent).toContain('KLS-10 · Ruang Kelas 10');
        expect(context?.textContent).toContain('Kapasitas 40 orang');
        expect(context?.textContent).toContain('Proyektor');
        expect(context?.textContent).toContain('+2 lainnya');
        expect(context?.textContent).toContain('Template surat tersedia');
        expect(context?.textContent).toContain('Foto ruangan belum tersedia');
        expect(m.fetchRoomPhoto).toHaveBeenCalledWith('/api/rooms/10/photo/thumb');
        expect(document.getElementById('peminjaman-room-detail')?.tagName).toBe('BUTTON');
        expect(document.querySelector('label[for="peminjaman-activity-name"]')?.textContent)
            .toContain('jadwal publik');
    });

    it('switches room context immediately and refreshes availability for the new room', async () => {
        await renderPeminjamanApplicationPage({ roomId: classroom.id, date: '2026-06-20' });
        await runAvailabilityDebounce();
        m.getAvailability.mockClear();

        setValue('peminjaman-room-id', String(labRoom.id));
        expect(document.getElementById('peminjaman-room-context')?.textContent)
            .toContain('LAB-21 · Lab Jaringan');
        expect(document.getElementById('peminjaman-room-context')?.textContent)
            .toContain('Laboratorium Lab Teknologi Jaringan');

        await runAvailabilityDebounce();
        expect(m.getAvailability).toHaveBeenCalledWith(expect.objectContaining({
            roomId: labRoom.id,
            from: '2026-06-20',
            to: '2026-06-20',
        }));
    });

    it('renders the durable confirmation with reference, iteration, and next actions', async () => {
        await renderPeminjamanApplicationPage();
        await flush();
        fillAll();
        await goToReview();
        submitForm();
        await flush();
        await flush();

        const confirmation = document.querySelector('[data-app-confirmation]');
        expect(confirmation).not.toBeNull();
        expect(confirmation?.textContent).toContain('#77');
        expect(confirmation?.textContent).toContain('Diajukan');
        expect(confirmation?.textContent).toContain('KLS-10');
        expect(confirmation?.textContent).toContain('Pengajuan Ke');
        expect(confirmation?.textContent).toContain('Sarpras');
        expect(document.getElementById('peminjaman-confirmation-detail')).not.toBeNull();
        expect(document.getElementById('peminjaman-confirmation-list')).not.toBeNull();

        // Detail button opens the shared booking detail dialog.
        document.getElementById('peminjaman-confirmation-detail')?.click();
        await flush();
        expect(m.getBooking).toHaveBeenCalledWith(77);
    });

    it('labels laboratory bookings with the Kepala Lab review queue', async () => {
        m.createBooking.mockResolvedValue({
            ...submittedBooking,
            room: labRoom,
        });

        await renderPeminjamanApplicationPage({ roomId: labRoom.id });
        await flush();
        setValue('peminjaman-date', '2026-06-20');
        setValue('peminjaman-start-time', '13:00');
        setValue('peminjaman-end-time', '15:00');
        setValue('peminjaman-activity-name', 'Praktikum');
        setValue('peminjaman-purpose', 'Praktikum jaringan.');
        setValue('peminjaman-participant-count', '10');
        selectPdf();
        await goToReview();

        // Review copy names the correct authority by room type.
        expect(document.querySelector('[data-app-section="3"]')?.textContent)
            .toContain('Kepala Laboratorium');
        expect(document.querySelector('[data-app-section="3"]')?.textContent)
            .toContain('Lab Teknologi Jaringan');

        submitForm();
        await flush();
        await flush();
        expect(document.querySelector('[data-app-confirmation]')?.textContent)
            .toContain('Kepala Laboratorium');
    });

    it('form controls are labelled and clickable elements are real buttons', async () => {
        await renderPeminjamanApplicationPage();
        await flush();

        ['peminjaman-room-type', 'peminjaman-room-id', 'peminjaman-date',
            'peminjaman-start-time', 'peminjaman-end-time'].forEach((id) => {
            expect(document.querySelector(`label[for="${id}"]`), id).not.toBeNull();
        });
        // No clickable generic divs in the application flow.
        const stepButtons = ['peminjaman-next-1', 'peminjaman-back-2', 'peminjaman-next-2'];
        stepButtons.forEach((id) => {
            expect(document.getElementById(id)?.tagName).toBe('BUTTON');
        });
        // Availability updates announce through a polite live region.
        expect(document.getElementById('peminjaman-availability')?.getAttribute('aria-live'))
            .toBe('polite');
    });

    it('marks invalid controls with aria-invalid, links their message, and focuses the first one', async () => {
        await renderPeminjamanApplicationPage();
        await flush();

        // Section 1 gate with everything empty.
        document.getElementById('peminjaman-next-1')?.click();
        await flush();

        const roomSelect = document.getElementById('peminjaman-room-id') as HTMLSelectElement;
        const dateInput = document.getElementById('peminjaman-date') as HTMLInputElement;

        expect(roomSelect.getAttribute('aria-invalid')).toBe('true');
        expect(dateInput.getAttribute('aria-invalid')).toBe('true');
        // The error message is reachable from the control, and the static helper
        // text stays in the chain.
        expect(roomSelect.getAttribute('aria-describedby'))
            .toBe('peminjaman-room-capacity peminjaman-room-id-error');
        expect(document.getElementById('peminjaman-room-id-error')?.textContent)
            .toContain('Pilih ruangan aktif.');
        expect(dateInput.getAttribute('aria-describedby')).toBe('peminjaman-date-error');

        // One deterministic focus move: the first invalid control.
        expect(document.activeElement?.id).toBe('peminjaman-room-id');

        // Each message renders exactly once.
        const dateMessages = Array.from(document.querySelectorAll('p'))
            .filter((node) => node.textContent === 'Tanggal peminjaman wajib diisi.');
        expect(dateMessages.length).toBe(1);
    });

    it('a valid form leaves no control marked invalid', async () => {
        await renderPeminjamanApplicationPage();
        await flush();
        fillAll();
        document.getElementById('peminjaman-next-1')?.click();
        await flush();

        expect(document.querySelectorAll('[aria-invalid="true"]').length).toBe(0);
        expect(document.querySelector('[data-app-section="2"]')?.hasAttribute('hidden')).toBe(false);
    });

    it('a missing PDF is reported once, on the file input, and takes focus', async () => {
        await renderPeminjamanApplicationPage();
        await flush();
        // Everything except the PDF.
        setValue('peminjaman-room-id', String(classroom.id));
        setValue('peminjaman-date', '2026-06-20');
        setValue('peminjaman-start-time', '13:00');
        setValue('peminjaman-end-time', '15:00');
        setValue('peminjaman-activity-name', 'Rapat Kerja');
        setValue('peminjaman-purpose', 'Koordinasi.');
        setValue('peminjaman-participant-count', '15');

        document.getElementById('peminjaman-next-1')?.click();
        await flush();
        document.getElementById('peminjaman-next-2')?.click();
        await flush();

        const pdfInput = document.getElementById('peminjaman-surat-pdf') as HTMLInputElement;
        expect(pdfInput.getAttribute('aria-invalid')).toBe('true');
        expect(pdfInput.getAttribute('aria-describedby'))
            .toBe('peminjaman-surat-pdf-help peminjaman-surat-error');
        expect(document.activeElement?.id).toBe('peminjaman-surat-pdf');

        // Exactly one PDF error message on the page — no duplicate.
        const pdfErrors = Array.from(document.querySelectorAll('p'))
            .filter((node) => node.textContent === 'Surat peminjaman (PDF) wajib diunggah.');
        expect(pdfErrors.length).toBe(1);
        // Still on section 2 — the review step is not reachable without the PDF.
        expect(document.querySelector('[data-app-section="2"]')?.hasAttribute('hidden')).toBe(false);
    });
});
