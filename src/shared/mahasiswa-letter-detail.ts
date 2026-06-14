// Visual-only shared partials for Mahasiswa letter DETAIL pages.
//
// Goal: SKA / PLN / Magang detail pages render with the same card-based layout
// baseline as the Beasiswa detail page (ScholarshipForm.ts). These helpers are
// presentation-only — they fetch nothing, decide no workflow/status logic, and
// own no connectors. Callers pass already-resolved display strings and keep all
// behaviour, button IDs, endpoints, and the generated-preview lifecycle.
//
// Beasiswa (ScholarshipForm.ts) keeps its own equivalent local helpers and is
// intentionally NOT refactored to import these — the markup/classes here mirror
// it so the four pages look identical.

const esc = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// Long Indonesian datetime, e.g. "Jumat, 20 Feb 2026 10:07". Honest "-" fallback.
export const formatDetailDateTime = (value?: string | null): string => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    const date = parsed.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    });
    const time = parsed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
};

export const renderDetailLabelValueRow = (
    label: string,
    value: string,
    valueClass = 'text-gray-800 font-semibold',
): string => `
    <div class="flex items-center justify-between gap-4 py-3.5 border-b border-gray-50 last:border-b-0">
        <span class="text-sm text-gray-500">${esc(label)}</span>
        <span class="text-sm ${valueClass} text-right break-words">${esc(value || '-')}</span>
    </div>
`;

export type DetailRow = [label: string, value: string];

// Card matching Beasiswa "Informasi Surat" / "Pemohon" style: rounded-[24px]
// white card, bordered header title, label/value rows. Empty values render "-".
export const renderDetailInfoCard = (title: string, rows: DetailRow[]): string => `
    <div class="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
        <div class="px-7 py-5 border-b border-gray-50">
            <h3 class="text-base font-bold text-gray-800">${esc(title)}</h3>
        </div>
        <div class="px-7 py-2">
            ${rows.map(([label, value]) => renderDetailLabelValueRow(label, value)).join('')}
        </div>
    </div>
`;

export type DetailHeaderOptions = {
    backId: string;
    backLabel: string;
    title: string;
    subtitle: string;
    statusLabel: string;
    statusBadgeClass: string;
};

// Header card matching Beasiswa: back button + title/subtitle on the left,
// status badge on the right. `backId` is wired by the caller's existing handler.
export const renderDetailHeaderCard = (opts: DetailHeaderOptions): string => `
    <div class="flex flex-wrap justify-between items-start gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
        <div class="flex items-start gap-4">
            <button id="${esc(opts.backId)}" type="button" class="p-2.5 hover:bg-gray-50 rounded-xl text-gray-500 transition-colors" aria-label="${esc(opts.backLabel)}" title="${esc(opts.backLabel)}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <div>
                <h2 class="text-xl font-bold text-gray-800">${esc(opts.title)}</h2>
                <p class="text-xs text-gray-500">${esc(opts.subtitle)}</p>
            </div>
        </div>
        <span class="${opts.statusBadgeClass} px-4 py-1.5 rounded-full text-xs font-bold border w-fit">${esc(opts.statusLabel)}</span>
    </div>
`;
