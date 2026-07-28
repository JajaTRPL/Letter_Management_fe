// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    fetchNotifications: vi.fn(),
    fetchUnreadCount: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
}));

vi.mock('../DashboardLayout', () => ({
    renderDashboardLayout: (_title: string, content: string) => {
        document.body.innerHTML = content;
    },
}));

vi.mock('../../shared/notifications-api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../shared/notifications-api')>()),
    fetchNotifications: m.fetchNotifications,
    fetchUnreadCount: m.fetchUnreadCount,
    markNotificationRead: m.markNotificationRead,
    markAllNotificationsRead: m.markAllNotificationsRead,
}));

vi.mock('toastify-js', () => ({ default: vi.fn(() => ({ showToast: vi.fn() })) }));

// The inbox test must not load real workbench pages on click — the deep-link
// registry is unit-tested separately (notification-routes.test.ts).
vi.mock('../../shared/notification-routes', () => ({
    navigateForNotification: vi.fn(async () => true),
}));

import { renderNotifikasi } from '../Notifikasi';
import { navigateForNotification } from '../../shared/notification-routes';

const notif = (overrides: Record<string, unknown> = {}) => ({
    id: 'n1',
    event_type: 'letter_persuratan_review',
    category: 'action_required',
    priority: 'high',
    title: 'Perlu tindakan: tinjau pengajuan surat',
    body: 'Surat Keterangan Aktif menunggu verifikasi Anda.',
    subject_type: null,
    subject_id: null,
    action: { route_key: 'persuratan.letter.queue', label: 'Tinjau Pengajuan' },
    is_read: false,
    is_resolved: false,
    occurred_at: '2026-07-14T10:00:00+07:00',
    read_at: null,
    resolved_at: null,
    expires_at: null,
    schema_version: 1,
    ...overrides,
});

const page = (items: unknown[], unreadCount = items.length) => ({
    items,
    unreadCount,
    currentPage: 1,
    lastPage: 1,
    total: items.length,
});

beforeEach(() => {
    document.body.innerHTML = '';
    Object.values(m).forEach((fn) => fn.mockReset());
    m.fetchUnreadCount.mockResolvedValue(0);
    m.markNotificationRead.mockResolvedValue(undefined);
    m.markAllNotificationsRead.mockResolvedValue(0);
});

describe('Notifikasi inbox', () => {
    it('renders real notifications from the API with category labels', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()], 1));

        renderNotifikasi('tendik-persuratan');

        await vi.waitFor(() => {
            expect(document.querySelector('[data-notif-id="n1"]')).not.toBeNull();
        });
        expect(document.body.textContent).toContain('tinjau pengajuan surat');
        expect(document.body.textContent).toContain('Perlu Tindakan');
        // It is NOT the old empty placeholder.
        expect(document.body.textContent).not.toContain('setelah terhubung dengan data sistem');
    });

    it('shows the empty state when there are no notifications', async () => {
        m.fetchNotifications.mockResolvedValue(page([], 0));

        renderNotifikasi('mahasiswa');

        await vi.waitFor(() => {
            expect(document.body.textContent).toContain('Belum ada notifikasi.');
        });
    });

    it('marks a notification read on open and drops the unread indicator', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()], 1));

        renderNotifikasi('mahasiswa');
        await vi.waitFor(() => {
            expect(document.querySelector('[data-notif-id="n1"]')).not.toBeNull();
        });

        (document.querySelector('[data-notif-id="n1"]') as HTMLElement).click();

        await vi.waitFor(() => {
            expect(m.markNotificationRead).toHaveBeenCalledWith('n1');
        });
        // No "Belum dibaca" label remains for the opened item.
        expect(document.body.textContent).not.toContain('Belum dibaca');
        // It deep-links via the route registry with the item's route key.
        expect(navigateForNotification).toHaveBeenCalledWith('persuratan.letter.queue', null, 'mahasiswa');
    });

    it('renders items as an accessible list (ul/li) of real buttons', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()], 1));
        renderNotifikasi('mahasiswa');
        await vi.waitFor(() => expect(document.querySelector('[data-notif-id="n1"]')).not.toBeNull());

        expect(document.querySelector('ul[role="list"] > li')).not.toBeNull();
        expect((document.querySelector('[data-notif-id="n1"]') as HTMLElement).tagName).toBe('BUTTON');
        expect(document.querySelector('[data-notif-id="n1"]')?.getAttribute('aria-label')).toContain('Belum dibaca');
    });

    it('the "Belum Dibaca" tab refetches with the unread filter', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()], 1));
        renderNotifikasi('mahasiswa');
        await vi.waitFor(() => expect(m.fetchNotifications).toHaveBeenCalled());

        m.fetchNotifications.mockClear();
        m.fetchNotifications.mockResolvedValue(page([], 0));
        (document.getElementById('notif-tab-belum_dibaca') as HTMLElement).click();

        await vi.waitFor(() => {
            expect(m.fetchNotifications).toHaveBeenCalledWith({ unread: true });
        });
    });

    it('shows an error state (not a fake empty inbox) when the API fails', async () => {
        m.fetchNotifications.mockRejectedValue(new Error('Sesi berakhir.'));

        renderNotifikasi('mahasiswa');

        await vi.waitFor(() => {
            expect(document.body.textContent).toContain('Notifikasi gagal dimuat');
        });
        expect(document.body.textContent).toContain('Sesi berakhir.');
        expect(document.getElementById('notif-retry')).not.toBeNull();
    });

    it('announces a concise summary via a polite status line, not the whole list', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif(), notif({ id: 'n2' })], 2));
        renderNotifikasi('mahasiswa');
        await vi.waitFor(() => expect(document.querySelector('[data-notif-id="n1"]')).not.toBeNull());

        const status = document.getElementById('notif-status');
        expect(status?.getAttribute('role')).toBe('status');
        expect(status?.getAttribute('aria-live')).toBe('polite');
        expect(status?.textContent).toContain('Menampilkan 2 notifikasi');
        // The list container itself must NOT be a live region (that would re-read
        // every item on each re-render).
        expect(document.getElementById('notif-list')?.getAttribute('aria-live')).toBeNull();
    });

    it('wires the ARIA tab/panel relationship with roving tabindex', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()], 1));
        renderNotifikasi('mahasiswa');
        await vi.waitFor(() => expect(document.querySelector('[data-notif-id="n1"]')).not.toBeNull());

        const panel = document.getElementById('notif-list');
        expect(panel?.getAttribute('role')).toBe('tabpanel');
        expect(panel?.getAttribute('aria-labelledby')).toBe('notif-tab-semua');

        const active = document.getElementById('notif-tab-semua');
        const inactive = document.getElementById('notif-tab-belum_dibaca');
        expect(active?.getAttribute('aria-controls')).toBe('notif-list');
        expect(active?.getAttribute('tabindex')).toBe('0');
        expect(inactive?.getAttribute('tabindex')).toBe('-1');
    });

    it('activates the next tab on ArrowRight (WAI-ARIA keyboard model)', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()], 1));
        renderNotifikasi('mahasiswa');
        await vi.waitFor(() => expect(m.fetchNotifications).toHaveBeenCalled());

        m.fetchNotifications.mockClear();
        m.fetchNotifications.mockResolvedValue(page([], 0));
        document.getElementById('notif-tab-semua')?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        );

        await vi.waitFor(() => {
            expect(m.fetchNotifications).toHaveBeenCalledWith({ unread: true });
        });
        // Focus is returned to the newly-active tab after the reload re-renders.
        expect(document.activeElement?.id).toBe('notif-tab-belum_dibaca');
    });

    it('filters by category when a category pill is clicked', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()], 1));
        renderNotifikasi('mahasiswa');
        await vi.waitFor(() => expect(m.fetchNotifications).toHaveBeenCalled());

        m.fetchNotifications.mockClear();
        m.fetchNotifications.mockResolvedValue(page([], 0));
        (document.getElementById('notif-cat-reminder') as HTMLElement).click();

        await vi.waitFor(() => {
            expect(m.fetchNotifications).toHaveBeenCalledWith({ category: 'reminder' });
        });
        // The active pill reflects the selection for assistive tech.
        expect(document.getElementById('notif-cat-reminder')?.getAttribute('aria-pressed')).toBe('true');
        expect(document.getElementById('notif-cat-all')?.getAttribute('aria-pressed')).toBe('false');
    });

    it('opens pre-scoped to a category when given options.category (widget "see all")', async () => {
        m.fetchNotifications.mockResolvedValue(page([], 0));
        renderNotifikasi('mahasiswa', { category: 'system' });

        await vi.waitFor(() => {
            expect(m.fetchNotifications).toHaveBeenCalledWith({ category: 'system' });
        });
        expect(document.getElementById('notif-cat-system')?.getAttribute('aria-pressed')).toBe('true');
        // Honest, category-specific empty copy — not a generic "no notifications".
        expect(document.body.textContent).toContain('Tidak ada notifikasi kategori "Sistem".');
    });

    it('combines category with the unread tab in one query', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()], 1));
        renderNotifikasi('mahasiswa', { category: 'reminder' });
        await vi.waitFor(() => expect(m.fetchNotifications).toHaveBeenCalled());

        m.fetchNotifications.mockClear();
        m.fetchNotifications.mockResolvedValue(page([], 0));
        (document.getElementById('notif-tab-belum_dibaca') as HTMLElement).click();

        await vi.waitFor(() => {
            expect(m.fetchNotifications).toHaveBeenCalledWith({ unread: true, category: 'reminder' });
        });
    });

    it('mark-all-read calls the API and reloads', async () => {
        m.fetchNotifications.mockResolvedValue(page([notif()], 1));
        renderNotifikasi('mahasiswa');
        await vi.waitFor(() => expect(document.getElementById('notif-mark-all')).not.toBeNull());

        m.markAllNotificationsRead.mockResolvedValue(1);
        m.fetchNotifications.mockResolvedValue(page([notif({ is_read: true })], 0));
        (document.getElementById('notif-mark-all') as HTMLElement).click();

        await vi.waitFor(() => {
            expect(m.markAllNotificationsRead).toHaveBeenCalled();
        });
    });
});
