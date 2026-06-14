/**
 * Supporting-document metadata resolver (D2H3E2).
 *
 * Single, leaf-level source of truth for "is this supporting document present,
 * what is its display filename, and is its preview available". The backend's
 * `supporting_documents` map is the only attachment source consumed here.
 *
 * Hard boundaries: no letter/role branches, no DOM, no API calls, no route
 * strings, no renderer/page imports. Never returns a raw path, a marker, or a URL.
 */

export interface SupportingDocumentMetadata {
    exists: boolean;
    original_filename: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    preview_available: boolean;
}

export type SupportingDocumentMetadataMap = Record<string, SupportingDocumentMetadata>;

export type SupportingDocumentStateSource = 'metadata' | 'missing';

export interface SupportingDocumentState {
    exists: boolean;
    originalFilename: string | null;
    previewAvailable: boolean;
    source: SupportingDocumentStateSource;
}

export interface ResolveSupportingDocumentStateInput {
    /** The backend additive map; absent/undefined means no attachment metadata. */
    metadata?: SupportingDocumentMetadataMap | null;
    documentKey: string;
}

/**
 * Reduce backend `original_filename` to a SAFE display basename. The value still
 * comes only from metadata, but this guard prevents malformed metadata from
 * rendering a raw path, marker, URL, or route string.
 */
function sanitizedFilename(value?: string | null): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed === '') return null;

    const normalized = trimmed.replace(/\\/g, '/');
    if (/^\/?api\//i.test(normalized)) return null;

    const withoutQuery = trimmed.split(/[?#]/)[0] || trimmed;
    const segment = withoutQuery.replace(/\\/g, '/').split('/').pop() || '';
    const name = segment.trim();
    if (name === '' || name === '.' || name === '..') return null;

    try {
        return decodeURIComponent(name);
    } catch {
        return name;
    }
}

const MISSING: SupportingDocumentState = {
    exists: false,
    originalFilename: null,
    previewAvailable: false,
    source: 'missing',
};

/**
 * Resolve a single supporting document's UI state. Metadata-only: if the map
 * contains `documentKey`, that record is authoritative (including exists=false).
 * Missing maps and missing keys are treated as missing attachments.
 */
export function resolveSupportingDocumentState(
    input: ResolveSupportingDocumentStateInput,
): SupportingDocumentState {
    const { metadata, documentKey } = input;

    const metaRecord = metadata && Object.prototype.hasOwnProperty.call(metadata, documentKey)
        ? metadata[documentKey]
        : undefined;

    if (metaRecord && typeof metaRecord === 'object') {
        return {
            exists: metaRecord.exists === true,
            originalFilename: metaRecord.exists === true ? sanitizedFilename(metaRecord.original_filename) : null,
            previewAvailable: metaRecord.exists === true && metaRecord.preview_available === true,
            source: 'metadata',
        };
    }

    return MISSING;
}

/**
 * Existing-value string for the shared upload primitive's `existingValues`,
 * derived from metadata only. Returns the sanitized saved filename when the
 * document exists, or `null` when it does not.
 *
 * The upload primitive uses this for the "File tersimpan: ..." label and the
 * submit-required gate; both therefore consume the canonical metadata contract.
 */
export function existingSupportingDocumentValue(
    input: ResolveSupportingDocumentStateInput,
): string | null {
    const state = resolveSupportingDocumentState(input);
    return state.exists ? state.originalFilename : null;
}
