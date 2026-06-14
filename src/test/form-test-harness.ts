export interface FormApiCall {
    url: string;
    method?: string;
    body?: unknown;
    isFormData?: boolean;
}

export const flushFormEvents = async (): Promise<void> => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

export const resetFormDom = (): void => {
    document.body.innerHTML = '';
};

export const clickFormElement = (id: string): void => {
    (document.getElementById(id) as HTMLElement | null)?.click();
};

export const setFormInputValue = (id: string, value: string): void => {
    const input = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (input) input.value = value;
};

export const selectFormFile = (id: string, file: File): void => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input) throw new Error(`Missing file input: ${id}`);

    Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

export const createFormFile = (
    name: string,
    type = 'application/pdf',
    size = 16,
): File => new File([new Uint8Array(size)], name, { type });

export const formDataKeys = (body?: unknown): string[] => {
    if (!(body instanceof FormData)) return [];
    return Array.from(body.keys()).sort();
};

export const findFormApiCall = (
    calls: readonly FormApiCall[],
    url: string,
    method?: string,
): FormApiCall | undefined => calls.find((call) => call.url === url && (!method || call.method === method));

const supportingPresent = (filename: string) => ({
    exists: true,
    original_filename: filename,
    mime_type: 'application/pdf',
    size_bytes: 1024,
    preview_available: true,
});

const supportingAbsent = () => ({
    exists: false,
    original_filename: null,
    mime_type: null,
    size_bytes: null,
    preview_available: false,
});

export const suratTugasDraftApplication = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    status: 'Draft',
    nama_perusahaan: 'PT Contoh',
    kegiatan: 'Magang',
    posisi: 'Intern',
    dosen_pembimbing_dpa: 'Dr. Test',
    tgl_mulai: '2026-06-01',
    tgl_selesai: '2026-08-31',
    supporting_documents: {
        proposal: supportingPresent('proposal-kegiatan.pdf'),
        surat_pengantar_magang: supportingPresent('pengantar-magang.pdf'),
    },
    proposal_kegiatan_magang_path: 'attachment://proposal/proposal-kegiatan.pdf',
    surat_pengantar_magang_path: 'attachment://surat_pengantar_magang/pengantar-magang.pdf',
    ...overrides,
});

export const suratTugasDraftResponse = (application: Record<string, unknown> | null = null) => ({
    user: {
        name: 'Budi Santoso',
        email: 'budi@ugm.ac.id',
        study_program: {
            name: 'TRPL',
            department: { faculty: { name: 'Sekolah Vokasi' } },
        },
    },
    profile: {
        nim: '24123456',
        fakultas: 'Sekolah Vokasi',
        program_studi: 'TRPL',
    },
    profile_summary: {
        full_name: 'Budi Santoso',
        nim: '24123456',
        email: 'budi@ugm.ac.id',
        faculty: 'Sekolah Vokasi',
        study_program: 'TRPL',
    },
    application,
});

export const magangDraftApplication = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    status: 'Draft',
    jabatan_penerima: 'Direktur',
    nama_perusahaan: 'PT Contoh',
    alamat_jalan: 'Jl. Grafika No. 2',
    alamat_kelurahan: 'Sinduadi',
    alamat_kecamatan: 'Mlati',
    alamat_kota_kabupaten: 'Sleman',
    alamat_provinsi: 'D.I. Yogyakarta',
    kode_pos: '55281',
    peran: 'Intern',
    tgl_mulai: '2026-06-01',
    tgl_selesai: '2026-08-31',
    dosen_pembimbing_dpa: 'Dr. Test',
    supporting_documents: {
        proposal: supportingPresent('proposal-kegiatan.pdf'),
    },
    proposal_kegiatan_magang_path: 'attachment://proposal/proposal-kegiatan.pdf',
    ...overrides,
});

export const magangDraftResponse = (application: Record<string, unknown> | null = null) => ({
    user: {
        name: 'Budi Santoso',
        email: 'budi@ugm.ac.id',
        study_program: {
            name: 'TRPL',
            department: { faculty: { name: 'Sekolah Vokasi' } },
        },
    },
    profile: {
        nim: '24123456',
        fakultas: 'Sekolah Vokasi',
        program_studi: 'TRPL',
    },
    profile_summary: {
        full_name: 'Budi Santoso',
        nim: '24123456',
        email: 'budi@ugm.ac.id',
        faculty: 'Sekolah Vokasi',
        study_program: 'TRPL',
    },
    application,
});

// Profile block carrying the SSO identity fields SKA/PLN lock (tempat_lahir /
// tanggal_lahir / jenis_kelamin) so the forms are fully operable in tests.
const identityProfile = () => ({
    nim: '24123456',
    fakultas: 'Sekolah Vokasi',
    program_studi: 'TRPL',
    tempat_lahir: 'Sleman',
    tanggal_lahir: '2004-05-04',
    jenis_kelamin: 'L',
});

export const skaDraftApplication = (overrides: Record<string, unknown> = {}) => ({
    id: 9,
    status: 'Draft',
    tempat_lahir: 'Sleman',
    tanggal_lahir: '2004-05-04',
    jenis_kelamin: 'Laki-laki',
    keperluan: 'Syarat administrasi beasiswa',
    nama_orang_tua_wali: 'Bapak Santoso',
    pekerjaan_orang_tua_wali: 'Pegawai Swasta',
    nip_orang_tua_wali: '-',
    pangkat_gol_orang_tua_wali: '-',
    instansi_orang_tua_wali: '-',
    ...overrides,
});

export const skaDraftResponse = (application: Record<string, unknown> | null = null) => ({
    user: {
        name: 'Budi Santoso',
        email: 'budi@ugm.ac.id',
        study_program: { name: 'TRPL', department: { faculty: { name: 'Sekolah Vokasi' } } },
    },
    profile: identityProfile(),
    profile_summary: {
        full_name: 'Budi Santoso',
        nim: '24123456',
        email: 'budi@ugm.ac.id',
        faculty: 'Sekolah Vokasi',
        study_program: 'TRPL',
    },
    application,
});

export const plnDraftApplication = (overrides: Record<string, unknown> = {}) => ({
    id: 11,
    status: 'Draft',
    tempat_lahir: 'Sleman',
    tanggal_lahir: '2004-05-04',
    jenis_kelamin: 'Laki-laki',
    semester: 4,
    nomor_paspor: 'A1234567',
    keperluan: 'Surat rekomendasi student exchange',
    ...overrides,
});

export const plnDraftResponse = (application: Record<string, unknown> | null = null) => ({
    user: {
        name: 'Budi Santoso',
        email: 'budi@ugm.ac.id',
        study_program: { name: 'TRPL', department: { faculty: { name: 'Sekolah Vokasi' } } },
    },
    profile: identityProfile(),
    profile_summary: {
        full_name: 'Budi Santoso',
        nim: '24123456',
        email: 'budi@ugm.ac.id',
        faculty: 'Sekolah Vokasi',
        study_program: 'TRPL',
        current_semester: 4,
    },
    application,
});

// Beasiswa (Surat Permohonan Beasiswa) draft application — carries the 3
// supporting-document metadata plus stale path fields for negative assertions.
export const beasiswaDraftApplication = (overrides: Record<string, unknown> = {}) => ({
    id: 13,
    status: 'Draft',
    scholarship_name: 'Beasiswa Unggulan',
    study_level: 'D4',
    current_semester: 4,
    family_dependents: 3,
    gpa_last_2_semesters: 3.75,
    ipk: 3.8,
    sks_last_2_semesters: 24,
    total_sks_passed: 96,
    total_sks_required: 144,
    on_leave: 'Belum',
    thesis_status: 'Belum',
    has_scholarship_history: 0,
    supporting_documents: {
        transkrip_nilai: supportingPresent('transkrip aman.pdf'),
        slip_gaji_ayah: supportingAbsent(),
        slip_gaji_ibu: supportingAbsent(),
    },
    transkrip_nilai_path: 'attachment://transkrip_nilai/transkrip aman.pdf',
    slip_gaji_ayah_path: null,
    slip_gaji_ibu_path: null,
    mahasiswa_profile: { nim: '24123456', keluarga: [], scholarship_histories: [] },
    user: { name: 'Budi Santoso', email: 'budi@ugm.ac.id', study_program: { name: 'TRPL', department: { faculty: { name: 'Sekolah Vokasi' } } } },
    ...overrides,
});

// Beasiswa /api/profile bundle.
export const beasiswaProfileResponse = () => ({
    user: { name: 'Budi Santoso', email: 'budi@ugm.ac.id', study_program: { name: 'TRPL', department: { faculty: { name: 'Sekolah Vokasi' } } } },
    profile: {
        nim: '24123456',
        tempat_lahir: 'Sleman',
        tanggal_lahir: '2004-05-04',
        jenis_kelamin: 'L',
        keluarga: [],
        scholarship_histories: [],
    },
});
