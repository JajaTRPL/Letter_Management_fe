import type { AcademicPeriod } from './types';

const SEMESTER_LABELS: Record<string, string> = {
    ganjil: 'Ganjil',
    genap:  'Genap',
};

export const semesterTypeLabel = (type: string): string =>
    SEMESTER_LABELS[type] ?? type;

const activeBadge = (isActive: boolean): string =>
    isActive
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">Aktif</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">Nonaktif</span>`;

export const renderAcademicPeriodRow = (period: AcademicPeriod): string => `
    <tr class="hover:bg-gray-50 transition-colors" data-id="${period.id}">
        <td class="px-4 py-3.5 border-b border-gray-50">
            <span class="text-sm font-semibold text-gray-800">${period.academic_year}</span>
        </td>
        <td class="px-4 py-3.5 border-b border-gray-50">
            <span class="text-sm text-gray-700">${semesterTypeLabel(period.semester_type)}</span>
        </td>
        <td class="px-4 py-3.5 border-b border-gray-50">
            <span class="text-sm text-gray-600">${period.start_date} &rarr; ${period.end_date}</span>
        </td>
        <td class="px-4 py-3.5 border-b border-gray-50">
            ${activeBadge(period.is_active)}
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
