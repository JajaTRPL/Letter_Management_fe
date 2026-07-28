import { describe, expect, it } from 'vitest';
import { notificationHasDestination, resolveNotificationWorkbench } from '../notification-routes';

/**
 * The deep-link resolver must send every allowlisted route key to the correct
 * workbench — not a generic dashboard when a precise target exists.
 */
describe('notification deep-link resolver', () => {
    it('routes mahasiswa booking + occurrence + letter to their surfaces', () => {
        expect(resolveNotificationWorkbench('mahasiswa.booking.detail', '42'))
            .toEqual({ surface: 'mahasiswa-booking-detail', bookingId: 42 });
        // A non-numeric booking id degrades safely to the list.
        expect(resolveNotificationWorkbench('mahasiswa.booking.detail', 'not-a-number'))
            .toEqual({ surface: 'mahasiswa-booking-list' });
        expect(resolveNotificationWorkbench('mahasiswa.booking.occurrence', 'uuid'))
            .toEqual({ surface: 'mahasiswa-booking-list' });
        expect(resolveNotificationWorkbench('mahasiswa.letter.detail', '7'))
            .toEqual({ surface: 'mahasiswa-riwayat' });
    });

    it('routes reviewers to their exact workbench, not a generic dashboard', () => {
        // Booking review → the tendik queue tab.
        expect(resolveNotificationWorkbench('sarpras.booking.review', '9'))
            .toEqual({ surface: 'tendik-peminjaman', tab: 'queue' });
        expect(resolveNotificationWorkbench('kalab.booking.review', '9'))
            .toEqual({ surface: 'tendik-peminjaman', tab: 'queue' });
        // Key/return operations → the operations tab (precise, not the queue).
        for (const key of ['sarpras.operations', 'laboran.operations', 'kalab.operations']) {
            expect(resolveNotificationWorkbench(key, 'occ')).toEqual({ surface: 'tendik-peminjaman', tab: 'operations' });
        }
    });

    it('routes letter reviewers to their letter queue dashboards', () => {
        expect(resolveNotificationWorkbench('persuratan.letter.queue', '1')?.surface).toBe('tendik-dashboard');
        expect(resolveNotificationWorkbench('persuratan.letter.detail', '1')?.surface).toBe('tendik-dashboard');
        expect(resolveNotificationWorkbench('akademik.letter.queue', '1')?.surface).toBe('akademik-dashboard');
        expect(resolveNotificationWorkbench('akademik.letter.detail', '1')?.surface).toBe('akademik-dashboard');
    });

    it('routes superadmin health to the admin dashboard', () => {
        expect(resolveNotificationWorkbench('superadmin.health', 'anomaly')?.surface).toBe('admin-dashboard');
    });

    it('returns null (mark-read only, no navigation) for unknown/absent keys', () => {
        expect(resolveNotificationWorkbench(null, null)).toBeNull();
        expect(resolveNotificationWorkbench('made.up.key', '1')).toBeNull();
        expect(notificationHasDestination('made.up.key')).toBe(false);
        expect(notificationHasDestination('sarpras.operations')).toBe(true);
        expect(notificationHasDestination('mahasiswa.booking.detail')).toBe(true);
    });
});
