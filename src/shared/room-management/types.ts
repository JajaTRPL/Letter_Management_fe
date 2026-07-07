export type ManagedRoomType = 'classroom' | 'laboratory';

/**
 * Per-room capability flags computed by the backend permission resolver.
 * The UI renders actions from these flags only — role names are used for
 * copy/context, never as authority. Missing flags normalize to false.
 */
export interface RoomManagementFlags {
    can_edit_info: boolean;
    can_manage_media: boolean;
    can_manage_facilities: boolean;
    can_manage_templates: boolean;
    can_create: boolean;
    can_deactivate: boolean;
    can_activate: boolean;
}

export interface ManagedLaboratory {
    id: number;
    code: string;
    name: string;
}

export interface ManagedRoomPhoto {
    id: number;
    thumb_url?: string | null;
    display_url?: string | null;
    full_url?: string | null;
    width?: number | null;
    height?: number | null;
    is_cover?: boolean;
    sort_order?: number;
    original_name?: string | null;
    created_at?: string | null;
}

export type RoomFacilityCondition = 'baik' | 'perlu_perbaikan' | 'rusak';

export interface ManagedRoomFacility {
    facility_type_id: number;
    name?: string | null;
    slug?: string | null;
    quantity?: number | null;
    condition?: RoomFacilityCondition | string | null;
    notes?: string | null;
}

export interface FacilityTypeOption {
    id: number;
    name: string;
    slug: string;
    is_predefined: boolean;
    // Present on the master view; absent on legacy/active-filtered responses.
    is_active?: boolean;
    usage_count?: number;
}

/** One room using a facility type (Master Fasilitas "Lihat Penggunaan"). */
export interface FacilityUsageRoom {
    id: number;
    code: string;
    name: string;
    type: ManagedRoomType;
    is_active: boolean;
    owning_laboratory: ManagedLaboratory | null;
    quantity?: number | null;
    condition?: RoomFacilityCondition | string | null;
}

export interface FacilityUsageSummary {
    total: number;
    classroom: number;
    laboratory: number;
    other: number;
}

export interface FacilityUsage {
    facility_type: FacilityTypeOption;
    summary: FacilityUsageSummary;
    rooms: FacilityUsageRoom[];
}

export interface ManagedRoomTemplate {
    id: number;
    scope: string;
    laboratory_id?: number | null;
    version: number;
    original_name?: string | null;
    mime?: string | null;
    size_bytes?: number | null;
    is_active: boolean;
    notes?: string | null;
    created_at?: string | null;
    download_url?: string | null;
}

export interface RoomAuditEntry {
    id: number;
    subject_type: string;
    subject_id?: number | null;
    action: string;
    actor?: string | null;
    details?: string | null;
    created_at?: string | null;
}

export interface ManagedRoom {
    id: number;
    code: string;
    name: string;
    type: ManagedRoomType;
    capacity: number;
    location: string;
    description: string | null;
    rules?: string | null;
    is_active: boolean;
    owning_laboratory: ManagedLaboratory | null;
    cover_photo?: ManagedRoomPhoto | null;
    facilities_summary?: { count?: number; items?: string[] } | null;
    has_active_template?: boolean;
    management_flags: RoomManagementFlags;
}

export interface ManagedRoomDetail extends ManagedRoom {
    photos: ManagedRoomPhoto[];
    facilities: ManagedRoomFacility[];
    active_template?: ManagedRoomTemplate | null;
}

export interface RoomInfoPayload {
    code: string;
    name: string;
    type: ManagedRoomType;
    capacity: number;
    location: string;
    description: string | null;
    rules: string | null;
    owning_laboratory_id: number | null;
}

export interface FacilitySyncEntry {
    facility_type_id: number;
    quantity?: number | null;
    condition?: RoomFacilityCondition | null;
    notes?: string | null;
}

export type RoomManagementValidationErrors = Record<string, string[]>;
