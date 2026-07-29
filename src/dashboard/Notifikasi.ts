import { renderDashboardLayout } from './DashboardLayout';
import { segmentedTabClass } from '../shared/design-system';
import Toastify from 'toastify-js';
import {
    fetchNotifications,
    formatNotificationTime,
    markAllNotificationsRead,
    markNotificationRead,
    notificationCategoryLabel,
    notificationCategoryTone,
    notificationPriorityAccent,
    type AppNotification,
    type NotificationCategory,
    type NotificationListFilters,
} from '../shared/notifications-api';
import { navigateForNotification } from '../shared/notification-routes';

/**
 * The unified in-app notification inbox — the single frontend surface for the
 * C7N1 durable backbone. Replaces the former hardcoded empty placeholder: it
 * reads real notifications from `/api/notifications`, marks them read on open,
 * supports "mark all read", filters unread, differentiates category/priority
 * visually, filters by category for triage, and deep-links to the relevant page
 * where a safe route exists. A dashboard widget can open it pre-scoped to one
 * category (e.g. "see all reminders") via `renderNotifikasi(role, { category })`.
 */

/** Options for opening the inbox pre-filtered (e.g. from a dashboard widget). */
export interface NotifikasiOptions {
    category?: NotificationCategory;
}

type CategoryFilter = 'all' | NotificationCategory;

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'Semua kategori' },
    { key: 'action_required', label: 'Perlu Tindakan' },
    { key: 'reminder', label: 'Pengingat' },
    { key: 'update', label: 'Pembaruan' },
    { key: 'system', label: 'Sistem' },
];

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

type Tab = 'semua' | 'belum_dibaca';
type ViewState = 'loading' | 'error' | 'ready';

// Module-scoped render token: a stale in-flight fetch must never overwrite the
// surface after the user has navigated to a different tab or page.
let renderSequence = 0;

export const renderNotifikasi = (role: string, options: NotifikasiOptions = {}): void => {
    let activeTab: Tab = 'semua';
    let activeCategory: CategoryFilter = options.category ?? 'all';
    let state: ViewState = 'loading';
    let items: AppNotification[] = [];
    let unreadCount = 0;
    let errorMessage = '';
    // Set only by keyboard tab activation: after the reload re-renders the tab
    // strip (which replaces the focused button), focus is returned to the newly
    // active tab. Mouse activation leaves this false, so focus is never stolen.
    let restoreTabFocus = false;

    const shell = (): string => `
        <div class="mx-auto w-full max-w-4xl py-6 animate-fade-in">
            <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800">Notifikasi</h2>
                    <p class="mt-1 text-sm text-gray-500">Pemberitahuan dan tindakan yang memerlukan perhatian Anda.</p>
                </div>
                <button id="notif-mark-all" type="button"
                    class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                    Tandai semua dibaca
                </button>
            </div>
            <div id="notif-tabs" class="mb-3">${renderTabs()}</div>
            <div id="notif-cats" class="mb-5">${renderCategoryFilter()}</div>
            <!-- Concise polite announcer: a single summary line, so screen readers
                 hear "Menampilkan N notifikasi" — never the whole list re-read on
                 every re-render (the list itself is NOT a live region). -->
            <p id="notif-status" role="status" aria-live="polite" class="sr-only"></p>
            <div id="notif-list" role="tabpanel" tabindex="0" aria-labelledby="notif-tab-${activeTab}"
                aria-busy="${state === 'loading'}" class="outline-none">
                ${renderBody()}
            </div>
        </div>
    `;

    function renderTabs(): string {
        const tab = (key: Tab, label: string, count?: number): string => {
            const active = activeTab === key;
            const cls = `${segmentedTabClass(active)} focus-visible:ring-2 focus-visible:ring-teal-200`;
            // Full ARIA tab pattern: the tab controls the single panel, and
            // roving tabindex (only the active tab is in the tab sequence) hands
            // arrow-key navigation between tabs to bindTabListeners.
            return `<button id="notif-tab-${key}" type="button" role="tab" aria-selected="${active}" aria-controls="notif-list" tabindex="${active ? '0' : '-1'}" class="${cls}">${label}${
                typeof count === 'number' && count > 0 ? ` <span class="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">${count}</span>` : ''
            }</button>`;
        };
        return `
            <div role="tablist" class="inline-flex overflow-hidden rounded-xl border border-gray-200">
                ${tab('semua', 'Semua')}${tab('belum_dibaca', 'Belum Dibaca', unreadCount)}
            </div>
        `;
    }

    // Category triage: a toggle-pill group (aria-pressed) letting the user narrow
    // the feed to one category — the same filter a dashboard widget's "see all"
    // opens the inbox with. Independent of the read-state tabs above.
    function renderCategoryFilter(): string {
        const pill = ({ key, label }: { key: CategoryFilter; label: string }): string => {
            const active = activeCategory === key;
            const cls = active
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50';
            return `<button id="notif-cat-${key}" type="button" aria-pressed="${active}" class="rounded-full border px-3 py-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-200 ${cls}">${label}</button>`;
        };
        return `<div role="group" aria-label="Saring menurut kategori" class="flex flex-wrap gap-2">${CATEGORY_FILTERS.map(pill).join('')}</div>`;
    }

    function renderBody(): string {
        if (state === 'loading') {
            return `<div class="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center text-sm font-semibold text-gray-500 shadow-sm">Memuat notifikasi...</div>`;
        }
        if (state === 'error') {
            return `
                <div role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-12 text-center shadow-sm">
                    <p class="text-sm font-bold text-red-700">Notifikasi gagal dimuat</p>
                    <p class="mt-1 text-sm text-red-600">${escapeHtml(errorMessage)}</p>
                    <button id="notif-retry" type="button" class="mt-5 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Coba Lagi</button>
                </div>
            `;
        }
        if (items.length === 0) {
            const message = activeTab === 'belum_dibaca'
                ? 'Tidak ada notifikasi yang belum dibaca.'
                : activeCategory !== 'all'
                    ? `Tidak ada notifikasi kategori "${notificationCategoryLabel(activeCategory)}".`
                    : 'Belum ada notifikasi.';
            return `
                <div class="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
                    <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-gray-400" aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800">${message}</h3>
                    <p class="mt-1 max-w-md text-sm text-gray-500">Notifikasi tindakan, pengingat, dan pembaruan akan tampil di sini.</p>
                </div>
            `;
        }
        return `<ul role="list" class="space-y-3">${items.map(renderItem).join('')}</ul>`;
    }

    function renderItem(item: AppNotification): string {
        const unread = !item.is_read;
        // A precise accessible name so a screen-reader user hears status +
        // category + title + the follow-up action, without visually scanning chips.
        const ariaLabel = `${unread ? 'Belum dibaca. ' : ''}${notificationCategoryLabel(item.category)}. ${item.title}.${item.action ? ` ${item.action.label}.` : ''}`;
        return `
            <li>
                <button type="button" data-notif-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(ariaLabel)}"
                    class="block w-full rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-colors hover:border-teal-200 hover:bg-teal-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 ${notificationPriorityAccent(item.priority)}">
                    <div class="flex items-start gap-3">
                        <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-teal-600' : 'bg-transparent'}" aria-hidden="true"></span>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${notificationCategoryTone(item.category)}">${escapeHtml(notificationCategoryLabel(item.category))}</span>
                                ${unread ? '<span class="text-[10px] font-bold uppercase tracking-wide text-teal-700">Belum dibaca</span>' : ''}
                            </div>
                            <h3 class="mt-1.5 break-words text-sm font-bold text-gray-900">${escapeHtml(item.title)}</h3>
                            <p class="mt-1 break-words text-sm text-gray-600">${escapeHtml(item.body)}</p>
                            <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span class="text-[11px] font-semibold text-gray-400">${escapeHtml(formatNotificationTime(item.occurred_at))}</span>
                                ${item.action ? `<span class="text-[11px] font-bold text-teal-700">${escapeHtml(item.action.label)} →</span>` : ''}
                            </div>
                        </div>
                    </div>
                </button>
            </li>
        `;
    }

    // ── data + interaction ──────────────────────────────────────────────

    const load = async (): Promise<void> => {
        const sequence = ++renderSequence;
        state = 'loading';
        rerenderBody();
        try {
            const filters: NotificationListFilters = {};
            if (activeTab === 'belum_dibaca') filters.unread = true;
            if (activeCategory !== 'all') filters.category = activeCategory;
            const page = await fetchNotifications(filters);
            if (sequence !== renderSequence) return;
            items = page.items;
            unreadCount = page.unreadCount;
            state = 'ready';
        } catch (error) {
            if (sequence !== renderSequence) return;
            state = 'error';
            errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan.';
        }
        rerender();
    };

    const rerenderBody = (): void => {
        const list = document.getElementById('notif-list');
        if (list) {
            list.setAttribute('aria-busy', String(state === 'loading'));
            // The panel is labelled by whichever tab is active.
            list.setAttribute('aria-labelledby', `notif-tab-${activeTab}`);
            list.innerHTML = renderBody();
            bindBodyListeners();
        }
        announce();
    };

    // One concise line for the polite live region — a summary of the current
    // state, never the list contents (which the panel already exposes visually
    // and via list semantics).
    const announce = (): void => {
        const status = document.getElementById('notif-status');
        if (!status) return;
        if (state === 'loading') {
            status.textContent = 'Memuat notifikasi.';
        } else if (state === 'error') {
            status.textContent = 'Notifikasi gagal dimuat.';
        } else {
            const scope = activeCategory !== 'all'
                ? ` kategori ${notificationCategoryLabel(activeCategory)}`
                : '';
            if (items.length === 0) {
                status.textContent = activeTab === 'belum_dibaca'
                    ? `Tidak ada notifikasi${scope} yang belum dibaca.`
                    : `Tidak ada notifikasi${scope}.`;
            } else if (activeTab === 'belum_dibaca') {
                status.textContent = `Menampilkan ${items.length} notifikasi${scope} belum dibaca.`;
            } else {
                status.textContent = `Menampilkan ${items.length} notifikasi${scope}, ${unreadCount} belum dibaca.`;
            }
        }
    };

    const rerender = (): void => {
        const tabs = document.getElementById('notif-tabs');
        if (tabs) tabs.innerHTML = renderTabs();
        const cats = document.getElementById('notif-cats');
        if (cats) cats.innerHTML = renderCategoryFilter();
        rerenderBody();
        bindTabListeners();
        bindCategoryListeners();
        syncMarkAll();
        if (restoreTabFocus) {
            restoreTabFocus = false;
            document.getElementById(`notif-tab-${activeTab}`)?.focus();
        }
    };

    const syncMarkAll = (): void => {
        const btn = document.getElementById('notif-mark-all') as HTMLButtonElement | null;
        if (btn) btn.disabled = unreadCount === 0;
    };

    const selectTab = (key: Tab): void => {
        if (activeTab === key) return;
        activeTab = key;
        void load();
    };

    const selectCategory = (key: CategoryFilter): void => {
        if (activeCategory === key) return;
        activeCategory = key;
        void load();
    };

    const bindCategoryListeners = (): void => {
        CATEGORY_FILTERS.forEach(({ key }) => {
            document.getElementById(`notif-cat-${key}`)?.addEventListener('click', () => selectCategory(key));
        });
    };

    const bindTabListeners = (): void => {
        const order: Tab[] = ['semua', 'belum_dibaca'];
        order.forEach((key, index) => {
            const el = document.getElementById(`notif-tab-${key}`);
            if (!el) return;
            el.addEventListener('click', () => selectTab(key));
            // WAI-ARIA tab keyboard model: arrow/Home/End move between tabs and
            // activate on move; focus is restored to the new tab after reload.
            el.addEventListener('keydown', (event: KeyboardEvent) => {
                let target: Tab | null = null;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    target = order[(index + 1) % order.length];
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    target = order[(index - 1 + order.length) % order.length];
                } else if (event.key === 'Home') {
                    target = order[0];
                } else if (event.key === 'End') {
                    target = order[order.length - 1];
                }
                if (!target || target === activeTab) return;
                event.preventDefault();
                restoreTabFocus = true;
                selectTab(target);
            });
        });
    };

    const bindBodyListeners = (): void => {
        document.getElementById('notif-retry')?.addEventListener('click', () => void load());
        document.querySelectorAll<HTMLElement>('[data-notif-id]').forEach((el) => {
            el.addEventListener('click', () => {
                const id = el.dataset.notifId;
                const item = items.find((n) => n.id === id);
                if (item) void openNotification(item);
            });
        });
    };

    const openNotification = async (item: AppNotification): Promise<void> => {
        // Mark read optimistically (real backend action) so the badge + list
        // reflect the open immediately; a failed PATCH is non-fatal.
        if (!item.is_read) {
            item.is_read = true;
            unreadCount = Math.max(0, unreadCount - 1);
            if (activeTab === 'belum_dibaca') {
                items = items.filter((n) => n.id !== item.id);
            }
            rerender();
            void markNotificationRead(item.id).catch(() => undefined);
        }
        // Deep-link to the correct workbench for the item's route key.
        await navigateForNotification(item.action?.route_key ?? null, item.subject_id, role);
    };

    const markAll = async (): Promise<void> => {
        const btn = document.getElementById('notif-mark-all') as HTMLButtonElement | null;
        if (btn) btn.disabled = true;
        try {
            await markAllNotificationsRead();
            Toastify({ text: 'Semua notifikasi ditandai dibaca.', duration: 2000, gravity: 'top', position: 'right', style: { background: '#0f766e' } }).showToast();
            await load();
        } catch {
            if (btn) btn.disabled = false;
            Toastify({ text: 'Gagal menandai semua notifikasi.', duration: 2500, gravity: 'top', position: 'right', style: { background: '#b91c1c' } }).showToast();
        }
    };

    renderDashboardLayout('Notifikasi', shell(), role, 'dashboard');
    document.getElementById('notif-mark-all')?.addEventListener('click', () => void markAll());
    bindTabListeners();
    bindCategoryListeners();
    void load();
};
