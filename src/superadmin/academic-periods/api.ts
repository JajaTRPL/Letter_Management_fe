import { apiFetch } from '../../shared/api-client';
import type { AcademicPeriod } from './types';

const BASE = '/api/super-admin/academic-periods';

export async function listAcademicPeriods(): Promise<{ message: string; count: number; data: AcademicPeriod[] }> {
    const res = await apiFetch(BASE);
    return res.json() as Promise<{ message: string; count: number; data: AcademicPeriod[] }>;
}

export async function createAcademicPeriod(payload: Record<string, unknown>): Promise<Response> {
    return apiFetch(BASE, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAcademicPeriod(id: number, payload: Record<string, unknown>): Promise<Response> {
    return apiFetch(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteAcademicPeriod(id: number): Promise<Response> {
    return apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function toggleAcademicPeriod(id: number): Promise<Response> {
    return apiFetch(`${BASE}/${id}/toggle-active`, { method: 'PATCH' });
}
