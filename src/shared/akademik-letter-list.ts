import {
    getAkademikQueueLabel,
    getAssignedTaskLabel,
    getLetterStatusLabel,
    getLetterStatusTone,
    LETTER_TYPES,
    type TendikTaskRow,
} from './letter-workflow';
import { escapeFormAttribute, escapeFormHtml } from './form-primitives';
import type { ListFilterDefinition, ListOption } from './list-state';

/**
 * Akademik task/history list adapter (CP6C).
 *
 * Companion to the generic list primitives for the Akademik Dokumen (actionable)
 * and Riwayat (history) surfaces. Normalizes the `{ tasks: [...] }` array
 * contract (the FE never opts into the backend cursor feed), supplies search
 * text + type/status filters, and renders the multi-column rows preserving each
 * surface's existing markup.
 *
 * Prodi vs Departemen scope is enforced ENTIRELY server-side by sub_role — there
 * is no FE scope param — so this adapter is scope-agnostic. It also does NOT
 * import the per-letter Akademik review renderers (avoids circular-import init
 * hazards); the page maps a clicked row's `{ id, letterType }` to its own
 * dispatcher, which uses the explicit *Akademik renderers (never the Tendik
 * Beasiswa renderer).
 */

export type AkademikListMode = 'actionable' | 'history';

export interface AkademikHistoryRowShape extends TendikTaskRow {
    action_at?: string | null;
    kaprodi_approved_by_name?: string | null;
    kadep_approved_by_name?: string | null;
}

export interface AkademikListItem {
    id: string;
    letterType: string;
    typeLabel: string;
    status: string;
    studentName: string;
    nim: string;
    submittedAt: string;
    actionAt: string;
    nomorSurat: string;
    isOverdue: boolean;
    raw: AkademikHistoryRowShape;
}

export const AKADEMIK_LIST_FILTER_KEYS = {
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

/** Status label for a given mode: queue wording for actionable, history map otherwise. */
const statusLabelFor = (status: string, mode: AkademikListMode): string =>
    mode === 'actionable'
        ? getAkademikQueueLabel(status)
        : (getLetterStatusLabel(status, 'tendik-history') || status || '-');

export function tendikLabelOrType(row: TendikTaskRow): string {
    // Akademik surfaces historically show the backend-provided `type` string
    // directly; fall back to the canonical assigned-task label, then a default.
    return row.type || getAssignedTaskLabel(row.letter_type) || 'Surat Administrasi';
}

export function toAkademikListItem(row: AkademikHistoryRowShape): AkademikListItem {
    const letterType = String(row.letter_type ?? row.type ?? '');
    return {
        id: String(row.id ?? ''),
        letterType,
        typeLabel: tendikLabelOrType(row),
        status: String(row.status ?? ''),
        studentName: row.student_name || '',
        nim: row.nim || '',
        submittedAt: row.submitted_at || '',
        actionAt: row.action_at || row.submitted_at || '',
        nomorSurat: row.nomor_surat || '',
        isOverdue: Boolean(row.is_overdue),
        raw: row,
    };
}

export function toAkademikListItems(value: unknown): AkademikListItem[] {
    return (Array.isArray(value) ? (value as AkademikHistoryRowShape[]) : []).map(toAkademikListItem);
}

/** Filter definitions for a mode; status options are derived from the data. */
export function akademikListFilters(items: readonly AkademikListItem[], mode: AkademikListMode): readonly ListFilterDefinition[] {
    const seen = new Map<string, string>();
    for (const item of items) {
        if (item.status && !seen.has(item.status)) {
            seen.set(item.status, statusLabelFor(item.status, mode));
        }
    }
    const statusOptions: ListOption[] = Array.from(seen, ([value, label]) => ({ value, label }));
    return [
        { key: AKADEMIK_LIST_FILTER_KEYS.type, label: 'Jenis Surat', options: LETTER_TYPE_OPTIONS },
        { key: AKADEMIK_LIST_FILTER_KEYS.status, label: 'Status', options: statusOptions },
    ];
}

/** Search haystack mirrors the legacy per-surface `data-search` keys. */
export function akademikListSearchText(item: AkademikListItem, mode: AkademikListMode): string {
    const base = [item.studentName, item.nim, item.raw.type, item.letterType];
    if (mode === 'history') base.push(item.nomorSurat);
    return base.map((v) => String(v ?? '')).join(' ');
}

export function akademikListFilterValue(item: AkademikListItem, filterKey: string): string {
    if (filterKey === AKADEMIK_LIST_FILTER_KEYS.type) return item.letterType;
    if (filterKey === AKADEMIK_LIST_FILTER_KEYS.status) return item.status;
    return '';
}

/** Actionable (Dokumen) row — preserves the existing 5-column markup. */
export function renderAkademikActionableRow(item: AkademikListItem): string {
    const tone = getLetterStatusTone(item.status, 'akademik-review');
    return `
        <tr class="transition-colors hover:bg-gray-50/70">
            <td class="px-7 py-4 align-top">
                <p class="text-xs font-medium text-gray-500">${escapeFormHtml(item.submittedAt || '-')}</p>
                ${item.isOverdue ? `<p class="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-500"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> 24 jam tertunda</p>` : ''}
            </td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs font-bold text-gray-700">${escapeFormHtml(item.studentName || '-')}</p>
                <p class="mt-0.5 text-[10px] font-medium text-gray-400">${escapeFormHtml(item.nim || '-')}</p>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full border border-gray-200 bg-[#F1F5F9] px-3 py-1.5 text-[10px] font-bold text-gray-600">
                    ${escapeFormHtml(item.typeLabel || '-')}
                </span>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold ${escapeFormAttribute(tone)}">
                    ${escapeFormHtml(statusLabelFor(item.status, 'actionable'))}
                </span>
            </td>
            <td class="px-7 py-3 text-right align-top">
                <button class="akademik-review-btn w-full max-w-[140px] rounded-xl border-2 border-[#115E59] px-4 py-2 text-xs font-bold text-[#115E59] shadow-sm transition-colors hover:bg-[#115E59] hover:text-white" data-id="${escapeFormAttribute(item.id)}" data-letter-type="${escapeFormAttribute(item.letterType)}">
                    Review
                </button>
            </td>
        </tr>
    `;
}

/**
 * History (Riwayat) row — preserves the 6-column markup. "Lihat Detail" only
 * renders when the caller's `hasDetail` predicate confirms a reviewer resolves.
 */
export function renderAkademikHistoryRow(item: AkademikListItem, hasDetail: (letterType: string) => boolean): string {
    const tone = getLetterStatusTone(item.status, 'tendik-history');
    const detailCell = hasDetail(item.letterType)
        ? `<button type="button" data-riwayat-lihat-detail data-id="${escapeFormAttribute(item.id)}" data-letter-type="${escapeFormAttribute(item.letterType)}" class="text-xs font-bold text-[#115E59] hover:underline transition-colors">Lihat Detail</button>`
        : '<span class="text-xs text-gray-400">-</span>';

    return `
        <tr class="transition-colors hover:bg-gray-50/70">
            <td class="px-7 py-4 align-top text-xs font-medium text-gray-500">${escapeFormHtml(item.actionAt || '-')}</td>
            <td class="px-4 py-4 align-top text-xs font-semibold text-gray-600">${escapeFormHtml(item.nomorSurat || '-')}</td>
            <td class="px-4 py-4 align-top">
                <p class="text-xs font-bold text-gray-700">${escapeFormHtml(item.studentName || '-')}</p>
                <p class="mt-0.5 text-[10px] font-medium text-gray-400">${escapeFormHtml(item.nim || '-')}</p>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full border border-gray-200 bg-[#F1F5F9] px-3 py-1.5 text-[10px] font-bold text-gray-600">
                    ${escapeFormHtml(item.typeLabel || '-')}
                </span>
            </td>
            <td class="px-4 py-4 align-top">
                <span class="inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold ${escapeFormAttribute(tone)}">
                    ${escapeFormHtml(statusLabelFor(item.status, 'history'))}
                </span>
            </td>
            <td class="px-7 py-3 text-right align-top">${detailCell}</td>
        </tr>
    `;
}
