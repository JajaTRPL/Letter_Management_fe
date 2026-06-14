import {
    accentBadgeClass,
    accentIconSurfaceClass,
    accentStroke,
    surfaceClass,
    type AccentTone,
} from './design-system';
import { escapeFormHtml } from './form-primitives';

/**
 * Presentation-only metadata for the Administrasi Surat letter cards (CP7B).
 *
 * This module owns the DISTINCT visual identity of each letter card (accent
 * tone + icon) so the repeated card shell lives in one place. It deliberately
 * holds NO behavior: no renderers, no fetch, no endpoints, no workflow status —
 * only display metadata derived from the generic design-system accent tokens.
 *
 * The page (AdministrasiSurat) keeps ownership of the dom ids it binds
 * (`card-*`, `duration-*`, the `doc-card` class) and the click → renderer
 * dispatch; this module just builds the inner markup.
 */

export interface LetterCardPresentation {
    /** Card element id the page binds clicks to (unchanged from legacy markup). */
    cardId: string;
    /** Duration badge element id the page updates from the duration API. */
    durationId: string;
    accent: AccentTone;
    title: string;
    description: string;
    /** Inner SVG path markup (without the outer <svg> tag). */
    iconBody: string;
    /** Static fallback duration label (kept identical to the legacy text). */
    durationLabel: string;
}

const CLOCK_ICON =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';

/**
 * The five Administrasi Surat cards, in their existing display order. Order,
 * ids, labels, accents and icons are byte-preserved from the legacy markup.
 */
export const ADMINISTRASI_LETTER_CARDS: readonly LetterCardPresentation[] = [
    {
        cardId: 'card-aktif',
        durationId: 'duration-aktif',
        accent: 'teal',
        title: 'Surat Keterangan Aktif',
        description: 'Surat yang menerangkan bahwa Anda adalah mahasiswa aktif.',
        iconBody: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>',
        durationLabel: '1–3 Hari Kerja',
    },
    {
        cardId: 'card-magang',
        durationId: 'duration-magang',
        accent: 'blue',
        title: 'Surat Pengantar Magang',
        description: 'Surat pengantar untuk keperluan kerja praktik atau magang.',
        iconBody: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',
        durationLabel: '2–5 Hari Kerja',
    },
    {
        cardId: 'card-beasiswa',
        durationId: 'duration-beasiswa',
        accent: 'amber',
        title: 'Surat Permohonan Beasiswa',
        description: 'Surat permohonan dari departemen untuk pengajuan beasiswa.',
        iconBody: '<circle cx="12" cy="8" r="6"></circle><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"></path>',
        durationLabel: '3–7 Hari Kerja',
    },
    {
        cardId: 'card-luar-negeri',
        durationId: 'duration-luar_negeri',
        accent: 'emerald',
        title: 'Proses Luar Negeri',
        description: 'Surat pengantar untuk keperluan visa atau studi ke luar negeri.',
        iconBody: '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>',
        durationLabel: '2–4 Hari Kerja',
    },
    {
        cardId: 'card-surat-tugas',
        durationId: 'duration-surat-tugas',
        accent: 'indigo',
        title: 'Surat Tugas',
        description: 'Surat tugas untuk keperluan kegiatan magang atau penugasan.',
        iconBody: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15l2 2 4-4"></path>',
        durationLabel: '2–5 Hari Kerja',
    },
];

/** Render one letter card — the repeated shell + accent surfaces, one source. */
export function renderLetterCard(card: LetterCardPresentation): string {
    return `
        <div id="${escapeFormHtml(card.cardId)}" class="${surfaceClass('card', 'doc-card p-6 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group')}">
            <div class="${accentIconSurfaceClass(card.accent, 'mb-4')}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${accentStroke(card.accent)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    ${card.iconBody}
                </svg>
            </div>
            <h3 class="text-base font-bold text-gray-800 mb-1">${escapeFormHtml(card.title)}</h3>
            <p class="text-sm text-gray-500 mb-4">${escapeFormHtml(card.description)}</p>
            <span id="${escapeFormHtml(card.durationId)}" class="${accentBadgeClass(card.accent)}">
                ${CLOCK_ICON}
                ${escapeFormHtml(card.durationLabel)}
            </span>
        </div>
    `;
}
