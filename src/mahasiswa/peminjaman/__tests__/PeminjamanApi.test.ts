// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
}));

vi.mock('../../../shared/api-client', () => ({
    apiFetch: m.apiFetch,
}));

import {
    withdrawMahasiswaBooking,
    createMahasiswaBooking,
    downloadSuratPeminjamanPdf,
    generateRoomBookingIdempotencyKey,
    getMahasiswaBooking,
    getMahasiswaBookings,
    getPeminjamanAvailability,
    getPeminjamanRooms,
    isUncertainOutcome,
    MALFORMED_RESPONSE_CODE,
    replaceSuratPeminjamanPdf,
    resubmitMahasiswaBooking,
    suratPeminjamanDownloadUrl,
    suratPeminjamanPreviewUrl,
    updateMahasiswaBooking,
    PeminjamanApiError,
} from '../api';
import apiSource from '../api.ts?raw';

const jsonResponse = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const pdfFile = (name = 'surat.pdf'): File =>
    new File(['%PDF-1.4 test'], name, { type: 'application/pdf' });

const payload = {
    room_id: 4,
    activity_name: 'Pengujian API',
    purpose: 'Pengujian kontrak frontend.',
    participant_count: 8,
    start_at: '2026-06-20T10:00:00+07:00',
    end_at: '2026-06-20T12:00:00+07:00',
};
const idempotencyKey = 'booking-intent-api-test-001';

const room = {
    id: 4,
    code: 'KLS-4',
    name: 'Ruang Kelas 4',
    type: 'classroom',
    capacity: 30,
    location: 'Gedung A',
    description: null,
    is_active: true,
    owning_laboratory: null,
};

const booking = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 1,
    room,
    activity_name: 'Pengujian API',
    purpose: 'Pengujian kontrak frontend.',
    participant_count: 8,
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

beforeEach(() => {
    m.apiFetch.mockReset();
    // Fresh Response per call: a Response body is single-use, and the readers
    // reject a body that does not match the shape they promise — reusing one
    // spent Response would surface as a false malformed-body failure. List
    // endpoints get an array, single-booking endpoints get a valid booking.
    m.apiFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
        const isList = (options?.method ?? 'GET') === 'GET'
            && !/\/requests\/\d+$/.test(url);
        return jsonResponse({
            message: 'ok',
            count: 0,
            data: isList ? [] : booking(),
        });
    });
});

describe('Peminjaman list-envelope normalization', () => {
    it('resolves a normal array payload and keeps an empty list distinct from failure', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ message: 'ok', data: [] }));
        await expect(getMahasiswaBookings()).resolves.toEqual([]);

        const valid = booking();
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ message: 'ok', data: [valid] }));
        await expect(getMahasiswaBookings()).resolves.toEqual([valid]);
    });

    it.each([
        ['missing data key', { message: 'ok' }],
        ['null data', { message: 'ok', data: null }],
        ['object data', { message: 'ok', data: { rows: [] } }],
    ])('rejects a malformed 200 body (%s) instead of resolving undefined', async (_name, body) => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse(body));
        await expect(getMahasiswaBookings()).rejects.toBeInstanceOf(PeminjamanApiError);

        m.apiFetch.mockResolvedValueOnce(jsonResponse(body));
        await expect(getPeminjamanRooms()).rejects.toBeInstanceOf(PeminjamanApiError);

        m.apiFetch.mockResolvedValueOnce(jsonResponse(body));
        await expect(getPeminjamanAvailability({
            from: '2026-06-01',
            to: '2026-06-30',
        })).rejects.toBeInstanceOf(PeminjamanApiError);
    });

    it.each([
        ['a null element', [null]],
        ['an element missing the room', [booking({ room: undefined })]],
        ['an element whose room is an array', [booking({ room: [] })]],
        ['an element with a non-numeric id', [booking({ id: '7' })]],
        ['one valid and one malformed element', [booking(), { id: 2 }]],
    ])('rejects a booking list containing %s', async (_name, data) => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ message: 'ok', data }));
        await expect(getMahasiswaBookings()).rejects.toMatchObject({
            code: MALFORMED_RESPONSE_CODE,
        });
    });

    it('rejects a 500 with the server message preserved', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse(
            { message: 'Terjadi kesalahan server.' },
            500,
        ));
        await expect(getMahasiswaBookings()).rejects.toMatchObject({
            status: 500,
            message: 'Terjadi kesalahan server.',
        });
    });

    it.each([
        ['a missing data key', { message: 'ok' }],
        ['null data', { message: 'ok', data: null }],
        ['an array where an object belongs', { message: 'ok', data: [] }],
        ['an object missing booking fields', { message: 'ok', data: { id: 1 } }],
    ])('rejects a booking-detail envelope with %s', async (_name, body) => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse(body));
        await expect(getMahasiswaBooking(1)).rejects.toBeInstanceOf(PeminjamanApiError);
    });
});

describe('Create-booking outcome certainty', () => {
    it('generates distinct backend-compatible submission keys', () => {
        const first = generateRoomBookingIdempotencyKey();
        const second = generateRoomBookingIdempotencyKey();

        expect(first).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
        expect(second).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
        expect(second).not.toBe(first);
    });

    it('resolves only when the 2xx body carries a valid booking object', async () => {
        const created = booking({ id: 77 });
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ message: 'ok', data: created }));
        await expect(createMahasiswaBooking(payload, pdfFile(), idempotencyKey))
            .resolves.toMatchObject({ id: 77 });
    });

    it.each([
        ['an empty envelope', { message: 'ok' }],
        ['a null booking', { message: 'ok', data: null }],
        ['an array instead of a booking', { message: 'ok', data: [booking()] }],
        ['a booking without a room', { message: 'ok', data: booking({ room: null }) }],
    ])('treats a malformed create success (%s) as an UNCERTAIN outcome, not a success', async (_name, body) => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse(body, 201));

        const error = await createMahasiswaBooking(payload, pdfFile(), idempotencyKey)
            .catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(PeminjamanApiError);
        expect(error).toMatchObject({ code: MALFORMED_RESPONSE_CODE });
        expect(isUncertainOutcome(error)).toBe(true);
    });

    it('classifies which failures leave the outcome unknown', () => {
        // Unknown: the write may or may not have landed.
        expect(isUncertainOutcome(new PeminjamanApiError('down', 500))).toBe(true);
        expect(isUncertainOutcome(new PeminjamanApiError('gateway', 503))).toBe(true);
        expect(isUncertainOutcome(new PeminjamanApiError('offline', 0))).toBe(true);
        expect(isUncertainOutcome(new TypeError('Failed to fetch'))).toBe(true);
        expect(isUncertainOutcome(new PeminjamanApiError(
            'bad body', 201, MALFORMED_RESPONSE_CODE,
        ))).toBe(true);

        // Definitive server rejections: nothing was created.
        expect(isUncertainOutcome(new PeminjamanApiError('invalid', 422))).toBe(false);
        expect(isUncertainOutcome(new PeminjamanApiError('conflict', 409))).toBe(false);
        expect(isUncertainOutcome(new PeminjamanApiError('forbidden', 403))).toBe(false);
    });
});

describe('Peminjaman Mahasiswa API module', () => {
    it('uses relative /api endpoints for rooms, availability, and request listing', async () => {
        await getPeminjamanRooms();
        await getPeminjamanAvailability({
            from: '2026-06-01',
            to: '2026-06-30',
            roomId: 17,
            type: 'laboratory',
        });
        await getMahasiswaBookings();

        expect(m.apiFetch).toHaveBeenNthCalledWith(1, '/api/mahasiswa/peminjaman-ruangan/rooms');
        expect(m.apiFetch).toHaveBeenNthCalledWith(
            2,
            '/api/mahasiswa/peminjaman-ruangan/availability?from=2026-06-01&to=2026-06-30&room_id=17&type=laboratory',
        );
        expect(m.apiFetch).toHaveBeenNthCalledWith(3, '/api/mahasiswa/peminjaman-ruangan/requests');
    });

    it('sends create as multipart FormData with all fields plus the surat PDF', async () => {
        const file = pdfFile();
        await createMahasiswaBooking(payload, file, idempotencyKey);

        const [url, options] = m.apiFetch.mock.calls[0];
        expect(url).toBe('/api/mahasiswa/peminjaman-ruangan/requests');
        expect(options.method).toBe('POST');
        expect(options.isFormData).toBe(true);
        expect(options.body).toBeInstanceOf(FormData);
        const body = options.body as FormData;
        expect(body.get('idempotency_key')).toBe(idempotencyKey);
        expect(body.get('room_id')).toBe('4');
        expect(body.get('activity_name')).toBe('Pengujian API');
        expect(body.get('participant_count')).toBe('8');
        expect(body.get('start_at')).toBe('2026-06-20T10:00:00+07:00');
        expect(body.get('surat_peminjaman_pdf')).toBe(file);
        // No JSON body / Content-Type is set for uploads (browser sets boundary).
        expect(typeof options.body).not.toBe('string');
    });

    it('keeps the normal PUT edit file-free (JSON body)', async () => {
        await updateMahasiswaBooking(9, payload);
        await resubmitMahasiswaBooking(9);
        // Canonical withdrawal is an idempotent POST carrying the reason, the
        // expected workflow version, and a stable idempotency key.
        m.apiFetch.mockResolvedValueOnce(
            jsonResponse({ message: 'ok', data: { booking: booking() } }),
        );
        await withdrawMahasiswaBooking(
            booking({ id: 9, workflow_version: 3 }) as never,
            'Kegiatan dibatalkan.',
            'withdraw-key-abc',
        );
        await getMahasiswaBooking(9);

        expect(m.apiFetch.mock.calls[0]).toEqual([
            '/api/mahasiswa/peminjaman-ruangan/requests/9',
            { method: 'PUT', body: JSON.stringify(payload) },
        ]);
        expect(m.apiFetch.mock.calls[1]).toEqual([
            '/api/mahasiswa/peminjaman-ruangan/requests/9/submit',
            { method: 'PATCH' },
        ]);
        expect(m.apiFetch.mock.calls[2]).toEqual([
            '/api/mahasiswa/peminjaman-ruangan/requests/9/withdraw',
            {
                method: 'POST',
                body: JSON.stringify({
                    reason: 'Kegiatan dibatalkan.',
                    expected_workflow_version: 3,
                    idempotency_key: 'withdraw-key-abc',
                }),
            },
        ]);
        expect(m.apiFetch.mock.calls[3]).toEqual(['/api/mahasiswa/peminjaman-ruangan/requests/9']);
    });

    it('replaces the surat via the dedicated multipart attachment route', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({
            message: 'ok',
            data: booking({ id: 9 }),
        }));
        const file = pdfFile('revisi.pdf');
        await replaceSuratPeminjamanPdf(9, file);

        const [url, options] = m.apiFetch.mock.calls[0];
        expect(url).toBe('/api/mahasiswa/peminjaman-ruangan/9/attachment/surat-peminjaman');
        expect(options.method).toBe('POST');
        expect(options.isFormData).toBe(true);
        expect((options.body as FormData).get('surat_peminjaman_pdf')).toBe(file);
    });

    it('builds protected preview/download URLs from the booking id only', () => {
        expect(suratPeminjamanPreviewUrl(9))
            .toBe('/api/peminjaman-ruangan/9/attachment/surat-peminjaman/preview');
        expect(suratPeminjamanDownloadUrl(9))
            .toBe('/api/peminjaman-ruangan/9/attachment/surat-peminjaman/download');
    });

    it('downloads the surat via the protected route as an authenticated blob', async () => {
        const createObjectURL = vi.fn(() => 'blob:surat');
        const revokeObjectURL = vi.fn();
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: createObjectURL,
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: revokeObjectURL,
        });
        m.apiFetch.mockResolvedValueOnce(new Response(
            new Blob(['%PDF'], { type: 'application/pdf' }),
            { status: 200 },
        ));

        await downloadSuratPeminjamanPdf(9, 'surat.pdf');

        expect(m.apiFetch).toHaveBeenCalledWith(
            '/api/peminjaman-ruangan/9/attachment/surat-peminjaman/download',
            expect.objectContaining({ cache: 'no-store' }),
        );
        expect(createObjectURL).toHaveBeenCalled();
        expect(revokeObjectURL).toHaveBeenCalled();
    });

    it('maps download 403/404 to a user-facing message', async () => {
        m.apiFetch.mockResolvedValueOnce(new Response('', { status: 403 }));
        await expect(downloadSuratPeminjamanPdf(9)).rejects.toThrow('Anda tidak berwenang mengunduh surat ini.');

        m.apiFetch.mockResolvedValueOnce(new Response('', { status: 404 }));
        await expect(downloadSuratPeminjamanPdf(9)).rejects.toThrow('Surat peminjaman tidak ditemukan.');
    });

    it('surfaces the backend message for non-success responses', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ message: 'Rentang tanggal tidak valid.' }, 422));

        await expect(getPeminjamanAvailability({
            from: '2026-06-30',
            to: '2026-06-01',
        })).rejects.toThrow('Rentang tanggal tidak valid.');
    });

    it('preserves backend status, code, and validation fields', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({
            message: 'Validasi gagal.',
            code: 'booking_conflict',
            errors: { participant_count: ['Jumlah peserta terlalu besar.'] },
            data: { conflicts: [{ booking_id: 1 }] },
        }, 409));

        const error = await getPeminjamanAvailability({
            from: '2026-06-20',
            to: '2026-06-20',
        }).catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(PeminjamanApiError);
        expect(error).toMatchObject({
            status: 409,
            code: 'booking_conflict',
            errors: { participant_count: ['Jumlah peserta terlalu besar.'] },
        });
    });

    it('never targets a legacy route or a raw storage URL', () => {
        expect(apiSource).not.toContain('VITE_API_BASE_URL');
        expect(apiSource).not.toContain('localhost');
        expect(apiSource).not.toContain('/api/room-bookings');
        expect(apiSource).not.toContain('/storage');
        expect(apiSource).toContain('/api/mahasiswa/peminjaman-ruangan');
        expect(apiSource).toContain('/attachment/surat-peminjaman');
    });
});
