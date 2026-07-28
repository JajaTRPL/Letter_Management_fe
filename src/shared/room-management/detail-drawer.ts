import Toastify from 'toastify-js';
import { PeminjamanApiError } from '../../mahasiswa/peminjaman/api';
import {
    activateManagedRoom,
    activateRoomTemplate,
    createFacilityType,
    deactivateManagedRoom,
    deactivateRoomTemplate,
    deleteRoomPhoto,
    downloadRoomTemplate,
    fetchRoomPhotoObjectUrl,
    getManagedRoom,
    getRoomFacilities,
    listFacilityTypes,
    listRoomAuditLogs,
    listRoomPhotos,
    listRoomTemplates,
    reorderRoomPhotos,
    setRoomCover,
    syncRoomFacilities,
    uploadRoomPhoto,
    uploadRoomTemplate,
} from './api';
import { openRoomFormModal } from './room-form';
import {
    auditEntryLabel,
    escapeHtml,
    facilityConditionLabel,
    facilityConditionTone,
    facilityDisplayList,
    formatAuditDateTime,
    formatFileSize,
    isFacilityCondition,
    orderedPhotos,
    orderedTemplates,
    templateFormatLabel,
} from './utils';
import { getRoomTypeLabel } from '../peminjaman-calendar';
import type {
    FacilitySyncEntry,
    FacilityDelegatedActivityAcknowledgementOutcome,
    FacilityTypeOption,
    ManagedLaboratory,
    ManagedRoomDetail,
    ManagedRoomFacility,
    ManagedRoomPhoto,
    ManagedRoomTemplate,
    RoomAuditEntry,
    RoomFacilityCondition,
} from './types';

const ROOT_ID = 'room-management-drawer-root';
const PHOTO_LIMIT = 8;

type Tab = 'info' | 'foto' | 'fasilitas' | 'template' | 'riwayat';

interface DrawerOptions {
    laboratories: ManagedLaboratory[];
    onRoomMutated?: () => void;
    // Tab to open on first render (defaults to 'info'). Used e.g. when jumping
    // in from the Master Fasilitas usage drawer, which lands on 'fasilitas'.
    initialTab?: Tab;
}

interface FacilityRow {
    facility_type_id: number | '';
    quantity: string;
    condition: RoomFacilityCondition | '';
    notes: string;
}

interface DrawerState {
    roomId: number;
    detail: ManagedRoomDetail | null;
    activeTab: Tab;
    loadError: string | null;
    options: DrawerOptions;
    objectUrls: Map<string, string>;
    escapeHandler: ((event: KeyboardEvent) => void) | null;
    // lazy tab caches
    photos: ManagedRoomPhoto[] | null;
    facilities: FacilityRow[] | null;
    // Snapshot of the last-persisted facility rows, for saved/unsaved markers
    // and dirty detection.
    savedFacilities: FacilityRow[] | null;
    facilityAcknowledgement: FacilityDelegatedActivityAcknowledgementOutcome | null;
    facilityTypes: FacilityTypeOption[];
    templates: ManagedRoomTemplate[] | null;
    audit: RoomAuditEntry[] | null;
    busy: boolean;
}

let state: DrawerState | null = null;

const showToast = (text: string, success: boolean): void => {
    Toastify({
        text,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: { background: success ? '#0f766e' : '#b91c1c' },
    }).showToast();
};

const apiMessage = (error: unknown, fallback: string): string => {
    if (error instanceof PeminjamanApiError) {
        const validation = Object.values(error.errors ?? {})[0]?.[0];
        if (validation) return validation;
        return error.message || fallback;
    }
    return error instanceof Error ? error.message : fallback;
};

export const closeRoomManagementDrawer = (): void => {
    if (state) {
        state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
        state.objectUrls.clear();
        if (state.escapeHandler) document.removeEventListener('keydown', state.escapeHandler);
    }
    document.getElementById(ROOT_ID)?.remove();
    state = null;
};

export const openRoomManagementDrawer = async (
    roomId: number,
    options: DrawerOptions,
): Promise<void> => {
    closeRoomManagementDrawer();
    state = {
        roomId,
        detail: null,
        activeTab: options.initialTab ?? 'info',
        loadError: null,
        options,
        objectUrls: new Map(),
        escapeHandler: null,
        photos: null,
        facilities: null,
        savedFacilities: null,
        facilityAcknowledgement: null,
        facilityTypes: [],
        templates: null,
        audit: null,
        busy: false,
    };

    const root = document.createElement('div');
    root.id = ROOT_ID;
    document.body.appendChild(root);

    root.innerHTML = `
        <div data-room-mgmt-overlay class="fixed inset-0 z-[200] bg-black/40"></div>
        <aside role="dialog" aria-modal="true" aria-labelledby="room-mgmt-title" class="fixed inset-y-0 right-0 z-[201] flex h-full w-full max-w-[600px] flex-col bg-white shadow-2xl">
            <header class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                <div class="min-w-0">
                    <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Kelola Ruangan</p>
                    <h2 id="room-mgmt-title" class="mt-1 break-words text-xl font-bold text-gray-900">Memuat ruangan...</h2>
                </div>
                <button id="close-room-mgmt" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Tutup kelola ruangan">×</button>
            </header>
            <nav id="room-mgmt-tabs" class="flex gap-1 overflow-x-auto border-b border-gray-100 px-4" role="tablist" aria-label="Bagian pengelolaan ruangan"></nav>
            <div id="room-mgmt-body" class="flex-1 overflow-y-auto px-6 py-5" aria-live="polite">
                <div class="py-16 text-center">
                    <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                    <p class="mt-4 text-sm font-bold text-gray-700">Memuat detail ruangan...</p>
                </div>
            </div>
        </aside>
    `;

    const escapeHandler = (event: KeyboardEvent): void => {
        if (
            event.key === 'Escape'
            && !document.getElementById('room-form-modal-root')
            && !document.getElementById('room-mgmt-confirm-root')
        ) {
            closeRoomManagementDrawer();
        }
    };
    state.escapeHandler = escapeHandler;
    document.addEventListener('keydown', escapeHandler);
    root.querySelector('[data-room-mgmt-overlay]')?.addEventListener('click', closeRoomManagementDrawer);
    root.querySelector('#close-room-mgmt')?.addEventListener('click', closeRoomManagementDrawer);
    root.querySelector<HTMLButtonElement>('#close-room-mgmt')?.focus();

    const local = state;
    try {
        const detail = await getManagedRoom(roomId);
        if (state !== local) return;
        state.detail = detail;
        renderTabs();
        renderActiveTab();
    } catch (error) {
        if (state !== local) return;
        state.loadError = apiMessage(error, 'Detail ruangan gagal dimuat.');
        renderLoadError();
    }
};

const renderLoadError = (): void => {
    const body = document.getElementById('room-mgmt-body');
    if (!body || !state) return;
    body.innerHTML = `
        <div class="py-16 text-center">
            <h3 class="text-base font-bold text-gray-800">Detail ruangan tidak tersedia</h3>
            <p class="mt-2 text-sm text-gray-500">${escapeHtml(state.loadError)}</p>
        </div>
    `;
};

const TAB_LABELS: Record<Tab, string> = {
    info: 'Info',
    foto: 'Foto',
    fasilitas: 'Fasilitas',
    template: 'Template',
    riwayat: 'Riwayat',
};

const renderTabs = (): void => {
    const nav = document.getElementById('room-mgmt-tabs');
    const title = document.getElementById('room-mgmt-title');
    if (!nav || !state?.detail) return;
    title!.textContent = `${state.detail.code} · ${state.detail.name}`;

    nav.innerHTML = (Object.keys(TAB_LABELS) as Tab[]).map((tab) => `
        <button type="button" role="tab" data-room-mgmt-tab="${tab}" aria-selected="${state?.activeTab === tab}" class="shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${state?.activeTab === tab ? 'border-teal-700 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}">${TAB_LABELS[tab]}</button>
    `).join('');

    nav.querySelectorAll<HTMLElement>('[data-room-mgmt-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            const tab = button.dataset.roomMgmtTab as Tab;
            if (!state || state.activeTab === tab) return;
            state.activeTab = tab;
            renderTabs();
            renderActiveTab();
        });
    });
};

const bodyEl = (): HTMLElement | null => document.getElementById('room-mgmt-body');

const renderLoading = (message: string): void => {
    const body = bodyEl();
    if (body) {
        body.innerHTML = `
            <div class="py-16 text-center">
                <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                <p class="mt-4 text-sm font-semibold text-gray-600">${escapeHtml(message)}</p>
            </div>
        `;
    }
};

const renderActiveTab = (): void => {
    if (!state) return;
    switch (state.activeTab) {
        case 'info': return renderInfoTab();
        case 'foto': return void renderPhotoTab();
        case 'fasilitas': return void renderFacilityTab();
        case 'template': return void renderTemplateTab();
        case 'riwayat': return void renderAuditTab();
    }
};

/**
 * Repaint the currently-open tab from already-loaded caches (no fetch). Used
 * by withBusy() to guarantee the tab re-renders AFTER state.busy is cleared,
 * so busy-labelled controls ("Mengunggah..."/"Menyimpan...") always reset.
 */
const repaintActiveTab = (): void => {
    if (!state) return;
    if (state.activeTab === 'foto' && state.photos !== null) paintPhotoTab();
    else if (state.activeTab === 'fasilitas' && state.facilities !== null) paintFacilityTab();
    else if (state.activeTab === 'template' && state.templates !== null) paintTemplateTab();
};

const notifyMutation = (): void => {
    state?.options.onRoomMutated?.();
};

/** Reload the room detail so Info + health badges stay accurate after edits. */
const reloadDetail = async (): Promise<void> => {
    if (!state) return;
    const local = state;
    try {
        const detail = await getManagedRoom(state.roomId);
        if (state !== local) return;
        state.detail = detail;
        renderTabs();
    } catch {
        // keep the last known detail on transient refresh failure
    }
};

// ─────────────────────────── Info tab ───────────────────────────

const renderInfoTab = (): void => {
    const body = bodyEl();
    if (!body || !state?.detail) return;
    const room = state.detail;
    const flags = room.management_flags;

    const rows: Array<[string, string]> = [
        ['Kode', room.code],
        ['Nama', room.name],
        ['Jenis', getRoomTypeLabel(room.type)],
        ['Lokasi', room.location],
        ['Kapasitas', `${room.capacity} orang`],
        ['Laboratorium Pemilik', room.owning_laboratory ? `${room.owning_laboratory.code} · ${room.owning_laboratory.name}` : '-'],
        ['Deskripsi', room.description ?? '-'],
        ['Tata Tertib', room.rules ?? '-'],
    ];

    body.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${room.is_active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-600'}">${room.is_active ? 'Aktif' : 'Nonaktif'}</span>
                <span class="text-xs font-bold text-gray-500">${escapeHtml(getRoomTypeLabel(room.type))}</span>
            </div>
            <dl class="divide-y divide-gray-100">
                ${rows.map(([label, value]) => `
                    <div class="grid grid-cols-[140px_1fr] gap-3 py-3">
                        <dt class="text-xs font-bold text-gray-500">${escapeHtml(label)}</dt>
                        <dd class="whitespace-pre-wrap break-words text-sm font-semibold text-gray-800">${escapeHtml(value)}</dd>
                    </div>
                `).join('')}
            </dl>
            ${flags.can_edit_info || flags.can_deactivate || flags.can_activate ? `
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    ${flags.can_edit_info ? '<button id="room-mgmt-edit" type="button" class="rounded-xl border border-teal-700 px-4 py-2.5 text-sm font-bold text-teal-700 hover:bg-teal-50">Edit Ruangan</button>' : ''}
                    ${room.is_active && flags.can_deactivate ? '<button id="room-mgmt-toggle" type="button" class="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100">Nonaktifkan</button>' : ''}
                    ${!room.is_active && flags.can_activate ? '<button id="room-mgmt-toggle" type="button" class="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Aktifkan</button>' : ''}
                </div>
            ` : '<p class="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-center text-xs text-gray-500">Anda memiliki akses baca untuk ruangan ini.</p>'}
        </div>
    `;

    body.querySelector('#room-mgmt-edit')?.addEventListener('click', () => {
        if (!state?.detail) return;
        openRoomFormModal({
            mode: 'edit',
            room: state.detail,
            laboratories: state.options.laboratories,
            allowedTypes: [state.detail.type],
            onSaved: async () => {
                showToast('Ruangan berhasil diperbarui.', true);
                notifyMutation();
                await reloadDetail();
                renderInfoTab();
            },
        });
    });
    body.querySelector('#room-mgmt-toggle')?.addEventListener('click', () => {
        if (state?.detail) openStatusConfirm(state.detail.is_active);
    });
};

const openStatusConfirm = (deactivating: boolean): void => {
    if (!state?.detail) return;
    const room = state.detail;
    const existing = document.getElementById('room-mgmt-confirm-root');
    existing?.remove();
    const root = document.createElement('div');
    root.id = 'room-mgmt-confirm-root';
    document.body.appendChild(root);
    let busy = false;
    let error: string | null = null;

    const render = (): void => {
        root.innerHTML = `
            <div data-confirm-overlay class="fixed inset-0 z-[210] bg-black/50"></div>
            <section role="dialog" aria-modal="true" aria-labelledby="room-mgmt-confirm-title" class="fixed left-1/2 top-1/2 z-[211] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
                <h2 id="room-mgmt-confirm-title" class="text-xl font-bold text-gray-900">${deactivating ? 'Nonaktifkan Ruangan' : 'Aktifkan Ruangan'}</h2>
                <p class="mt-3 text-sm text-gray-600">${deactivating
                    ? 'Ruangan nonaktif tidak dapat dipilih untuk pengajuan baru.'
                    : 'Ruangan aktif kembali tersedia untuk pengajuan baru.'}</p>
                <p class="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800">${escapeHtml(room.code)} · ${escapeHtml(room.name)}</p>
                ${error ? `<p role="alert" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${escapeHtml(error)}</p>` : ''}
                <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button id="room-mgmt-confirm-cancel" type="button" ${busy ? 'disabled' : ''} class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 disabled:opacity-50">Batal</button>
                    <button id="room-mgmt-confirm-ok" type="button" ${busy ? 'disabled' : ''} class="rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 ${deactivating ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-700 hover:bg-teal-800'}">${busy ? 'Memproses...' : deactivating ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}</button>
                </div>
            </section>
        `;
        const close = (): void => { if (!busy) root.remove(); };
        root.querySelector('[data-confirm-overlay]')?.addEventListener('click', close);
        root.querySelector('#room-mgmt-confirm-cancel')?.addEventListener('click', close);
        root.querySelector('#room-mgmt-confirm-ok')?.addEventListener('click', async () => {
            busy = true;
            error = null;
            render();
            try {
                if (deactivating) await deactivateManagedRoom(room.id);
                else await activateManagedRoom(room.id);
                root.remove();
                showToast(deactivating ? 'Ruangan berhasil dinonaktifkan.' : 'Ruangan berhasil diaktifkan.', true);
                notifyMutation();
                await reloadDetail();
                renderInfoTab();
            } catch (err) {
                busy = false;
                error = apiMessage(err, 'Status ruangan gagal diperbarui.');
                render();
            }
        });
    };
    render();
};

// ─────────────────────────── Foto tab ───────────────────────────

const objectUrlFor = async (mediaUrl: string): Promise<string> => {
    if (!state) throw new Error('closed');
    const cached = state.objectUrls.get(mediaUrl);
    if (cached) return cached;
    const url = await fetchRoomPhotoObjectUrl(mediaUrl);
    if (!state) { URL.revokeObjectURL(url); throw new Error('closed'); }
    state.objectUrls.set(mediaUrl, url);
    return url;
};

const renderPhotoTab = async (): Promise<void> => {
    if (!state) return;
    if (state.photos === null) {
        renderLoading('Memuat foto ruangan...');
        const local = state;
        try {
            const photos = await listRoomPhotos(state.roomId);
            if (state !== local) return;
            state.photos = photos;
        } catch (error) {
            if (state !== local) return;
            const body = bodyEl();
            if (body) body.innerHTML = `<p class="py-16 text-center text-sm text-gray-500">${escapeHtml(apiMessage(error, 'Foto ruangan gagal dimuat.'))}</p>`;
            return;
        }
    }
    paintPhotoTab();
};

const paintPhotoTab = (): void => {
    const body = bodyEl();
    if (!body || !state?.detail) return;
    const canManage = state.detail.management_flags.can_manage_media;
    const photos = orderedPhotos(state.photos ?? []);

    body.innerHTML = `
        <div class="space-y-5">
            ${canManage ? `
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-xs text-gray-500">Maksimal ${PHOTO_LIMIT} foto (JPG/PNG/WebP, maks 5 MB). Bisa pilih beberapa foto sekaligus. Foto pertama otomatis menjadi sampul.</p>
                    <div>
                        <input id="room-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple class="sr-only" ${photos.length >= PHOTO_LIMIT || state.busy ? 'disabled' : ''}>
                        <label for="room-photo-input" class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 ${photos.length >= PHOTO_LIMIT || state.busy ? 'cursor-not-allowed opacity-60' : ''}">
                            ${state.busy ? 'Mengunggah...' : 'Unggah Foto'}
                        </label>
                    </div>
                </div>
            ` : ''}
            ${photos.length === 0
                ? '<p class="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-500">Foto ruangan belum tersedia.</p>'
                : `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">${photos.map((photo, index) => renderPhotoCard(photo, index, photos.length, canManage)).join('')}</div>`}
        </div>
    `;

    if (canManage) {
        body.querySelector('#room-photo-input')?.addEventListener('change', (event) => {
            const input = event.target as HTMLInputElement;
            const files = input.files ? Array.from(input.files) : [];
            // Reset so re-selecting the same file(s) fires change again.
            input.value = '';
            if (files.length > 0) void handlePhotoUploadQueue(files);
        });
        photos.forEach((photo) => {
            body.querySelector(`[data-photo-cover="${photo.id}"]`)?.addEventListener('click', () => void handleSetCover(photo.id));
            body.querySelector(`[data-photo-delete="${photo.id}"]`)?.addEventListener('click', () => void handleDeletePhoto(photo.id));
            body.querySelector(`[data-photo-up="${photo.id}"]`)?.addEventListener('click', () => void handleReorder(photo.id, -1));
            body.querySelector(`[data-photo-down="${photo.id}"]`)?.addEventListener('click', () => void handleReorder(photo.id, 1));
        });
    }

    // Hydrate authenticated thumbnails.
    photos.forEach((photo) => {
        const mediaUrl = photo.thumb_url ?? photo.display_url;
        const container = body.querySelector<HTMLElement>(`[data-photo-thumb="${photo.id}"]`);
        if (!mediaUrl || !container) return;
        const local = state;
        void objectUrlFor(mediaUrl).then((objectUrl) => {
            if (state !== local || !container.isConnected) return;
            const image = document.createElement('img');
            image.src = objectUrl;
            image.alt = `Foto ruangan ${escapeHtml(state?.detail?.code ?? '')}`;
            image.loading = 'lazy';
            image.className = 'h-full w-full object-cover';
            container.replaceChildren(image);
        }).catch(() => { /* keep placeholder */ });
    });
};

const renderPhotoCard = (
    photo: ManagedRoomPhoto,
    index: number,
    total: number,
    canManage: boolean,
): string => `
    <figure class="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
        <div data-photo-thumb="${photo.id}" class="flex h-32 items-center justify-center bg-gray-100 text-gray-300">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>
        </div>
        <figcaption class="flex items-center justify-between gap-2 px-3 py-2">
            ${photo.is_cover ? '<span class="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">Sampul</span>' : '<span class="text-[10px] text-gray-400">Foto ' + (index + 1) + '</span>'}
            ${canManage ? `
                <div class="flex items-center gap-1">
                    <button type="button" data-photo-up="${photo.id}" ${index === 0 ? 'disabled' : ''} class="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="Naikkan urutan foto">▲</button>
                    <button type="button" data-photo-down="${photo.id}" ${index === total - 1 ? 'disabled' : ''} class="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="Turunkan urutan foto">▼</button>
                    ${photo.is_cover ? '' : `<button type="button" data-photo-cover="${photo.id}" class="rounded px-2 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-50">Jadikan Sampul</button>`}
                    <button type="button" data-photo-delete="${photo.id}" class="rounded px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50">Hapus</button>
                </div>
            ` : ''}
        </figcaption>
    </figure>
`;

const withBusy = async (task: () => Promise<void>): Promise<void> => {
    if (!state || state.busy) return;
    state.busy = true;
    try {
        await task();
    } finally {
        if (state) {
            // Clear busy THEN repaint, so busy-labelled controls reset even
            // though the task painted its final state while busy was still true.
            state.busy = false;
            repaintActiveTab();
        }
    }
};

const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // mirrors backend max:5120 KB

const photoFileError = (file: File): string | null => {
    if (!ALLOWED_PHOTO_MIME.includes(file.type)) {
        return `${file.name}: format harus JPG, PNG, atau WebP.`;
    }
    if (file.size > MAX_PHOTO_BYTES) {
        return `${file.name}: ukuran melebihi 5 MB.`;
    }
    return null;
};

const setUploadLabel = (text: string): void => {
    const label = document.querySelector('label[for="room-photo-input"]');
    if (label) label.textContent = text;
};

/**
 * Sequentially uploads one or more selected photos through the single-file
 * backend endpoint, enforcing the per-room cap and client-side type/size
 * checks, with a live progress label and a per-outcome summary.
 */
const handlePhotoUploadQueue = (files: File[]): Promise<void> => withBusy(async () => {
    if (!state) return;

    const remaining = PHOTO_LIMIT - (state.photos ?? []).length;
    if (remaining <= 0) {
        showToast(`Jumlah foto sudah mencapai batas ${PHOTO_LIMIT}.`, false);
        return;
    }

    const valid: File[] = [];
    const invalid: string[] = [];
    for (const file of files) {
        const error = photoFileError(file);
        if (error) invalid.push(error);
        else valid.push(file);
    }

    let skippedForLimit = 0;
    let queue = valid;
    if (valid.length > remaining) {
        skippedForLimit = valid.length - remaining;
        queue = valid.slice(0, remaining);
    }

    if (queue.length === 0) {
        showToast(invalid[0] ?? 'Tidak ada foto valid untuk diunggah.', false);
        return;
    }

    paintPhotoTab(); // lock the control (disabled + "Mengunggah...")

    let succeeded = 0;
    const failed: string[] = [];
    for (let i = 0; i < queue.length; i++) {
        setUploadLabel(`Mengunggah ${i + 1}/${queue.length}...`);
        try {
            await uploadRoomPhoto(state.roomId, queue[i]);
            if (state === null) return;
            succeeded += 1;
        } catch (error) {
            failed.push(`${queue[i].name}: ${apiMessage(error, 'gagal diunggah')}`);
        }
    }

    try {
        state.photos = await listRoomPhotos(state.roomId);
    } catch { /* keep last known list; final repaint still resets the control */ }

    if (succeeded > 0) {
        notifyMutation();
        await reloadDetail();
        showToast(`${succeeded} foto berhasil diunggah.`, true);
    }
    if (failed.length > 0) {
        showToast(`${failed.length} foto gagal diunggah. ${failed[0]}`, false);
    }
    if (skippedForLimit > 0) {
        showToast(`${skippedForLimit} foto dilewati karena melebihi batas ${PHOTO_LIMIT} foto.`, false);
    }
    if (succeeded === 0 && failed.length === 0 && invalid.length > 0) {
        showToast(invalid[0], false);
    }
    // withBusy's finally repaints the tab with busy=false → control resets.
});

const handleSetCover = (photoId: number): Promise<void> => withBusy(async () => {
    if (!state) return;
    try {
        await setRoomCover(state.roomId, photoId);
        state.photos = await listRoomPhotos(state.roomId);
        showToast('Foto sampul berhasil diperbarui.', true);
        notifyMutation();
        await reloadDetail();
    } catch (error) {
        showToast(apiMessage(error, 'Gagal mengubah foto sampul.'), false);
    }
    paintPhotoTab();
});

const handleDeletePhoto = (photoId: number): Promise<void> => withBusy(async () => {
    if (!state) return;
    try {
        await deleteRoomPhoto(state.roomId, photoId);
        state.photos = await listRoomPhotos(state.roomId);
        showToast('Foto berhasil dihapus.', true);
        notifyMutation();
        await reloadDetail();
    } catch (error) {
        showToast(apiMessage(error, 'Gagal menghapus foto.'), false);
    }
    paintPhotoTab();
});

const handleReorder = (photoId: number, direction: -1 | 1): Promise<void> => withBusy(async () => {
    if (!state?.photos) return;
    const ordered = orderedPhotos(state.photos);
    const index = ordered.findIndex((photo) => photo.id === photoId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const ids = ordered.map((photo) => photo.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
        state.photos = await reorderRoomPhotos(state.roomId, ids);
        notifyMutation();
    } catch (error) {
        showToast(apiMessage(error, 'Gagal mengubah urutan foto.'), false);
    }
    paintPhotoTab();
});

// ─────────────────────────── Fasilitas tab ───────────────────────────

const toFacilityRow = (facility: ManagedRoomFacility): FacilityRow => ({
    facility_type_id: facility.facility_type_id,
    quantity: facility.quantity != null ? String(facility.quantity) : '',
    condition: isFacilityCondition(facility.condition) ? facility.condition : '',
    notes: facility.notes ?? '',
});

const cloneFacilityRows = (rows: FacilityRow[]): FacilityRow[] =>
    rows.map((row) => ({ ...row }));

/** Stable signature of a facility row, for saved/unsaved comparison. */
const facilityRowSignature = (row: FacilityRow): string =>
    `${row.facility_type_id}|${row.quantity.trim()}|${row.condition}|${row.notes.trim()}`;

/** True when the row exactly matches a persisted (saved) row. */
const facilityRowIsSaved = (row: FacilityRow): boolean => {
    if (row.facility_type_id === '') return false;
    const signature = facilityRowSignature(row);
    return (state?.savedFacilities ?? []).some((saved) => facilityRowSignature(saved) === signature);
};

/** True when the current rows differ from the persisted snapshot. */
const facilitiesAreDirty = (): boolean => {
    const current = (state?.facilities ?? []).map(facilityRowSignature).sort();
    const saved = (state?.savedFacilities ?? []).map(facilityRowSignature).sort();
    if (current.length !== saved.length) return true;
    return current.some((signature, index) => signature !== saved[index]);
};

const clearFacilityAcknowledgement = (): void => {
    if (state) state.facilityAcknowledgement = null;
};

const facilityAcknowledgementCopy = (
    acknowledgement: FacilityDelegatedActivityAcknowledgementOutcome,
): { title: string; body: string | null } => {
    if (acknowledgement.outcome === 'created') {
        return {
            title: 'Perubahan fasilitas tersimpan',
            body: 'Aktivitas ini menunggu peninjauan Kepala Lab.',
        };
    }

    if (acknowledgement.outcome === 'existing') {
        return {
            title: 'Perubahan fasilitas tersimpan',
            body: 'Aktivitas peninjauan sudah tercatat sebelumnya.',
        };
    }

    if (acknowledgement.reason === 'no_active_kepala_lab') {
        return {
            title: 'Perubahan fasilitas tersimpan',
            body: 'Belum ada Kepala Lab aktif untuk peninjauan otomatis.',
        };
    }

    if (acknowledgement.reason === 'no_effective_change') {
        return {
            title: 'Tidak ada perubahan baru',
            body: 'Data fasilitas sudah sesuai, tidak ada aktivitas peninjauan baru.',
        };
    }

    return {
        title: acknowledgement.message || 'Perubahan fasilitas tersimpan',
        body: null,
    };
};

const renderFacilityAcknowledgementStatus = (): string => {
    const acknowledgement = state?.facilityAcknowledgement;
    if (!acknowledgement) return '';

    const copy = facilityAcknowledgementCopy(acknowledgement);

    return `
        <section id="room-facility-delegated-status" role="status" aria-live="polite" data-facility-delegated-outcome="${escapeHtml(acknowledgement.outcome)}" class="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            <p class="font-bold">${escapeHtml(copy.title)}</p>
            ${copy.body ? `<p class="mt-1 text-xs font-semibold text-teal-800">${escapeHtml(copy.body)}</p>` : ''}
        </section>
    `;
};

const renderFacilityTab = async (): Promise<void> => {
    if (!state) return;
    if (state.facilities === null) {
        renderLoading('Memuat fasilitas ruangan...');
        const local = state;
        try {
            const [facilities, types] = await Promise.all([
                getRoomFacilities(state.roomId),
                // Only active types are offered for new assignments; inactive
                // types already on the room stay via the saved facility rows.
                listFacilityTypes(true),
            ]);
            if (state !== local) return;
            const assigned = facilityDisplayList(facilities);
            state.facilities = assigned.map(toFacilityRow);
            state.savedFacilities = cloneFacilityRows(state.facilities);
            // Keep already-assigned types selectable even if later deactivated,
            // so saved rows still render their name.
            const byId = new Map(types.map((type) => [type.id, type]));
            for (const facility of assigned) {
                if (!byId.has(facility.facility_type_id) && facility.name) {
                    byId.set(facility.facility_type_id, {
                        id: facility.facility_type_id,
                        name: facility.name,
                        slug: facility.slug ?? '',
                        is_predefined: false,
                    });
                }
            }
            state.facilityTypes = Array.from(byId.values());
        } catch (error) {
            if (state !== local) return;
            const body = bodyEl();
            if (body) body.innerHTML = `<p class="py-16 text-center text-sm text-gray-500">${escapeHtml(apiMessage(error, 'Fasilitas gagal dimuat.'))}</p>`;
            return;
        }
    }
    paintFacilityTab();
};

const paintFacilityTab = (): void => {
    const body = bodyEl();
    if (!body || !state?.detail) return;
    const canManage = state.detail.management_flags.can_manage_facilities;
    const rows = state.facilities ?? [];

    const conditionOptions = (selectedValue: string): string =>
        (['', 'baik', 'perlu_perbaikan', 'rusak'] as const).map((value) => `
            <option value="${value}" ${value === selectedValue ? 'selected' : ''}>${value === '' ? 'Kondisi (opsional)' : escapeHtml(facilityConditionLabel(value) ?? value)}</option>
        `).join('');

    // Facility types already assigned in OTHER rows are disabled here to
    // prevent a duplicate assignment the backend would reject.
    const typeOptions = (selectedId: number | '', rowIndex: number): string => {
        const usedElsewhere = new Set(
            rows.filter((_, i) => i !== rowIndex)
                .map((r) => r.facility_type_id)
                .filter((id): id is number => id !== ''),
        );
        return `<option value="">Pilih fasilitas</option>` + state!.facilityTypes.map((type) => `
            <option value="${type.id}" ${type.id === selectedId ? 'selected' : ''} ${usedElsewhere.has(type.id) ? 'disabled' : ''}>${escapeHtml(type.name)}${usedElsewhere.has(type.id) ? ' (sudah dipilih)' : ''}</option>
        `).join('');
    };

    const dirty = facilitiesAreDirty();

    body.innerHTML = `
        <div class="space-y-4">
            ${!canManage ? renderReadonlyFacilities(rows) : `
                <div id="room-facility-rows" class="space-y-3">
                    ${rows.length === 0 ? '<p class="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Fasilitas belum dicatat. Tambahkan fasilitas ruangan di bawah.</p>' : ''}
                    ${rows.map((row, index) => {
                        const saved = facilityRowIsSaved(row);
                        return `
                        <div class="rounded-xl border ${saved ? 'border-gray-100 bg-gray-50' : 'border-amber-200 bg-amber-50/50'} p-3" data-facility-row="${index}">
                            <div class="mb-2 flex items-center justify-between gap-2">
                                <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Fasilitas ${index + 1}</span>
                                <span class="rounded-full border px-2 py-0.5 text-[10px] font-bold ${saved ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-100 text-amber-700'}">${saved ? 'Tersimpan' : 'Belum disimpan'}</span>
                            </div>
                            <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_88px_140px]">
                                <select data-facility-type="${index}" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">${typeOptions(row.facility_type_id, index)}</select>
                                <input data-facility-qty="${index}" type="number" min="1" max="10000" value="${escapeHtml(row.quantity)}" placeholder="Jumlah" class="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                                <select data-facility-condition="${index}" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">${conditionOptions(row.condition)}</select>
                            </div>
                            <div class="mt-2 flex items-center gap-2">
                                <input data-facility-notes="${index}" maxlength="500" value="${escapeHtml(row.notes)}" placeholder="Catatan (opsional)" class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                                <button type="button" data-facility-remove="${index}" class="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Hapus</button>
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
                ${dirty ? '<p data-facility-dirty class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">Ada perubahan fasilitas yang belum disimpan.</p>' : ''}
                ${renderFacilityAcknowledgementStatus()}
                <div class="flex flex-wrap items-center gap-3">
                    <button id="room-facility-add" type="button" class="rounded-xl border border-teal-700 px-4 py-2 text-sm font-bold text-teal-700 hover:bg-teal-50">Tambah Fasilitas</button>
                    <button id="room-facility-save" type="button" ${state.busy || !dirty ? 'disabled' : ''} class="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${dirty ? 'bg-teal-700 hover:bg-teal-800' : 'bg-gray-400'}">${state.busy ? 'Menyimpan...' : dirty ? 'Simpan Perubahan' : 'Tersimpan'}</button>
                </div>
                <details class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <summary class="cursor-pointer text-xs font-bold text-gray-600">Tambah jenis fasilitas baru</summary>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <input id="room-facility-new-name" maxlength="100" placeholder="Nama fasilitas" class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <button id="room-facility-new-add" type="button" class="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100">Tambah Jenis</button>
                    </div>
                </details>
            `}
        </div>
    `;

    if (!canManage) return;

    body.querySelector('#room-facility-add')?.addEventListener('click', () => {
        syncFacilityInputsToState();
        clearFacilityAcknowledgement();
        state?.facilities?.push({ facility_type_id: '', quantity: '', condition: '', notes: '' });
        paintFacilityTab();
    });
    body.querySelector('#room-facility-save')?.addEventListener('click', () => void handleFacilitySave());
    body.querySelector('#room-facility-new-add')?.addEventListener('click', () => void handleCreateFacilityType());
    (state.facilities ?? []).forEach((_row, index) => {
        body.querySelector(`[data-facility-remove="${index}"]`)?.addEventListener('click', () => {
            syncFacilityInputsToState();
            clearFacilityAcknowledgement();
            state?.facilities?.splice(index, 1);
            paintFacilityTab();
        });
        // Recompute saved/unsaved badges + dirty state after each field edit.
        // 'change' fires on blur/selection, so it never disrupts mid-typing.
        ['type', 'qty', 'condition', 'notes'].forEach((field) => {
            body.querySelector(`[data-facility-${field}="${index}"]`)?.addEventListener('change', () => {
                syncFacilityInputsToState();
                clearFacilityAcknowledgement();
                paintFacilityTab();
            });
        });
    });
};

const renderReadonlyFacilities = (rows: FacilityRow[]): string => {
    if (rows.length === 0) {
        return '<p class="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Fasilitas belum dicatat untuk ruangan ini.</p>';
    }
    return `<ul class="flex flex-wrap gap-2">${rows.map((row) => {
        const name = state?.facilityTypes.find((type) => type.id === row.facility_type_id)?.name ?? 'Fasilitas';
        const conditionLabel = facilityConditionLabel(row.condition);
        return `<li class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">${escapeHtml(name)}${row.quantity ? ` <span class="text-gray-400">×${escapeHtml(row.quantity)}</span>` : ''}${conditionLabel ? ` <span class="rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${facilityConditionTone(row.condition)}">${conditionLabel}</span>` : ''}</li>`;
    }).join('')}</ul>`;
};

/** Read the current DOM inputs back into state before a re-render. */
const syncFacilityInputsToState = (): void => {
    const body = bodyEl();
    if (!body || !state?.facilities) return;
    state.facilities = state.facilities.map((_row, index) => ({
        facility_type_id: Number((body.querySelector(`[data-facility-type="${index}"]`) as HTMLSelectElement | null)?.value) || '',
        quantity: (body.querySelector(`[data-facility-qty="${index}"]`) as HTMLInputElement | null)?.value ?? '',
        condition: ((body.querySelector(`[data-facility-condition="${index}"]`) as HTMLSelectElement | null)?.value ?? '') as RoomFacilityCondition | '',
        notes: (body.querySelector(`[data-facility-notes="${index}"]`) as HTMLInputElement | null)?.value ?? '',
    }));
};

const handleFacilitySave = (): Promise<void> => withBusy(async () => {
    if (!state) return;
    syncFacilityInputsToState();
    const rows = state.facilities ?? [];
    const seen = new Set<number>();
    const payload: FacilitySyncEntry[] = [];
    for (const row of rows) {
        if (row.facility_type_id === '') {
            showToast('Lengkapi jenis fasilitas pada setiap baris.', false);
            return;
        }
        if (seen.has(row.facility_type_id)) {
            showToast('Fasilitas yang sama tidak boleh dikirim dua kali.', false);
            return;
        }
        seen.add(row.facility_type_id);
        payload.push({
            facility_type_id: row.facility_type_id,
            quantity: row.quantity.trim() ? Number(row.quantity) : null,
            condition: row.condition || null,
            notes: row.notes.trim() || null,
        });
    }
    paintFacilityTab();
    try {
        clearFacilityAcknowledgement();
        const saved = await syncRoomFacilities(state.roomId, payload);
        state.facilities = facilityDisplayList(saved.data).map(toFacilityRow);
        state.savedFacilities = cloneFacilityRows(state.facilities);
        state.facilityAcknowledgement = saved.delegated_activity_acknowledgement ?? null;
        showToast('Fasilitas ruangan berhasil disimpan.', true);
        notifyMutation();
        await reloadDetail();
    } catch (error) {
        showToast(apiMessage(error, 'Gagal menyimpan fasilitas.'), false);
    }
    paintFacilityTab();
});

const handleCreateFacilityType = (): Promise<void> => withBusy(async () => {
    const body = bodyEl();
    const input = body?.querySelector('#room-facility-new-name') as HTMLInputElement | null;
    const name = input?.value.trim() ?? '';
    if (!name || !state) {
        showToast('Nama fasilitas wajib diisi.', false);
        return;
    }
    syncFacilityInputsToState();
    try {
        const created = await createFacilityType(name);
        clearFacilityAcknowledgement();
        state.facilityTypes = [...state.facilityTypes, created];
        state.facilities?.push({ facility_type_id: created.id, quantity: '', condition: '', notes: '' });
        showToast('Jenis fasilitas berhasil ditambahkan.', true);
    } catch (error) {
        showToast(apiMessage(error, 'Gagal menambahkan jenis fasilitas.'), false);
    }
    paintFacilityTab();
});

// ─────────────────────────── Template tab ───────────────────────────

const renderTemplateTab = async (): Promise<void> => {
    if (!state) return;
    if (state.templates === null) {
        renderLoading('Memuat template ruangan...');
        const local = state;
        try {
            const templates = await listRoomTemplates(state.roomId);
            if (state !== local) return;
            state.templates = templates;
        } catch (error) {
            if (state !== local) return;
            const body = bodyEl();
            if (body) body.innerHTML = `<p class="py-16 text-center text-sm text-gray-500">${escapeHtml(apiMessage(error, 'Template gagal dimuat.'))}</p>`;
            return;
        }
    }
    paintTemplateTab();
};

const paintTemplateTab = (): void => {
    const body = bodyEl();
    if (!body || !state?.detail) return;
    const canManage = state.detail.management_flags.can_manage_templates;
    const templates = orderedTemplates(state.templates ?? []);

    body.innerHTML = `
        <div class="space-y-5">
            <p class="text-xs text-gray-500">Template PDF/DOCX menjadi acuan mahasiswa saat mengajukan peminjaman. Hanya satu versi yang aktif.</p>
            ${canManage ? `
                <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Unggah Template Baru</p>
                    <div class="mt-3 space-y-2">
                        <input id="room-template-input" type="file" accept=".pdf,.docx" class="sr-only">
                        <label for="room-template-input" class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-teal-700 px-4 py-2 text-sm font-bold text-teal-700 hover:bg-teal-50">Pilih File PDF/DOCX</label>
                        <p id="room-template-filename" class="text-xs text-gray-500">Belum ada file dipilih.</p>
                        <input id="room-template-notes" maxlength="500" placeholder="Catatan versi (opsional)" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <button id="room-template-upload" type="button" ${state.busy ? 'disabled' : ''} class="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60">${state.busy ? 'Mengunggah...' : 'Unggah & Aktifkan'}</button>
                    </div>
                </div>
            ` : ''}
            ${templates.length === 0
                ? '<p class="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">Template belum tersedia untuk ruangan ini.</p>'
                : `<div class="space-y-2">${templates.map((template) => renderTemplateRow(template, canManage)).join('')}</div>`}
        </div>
    `;

    if (canManage) {
        const input = body.querySelector('#room-template-input') as HTMLInputElement | null;
        input?.addEventListener('change', () => {
            const name = input.files?.[0]?.name ?? 'Belum ada file dipilih.';
            const label = body.querySelector('#room-template-filename');
            if (label) label.textContent = name;
        });
        body.querySelector('#room-template-upload')?.addEventListener('click', () => void handleTemplateUpload());
    }
    templates.forEach((template) => {
        body.querySelector(`[data-template-download="${template.id}"]`)?.addEventListener('click', () => void handleTemplateDownload(template));
        body.querySelector(`[data-template-activate="${template.id}"]`)?.addEventListener('click', () => void handleTemplateToggle(template, true));
        body.querySelector(`[data-template-deactivate="${template.id}"]`)?.addEventListener('click', () => void handleTemplateToggle(template, false));
    });
};

const renderTemplateRow = (template: ManagedRoomTemplate, canManage: boolean): string => `
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 ${template.is_active ? 'bg-teal-50/50' : 'bg-white'}">
        <div class="min-w-0">
            <div class="flex items-center gap-2">
                <p class="text-sm font-bold text-gray-800">Versi ${template.version}</p>
                ${template.is_active ? '<span class="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">Aktif</span>' : ''}
                <span class="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-500">${templateFormatLabel(template.mime)}</span>
            </div>
            <p class="mt-0.5 truncate text-xs text-gray-500">${escapeHtml(template.original_name ?? 'template')}${template.size_bytes ? ` · ${escapeHtml(formatFileSize(template.size_bytes))}` : ''}</p>
        </div>
        <div class="flex items-center gap-1">
            <button type="button" data-template-download="${template.id}" class="rounded-lg px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50">Unduh</button>
            ${canManage && !template.is_active ? `<button type="button" data-template-activate="${template.id}" class="rounded-lg px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50">Aktifkan</button>` : ''}
            ${canManage && template.is_active ? `<button type="button" data-template-deactivate="${template.id}" class="rounded-lg px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100">Nonaktifkan</button>` : ''}
        </div>
    </div>
`;

const handleTemplateUpload = (): Promise<void> => withBusy(async () => {
    const body = bodyEl();
    if (!body || !state) return;
    const input = body.querySelector('#room-template-input') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
        showToast('Pilih file PDF atau DOCX terlebih dahulu.', false);
        return;
    }
    const notes = (body.querySelector('#room-template-notes') as HTMLInputElement | null)?.value ?? '';
    paintTemplateTab();
    try {
        await uploadRoomTemplate(state.roomId, file, notes);
        state.templates = await listRoomTemplates(state.roomId);
        showToast('Template berhasil diunggah dan diaktifkan.', true);
        notifyMutation();
        await reloadDetail();
    } catch (error) {
        showToast(apiMessage(error, 'Gagal mengunggah template.'), false);
    }
    paintTemplateTab();
});

const handleTemplateToggle = (template: ManagedRoomTemplate, activate: boolean): Promise<void> => withBusy(async () => {
    if (!state) return;
    try {
        if (activate) await activateRoomTemplate(state.roomId, template.id);
        else await deactivateRoomTemplate(state.roomId, template.id);
        state.templates = await listRoomTemplates(state.roomId);
        showToast(activate ? 'Template berhasil diaktifkan.' : 'Template berhasil dinonaktifkan.', true);
        notifyMutation();
        await reloadDetail();
    } catch (error) {
        showToast(apiMessage(error, 'Gagal memperbarui template.'), false);
    }
    paintTemplateTab();
});

const handleTemplateDownload = async (template: ManagedRoomTemplate): Promise<void> => {
    if (!state?.detail) return;
    try {
        await downloadRoomTemplate({ id: state.roomId, code: state.detail.code }, template);
    } catch (error) {
        showToast(apiMessage(error, 'Template gagal diunduh.'), false);
    }
};

// ─────────────────────────── Riwayat tab ───────────────────────────

const renderAuditTab = async (): Promise<void> => {
    if (!state) return;
    if (state.audit === null) {
        renderLoading('Memuat riwayat perubahan...');
        const local = state;
        try {
            const audit = await listRoomAuditLogs(state.roomId);
            if (state !== local) return;
            state.audit = audit;
        } catch (error) {
            if (state !== local) return;
            const body = bodyEl();
            if (body) body.innerHTML = `<p class="py-16 text-center text-sm text-gray-500">${escapeHtml(apiMessage(error, 'Riwayat gagal dimuat.'))}</p>`;
            return;
        }
    }
    const body = bodyEl();
    if (!body) return;
    const audit = state.audit ?? [];
    body.innerHTML = audit.length === 0
        ? '<p class="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-500">Belum ada riwayat perubahan untuk ruangan ini.</p>'
        : `<ol class="space-y-2">${audit.map((entry) => `
            <li class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="text-xs font-bold text-gray-800">${escapeHtml(auditEntryLabel(entry))}</span>
                    <time class="text-[11px] text-gray-500">${escapeHtml(formatAuditDateTime(entry.created_at))}</time>
                </div>
                <p class="mt-1 text-xs text-gray-500">${escapeHtml(entry.actor ?? 'Sistem')}</p>
                ${entry.details ? `<p class="mt-1.5 break-words text-sm text-gray-700">${escapeHtml(entry.details)}</p>` : ''}
            </li>
        `).join('')}</ol>`;
};
