export type RoomType = 'classroom' | 'laboratory';

export type BookingStatus =
    | 'submitted'
    | 'revision_requested'
    | 'approved'
    | 'rejected'
    | 'cancelled';

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
    booking_id: number;
    room: AvailabilityRoom;
    start_at: string;
    end_at: string;
    status: BookingStatus;
}

export interface BookingActor {
    id: number;
    name: string;
    email: string;
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

export interface MahasiswaBooking {
    id: number;
    room: Room;
    activity_name: string;
    purpose: string;
    participant_count: number;
    start_at: string;
    end_at: string;
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

export interface SuperAdminCalendarItem {
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

export interface SuperAdminCalendarFilters {
    month?: string;
    from?: string;
    to?: string;
    status?: BookingStatus;
    roomType?: RoomType;
    roomId?: number;
    laboratoryId?: number;
}

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
