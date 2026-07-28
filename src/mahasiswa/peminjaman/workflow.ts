import {
    formatIsoDateKeyInJakarta,
} from '../../shared/peminjaman-calendar';
import type {
    BookingPayload,
    BookingMode,
    MahasiswaBooking,
    Room,
} from './types';

export interface BookingFormValues {
    roomId: string;
    date: string;
    bookingMode: BookingMode;
    endDate: string;
    startTime: string;
    endTime: string;
    activityName: string;
    purpose: string;
    participantCount: string;
}

export type BookingFormErrors = Partial<Record<keyof BookingFormValues | 'form', string>>;

export const emptyBookingFormValues = (
    roomId = '',
    date = '',
): BookingFormValues => ({
    roomId,
    date,
    bookingMode: 'single_day',
    endDate: '',
    startTime: '',
    endTime: '',
    activityName: '',
    purpose: '',
    participantCount: '',
});

const jakartaTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

export const bookingToFormValues = (
    booking: MahasiswaBooking,
): BookingFormValues => ({
    roomId: String(booking.room.id),
    date: formatIsoDateKeyInJakarta(booking.start_at),
    bookingMode: booking.booking_mode ?? 'single_day',
    endDate: booking.occurrence_end_date ?? formatIsoDateKeyInJakarta(booking.start_at),
    startTime: jakartaTimeFormatter.format(new Date(booking.start_at)),
    endTime: jakartaTimeFormatter.format(new Date(booking.end_at)),
    activityName: booking.activity_name,
    purpose: booking.purpose,
    participantCount: String(booking.participant_count),
});

export const validateBookingForm = (
    values: BookingFormValues,
    rooms: readonly Room[],
    todayKey: string,
): BookingFormErrors => {
    const errors: BookingFormErrors = {};
    const selectedRoom = rooms.find((room) => String(room.id) === values.roomId);
    const participants = Number(values.participantCount);

    if (!selectedRoom) errors.roomId = 'Pilih ruangan aktif.';
    if (!values.date) {
        errors.date = 'Tanggal peminjaman wajib diisi.';
    } else if (values.date < todayKey) {
        errors.date = 'Tanggal peminjaman tidak boleh sudah lewat.';
    }
    if (values.bookingMode === 'consecutive_days') {
        if (!values.endDate) {
            errors.endDate = 'Tanggal selesai wajib diisi.';
        } else if (values.date && values.endDate < values.date) {
            errors.endDate = 'Tanggal selesai harus sama atau setelah tanggal mulai.';
        } else if (values.date && inclusiveDayCount(values.date, values.endDate) > MAX_CONSECUTIVE_DAYS) {
            errors.endDate = `Rentang peminjaman maksimal ${MAX_CONSECUTIVE_DAYS} hari berturut-turut.`;
        }
    }
    if (!values.startTime) errors.startTime = 'Waktu mulai wajib diisi.';
    if (!values.endTime) errors.endTime = 'Waktu selesai wajib diisi.';
    if (!values.activityName.trim()) errors.activityName = 'Nama kegiatan wajib diisi.';
    if (!values.purpose.trim()) errors.purpose = 'Tujuan peminjaman wajib diisi.';

    if (!Number.isInteger(participants) || participants < 1) {
        errors.participantCount = 'Jumlah peserta minimal 1 orang.';
    } else if (selectedRoom && participants > selectedRoom.capacity) {
        errors.participantCount = `Jumlah peserta melebihi kapasitas ${selectedRoom.capacity} orang.`;
    }

    if (values.startTime && values.endTime) {
        if (values.startTime === values.endTime) {
            errors.endTime = 'Waktu mulai dan selesai tidak boleh sama.';
        }
    }

    return errors;
};

const jakartaOffsetIso = (date: string, time: string): string =>
    `${date}T${time}:00+07:00`;

export const MAX_CONSECUTIVE_DAYS = 14;

const addDaysToDateKey = (dateKey: string, days: number): string => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
};

export const inclusiveDayCount = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(`${startDate}T00:00:00Z`).getTime();
    const end = new Date(`${endDate}T00:00:00Z`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
    return Math.floor((end - start) / 86_400_000) + 1;
};

export interface BookingOccurrenceDraft {
    sequence: number;
    date: string;
    startAt: string;
    endAt: string;
    durationHours: number;
}

export const buildOccurrenceDrafts = (
    values: BookingFormValues,
): BookingOccurrenceDraft[] => {
    const lastDate = values.bookingMode === 'consecutive_days' ? values.endDate : values.date;
    const count = inclusiveDayCount(values.date, lastDate);
    if (!values.date || !values.startTime || !values.endTime || count < 1) return [];
    const overnight = values.endTime <= values.startTime;
    const startMinutes = Number(values.startTime.slice(0, 2)) * 60 + Number(values.startTime.slice(3, 5));
    const endMinutes = Number(values.endTime.slice(0, 2)) * 60 + Number(values.endTime.slice(3, 5));
    const durationMinutes = (overnight ? 24 * 60 : 0) + endMinutes - startMinutes;

    return Array.from({ length: count }, (_, index) => {
        const date = addDaysToDateKey(values.date, index);
        const endDate = overnight ? addDaysToDateKey(date, 1) : date;
        return {
            sequence: index + 1,
            date,
            startAt: jakartaOffsetIso(date, values.startTime),
            endAt: jakartaOffsetIso(endDate, values.endTime),
            durationHours: durationMinutes / 60,
        };
    });
};

export const bookingFormToPayload = (
    values: BookingFormValues,
): BookingPayload => {
    const occurrences = buildOccurrenceDrafts(values);
    const first = occurrences[0];
    const last = occurrences[occurrences.length - 1];
    return {
        room_id: Number(values.roomId),
        activity_name: values.activityName.trim(),
        purpose: values.purpose.trim(),
        participant_count: Number(values.participantCount),
        start_at: first?.startAt ?? jakartaOffsetIso(values.date, values.startTime),
        end_at: last?.endAt ?? jakartaOffsetIso(values.date, values.endTime),
        booking_mode: values.bookingMode,
        ...(values.bookingMode === 'consecutive_days'
            ? { occurrence_end_date: values.endDate }
            : {}),
    };
};

/**
 * Presentation gate only: prefer the backend's actor-specific capability
 * projection; fall back to the legacy status rule for pre-C7B2 payloads.
 * Backend authorization always re-validates the mutation itself.
 */
export const canEditBooking = (booking: MahasiswaBooking): boolean =>
    booking.capabilities
        ? booking.capabilities.can_edit
        : booking.status === 'revision_requested';

export const canResubmitBooking = (booking: MahasiswaBooking): boolean =>
    booking.capabilities
        ? booking.capabilities.can_resubmit
        : booking.status === 'revision_requested';

// ── Surat peminjaman PDF (uploaded, never generated) ───────────────────────
export const MAX_SURAT_PDF_BYTES = 5 * 1024 * 1024;

/**
 * Client-side PDF guard — UX help only; the backend remains the source of
 * truth. Returns an Indonesian error message or null when the file is valid.
 *
 * The browser's MIME is authoritative when it reports one: a file the OS calls
 * `image/png` is not a PDF just because it was renamed to `.pdf`. The `.pdf`
 * extension is only a fallback for the browsers/platforms that hand us an
 * empty type for a locally-picked file.
 */
export const validateSuratPdfFile = (file: File | null): string | null => {
    if (!file) return 'Surat peminjaman (PDF) wajib diunggah.';
    const mime = (file.type ?? '').trim().toLowerCase();
    const isPdf = mime === 'application/pdf'
        || (mime === '' && /\.pdf$/i.test(file.name));
    if (!isPdf) return 'Berkas harus berupa PDF.';
    if (file.size > MAX_SURAT_PDF_BYTES) return 'Ukuran berkas melebihi 5 MB.';
    return null;
};

// ── Cancellation reason ────────────────────────────────────────────────────
/** Backend maximum for a cancellation reason (`max:2000`). */
export const MAX_CANCELLATION_REASON_LENGTH = 2000;

export const validateCancellationReason = (reason: string): string | null => {
    const trimmed = reason.trim();
    if (!trimmed) return 'Alasan pembatalan wajib diisi.';
    if (trimmed.length > MAX_CANCELLATION_REASON_LENGTH) {
        return `Alasan pembatalan maksimal ${MAX_CANCELLATION_REASON_LENGTH} karakter.`;
    }
    return null;
};

/**
 * Replacing the uploaded surat is only allowed while a revision is requested
 * and no cancellation request is pending (the backend guards the same rule
 * under lock; this only prevents an obviously doomed upload attempt).
 */
export const canReplaceSuratPdf = (booking: MahasiswaBooking): boolean =>
    booking.status === 'revision_requested'
    && booking.cancellation_pending !== true;

/** True when the API reports an uploaded surat PDF; safe for legacy rows. */
export const hasSuratPeminjamanPdf = (booking: MahasiswaBooking): boolean => {
    const meta = booking.surat_peminjaman_pdf;
    return Boolean(meta && (meta.exists ?? meta.has_surat_peminjaman_pdf));
};

export const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const canCancelBooking = (
    booking: MahasiswaBooking,
    now = new Date(),
): boolean => {
    // C7B2 payloads: can_cancel is the backend's direct-withdrawal
    // eligibility — the exact rule the legacy cancel endpoint now enforces.
    if (booking.capabilities) {
        return booking.capabilities.can_cancel;
    }

    if (booking.status === 'submitted' || booking.status === 'revision_requested') {
        return true;
    }

    return booking.status === 'approved'
        && new Date(booking.start_at).getTime() > now.getTime();
};

// ── C7B2 lifecycle presentation helpers ────────────────────────────────────

/**
 * The status the applicant should primarily see: the backend's effective
 * status when present (under_review/expired/completed refinements), else the
 * stored status.
 */
export const bookingLifecycleStatus = (booking: MahasiswaBooking): string =>
    booking.effective_status ?? booking.status;

/**
 * Indonesian labels covering stored + derived statuses, with a safe fallback
 * for values this build does not know yet (never render a raw enum).
 */
export const getLifecycleStatusLabel = (status: string): string => {
    switch (status) {
        case 'submitted':
            return 'Diajukan';
        case 'under_review':
            return 'Sedang Ditinjau';
        case 'revision_requested':
            return 'Perlu Revisi';
        case 'approved':
            return 'Disetujui';
        case 'rejected':
            return 'Ditolak';
        case 'cancelled':
            return 'Dibatalkan';
        case 'expired':
            return 'Kedaluwarsa';
        case 'completed':
            return 'Selesai';
        default:
            return 'Status Tidak Dikenal';
    }
};

/**
 * "Active" for the applicant = still in flight. Derived from the authoritative
 * lifecycle status, so a booking the backend already calls expired/completed
 * drops out of the active surfaces even though its stored status is still
 * `approved`.
 */
export const isActiveLifecycleBooking = (
    booking: MahasiswaBooking,
    now = new Date(),
): boolean => {
    const status = bookingLifecycleStatus(booking);
    if (status === 'submitted'
        || status === 'under_review'
        || status === 'revision_requested') {
        return true;
    }
    if (status !== 'approved') return false;

    // Legacy payloads carry no effective_status: fall back to the schedule.
    return new Date(booking.end_at).getTime() >= now.getTime();
};

export const getLifecycleStatusTone = (status: string): string => {
    switch (status) {
        case 'submitted':
            return 'bg-blue-50 text-blue-700 border-blue-100';
        case 'under_review':
            return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        case 'revision_requested':
            return 'bg-amber-50 text-amber-700 border-amber-100';
        case 'approved':
            return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        case 'rejected':
            return 'bg-red-50 text-red-700 border-red-100';
        case 'cancelled':
            return 'bg-gray-100 text-gray-600 border-gray-200';
        case 'expired':
            return 'bg-gray-50 text-gray-500 border-gray-200';
        case 'completed':
            return 'bg-teal-50 text-teal-700 border-teal-100';
        default:
            return 'bg-gray-50 text-gray-600 border-gray-200';
    }
};

export interface LifecycleTimelineEntry {
    label: string;
    at: string | null;
    note: string | null;
}

/**
 * Read-only applicant timeline assembled ONLY from fields the API actually
 * returns: stored status-history rows, the review-start timestamp, and the
 * cancellation-request summary. No event is invented from the current status.
 */
export const buildLifecycleTimeline = (
    booking: MahasiswaBooking,
): LifecycleTimelineEntry[] => {
    const entries: LifecycleTimelineEntry[] = [];

    (booking.status_histories ?? []).forEach((history) => {
        let label: string;
        switch (history.to_status) {
            case 'submitted':
                label = history.from_status === 'revision_requested'
                    ? 'Diajukan ulang'
                    : 'Pengajuan dikirim';
                break;
            case 'revision_requested':
                label = 'Revisi diminta';
                break;
            case 'approved':
                label = 'Disetujui';
                break;
            case 'rejected':
                label = 'Ditolak';
                break;
            case 'cancelled':
                label = booking.cancellation_source === 'request_approved'
                    ? 'Pembatalan disetujui'
                    : 'Pengajuan dibatalkan';
                break;
            default:
                label = getLifecycleStatusLabel(history.to_status);
        }
        entries.push({ label, at: history.created_at, note: history.note });
    });

    if (booking.review_started_at) {
        entries.push({
            label: 'Mulai ditinjau',
            at: booking.review_started_at,
            note: null,
        });
    }

    const request = booking.cancellation_request;
    if (request?.requested_at) {
        entries.push({
            label: 'Pembatalan diajukan',
            at: request.requested_at,
            note: request.reason,
        });
    }
    // Approved decisions already surface through the "cancelled" history row,
    // so only the non-terminal decisions need their own entry.
    if (request?.decided_at && request.status === 'rejected') {
        entries.push({
            label: 'Pembatalan ditolak',
            at: request.decided_at,
            note: request.decision_note,
        });
    }
    if (request?.decided_at && request.status === 'withdrawn') {
        entries.push({
            label: 'Permohonan pembatalan ditarik',
            at: request.decided_at,
            note: request.decision_note,
        });
    }

    return entries.sort((left, right) => {
        if (left.at === null && right.at === null) return 0;
        if (left.at === null) return 1;
        if (right.at === null) return -1;
        return new Date(left.at).getTime() - new Date(right.at).getTime();
    });
};

const CANCELLATION_REQUEST_LABELS: Record<string, string> = {
    pending: 'Permohonan Pembatalan Sedang Ditinjau',
    approved: 'Pembatalan Disetujui',
    rejected: 'Pembatalan Ditolak',
    withdrawn: 'Permohonan Pembatalan Ditarik',
};

export const getCancellationRequestLabel = (status: string): string =>
    CANCELLATION_REQUEST_LABELS[status] ?? 'Permohonan Pembatalan';
