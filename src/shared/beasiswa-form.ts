import {
    getSelectedSupportingDocumentFile,
    type SupportingDocumentUploadDefinition,
    type SupportingDocumentUploadState,
} from './supporting-document-upload';
import {
    existingSupportingDocumentValue,
    type SupportingDocumentMetadataMap,
} from './supporting-document-metadata';

/**
 * Typed Surat Permohonan Beasiswa form adapter.
 *
 * Same adapter shape as surat-tugas-form / magang-form / ska-form / pln-form:
 * endpoints, supporting-document definitions, existing-value mapping, and the
 * multipart key contract live here so the ScholarshipForm component renders the
 * shared supporting-document upload section instead of hand-rolled file markup.
 *
 * Beasiswa has THREE supporting documents (transkrip + two slip-gaji). The
 * dormant KTM field is intentionally NOT a definition here.
 */

export const BEASISWA_MAHASISWA_ENDPOINTS = {
    applications: '/api/mahasiswa/surat-permohonan-beasiswa/applications',
    step: (step: number): string => `/api/mahasiswa/surat-permohonan-beasiswa/step-${step}`,
    submit: '/api/mahasiswa/surat-permohonan-beasiswa/submit',
    detail: (applicationId: number | string): string => `/api/mahasiswa/surat-permohonan-beasiswa/${applicationId}`,
    complete: (applicationId: number | string): string => `/api/mahasiswa/surat-permohonan-beasiswa/${applicationId}/complete`,
    finalDownload: (applicationId: number | string): string => `/api/mahasiswa/surat-permohonan-beasiswa/${applicationId}/final-download`,
    generatedPreview: (applicationId: number | string): string => `/api/mahasiswa/surat-permohonan-beasiswa/${applicationId}/generated-preview`,
} as const;

/**
 * Three typed PDF supporting documents. inputName is the exact multipart key
 * the backend saveStep3 validator/registry expects. Draft saves may be partial;
 * final submit requires all active Beasiswa supporting documents.
 */
export const BEASISWA_SUPPORTING_DOCUMENT_UPLOADS: readonly SupportingDocumentUploadDefinition[] = [
    {
        key: 'transkrip_nilai',
        inputName: 'transkrip_nilai',
        label: 'Transkrip Nilai',
        requiredOnSubmit: true,
        accept: 'application/pdf',
        maxSizeBytes: 2 * 1024 * 1024,
    },
    {
        key: 'slip_gaji_ayah',
        inputName: 'slip_gaji_ayah',
        label: 'Slip Gaji / Penghasilan Ayah/Wali',
        requiredOnSubmit: true,
        accept: 'application/pdf',
        maxSizeBytes: 2 * 1024 * 1024,
    },
    {
        key: 'slip_gaji_ibu',
        inputName: 'slip_gaji_ibu',
        label: 'Slip Gaji / Penghasilan Ibu',
        requiredOnSubmit: true,
        accept: 'application/pdf',
        maxSizeBytes: 2 * 1024 * 1024,
    },
];

export interface BeasiswaSupportingSource {
    supporting_documents?: SupportingDocumentMetadataMap | null;
}

/**
 * Maps saved supporting-document state into the shared upload state's
 * existingValues, keyed by document key. A saved doc is shown only when
 * supporting_documents metadata says it exists. The shared section renders a
 * safe filename-only label.
 */
export function beasiswaExistingSupportingDocumentValues(
    source: BeasiswaSupportingSource,
): SupportingDocumentUploadState['existingValues'] {
    const value = (key: string): string | null =>
        existingSupportingDocumentValue({ metadata: source.supporting_documents, documentKey: key });
    return {
        transkrip_nilai: value('transkrip_nilai'),
        slip_gaji_ayah: value('slip_gaji_ayah'),
        slip_gaji_ibu: value('slip_gaji_ibu'),
    };
}

/**
 * Appends any newly selected supporting-document files to a FormData body using
 * the exact backend multipart keys. Existing/marker-backed documents that were
 * not re-selected are simply omitted (nullable draft semantics preserved).
 */
export function appendBeasiswaSupportingDocuments(
    body: FormData,
    uploadState: SupportingDocumentUploadState,
): void {
    for (const definition of BEASISWA_SUPPORTING_DOCUMENT_UPLOADS) {
        const file = getSelectedSupportingDocumentFile(uploadState, definition.key);
        if (file) body.append(definition.inputName, file);
    }
}
