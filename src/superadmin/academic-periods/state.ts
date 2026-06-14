/**
 * Academic Period derived state — pure helpers, no DOM, no API, no storage,
 * no side effects. Mirrors the backend's hybrid resolver semantics:
 *   "current today" == is_active=true AND today is between start_date and end_date.
 *
 * Date comparison is done on YYYY-MM-DD strings (lexicographic order is correct
 * for ISO calendar dates), which avoids ISO-UTC parsing pitfalls that would
 * shift dates by ±1 day in timezones away from UTC.
 */
import type { AcademicPeriod } from './types';

/** Today as YYYY-MM-DD in the user's local timezone. */
export const todayDateKey = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Indonesian-localized date label like "1 Sep 2025". Parses YYYY-MM-DD into a
 * LOCAL Date (year, monthIndex, day) so the printed day matches what the
 * backend stored — never the UTC-midnight wraparound.
 */
export const formatLocalDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

/** Indonesian-localized long date like "1 September 2025" — for confirm copy. */
export const formatLocalDateLong = (dateStr: string): string => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};

/** True if today >= start_date AND today <= end_date (string compare). */
export const todayIsInside = (period: AcademicPeriod, today: string = todayDateKey()): boolean =>
    today >= period.start_date && today <= period.end_date;

/** Mirrors backend `currentAcademicPeriod` semantics for a single row. */
export const isCurrentToday = (period: AcademicPeriod, today: string = todayDateKey()): boolean =>
    period.is_active && todayIsInside(period, today);

export const isExpired = (period: AcademicPeriod, today: string = todayDateKey()): boolean =>
    today > period.end_date;

export const isFuture = (period: AcademicPeriod, today: string = todayDateKey()): boolean =>
    today < period.start_date;

export const isActiveButExpired = (period: AcademicPeriod, today: string = todayDateKey()): boolean =>
    period.is_active && isExpired(period, today);

export const isActiveButFuture = (period: AcademicPeriod, today: string = todayDateKey()): boolean =>
    period.is_active && isFuture(period, today);

/**
 * Days from today to end_date (inclusive of end_date as day 0).
 * Negative when expired. Computed in LOCAL Date space.
 */
export const daysUntilEnd = (period: AcademicPeriod, today: string = todayDateKey()): number => {
    const [ty, tm, td] = today.split('-').map(Number);
    const [ey, em, ed] = period.end_date.split('-').map(Number);
    if ([ty, tm, td, ey, em, ed].some(Number.isNaN)) return Number.NaN;
    const todayLocal = new Date(ty, tm - 1, td).getTime();
    const endLocal = new Date(ey, em - 1, ed).getTime();
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endLocal - todayLocal) / msPerDay);
};

/** First period (in array order) that is "current today". */
export const currentPeriod = (
    periods: ReadonlyArray<AcademicPeriod>,
    today: string = todayDateKey(),
): AcademicPeriod | null => {
    for (const p of periods) {
        if (isCurrentToday(p, today)) return p;
    }
    return null;
};

/** True when more than one row carries is_active=true (admin/DB inconsistency). */
export const multipleActive = (periods: ReadonlyArray<AcademicPeriod>): boolean =>
    periods.filter(p => p.is_active).length > 1;

/** True when no row satisfies the hybrid "current today" rule. */
export const noCurrentToday = (
    periods: ReadonlyArray<AcademicPeriod>,
    today: string = todayDateKey(),
): boolean => currentPeriod(periods, today) === null;

/** Display state used by the table badge. */
export type PeriodDisplayState =
    | 'berjalan'
    | 'aktif-belum-mulai'
    | 'aktif-berakhir'
    | 'nonaktif';

export const periodDisplayState = (
    period: AcademicPeriod,
    today: string = todayDateKey(),
): PeriodDisplayState => {
    if (!period.is_active) return 'nonaktif';
    if (isFuture(period, today)) return 'aktif-belum-mulai';
    if (isExpired(period, today)) return 'aktif-berakhir';
    return 'berjalan';
};

export interface AcademicPeriodSummary {
    total: number;
    current: AcademicPeriod | null;
    hasMultipleActive: boolean;
    hasNoCurrentToday: boolean;
}

export const summarizeAcademicPeriods = (
    periods: ReadonlyArray<AcademicPeriod>,
    today: string = todayDateKey(),
): AcademicPeriodSummary => ({
    total: periods.length,
    current: currentPeriod(periods, today),
    hasMultipleActive: multipleActive(periods),
    hasNoCurrentToday: noCurrentToday(periods, today),
});
