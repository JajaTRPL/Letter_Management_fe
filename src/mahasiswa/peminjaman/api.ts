import { apiFetch } from '../../shared/api-client';
import {
    isAvailabilityItem,
    isTendikOperationalOccurrence,
    isMahasiswaBooking,
    isRoom,
} from './booking-schema';
import type {
    ApiEnvelope,
    AvailabilityItem,
    BookingPayload,
    LaboratorySummary,
    MahasiswaBooking,
    Room,
    RoomDetail,
    RoomManagementPayload,
    RoomListEnvelope,
    RoomTemplateInfo,
    RoomType,
    SuperAdminBooking,
    SuperAdminCalendarEnvelope,
    SuperAdminCalendarFilters,
    SuperAdminBookingFilters,
    SuperAdminBookingListEnvelope,
    SuperAdminRoomFilters,
    TendikBooking,
    TendikBookingFilters,
    TendikCalendarEnvelope,
    TendikCalendarFilters,
    TendikBookingListEnvelope,
    TendikReviewerProfile,
    BookingOccurrence,
    TendikOperationalOccurrence,
    ValidationErrors,
} from './types';

const BASE = '/api/mahasiswa/peminjaman-ruangan';
const TENDIK_BASE = '/api/tendik/peminjaman-ruangan';
const TENDIK_REQUESTS_BASE = '/api/tendik/peminjaman-ruangan/requests';
const SUPER_ADMIN_BASE = '/api/super-admin/peminjaman-ruangan';
// Protected surat-peminjaman attachment routes (role-gated inside the backend
// controller). Built from the booking id so no storage/disk path is ever
// exposed to or trusted from the frontend.
const ATTACHMENT_BASE = '/api/peminjaman-ruangan';

export const suratPeminjamanPreviewUrl = (bookingId: number): string =>
    `${ATTACHMENT_BASE}/${bookingId}/attachment/surat-peminjaman/preview`;

export const suratPeminjamanDownloadUrl = (bookingId: number): string =>
    `${ATTACHMENT_BASE}/${bookingId}/attachment/surat-peminjaman/download`;

interface AvailabilityFilters {
    from: string;
    to: string;
    roomId?: number;
    type?: RoomType;
}

interface ApiErrorPayload {
    message?: string;
    code?: string;
    errors?: ValidationErrors;
    data?: Record<string, unknown>;
}

export class PeminjamanApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly errors?: ValidationErrors;
    readonly data?: Record<string, unknown>;

    constructor(
        message: string,
        status: number,
        code?: string,
        errors?: ValidationErrors,
        data?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'PeminjamanApiError';
        this.status = status;
        this.code = code;
        this.errors = errors;
        this.data = data;
    }
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    if (!response.ok) {
        throw new PeminjamanApiError(
            payload.message || fallbackMessage,
            response.status,
            payload.code,
            payload.errors,
            payload.data,
        );
    }

    return payload as T;
}

/**
 * Code carried by every rejection caused by a structurally invalid 2xx body.
 * Callers use it to tell "the server said no" apart from "the server said yes
 * but we cannot trust what it said" — the latter is never a confirmed success.
 */
export const MALFORMED_RESPONSE_CODE = 'malformed_response';

/** Generate a browser-cryptographic key for one initial-submission intent. */
export const generateRoomBookingIdempotencyKey = (): string => {
    if (typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return `booking-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * True when a failed mutation leaves the real server-side outcome UNKNOWN:
 * the request may or may not have been applied. Network faults, 5xx, and a
 * malformed 2xx body all qualify. A definitive 4xx rejection does not — the
 * server processed the request and declined it.
 */
export const isUncertainOutcome = (error: unknown): boolean => {
    if (error instanceof PeminjamanApiError) {
        return error.code === MALFORMED_RESPONSE_CODE
            || error.status >= 500
            || error.status === 0;
    }

    // Network/abort/unknown throw: the request may still have reached the API.
    return true;
};

/**
 * Read a list envelope and guarantee an array of VALID elements. A 2xx body
 * without the expected `data` array — or with one malformed element — is a
 * MALFORMED response, not an empty result: it must reject into the caller's
 * error branch (banner + retry) rather than resolve to `undefined` for
 * `.map()/.filter()` to crash on, or be faked into an empty list that would
 * hide a server-side failure. An empty array stays a legitimate empty result.
 */
async function readArrayData<T>(
    response: Response,
    isValidElement: (value: unknown) => value is T,
    fallbackMessage: string,
): Promise<T[]> {
    const payload = await readJson<ApiEnvelope<unknown>>(response, fallbackMessage);
    const data = payload.data;
    if (!Array.isArray(data) || !data.every(isValidElement)) {
        throw new PeminjamanApiError(
            fallbackMessage,
            response.status,
            MALFORMED_RESPONSE_CODE,
        );
    }

    return data;
}

/**
 * Same guarantee for single-object envelopes (booking detail, mutations). An
 * array or `null` in `data` is a malformed object payload, never a booking.
 */
async function readObjectData<T>(
    response: Response,
    isValid: (value: unknown) => value is T,
    fallbackMessage: string,
): Promise<T> {
    const payload = await readJson<ApiEnvelope<unknown>>(response, fallbackMessage);
    if (!isValid(payload.data)) {
        throw new PeminjamanApiError(
            fallbackMessage,
            response.status,
            MALFORMED_RESPONSE_CODE,
        );
    }

    return payload.data;
}

export async function getPeminjamanRooms(): Promise<Room[]> {
    const response = await apiFetch(`${BASE}/rooms`);
    return readArrayData(response, isRoom, 'Gagal memuat daftar ruangan aktif.');
}

export async function getPeminjamanAvailability(
    filters: AvailabilityFilters,
): Promise<AvailabilityItem[]> {
    const params = new URLSearchParams({
        from: filters.from,
        to: filters.to,
    });
    if (filters.roomId !== undefined) {
        params.set('room_id', String(filters.roomId));
    }
    if (filters.type !== undefined) {
        params.set('type', filters.type);
    }

    const response = await apiFetch(`${BASE}/availability?${params.toString()}`);
    return readArrayData(
        response,
        isAvailabilityItem,
        'Gagal memuat kalender ketersediaan ruangan.',
    );
}

export async function getPeminjamanRoomDetail(roomId: number): Promise<RoomDetail> {
    const response = await apiFetch(`${BASE}/rooms/${roomId}`);
    return (await readJson<ApiEnvelope<RoomDetail>>(
        response,
        'Gagal memuat detail ruangan.',
    )).data;
}

/**
 * Load a room photo through its authenticated media endpoint and return an
 * object URL. Only relative /api endpoint references from the backend payload
 * are accepted — anything else (accidental raw path, absolute host) is
 * rejected before any request is made. Callers own revocation.
 */
export async function fetchRoomPhotoObjectUrl(mediaUrl: string): Promise<string> {
    if (!mediaUrl.startsWith('/api/')) {
        throw new PeminjamanApiError('Foto ruangan tidak dapat dimuat.', 0);
    }

    const response = await apiFetch(mediaUrl, {
        headers: { Accept: 'image/jpeg' },
    });
    if (!response.ok) {
        throw new PeminjamanApiError('Foto ruangan tidak dapat dimuat.', response.status);
    }

    return URL.createObjectURL(await response.blob());
}

/**
 * Authenticated download of the active booking template for a room →
 * blob → browser save. Filename is built locally from the room code and the
 * template MIME; server filenames are display metadata only.
 */
export async function downloadRoomTemplate(
    room: Pick<RoomDetail, 'id' | 'code'>,
    template?: RoomTemplateInfo | null,
): Promise<void> {
    const response = await apiFetch(`${BASE}/rooms/${room.id}/template`, {
        cache: 'no-store',
    });
    if (!response.ok) {
        const message = response.status === 404
            ? 'Template peminjaman belum tersedia untuk ruangan ini.'
            : 'Template peminjaman gagal diunduh.';
        throw new PeminjamanApiError(message, response.status);
    }

    const extension = template?.mime?.includes('wordprocessingml') ? 'docx' : 'pdf';
    const safeCode = room.code.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'ruangan';
    const fileName = `template-peminjaman-${safeCode}.${extension}`;

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

export async function getMahasiswaBookings(): Promise<MahasiswaBooking[]> {
    const response = await apiFetch(`${BASE}/requests`);
    return readArrayData(
        response,
        isMahasiswaBooking,
        'Gagal memuat daftar pengajuan peminjaman.',
    );
}

export async function getMahasiswaBooking(id: number): Promise<MahasiswaBooking> {
    const response = await apiFetch(`${BASE}/requests/${id}`);
    return readObjectData(
        response,
        isMahasiswaBooking,
        'Gagal memuat detail pengajuan peminjaman.',
    );
}

export async function createMahasiswaBooking(
    payload: BookingPayload,
    suratPdf: File,
    idempotencyKey: string,
): Promise<MahasiswaBooking> {
    const formData = new FormData();
    formData.append('idempotency_key', idempotencyKey);
    formData.append('room_id', String(payload.room_id));
    formData.append('activity_name', payload.activity_name);
    formData.append('purpose', payload.purpose);
    formData.append('participant_count', String(payload.participant_count));
    formData.append('start_at', payload.start_at);
    formData.append('end_at', payload.end_at);
    formData.append('booking_mode', payload.booking_mode ?? 'single_day');
    if (payload.occurrence_end_date) {
        formData.append('occurrence_end_date', payload.occurrence_end_date);
    }
    formData.append('surat_peminjaman_pdf', suratPdf);

    const response = await apiFetch(`${BASE}/requests`, {
        method: 'POST',
        body: formData,
        isFormData: true,
    });
    // A create is only "successful" when the server hands back a booking we can
    // actually show. A 2xx with an unusable body means we cannot tell whether
    // the booking exists — the caller must treat that as an uncertain outcome,
    // never as a confirmed submission.
    return readObjectData(
        response,
        isMahasiswaBooking,
        'Gagal membuat pengajuan peminjaman.',
    );
}

const readMutationBooking = async (
    response: Response,
    fallback: string,
): Promise<MahasiswaBooking> => {
    const envelope = await readJson<ApiEnvelope<unknown>>(response, fallback);
    if (!envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {
        throw new PeminjamanApiError(fallback, response.status, MALFORMED_RESPONSE_CODE);
    }
    const booking = (envelope.data as Record<string, unknown>).booking;
    if (!isMahasiswaBooking(booking)) {
        throw new PeminjamanApiError(fallback, response.status, MALFORMED_RESPONSE_CODE);
    }
    return booking;
};

export async function submitRoomReturnEvidence(
    occurrence: BookingOccurrence,
    evidence: File,
    idempotencyKey: string,
): Promise<MahasiswaBooking> {
    const body = new FormData();
    body.append('expected_occurrence_version', String(occurrence.version));
    body.append('idempotency_key', idempotencyKey);
    body.append('evidence', evidence);
    const response = await apiFetch(`${BASE}/occurrences/${encodeURIComponent(occurrence.occurrence_ref)}/return`, {
        method: 'POST', body, isFormData: true,
    });
    return readMutationBooking(response, 'Bukti pengembalian gagal dikirim.');
}

export async function withdrawRoomReturn(
    occurrence: BookingOccurrence,
    idempotencyKey: string,
): Promise<MahasiswaBooking> {
    if (!occurrence.return) throw new PeminjamanApiError('Pengembalian aktif tidak ditemukan.', 409);
    const response = await apiFetch(`${BASE}/occurrences/${encodeURIComponent(occurrence.occurrence_ref)}/return/withdraw`, {
        method: 'POST',
        body: JSON.stringify({
            expected_occurrence_version: occurrence.version,
            expected_return_version: occurrence.return.version,
            idempotency_key: idempotencyKey,
        }),
    });
    return readMutationBooking(response, 'Pengajuan pengembalian gagal ditarik.');
}

export async function fetchReturnEvidenceObjectUrl(url: string): Promise<string> {
    if (!url.startsWith('/api/peminjaman-ruangan/returns/')) {
        throw new PeminjamanApiError('Bukti pengembalian tidak dapat dimuat.', 0);
    }
    const response = await apiFetch(url, { cache: 'no-store' });
    if (!response.ok) throw new PeminjamanApiError('Bukti pengembalian tidak dapat dimuat.', response.status);
    return URL.createObjectURL(await response.blob());
}

export async function getTendikOperationalOccurrences(
    tab: 'today' | 'key_handover' | 'returns' | 'overdue' | 'all',
): Promise<TendikOperationalOccurrence[]> {
    const response = await apiFetch(`${TENDIK_BASE}/operations?tab=${tab}`);
    return readArrayData(
        response,
        isTendikOperationalOccurrence,
        'Daftar operasional penggunaan ruangan gagal dimuat.',
    );
}

export async function issueRoomKey(
    occurrence: TendikOperationalOccurrence,
    note: string,
    idempotencyKey: string,
): Promise<MahasiswaBooking> {
    const response = await apiFetch(`${TENDIK_BASE}/operations/${encodeURIComponent(occurrence.occurrence_ref)}/issue-key`, {
        method: 'POST',
        body: JSON.stringify({
            expected_occurrence_version: occurrence.version,
            note: note.trim() || null,
            idempotency_key: idempotencyKey,
        }),
    });
    return readMutationBooking(response, 'Penyerahan kunci gagal disimpan.');
}

export async function decideRoomReturn(
    occurrence: TendikOperationalOccurrence,
    decision: 'accept' | 'revise' | 'reject',
    input: { note: string; keyReceivedAt?: string; receivedTimeReason?: string },
    idempotencyKey: string,
): Promise<MahasiswaBooking> {
    if (!occurrence.return) throw new PeminjamanApiError('Bukti pengembalian tidak ditemukan.', 409);
    const response = await apiFetch(`${TENDIK_BASE}/operations/${encodeURIComponent(occurrence.occurrence_ref)}/return/${decision}`, {
        method: 'POST',
        body: JSON.stringify({
            expected_occurrence_version: occurrence.version,
            expected_return_version: occurrence.return.version,
            note: input.note.trim() || null,
            key_received_at: input.keyReceivedAt || null,
            received_time_change_reason: input.receivedTimeReason?.trim() || null,
            idempotency_key: idempotencyKey,
        }),
    });
    return readMutationBooking(response, 'Keputusan pengembalian gagal disimpan.');
}

/**
 * Replace (or upload the first) surat peminjaman PDF for a revision. Dedicated
 * multipart route — the normal PUT edit stays file-free. Backend enforces
 * owner + revision_requested.
 */
export async function replaceSuratPeminjamanPdf(
    bookingId: number,
    suratPdf: File,
): Promise<MahasiswaBooking> {
    const formData = new FormData();
    formData.append('surat_peminjaman_pdf', suratPdf);

    const response = await apiFetch(
        `${BASE}/${bookingId}/attachment/surat-peminjaman`,
        { method: 'POST', body: formData, isFormData: true },
    );
    return readObjectData(
        response,
        isMahasiswaBooking,
        'Gagal mengganti surat peminjaman.',
    );
}

/**
 * Authenticated download of the surat PDF via the protected route → blob →
 * browser save. Never uses a raw public storage URL. Throws PeminjamanApiError with a
 * user-facing message on 403/404/other.
 */
export async function downloadSuratPeminjamanPdf(
    bookingId: number,
    fileName = 'surat-peminjaman.pdf',
): Promise<void> {
    const response = await apiFetch(suratPeminjamanDownloadUrl(bookingId), {
        cache: 'no-store',
        headers: { Accept: 'application/pdf' },
    });
    if (!response.ok) {
        const message = response.status === 403
            ? 'Anda tidak berwenang mengunduh surat ini.'
            : response.status === 404
                ? 'Surat peminjaman tidak ditemukan.'
                : 'Surat peminjaman gagal diunduh.';
        throw new PeminjamanApiError(message, response.status);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName || 'surat-peminjaman.pdf';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

export async function updateMahasiswaBooking(
    id: number,
    payload: BookingPayload,
): Promise<MahasiswaBooking> {
    const response = await apiFetch(`${BASE}/requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    return readObjectData(
        response,
        isMahasiswaBooking,
        'Gagal memperbarui pengajuan peminjaman.',
    );
}

export async function resubmitMahasiswaBooking(id: number): Promise<MahasiswaBooking> {
    const response = await apiFetch(`${BASE}/requests/${id}/submit`, {
        method: 'PATCH',
    });
    return readObjectData(
        response,
        isMahasiswaBooking,
        'Gagal mengirim ulang pengajuan peminjaman.',
    );
}

/**
 * Requester withdrawal — the single canonical "tarik pengajuan" path (C9
 * unified cancel→withdraw). Idempotent: the caller passes a stable key so a
 * retry after an ambiguous network failure replays the first result instead of
 * acting twice. `expected_workflow_version` gives optimistic-concurrency
 * protection so a stale tab cannot withdraw against a moved-on booking.
 */
export async function withdrawMahasiswaBooking(
    booking: MahasiswaBooking,
    reason: string,
    idempotencyKey: string,
): Promise<MahasiswaBooking> {
    const response = await apiFetch(`${BASE}/requests/${booking.id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({
            reason,
            expected_workflow_version: booking.workflow_version ?? 1,
            idempotency_key: idempotencyKey,
        }),
    });
    return readMutationBooking(response, 'Gagal menarik pengajuan peminjaman.');
}

export async function getTendikReviewerProfile(): Promise<TendikReviewerProfile> {
    const response = await apiFetch('/api/profile', { cache: 'no-store' });
    const payload = await readJson<{ user?: TendikReviewerProfile }>(
        response,
        'Gagal memuat profil reviewer.',
    );
    return payload.user ?? {};
}

export async function getTendikBookings(
    filters: TendikBookingFilters = {},
): Promise<TendikBookingListEnvelope> {
    const params = new URLSearchParams();
    if (filters.status !== undefined) params.set('status', filters.status);
    if (filters.roomType !== undefined) params.set('room_type', filters.roomType);
    if (filters.roomId !== undefined) params.set('room_id', String(filters.roomId));
    if (filters.dateFrom !== undefined) params.set('date_from', filters.dateFrom);
    if (filters.dateTo !== undefined) params.set('date_to', filters.dateTo);
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.perPage !== undefined) params.set('per_page', String(filters.perPage));

    const query = params.toString();
    const response = await apiFetch(`${TENDIK_REQUESTS_BASE}${query ? `?${query}` : ''}`);
    return readJson<TendikBookingListEnvelope>(
        response,
        'Gagal memuat antrean review peminjaman.',
    );
}

export async function getTendikBooking(id: number): Promise<TendikBooking> {
    const response = await apiFetch(`${TENDIK_REQUESTS_BASE}/${id}`);
    return (await readJson<ApiEnvelope<TendikBooking>>(
        response,
        'Gagal memuat detail review peminjaman.',
    )).data;
}

export async function getTendikBookingCalendar(
    filters: TendikCalendarFilters = {},
): Promise<TendikCalendarEnvelope> {
    const params = new URLSearchParams();
    if (filters.month !== undefined) params.set('month', filters.month);
    if (filters.from !== undefined) params.set('from', filters.from);
    if (filters.to !== undefined) params.set('to', filters.to);
    if (filters.status !== undefined) params.set('status', filters.status);
    if (filters.roomType !== undefined) params.set('room_type', filters.roomType);
    if (filters.roomId !== undefined) params.set('room_id', String(filters.roomId));
    if (filters.laboratoryId !== undefined) {
        params.set('laboratory_id', String(filters.laboratoryId));
    }

    const query = params.toString();
    const response = await apiFetch(`${TENDIK_BASE}/calendar${query ? `?${query}` : ''}`);
    return readJson<TendikCalendarEnvelope>(
        response,
        'Gagal memuat kalender review peminjaman.',
    );
}

export async function approveTendikBooking(id: number): Promise<TendikBooking> {
    const response = await apiFetch(`${TENDIK_REQUESTS_BASE}/${id}/approve`, {
        method: 'PATCH',
    });
    return (await readJson<ApiEnvelope<TendikBooking>>(
        response,
        'Gagal menyetujui peminjaman ruangan.',
    )).data;
}

export async function reviseTendikBooking(
    id: number,
    note: string,
): Promise<TendikBooking> {
    const response = await apiFetch(`${TENDIK_REQUESTS_BASE}/${id}/revise`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
    });
    return (await readJson<ApiEnvelope<TendikBooking>>(
        response,
        'Gagal mengirim permintaan revisi.',
    )).data;
}

export async function rejectTendikBooking(
    id: number,
    reason: string,
): Promise<TendikBooking> {
    const response = await apiFetch(`${TENDIK_REQUESTS_BASE}/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
    });
    return (await readJson<ApiEnvelope<TendikBooking>>(
        response,
        'Gagal menolak peminjaman ruangan.',
    )).data;
}

export async function getSuperAdminRooms(
    filters: SuperAdminRoomFilters = {},
): Promise<Room[]> {
    const params = new URLSearchParams();
    if (filters.type !== undefined) params.set('type', filters.type);
    if (filters.laboratoryId !== undefined) {
        params.set('laboratory_id', String(filters.laboratoryId));
    }
    if (filters.search !== undefined && filters.search.trim() !== '') {
        params.set('search', filters.search.trim());
    }
    if (filters.active !== undefined) params.set('active', filters.active ? '1' : '0');

    const query = params.toString();
    const response = await apiFetch(`${SUPER_ADMIN_BASE}/rooms${query ? `?${query}` : ''}`);
    return (await readJson<RoomListEnvelope>(
        response,
        'Gagal memuat daftar ruangan.',
    )).data;
}

export async function getSuperAdminRoom(id: number): Promise<Room> {
    const response = await apiFetch(`${SUPER_ADMIN_BASE}/rooms/${id}`);
    return (await readJson<ApiEnvelope<Room>>(
        response,
        'Gagal memuat detail ruangan.',
    )).data;
}

export async function createSuperAdminRoom(
    payload: RoomManagementPayload,
): Promise<Room> {
    const response = await apiFetch(`${SUPER_ADMIN_BASE}/rooms`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return (await readJson<ApiEnvelope<Room>>(
        response,
        'Gagal membuat ruangan.',
    )).data;
}

export async function updateSuperAdminRoom(
    id: number,
    payload: RoomManagementPayload,
): Promise<Room> {
    const response = await apiFetch(`${SUPER_ADMIN_BASE}/rooms/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    return (await readJson<ApiEnvelope<Room>>(
        response,
        'Gagal memperbarui ruangan.',
    )).data;
}

export async function activateSuperAdminRoom(id: number): Promise<Room> {
    const response = await apiFetch(`${SUPER_ADMIN_BASE}/rooms/${id}/activate`, {
        method: 'PATCH',
    });
    return (await readJson<ApiEnvelope<Room>>(
        response,
        'Gagal mengaktifkan ruangan.',
    )).data;
}

export async function deactivateSuperAdminRoom(id: number): Promise<Room> {
    const response = await apiFetch(`${SUPER_ADMIN_BASE}/rooms/${id}/deactivate`, {
        method: 'PATCH',
    });
    return (await readJson<ApiEnvelope<Room>>(
        response,
        'Gagal menonaktifkan ruangan.',
    )).data;
}

export async function getSuperAdminLaboratories(): Promise<LaboratorySummary[]> {
    const response = await apiFetch('/api/laboratories');
    return readJson<LaboratorySummary[]>(
        response,
        'Gagal memuat daftar laboratorium.',
    );
}

export async function getSuperAdminBookings(
    filters: SuperAdminBookingFilters = {},
): Promise<SuperAdminBookingListEnvelope> {
    const params = new URLSearchParams();
    if (filters.status !== undefined) params.set('status', filters.status);
    if (filters.roomType !== undefined) params.set('room_type', filters.roomType);
    if (filters.roomId !== undefined) params.set('room_id', String(filters.roomId));
    if (filters.dateFrom !== undefined) params.set('date_from', filters.dateFrom);
    if (filters.dateTo !== undefined) params.set('date_to', filters.dateTo);
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.perPage !== undefined) params.set('per_page', String(filters.perPage));

    const query = params.toString();
    const response = await apiFetch(`${SUPER_ADMIN_BASE}/requests${query ? `?${query}` : ''}`);
    return readJson<SuperAdminBookingListEnvelope>(
        response,
        'Gagal memuat monitoring peminjaman.',
    );
}

export async function getSuperAdminBookingCalendar(
    filters: SuperAdminCalendarFilters = {},
): Promise<SuperAdminCalendarEnvelope> {
    const params = new URLSearchParams();
    if (filters.month !== undefined) params.set('month', filters.month);
    if (filters.from !== undefined) params.set('from', filters.from);
    if (filters.to !== undefined) params.set('to', filters.to);
    if (filters.status !== undefined) params.set('status', filters.status);
    if (filters.roomType !== undefined) params.set('room_type', filters.roomType);
    if (filters.roomId !== undefined) params.set('room_id', String(filters.roomId));
    if (filters.laboratoryId !== undefined) {
        params.set('laboratory_id', String(filters.laboratoryId));
    }

    const query = params.toString();
    const response = await apiFetch(`${SUPER_ADMIN_BASE}/calendar${query ? `?${query}` : ''}`);
    return readJson<SuperAdminCalendarEnvelope>(
        response,
        'Gagal memuat kalender peminjaman.',
    );
}

export async function getSuperAdminBooking(id: number): Promise<SuperAdminBooking> {
    const response = await apiFetch(`${SUPER_ADMIN_BASE}/requests/${id}`);
    return (await readJson<ApiEnvelope<SuperAdminBooking>>(
        response,
        'Gagal memuat detail monitoring peminjaman.',
    )).data;
}
