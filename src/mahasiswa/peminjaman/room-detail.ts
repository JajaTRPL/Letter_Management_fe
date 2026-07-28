import { buttonClass, SPINNER_CLASS } from '../../shared/design-system';
import { getRoomTypeLabel } from '../../shared/peminjaman-calendar';
import {
    downloadRoomTemplate,
    fetchRoomPhotoObjectUrl,
    getPeminjamanRoomDetail,
} from './api';
import { escapeHtml } from './views';
import { formatFileSize } from './workflow';
import type {
    RoomDetail,
    RoomFacilityItem,
    RoomPhotoMeta,
} from './types';

/**
 * Mahasiswa room catalog detail drawer: photo gallery (authenticated blob
 * loading — never raw storage URLs), facilities, tata tertib, active
 * template download, and the "Ajukan Peminjaman" CTA that hands the room to
 * the existing booking flow.
 */

const ROOT_ID = 'peminjaman-room-detail-root';

interface RoomDetailOptions {
    onApply?: (roomId: number) => void;
}

interface DrawerState {
    roomId: number;
    detail: RoomDetail | null;
    photos: RoomPhotoMeta[];
    selectedPhotoIndex: number;
    objectUrls: Map<string, string>;
    escapeHandler: ((event: KeyboardEvent) => void) | null;
    options: RoomDetailOptions;
}

let state: DrawerState | null = null;

const CONDITION_LABELS: Record<string, { label: string; chipClass: string }> = {
    baik: { label: 'Baik', chipClass: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
    perlu_perbaikan: { label: 'Perlu perbaikan', chipClass: 'border-amber-100 bg-amber-50 text-amber-700' },
    rusak: { label: 'Rusak', chipClass: 'border-red-100 bg-red-50 text-red-600' },
};

const normalizePhotos = (detail: RoomDetail): RoomPhotoMeta[] =>
    (detail.photos ?? []).filter((photo) => Boolean(photo?.display_url || photo?.thumb_url));

const normalizeFacilities = (detail: RoomDetail): RoomFacilityItem[] =>
    (detail.facilities ?? []).filter((facility) => Boolean(facility?.name));

export const closeRoomCatalogDetail = (): void => {
    document.getElementById(ROOT_ID)?.remove();
    if (state) {
        state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
        state.objectUrls.clear();
        if (state.escapeHandler) {
            document.removeEventListener('keydown', state.escapeHandler);
        }
    }
    state = null;
};

export const openRoomCatalogDetail = async (
    roomId: number,
    options: RoomDetailOptions = {},
): Promise<void> => {
    closeRoomCatalogDetail();

    state = {
        roomId,
        detail: null,
        photos: [],
        selectedPhotoIndex: 0,
        objectUrls: new Map(),
        escapeHandler: null,
        options,
    };

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
        <div data-room-detail-overlay class="fixed inset-0 z-[200] bg-black/40"></div>
        <aside role="dialog" aria-modal="true" aria-labelledby="room-detail-title" class="fixed inset-y-0 right-0 z-[201] flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl">
            <header class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                <div class="min-w-0">
                    <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Detail Ruangan</p>
                    <h2 id="room-detail-title" class="mt-1 break-words text-base font-bold text-gray-900">Memuat ruangan...</h2>
                </div>
                <button id="close-room-detail" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Tutup detail ruangan">×</button>
            </header>
            <div id="room-detail-body" class="flex-1 overflow-y-auto px-6 py-5" aria-live="polite">
                <div class="py-16 text-center">
                    <div class="mx-auto h-9 w-9 ${SPINNER_CLASS}" aria-hidden="true"></div>
                    <p class="mt-4 text-sm font-semibold text-gray-600">Memuat detail ruangan...</p>
                </div>
            </div>
            <footer id="room-detail-footer" class="hidden border-t border-gray-100 px-6 py-4">
                <button id="room-detail-apply" type="button" class="${buttonClass('primary', 'md', 'w-full')}">Ajukan Peminjaman</button>
            </footer>
        </aside>
    `;
    document.body.appendChild(root);

    const escapeHandler = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') closeRoomCatalogDetail();
    };
    state.escapeHandler = escapeHandler;
    document.addEventListener('keydown', escapeHandler);
    root.querySelector('[data-room-detail-overlay]')?.addEventListener('click', closeRoomCatalogDetail);
    root.querySelector('#close-room-detail')?.addEventListener('click', closeRoomCatalogDetail);
    root.querySelector<HTMLButtonElement>('#close-room-detail')?.focus();

    const localState = state;
    try {
        const detail = await getPeminjamanRoomDetail(roomId);
        if (state !== localState) return; // drawer was closed/reopened meanwhile
        state.detail = detail;
        state.photos = normalizePhotos(detail);
        renderBody();
    } catch (error) {
        if (state !== localState) return;
        renderLoadError(
            error instanceof Error ? error.message : 'Detail ruangan gagal dimuat.',
        );
    }
};

const renderLoadError = (message: string): void => {
    const body = document.getElementById('room-detail-body');
    if (!body || !state) return;
    body.innerHTML = `
        <div class="py-16 text-center">
            <h3 class="text-sm font-bold text-gray-800">Detail ruangan belum dapat dimuat</h3>
            <p class="mt-2 text-sm text-gray-500">${escapeHtml(message)}</p>
            <button id="room-detail-retry" type="button" class="${buttonClass('outline', 'sm', 'mt-5')}">Coba Lagi</button>
        </div>
    `;
    document.getElementById('room-detail-retry')?.addEventListener('click', () => {
        const options = state?.options ?? {};
        const roomId = state?.roomId;
        if (roomId) void openRoomCatalogDetail(roomId, options);
    });
};

const renderBody = (): void => {
    if (!state?.detail) return;
    const detail = state.detail;

    const title = document.getElementById('room-detail-title');
    if (title) title.textContent = `${detail.code} · ${detail.name}`;

    const body = document.getElementById('room-detail-body');
    if (!body) return;

    body.innerHTML = `
        ${renderGallery()}
        <div class="mt-5 flex flex-wrap items-center gap-2">
            <span class="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">${getRoomTypeLabel(detail.type)}</span>
            <span class="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">Kapasitas ${detail.capacity} orang</span>
            ${detail.owning_laboratory ? `<span class="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">${escapeHtml(detail.owning_laboratory.name)}</span>` : ''}
        </div>
        <div class="mt-4 space-y-1">
            <p class="text-xs font-bold uppercase tracking-wider text-gray-400">Lokasi</p>
            <p class="text-sm text-gray-700">${escapeHtml(detail.location)}</p>
        </div>
        ${detail.description ? `
            <div class="mt-4 space-y-1">
                <p class="text-xs font-bold uppercase tracking-wider text-gray-400">Deskripsi</p>
                <p class="whitespace-pre-line text-sm text-gray-700">${escapeHtml(detail.description)}</p>
            </div>
        ` : ''}
        ${detail.rules ? `
            <div class="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <p class="text-xs font-bold uppercase tracking-wider text-amber-700">Tata Tertib Ruangan</p>
                <p class="mt-2 whitespace-pre-line text-sm text-gray-700">${escapeHtml(detail.rules)}</p>
            </div>
        ` : ''}
        ${renderFacilities()}
        ${renderTemplateBlock()}
    `;

    document.getElementById('room-detail-footer')?.classList.remove('hidden');
    attachBodyListeners();
    void hydrateGalleryImage();
    void hydrateThumbStrip();
};

const renderGallery = (): string => {
    if (!state) return '';

    if (state.photos.length === 0) {
        return `
            <div class="flex h-52 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-400">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>
                <p class="text-xs font-semibold">Foto ruangan belum tersedia</p>
            </div>
        `;
    }

    const multiple = state.photos.length > 1;
    return `
        <div data-gallery-viewport class="relative" role="group" aria-label="Galeri foto ruangan" aria-roledescription="carousel">
            <div id="room-gallery-main" class="relative h-56 w-full overflow-hidden rounded-2xl bg-gray-100" data-photo-state="loading">
                <div data-gallery-loading class="absolute inset-0 flex items-center justify-center">
                    <div class="h-8 w-8 ${SPINNER_CLASS}" aria-hidden="true"></div>
                </div>
            </div>
            ${multiple ? `
                <button type="button" data-gallery-prev aria-label="Foto sebelumnya" class="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button type="button" data-gallery-next aria-label="Foto berikutnya" class="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
                <span data-gallery-counter class="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white" aria-live="polite">${state.selectedPhotoIndex + 1}/${state.photos.length}</span>
            ` : ''}
        </div>
        ${multiple ? `
            <div class="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Pilih foto ruangan">
                ${state.photos.map((_photo, index) => `
                    <button type="button" data-gallery-thumb="${index}" aria-label="Lihat foto ${index + 1}" aria-pressed="${index === state?.selectedPhotoIndex}" class="h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-gray-100 transition-colors ${index === state?.selectedPhotoIndex ? 'border-teal-600' : 'border-transparent hover:border-teal-200'}"></button>
                `).join('')}
            </div>
        ` : ''}
    `;
};

const renderFacilities = (): string => {
    if (!state?.detail) return '';
    const facilities = normalizeFacilities(state.detail);

    return `
        <div class="mt-5 space-y-2">
            <p class="text-xs font-bold uppercase tracking-wider text-gray-400">Fasilitas Ruangan</p>
            ${facilities.length === 0
                ? '<p class="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-500">Fasilitas belum dicatat untuk ruangan ini.</p>'
                : `
                    <ul class="flex flex-wrap gap-2">
                        ${facilities.map((facility) => {
                            const condition = facility.condition
                                ? CONDITION_LABELS[facility.condition] ?? null
                                : null;
                            return `
                                <li class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                                    ${escapeHtml(facility.name ?? '')}${facility.quantity ? ` <span class="text-gray-400">×${facility.quantity}</span>` : ''}
                                    ${condition ? `<span class="rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${condition.chipClass}">${condition.label}</span>` : ''}
                                </li>
                            `;
                        }).join('')}
                    </ul>
                `}
        </div>
    `;
};

const renderTemplateBlock = (): string => {
    if (!state?.detail) return '';
    const template = state.detail.template;

    if (!template?.download_url) {
        return `
            <div class="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4">
                <p class="text-xs font-bold uppercase tracking-wider text-gray-400">Template Surat Peminjaman</p>
                <p class="mt-2 text-sm text-gray-500">Template belum tersedia untuk ruangan ini. Silakan hubungi pengelola ruangan.</p>
            </div>
        `;
    }

    const extensionLabel = template.mime?.includes('wordprocessingml') ? 'DOCX' : 'PDF';

    return `
        <div class="mt-5 rounded-xl border border-teal-100 bg-teal-50/50 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Template Surat Peminjaman</p>
            <p class="mt-2 break-words text-sm font-semibold text-gray-800">${escapeHtml(template.original_name ?? 'Template peminjaman')}</p>
            <p class="mt-0.5 text-xs text-gray-500">${extensionLabel}${template.version ? ` · Versi ${template.version}` : ''}${template.size_bytes ? ` · ${escapeHtml(formatFileSize(template.size_bytes))}` : ''}</p>
            <p class="mt-2 text-xs text-gray-500">Unduh template ini, lengkapi dan tanda tangani, lalu unggah sebagai PDF saat mengajukan peminjaman.</p>
            <button id="room-template-download" type="button" class="${buttonClass('outline', 'sm', 'mt-3')}">
                Unduh Template
            </button>
        </div>
    `;
};

/** Select a gallery photo by index, updating thumbs, counter, and main image. */
const goToPhoto = (index: number): void => {
    if (!state || !Number.isInteger(index) || !state.photos[index]) return;
    state.selectedPhotoIndex = index;
    document.querySelectorAll<HTMLElement>('[data-gallery-thumb]').forEach((thumb) => {
        const active = Number(thumb.dataset.galleryThumb) === index;
        thumb.setAttribute('aria-pressed', String(active));
        thumb.classList.toggle('border-teal-600', active);
        thumb.classList.toggle('border-transparent', !active);
    });
    const counter = document.querySelector('[data-gallery-counter]');
    if (counter) counter.textContent = `${index + 1}/${state.photos.length}`;
    void hydrateGalleryImage();
};

/** Move the gallery by a relative step, wrapping around the ends. */
const stepPhoto = (delta: number): void => {
    if (!state || state.photos.length < 2) return;
    const count = state.photos.length;
    goToPhoto((state.selectedPhotoIndex + delta + count) % count);
};

const attachBodyListeners = (): void => {
    document.getElementById('room-detail-apply')?.addEventListener('click', () => {
        const roomId = state?.roomId;
        const onApply = state?.options.onApply;
        closeRoomCatalogDetail();
        if (roomId && onApply) onApply(roomId);
    });

    document.querySelectorAll<HTMLElement>('[data-gallery-thumb]').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.galleryThumb);
            if (Number.isInteger(index)) goToPhoto(index);
        });
    });

    // Prev/next arrows, keyboard, and touch swipe over the main viewport.
    const viewport = document.querySelector<HTMLElement>('[data-gallery-viewport]');
    viewport?.querySelector('[data-gallery-prev]')?.addEventListener('click', () => stepPhoto(-1));
    viewport?.querySelector('[data-gallery-next]')?.addEventListener('click', () => stepPhoto(1));
    if (viewport && (state?.photos.length ?? 0) > 1) {
        viewport.tabIndex = 0;
        viewport.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); stepPhoto(-1); }
            else if (event.key === 'ArrowRight') { event.preventDefault(); stepPhoto(1); }
        });
        let touchStartX = 0;
        viewport.addEventListener('touchstart', (event) => {
            touchStartX = event.changedTouches[0]?.clientX ?? 0;
        }, { passive: true });
        viewport.addEventListener('touchend', (event) => {
            const deltaX = (event.changedTouches[0]?.clientX ?? 0) - touchStartX;
            if (Math.abs(deltaX) > 40) stepPhoto(deltaX < 0 ? 1 : -1);
        }, { passive: true });
    }

    const downloadButton = document.getElementById('room-template-download');
    downloadButton?.addEventListener('click', async () => {
        if (!state?.detail) return;
        const button = downloadButton as HTMLButtonElement;
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Menyiapkan unduhan...';
        try {
            await downloadRoomTemplate(state.detail, state.detail.template);
        } catch (error) {
            renderTemplateError(
                error instanceof Error ? error.message : 'Template peminjaman gagal diunduh.',
            );
        } finally {
            button.disabled = false;
            button.textContent = original;
        }
    });
};

const renderTemplateError = (message: string): void => {
    const button = document.getElementById('room-template-download');
    if (!button) return;
    let note = button.parentElement?.querySelector('[data-template-error]');
    if (!note) {
        note = document.createElement('p');
        note.setAttribute('data-template-error', '');
        note.className = 'mt-2 text-xs font-semibold text-red-600';
        button.parentElement?.appendChild(note);
    }
    note.textContent = message;
};

/**
 * Load an authenticated photo blob (cached per URL for the drawer's
 * lifetime) and return its object URL.
 */
const objectUrlFor = async (mediaUrl: string): Promise<string> => {
    if (!state) throw new Error('closed');
    const cached = state.objectUrls.get(mediaUrl);
    if (cached) return cached;

    const objectUrl = await fetchRoomPhotoObjectUrl(mediaUrl);
    if (!state) {
        URL.revokeObjectURL(objectUrl);
        throw new Error('closed');
    }
    state.objectUrls.set(mediaUrl, objectUrl);
    return objectUrl;
};

const hydrateGalleryImage = async (): Promise<void> => {
    if (!state?.detail) return;
    const photo = state.photos[state.selectedPhotoIndex];
    const container = document.getElementById('room-gallery-main');
    if (!photo || !container) return;

    const mediaUrl = photo.display_url ?? photo.thumb_url;
    if (!mediaUrl) return;

    const localState = state;
    try {
        const objectUrl = await objectUrlFor(mediaUrl);
        if (state !== localState) return;
        container.dataset.photoState = 'ready';
        container.innerHTML = '';
        const image = document.createElement('img');
        image.src = objectUrl;
        image.alt = `Foto ${state.detail.code} ${state.detail.name}`;
        image.className = 'h-full w-full object-cover';
        container.appendChild(image);
    } catch {
        if (state !== localState) return;
        container.dataset.photoState = 'error';
        container.innerHTML = '<p class="flex h-full items-center justify-center px-6 text-center text-xs font-semibold text-gray-500">Foto tidak dapat dimuat. Silakan coba buka ulang detail ruangan.</p>';
    }
};

const hydrateThumbStrip = async (): Promise<void> => {
    if (!state) return;
    const localState = state;

    await Promise.all(state.photos.map(async (photo, index) => {
        const button = document.querySelector<HTMLElement>(`[data-gallery-thumb="${index}"]`);
        const mediaUrl = photo.thumb_url ?? photo.display_url;
        if (!button || !mediaUrl) return;
        try {
            const objectUrl = await objectUrlFor(mediaUrl);
            if (state !== localState) return;
            const image = document.createElement('img');
            image.src = objectUrl;
            image.alt = `Foto ${index + 1}`;
            image.className = 'h-full w-full object-cover';
            button.replaceChildren(image);
        } catch {
            // Thumbnail failures stay as neutral placeholders.
        }
    }));
};
