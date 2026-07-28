// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../api-client', () => ({ apiFetch: m.apiFetch }));

import {
    fetchNotifications,
    fetchUnreadCount,
    markAllNotificationsRead,
    markNotificationRead,
    NotificationApiError,
    notificationCategoryLabel,
} from '../notifications-api';

const jsonResponse = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const notification = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'uuid-1',
    event_type: 'letter_persuratan_review',
    category: 'action_required',
    priority: 'high',
    title: 'Perlu tindakan',
    body: 'Sebuah surat menunggu.',
    subject_type: 'surat-keterangan-aktif',
    subject_id: '7',
    action: { route_key: 'persuratan.letter.queue', label: 'Tinjau' },
    is_read: false,
    is_resolved: false,
    occurred_at: '2026-07-14T10:00:00+07:00',
    read_at: null,
    resolved_at: null,
    expires_at: null,
    schema_version: 1,
    ...overrides,
});

beforeEach(() => m.apiFetch.mockReset());

describe('notifications-api client', () => {
    it('lists notifications and reads unread_count + pagination from meta', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({
            data: [notification(), notification({ id: 'uuid-2', is_read: true })],
            meta: { unread_count: 3, current_page: 1, last_page: 2, total: 12 },
        }));

        const page = await fetchNotifications();
        expect(page.items).toHaveLength(2);
        expect(page.unreadCount).toBe(3);
        expect(page.lastPage).toBe(2);
        expect(page.total).toBe(12);
        expect(m.apiFetch).toHaveBeenCalledWith('/api/notifications');
    });

    it('passes the unread filter as a query param', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ data: [], meta: { unread_count: 0 } }));
        await fetchNotifications({ unread: true, category: 'reminder' });
        expect(m.apiFetch).toHaveBeenCalledWith('/api/notifications?unread=1&category=reminder');
    });

    it('rejects a malformed 200 body instead of rendering a fake empty inbox', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ data: { rows: [] }, meta: {} }));
        await expect(fetchNotifications()).rejects.toBeInstanceOf(NotificationApiError);

        m.apiFetch.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }], meta: {} }));
        await expect(fetchNotifications()).rejects.toBeInstanceOf(NotificationApiError);
    });

    it('surfaces a non-2xx with the server message', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ message: 'Sesi berakhir.' }, 401));
        await expect(fetchNotifications()).rejects.toMatchObject({ status: 401, message: 'Sesi berakhir.' });
    });

    it('reads the unread count endpoint', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ data: { unread: 5, unresolved: 9 } }));
        await expect(fetchUnreadCount()).resolves.toBe(5);
    });

    it('marks one and all read via PATCH', async () => {
        m.apiFetch.mockResolvedValueOnce(jsonResponse({ data: notification({ is_read: true }) }));
        await markNotificationRead('uuid-1');
        expect(m.apiFetch).toHaveBeenCalledWith('/api/notifications/uuid-1/read', { method: 'PATCH' });

        m.apiFetch.mockResolvedValueOnce(jsonResponse({ data: { marked_read: 4 } }));
        await expect(markAllNotificationsRead()).resolves.toBe(4);
        expect(m.apiFetch).toHaveBeenLastCalledWith('/api/notifications/read-all', { method: 'PATCH' });
    });

    it('maps category codes to Indonesian labels', () => {
        expect(notificationCategoryLabel('action_required')).toBe('Perlu Tindakan');
        expect(notificationCategoryLabel('system')).toBe('Sistem');
        expect(notificationCategoryLabel('unknown')).toBe('Notifikasi');
    });
});
