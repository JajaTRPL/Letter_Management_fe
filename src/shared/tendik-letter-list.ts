import {
    getAssignedTaskLabel,
    getLetterStatusLabel,
    getLetterStatusTone,
    LETTER_TYPES,
    type LetterStatusLabelVariant,
    type LetterStatusToneVariant,
    type TendikTaskRow,
} from './letter-workflow';
import { escapeFormAttribute, escapeFormHtml } from './form-primitives';
import type { ListFilterDefinition, ListOption } from './list-state';

/**
 * Tendik task/history list adapter (CP6B).
 *
 * The data-and-presentation companion to the generic list primitives for the
 * Tendik Dokumen (actionable) and Riwayat (history) surfaces. It normalizes the
 * `{ tasks: [...] }` array contract (the FE never opts into the backend cursor
 * feed, so both endpoints return full arrays), supplies search text + type/
 * status filters, and renders the multi-column rows — preserving each surface's
 * existing markup. It does NOT import the per-letter review renderers (avoids
 * circular-import init hazards, like letter-registry); the page maps a clicked
 * row's `{ id, letterType }` to its own reviewer dispatcher.
 */

export type TendikListMode = 'actionable' | 'history';

export interface TendikListItem {
    id: string;
    letterType: string;
    label: string;
    status: string;
    studentName: string;
    nim: string;
    submittedAt: string;
    isOverdue: boolean;
    assignedTendikName: string | null;
    raw: TendikTaskRow;
}

export const TENDIK_LIST_FILTER_KEYS = {
    type: 'type',
    status: 'status',
} as const;

const LETTER_TYPE_OPTIONS: readonly ListOption[] = [
    { value: LETTER_TYPES.SURAT_PERMOHONAN_BEASISWA, label: getAssignedTaskLabel(LETTER_TYPES.SURAT_PERMOHONAN_BEASISWA) },
    { value: LETTER_TYPES.SURAT_KETERANGAN_AKTIF, label: getAssignedTaskLabel(LETTER_TYPES.SURAT_KETERANGAN_AKTIF) },
    { value: LETTER_TYPES.SURAT_PENGANTAR_MAGANG, label: getAssignedTaskLabel(LETTER_TYPES.SURAT_PENGANTAR_MAGANG) },
    { value: LETTER_TYPES.PROSES_LUAR_NEGERI, label: getAssignedTaskLabel(LETTER_TYPES.PROSES_LUAR_NEGERI) },
    { value: LETTER_TYPES.SURAT_TUGAS, label: getAssignedTaskLabel(LETTER_TYPES.SURAT_TUGAS) },
];

const labelVariantFor = (mode: TendikListMode): LetterStatusLabelVariant =>
    mode === 'history' ? 'tendik-history' : 'tendik-review';

/** Filter definitions for a given mode. Status options are derived from data. */
export function tendikListFilters(items: readonly TendikListItem[], mode: TendikListMode): readonly ListFilterDefinition[] {
    const variant = labelVariantFor(mode);
    const seen = new Map<string, string>();
    for (const item of items) {
        if (item.status && !seen.has(item.status)) {
            seen.set(item.status, getLetterStatusLabel(item.status, variant) || item.status);
        }
    }
    const statusOptions: ListOption[] = Array.from(seen, ([value, label]) => ({ value, label }));

    return [
        { key: TENDIK_LIST_FILTER_KEYS.type, label: 'Jenis Surat', options: LETTER_TYPE_OPTIONS },
        { key: TENDIK_LIST_FILTER_KEYS.status, label: 'Status', options: statusOptions },
    ];
}

export function toTendikListItem(row: TendikTaskRow): TendikListItem {
    const letterType = String(row.letter_type ?? row.type ?? '');
    return {
        id: String(row.id ?? ''),
        letterType,
        label: getAssignedTaskLabel(row.letter_type) || row.type || 'Surat Administrasi',
        status: String(row.status ?? ''),
        studentName: row.student_name || '',
        nim: row.nim || '',
        submittedAt: row.submitted_at || '',
        isOverdue: Boolean(row.is_overdue),
        assignedTendikName: row.assigned_tendik_name ?? null,
        raw: row,
    };
}

/** Normalize a raw `tasks` payload into list items (assignment-safe, no sort change). */
export function toTendikListItems(value: unknown): TendikListItem[] {
    return (Array.isArray(value) ? (value as TendikTaskRow[]) : []).map(toTendikListItem);
}

/** Search haystack: the same fields the legacy per-surface filter compared. */
export function tendikListSearchText(item: TendikListItem, mode: TendikListMode): string {
    const r = item.raw;
    const base = [
        item.studentName,
        item.nim,
        r.type,
        item.letterType,
        item.label,
        getLetterStatusLabel(item.status, labelVariantFor(mode)),
        r.nomor_surat,
        item.assignedTendikName,
    ];
    if (mode === 'history') {
        base.push(r.tendik_approved_by_name, r.revised_by_name, r.rejected_by_name);
    }
    return base.map((v) => String(v ?? '')).join(' ');
}

export function tendikListFilterValue(item: TendikListItem, filterKey: string): string {
    if (filterKey === TENDIK_LIST_FILTER_KEYS.type) return item.letterType;
    if (filterKey === TENDIK_LIST_FILTER_KEYS.status) return item.status;
    return '';
}

const statusBadge = (item: TendikListItem, mode: TendikListMode): string => {
    const variant = labelVariantFor(mode);
    // 'tendik-review' / 'tendik-history' are members of both the label and tone
    // variant unions, so the same value drives both lookups.
    const label = getLetterStatusLabel(item.status, variant) || item.status || '-';
    const tone = getLetterStatusTone(item.status, variant as LetterStatusToneVariant);
    const minWidth = mode === 'history' ? 'min-w-[70px]' : 'min-w-[120px]';
    return `<span class="inline-flex items-center justify-center ${minWidth} px-3 py-1.5 rounded-full text-[10px] font-bold ${escapeFormAttribute(tone)}">${escapeFormHtml(label)}</span>`;
};

const overdueActionable = (item: TendikListItem): string => item.isOverdue
    ? `<div class="flex items-center gap-1 text-[#EF4444] mt-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span class="text-[10px] font-semibold">Melebihi 24 jam</span></div>`
    : '';

/** Actionable (Dokumen) row — preserves the existing 6-column markup. */
export function renderTendikActionableRow(item: TendikListItem): string {
    return `
        <tr class="hover:bg-gray-50/50 transition-colors">
            <td class="px-7 py-4 align-top">
                <p class="text-xs font-semibold text-gray-500 mt-0.5">${escapeFormHtml(item.submittedAt || '-')}</p>
                ${overdueActionable(item)}
            </td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs font-bold text-gray-700 mb-0.5">${escapeFormHtml(item.studentName || '-')}</p>
                <p class="text-[10px] font-medium text-gray-400">${escapeFormHtml(item.nim || '-')}</p>
            </td>
            <td class="px-4 py-4 align-top pt-5">
                <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60">
                    ${escapeFormHtml(item.label)}
                </span>
            </td>
            <td class="px-4 py-4 align-top pt-5 whitespace-nowrap">
                ${statusBadge(item, 'actionable')}
            </td>
            <td class="px-4 py-4 align-top pt-5">
                <p class="text-xs font-semibold text-gray-700">${escapeFormHtml(item.assignedTendikName || 'Belum ditugaskan')}</p>
            </td>
            <td class="px-7 py-4 align-top text-right">
                <button class="review-btn text-[11px] font-bold text-[#0D4A46] border-2 border-[#0D4A46] rounded-full px-5 py-1.5 hover:bg-[#0D4A46] hover:text-white transition-colors duration-200" data-id="${escapeFormAttribute(item.id)}" data-letter-type="${escapeFormAttribute(item.letterType)}">
                    Review Dokumen
                </button>
            </td>
        </tr>
    `;
}

const actorInfo = (item: TendikListItem): { label: string; name: string } => {
    const r = item.raw;
    if (r.rejected_by_name) return { label: 'Ditolak oleh', name: r.rejected_by_name };
    if (r.revised_by_name) return { label: 'Direvisi oleh', name: r.revised_by_name };
    if (r.tendik_approved_by_name) return { label: 'Diverifikasi oleh', name: r.tendik_approved_by_name };
    if (item.assignedTendikName) return { label: 'Penanggung jawab', name: item.assignedTendikName };
    return { label: '', name: '' };
};

/**
 * History (Riwayat) row. The "Lihat Detail" button is only rendered when the
 * caller's `hasDetail` predicate confirms a reviewer renderer resolves for the
 * letter type — preserving the legacy behavior (kept out of the adapter so it
 * never imports renderers).
 */
export function renderTendikHistoryRow(item: TendikListItem, hasDetail: (letterType: string) => boolean): string {
    const actor = actorInfo(item);
    const actorCell = actor.name
        ? `<p class="text-xs font-semibold text-gray-700">${escapeFormHtml(actor.name)}</p><p class="text-[10px] font-medium text-gray-400">${escapeFormHtml(actor.label)}</p>`
        : '<span class="text-xs text-gray-400">-</span>';

    const detailCell = hasDetail(item.letterType)
        ? `<button type="button" data-riwayat-lihat-detail data-id="${escapeFormAttribute(item.id)}" data-letter-type="${escapeFormAttribute(item.letterType)}" class="text-xs font-bold text-primary-teal hover:underline transition-colors">Lihat Detail</button>`
        : '<span class="text-xs text-gray-400">-</span>';

    return `
        <tr class="hover:bg-gray-50/50 transition-colors">
            <td class="px-7 py-4 align-top">
                <p class="text-xs font-semibold text-gray-500">${escapeFormHtml(item.submittedAt || '-')}</p>
                ${item.isOverdue ? '<p class="text-[10px] font-bold text-red-500 mt-1">&gt; 24 jam tertunda</p>' : ''}
            </td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs font-bold text-gray-700 mb-0.5">${escapeFormHtml(item.studentName || '-')}</p>
                <p class="text-[10px] font-medium text-gray-400">${escapeFormHtml(item.nim || '-')}</p>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60">
                    ${escapeFormHtml(item.label)}
                </span>
            </td>
            <td class="px-4 py-4 align-top whitespace-nowrap">
                ${statusBadge(item, 'history')}
            </td>
            <td class="px-4 py-4 align-top">${actorCell}</td>
            <td class="px-7 py-4 align-top text-right">${detailCell}</td>
        </tr>
    `;
}
