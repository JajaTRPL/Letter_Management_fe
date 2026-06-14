import {
    getSelectedSupportingDocumentFile,
    type SupportingDocumentUploadDefinition,
    type SupportingDocumentUploadState,
} from './supporting-document-upload';
import {
    existingSupportingDocumentValue,
    type SupportingDocumentMetadataMap,
} from './supporting-document-metadata';

export interface SuratTugasDraftValues {
    nama_perusahaan: string;
    kegiatan: string;
    posisi: string;
    dosen_pembimbing_dpa: string;
    tgl_mulai: string;
    tgl_selesai: string;
}

export interface SuratTugasDraftSource {
    supporting_documents?: SupportingDocumentMetadataMap | null;
    nama_perusahaan?: string | null;
    kegiatan?: string | null;
    posisi?: string | null;
    dosen_pembimbing_dpa?: string | null;
    tgl_mulai?: string | null;
    tgl_selesai?: string | null;
}

export const SURAT_TUGAS_MAHASISWA_ENDPOINTS = {
    applications: '/api/mahasiswa/surat-tugas/applications',
    draft: '/api/mahasiswa/surat-tugas/draft',
    submit: '/api/mahasiswa/surat-tugas/submit',
    detail: (applicationId: number | string): string => `/api/mahasiswa/surat-tugas/${applicationId}`,
} as const;

export const SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS: readonly SupportingDocumentUploadDefinition[] = [
    {
        key: 'proposal',
        inputName: 'proposal_kegiatan_magang',
        label: 'Proposal Kegiatan Magang',
        requiredOnSubmit: true,
        accept: 'application/pdf',
        maxSizeBytes: 2 * 1024 * 1024,
    },
    {
        key: 'surat_pengantar_magang',
        inputName: 'surat_pengantar_magang',
        label: 'Surat Pengantar Magang',
        requiredOnSubmit: true,
        accept: 'application/pdf',
        maxSizeBytes: 2 * 1024 * 1024,
    },
];

export function emptySuratTugasDraftValues(): SuratTugasDraftValues {
    return {
        nama_perusahaan: '',
        kegiatan: '',
        posisi: '',
        dosen_pembimbing_dpa: '',
        tgl_mulai: '',
        tgl_selesai: '',
    };
}

export function mapSuratTugasDraftValues(source: SuratTugasDraftSource): SuratTugasDraftValues {
    return {
        nama_perusahaan: valueOrEmpty(source.nama_perusahaan),
        kegiatan: valueOrEmpty(source.kegiatan),
        posisi: valueOrEmpty(source.posisi),
        dosen_pembimbing_dpa: valueOrEmpty(source.dosen_pembimbing_dpa),
        tgl_mulai: isoDateOnly(source.tgl_mulai),
        tgl_selesai: isoDateOnly(source.tgl_selesai),
    };
}

export function suratTugasExistingSupportingDocumentValues(
    source: SuratTugasDraftSource,
): SupportingDocumentUploadState['existingValues'] {
    return {
        proposal: existingSupportingDocumentValue({
            metadata: source.supporting_documents,
            documentKey: 'proposal',
        }),
        surat_pengantar_magang: existingSupportingDocumentValue({
            metadata: source.supporting_documents,
            documentKey: 'surat_pengantar_magang',
        }),
    };
}

export function createSuratTugasDraftPayload(
    values: SuratTugasDraftValues,
    uploadState: SupportingDocumentUploadState,
): FormData {
    const body = new FormData();
    body.append('nama_perusahaan', values.nama_perusahaan);
    body.append('kegiatan', values.kegiatan);
    body.append('posisi', values.posisi);
    body.append('dosen_pembimbing_dpa', values.dosen_pembimbing_dpa);
    body.append('tgl_mulai', values.tgl_mulai);
    body.append('tgl_selesai', values.tgl_selesai);

    for (const definition of SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS) {
        const file = getSelectedSupportingDocumentFile(uploadState, definition.key);
        if (file) body.append(definition.inputName, file);
    }

    return body;
}

function valueOrEmpty(value?: string | null): string {
    return value ? String(value) : '';
}

function isoDateOnly(value?: string | null): string {
    const match = valueOrEmpty(value).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
}
