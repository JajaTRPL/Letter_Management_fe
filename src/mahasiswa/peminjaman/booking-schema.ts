import type {
    AvailabilityItem,
    BookingOccurrence,
    MahasiswaBooking,
    Room,
    TendikOperationalOccurrence,
} from './types';

/**
 * Runtime guards for every Peminjaman payload the Mahasiswa surfaces consume.
 * A 2xx body is not a contract: a proxy, a partial serializer failure, or a
 * schema drift can deliver `null`, an array where an object belongs, or list
 * elements missing the fields the UI dereferences. Rendering those crashes the
 * page (or worse, shows an empty list that reads as "you have nothing"), so
 * they are rejected at the boundary and surface through the caller's failure
 * branch instead. An empty array stays a legitimate empty result.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isRoomType = (value: unknown): boolean =>
    value === 'classroom' || value === 'laboratory';

export const isRoom = (value: unknown): value is Room => isRecord(value)
    && typeof value.id === 'number'
    && typeof value.code === 'string'
    && typeof value.name === 'string'
    && isRoomType(value.type)
    && typeof value.capacity === 'number';

export const isAvailabilityItem = (value: unknown): value is AvailabilityItem =>
    isRecord(value)
    && isRecord(value.room)
    && typeof value.room.id === 'number'
    && typeof value.room.code === 'string'
    && typeof value.room.name === 'string'
    && isRoomType(value.room.type)
    && typeof value.start_at === 'string'
    && typeof value.end_at === 'string'
    && (value.lifecycle_category === 'approved' || value.lifecycle_category === 'pending')
    && Array.isArray(value.activity_titles)
    && value.activity_titles.every((title) => typeof title === 'string')
    && typeof value.request_count === 'number'
    && Number.isInteger(value.request_count)
    && value.request_count > 0;

const isReturnSummary = (value: unknown): boolean => isRecord(value)
    && typeof value.return_ref === 'string'
    && typeof value.status === 'string'
    && typeof value.version === 'number'
    && typeof value.submitted_at === 'string'
    && (value.decision_note === null || typeof value.decision_note === 'string')
    && (value.key_received_at === null || typeof value.key_received_at === 'string')
    && (value.verified_at === null || typeof value.verified_at === 'string')
    && isRecord(value.evidence)
    && typeof value.evidence.original_name === 'string'
    && typeof value.evidence.mime === 'string'
    && typeof value.evidence.size_bytes === 'number'
    && typeof value.evidence.preview_url === 'string'
    && typeof value.evidence.download_url === 'string';

export const isBookingOccurrence = (value: unknown): value is BookingOccurrence => isRecord(value)
    && typeof value.occurrence_ref === 'string'
    && typeof value.sequence === 'number'
    && typeof value.date === 'string'
    && typeof value.start_at === 'string'
    && typeof value.end_at === 'string'
    && typeof value.return_due_at === 'string'
    && typeof value.version === 'number'
    && typeof value.operational_status === 'string'
    && isRecord(value.key_issuance)
    && typeof value.key_issuance.issued === 'boolean'
    && (value.key_issuance.issued_at === null || typeof value.key_issuance.issued_at === 'string')
    && (value.return === null || isReturnSummary(value.return))
    && (value.return_history === undefined
        || (Array.isArray(value.return_history) && value.return_history.every(isReturnSummary)))
    && isRecord(value.capabilities)
    && typeof value.capabilities.can_submit_return === 'boolean'
    && typeof value.capabilities.can_withdraw_return === 'boolean'
    && typeof value.capabilities.can_resubmit_return === 'boolean'
    && Array.isArray(value.event_hooks)
    && value.event_hooks.every((hook) => isRecord(hook)
        && typeof hook.type === 'string'
        && typeof hook.at === 'string');

export const isTendikOperationalOccurrence = (
    value: unknown,
): value is TendikOperationalOccurrence => isRecord(value)
    && isBookingOccurrence(value)
    && isRecord(value.booking)
    && typeof value.booking.id === 'number'
    && typeof value.booking.activity_name === 'string'
    && (value.booking.applicant_name === null || typeof value.booking.applicant_name === 'string')
    && isRoom(value.booking.room);

export const isMahasiswaBooking = (value: unknown): value is MahasiswaBooking =>
    isRecord(value)
    && typeof value.id === 'number'
    && isRoom(value.room)
    && typeof value.activity_name === 'string'
    && typeof value.purpose === 'string'
    && typeof value.participant_count === 'number'
    && typeof value.start_at === 'string'
    && typeof value.end_at === 'string'
    && typeof value.status === 'string'
    && (value.occurrences === undefined
        || (Array.isArray(value.occurrences) && value.occurrences.every(isBookingOccurrence)));

/** Every element must be valid — one malformed row poisons the whole list. */
export const isMahasiswaBookingList = (value: unknown): value is MahasiswaBooking[] =>
    Array.isArray(value) && value.every(isMahasiswaBooking);
