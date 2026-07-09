export type DelegatedActivityStatus =
    | 'pending_review'
    | 'acknowledged'
    | 'escalated'
    | 'voided';

export type DelegatedActivityEffectiveStatus =
    | DelegatedActivityStatus
    | 'overdue';

export type DelegatedActivityUrgency =
    | 'urgent'
    | 'normal'
    | 'low_risk';

export type DelegatedActivityStateValue =
    | Record<string, unknown>
    | unknown[]
    | string
    | number
    | boolean
    | null;

export interface DelegatedActivityUserSummary {
    id: number;
    name: string;
    email?: string | null;
    role?: string | null;
    tendik_role?: string | null;
}

export interface DelegatedActivityLabels {
    status?: string | null;
    urgency?: string | null;
    overdue?: string | null;
}

export interface DelegatedActivityPermissions {
    can_acknowledge: boolean;
    can_mark_escalation_seen: boolean;
}

export interface DelegatedActivityAcknowledgement {
    id: number;
    domain_type: string;
    subject_type: string;
    subject_id: number;
    delegated_actor: DelegatedActivityUserSummary | null;
    accountable_user: DelegatedActivityUserSummary | null;
    accountable_role: string;
    represented_scope_type: string | null;
    represented_scope_id: number | null;
    activity_type: string;
    activity_summary: string;
    internal_note?: string | null;
    student_facing_note?: string | null;
    before_state?: DelegatedActivityStateValue;
    after_state?: DelegatedActivityStateValue;
    status: DelegatedActivityStatus;
    effective_status: DelegatedActivityEffectiveStatus;
    urgency: DelegatedActivityUrgency;
    performed_at: string | null;
    acknowledgement_due_at: string | null;
    is_overdue: boolean;
    overdue_days?: number | null;
    overdue_hours?: number | null;
    acknowledged_at: string | null;
    acknowledged_by: DelegatedActivityUserSummary | null;
    acknowledgement_note: string | null;
    escalated_at: string | null;
    escalation_seen_by_superadmin_at: string | null;
    status_label?: string | null;
    urgency_label?: string | null;
    overdue_label?: string | null;
    labels?: DelegatedActivityLabels;
    permissions: DelegatedActivityPermissions;
}

export interface DelegatedActivitySummary {
    pending_count: number;
    overdue_count: number;
    oldest_due_at: string | null;
    acknowledged_count?: number;
    escalated_count?: number;
}

export interface DelegatedActivityPaginationMeta {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    summary?: DelegatedActivitySummary;
}

export interface DelegatedActivityListEnvelope {
    message: string;
    data: DelegatedActivityAcknowledgement[];
    meta: DelegatedActivityPaginationMeta;
}

export interface DelegatedActivityEnvelope {
    message: string;
    data: DelegatedActivityAcknowledgement;
}

export interface DelegatedActivityFilters {
    status?: DelegatedActivityStatus;
    urgency?: DelegatedActivityUrgency;
    overdue?: boolean;
    activityType?: string;
    domainType?: string;
    accountableUserId?: number;
    delegatedActorId?: number;
    representedScopeType?: string;
    representedScopeId?: number;
    page?: number;
    perPage?: number;
}
