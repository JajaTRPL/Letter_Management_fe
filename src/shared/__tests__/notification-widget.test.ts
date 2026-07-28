// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    fetchNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    navigateForNotification: vi.fn(),
    renderNotifikasi: vi.fn(),
}));

vi.mock('../notifications-api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../notifications-api')>()),
    fetchNotifications: m.fetchNotifications,
    markNotificationRead: m.markNotificationRead,
}));

vi.mock('../notification-routes', () => ({
    navigateForNotification: m.navigateForNotification,
}));

// The widget's "see all" dynamically imports the inbox; stub it so the test does
// not pull the whole dashboard graph.
vi.mock('../../dashboard/Notifikasi', () => ({ renderNotifikasi: m.renderNotifikasi }));

import {
    hydrateNotificationWidget,
    notificationWidgetShell,
    type NotificationWidgetConfig,
} from '../notification-widget';

const CONFIG: NotificationWidgetConfig = {
    mountId: 'test-widget',
    category: 'reminder',
    role: 'mahasiswa',
    title: 'Pengingat & Tenggat',
    subtitle: 'Tenggat peminjaman ruangan Anda.',
    emptyTitle: 'Tidak ada pengingat aktif',
    emptyBody: 'Akan tampil di sini.',
    limit: 4,
    accent: 'calm',
};

const notif = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    event_type: 'room_booking_return_due',
    category: 'reminder',
    priority: 'high',
    title: 'Pengembalian kunci hari ini',
    body: 'Kembalikan kunci Ruang A sebelum 17.00.',
    subject_type: 'room_booking',
    subject_id: '42',
    action: { route_key: 'mahasiswa.booking.detail', label: 'Buka Detail' },
    is_read: false,
    is_resolved: false,
    occurred_at: '2026-07-27T08:00:00+07:00',
    read_at: null,
    resolved_at: null,
    expires_at: null,
    schema_version: 1,
    ...overrides,
});

const page = (items: unknown[], total = items.length) => ({
    items,
    unreadCount: items.length,
    currentPage: 1,
    lastPage: 1,
    total,
});

beforeEach(() => {
    document.body.innerHTML = '';
    Object.values(m).forEach((fn) => fn.mockReset());
    m.markNotificationRead.mockResolvedValue(undefined);
    m.navigateForNotification.mockResolvedValue(true);
    // The host embeds the shell (loading state) first.
    document.body.innerHTML = notificationWidgetShell(CONFIG);
});

describe('notification dashboard widget', () => {
    it('renders the shell as a labelled section in the loading state', () => {
        const section = document.getElementById('test-widget');
        expect(section?.tagName).toBe('SECTION');
        expect(section?.getAttribute('aria-labelledby')).toBe('test-widget-title');
        expect(document.getElementById('test-widget-body')?.getAttribute('aria-busy')).toBe('true');
    });

    it('fetches unresolved notifications scoped to its category', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()]));
        await hydrateNotificationWidget(CONFIG);

        expect(m.fetchNotifications).toHaveBeenCalledWith({
            category: 'reminder',
            unresolved: true,
            perPage: 4,
        });
        expect(document.querySelector('#test-widget ul[role="list"] > li')).not.toBeNull();
        expect(document.body.textContent).toContain('Pengembalian kunci hari ini');
        expect(document.getElementById('test-widget-body')?.getAttribute('aria-busy')).toBe('false');
    });

    it('deep-links an item to its workbench and marks it read', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()]));
        await hydrateNotificationWidget(CONFIG);

        (document.querySelector('#test-widget [data-widget-notif="r1"]') as HTMLElement).click();

        expect(m.markNotificationRead).toHaveBeenCalledWith('r1');
        expect(m.navigateForNotification).toHaveBeenCalledWith('mahasiswa.booking.detail', '42', 'mahasiswa');
    });

    it('opens the inbox pre-filtered to its category via "see all"', async () => {
        // total (6) exceeds the inline limit (4) so the "see all" control renders.
        m.fetchNotifications.mockResolvedValue(page([notif(), notif({ id: 'r2' })], 6));
        await hydrateNotificationWidget(CONFIG);

        const seeAll = document.getElementById('test-widget-all');
        expect(seeAll).not.toBeNull();
        seeAll!.click();
        await vi.waitFor(() => expect(m.renderNotifikasi).toHaveBeenCalledWith('mahasiswa', { category: 'reminder' }));
    });

    it('shows an honest empty state (not a fake list) when there is nothing', async () => {
        m.fetchNotifications.mockResolvedValue(page([]));
        await hydrateNotificationWidget(CONFIG);

        expect(document.body.textContent).toContain('Tidak ada pengingat aktif');
        expect(document.querySelector('#test-widget ul[role="list"]')).toBeNull();
        // A concise polite summary is announced, not the list.
        expect(document.getElementById('test-widget-status')?.textContent).toContain('Tidak ada pengingat aktif');
    });

    it('renders an in-widget error with retry and never throws to the host', async () => {
        m.fetchNotifications.mockRejectedValue(new Error('Sesi berakhir.'));
        await expect(hydrateNotificationWidget(CONFIG)).resolves.toBeUndefined();

        expect(document.body.textContent).toContain('Gagal memuat');
        expect(document.body.textContent).toContain('Sesi berakhir.');
        const retry = document.getElementById('test-widget-retry');
        expect(retry).not.toBeNull();

        // Retry re-fetches; a subsequent success replaces the error.
        m.fetchNotifications.mockResolvedValue(page([notif()]));
        retry!.click();
        await vi.waitFor(() => expect(document.body.textContent).toContain('Pengembalian kunci hari ini'));
    });
});
