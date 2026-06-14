import {
    isAktifLetter,
    isLegacyBeasiswaFallback,
    isMagangLetter,
    isProsesLuarNegeriLetter,
    isSuratTugasLetter,
    LETTER_TYPES,
} from './letter-workflow';

/**
 * Single source of truth for per-letter Mahasiswa endpoint identity. Previously
 * the applications-endpoint list was duplicated verbatim in MahasiswaDashboard
 * and RiwayatPengajuan, and the /complete prefix lived in a parallel typed
 * `if` chain. Centralizing the data here removes that duplication while keeping
 * each letter first-class.
 *
 * Scope note: this registry intentionally holds DATA only (keys, endpoints, and
 * the shared type predicate). Renderer dispatch stays in the page modules so
 * code-splitting and the existing static import graph are preserved (a
 * renderer-importing registry would introduce circular-import init hazards).
 *
 * `matches` reuses the canonical shared predicates from letter-workflow; the
 * Beasiswa entry's predicate doubles as the empty/unknown fallback exactly as
 * the legacy chains did, and the four specific predicates are mutually
 * exclusive, so lookup precedence is order-independent.
 */
export interface LetterRegistryEntry {
    /** Canonical letter-type key. */
    key: string;
    /** GET endpoint returning the Mahasiswa's applications for this letter. */
    applicationsEndpoint: string;
    /** Base prefix for Mahasiswa endpoints (/{id}/complete, /draft, /submit, …). */
    mahasiswaEndpointPrefix: string;
    /** Canonical shared predicate for this letter type. */
    matches: (letterType?: string | null) => boolean;
}

export const LETTER_REGISTRY: readonly LetterRegistryEntry[] = [
    {
        key: LETTER_TYPES.SURAT_PERMOHONAN_BEASISWA,
        applicationsEndpoint: '/api/mahasiswa/scholarship/applications',
        mahasiswaEndpointPrefix: '/api/mahasiswa/scholarship',
        matches: isLegacyBeasiswaFallback,
    },
    {
        key: LETTER_TYPES.SURAT_PENGANTAR_MAGANG,
        applicationsEndpoint: '/api/mahasiswa/surat-pengantar-magang/applications',
        mahasiswaEndpointPrefix: '/api/mahasiswa/surat-pengantar-magang',
        matches: isMagangLetter,
    },
    {
        key: LETTER_TYPES.SURAT_KETERANGAN_AKTIF,
        applicationsEndpoint: '/api/mahasiswa/surat-keterangan-aktif/applications',
        mahasiswaEndpointPrefix: '/api/mahasiswa/surat-keterangan-aktif',
        matches: isAktifLetter,
    },
    {
        key: LETTER_TYPES.PROSES_LUAR_NEGERI,
        applicationsEndpoint: '/api/mahasiswa/proses-luar-negeri/applications',
        mahasiswaEndpointPrefix: '/api/mahasiswa/proses-luar-negeri',
        matches: isProsesLuarNegeriLetter,
    },
    {
        key: LETTER_TYPES.SURAT_TUGAS,
        applicationsEndpoint: '/api/mahasiswa/surat-tugas/applications',
        mahasiswaEndpointPrefix: '/api/mahasiswa/surat-tugas',
        matches: isSuratTugasLetter,
    },
];

/**
 * Mahasiswa applications endpoints `{ type, url }` for the dashboard/riwayat
 * aggregators. Order is irrelevant — both callers re-sort by date after fetch.
 */
export const MAHASISWA_LETTER_ENDPOINTS: ReadonlyArray<{ type: string; url: string }> =
    LETTER_REGISTRY.map((entry) => ({ type: entry.key, url: entry.applicationsEndpoint }));

/**
 * Resolve the registry entry for a letter type via the canonical predicates.
 * The four specific letters are mutually exclusive; Beasiswa also covers the
 * empty/unknown fallback, matching the previous chains' semantics.
 */
export const resolveLetterRegistry = (letterType?: string | null): LetterRegistryEntry | undefined =>
    LETTER_REGISTRY.find((entry) => entry.matches(letterType));

/** Mahasiswa /complete (and sibling) endpoint prefix, or null if unknown. */
export const mahasiswaEndpointPrefixFor = (letterType?: string | null): string | null =>
    resolveLetterRegistry(letterType)?.mahasiswaEndpointPrefix ?? null;
