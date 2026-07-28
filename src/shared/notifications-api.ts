import { apiFetch } from './api-client';

/**
 * Single frontend client for the C7N1 durable-notification backbone
 * (`/api/notifications`). This is the ONE source the notification surfaces read
 * from — bell badge, inbox, and any future queue/calendar widget all go through
 * here. Response shapes mirror NotificationResource exactly; a malformed 2xx
 * body is rejected rather than silently rendered as "empty", so a backend/proxy
 * fault surfaces as an error state instead of a fake empty inbox.
 */

export type NotificationCategory = 'action_required' | 'reminder' | 'update' | 'system';
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface NotificationAction {
    route_key: string;
    label: string;
}

export interface AppNotification {
    id: string;
    event_type: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    title: string;
    body: string;
    subject_type: string | null;
    subject_id: string | null;
    action: NotificationAction | null;
    is_read: boolean;
    is_resolved: boolean;
    occurred_at: string | null;
    read_at: string | null;
    resolved_at: string | null;
    expires_at: string | null;
    schema_version: number;
}

export interface NotificationPage {
    items: AppNotification[];
    unreadCount: number;
    currentPage: number;
    lastPage: number;
    total: number;
}

export interface NotificationListFilters {
    unread?: boolean;
    unresolved?: boolean;
    category?: NotificationCategory;
    page?: number;
    perPage?: number;
}

export class NotificationApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'NotificationApiError';
        this.status = status;
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = async (response: Response, fallback: string): Promise<Record<string, unknown>> => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = isRecord(payload) && typeof payload.message === 'string'
            ? payload.message
            : fallback;
        throw new NotificationApiError(message, response.status);
    }
    return isRecord(payload) ? payload : {};
};

/** Minimal runtime guard: reject a row that lacks the fields the UI dereferences. */
const isNotification = (value: unknown): value is AppNotification => isRecord(value)
    && typeof value.id === 'string'
    && typeof value.category === 'string'
    && typeof value.priority === 'string'
    && typeof value.title === 'string'
    && typeof value.body === 'string'
    && typeof value.is_read === 'boolean'
    && typeof value.is_resolved === 'boolean';

export async function fetchNotifications(
    filters: NotificationListFilters = {},
): Promise<NotificationPage> {
    const params = new URLSearchParams();
    if (filters.unread) params.set('unread', '1');
    if (filters.unresolved) params.set('unresolved', '1');
    if (filters.category) params.set('category', filters.category);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.perPage) params.set('per_page', String(filters.perPage));

    const query = params.toString();
    const response = await apiFetch(`/api/notifications${query ? `?${query}` : ''}`);
    const payload = await readJson(response, 'Gagal memuat notifikasi.');

    const data = payload.data;
    if (!Array.isArray(data) || !data.every(isNotification)) {
        throw new NotificationApiError('Data notifikasi tidak valid.', response.status);
    }
    const meta = isRecord(payload.meta) ? payload.meta : {};

    return {
        items: data,
        unreadCount: typeof meta.unread_count === 'number' ? meta.unread_count : 0,
        currentPage: typeof meta.current_page === 'number' ? meta.current_page : 1,
        lastPage: typeof meta.last_page === 'number' ? meta.last_page : 1,
        total: typeof meta.total === 'number' ? meta.total : data.length,
    };
}

export async function fetchUnreadCount(): Promise<number> {
    const response = await apiFetch('/api/notifications/unread-count');
    const payload = await readJson(response, 'Gagal memuat jumlah notifikasi.');
    const data = isRecord(payload.data) ? payload.data : {};
    return typeof data.unread === 'number' ? data.unread : 0;
}

export async function markNotificationRead(id: string): Promise<void> {
    const response = await apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
    });
    if (!response.ok) {
        await readJson(response, 'Gagal menandai notifikasi.');
    }
}

export async function markAllNotificationsRead(): Promise<number> {
    const response = await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    const payload = await readJson(response, 'Gagal menandai semua notifikasi.');
    const data = isRecord(payload.data) ? payload.data : {};
    return typeof data.marked_read === 'number' ? data.marked_read : 0;
}

// ── presentation helpers (shared by the inbox and any future widget) ────────

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
    action_required: 'Perlu Tindakan',
    reminder: 'Pengingat',
    update: 'Pembaruan',
    system: 'Sistem',
};

export const notificationCategoryLabel = (category: string): string =>
    CATEGORY_LABELS[category as NotificationCategory] ?? 'Notifikasi';

/** Tailwind chip classes per category — gives urgency a visual hierarchy. */
export const notificationCategoryTone = (category: string): string => {
    switch (category) {
        case 'action_required': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'reminder': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'update': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'system': return 'bg-red-50 text-red-700 border-red-200';
        default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
};

/** Left accent per priority — urgent/high read as heavier without new colours. */
export const notificationPriorityAccent = (priority: string): string => {
    switch (priority) {
        case 'urgent': return 'border-l-4 border-l-red-500';
        case 'high': return 'border-l-4 border-l-amber-500';
        case 'normal': return 'border-l-4 border-l-transparent';
        default: return 'border-l-4 border-l-transparent';
    }
};

export const formatNotificationTime = (iso: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
