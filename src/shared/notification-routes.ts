/**
 * Deep-link routing for notifications. Maps the backend's allowlisted
 * `action.route_key` values (App\Services\Notifications\NotificationActionRoute)
 * to the correct in-app workbench, so an item opens where the user actually
 * acts — the review queue, the operations/return workbench, the applicant's
 * history, or the relevant dashboard — rather than a generic landing.
 *
 * The RESOLVER is pure and fully unit-tested; the NAVIGATOR performs the
 * dynamic import + render for the resolved surface (dynamic imports match the
 * app's page-to-page convention and keep the static import graph acyclic).
 */

export type NotificationWorkbench =
    | { surface: 'mahasiswa-booking-detail'; bookingId: number }
    | { surface: 'mahasiswa-booking-list' }
    | { surface: 'mahasiswa-riwayat' }
    | { surface: 'tendik-dashboard' }
    | { surface: 'akademik-dashboard' }
    | { surface: 'tendik-peminjaman'; tab: 'queue' | 'operations' }
    | { surface: 'admin-dashboard' };

/**
 * Decide the destination for a notification from its route key + subject id.
 * Returns null when no safe in-app destination is known (the caller then just
 * marks the item read without navigating). Pure — no side effects.
 */
export function resolveNotificationWorkbench(
    routeKey: string | null | undefined,
    subjectId: string | null | undefined,
): NotificationWorkbench | null {
    switch (routeKey) {
        case 'mahasiswa.booking.detail': {
            const bookingId = Number(subjectId);
            return Number.isInteger(bookingId) && bookingId > 0
                ? { surface: 'mahasiswa-booking-detail', bookingId }
                : { surface: 'mahasiswa-booking-list' };
        }
        case 'mahasiswa.booking.occurrence':
            return { surface: 'mahasiswa-booking-list' };
        case 'mahasiswa.letter.detail':
            return { surface: 'mahasiswa-riwayat' };

        case 'persuratan.letter.queue':
        case 'persuratan.letter.detail':
            return { surface: 'tendik-dashboard' };

        case 'akademik.letter.queue':
        case 'akademik.letter.detail':
            return { surface: 'akademik-dashboard' };

        case 'sarpras.booking.review':
        case 'kalab.booking.review':
            return { surface: 'tendik-peminjaman', tab: 'queue' };

        case 'sarpras.operations':
        case 'laboran.operations':
        case 'kalab.operations':
            return { surface: 'tendik-peminjaman', tab: 'operations' };

        case 'superadmin.health':
            return { surface: 'admin-dashboard' };

        default:
            return null;
    }
}

/** True when the route key has a known safe in-app destination. */
export const notificationHasDestination = (routeKey: string | null | undefined): boolean =>
    resolveNotificationWorkbench(routeKey, null) !== null
    || routeKey === 'mahasiswa.booking.detail';

/**
 * Navigate to the resolved workbench. Returns whether navigation occurred.
 * Failure-isolated: a chunk that fails to load leaves the user in the inbox
 * (they have already been marked-read) rather than throwing.
 */
export async function navigateForNotification(
    routeKey: string | null | undefined,
    subjectId: string | null | undefined,
    role: string,
): Promise<boolean> {
    const target = resolveNotificationWorkbench(routeKey, subjectId);
    if (!target) return false;

    try {
        switch (target.surface) {
            case 'mahasiswa-booking-detail': {
                const { openPeminjamanBookingDetail } = await import('../mahasiswa/peminjaman/detail');
                await openPeminjamanBookingDetail(target.bookingId);
                return true;
            }
            case 'mahasiswa-booking-list': {
                const { renderPeminjamanListPage } = await import('../mahasiswa/peminjaman/list-page');
                await renderPeminjamanListPage();
                return true;
            }
            case 'mahasiswa-riwayat': {
                const { renderRiwayatPengajuan } = await import('../mahasiswa/RiwayatPengajuan');
                await renderRiwayatPengajuan();
                return true;
            }
            case 'tendik-dashboard': {
                const { renderTendikDashboard } = await import('../dashboard/TendikDashboard');
                await renderTendikDashboard(role);
                return true;
            }
            case 'akademik-dashboard': {
                const { renderAkademikDashboard } = await import('../dashboard/AkademikDashboard');
                await renderAkademikDashboard(role);
                return true;
            }
            case 'tendik-peminjaman': {
                const { renderPeminjamanRuanganTendik } = await import('../tendik/PeminjamanRuanganTendik');
                await renderPeminjamanRuanganTendik(role, target.tab);
                return true;
            }
            case 'admin-dashboard': {
                const { renderAdminDashboard } = await import('../dashboard/AdminDashboard');
                await renderAdminDashboard();
                return true;
            }
        }
    } catch {
        return false;
    }
    return false;
}
