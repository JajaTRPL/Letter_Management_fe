import { apiFetch } from '../../shared/api-client';
import type {
    RetentionActionLog,
    RetentionActionResult,
    RetentionArchive,
    RetentionDryRunResult,
    RetentionFilters,
    RetentionListResponse,
    RetentionManualRunPayload,
    RetentionOverview,
    RetentionPolicyPayload,
    RetentionPolicyValues,
} from './types';

const RETENTION_BASE = '/api/super-admin/retention';

interface ApiEnvelope<T> {
    message?: string;
    data: T;
    meta?: RetentionListResponse<unknown>['meta'];
}

function appendQuery(path: string, filters: RetentionFilters): string {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
    });
    const query = params.toString();
    return query ? `${path}?${query}` : path;
}

async function readJson<T>(response: Response): Promise<T> {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) {
        throw new Error(payload.message || 'Permintaan retensi surat gagal.');
    }
    return payload as T;
}

async function apiGet<T>(path: string): Promise<ApiEnvelope<T>> {
    const response = await apiFetch(`${RETENTION_BASE}${path}`);
    return readJson<ApiEnvelope<T>>(response);
}

async function apiSend<T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<ApiEnvelope<T>> {
    const response = await apiFetch(`${RETENTION_BASE}${path}`, {
        method,
        body: JSON.stringify(body),
    });
    return readJson<ApiEnvelope<T>>(response);
}

function listEnvelope<T>(payload: ApiEnvelope<T[]>): RetentionListResponse<T> {
    return {
        data: payload.data,
        meta: payload.meta ?? {
            current_page: 1,
            per_page: payload.data.length,
            total: payload.data.length,
            last_page: 1,
        },
    };
}

export async function getRetentionOverview(): Promise<RetentionOverview> {
    return (await apiGet<RetentionOverview>('/overview')).data;
}

export async function getRetentionPolicy(): Promise<RetentionPolicyPayload> {
    return (await apiGet<RetentionPolicyPayload>('/policy')).data;
}

export async function updateRetentionPolicy(values: RetentionPolicyValues): Promise<RetentionPolicyPayload> {
    return (await apiSend<RetentionPolicyPayload>('/policy', 'PUT', values)).data;
}

export async function getRetentionCandidates(filters: RetentionFilters): Promise<RetentionListResponse<RetentionActionResult>> {
    return listEnvelope(await apiGet<RetentionActionResult[]>(appendQuery('/candidates', filters)));
}

export async function getRetentionArchives(filters: RetentionFilters): Promise<RetentionListResponse<RetentionArchive>> {
    return listEnvelope(await apiGet<RetentionArchive[]>(appendQuery('/archives', filters)));
}

export async function getRetentionActions(filters: RetentionFilters): Promise<RetentionListResponse<RetentionActionLog>> {
    return listEnvelope(await apiGet<RetentionActionLog[]>(appendQuery('/actions', filters)));
}

export async function runRetentionDryRun(payload: RetentionManualRunPayload): Promise<RetentionDryRunResult> {
    return (await apiSend<RetentionDryRunResult>('/dry-run', 'POST', payload)).data;
}

export async function executeRetentionItem(payload: RetentionManualRunPayload): Promise<RetentionActionResult> {
    return (await apiSend<RetentionActionResult>('/execute', 'POST', payload)).data;
}

export async function restoreRetentionArchive(artifactId: number, reason: string): Promise<RetentionActionResult> {
    return (await apiSend<RetentionActionResult>(`/archives/${artifactId}/restore`, 'POST', { reason })).data;
}

export async function purgeRetentionArchive(artifactId: number, reason: string): Promise<RetentionActionResult> {
    return (await apiSend<RetentionActionResult>(`/archives/${artifactId}/purge`, 'POST', { reason })).data;
}
