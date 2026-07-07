import { PeminjamanApiError } from '../../mahasiswa/peminjaman/api';
import { getFacilityUsage } from './api';
import { escapeHtml, facilityConditionLabel, facilityConditionTone } from './utils';
import type { FacilityTypeOption, FacilityUsage, FacilityUsageRoom } from './types';

/**
 * Master Fasilitas "Lihat Penggunaan" drawer (SuperAdmin): a right-side
 * slide-over — consistent with the Kelola Ruangan drawer — that lists exactly
 * which rooms use a facility type, with counts by room type, so an admin can
 * see the impact before archiving or deleting it. Contextual footer actions
 * (Arsipkan when used / Hapus when unused) delegate back to the caller's
 * existing confirmation flow.
 */

const ROOT_ID = 'facility-usage-drawer-root';

export interface UsageDrawerOptions {
    onArchive?: () => void;
    onDelete?: () => void;
    // Jump straight to a room's Kelola Ruangan drawer. When provided, each room
    // row shows a "Kelola Ruangan" CTA; the drawer closes before it runs.
    onOpenRoom?: (roomId: number) => void;
}

const ICON_ARROW = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';

interface DrawerState {
    type: FacilityTypeOption;
    options: UsageDrawerOptions;
    usage: FacilityUsage | null;
    loading: boolean;
    error: string | null;
    search: string;
    escapeHandler: ((event: KeyboardEvent) => void) | null;
}

let state: DrawerState | null = null;

const ROOM_TYPE_LABELS: Record<string, string> = {
    classroom: 'Ruang Kelas',
    laboratory: 'Laboratorium',
};

const roomTypeLabel = (type: string): string => ROOM_TYPE_LABELS[type] ?? 'Lainnya';

const apiMessage = (error: unknown, fallback: string): string => {
    if (error instanceof PeminjamanApiError) return error.message || fallback;
    return error instanceof Error ? error.message : fallback;
};

export const closeFacilityUsageDrawer = (): void => {
    if (state?.escapeHandler) document.removeEventListener('keydown', state.escapeHandler);
    document.getElementById(ROOT_ID)?.remove();
    state = null;
};

export const openFacilityUsageDrawer = async (
    type: FacilityTypeOption,
    options: UsageDrawerOptions = {},
): Promise<void> => {
    closeFacilityUsageDrawer();
    state = { type, options, usage: null, loading: true, error: null, search: '', escapeHandler: null };

    const active = type.is_active !== false;
    const root = document.createElement('div');
    root.id = ROOT_ID;
    document.body.appendChild(root);

    root.innerHTML = `
        <div data-facility-usage-overlay class="fixed inset-0 z-[210] bg-black/40"></div>
        <aside role="dialog" aria-modal="true" aria-labelledby="facility-usage-title" class="fixed inset-y-0 right-0 z-[211] flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
            <header class="border-b border-gray-100 px-6 py-5">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Penggunaan Fasilitas</p>
                        <h2 id="facility-usage-title" class="mt-1 break-words text-xl font-bold text-gray-900">${escapeHtml(type.name)}</h2>
                        <div class="mt-2 flex flex-wrap items-center gap-2">
                            <span class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-500'}">${active ? 'Aktif' : 'Nonaktif'}</span>
                            <span class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${type.is_predefined ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-teal-100 bg-teal-50 text-teal-700'}">${type.is_predefined ? 'Bawaan' : 'Kustom'}</span>
                        </div>
                    </div>
                    <button id="facility-usage-close" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Tutup penggunaan fasilitas">×</button>
                </div>
            </header>
            <div id="facility-usage-body" class="flex-1 overflow-y-auto px-6 py-5" aria-live="polite"></div>
            <footer id="facility-usage-footer" class="flex flex-col-reverse gap-2 border-t border-gray-100 px-6 py-4 sm:flex-row sm:justify-end"></footer>
        </aside>
    `;

    const escapeHandler = (event: KeyboardEvent): void => {
        // Let a confirm modal opened on top of the drawer own Escape first.
        if (event.key === 'Escape' && !document.getElementById('facility-confirm-root')) {
            closeFacilityUsageDrawer();
        }
    };
    state.escapeHandler = escapeHandler;
    document.addEventListener('keydown', escapeHandler);
    root.querySelector('[data-facility-usage-overlay]')?.addEventListener('click', closeFacilityUsageDrawer);
    root.querySelector('#facility-usage-close')?.addEventListener('click', closeFacilityUsageDrawer);
    root.querySelector<HTMLButtonElement>('#facility-usage-close')?.focus();

    renderBody();
    renderFooter();
    await load();
};

const load = async (): Promise<void> => {
    if (!state) return;
    const local = state;
    state.loading = true;
    state.error = null;
    renderBody();
    try {
        const usage = await getFacilityUsage(state.type.id);
        if (state !== local) return;
        state.usage = usage;
        state.error = null;
    } catch (error) {
        if (state !== local) return;
        state.usage = null;
        state.error = apiMessage(error, 'Penggunaan fasilitas gagal dimuat.');
    } finally {
        if (state === local) {
            state.loading = false;
            renderBody();
            renderFooter();
        }
    }
};

const bodyEl = (): HTMLElement | null => document.getElementById('facility-usage-body');

const visibleRooms = (): FacilityUsageRoom[] => {
    if (!state?.usage) return [];
    const query = state.search.trim().toLowerCase();
    if (!query) return state.usage.rooms;
    return state.usage.rooms.filter((room) =>
        room.code.toLowerCase().includes(query)
        || room.name.toLowerCase().includes(query)
        || (room.owning_laboratory?.code ?? '').toLowerCase().includes(query)
        || (room.owning_laboratory?.name ?? '').toLowerCase().includes(query));
};

const renderBody = (): void => {
    const body = bodyEl();
    if (!body || !state) return;

    if (state.loading) {
        body.innerHTML = `
            <div data-facility-usage-state="loading" class="py-16 text-center">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat penggunaan fasilitas...</p>
            </div>
        `;
        return;
    }

    if (state.error) {
        body.innerHTML = `
            <div data-facility-usage-state="error" class="py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Penggunaan fasilitas gagal dimuat</h3>
                <p class="mt-2 text-sm text-gray-500">${escapeHtml(state.error)}</p>
                <button id="facility-usage-retry" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">Coba Lagi</button>
            </div>
        `;
        body.querySelector('#facility-usage-retry')?.addEventListener('click', () => void load());
        return;
    }

    const usage = state.usage;
    if (!usage || usage.summary.total === 0) {
        body.innerHTML = `
            <div data-facility-usage-state="empty" class="py-16 text-center">
                <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M9 21V9"></path></svg>
                </div>
                <h3 class="mt-4 text-base font-bold text-gray-800">Belum digunakan</h3>
                <p class="mt-2 text-sm text-gray-500">Fasilitas ini belum digunakan di ruangan mana pun.</p>
            </div>
        `;
        return;
    }

    const showSearch = usage.rooms.length > 6;
    body.innerHTML = `
        <div data-facility-usage-state="success" class="space-y-5">
            ${renderSummaryCards(usage)}
            ${showSearch ? `
                <input id="facility-usage-search" type="search" maxlength="100" value="${escapeHtml(state.search)}" placeholder="Cari kode / nama ruangan..." class="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
            ` : ''}
            <div class="space-y-2">${renderRoomList()}</div>
        </div>
    `;

    wireRoomActions();

    const search = body.querySelector('#facility-usage-search') as HTMLInputElement | null;
    search?.addEventListener('input', () => {
        if (!state) return;
        state.search = search.value;
        const list = body.querySelector('.space-y-2');
        if (list) list.innerHTML = renderRoomList();
        wireRoomActions();
    });
};

const renderSummaryCards = (usage: FacilityUsage): string => {
    const card = (label: string, value: number, tone: string): string => `
        <div class="rounded-xl border ${tone} px-3 py-3 text-center">
            <p class="text-2xl font-bold leading-none">${value}</p>
            <p class="mt-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">${label}</p>
        </div>
    `;
    const cards = [
        card('Total Ruangan', usage.summary.total, 'border-teal-100 bg-teal-50 text-teal-700'),
        card('Ruang Kelas', usage.summary.classroom, 'border-gray-100 bg-gray-50 text-gray-700'),
        card('Laboratorium', usage.summary.laboratory, 'border-gray-100 bg-gray-50 text-gray-700'),
    ];
    if (usage.summary.other > 0) {
        cards.push(card('Lainnya', usage.summary.other, 'border-amber-100 bg-amber-50 text-amber-700'));
    }
    return `<div class="grid grid-cols-3 gap-3 ${usage.summary.other > 0 ? 'sm:grid-cols-4' : ''}">${cards.join('')}</div>`;
};

const renderRoomList = (): string => {
    const rooms = visibleRooms();
    if (rooms.length === 0) {
        return '<p class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Tidak ada ruangan yang cocok dengan pencarian.</p>';
    }
    return rooms.map(renderRoomRow).join('');
};

const renderRoomRow = (room: FacilityUsageRoom): string => {
    const active = room.is_active !== false;
    const conditionLabel = facilityConditionLabel(room.condition);
    const lab = room.owning_laboratory;
    const canOpen = Boolean(state?.options.onOpenRoom);
    return `
        <div data-usage-room="${room.id}" class="rounded-xl border border-gray-100 p-3">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-gray-800">${escapeHtml(room.code)} · ${escapeHtml(room.name)}</p>
                    <p class="mt-0.5 text-xs text-gray-500">${escapeHtml(roomTypeLabel(room.type))}${lab ? ` · ${escapeHtml(lab.code)}` : ''}</p>
                </div>
                <span class="shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-500'}">${active ? 'Aktif' : 'Nonaktif'}</span>
            </div>
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                    <span class="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-semibold text-gray-600">Jumlah: ${room.quantity ?? '-'}</span>
                    ${conditionLabel ? `<span class="rounded-full border px-2 py-0.5 font-bold ${facilityConditionTone(room.condition)}">${escapeHtml(conditionLabel)}</span>` : ''}
                </div>
                ${canOpen ? `<button type="button" data-usage-open-room="${room.id}" class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-teal-700 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50">Kelola Ruangan${ICON_ARROW}</button>` : ''}
            </div>
        </div>
    `;
};

/** Wire the per-room "Kelola Ruangan" CTAs (re-run after each list render). */
const wireRoomActions = (): void => {
    const body = bodyEl();
    if (!body || !state) return;
    body.querySelectorAll<HTMLElement>('[data-usage-open-room]').forEach((button) => {
        button.addEventListener('click', () => {
            const roomId = Number(button.dataset.usageOpenRoom);
            const onOpenRoom = state?.options.onOpenRoom;
            closeFacilityUsageDrawer();
            onOpenRoom?.(roomId);
        });
    });
};

const renderFooter = (): void => {
    const footer = document.getElementById('facility-usage-footer');
    if (!footer || !state) return;

    const active = state.type.is_active !== false;
    const total = state.usage?.summary.total ?? state.type.usage_count ?? 0;

    let contextual = '';
    if (state.loading) {
        contextual = '';
    } else if (active && total > 0 && state.options.onArchive) {
        contextual = '<button id="facility-usage-archive" type="button" class="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-100">Arsipkan</button>';
    } else if (total === 0 && state.options.onDelete) {
        contextual = '<button id="facility-usage-delete" type="button" class="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100">Hapus</button>';
    }

    footer.innerHTML = `
        <button id="facility-usage-tutup" type="button" class="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Tutup</button>
        ${contextual}
    `;

    footer.querySelector('#facility-usage-tutup')?.addEventListener('click', closeFacilityUsageDrawer);
    footer.querySelector('#facility-usage-archive')?.addEventListener('click', () => {
        const onArchive = state?.options.onArchive;
        closeFacilityUsageDrawer();
        onArchive?.();
    });
    footer.querySelector('#facility-usage-delete')?.addEventListener('click', () => {
        const onDelete = state?.options.onDelete;
        closeFacilityUsageDrawer();
        onDelete?.();
    });
};
