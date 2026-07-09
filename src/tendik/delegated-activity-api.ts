import { apiFetch } from '../shared/api-client';
import type {
    DelegatedActivityAcknowledgement,
    DelegatedActivityEnvelope,
    DelegatedActivityFilters,
    DelegatedActivityListEnvelope,
} from './delegated-activity-types';

const TENDIK_DELEGATED_ACTIVITY_BASE = '/api/tendik/delegated-activity-acknowledgements';

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

const buildQuery = (filters: DelegatedActivityFilters): string => {
    const params = new URLSearchParams();
    if (filters.status !== undefined) params.set('status', filters.status);
    if (filters.urgency !== undefined) params.set('urgency', filters.urgency);
    if (filters.overdue !== undefined) params.set('overdue', filters.overdue ? 'true' : 'false');
    if (filters.activityType !== undefined && filters.activityType.trim() !== '') {
        params.set('activity_type', filters.activityType.trim());
    }
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.perPage !== undefined) params.set('per_page', String(filters.perPage));

    const query = params.toString();
    return query ? `?${query}` : '';
};

export const listDelegatedActivityAcknowledgements = async (
    filters: DelegatedActivityFilters = {},
): Promise<DelegatedActivityListEnvelope> => {
    const response = await apiFetch(`${TENDIK_DELEGATED_ACTIVITY_BASE}${buildQuery(filters)}`, {
        cache: 'no-store',
    });

    return readJson<DelegatedActivityListEnvelope>(
        response,
        'Aktivitas delegasi laboratorium belum dapat dimuat.',
    );
};

export const getDelegatedActivityAcknowledgement = async (
    id: number,
): Promise<DelegatedActivityAcknowledgement> => {
    const response = await apiFetch(`${TENDIK_DELEGATED_ACTIVITY_BASE}/${id}`, {
        cache: 'no-store',
    });

    return (await readJson<DelegatedActivityEnvelope>(
        response,
        'Detail aktivitas delegasi belum dapat dimuat.',
    )).data;
};

export const acknowledgeDelegatedActivity = async (
    id: number,
    note?: string,
): Promise<DelegatedActivityAcknowledgement> => {
    const trimmedNote = note?.trim();
    const response = await apiFetch(`${TENDIK_DELEGATED_ACTIVITY_BASE}/${id}/acknowledge`, {
        method: 'POST',
        ...(trimmedNote ? { body: JSON.stringify({ note: trimmedNote }) } : {}),
    });

    return (await readJson<DelegatedActivityEnvelope>(
        response,
        'Konfirmasi peninjauan aktivitas delegasi gagal diproses.',
    )).data;
};
