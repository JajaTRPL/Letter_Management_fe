import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
}));

vi.mock('../../../shared/api-client', () => ({
    apiFetch: m.apiFetch,
}));

import {
    approveTendikBooking,
    getTendikBooking,
    getTendikBookings,
    getTendikOperationalOccurrences,
    getTendikReviewerProfile,
    PeminjamanApiError,
    rejectTendikBooking,
    reviseTendikBooking,
} from '../api';
import apiSource from '../api.ts?raw';

const jsonResponse = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

beforeEach(() => {
    m.apiFetch.mockReset();
    m.apiFetch.mockResolvedValue(jsonResponse({
        message: 'ok',
        data: {},
        meta: {
            current_page: 1,
            per_page: 10,
            total: 0,
            last_page: 1,
        },
    }));
});

describe('Peminjaman Tendik reviewer API module', () => {
    it('builds the reviewer list query with every supported filter', async () => {
        await getTendikBookings({
            status: 'submitted',
            roomType: 'laboratory',
            roomId: 12,
            dateFrom: '2026-06-18',
            dateTo: '2026-06-30',
            page: 2,
            perPage: 25,
        });

        expect(m.apiFetch).toHaveBeenCalledWith(
            '/api/tendik/peminjaman-ruangan/requests?status=submitted&room_type=laboratory&room_id=12&date_from=2026-06-18&date_to=2026-06-30&page=2&per_page=25',
        );
    });

    it('uses the current profile and typed detail endpoint', async () => {
        m.apiFetch
            .mockResolvedValueOnce(jsonResponse({
                user: { id: 7, role: 'tendik', tendik_role: 'sarpras' },
            }))
            .mockResolvedValueOnce(jsonResponse({ message: 'ok', data: { id: 44 } }));

        await getTendikReviewerProfile();
        await getTendikBooking(44);

        expect(m.apiFetch.mock.calls).toEqual([
            ['/api/profile', { cache: 'no-store' }],
            ['/api/tendik/peminjaman-ruangan/requests/44'],
        ]);
    });

    it('builds approve, revise, and reject requests with backend-supported bodies', async () => {
        await approveTendikBooking(44);
        await reviseTendikBooking(44, 'Perbaiki waktu kegiatan.');
        await rejectTendikBooking(44, 'Ruangan digunakan untuk agenda departemen.');

        expect(m.apiFetch.mock.calls).toEqual([
            ['/api/tendik/peminjaman-ruangan/requests/44/approve', {
                method: 'PATCH',
            }],
            ['/api/tendik/peminjaman-ruangan/requests/44/revise', {
                method: 'PATCH',
                body: JSON.stringify({ note: 'Perbaiki waktu kegiatan.' }),
            }],
            ['/api/tendik/peminjaman-ruangan/requests/44/reject', {
                method: 'PATCH',
                body: JSON.stringify({ reason: 'Ruangan digunakan untuk agenda departemen.' }),
            }],
        ]);
    });

    it.each([403, 404, 409, 422])(
        'preserves reviewer error status %s and backend payload',
        async (status) => {
            m.apiFetch.mockResolvedValueOnce(jsonResponse({
                message: `Reviewer error ${status}`,
                code: status === 409 ? 'booking_conflict' : undefined,
                errors: status === 422 ? { note: ['Catatan wajib diisi.'] } : undefined,
            }, status));

            const error = await getTendikBooking(44).catch((reason: unknown) => reason);

            expect(error).toBeInstanceOf(PeminjamanApiError);
            expect(error).toMatchObject({ status, message: `Reviewer error ${status}` });
        },
    );

    it('keeps reviewer endpoints relative and environment-independent', () => {
        expect(apiSource).toContain('/api/tendik/peminjaman-ruangan/requests');
        expect(apiSource).not.toContain('VITE_API_BASE_URL');
        expect(apiSource).not.toContain('localhost');
    });

    it('rejects a malformed operational 2xx before nested room data can crash rendering', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({
            message: 'ok',
            data: [{ occurrence_ref: 'partial', booking: {} }],
        }));

        const error = await getTendikOperationalOccurrences('today')
            .catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(PeminjamanApiError);
        expect(error).toMatchObject({ status: 200, code: 'malformed_response' });
    });
});
