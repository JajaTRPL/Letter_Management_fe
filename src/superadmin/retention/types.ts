export const RETENTION_CATEGORIES = [
    'supporting_document',
    'intermediate_artifact',
    'final_official_pdf',
    'archived_final_pdf',
] as const;

export type RetentionCategory = typeof RETENTION_CATEGORIES[number];

export interface RetentionPolicyValues {
    supporting_document_retention_days: number;
    intermediate_artifact_retention_days: number;
    final_pdf_active_days: number;
    archive_retention_days: number;
}

export interface RetentionSchedulerStatus {
    enabled: boolean;
    source: string;
    api_managed: boolean;
}

export interface RetentionPolicyPayload {
    schema_ready: boolean;
    values: RetentionPolicyValues;
    defaults: RetentionPolicyValues;
    scope: string;
    scheduler: RetentionSchedulerStatus;
}

export interface RetentionOverview {
    schema_ready: boolean;
    policy: RetentionPolicyPayload;
    candidates: {
        total: number;
        by_category: Partial<Record<RetentionCategory, number>>;
    };
    archives: {
        available: number;
        purged: number;
    };
    actions: {
        total: number;
        by_status: Record<string, number>;
    };
    scheduler: RetentionSchedulerStatus;
}

export interface RetentionActionResult {
    letter_type: string;
    application_id: number;
    category: RetentionCategory;
    action: string;
    subject_type: 'attachment' | 'artifact';
    subject_id: number | null;
    status: string;
    eligible_at: string | null;
    error_code: string | null;
    verification_state: 'verified' | 'verification_failed' | 'not_available' | string;
}

export interface RetentionArchive {
    id: number;
    letter_type: string;
    application_id: number;
    phase: string;
    version: number;
    status: string;
    retention_status: string | null;
    archived_at: string | null;
    archive_purged_at: string | null;
    verification_state: 'verified' | 'verification_failed' | 'not_available' | string;
}

export interface RetentionActionLog extends RetentionActionResult {
    id: number;
    executed_at: string | null;
    created_at: string | null;
    metadata: {
        trigger: string;
        actor_id: number | null;
        reason_present: boolean;
    };
}

export interface RetentionPaginationMeta {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    truncated?: boolean;
}

export interface RetentionListResponse<T> {
    data: T[];
    meta: RetentionPaginationMeta;
}

export interface RetentionFilters {
    letter_type?: string;
    application_id?: number;
    category?: RetentionCategory;
    status?: string;
    page?: number;
    per_page?: number;
}

export interface RetentionManualRunPayload {
    category: RetentionCategory;
    letter_type?: string;
    application_id?: number;
    subject_type?: 'attachment' | 'artifact';
    subject_id?: number;
    batch?: number;
    reason?: string;
}

export interface RetentionDryRunResult {
    schema_ready: boolean;
    total: number;
    counts_by_status: Record<string, number>;
    actions: RetentionActionResult[];
}
