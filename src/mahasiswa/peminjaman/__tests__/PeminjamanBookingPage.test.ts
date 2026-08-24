// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    getRooms: vi.fn(),
    getAvailability: vi.fn(),
    getBookings: vi.fn(),
    getBooking: vi.fn(),
    getRoomDetail: vi.fn(),
    fetchRoomPhoto: vi.fn(),
    downloadTemplate: vi.fn(),
    createBooking: vi.fn(),
    generateKey: vi.fn(),
    updateBooking: vi.fn(),
    resubmitBooking: vi.fn(),
    cancelBooking: vi.fn(),
    replaceSurat: vi.fn(),
    downloadSurat: vi.fn(),
    toasts: [] as string[],
}));

vi.mock('../../../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: (
        _title: string,
        content: string,
    ) => {
        document.body.innerHTML = content;
    },
}));

vi.mock('../../../dashboard/MahasiswaDashboard', () => ({
    renderMahasiswaDashboard: vi.fn(),
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
        getMahasiswaBookings: m.getBookings,
        getMahasiswaBooking: m.getBooking,
        getPeminjamanRoomDetail: m.getRoomDetail,
        fetchRoomPhotoObjectUrl: m.fetchRoomPhoto,
        downloadRoomTemplate: m.downloadTemplate,
        createMahasiswaBooking: m.createBooking,
        generateRoomBookingIdempotencyKey: m.generateKey,
        updateMahasiswaBooking: m.updateBooking,
        resubmitMahasiswaBooking: m.resubmitBooking,
        withdrawMahasiswaBooking: m.cancelBooking,
        replaceSuratPeminjamanPdf: m.replaceSurat,
        downloadSuratPeminjamanPdf: m.downloadSurat,
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
    default: vi.fn((options: { text: string }) => ({
        showToast: () => {
            m.toasts.push(options.text);
        },
    })),
}));

// detail.ts now routes through the shared toast wrapper instead of calling
// Toastify directly; re-route it back into the same `m.toasts` array.
vi.mock('../../../shared/toast', () => ({
    showSuccess: (text: string) => { m.toasts.push(text); },
    showError: (text: string) => { m.toasts.push(text); },
    showWarning: (text: string) => { m.toasts.push(text); },
    showInfo: (text: string) => { m.toasts.push(text); },
}));

import { PeminjamanApiError } from '../api';
import { renderPeminjamanRuangan } from '../../PeminjamanRuangan';
import { openPeminjamanBookingDetail } from '../detail';
import type {
    MahasiswaBooking,
    Room,
} from '../types';

const room: Room = {
    id: 10,
    code: 'API-KLS-10',
    name: 'Ruang API <img src=x onerror=unsafe()>',
    type: 'classroom',
    capacity: 40,
    location: 'Gedung API',
    description: null,
    is_active: true,
    owning_laboratory: null,
};

const booking = (
    status: MahasiswaBooking['status'] = 'submitted',
): MahasiswaBooking => ({
    id: 51,
    room,
    activity_name: 'Kegiatan <script>unsafe()</script>',
    purpose: 'Tujuan milik mahasiswa.',
    participant_count: 20,
    start_at: '2026-06-20T10:00:00+07:00',
    end_at: '2026-06-20T12:00:00+07:00',
    status,
    reviewer: null,
    reviewed_at: null,
    revision_note: status === 'revision_requested' ? 'Perbaiki jumlah peserta.' : null,
    rejection_reason: status === 'rejected' ? 'Ruangan tidak tersedia.' : null,
    cancellation_reason: null,
    created_at: '2026-06-18T09:00:00+07:00',
    updated_at: '2026-06-18T10:00:00+07:00',
    status_histories: [
        {
            id: 1,
            from_status: null,
            to_status: 'submitted',
            actor: null,
            note: null,
            created_at: '2026-06-18T09:00:00+07:00',
        },
        ...(status === 'revision_requested' ? [{
            id: 2,
            from_status: 'submitted' as const,
            to_status: 'revision_requested' as const,
            actor: null,
            note: 'Perbaiki jumlah peserta.',
            created_at: '2026-06-18T10:00:00+07:00',
        }] : []),
    ],
});

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

const submit = (id: string): void => {
    document.getElementById(id)?.dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true,
    }));
};

// C7C1: the category card navigates to the dedicated application page
// (lazy import + async room load), replacing the old create modal.
const settleNavigation = async (): Promise<void> => {
    await vi.dynamicImportSettled();
    await flush();
    await flush();
};

const openCreateFormFromCard = async (): Promise<void> => {
    document.querySelector<HTMLElement>('[data-booking-cta="classroom"]')?.click();
    await settleNavigation();
};

const goToReview = async (): Promise<void> => {
    document.getElementById('peminjaman-next-1')?.click();
    await flush();
    document.getElementById('peminjaman-next-2')?.click();
    await flush();
};

const pdfFile = (name = 'surat.pdf', sizeBytes?: number): File => {
    const file = new File(['%PDF-1.4 test'], name, { type: 'application/pdf' });
    if (sizeBytes !== undefined) {
        Object.defineProperty(file, 'size', { value: sizeBytes });
    }
    return file;
};

const selectFile = (id: string, file: File | null): void => {
    const input = document.getElementById(id) as HTMLInputElement;
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: file ? [file] : [],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

const fillFields = (): void => {
    setValue('peminjaman-room-id', String(room.id));
    setValue('peminjaman-date', '2026-06-20');
    setValue('peminjaman-start-time', '10:00');
    setValue('peminjaman-end-time', '12:00');
    setValue('peminjaman-activity-name', 'Rapat Mahasiswa');
    setValue('peminjaman-purpose', 'Koordinasi kegiatan.');
    setValue('peminjaman-participant-count', '20');
};

const fillValidForm = (): void => {
    fillFields();
    selectFile('peminjaman-surat-pdf', pdfFile());
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T02:00:00Z'));
    document.body.innerHTML = '<div id="app"></div>';
    Object.values(m).forEach((value) => {
        if (typeof value === 'function' && 'mockReset' in value) {
            value.mockReset();
        }
    });
    m.toasts = [];
    m.getRooms.mockResolvedValue([room]);
    m.getAvailability.mockResolvedValue([]);
    m.getBookings.mockResolvedValue([]);
    m.getBooking.mockResolvedValue(booking());
    m.createBooking.mockResolvedValue(booking());
    m.generateKey.mockReturnValue('booking-page-intent-001');
    m.updateBooking.mockResolvedValue(booking('revision_requested'));
    m.resubmitBooking.mockResolvedValue(booking());
    m.cancelBooking.mockResolvedValue(booking('cancelled'));
    m.replaceSurat.mockResolvedValue(booking('revision_requested'));
    m.downloadSurat.mockResolvedValue(undefined);
});

describe('Mahasiswa booking workflow', () => {
    it('opens the application page from the category card and submits after review', async () => {
        await renderPeminjamanRuangan();
        await openCreateFormFromCard();

        // Dedicated page, not a modal: three sections plus review.
        expect(document.getElementById('peminjaman-booking-form')).not.toBeNull();
        expect(document.querySelector('[data-app-section="1"]')).not.toBeNull();
        expect(document.querySelector('[data-app-section="3"]')).not.toBeNull();
        expect(document.body.textContent).toContain('API-KLS-10');
        expect(document.body.textContent).toContain('Kapasitas maksimal 40 orang');

        fillValidForm();
        await goToReview();

        // Review summary shows the entered data before the final action.
        const reviewSection = document.querySelector('[data-app-section="3"]');
        expect(reviewSection?.hasAttribute('hidden')).toBe(false);
        expect(reviewSection?.textContent).toContain('Rapat Mahasiswa');
        expect(reviewSection?.textContent).toContain('surat.pdf');
        expect(reviewSection?.textContent).toContain('Ajukan Peminjaman');

        submit('peminjaman-booking-form');
        await flush();
        await flush();

        expect(m.createBooking).toHaveBeenCalledWith(
            {
                room_id: room.id,
                activity_name: 'Rapat Mahasiswa',
                purpose: 'Koordinasi kegiatan.',
                participant_count: 20,
                start_at: '2026-06-20T10:00:00+07:00',
                end_at: '2026-06-20T12:00:00+07:00',
                booking_mode: 'single_day',
            },
            expect.any(File),
            'booking-page-intent-001',
        );
        // Durable confirmation view — not a disappearing toast.
        expect(document.querySelector('[data-app-confirmation]')).not.toBeNull();
        expect(document.body.textContent)
            .toContain('Pengajuan peminjaman ruangan berhasil dikirim.');
        expect(document.body.textContent).toContain('#51');
    });

    it('uses an accessible custom upload control instead of the native file text', async () => {
        await renderPeminjamanRuangan();
        await openCreateFormFromCard();

        // Native input is visually hidden (no browser "No file chosen" text);
        // the styled label + chip are the visible truth.
        const input = document.getElementById('peminjaman-surat-pdf');
        expect(input?.className).toContain('sr-only');
        // Two labels point at the input (field title + styled button) — the
        // button label must exist and stay associated with the hidden input.
        const uploadLabels = Array.from(
            document.querySelectorAll('label[for="peminjaman-surat-pdf"]'),
        );
        expect(uploadLabels.some((label) => label.textContent?.includes('Pilih PDF'))).toBe(true);
        expect(document.body.textContent).toContain('Belum ada file dipilih.');

        selectFile('peminjaman-surat-pdf', pdfFile('surat-kegiatan.pdf', 204800));
        expect(document.body.textContent).toContain('surat-kegiatan.pdf');
        expect(document.body.textContent).toContain('200.0 KB');
        expect(document.body.textContent).not.toContain('Belum ada file dipilih.');

        document.getElementById('peminjaman-surat-clear')?.click();
        expect(document.body.textContent).toContain('Belum ada file dipilih.');
        expect(document.body.textContent).not.toContain('surat-kegiatan.pdf');

        await goToReview();
        submit('peminjaman-booking-form');
        await flush();
        expect(m.createBooking).not.toHaveBeenCalled();
    });

    it('requires the surat PDF before creating a booking', async () => {
        await renderPeminjamanRuangan();
        await openCreateFormFromCard();
        fillFields(); // no PDF selected

        // The section gate refuses to reach review without the document.
        document.getElementById('peminjaman-next-1')?.click();
        await flush();
        document.getElementById('peminjaman-next-2')?.click();
        await flush();

        expect(m.createBooking).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('Surat peminjaman (PDF) wajib diunggah.');
        expect(document.querySelector('[data-app-section="2"]')?.hasAttribute('hidden')).toBe(false);
    });

    it('rejects a non-PDF file client-side before submit', async () => {
        await renderPeminjamanRuangan();
        await openCreateFormFromCard();
        fillFields();
        selectFile('peminjaman-surat-pdf', new File(['x'], 'catatan.txt', { type: 'text/plain' }));
        // Client validation fires immediately on selection.
        expect(document.body.textContent).toContain('Berkas harus berupa PDF.');

        await goToReview();
        submit('peminjaman-booking-form');
        await flush();
        expect(m.createBooking).not.toHaveBeenCalled();
    });

    it('rejects a file larger than 5 MB client-side before submit', async () => {
        await renderPeminjamanRuangan();
        await openCreateFormFromCard();
        fillFields();
        selectFile('peminjaman-surat-pdf', pdfFile('besar.pdf', 6 * 1024 * 1024));
        expect(document.body.textContent).toContain('Ukuran berkas melebihi 5 MB.');

        await goToReview();
        submit('peminjaman-booking-form');
        await flush();
        expect(m.createBooking).not.toHaveBeenCalled();
    });

    it('replaces the surat PDF for a revision request from the detail dialog', async () => {
        const revision = booking('revision_requested');
        m.getBooking.mockResolvedValue(revision);
        m.replaceSurat.mockResolvedValue(revision);
        const onMutated = vi.fn();

        await openPeminjamanBookingDetail(51, { onMutated });
        expect(document.getElementById('peminjaman-surat-replace-input')).not.toBeNull();
        selectFile('peminjaman-surat-replace-input', pdfFile('revisi.pdf'));
        document.getElementById('peminjaman-surat-replace-submit')?.click();
        await flush();
        await flush();

        expect(m.replaceSurat).toHaveBeenCalledWith(51, expect.any(File));
        expect(m.toasts).toContain('Surat peminjaman berhasil diperbarui.');
        expect(onMutated).toHaveBeenCalled();
    });

    it('hides the replacement uploader for non-revision statuses', async () => {
        m.getBooking.mockResolvedValue(booking('submitted'));

        await openPeminjamanBookingDetail(51);

        expect(document.getElementById('peminjaman-surat-replace-input')).toBeNull();
    });

    it('opens the application page via keyboard activation on the category card', async () => {
        await renderPeminjamanRuangan();
        const card = document.querySelector<HTMLElement>('[data-booking-cta="classroom"]');
        card?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await settleNavigation();

        expect(document.getElementById('peminjaman-booking-form')).not.toBeNull();
        expect(document.querySelector('[data-app-section="1"]')).not.toBeNull();
    });

    it('opens the room detail drawer from the browser, then the application page prefilled', async () => {
        m.getRoomDetail.mockResolvedValue({ ...room, photos: [], facilities: [], template: null });
        await renderPeminjamanRuangan();
        document.querySelector<HTMLElement>(`[data-room-select="${room.id}"]`)?.click();
        await flush();

        // Card click opens the detail drawer — not the application page.
        expect(document.getElementById('peminjaman-room-detail-root')).not.toBeNull();
        expect(document.getElementById('peminjaman-booking-form')).toBeNull();
        expect(m.getRoomDetail).toHaveBeenCalledWith(room.id);

        document.getElementById('room-detail-apply')?.click();
        await settleNavigation();

        // Drawer closes and the application page opens with the room chosen.
        expect(document.getElementById('peminjaman-room-detail-root')).toBeNull();
        expect((document.getElementById('peminjaman-room-id') as HTMLSelectElement).value)
            .toBe(String(room.id));
    });

    it('blocks capacity validation before sending the request', async () => {
        await renderPeminjamanRuangan();
        await openCreateFormFromCard();
        fillValidForm();
        setValue('peminjaman-participant-count', '41');
        await goToReview();
        submit('peminjaman-booking-form');
        await flush();

        expect(m.createBooking).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('melebihi kapasitas 40');
    });

    it.each([
        [
            new PeminjamanApiError('Validasi gagal.', 422, undefined, {
                participant_count: ['Jumlah peserta melebihi kapasitas ruangan.'],
            }),
            'Jumlah peserta melebihi kapasitas ruangan.',
        ],
        [
            new PeminjamanApiError('Ruangan bentrok.', 409, 'booking_conflict'),
            'Ruangan bentrok.',
        ],
    ])('renders structured backend mutation errors', async (apiError, expected) => {
        m.createBooking.mockRejectedValue(apiError);
        await renderPeminjamanRuangan();
        await openCreateFormFromCard();
        fillValidForm();
        await goToReview();
        submit('peminjaman-booking-form');
        await flush();
        await flush();

        expect(document.body.textContent).toContain(expected);
    });

    it('opens detail with history and safely escapes API text', async () => {
        const revision = booking('revision_requested');
        m.getBooking.mockResolvedValue(revision);

        await openPeminjamanBookingDetail(51);

        expect(document.body.textContent).toContain('Kegiatan <script>unsafe()</script>');
        expect(document.querySelector('script')).toBeNull();
        expect(document.body.textContent).toContain('Linimasa Persetujuan');
        expect(document.body.textContent).toContain('Perbaiki jumlah peserta.');
        expect(document.getElementById('edit-peminjaman-booking')).not.toBeNull();
        expect(document.getElementById('resubmit-peminjaman-booking')).not.toBeNull();
    });

    it('renders a detail load error inside the dialog', async () => {
        m.getBooking.mockRejectedValue(new Error('Detail pengajuan tidak tersedia.'));

        await openPeminjamanBookingDetail(51);

        expect(document.querySelector('[data-detail-state="error"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Detail pengajuan tidak tersedia.');
    });

    it('updates a revision from detail and exposes resubmit while revision is requested', async () => {
        const revision = booking('revision_requested');
        m.getBooking.mockResolvedValue(revision);
        m.updateBooking.mockResolvedValue(revision);

        await openPeminjamanBookingDetail(51);
        document.getElementById('edit-peminjaman-booking')?.click();
        await flush();

        expect(m.getRooms).toHaveBeenCalled();
        expect(document.getElementById('peminjaman-booking-form')).not.toBeNull();
        setValue('peminjaman-activity-name', 'Kegiatan Diperbaiki');
        submit('peminjaman-booking-form');
        await flush();
        await flush();

        expect(m.updateBooking).toHaveBeenCalledWith(
            revision.id,
            expect.objectContaining({ activity_name: 'Kegiatan Diperbaiki' }),
        );
        expect(m.toasts).toContain('Perbaikan pengajuan berhasil disimpan.');

        // onSaved reopened the detail dialog for the same booking.
        expect(document.getElementById('resubmit-peminjaman-booking')).not.toBeNull();
        document.getElementById('resubmit-peminjaman-booking')?.click();
        await flush();
        expect(m.resubmitBooking).toHaveBeenCalledWith(revision.id);
        expect(m.toasts).toContain('Pengajuan berhasil dikirim ulang.');
    });

    it('requires a cancellation reason and sends the confirmed reason', async () => {
        const submitted = booking('submitted');
        m.getBooking.mockResolvedValue(submitted);
        const onMutated = vi.fn();

        await openPeminjamanBookingDetail(51, { onMutated });
        document.getElementById('cancel-peminjaman-booking')?.click();
        submit('peminjaman-cancel-form');
        await flush();

        expect(m.cancelBooking).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('Alasan pembatalan wajib diisi.');

        setValue('peminjaman-cancel-reason', 'Kegiatan mahasiswa dibatalkan.');
        submit('peminjaman-cancel-form');
        await flush();
        expect(m.cancelBooking).toHaveBeenCalledWith(
            expect.objectContaining({ id: submitted.id }),
            'Kegiatan mahasiswa dibatalkan.',
            'booking-page-intent-001',
        );
        expect(onMutated).toHaveBeenCalled();
    });

    it('hides mutation actions for rejected requests', async () => {
        m.getBooking.mockResolvedValue(booking('rejected'));

        await openPeminjamanBookingDetail(51);

        expect(document.getElementById('edit-peminjaman-booking')).toBeNull();
        expect(document.getElementById('resubmit-peminjaman-booking')).toBeNull();
        expect(document.getElementById('cancel-peminjaman-booking')).toBeNull();
    });

    it('prefills the selected calendar date for a new request', async () => {
        await renderPeminjamanRuangan();
        document.querySelector<HTMLButtonElement>('[data-date="2026-06-20"]')?.click();
        document.getElementById('create-from-calendar-day')?.click();
        await settleNavigation();

        expect((document.getElementById('peminjaman-date') as HTMLInputElement).value)
            .toBe('2026-06-20');
    });
});
