import { apiFetch } from './api-client';
import type {
    DelegatedActivityAcknowledgement,
    DelegatedActivityEnvelope,
    DelegatedActivityFilters,
    DelegatedActivityListEnvelope,
} from './delegated-activity-types';

export type DelegatedActivityAudience = 'tendik' | 'super_admin';

const DELEGATED_ACTIVITY_BASES: Record<DelegatedActivityAudience, string> = {
    tendik: '/api/tendik/delegated-activity-acknowledgements',
    super_admin: '/api/super-admin/delegated-activity-acknowledgements',
};

interface DelegatedActivityErrorPayload {
    message?: string;
    code?: string;
    errors?: Record<string, string[]>;
    data?: Record<string, unknown>;
}

export class DelegatedActivityApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly errors?: Record<string, string[]>;
    readonly data?: Record<string, unknown>;

    constructor(
        message: string,
        status: number,
        code?: string,
        errors?: Record<string, string[]>,
        data?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'DelegatedActivityApiError';
        this.status = status;
        this.code = code;
        this.errors = errors;
        this.data = data;
    }
}

const readJson = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
    const payload = await response.json().catch(() => ({})) as DelegatedActivityErrorPayload;
    if (!response.ok) {
        throw new DelegatedActivityApiError(
            payload.message || fallbackMessage,
            response.status,
            payload.code,
            payload.errors,
            payload.data,
        );
    }

    return payload as T;
};

const setTrimmed = (params: URLSearchParams, key: string, value?: string): void => {
    const trimmed = value?.trim();
    if (trimmed) params.set(key, trimmed);
};

const setNumber = (params: URLSearchParams, key: string, value?: number): void => {
    if (value !== undefined && Number.isFinite(value)) params.set(key, String(value));
};

export const buildDelegatedActivityQuery = (filters: DelegatedActivityFilters): string => {
    const params = new URLSearchParams();
    if (filters.status !== undefined) params.set('status', filters.status);
    if (filters.urgency !== undefined) params.set('urgency', filters.urgency);
    if (filters.overdue !== undefined) params.set('overdue', filters.overdue ? 'true' : 'false');
    setTrimmed(params, 'activity_type', filters.activityType);
    setTrimmed(params, 'domain_type', filters.domainType);
    setNumber(params, 'accountable_user_id', filters.accountableUserId);
    setNumber(params, 'delegated_actor_id', filters.delegatedActorId);
    setTrimmed(params, 'represented_scope_type', filters.representedScopeType);
    setNumber(params, 'represented_scope_id', filters.representedScopeId);
    setNumber(params, 'page', filters.page);
    setNumber(params, 'per_page', filters.perPage);

    const query = params.toString();
    return query ? `?${query}` : '';
};

export const listDelegatedActivityAcknowledgementsFor = async (
    audience: DelegatedActivityAudience,
    filters: DelegatedActivityFilters = {},
): Promise<DelegatedActivityListEnvelope> => {
    const response = await apiFetch(`${DELEGATED_ACTIVITY_BASES[audience]}${buildDelegatedActivityQuery(filters)}`, {
        cache: 'no-store',
    });

    return readJson<DelegatedActivityListEnvelope>(
        response,
        'Aktivitas delegasi laboratorium belum dapat dimuat.',
    );
};

export const getDelegatedActivityAcknowledgementFor = async (
    audience: DelegatedActivityAudience,
    id: number,
): Promise<DelegatedActivityAcknowledgement> => {
    const response = await apiFetch(`${DELEGATED_ACTIVITY_BASES[audience]}/${id}`, {
        cache: 'no-store',
    });

    return (await readJson<DelegatedActivityEnvelope>(
        response,
        'Detail aktivitas delegasi belum dapat dimuat.',
    )).data;
};

export const acknowledgeDelegatedActivityFor = async (
    id: number,
    note?: string,
): Promise<DelegatedActivityAcknowledgement> => {
    const trimmedNote = note?.trim();
    const response = await apiFetch(`${DELEGATED_ACTIVITY_BASES.tendik}/${id}/acknowledge`, {
        method: 'POST',
        ...(trimmedNote ? { body: JSON.stringify({ note: trimmedNote }) } : {}),
    });

    return (await readJson<DelegatedActivityEnvelope>(
        response,
        'Konfirmasi peninjauan aktivitas delegasi gagal diproses.',
    )).data;
};

export const listSuperAdminDelegatedActivityAcknowledgements = async (
    filters: DelegatedActivityFilters = {},
): Promise<DelegatedActivityListEnvelope> =>
    listDelegatedActivityAcknowledgementsFor('super_admin', filters);

export const getSuperAdminDelegatedActivityAcknowledgement = async (
    id: number,
): Promise<DelegatedActivityAcknowledgement> =>
    getDelegatedActivityAcknowledgementFor('super_admin', id);

export const markDelegatedActivityEscalationSeen = async (
    id: number,
): Promise<DelegatedActivityAcknowledgement> => {
    const response = await apiFetch(`${DELEGATED_ACTIVITY_BASES.super_admin}/${id}/mark-escalation-seen`, {
        method: 'POST',
    });

    return (await readJson<DelegatedActivityEnvelope>(
        response,
        'Atensi SuperAdmin gagal ditandai sudah dilihat.',
    )).data;
};
