export type RoomType = 'classroom' | 'laboratory';

export type BookingStatus =
    | 'submitted'
    | 'revision_requested'
    | 'approved'
    | 'rejected'
    | 'cancelled';

/**
 * Backend-derived effective status (C7B2 lifecycle projection). The stored
 * five-status vocabulary above never changes; these read-only derivations
 * are additive. Kept as `string`-tolerant at the consumption site so an
 * unknown future value falls back to a safe label instead of breaking.
 */
export type BookingEffectiveStatus =
    | BookingStatus
    | 'under_review'
    | 'expired'
    | 'completed';

/**
 * Actor-specific capability projection returned by the C7B2 backend. These
 * flags drive presentation only — backend authorization remains the sole
 * authority (a stale/absent flag never unlocks anything server-side).
 */
export interface BookingCapabilities {
    can_edit: boolean;
    can_resubmit: boolean;
    can_cancel: boolean;
    can_view_attachment: boolean;
    can_withdraw: boolean;
    can_request_cancellation: boolean;
    can_withdraw_cancellation_request: boolean;
    withdrawal_block_reason: string | null;
    next_action: string | null;
}

export type CancellationRequestStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'withdrawn';

/** Applicant-safe cancellation-request summary from the booking payload. */
export interface CancellationRequestSummary {
    id: number;
    status: CancellationRequestStatus;
    reason: string | null;
    requested_at: string | null;
    decision_note: string | null;
    decided_at: string | null;
    responsible_role: 'sarpras' | 'kepala_lab';
    available_applicant_action: string | null;
}

export type BookingConflictStatus =
    | 'none'
    | 'approved_overlap'
    | 'pending_overlap';

export type BookingConflictLevel =
    | 'none'
    | 'warning'
    | 'blocking';

export interface BookingConflictSummary {
    booking_id: number;
    room_id: number;
    room_name?: string | null;
    start_at: string;
    end_at: string;
    status: BookingStatus;
    requester_name?: string | null;
    activity_name?: string | null;
    purpose?: string | null;
}

export interface BookingConflictMetadata {
    conflict_status?: BookingConflictStatus;
    has_conflict?: boolean;
    conflict_level?: BookingConflictLevel;
    conflict_message?: string | null;
    conflicts?: BookingConflictSummary[];
}

export interface LaboratorySummary {
    id: number;
    code: string;
    name: string;
}

/**
 * Room photo metadata from the CP2 catalog API. Only authenticated media
 * endpoint references are exposed — never storage disks/paths. Everything is
 * optional so legacy payloads (pre-photo backend) normalize to "no photo".
 */
export interface RoomPhotoMeta {
    id: number;
    thumb_url?: string | null;
    display_url?: string | null;
    full_url?: string | null;
    width?: number | null;
    height?: number | null;
    is_cover?: boolean;
    sort_order?: number;
    original_name?: string | null;
}

export type RoomFacilityCondition = 'baik' | 'perlu_perbaikan' | 'rusak';

export interface RoomFacilityItem {
    facility_type_id: number;
    name?: string | null;
    slug?: string | null;
    quantity?: number | null;
    condition?: RoomFacilityCondition | string | null;
    notes?: string | null;
}

export interface RoomFacilitiesSummary {
    count?: number;
    items?: string[];
}

export interface RoomTemplateInfo {
    original_name?: string | null;
    mime?: string | null;
    size_bytes?: number | null;
    version?: number | null;
    download_url?: string | null;
}

export interface Room {
    id: number;
    code: string;
    name: string;
    type: RoomType;
    capacity: number;
    location: string;
    description: string | null;
    is_active: boolean;
    owning_laboratory: LaboratorySummary | null;
    // CP2 additive catalog hints — absent on legacy payloads.
    rules?: string | null;
    cover_photo?: RoomPhotoMeta | null;
    facilities_summary?: RoomFacilitiesSummary | null;
    has_active_template?: boolean;
}

export interface RoomDetail extends Room {
    photos?: RoomPhotoMeta[] | null;
    facilities?: RoomFacilityItem[] | null;
    template?: RoomTemplateInfo | null;
}

export interface AvailabilityRoom {
    id: number;
    code: string;
    name: string;
    type: RoomType;
}

export interface AvailabilityItem {
    room: AvailabilityRoom;
    start_at: string;
    end_at: string;
    lifecycle_category: 'approved' | 'pending';
    activity_titles: string[];
    request_count: number;
}

export interface BookingActor {
    id: number;
    name: string;
    // C7B2 trims email from applicant-facing actor projections; optional so
    // both old and new payload shapes type-check.
    email?: string;
}

export interface BookingStatusHistory {
    id: number;
    from_status: BookingStatus | null;
    to_status: BookingStatus;
    actor: BookingActor | null;
    note: string | null;
    created_at: string | null;
}

/**
 * Safe attachment metadata for the uploaded surat peminjaman PDF. The backend
 * only ever exposes these display/URL fields — never disk/path/storage
 * internals. All fields optional so legacy rows (no attachment recorded) and
 * partial payloads normalize safely to "no attachment".
 */
export interface SuratPeminjamanPdfMeta {
    exists?: boolean;
    has_surat_peminjaman_pdf?: boolean;
    original_name?: string | null;
    size_bytes?: number | null;
    uploaded_at?: string | null;
    preview_url?: string | null;
    download_url?: string | null;
}

export type BookingMode = 'single_day' | 'consecutive_days';
export type OccurrenceOperationalStatus =
    | 'scheduled' | 'key_issued' | 'in_use' | 'return_due'
    | 'awaiting_verification' | 'revision_required'
    | 'returned_on_time' | 'returned_late' | 'overdue' | 'cancelled'
    // The parent booking is not approved (submitted/revision/rejected): the
    // occurrence row exists for compatibility only and has no operational life.
    | 'not_actionable';
export type BookingReturnStatus =
    | 'pending' | 'revision_requested' | 'accepted' | 'rejected' | 'withdrawn';

export interface ReturnEvidenceSummary {
    original_name: string;
    mime: string;
    size_bytes: number;
    preview_url: string;
    download_url: string;
}

export interface BookingReturnSummary {
    return_ref: string;
    status: BookingReturnStatus;
    version: number;
    submitted_at: string;
    decision_note: string | null;
    key_received_at: string | null;
    verified_at: string | null;
    evidence: ReturnEvidenceSummary;
    verified_by?: { name: string | null; role: string | null } | null;
    received_time_change_reason?: string | null;
}

export interface BookingOccurrence {
    occurrence_ref: string;
    sequence: number;
    date: string;
    start_at: string;
    end_at: string;
    return_due_at: string;
    version: number;
    operational_status: OccurrenceOperationalStatus;
    key_issuance: {
        issued: boolean;
        issued_at: string | null;
        issued_by: { name: string | null; role: string | null } | null;
    };
    return: BookingReturnSummary | null;
    return_history?: BookingReturnSummary[];
    capabilities: {
        can_submit_return: boolean;
        can_withdraw_return: boolean;
        can_resubmit_return: boolean;
        can_issue_key?: boolean;
        can_verify_return?: boolean;
    };
    event_hooks: Array<{ type: string; at: string }>;
}

export interface BookingOccurrenceSummary {
    total: number;
    completed: number;
    progress_label: string;
    next_action: OccurrenceOperationalStatus | null;
    nearest_deadline: string | null;
}

export interface UsageTimelineItem {
    type: string;
    occurred_at: string | null;
    label: string | null;
    actor: { name: string; role: string };
    occurrence_ref: string | null;
}

export interface MahasiswaBooking extends BookingConflictMetadata {
    id: number;
    room: Room;
    activity_name: string;
    purpose: string;
    participant_count: number;
    start_at: string;
    end_at: string;
    booking_mode?: BookingMode;
    occurrence_end_date?: string;
    occurrences?: BookingOccurrence[];
    occurrence_summary?: BookingOccurrenceSummary;
    usage_timeline?: UsageTimelineItem[];
    status: BookingStatus;
    reviewer: BookingActor | null;
    reviewed_at: string | null;
    revision_note: string | null;
    rejection_reason: string | null;
    cancellation_reason: string | null;
    created_at: string | null;
    updated_at: string | null;
    status_histories?: BookingStatusHistory[];
    surat_peminjaman_pdf?: SuratPeminjamanPdfMeta | null;
    // C7B2 additive lifecycle projection. All optional so pre-C7B2 payloads
    // and older fixtures keep working; the backend value is the only source
    // of truth when present.
    stored_status?: BookingStatus;
    effective_status?: BookingEffectiveStatus | string;
    workflow_version?: number;
    submission_iteration?: number;
    is_expired?: boolean;
    is_completed?: boolean;
    review_started_at?: string | null;
    cancellation_pending?: boolean;
    cancellation_request?: CancellationRequestSummary | null;
    cancellation_source?: string | null;
    capabilities?: BookingCapabilities;
}

export interface TendikBooking extends MahasiswaBooking {
    requester: BookingActor | null;
}

export type SuperAdminBooking = TendikBooking;

export interface BookingPayload {
    room_id: number;
    activity_name: string;
    purpose: string;
    participant_count: number;
    start_at: string;
    end_at: string;
    booking_mode?: BookingMode;
    occurrence_end_date?: string;
}

export interface TendikOperationalOccurrence extends BookingOccurrence {
    /**
     * Who owns this key/return step, supplied by the backend so every surface
     * explains it identically. Present when the viewer cannot act — a Kepala Lab
     * may read their lab's occurrences but never issues keys or verifies
     * returns, so the UI names the responsible party instead of showing an
     * empty action area.
     */
    responsible_label?: string | null;
    booking: {
        id: number;
        activity_name: string;
        applicant_name: string | null;
        room: Room;
    };
}

export interface ApiEnvelope<T> {
    message: string;
    data: T;
}

export interface RoomListEnvelope extends ApiEnvelope<Room[]> {
    count: number;
}

export interface PaginationMeta {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
}

export interface TendikBookingListEnvelope extends ApiEnvelope<TendikBooking[]> {
    meta: PaginationMeta;
}

export interface SuperAdminBookingListEnvelope extends ApiEnvelope<SuperAdminBooking[]> {
    meta: PaginationMeta;
}

export interface SuperAdminCalendarItem extends BookingConflictMetadata {
    id: number;
    room_id: number;
    room_code: string;
    room_name: string;
    room_type: RoomType;
    laboratory_id: number | null;
    laboratory_name: string | null;
    requester_name: string | null;
    requester_identifier: string | null;
    activity_name: string;
    purpose: string;
    status: BookingStatus;
    start_at: string;
    end_at: string;
    can_view: boolean;
    can_review: boolean;
    can_approve: boolean;
    can_reject: boolean;
    can_request_revision: boolean;
    can_cancel: boolean;
    can_manage_room: boolean;
}

export interface SuperAdminCalendarEnvelope {
    message: string;
    month: string;
    range: {
        start: string;
        end: string;
    };
    items: SuperAdminCalendarItem[];
    summary: {
        total: number;
        active_total: number;
        history_total: number;
        counts_by_status: Partial<Record<BookingStatus, number>>;
    };
}

export interface TendikCalendarItem extends SuperAdminCalendarItem {
    can_update_readiness?: boolean;
    can_resolve_conflict?: boolean;
    can_relocate_booking?: boolean;
}

export interface TendikCalendarEnvelope {
    message: string;
    month: string;
    range: {
        start: string;
        end: string;
    };
    items: TendikCalendarItem[];
    summary: {
        total: number;
        active_total: number;
        history_total: number;
        counts_by_status: Partial<Record<BookingStatus, number>>;
    };
}

export interface TendikBookingFilters {
    status?: BookingStatus;
    roomType?: RoomType;
    roomId?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
}

export type SuperAdminBookingFilters = TendikBookingFilters;

export type BookingCalendarStatusScope =
    | 'active'
    | 'history'
    | BookingStatus;

export interface SuperAdminCalendarFilters {
    month?: string;
    from?: string;
    to?: string;
    status?: BookingCalendarStatusScope;
    roomType?: RoomType;
    roomId?: number;
    laboratoryId?: number;
}

export type TendikCalendarFilters = SuperAdminCalendarFilters;

export interface SuperAdminRoomFilters {
    type?: RoomType;
    laboratoryId?: number;
    search?: string;
    active?: boolean;
}

export interface RoomManagementPayload {
    code: string;
    name: string;
    type: RoomType;
    capacity: number;
    location: string;
    description: string | null;
    owning_laboratory_id: number | null;
}

export type TendikReviewerRole =
    | 'persuratan'
    | 'sarpras'
    | 'kepala_lab'
    | 'laboran';

export interface TendikReviewerProfile {
    id?: number | null;
    name?: string | null;
    role?: string | null;
    tendik_role?: TendikReviewerRole | null;
}

export type ValidationErrors = Record<string, string[]>;
