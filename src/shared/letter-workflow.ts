export const LETTER_WORKFLOW_STATUS = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    REVISION: 'Revision',
    REJECTED: 'Rejected',
    APPROVED_TENDIK: 'Approved_Tendik',
    APPROVED_KAPRODI: 'Approved_Kaprodi',
    READY_FOR_STUDENT_REVIEW: 'Ready_For_Student_Review',
    COMPLETED: 'Completed',
} as const;

export type LetterWorkflowStatus = typeof LETTER_WORKFLOW_STATUS[keyof typeof LETTER_WORKFLOW_STATUS];

export const LETTER_TYPES = {
    SURAT_PENGANTAR_MAGANG: 'surat-pengantar-magang',
    SURAT_PERMOHONAN_BEASISWA: 'surat-permohonan-beasiswa',
    SURAT_KETERANGAN_AKTIF: 'surat-keterangan-aktif',
    PROSES_LUAR_NEGERI: 'proses-luar-negeri',
    SURAT_TUGAS: 'surat-tugas',
} as const;

export type LetterType = typeof LETTER_TYPES[keyof typeof LETTER_TYPES];

export interface TendikTaskRow {
    id: number | string;
    letter_type?: string | null;
    type?: string | null;
    status?: string | null;
    submitted_at?: string | null;
    student_name?: string | null;
    nim?: string | null;
    is_overdue?: boolean;
    assigned_to?: number | null;
    assigned_tendik_name?: string | null;
    nomor_surat?: string | null;
    tendik_approved_by_name?: string | null;
    revised_by_name?: string | null;
    rejected_by_name?: string | null;
}

export type LetterStatusLabelVariant =
    | 'default'
    | 'student-list'
    | 'tendik-review'
    | 'akademik-review'
    | 'tendik-history';

export type LetterStatusToneVariant =
    | 'student-dashboard'
    | 'student-history'
    | 'student-detail'
    | 'tendik-review'
    | 'akademik-review'
    | 'tendik-history';

const {
    DRAFT,
    SUBMITTED,
    REVISION,
    REJECTED,
    APPROVED_TENDIK,
    APPROVED_KAPRODI,
    READY_FOR_STUDENT_REVIEW,
    COMPLETED,
} = LETTER_WORKFLOW_STATUS;

export const EDITABLE_LETTER_STATUSES = [DRAFT, REVISION] as const;
export const ACTIVE_READONLY_LETTER_STATUSES = [
    SUBMITTED,
    APPROVED_TENDIK,
    APPROVED_KAPRODI,
    READY_FOR_STUDENT_REVIEW,
] as const;
export const TERMINAL_LETTER_STATUSES = [COMPLETED, REJECTED] as const;
export const STUDENT_PROCESSING_STATUSES = [
    SUBMITTED,
    APPROVED_TENDIK,
    APPROVED_KAPRODI,
    READY_FOR_STUDENT_REVIEW,
] as const;

const DEFAULT_STATUS_LABELS: Record<string, string> = {
    [DRAFT]: 'Draft',
    [SUBMITTED]: 'Diajukan',
    [REVISION]: 'Perlu Revisi',
    [REJECTED]: 'Ditolak',
    [APPROVED_TENDIK]: 'Diverifikasi Tendik',
    [APPROVED_KAPRODI]: 'Disetujui Kaprodi/Sekprodi',
    [READY_FOR_STUDENT_REVIEW]: 'Menunggu Review Mahasiswa',
    [COMPLETED]: 'Selesai',
};

const STUDENT_LIST_STATUS_LABELS: Record<string, string> = {
    [READY_FOR_STUDENT_REVIEW]: 'Menunggu Review',
    [REVISION]: 'Revisi',
    [REJECTED]: 'Ditolak',
    [COMPLETED]: 'Selesai',
};

const TENDIK_REVIEW_STATUS_LABELS: Record<string, string> = {
    ...DEFAULT_STATUS_LABELS,
    [SUBMITTED]: 'Menunggu Verifikasi',
    [REVISION]: 'Revisi',
    [APPROVED_KAPRODI]: 'Disetujui Kaprodi',
};

const AKADEMIK_REVIEW_STATUS_LABELS: Record<string, string> = {
    ...TENDIK_REVIEW_STATUS_LABELS,
    [APPROVED_KAPRODI]: 'Diparaf Kaprodi/Sekprodi',
};

const TENDIK_HISTORY_STATUS_LABELS: Record<string, string> = {
    [SUBMITTED]: 'Menunggu Verifikasi',
    'Menunggu Verifikasi': 'Menunggu Verifikasi',
    [APPROVED_TENDIK]: 'Diteruskan',
    [APPROVED_KAPRODI]: 'Diteruskan',
    [READY_FOR_STUDENT_REVIEW]: 'Selesai',
    [COMPLETED]: 'Selesai',
    [REVISION]: 'Revisi',
    [REJECTED]: 'Ditolak',
};

const STATUS_LABELS_BY_VARIANT: Record<LetterStatusLabelVariant, Record<string, string>> = {
    default: DEFAULT_STATUS_LABELS,
    'student-list': STUDENT_LIST_STATUS_LABELS,
    'tendik-review': TENDIK_REVIEW_STATUS_LABELS,
    'akademik-review': AKADEMIK_REVIEW_STATUS_LABELS,
    'tendik-history': TENDIK_HISTORY_STATUS_LABELS,
};

const ASSIGNED_TASK_LABELS: Record<string, string> = {
    aktif: 'Surat Keterangan Aktif',
    'surat-keterangan-aktif': 'Surat Keterangan Aktif',
    magang: 'Surat Pengantar Magang',
    [LETTER_TYPES.SURAT_PENGANTAR_MAGANG]: 'Surat Pengantar Magang',
    beasiswa: 'Surat Permohonan Beasiswa',
    scholarship: 'Surat Permohonan Beasiswa',
    [LETTER_TYPES.SURAT_PERMOHONAN_BEASISWA]: 'Surat Permohonan Beasiswa',
    luar_negeri: 'Proses Luar Negeri',
    [LETTER_TYPES.PROSES_LUAR_NEGERI]: 'Proses Luar Negeri',
    [LETTER_TYPES.SURAT_TUGAS]: 'Surat Tugas',
};

const normalizeKey = (value?: string | null): string => String(value ?? '').trim();

export const getLetterStatusLabel = (
    status?: string | null,
    variant: LetterStatusLabelVariant = 'default',
): string => {
    const key = normalizeKey(status);
    if (!key) return '';

    const labels = STATUS_LABELS_BY_VARIANT[variant];
    if (labels[key]) return labels[key];

    return variant === 'student-list' ? 'Diproses' : key;
};

// Action-oriented label for the Akademik queue (Dashboard + Dokumen),
// where the user is the *next* approver, not the previous one.
export const getAkademikQueueLabel = (status?: string | null): string => {
    const key = normalizeKey(status);
    if (key === APPROVED_TENDIK) return 'Menunggu Paraf';
    if (key === APPROVED_KAPRODI) return 'Menunggu Tanda Tangan';
    return getLetterStatusLabel(status, 'akademik-review') || '-';
};

export const getLetterStatusTone = (
    status?: string | null,
    variant: LetterStatusToneVariant = 'student-detail',
): string => {
    const key = normalizeKey(status);

    if (variant === 'student-dashboard') {
        if (key === COMPLETED) return 'bg-teal-50 text-teal-600';
        if (key === READY_FOR_STUDENT_REVIEW || key === REVISION) return 'bg-amber-50 text-amber-600';
        if (key === REJECTED) return 'bg-[#FEE2E2] text-red-900';
        return 'bg-[#E0F2FE] text-[#0369A1]';
    }

    if (variant === 'student-history') {
        if (key === COMPLETED) return 'bg-teal-50 text-teal-600 border-teal-100';
        if (key === READY_FOR_STUDENT_REVIEW || key === REVISION) return 'bg-amber-50 text-amber-600 border-amber-100';
        if (key === REJECTED) return 'bg-red-50 text-red-600 border-red-100';
        return 'bg-blue-50 text-blue-600 border-blue-100';
    }

    if (variant === 'tendik-history') {
        if (key === 'Menunggu Verifikasi' || key === SUBMITTED) return 'bg-[#FEF08A]/60 text-yellow-800';
        if (key === APPROVED_TENDIK || key === APPROVED_KAPRODI) return 'bg-[#E0F2FE] text-[#0284C7]';
        if (key === REJECTED) return 'bg-[#FEE2E2] text-[#DC2626]';
        if (key === REVISION) return 'bg-[#FEF08A] text-[#A16207]';
        if (key === READY_FOR_STUDENT_REVIEW || key === COMPLETED) return 'bg-[#D1FAE5] text-[#059669]';
        return 'bg-gray-100 text-gray-600';
    }

    if (variant === 'tendik-review' || variant === 'akademik-review') {
        if (key === REJECTED) return 'bg-red-50 text-red-600 border-red-200';
        if (key === REVISION) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        if (key === COMPLETED || (variant === 'akademik-review' && key === APPROVED_KAPRODI)) {
            return 'bg-emerald-50 text-emerald-600 border-emerald-200';
        }
        return 'bg-[#FEF9C3] text-[#A16207] border-[#FDE047]';
    }

    if (key === REVISION) return 'bg-amber-50 text-amber-700 border-amber-100';
    if (key === REJECTED) return 'bg-red-50 text-red-700 border-red-100';
    if (key === COMPLETED) return 'bg-teal-50 text-teal-700 border-teal-100';
    if ((EDITABLE_LETTER_STATUSES as readonly string[]).includes(key)) return 'bg-gray-50 text-gray-600 border-gray-100';
    return 'bg-blue-50 text-blue-700 border-blue-100';
};

export const getLetterLabel = (letterType?: string | null): string => {
    const key = normalizeKey(letterType);
    if (!key) return 'Surat Administrasi';
    return ASSIGNED_TASK_LABELS[key] || 'Surat Administrasi';
};

export const getAssignedTaskLabel = (task?: string | null): string => {
    const key = normalizeKey(task);
    return key ? getLetterLabel(key) : '';
};

export const isMagangLetter = (letterType?: string | null): boolean => {
    const key = normalizeKey(letterType);
    return key === LETTER_TYPES.SURAT_PENGANTAR_MAGANG || key === 'magang';
};

export const isBeasiswaLetter = (letterType?: string | null): boolean => {
    const key = normalizeKey(letterType);
    return key === LETTER_TYPES.SURAT_PERMOHONAN_BEASISWA
        || key === 'beasiswa'
        || key === 'scholarship';
};

export const isLegacyBeasiswaFallback = (letterType?: string | null): boolean => {
    const key = normalizeKey(letterType);
    return !key || isBeasiswaLetter(letterType);
};

export const isAktifLetter = (letterType?: string | null): boolean => {
    const key = normalizeKey(letterType);
    return key === LETTER_TYPES.SURAT_KETERANGAN_AKTIF || key === 'aktif';
};

export const isProsesLuarNegeriLetter = (letterType?: string | null): boolean => {
    const key = normalizeKey(letterType);
    return key === LETTER_TYPES.PROSES_LUAR_NEGERI || key === 'luar_negeri';
};

export const isSuratTugasLetter = (letterType?: string | null): boolean => {
    const key = normalizeKey(letterType);
    return key === LETTER_TYPES.SURAT_TUGAS;
};

export const isStudentReviewStage = (status?: string | null): boolean => (
    normalizeKey(status) === READY_FOR_STUDENT_REVIEW
);

export const canPreviewDocument = (status?: string | null): boolean => {
    const key = normalizeKey(status);
    return key === READY_FOR_STUDENT_REVIEW || key === COMPLETED;
};

export const canCompleteSubmission = (status?: string | null, hasPreviewed = true): boolean => (
    isStudentReviewStage(status) && hasPreviewed
);

export const canDownloadDocument = (status?: string | null): boolean => (
    normalizeKey(status) === COMPLETED
);
