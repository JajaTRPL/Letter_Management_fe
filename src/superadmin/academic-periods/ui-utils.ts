import type { AcademicPeriod } from './types';
import {
    type PeriodDisplayState,
    daysUntilEnd,
    formatLocalDate,
    isCurrentToday,
    periodDisplayState,
} from './state';

const SEMESTER_LABELS: Record<string, string> = {
    ganjil: 'Ganjil',
    genap:  'Genap',
};

export const semesterTypeLabel = (type: string): string =>
    SEMESTER_LABELS[type] ?? type;

const STATUS_BADGE_STYLE: Record<PeriodDisplayState, { label: string; classes: string }> = {
    'berjalan':         { label: 'Berjalan',            classes: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
    'aktif-belum-mulai':{ label: 'Aktif – Belum Mulai', classes: 'bg-amber-50 text-amber-700 border border-amber-100' },
    'aktif-berakhir':   { label: 'Aktif – Berakhir',    classes: 'bg-rose-50 text-rose-700 border border-rose-100' },
    'nonaktif':         { label: 'Nonaktif',            classes: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

const statusBadge = (period: AcademicPeriod): string => {
    const state = periodDisplayState(period);
    const { label, classes } = STATUS_BADGE_STYLE[state];
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${classes}">${label}</span>`;
};

/** Small amber chip shown next to the date when current period is ending within 14 days. */
const expirySoonChip = (period: AcademicPeriod): string => {
    if (!isCurrentToday(period)) return '';
    const days = daysUntilEnd(period);
    if (!Number.isFinite(days) || days < 0 || days > 14) return '';
    const text = days === 0 ? 'Berakhir hari ini' : `Berakhir ${days} hari lagi`;
    return `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100" title="Tanggal selesai semakin dekat">${text}</span>`;
};

const dateRangeCell = (period: AcademicPeriod): string => {
    const start = formatLocalDate(period.start_date);
    const end = formatLocalDate(period.end_date);
    const rawTitle = `${period.start_date} → ${period.end_date}`;
    return `
        <span class="text-sm text-gray-600" title="${rawTitle}">${start} – ${end}</span>
        ${expirySoonChip(period)}
    `;
};

export const renderAcademicPeriodRow = (period: AcademicPeriod): string => `
    <tr class="hover:bg-gray-50 transition-colors" data-id="${period.id}">
        <td class="px-4 py-3.5 border-b border-gray-50">
            <span class="text-sm font-semibold text-gray-800">${period.academic_year}</span>
        </td>
        <td class="px-4 py-3.5 border-b border-gray-50">
            <span class="text-sm text-gray-700">${semesterTypeLabel(period.semester_type)}</span>
        </td>
        <td class="px-4 py-3.5 border-b border-gray-50">
            ${dateRangeCell(period)}
        </td>
        <td class="px-4 py-3.5 border-b border-gray-50">
            ${statusBadge(period)}
        </td>
        <td class="px-4 py-3.5 border-b border-gray-50 text-right sticky right-0 bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
            <div class="flex items-center justify-end gap-2">
                <button class="ap-edit-btn px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 border border-teal-200 rounded-lg transition-all" data-id="${period.id}">Edit</button>
                <button class="ap-toggle-btn px-3 py-1.5 text-xs font-semibold ${period.is_active ? 'text-amber-700 hover:bg-amber-50 border border-amber-200' : 'text-green-700 hover:bg-green-50 border border-green-200'} rounded-lg transition-all" data-id="${period.id}" data-active="${period.is_active}">
                    ${period.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button class="ap-delete-btn px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-all" data-id="${period.id}">Hapus</button>
            </div>
        </td>
    </tr>
`;

const renderEmptyState = (): string => `
    <tr>
        <td colspan="5" class="px-6 py-16 text-center">
            <div class="flex flex-col items-center gap-3 text-gray-400">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <p class="text-sm font-medium">Belum ada periode akademik terdaftar</p>
            </div>
        </td>
    </tr>
`;

export const renderAcademicPeriodTable = (periods: AcademicPeriod[]): string =>
    periods.length === 0 ? renderEmptyState() : periods.map(renderAcademicPeriodRow).join('');
