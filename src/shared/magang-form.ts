import {
    getSelectedSupportingDocumentFile,
    type SupportingDocumentUploadDefinition,
    type SupportingDocumentUploadState,
} from './supporting-document-upload';
import {
    existingSupportingDocumentValue,
    type SupportingDocumentMetadataMap,
} from './supporting-document-metadata';

export interface MagangDraftValues {
    jabatan_penerima: string;
    nama_perusahaan: string;
    alamat_jalan: string;
    alamat_kelurahan: string;
    alamat_kecamatan: string;
    alamat_kota_kabupaten: string;
    alamat_provinsi: string;
    kode_pos: string;
    peran: string;
    tgl_mulai: string;
    tgl_selesai: string;
    dosen_pembimbing_dpa: string;
}

export interface MagangDraftSource {
    supporting_documents?: SupportingDocumentMetadataMap | null;
    nama_penerima?: string | null;
    jabatan_penerima?: string | null;
    nama_perusahaan?: string | null;
    alamat_jalan?: string | null;
    alamat_kelurahan?: string | null;
    alamat_kecamatan?: string | null;
    alamat_kota_kabupaten?: string | null;
    alamat_provinsi?: string | null;
    kode_pos?: string | null;
    peran?: string | null;
    tgl_mulai?: string | null;
    tgl_selesai?: string | null;
    dosen_pembimbing_dpa?: string | null;
}

export const MAGANG_MAHASISWA_ENDPOINTS = {
    applications: '/api/mahasiswa/surat-pengantar-magang/applications',
    draft: '/api/mahasiswa/surat-pengantar-magang/draft',
    submit: '/api/mahasiswa/surat-pengantar-magang/submit',
    detail: (applicationId: number | string): string => `/api/mahasiswa/surat-pengantar-magang/${applicationId}`,
} as const;

export const MAGANG_SUPPORTING_DOCUMENT_UPLOADS: readonly SupportingDocumentUploadDefinition[] = [
    {
        key: 'proposal',
        inputName: 'proposal_kegiatan_magang',
        label: 'Proposal Kegiatan Magang',
        requiredOnSubmit: true,
        accept: 'application/pdf',
        maxSizeBytes: 2 * 1024 * 1024,
    },
];

export function emptyMagangDraftValues(): MagangDraftValues {
    return {
        jabatan_penerima: '',
        nama_perusahaan: '',
        alamat_jalan: '',
        alamat_kelurahan: '',
        alamat_kecamatan: '',
        alamat_kota_kabupaten: '',
        alamat_provinsi: '',
        kode_pos: '',
        peran: '',
        tgl_mulai: '',
        tgl_selesai: '',
        dosen_pembimbing_dpa: '',
    };
}

export function mapMagangDraftValues(source: MagangDraftSource): MagangDraftValues {
    return {
        jabatan_penerima: valueOrEmpty(source.jabatan_penerima) || valueOrEmpty(source.nama_penerima),
        nama_perusahaan: valueOrEmpty(source.nama_perusahaan),
        alamat_jalan: valueOrEmpty(source.alamat_jalan),
        alamat_kelurahan: valueOrEmpty(source.alamat_kelurahan),
        alamat_kecamatan: valueOrEmpty(source.alamat_kecamatan),
        alamat_kota_kabupaten: valueOrEmpty(source.alamat_kota_kabupaten),
        alamat_provinsi: valueOrEmpty(source.alamat_provinsi),
        kode_pos: valueOrEmpty(source.kode_pos),
        peran: valueOrEmpty(source.peran),
        tgl_mulai: isoDateOnly(source.tgl_mulai),
        tgl_selesai: isoDateOnly(source.tgl_selesai),
        dosen_pembimbing_dpa: valueOrEmpty(source.dosen_pembimbing_dpa),
    };
}

export function magangExistingSupportingDocumentValues(
    source: MagangDraftSource,
): SupportingDocumentUploadState['existingValues'] {
    return {
        proposal: existingSupportingDocumentValue({
            metadata: source.supporting_documents,
            documentKey: 'proposal',
        }),
    };
}

export function createMagangDraftPayload(
    values: MagangDraftValues,
    uploadState: SupportingDocumentUploadState,
): FormData {
    const body = new FormData();

    body.append('jabatan_penerima', values.jabatan_penerima);
    body.append('nama_perusahaan', values.nama_perusahaan);
    body.append('alamat_jalan', values.alamat_jalan);
    body.append('alamat_kelurahan', values.alamat_kelurahan);
    body.append('alamat_kecamatan', values.alamat_kecamatan);
    body.append('alamat_kota_kabupaten', values.alamat_kota_kabupaten);
    body.append('alamat_provinsi', values.alamat_provinsi);
    body.append('kode_pos', values.kode_pos);
    body.append('peran', values.peran);
    body.append('tgl_mulai', values.tgl_mulai);
    body.append('tgl_selesai', values.tgl_selesai);
    body.append('dosen_pembimbing_dpa', values.dosen_pembimbing_dpa);

    // Transitional aliases remain required by the live backend template resolver.
    body.append('nama_penerima', values.jabatan_penerima);
    body.append('alamat_perusahaan', composeLegacyAddress(values));
    body.append('rentang_tanggal', composeLegacyDateRange(values.tgl_mulai, values.tgl_selesai));

    for (const definition of MAGANG_SUPPORTING_DOCUMENT_UPLOADS) {
        const file = getSelectedSupportingDocumentFile(uploadState, definition.key);
        if (file) body.append(definition.inputName, file);
    }

    return body;
}

function composeLegacyAddress(values: MagangDraftValues): string {
    return [
        values.alamat_jalan,
        values.alamat_kelurahan ? `Kel. ${values.alamat_kelurahan}` : '',
        values.alamat_kecamatan ? `Kec. ${values.alamat_kecamatan}` : '',
        values.alamat_kota_kabupaten,
        values.alamat_provinsi,
        values.kode_pos,
    ].map((segment) => segment.trim()).filter(Boolean).join(', ');
}

function composeLegacyDateRange(start: string, end: string): string {
    const startLabel = formatIndonesianDate(start);
    const endLabel = formatIndonesianDate(end);
    if (!startLabel && !endLabel) return '';
    if (startLabel && endLabel) return `${startLabel} s.d. ${endLabel}`;
    return startLabel || endLabel;
}

function formatIndonesianDate(value?: string | null): string {
    const iso = isoDateOnly(value);
    if (!iso) return '';
    const [year, month, day] = iso.split('-');
    const monthName = INDONESIAN_MONTHS[Number(month) - 1] || '';
    return monthName ? `${Number(day)} ${monthName} ${year}` : iso;
}

function isoDateOnly(value?: string | null): string {
    const match = valueOrEmpty(value).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
}

function valueOrEmpty(value?: string | null): string {
    return value ? String(value) : '';
}

const INDONESIAN_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
