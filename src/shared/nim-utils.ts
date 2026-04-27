/**
 * Centralized NIM utilities — single source of truth for frontend.
 * All NIM operations (normalize, display angkatan, uppercase binding) go here.
 */

/**
 * Normalize NIM value to uppercase.
 */
export function normalizeNim(value: string): string {
    return value.toUpperCase().trim();
}

/**
 * Derive angkatan (enrollment year) from NIM prefix.
 * E.g. "24/535278/SV/12345" → "2024"
 */
export function getAngkatan(nim?: string): string {
    if (!nim || nim.length < 2) return '-';
    const match = nim.match(/^(\d{2})/);
    if (!match) return '-';
    const year = parseInt(match[1], 10);
    return year > 30 ? `19${match[1]}` : `20${match[1]}`;
}

/**
 * Attach auto-uppercase behavior to a NIM input field.
 * Preserves cursor position during transformation.
 */
export function attachNimUppercaseHandler(input: HTMLInputElement): void {
    input.addEventListener('input', () => {
        const pos = input.selectionStart;
        input.value = input.value.toUpperCase();
        input.setSelectionRange(pos, pos);
    });
}
