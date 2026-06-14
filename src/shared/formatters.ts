/**
 * Centralized formatting utilities — pure functions + small DOM attachers.
 *
 * Pure helpers (no DOM, no API, no storage, no side effects):
 *   - formatCodeName, trimAndCollapseWhitespace, lowercaseEmail,
 *     keepDigitsOnly, titleCaseIndonesian, titleCaseWithAcronyms,
 *     formatRupiah, parseRupiahToDigits, parseRupiahToNumber
 *
 * DOM attachers (mutate ONLY the passed input element; never query globals):
 *   - attachBlurTitleCase, attachBlurLowercaseEmail, attachBlurDigitsOnly,
 *     attachRupiahFormatter
 *
 * Phase 1 ships helpers only — no forms are wired in this turn.
 */

// ---------------------------------------------------------------------------
// Existing API (preserved)
// ---------------------------------------------------------------------------

/**
 * Formats an academic entity string (e.g. Department or Study Program).
 * Enforces the standard hyphen (-) formatting globally.
 *
 * @param code - The code of the entity (e.g. DTEDI)
 * @param name - The full name of the entity
 * @returns Formatted string (e.g. "DTEDI - Departemen Teknik Elektro dan Informatika")
 */
export const formatCodeName = (code: string, name: string): string => {
    return `${code} - ${name}`;
};

// ---------------------------------------------------------------------------
// Pure string helpers
// ---------------------------------------------------------------------------

/**
 * Trim leading/trailing whitespace and collapse internal runs of whitespace
 * (spaces, tabs, newlines) into a single space.
 *
 * Use ONLY for short single-line text inputs. Do not apply to textarea
 * paragraphs — collapsing intentional line breaks would destroy formatting.
 */
export const trimAndCollapseWhitespace = (value: string): string => {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim();
};

/**
 * Trim and lowercase an email-shaped string. Idempotent.
 */
export const lowercaseEmail = (value: string): string => {
    if (!value) return '';
    return value.trim().toLowerCase();
};

/**
 * Strip non-digit characters. Returns a STRING (never a number) so leading
 * zeros are preserved (NIM, phone numbers, postal codes, etc.).
 *
 * @param value          - Input that may contain digits + extraneous chars.
 * @param opts.passLiteralDash - When true and the trimmed input is exactly "-",
 *                               returns "-" unchanged. Used by SKA NIP fields
 *                               that intentionally accept "-" as "no NIP".
 */
export const keepDigitsOnly = (
    value: string,
    opts?: { passLiteralDash?: boolean },
): string => {
    if (!value) return '';
    const trimmed = value.trim();
    if (opts?.passLiteralDash && trimmed === '-') return '-';
    return trimmed.replace(/\D+/g, '');
};

// ---------------------------------------------------------------------------
// Title case — Indonesian-aware with acronym preservation
// ---------------------------------------------------------------------------

/**
 * Default acronym whitelist for `titleCaseWithAcronyms`. The keys are the
 * canonical UPPER-case lookup form; the values are the canonical display form
 * (which may itself be mixed-case, e.g. "IoT").
 *
 * Callers can extend this via the `opts.acronyms` argument; their entries are
 * normalized to the same lookup shape and override defaults on collision.
 */
const DEFAULT_ACRONYM_FORMS: Readonly<Record<string, string>> = {
    // Universities / institutes
    UGM: 'UGM', ITB: 'ITB', ITS: 'ITS', UNY: 'UNY', IPB: 'IPB', UI: 'UI',
    // DTEDI internal
    DTEDI: 'DTEDI', TRPL: 'TRPL', TRI: 'TRI', TRO: 'TRO', RPL: 'RPL',
    // Company / scholarship / general
    PT: 'PT', CV: 'CV', BCA: 'BCA', LPDP: 'LPDP', 'KIP-K': 'KIP-K',
    DPA: 'DPA', SKS: 'SKS', KTP: 'KTP', IOT: 'IoT',
    // Schools
    SMA: 'SMA', SMK: 'SMK', SMP: 'SMP', SD: 'SD',
    // Public sector
    PNS: 'PNS', TNI: 'TNI', POLRI: 'POLRI',
    // Administrative regions
    DIY: 'DIY', DKI: 'DKI',
    // State-owned / utilities
    BUMN: 'BUMN', BUMD: 'BUMD', PLN: 'PLN',
};

const buildAcronymMap = (extra?: ReadonlyArray<string>): Map<string, string> => {
    const map = new Map<string, string>();
    for (const [key, val] of Object.entries(DEFAULT_ACRONYM_FORMS)) {
        map.set(key, val);
    }
    if (extra) {
        for (const entry of extra) {
            if (!entry) continue;
            map.set(entry.toUpperCase(), entry);
        }
    }
    return map;
};

const hasLowerLetter = (s: string): boolean => /[a-z]/.test(s);
const hasUpperLetter = (s: string): boolean => /[A-Z]/.test(s);

/**
 * Title-case a single space-separated word with the following decision order:
 *
 *  1. If the word's uppercase form matches an acronym entry → emit canonical form.
 *  2. If the word is already mixed-case (contains both upper and lower letters)
 *     → preserve as-is (brand tokens like "eFishery", "GoTo").
 *  3. If the word is all-uppercase AND ≤ 4 chars → preserve (likely acronym).
 *  4. Otherwise → lowercase the whole word, then uppercase the FIRST alpha
 *     character only. Hyphens / punctuation inside the word are left alone.
 */
const titleCaseWord = (word: string, acronymMap: Map<string, string>): string => {
    if (!word) return word;

    const upperLookup = word.toUpperCase();
    const acro = acronymMap.get(upperLookup);
    if (acro !== undefined) return acro;

    if (hasLowerLetter(word) && hasUpperLetter(word)) return word;

    if (!hasLowerLetter(word) && hasUpperLetter(word) && word.length <= 4) {
        return word;
    }

    const lower = word.toLowerCase();
    return lower.replace(/[a-zA-Z]/, c => c.toUpperCase());
};

/**
 * Indonesian-friendly title case. Trims and collapses whitespace, then
 * title-cases each space-separated token using `titleCaseWord` without the
 * acronym whitelist. Intended for fields where you want consistent display
 * but DON'T have brand-specific tokens to preserve.
 *
 * Examples:
 *   "  jakarta   selatan  "  → "Jakarta Selatan"
 *   "kota tangerang selatan" → "Kota Tangerang Selatan"
 *
 * Note: does not split on hyphens. "anak-anak" stays "Anak-anak".
 */
export const titleCaseIndonesian = (value: string): string => {
    if (!value) return '';
    const cleaned = trimAndCollapseWhitespace(value);
    if (!cleaned) return '';
    const emptyMap = new Map<string, string>();
    return cleaned
        .split(' ')
        .map(w => titleCaseWord(w, emptyMap))
        .join(' ');
};

/**
 * Title case with acronym preservation. Uses the default whitelist plus any
 * caller-provided extras.
 *
 * Examples (default whitelist):
 *   "pt bca finance"   → "PT BCA Finance"
 *   "lpdp kip-k"        → "LPDP KIP-K"
 *   "eFishery indonesia"→ "eFishery Indonesia"  (mixed-case preserved)
 *   "SMA Negeri 8 yogya"→ "SMA Negeri 8 Yogya"
 */
export const titleCaseWithAcronyms = (
    value: string,
    opts?: { acronyms?: ReadonlyArray<string> },
): string => {
    if (!value) return '';
    const cleaned = trimAndCollapseWhitespace(value);
    if (!cleaned) return '';
    const acronymMap = buildAcronymMap(opts?.acronyms);
    return cleaned
        .split(' ')
        .map(w => titleCaseWord(w, acronymMap))
        .join(' ');
};

// ---------------------------------------------------------------------------
// Rupiah formatters
// ---------------------------------------------------------------------------

const digitsFromAny = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return '';
        // Truncate decimals; rupiah amounts are integers in this app.
        const intPart = Math.trunc(Math.abs(value)).toString();
        return intPart;
    }
    const s = String(value).trim();
    if (!s) return '';
    return s.replace(/\D+/g, '');
};

const insertThousandsDots = (digits: string): string => {
    if (!digits) return '';
    // Strip leading zeros while keeping at least one digit ("000" → "0").
    let normalized = digits.replace(/^0+/, '');
    if (normalized.length === 0) normalized = '0';
    // Insert a dot every 3 digits counting from the right.
    return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Display formatter. Always returns Indonesian-formatted thousands separators.
 *
 * Examples:
 *   "1250000"        → "1.250.000"
 *   1250000          → "1.250.000"
 *   "1.250.000"      → "1.250.000"
 *   "Rp 1.250.000"   → "1.250.000"
 *   ""/null/undefined→ ""
 */
export const formatRupiah = (value: string | number | null | undefined): string => {
    const digits = digitsFromAny(value);
    return insertThousandsDots(digits);
};

/**
 * Payload helper. Returns canonical digits-only STRING (preserves leading
 * zeros, never loses precision). Submit this to backend as a string.
 *
 * Examples:
 *   "1.250.000"     → "1250000"
 *   "Rp 1.250.000"  → "1250000"
 *   1250000         → "1250000"
 *   ""/null         → ""
 */
export const parseRupiahToDigits = (
    value: string | number | null | undefined,
): string => digitsFromAny(value);

/**
 * Optional calculation helper — returns a JS Number for safe in-UI math
 * (e.g. summing displayed rows in a totals row). Returns null for empty.
 *
 * Caveat: above 2^53 (~9 quadrillion rupiah) Number precision is unsafe.
 * Always prefer `parseRupiahToDigits` for payload submission.
 */
export const parseRupiahToNumber = (
    value: string | number | null | undefined,
): number | null => {
    const digits = digitsFromAny(value);
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------------
// DOM attachers — mutate ONLY the passed input element
// ---------------------------------------------------------------------------

/**
 * Normalize the input's value on `blur` using `titleCaseWithAcronyms`.
 * Pass `opts.acronyms` to extend the default whitelist for this field.
 */
export const attachBlurTitleCase = (
    input: HTMLInputElement,
    opts?: { acronyms?: ReadonlyArray<string> },
): void => {
    input.addEventListener('blur', () => {
        const next = titleCaseWithAcronyms(input.value, opts);
        if (next !== input.value) input.value = next;
    });
};

/**
 * Trim + lowercase the input's value on `blur`.
 */
export const attachBlurLowercaseEmail = (input: HTMLInputElement): void => {
    input.addEventListener('blur', () => {
        const next = lowercaseEmail(input.value);
        if (next !== input.value) input.value = next;
    });
};

/**
 * Strip non-digits from the input's value on `blur`. With
 * `opts.passLiteralDash=true`, a trimmed input of "-" is preserved as "-".
 */
export const attachBlurDigitsOnly = (
    input: HTMLInputElement,
    opts?: { passLiteralDash?: boolean },
): void => {
    input.addEventListener('blur', () => {
        const next = keepDigitsOnly(input.value, opts);
        if (next !== input.value) input.value = next;
    });
};

/**
 * Live rupiah formatter. On every `input` event:
 *   - extract digits-only canonical form into `input.dataset.rawValue`
 *   - re-display with Indonesian thousands separators
 *   - preserve caret position relative to the number of digits to its left
 *
 * The helper does NOT submit anything or call any API. Form serializers
 * should read `input.dataset.rawValue` as the payload value (string).
 *
 * Initialization: if the input already has a value when attached, it is
 * formatted once immediately so the displayed value matches the helper's
 * convention from first paint.
 */
export const attachRupiahFormatter = (input: HTMLInputElement): void => {
    const sync = () => {
        const digits = parseRupiahToDigits(input.value);
        const formatted = insertThousandsDots(digits);

        // Caret preservation: how many digits exist before the caret in the
        // CURRENT (pre-format) value? Reposition after the same number of
        // digits in the formatted value.
        const selectionEnd = input.selectionEnd ?? input.value.length;
        const before = input.value.slice(0, selectionEnd);
        const digitsBefore = before.replace(/\D+/g, '').length;

        input.dataset.rawValue = digits;
        if (formatted !== input.value) {
            input.value = formatted;
        }

        // Walk the formatted value to find the caret position after the same
        // number of leading digits.
        let pos = 0;
        let counted = 0;
        while (pos < formatted.length && counted < digitsBefore) {
            if (/\d/.test(formatted[pos])) counted++;
            pos++;
        }
        try {
            input.setSelectionRange(pos, pos);
        } catch {
            // Some input types (e.g. type="number") throw on setSelectionRange.
            // Helper is intended for type="text"; ignore failure as a fallback.
        }
    };

    input.addEventListener('input', sync);
    input.addEventListener('blur', sync);

    // Format any pre-populated value on first attach so dataset.rawValue is
    // always in sync with input.value after init.
    if (input.value) sync();
};
