import type { SupportingDocumentUploadDefinition } from './supporting-document-upload';

/**
 * Typed Surat Keterangan Aktif (SKA) form adapter.
 *
 * Mirrors the magang-form / surat-tugas-form adapter shape: endpoints, draft
 * value typing, source→form mapping, and the payload builder live here so the
 * SuratKeteranganAktifForm component only renders shared primitives.
 *
 * SKA currently has NO supporting-document requirement. The empty
 * SKA_SUPPORTING_DOCUMENT_UPLOADS array is the only place that decides this; the
 * shared upload section omits itself cleanly for an empty definition list, so
 * adding a descriptor later is config-only (plus the backend contract).
 */

export const SKA_MAHASISWA_ENDPOINTS = {
    applications: '/api/mahasiswa/surat-keterangan-aktif/applications',
    draft: '/api/mahasiswa/surat-keterangan-aktif/draft',
    submit: '/api/mahasiswa/surat-keterangan-aktif/submit',
    detail: (applicationId: number | string): string => `/api/mahasiswa/surat-keterangan-aktif/${applicationId}`,
    complete: (applicationId: number | string): string => `/api/mahasiswa/surat-keterangan-aktif/${applicationId}/complete`,
    finalDownload: (applicationId: number | string): string => `/api/mahasiswa/surat-keterangan-aktif/${applicationId}/final-download`,
    generatedPreview: (applicationId: number | string): string => `/api/mahasiswa/surat-keterangan-aktif/${applicationId}/generated-preview`,
} as const;

/**
 * SKA has zero supporting documents (temporary product configuration). Kept as a
 * typed empty list so the shared upload section, listeners, and validation are
 * driven entirely by config — never by a letter-type branch.
 */
export const SKA_SUPPORTING_DOCUMENT_UPLOADS: readonly SupportingDocumentUploadDefinition[] = [];

export interface SkaFormValues {
    tempat_lahir: string;
    tanggal_lahir: string;
    jenis_kelamin: string;
    keperluan: string;
    nama_orang_tua_wali: string;
    pekerjaan_orang_tua_wali: string;
    nip_orang_tua_wali: string;
    pangkat_gol_orang_tua_wali: string;
    instansi_orang_tua_wali: string;
}

export interface SkaDraftSource {
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    jenis_kelamin?: string | null;
    keperluan?: string | null;
    nama_orang_tua_wali?: string | null;
    pekerjaan_orang_tua_wali?: string | null;
    nip_orang_tua_wali?: string | null;
    pangkat_gol_orang_tua_wali?: string | null;
    instansi_orang_tua_wali?: string | null;
}

/**
 * JSON payload posted to the SKA draft endpoint. Field names are kept exactly
 * as the backend `saveDraft` $request->only([...]) contract expects.
 */
export function createSkaDraftPayload(values: SkaFormValues): Record<string, string> {
    return {
        tempat_lahir: values.tempat_lahir,
        tanggal_lahir: values.tanggal_lahir,
        jenis_kelamin: values.jenis_kelamin,
        keperluan: values.keperluan,
        nama_orang_tua_wali: values.nama_orang_tua_wali,
        pekerjaan_orang_tua_wali: values.pekerjaan_orang_tua_wali,
        nip_orang_tua_wali: values.nip_orang_tua_wali,
        pangkat_gol_orang_tua_wali: values.pangkat_gol_orang_tua_wali,
        instansi_orang_tua_wali: values.instansi_orang_tua_wali,
    };
}
