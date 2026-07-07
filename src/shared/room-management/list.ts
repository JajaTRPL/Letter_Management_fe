import {
    escapeHtml,
    roomMissingFacilities,
    roomMissingPhoto,
    roomMissingTemplate,
} from './utils';
import { getRoomTypeLabel } from '../peminjaman-calendar';
import { fetchRoomPhotoObjectUrl } from './api';
import type { ManagedRoom } from './types';

/**
 * Renders the role-scoped room table body used by both the SuperAdmin master
 * tab and the Tendik "Kelola Ruangan" tab. Cover thumbnails hydrate through
 * the authenticated media endpoint (never a raw storage URL); data-health
 * badges surface rooms missing photos/facilities/templates.
 *
 * Row action is a single "Kelola" button — the drawer itself gates every
 * mutation by the backend flags, so the list never needs role logic.
 */

const healthBadge = (label: string): string =>
    `<span class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">${escapeHtml(label)}</span>`;

const PLACEHOLDER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>';

export const renderRoomManagementTable = (rooms: ManagedRoom[]): string => `
    <div class="overflow-x-auto" data-room-mgmt-table>
        <table class="min-w-[820px] w-full text-left">
            <thead class="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                <tr>
                    <th class="px-5 py-4">Ruangan</th>
                    <th class="px-5 py-4">Jenis</th>
                    <th class="px-5 py-4">Kapasitas</th>
                    <th class="px-5 py-4">Status</th>
                    <th class="px-5 py-4">Kelengkapan</th>
                    <th class="px-5 py-4"></th>
                </tr>
            </thead>
            <tbody>
                ${rooms.map((room) => {
                    const coverUrl = room.cover_photo?.thumb_url ?? room.cover_photo?.display_url ?? null;
                    return `
                    <tr class="border-b border-gray-100 last:border-0">
                        <td class="px-5 py-4 align-top">
                            <div class="flex items-start gap-3">
                                <div data-room-cover${coverUrl ? ` data-cover-url="${escapeHtml(coverUrl)}"` : ''} class="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-300">${PLACEHOLDER}</div>
                                <div class="min-w-0">
                                    <p class="break-words text-sm font-bold text-gray-800">${escapeHtml(room.code)} · ${escapeHtml(room.name)}</p>
                                    <p class="mt-0.5 truncate text-xs text-gray-500">${escapeHtml(room.location)}</p>
                                    ${room.owning_laboratory ? `<p class="mt-0.5 text-[11px] text-gray-400">${escapeHtml(room.owning_laboratory.code)} · ${escapeHtml(room.owning_laboratory.name)}</p>` : ''}
                                </div>
                            </div>
                        </td>
                        <td class="px-5 py-4 align-top text-sm font-semibold text-gray-700">${escapeHtml(getRoomTypeLabel(room.type))}</td>
                        <td class="px-5 py-4 align-top text-sm text-gray-600">${room.capacity} orang</td>
                        <td class="px-5 py-4 align-top">
                            <span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${room.is_active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-600'}">${room.is_active ? 'Aktif' : 'Nonaktif'}</span>
                        </td>
                        <td class="px-5 py-4 align-top">
                            <div class="flex flex-wrap gap-1.5">
                                ${roomMissingPhoto(room) ? healthBadge('Belum ada foto') : ''}
                                ${roomMissingFacilities(room) ? healthBadge('Belum ada fasilitas') : ''}
                                ${roomMissingTemplate(room) ? healthBadge('Belum ada template') : ''}
                                ${!roomMissingPhoto(room) && !roomMissingFacilities(room) && !roomMissingTemplate(room) ? '<span class="text-[11px] font-semibold text-emerald-600">Lengkap</span>' : ''}
                            </div>
                        </td>
                        <td class="px-5 py-4 text-right align-top">
                            <button type="button" data-room-mgmt-open="${room.id}" class="rounded-xl border border-teal-700 px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50">Kelola</button>
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    </div>
`;

/**
 * Hydrate list cover thumbnails after the table is in the DOM. Object URLs are
 * cached in the caller-provided map so they can be revoked on page teardown.
 */
export const hydrateRoomTableCovers = (
    container: ParentNode,
    cache: Map<string, string>,
    isCurrent: () => boolean,
): void => {
    container.querySelectorAll<HTMLElement>('[data-room-cover][data-cover-url]').forEach((cell) => {
        const mediaUrl = cell.dataset.coverUrl;
        if (!mediaUrl) return;

        const apply = (objectUrl: string): void => {
            if (!cell.isConnected || !isCurrent()) return;
            const image = document.createElement('img');
            image.src = objectUrl;
            image.alt = 'Foto ruangan';
            image.loading = 'lazy';
            image.className = 'h-full w-full object-cover';
            cell.replaceChildren(image);
        };

        const cached = cache.get(mediaUrl);
        if (cached) { apply(cached); return; }

        void fetchRoomPhotoObjectUrl(mediaUrl)
            .then((objectUrl) => { cache.set(mediaUrl, objectUrl); apply(objectUrl); })
            .catch(() => { /* keep placeholder */ });
    });
};

export const attachRoomTableListeners = (
    container: ParentNode,
    onOpen: (roomId: number) => void,
): void => {
    container.querySelectorAll<HTMLElement>('[data-room-mgmt-open]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.roomMgmtOpen);
            if (Number.isInteger(id) && id > 0) onOpen(id);
        });
    });
};
