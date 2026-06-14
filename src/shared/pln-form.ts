import type { SupportingDocumentUploadDefinition } from './supporting-document-upload';

/**
 * Typed Proses Luar Negeri (PLN) form adapter.
 *
 * Same adapter shape as magang-form / surat-tugas-form / ska-form: endpoints,
 * draft typing, mapping, and the payload builder live here so the
 * ProsesLuarNegeriForm component only renders shared primitives.
 *
 * PLN currently has NO supporting-document requirement. The empty
 * PLN_SUPPORTING_DOCUMENT_UPLOADS array is the single source of that fact; the
 * shared upload section omits itself for an empty list with no letter branch.
 */

export const PLN_MAHASISWA_ENDPOINTS = {
    applications: '/api/mahasiswa/proses-luar-negeri/applications',
    draft: '/api/mahasiswa/proses-luar-negeri/draft',
    submit: '/api/mahasiswa/proses-luar-negeri/submit',
    detail: (applicationId: number | string): string => `/api/mahasiswa/proses-luar-negeri/${applicationId}`,
    complete: (applicationId: number | string): string => `/api/mahasiswa/proses-luar-negeri/${applicationId}/complete`,
    finalDownload: (applicationId: number | string): string => `/api/mahasiswa/proses-luar-negeri/${applicationId}/final-download`,
    generatedPreview: (applicationId: number | string): string => `/api/mahasiswa/proses-luar-negeri/${applicationId}/generated-preview`,
} as const;

/**
 * PLN has zero supporting documents (temporary product configuration). Typed
 * empty list keeps the shared upload section config-driven, never branched.
 */
export const PLN_SUPPORTING_DOCUMENT_UPLOADS: readonly SupportingDocumentUploadDefinition[] = [];

export interface PlnFormValues {
    tempat_lahir: string;
    tanggal_lahir: string;
    jenis_kelamin: string;
    semester: string;
    nomor_paspor: string;
    keperluan: string;
}

export interface PlnDraftSource {
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    jenis_kelamin?: string | null;
    semester?: number | string | null;
    nomor_paspor?: string | null;
    keperluan?: string | null;
}

/**
 * JSON payload posted to the PLN draft endpoint. Field names and the numeric
 * `semester` cast match the backend `saveDraft` $request->only([...]) contract.
 */
export function createPlnDraftPayload(values: PlnFormValues): Record<string, string | number> {
    return {
        tempat_lahir: values.tempat_lahir,
        tanggal_lahir: values.tanggal_lahir,
        jenis_kelamin: values.jenis_kelamin,
        semester: Number(values.semester),
        nomor_paspor: values.nomor_paspor,
        keperluan: values.keperluan,
    };
}
