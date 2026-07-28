import { apiFetch } from '../api-client';
import { PeminjamanApiError } from '../../mahasiswa/peminjaman/api';
import { normalizeRoom, normalizeRoomDetail } from './utils';
import type {
    FacilitySyncEntry,
    FacilityTypeOption,
    FacilityUsage,
    ManagedRoom,
    ManagedRoomDetail,
    ManagedRoomFacility,
    ManagedRoomPhoto,
    ManagedRoomTemplate,
    RoomAuditEntry,
    RoomFacilitySyncResult,
    RoomInfoPayload,
} from './types';

const BASE = '/api/room-management';

export interface RoomListFilters {
    type?: 'classroom' | 'laboratory';
    active?: boolean;
    laboratoryId?: number;
    search?: string;
}

interface ApiErrorPayload {
    message?: string;
    code?: string;
    errors?: Record<string, string[]>;
    data?: Record<string, unknown>;
}

interface Envelope<T> {
    message: string;
    data: T;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    if (!response.ok) {
        throw new PeminjamanApiError(
            payload.message || fallback,
            response.status,
            payload.code,
            payload.errors,
            payload.data,
        );
    }
    return payload as T;
}

// ─────────────────────────── rooms ───────────────────────────

export async function listManagedRooms(filters: RoomListFilters = {}): Promise<ManagedRoom[]> {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.active !== undefined) params.set('active', filters.active ? '1' : '0');
    if (filters.laboratoryId !== undefined) params.set('laboratory_id', String(filters.laboratoryId));
    if (filters.search && filters.search.trim() !== '') params.set('search', filters.search.trim());

    const query = params.toString();
    const response = await apiFetch(`${BASE}/rooms${query ? `?${query}` : ''}`);
    const rooms = (await readJson<Envelope<ManagedRoom[]>>(response, 'Gagal memuat daftar ruangan.')).data;
    return rooms.map(normalizeRoom);
}

export async function getManagedRoom(roomId: number): Promise<ManagedRoomDetail> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}`);
    return normalizeRoomDetail(
        (await readJson<Envelope<ManagedRoomDetail>>(response, 'Gagal memuat detail ruangan.')).data,
    );
}

export interface RoomBulkDeleteResult {
    deleted: { id: number; code: string }[];
    archived: { id: number; code: string; reason: string }[];
    summary: { deleted: number; archived: number; total: number };
}

/**
 * Bulk remove selected rooms. The backend hard-deletes rooms with no booking
 * history and archives (deactivates) rooms that have bookings, preserving
 * historical data + FK integrity. Returns a per-outcome summary.
 */
export async function bulkDeleteRooms(roomIds: number[]): Promise<RoomBulkDeleteResult> {
    const response = await apiFetch(`${BASE}/rooms/bulk`, {
        method: 'DELETE',
        body: JSON.stringify({ room_ids: roomIds }),
    });
    return (await readJson<Envelope<RoomBulkDeleteResult>>(response, 'Gagal menghapus ruangan.')).data;
}

export async function createManagedRoom(payload: RoomInfoPayload): Promise<ManagedRoom> {
    const response = await apiFetch(`${BASE}/rooms`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return normalizeRoom((await readJson<Envelope<ManagedRoom>>(response, 'Gagal menambahkan ruangan.')).data);
}

export async function updateManagedRoom(roomId: number, payload: RoomInfoPayload): Promise<ManagedRoom> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
    return normalizeRoom((await readJson<Envelope<ManagedRoom>>(response, 'Gagal memperbarui ruangan.')).data);
}

export async function activateManagedRoom(roomId: number): Promise<ManagedRoom> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/activate`, { method: 'POST' });
    return normalizeRoom((await readJson<Envelope<ManagedRoom>>(response, 'Gagal mengaktifkan ruangan.')).data);
}

export async function deactivateManagedRoom(roomId: number): Promise<ManagedRoom> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/deactivate`, { method: 'POST' });
    return normalizeRoom((await readJson<Envelope<ManagedRoom>>(response, 'Gagal menonaktifkan ruangan.')).data);
}

// ─────────────────────────── photos ───────────────────────────

export async function listRoomPhotos(roomId: number): Promise<ManagedRoomPhoto[]> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/photos`);
    return (await readJson<Envelope<ManagedRoomPhoto[]>>(response, 'Gagal memuat foto ruangan.')).data;
}

export async function uploadRoomPhoto(roomId: number, file: File): Promise<ManagedRoomPhoto> {
    const formData = new FormData();
    formData.append('photo', file);
    const response = await apiFetch(`${BASE}/rooms/${roomId}/photos`, {
        method: 'POST',
        body: formData,
        isFormData: true,
    });
    return (await readJson<Envelope<ManagedRoomPhoto>>(response, 'Gagal mengunggah foto.')).data;
}

export async function deleteRoomPhoto(roomId: number, photoId: number): Promise<void> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/photos/${photoId}`, { method: 'DELETE' });
    await readJson<Envelope<unknown>>(response, 'Gagal menghapus foto.');
}

export async function setRoomCover(roomId: number, photoId: number): Promise<ManagedRoomPhoto> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/photos/${photoId}/cover`, { method: 'POST' });
    return (await readJson<Envelope<ManagedRoomPhoto>>(response, 'Gagal mengubah foto sampul.')).data;
}

export async function reorderRoomPhotos(roomId: number, orderedPhotoIds: number[]): Promise<ManagedRoomPhoto[]> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/photos/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ photo_ids: orderedPhotoIds }),
    });
    return (await readJson<Envelope<ManagedRoomPhoto[]>>(response, 'Gagal mengubah urutan foto.')).data;
}

/**
 * Load a room photo through its authenticated media endpoint → object URL.
 * Only relative /api endpoint references are accepted; a raw/absolute URL is
 * rejected before any request. Callers own revocation.
 */
export async function fetchRoomPhotoObjectUrl(mediaUrl: string): Promise<string> {
    if (!mediaUrl.startsWith('/api/')) {
        throw new PeminjamanApiError('Foto ruangan tidak dapat dimuat.', 0);
    }
    const response = await apiFetch(mediaUrl, { headers: { Accept: 'image/jpeg' } });
    if (!response.ok) {
        throw new PeminjamanApiError('Foto ruangan tidak dapat dimuat.', response.status);
    }
    return URL.createObjectURL(await response.blob());
}

// ─────────────────────────── facilities ───────────────────────────

/**
 * Facility types. `activeOnly` (room-assignment dropdown) returns only active
 * types; omitting it (Master Fasilitas view) returns all with usage counts.
 */
export async function listFacilityTypes(activeOnly = false): Promise<FacilityTypeOption[]> {
    const response = await apiFetch(`${BASE}/facility-types${activeOnly ? '?active=1' : ''}`);
    return (await readJson<Envelope<FacilityTypeOption[]>>(response, 'Gagal memuat jenis fasilitas.')).data;
}

export async function createFacilityType(name: string): Promise<FacilityTypeOption> {
    const response = await apiFetch(`${BASE}/facility-types`, {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
    return (await readJson<Envelope<FacilityTypeOption>>(response, 'Gagal menambahkan jenis fasilitas.')).data;
}

export interface FacilityTypeUpdate {
    name?: string;
    is_active?: boolean;
}

export async function updateFacilityType(
    id: number,
    payload: FacilityTypeUpdate,
): Promise<FacilityTypeOption> {
    const response = await apiFetch(`${BASE}/facility-types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
    return (await readJson<Envelope<FacilityTypeOption>>(response, 'Gagal memperbarui jenis fasilitas.')).data;
}

/**
 * Hard-delete a facility type. The backend only permits this for UNUSED types;
 * a type in use returns 409 (facility_in_use) and must be archived via
 * updateFacilityType({ is_active: false }) instead.
 */
export async function deleteFacilityType(id: number): Promise<void> {
    const response = await apiFetch(`${BASE}/facility-types/${id}`, { method: 'DELETE' });
    await readJson<Envelope<unknown>>(response, 'Gagal menghapus jenis fasilitas.');
}

/**
 * Rooms that use a facility type, with counts by room type — powers the
 * Master Fasilitas "Lihat Penggunaan" drawer. SuperAdmin-only on the backend.
 */
export async function getFacilityUsage(id: number): Promise<FacilityUsage> {
    const response = await apiFetch(`${BASE}/facility-types/${id}/rooms`);
    return (await readJson<Envelope<FacilityUsage>>(response, 'Gagal memuat penggunaan fasilitas.')).data;
}

export async function getRoomFacilities(roomId: number): Promise<ManagedRoomFacility[]> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/facilities`);
    return (await readJson<Envelope<ManagedRoomFacility[]>>(response, 'Gagal memuat fasilitas ruangan.')).data;
}

export async function syncRoomFacilities(
    roomId: number,
    facilities: FacilitySyncEntry[],
): Promise<RoomFacilitySyncResult> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/facilities`, {
        method: 'PUT',
        body: JSON.stringify({ facilities }),
    });
    const payload = await readJson<Envelope<ManagedRoomFacility[]> & {
        delegated_activity_acknowledgement?: RoomFacilitySyncResult['delegated_activity_acknowledgement'];
    }>(response, 'Gagal menyimpan fasilitas.');

    return {
        data: payload.data,
        delegated_activity_acknowledgement: payload.delegated_activity_acknowledgement ?? null,
    };
}

// ─────────────────────────── templates ───────────────────────────

export async function listRoomTemplates(roomId: number): Promise<ManagedRoomTemplate[]> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/templates`);
    return (await readJson<Envelope<ManagedRoomTemplate[]>>(response, 'Gagal memuat template ruangan.')).data;
}

export async function uploadRoomTemplate(
    roomId: number,
    file: File,
    notes?: string,
): Promise<ManagedRoomTemplate> {
    const formData = new FormData();
    formData.append('template', file);
    if (notes && notes.trim() !== '') formData.append('notes', notes.trim());
    const response = await apiFetch(`${BASE}/rooms/${roomId}/templates`, {
        method: 'POST',
        body: formData,
        isFormData: true,
    });
    return (await readJson<Envelope<ManagedRoomTemplate>>(response, 'Gagal mengunggah template.')).data;
}

export async function activateRoomTemplate(roomId: number, templateId: number): Promise<ManagedRoomTemplate> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/templates/${templateId}/activate`, { method: 'POST' });
    return (await readJson<Envelope<ManagedRoomTemplate>>(response, 'Gagal mengaktifkan template.')).data;
}

export async function deactivateRoomTemplate(roomId: number, templateId: number): Promise<ManagedRoomTemplate> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/templates/${templateId}/deactivate`, { method: 'POST' });
    return (await readJson<Envelope<ManagedRoomTemplate>>(response, 'Gagal menonaktifkan template.')).data;
}

/**
 * Authenticated blob download of a specific template version → browser save.
 * Filename is built locally from the room code + template version/MIME; the
 * server filename is display metadata only. Never a raw window.open URL.
 */
export async function downloadRoomTemplate(
    room: { id: number; code: string },
    template: Pick<ManagedRoomTemplate, 'id' | 'version' | 'mime'>,
): Promise<void> {
    const response = await apiFetch(
        `${BASE}/rooms/${room.id}/templates/${template.id}/download`,
        { cache: 'no-store' },
    );
    if (!response.ok) {
        const message = response.status === 404
            ? 'Template tidak ditemukan.'
            : 'Template gagal diunduh.';
        throw new PeminjamanApiError(message, response.status);
    }

    const extension = template.mime?.includes('wordprocessingml') ? 'docx' : 'pdf';
    const safeCode = room.code.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'ruangan';
    const fileName = `template-peminjaman-${safeCode}-v${template.version}.${extension}`;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

// ─────────────────────────── audit ───────────────────────────

export async function listRoomAuditLogs(roomId: number): Promise<RoomAuditEntry[]> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}/audit-logs`);
    return (await readJson<Envelope<RoomAuditEntry[]>>(response, 'Gagal memuat riwayat ruangan.')).data;
}
