import {
    getLetterLabel,
    getLetterStatusLabel,
    getLetterStatusTone,
    LETTER_TYPES,
    LETTER_WORKFLOW_STATUS,
    type LetterStatusToneVariant,
} from './letter-workflow';
import { escapeFormAttribute, escapeFormHtml } from './form-primitives';
import { MAHASISWA_LETTER_ENDPOINTS } from './letter-registry';
import type { ListFilterDefinition, ListOption } from './list-state';

/**
 * Mahasiswa application-list adapter (CP6A).
 *
 * The DATA-and-presentation companion to the generic list primitives: it
 * aggregates the five Mahasiswa letter endpoints, normalizes each row into a
 * letter-agnostic-shaped MahasiswaListItem (the generic primitive never sees a
 * letter type), and supplies search text, type/status filter values, the row
 * HTML, and detail-dispatch metadata.
 *
 * It intentionally does NOT import the per-letter detail renderers — exactly
 * like letter-registry, to avoid circular-import init hazards. The page wires
 * `{ id, letterType }` from a clicked row to its own dispatcher.
 */

export interface MahasiswaListItem {
    id: string;
    letterType: string;
    label: string;
    status: string;
    statusLabel: string;
    statusTone: string;
    /** Date used for the visible "Tanggal" column (created_at, matching legacy). */
    displayDate: string | null;
    /** Sort key (submitted_at ?? created_at), already resolved by the aggregator. */
    sortDate: string | null;
    raw: any;
}

export const MAHASISWA_LIST_FILTER_KEYS = {
    type: 'type',
    status: 'status',
} as const;

const LETTER_TYPE_OPTIONS: readonly ListOption[] = [
    { value: LETTER_TYPES.SURAT_PERMOHONAN_BEASISWA, label: getLetterLabel(LETTER_TYPES.SURAT_PERMOHONAN_BEASISWA) },
    { value: LETTER_TYPES.SURAT_KETERANGAN_AKTIF, label: getLetterLabel(LETTER_TYPES.SURAT_KETERANGAN_AKTIF) },
    { value: LETTER_TYPES.SURAT_PENGANTAR_MAGANG, label: getLetterLabel(LETTER_TYPES.SURAT_PENGANTAR_MAGANG) },
    { value: LETTER_TYPES.PROSES_LUAR_NEGERI, label: getLetterLabel(LETTER_TYPES.PROSES_LUAR_NEGERI) },
    { value: LETTER_TYPES.SURAT_TUGAS, label: getLetterLabel(LETTER_TYPES.SURAT_TUGAS) },
];

// Student-facing status filter options. Values are the canonical status enum so
// they match the normalized item.status exactly; labels reuse the shared
// student-list label mapping so the dropdown reads like the badges.
const STATUS_OPTIONS: readonly ListOption[] = [
    LETTER_WORKFLOW_STATUS.DRAFT,
    LETTER_WORKFLOW_STATUS.SUBMITTED,
    LETTER_WORKFLOW_STATUS.APPROVED_TENDIK,
    LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI,
    LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW,
    LETTER_WORKFLOW_STATUS.REVISION,
    LETTER_WORKFLOW_STATUS.REJECTED,
    LETTER_WORKFLOW_STATUS.COMPLETED,
].map((status) => ({ value: status, label: getLetterStatusLabel(status, 'student-list') }));

export const mahasiswaListFilters: readonly ListFilterDefinition[] = [
    { key: MAHASISWA_LIST_FILTER_KEYS.type, label: 'Jenis Surat', options: LETTER_TYPE_OPTIONS },
    { key: MAHASISWA_LIST_FILTER_KEYS.status, label: 'Status', options: STATUS_OPTIONS },
];

/** Normalize one raw application row into a MahasiswaListItem. */
export function toMahasiswaListItem(app: any): MahasiswaListItem {
    const letterType = String(app?.letter_type ?? '');
    const status = String(app?.status ?? '');
    return {
        id: String(app?.id ?? ''),
        letterType,
        label: app?.scholarship_name || getLetterLabel(letterType),
        status,
        statusLabel: getLetterStatusLabel(status, 'student-list'),
        statusTone: getLetterStatusTone(status, 'student-history'),
        displayDate: app?.created_at ?? null,
        sortDate: app?.submitted_at ?? app?.created_at ?? null,
        raw: app,
    };
}

/**
 * Fetch + normalize + sort all five Mahasiswa letter lists. Returns the items in
 * the canonical "newest first" order (submitted_at ?? created_at desc) plus a
 * failure count so callers can surface honest partial-failure UI. No DOM, no
 * stats — stats stay page-owned.
 */
export async function loadMahasiswaApplications(
    fetcher: (url: string) => Promise<Response>,
): Promise<{ items: MahasiswaListItem[]; failedEndpointCount: number }> {
    let failedEndpointCount = 0;
    const rows: any[] = [];

    const results = await Promise.allSettled(
        MAHASISWA_LETTER_ENDPOINTS.map((endpoint) =>
            fetcher(endpoint.url).then((res) => (res.ok ? res.json() : Promise.reject(res))),
        ),
    );

    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.applications) {
            const type = MAHASISWA_LETTER_ENDPOINTS[index].type;
            for (const app of result.value.applications as any[]) {
                rows.push({ ...app, letter_type: app.letter_type || type });
            }
        } else {
            failedEndpointCount++;
        }
    });

    const items = rows.map(toMahasiswaListItem).sort((a, b) => {
        const ta = a.sortDate ? new Date(a.sortDate).getTime() : 0;
        const tb = b.sortDate ? new Date(b.sortDate).getTime() : 0;
        return tb - ta;
    });

    return { items, failedEndpointCount };
}

/** Search haystack: visible label + status label (matches what the user sees). */
export function mahasiswaListSearchText(item: MahasiswaListItem): string {
    return `${item.label} ${item.statusLabel}`;
}

/** Filter value resolver for the type/status filters. */
export function mahasiswaListFilterValue(item: MahasiswaListItem, filterKey: string): string {
    if (filterKey === MAHASISWA_LIST_FILTER_KEYS.type) return item.letterType;
    if (filterKey === MAHASISWA_LIST_FILTER_KEYS.status) return item.status;
    return '';
}

const formatLongDate = (value: string | null): string => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Riwayat table row. Mirrors the previous markup/columns exactly (date, label,
 * status badge, "Lihat Detail"); only the source is now the normalized item.
 * The whole row + the button carry data-* so the page can wire detail dispatch.
 */
export function renderMahasiswaListRow(item: MahasiswaListItem): string {
    const tone = item.statusTone as LetterStatusToneVariant | string;
    return `
        <tr class="hover:bg-gray-50/50 transition-colors group cursor-pointer" data-row-action="view-detail" data-id="${escapeFormAttribute(item.id)}" data-type="${escapeFormAttribute(item.letterType)}">
            <td class="px-8 py-5 text-sm text-gray-500 font-medium">${escapeFormHtml(formatLongDate(item.displayDate))}</td>
            <td class="px-8 py-5 text-sm font-bold text-gray-800">${escapeFormHtml(item.label)}</td>
            <td class="px-8 py-5">
                <span class="${escapeFormAttribute(String(tone))} px-4 py-1.5 rounded-full font-bold text-[11px] uppercase tracking-wider border">
                    ${escapeFormHtml(item.statusLabel)}
                </span>
            </td>
            <td class="px-8 py-5 text-right">
                <button data-action="view-detail" data-id="${escapeFormAttribute(item.id)}" data-type="${escapeFormAttribute(item.letterType)}" class="text-primary-teal font-bold text-sm hover:underline">Lihat Detail</button>
            </td>
        </tr>
    `;
}
