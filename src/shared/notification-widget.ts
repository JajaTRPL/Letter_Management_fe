import {
    fetchNotifications,
    formatNotificationTime,
    markNotificationRead,
    notificationCategoryLabel,
    notificationPriorityAccent,
    type AppNotification,
    type NotificationCategory,
} from './notifications-api';
import { navigateForNotification } from './notification-routes';

/**
 * A compact, category-scoped notification panel embedded on a role dashboard —
 * so time-sensitive work is NOT trapped behind the bell. It reads the ONE C7N1
 * backbone through the shared client (never a second source), shows only
 * UNRESOLVED items of a single category, deep-links each item to the surface
 * where the user acts, and hands "see all" to the full inbox pre-filtered to the
 * same category.
 *
 * Fully failure-isolated: a notification fault renders an in-widget error and
 * NEVER blocks or breaks the host dashboard. Honest loading/error/empty states,
 * accessible list semantics, a polite live region, and keyboard/focus support.
 */

export interface NotificationWidgetConfig {
    /** Id of the <section> this widget owns; the host embeds `widgetShell(config)`. */
    mountId: string;
    /** The single category this panel surfaces (reminder | system | …). */
    category: NotificationCategory;
    /** Current role — used for deep-link navigation. */
    role: string;
    title: string;
    subtitle: string;
    /** Empty-state copy (honest, category-specific). */
    emptyTitle: string;
    emptyBody: string;
    /** Max items shown inline (default 4). */
    limit?: number;
    /** Accent flavour: 'alert' (health) leans red, 'calm' (reminders) leans blue. */
    accent?: 'alert' | 'calm';
}

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

type WidgetState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; items: AppNotification[]; total: number };

const limitOf = (config: NotificationWidgetConfig): number => config.limit ?? 4;

/**
 * Initial HTML the host dashboard embeds inline (a loading card), so there is no
 * layout jump before hydration. The <section> owns the mount id.
 */
export function notificationWidgetShell(config: NotificationWidgetConfig): string {
    return `<section id="${config.mountId}" aria-labelledby="${config.mountId}-title">${
        cardMarkup(config, { phase: 'loading' })
    }</section>`;
}

/**
 * Fetch this category's unresolved notifications and render them into the mount.
 * Best-effort: any failure shows an in-widget error, never throwing to the host.
 * Safe to call repeatedly (e.g. on each dashboard refresh) — it re-reads and
 * re-binds idempotently.
 */
export async function hydrateNotificationWidget(config: NotificationWidgetConfig): Promise<void> {
    const paint = (state: WidgetState): void => {
        const mount = document.getElementById(config.mountId);
        if (!mount) return;
        mount.innerHTML = cardMarkup(config, state);
        bind(config, state);
        announce(config, state);
    };

    paint({ phase: 'loading' });
    try {
        const page = await fetchNotifications({
            category: config.category,
            unresolved: true,
            perPage: limitOf(config),
        });
        paint({ phase: 'ready', items: page.items, total: page.total });
    } catch (error) {
        paint({ phase: 'error', message: error instanceof Error ? error.message : 'Terjadi kesalahan.' });
    }
}

// ── rendering ───────────────────────────────────────────────────────────────

function cardMarkup(config: NotificationWidgetConfig, state: WidgetState): string {
    const accentBar = config.accent === 'alert' ? 'bg-red-500' : 'bg-blue-500';
    const countBadge = state.phase === 'ready' && state.total > 0
        ? `<span class="ml-2 inline-flex items-center rounded-full ${config.accent === 'alert' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 text-[11px] font-bold">${state.total}</span>`
        : '';
    return `
        <div class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div class="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
                <span class="mt-1 h-8 w-1.5 shrink-0 rounded-full ${accentBar}" aria-hidden="true"></span>
                <div class="min-w-0 flex-1">
                    <h3 id="${config.mountId}-title" class="flex items-center text-[15px] font-bold text-gray-800">${escapeHtml(config.title)}${countBadge}</h3>
                    <p class="mt-0.5 text-xs text-gray-500">${escapeHtml(config.subtitle)}</p>
                </div>
                ${state.phase === 'ready' && state.total > limitOf(config)
                    ? `<button id="${config.mountId}-all" type="button" class="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200">Lihat semua</button>`
                    : ''}
            </div>
            <p id="${config.mountId}-status" role="status" aria-live="polite" class="sr-only"></p>
            <div id="${config.mountId}-body" aria-busy="${state.phase === 'loading'}">${bodyMarkup(config, state)}</div>
        </div>
    `;
}

function bodyMarkup(config: NotificationWidgetConfig, state: WidgetState): string {
    if (state.phase === 'loading') {
        return `<div class="px-5 py-10 text-center text-sm font-semibold text-gray-400">Memuat…</div>`;
    }
    if (state.phase === 'error') {
        return `
            <div role="alert" class="px-5 py-8 text-center">
                <p class="text-sm font-bold text-red-700">Gagal memuat</p>
                <p class="mt-1 text-xs text-red-600">${escapeHtml(state.message)}</p>
                <button id="${config.mountId}-retry" type="button" class="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200">Coba Lagi</button>
            </div>
        `;
    }
    if (state.items.length === 0) {
        const icon = config.accent === 'alert'
            ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
            : '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>';
        return `
            <div class="flex flex-col items-center justify-center px-5 py-10 text-center">
                <span class="mb-3 flex h-11 w-11 items-center justify-center rounded-full ${config.accent === 'alert' ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-50 text-gray-400'}" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
                </span>
                <h4 class="text-sm font-bold text-gray-800">${escapeHtml(config.emptyTitle)}</h4>
                <p class="mt-1 max-w-xs text-xs text-gray-500">${escapeHtml(config.emptyBody)}</p>
            </div>
        `;
    }
    const rows = state.items.slice(0, limitOf(config)).map(itemMarkup).join('');
    return `<ul role="list" class="divide-y divide-gray-50">${rows}</ul>`;
}

function itemMarkup(item: AppNotification): string {
    const label = `${notificationCategoryLabel(item.category)}. ${item.title}.${item.action ? ` ${item.action.label}.` : ''}`;
    return `
        <li>
            <button type="button" data-widget-notif="${escapeHtml(item.id)}" aria-label="${escapeHtml(label)}"
                class="block w-full px-5 py-3.5 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-200 ${notificationPriorityAccent(item.priority)}">
                <p class="break-words text-sm font-semibold text-gray-900">${escapeHtml(item.title)}</p>
                <p class="mt-0.5 break-words text-xs text-gray-600">${escapeHtml(item.body)}</p>
                <div class="mt-1.5 flex items-center justify-between gap-2">
                    <span class="text-[11px] font-semibold text-gray-400">${escapeHtml(formatNotificationTime(item.occurred_at))}</span>
                    ${item.action ? `<span class="text-[11px] font-bold text-teal-700">${escapeHtml(item.action.label)} →</span>` : ''}
                </div>
            </button>
        </li>
    `;
}

// ── behaviour ─────────────────────────────────────────────────────────────

function bind(config: NotificationWidgetConfig, state: WidgetState): void {
    if (state.phase === 'error') {
        document.getElementById(`${config.mountId}-retry`)
            ?.addEventListener('click', () => void hydrateNotificationWidget(config));
        return;
    }
    if (state.phase !== 'ready') return;

    document.getElementById(`${config.mountId}-all`)?.addEventListener('click', () => {
        void import('../dashboard/Notifikasi').then(({ renderNotifikasi }) => {
            renderNotifikasi(config.role, { category: config.category });
        });
    });

    document.querySelectorAll<HTMLElement>(`#${config.mountId} [data-widget-notif]`).forEach((el) => {
        el.addEventListener('click', () => {
            const id = el.dataset.widgetNotif;
            const item = state.items.find((n) => n.id === id);
            if (!item) return;
            // Mark read (best-effort) then deep-link to where the user acts.
            if (!item.is_read) void markNotificationRead(item.id).catch(() => undefined);
            void navigateForNotification(item.action?.route_key ?? null, item.subject_id, config.role);
        });
    });
}

function announce(config: NotificationWidgetConfig, state: WidgetState): void {
    const status = document.getElementById(`${config.mountId}-status`);
    if (!status) return;
    if (state.phase === 'loading') {
        status.textContent = '';
    } else if (state.phase === 'error') {
        status.textContent = `${config.title}: gagal memuat.`;
    } else if (state.items.length === 0) {
        status.textContent = `${config.title}: ${config.emptyTitle}`;
    } else {
        status.textContent = `${config.title}: ${state.total} item.`;
    }
}
