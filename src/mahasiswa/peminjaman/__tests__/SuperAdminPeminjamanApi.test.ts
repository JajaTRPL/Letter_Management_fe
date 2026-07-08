import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
}));

vi.mock('../../../shared/api-client', () => ({
    apiFetch: m.apiFetch,
}));

import {
    activateSuperAdminRoom,
    createSuperAdminRoom,
    deactivateSuperAdminRoom,
    getSuperAdminBooking,
    getSuperAdminBookingCalendar,
    getSuperAdminBookings,
    getSuperAdminLaboratories,
    getSuperAdminRoom,
    getSuperAdminRooms,
    PeminjamanApiError,
    updateSuperAdminRoom,
} from '../api';
import apiSource from '../api.ts?raw';

const jsonResponse = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const roomPayload = {
    code: 'ROOM-01',
    name: 'Ruang Uji',
    type: 'classroom' as const,
    capacity: 30,
    location: 'Gedung Uji',
    description: null,
    owning_laboratory_id: null,
};

beforeEach(() => {
    m.apiFetch.mockReset();
    m.apiFetch.mockResolvedValue(jsonResponse({
        message: 'ok',
        count: 0,
        data: {},
        meta: {
            current_page: 1,
            per_page: 10,
            total: 0,
            last_page: 1,
        },
    }));
});

describe('Peminjaman Super Admin API module', () => {
    it('builds room list filters using the backend query names', async () => {
        await getSuperAdminRooms({
            type: 'laboratory',
            laboratoryId: 7,
            search: 'uji ruang',
            active: false,
        });

        expect(m.apiFetch).toHaveBeenCalledWith(
            '/api/super-admin/peminjaman-ruangan/rooms?type=laboratory&laboratory_id=7&search=uji+ruang&active=0',
        );
    });

    it('uses room detail, create, and PUT update endpoints with typed bodies', async () => {
        await getSuperAdminRoom(12);
        await createSuperAdminRoom(roomPayload);
        await updateSuperAdminRoom(12, roomPayload);

        expect(m.apiFetch.mock.calls).toEqual([
            ['/api/super-admin/peminjaman-ruangan/rooms/12'],
            ['/api/super-admin/peminjaman-ruangan/rooms', {
                method: 'POST',
                body: JSON.stringify(roomPayload),
            }],
            ['/api/super-admin/peminjaman-ruangan/rooms/12', {
                method: 'PUT',
                body: JSON.stringify(roomPayload),
            }],
        ]);
    });

    it('uses separate activate and deactivate PATCH endpoints', async () => {
        await activateSuperAdminRoom(12);
        await deactivateSuperAdminRoom(12);

        expect(m.apiFetch.mock.calls).toEqual([
            ['/api/super-admin/peminjaman-ruangan/rooms/12/activate', {
                method: 'PATCH',
            }],
            ['/api/super-admin/peminjaman-ruangan/rooms/12/deactivate', {
                method: 'PATCH',
            }],
        ]);
    });

    it('loads the minimal laboratory endpoint', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse([
            { id: 7, code: 'LAB', name: 'Laboratorium Uji' },
        ]));
        await getSuperAdminLaboratories();

        expect(m.apiFetch).toHaveBeenCalledWith('/api/laboratories');
    });

    it('builds booking monitoring filters and detail endpoints', async () => {
        await getSuperAdminBookings({
            status: 'approved',
            roomType: 'classroom',
            roomId: 12,
            dateFrom: '2026-06-20',
            dateTo: '2026-06-30',
            page: 2,
            perPage: 25,
        });
        await getSuperAdminBooking(44);

        expect(m.apiFetch.mock.calls).toEqual([
            ['/api/super-admin/peminjaman-ruangan/requests?status=approved&room_type=classroom&room_id=12&date_from=2026-06-20&date_to=2026-06-30&page=2&per_page=25'],
            ['/api/super-admin/peminjaman-ruangan/requests/44'],
        ]);
    });

    it('builds calendar monitoring filters using the backend query names', async () => {
        await getSuperAdminBookingCalendar({
            month: '2026-07',
            status: 'submitted',
            roomType: 'laboratory',
            roomId: 13,
            laboratoryId: 7,
        });

        expect(m.apiFetch).toHaveBeenCalledWith(
            '/api/super-admin/peminjaman-ruangan/calendar?month=2026-07&status=submitted&room_type=laboratory&room_id=13&laboratory_id=7',
        );
    });

    it.each([403, 404, 409, 422])(
        'preserves backend status %s and validation payloads',
        async (status) => {
            m.apiFetch.mockResolvedValueOnce(jsonResponse({
                message: `Error ${status}`,
                code: status === 409 ? 'booking_conflict' : undefined,
                errors: status === 422 ? { code: ['Kode sudah digunakan.'] } : undefined,
            }, status));

            const error = await getSuperAdminRoom(12).catch((reason: unknown) => reason);

            expect(error).toBeInstanceOf(PeminjamanApiError);
            expect(error).toMatchObject({ status, message: `Error ${status}` });
        },
    );

    it('keeps all endpoints relative and environment-independent', () => {
        expect(apiSource).toContain('/api/super-admin/peminjaman-ruangan');
        expect(apiSource).toContain('/api/laboratories');
        expect(apiSource).not.toContain('VITE_API_BASE_URL');
        expect(apiSource).not.toContain('localhost');
    });
});
