/**
 * "Semua Pengajuan" lets every Persuratan Tendik open letters outside their
 * assigned_tasks read-only. The backend marks each Tendik detail payload with
 * `viewer_can_act`; only an explicit `false` hides the actions (older payloads
 * without the flag keep the previous behaviour). The backend still enforces
 * the same rule on every action endpoint.
 */
export const tendikViewerCanAct = (application: unknown): boolean =>
    (application as { viewer_can_act?: unknown } | null)?.viewer_can_act !== false;

export const TENDIK_READ_ONLY_MESSAGE =
    'Jenis surat ini bukan bagian dari penugasan Anda, sehingga pengajuan hanya dapat dilihat dan dokumen pendukung dapat diunduh.';
