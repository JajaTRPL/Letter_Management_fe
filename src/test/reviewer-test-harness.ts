// Bounded reviewer integration harness (jsdom). Provides DOM/event/auth helpers
// so reviewer render+attach flows can be exercised without a browser. The IO,
// app-shell, PDF.js, and navigation seams are mocked per test file via vi.mock;
// this module only holds runtime (non-hoisted) helpers + response builders.

export interface ApiCall {
    url: string;
    method?: string;
    body?: unknown;
}

/** Flush microtasks + a macrotask so async click handlers settle. */
export const flush = async (): Promise<void> => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

export const setAuthRole = (role: string, subRole?: string): void => {
    localStorage.setItem('auth_role', role);
    if (subRole) {
        localStorage.setItem('auth_sub_role', subRole);
    } else {
        localStorage.removeItem('auth_sub_role');
    }
};

export const clickById = (id: string): void => {
    (document.getElementById(id) as HTMLElement | null)?.click();
};

export const setInputValue = (id: string, value: string): void => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) el.value = value;
};

export const isHidden = (id: string): boolean =>
    document.getElementById(id)?.classList.contains('hidden') ?? true;

export const hasElement = (id: string): boolean => Boolean(document.getElementById(id));

export const bodyHtml = (): string => document.body.innerHTML;

export const resetDom = (): void => {
    document.body.innerHTML = '';
    localStorage.clear();
};

// ── Response builders ──────────────────────────────────────────────────────

const baseProfile = {
    nama_lengkap: 'Budi Santoso',
    nim: '24123456',
    fakultas: 'Sekolah Vokasi',
    program_studi: 'TRPL',
    email: 'budi@ugm.ac.id',
    no_hp: '0812000111',
};

const baseUser = {
    name: 'Budi Santoso',
    email: 'budi@ugm.ac.id',
    study_program: { name: 'TRPL', department: { name: 'DTEDI', faculty: { name: 'Sekolah Vokasi' } } },
};

const supportingPresent = (filename: string) => ({
    exists: true,
    original_filename: filename,
    mime_type: 'application/pdf',
    size_bytes: 1024,
    preview_available: true,
});

export const suratTugasDetail = (overrides: Record<string, unknown> = {}) => ({
    application: {
        id: 7,
        status: 'Submitted',
        nama_perusahaan: 'PT Contoh',
        kegiatan: 'Magang',
        posisi: 'Intern',
        dosen_pembimbing_dpa: 'Dr. Test',
        tgl_mulai: '2026-06-01',
        tgl_selesai: '2026-08-31',
        nomor_surat_tugas: null,
        supporting_documents: {
            proposal: supportingPresent('proposal.pdf'),
            surat_pengantar_magang: supportingPresent('pengantar.pdf'),
        },
        proposal_kegiatan_magang_path: 'surat-tugas/7/proposal.pdf',
        surat_pengantar_magang_path: 'surat-tugas/7/pengantar.pdf',
        submitted_at: '2026-05-25T10:00:00Z',
        mahasiswa_profile: baseProfile,
        user: baseUser,
        ...overrides,
    },
});

export const magangDetail = (overrides: Record<string, unknown> = {}) => ({
    application: {
        id: 5,
        status: 'Submitted',
        nama_perusahaan: 'PT Contoh',
        peran: 'Intern',
        dosen_pembimbing_dpa: 'Dr. Test',
        tgl_mulai: '2026-06-01',
        tgl_selesai: '2026-08-31',
        nomor_surat_pengantar: null,
        supporting_documents: {
            proposal: supportingPresent('proposal.pdf'),
        },
        proposal_kegiatan_magang_path: 'surat-pengantar-magang/5/proposal.pdf',
        submitted_at: '2026-05-25T10:00:00Z',
        mahasiswa_profile: baseProfile,
        user: baseUser,
        ...overrides,
    },
});

export const plainLetterDetail = (overrides: Record<string, unknown> = {}) => ({
    application: {
        id: 11,
        status: 'Submitted',
        nomor_surat: null,
        submitted_at: '2026-05-25T10:00:00Z',
        mahasiswa_profile: baseProfile,
        user: baseUser,
        ...overrides,
    },
});

export const scholarshipDetail = (
    overrides: Record<string, unknown> = {},
    studentOverrides: Record<string, unknown> = {},
) => ({
    application: {
        id: 42,
        status: 'Submitted',
        scholarship_name: 'Beasiswa Test',
        nomor_surat: null,
        submitted_at: '2026-05-25T10:00:00Z',
        supporting_documents: {
            transkrip_nilai: supportingPresent('transkrip.pdf'),
            slip_gaji_ayah: supportingPresent('ayah.pdf'),
            slip_gaji_ibu: supportingPresent('ibu.pdf'),
        },
        transkrip_nilai_path: 'scholarship/42/transkrip.pdf',
        slip_gaji_ayah_path: 'scholarship/42/ayah.pdf',
        slip_gaji_ibu_path: 'scholarship/42/ibu.pdf',
        mahasiswa_profile: baseProfile,
        ...overrides,
    },
    student: {
        name: 'Budi Santoso',
        nim: '24123456',
        prodi: 'TRPL',
        fakultas: 'Sekolah Vokasi',
        email: 'budi@ugm.ac.id',
        ...studentOverrides,
    },
});
