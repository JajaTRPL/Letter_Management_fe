import { apiFetch } from '../../shared/api-client';
import type { ReviewMetric, ReviewSummaryPayload } from '../../shared/review-performance-widget';

/**
 * Typed client for the review-performance endpoints. Mirrors the retention
 * module's api.ts: one function per endpoint, malformed 2xx rejected rather than
 * quietly rendered as an empty report.
 */

export const PERIODS = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: '1month', label: '1 Bulan' },
    { key: '3months', label: '3 Bulan' },
    { key: '6months', label: '6 Bulan' },
    { key: '12months', label: '12 Bulan' },
] as const;

export type PeriodKey = (typeof PERIODS)[number]['key'];

export interface ReviewUnitRow {
    unit_id: number | null;
    unit_label: string;
    metric: ReviewMetric;
}

export interface ReviewBreakdownPayload {
    scope: string;
    scope_label: string;
    stage: string;
    stage_label: string;
    unit_dimension: string;
    unit_dimension_label: string;
    sort: string;
    units: ReviewUnitRow[];
    unassigned: { count: number; note: string };
}

export interface ReviewTrendPoint {
    key: string;
    label: string;
    count: number;
    median_seconds: number | null;
    median_label: string | null;
    source: 'dynamic' | 'fallback' | 'none';
}

export interface ReviewTrendPayload {
    stage_label: string;
    bucket: 'day' | 'month';
    points: ReviewTrendPoint[];
}

async function getData<T>(url: string, what: string): Promise<T> {
    const response = await apiFetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Gagal memuat ${what}.`);
    }
    const body = await response.json();
    if (!body?.data) {
        throw new Error(`Data ${what} tidak lengkap.`);
    }

    return body.data as T;
}

export function fetchReviewSummary(period: string): Promise<ReviewSummaryPayload> {
    return getData<ReviewSummaryPayload>(
        `/api/super-admin/review-performance?period=${encodeURIComponent(period)}`,
        'ringkasan kinerja pemeriksaan',
    );
}

export function fetchReviewBreakdown(scope: string, stage: string, period: string): Promise<ReviewBreakdownPayload> {
    return getData<ReviewBreakdownPayload>(
        `/api/super-admin/review-performance/breakdown?scope=${encodeURIComponent(scope)}`
        + `&stage=${encodeURIComponent(stage)}&period=${encodeURIComponent(period)}`,
        'rincian per unit',
    );
}

export function fetchReviewTrend(scope: string, stage: string, period: string): Promise<ReviewTrendPayload> {
    return getData<ReviewTrendPayload>(
        `/api/super-admin/review-performance/trend?scope=${encodeURIComponent(scope)}`
        + `&stage=${encodeURIComponent(stage)}&period=${encodeURIComponent(period)}`,
        'tren kinerja pemeriksaan',
    );
}
