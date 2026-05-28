import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import { attachProtectedPdfViewer, renderProtectedPdfViewer } from '../shared/protected-pdf-viewer';
import {
    mergeMahasiswaProfileDisplay,
    type MahasiswaProfileDisplay,
} from '../shared/mahasiswa-profile-source';
import {
    activePageForDetailOrigin,
    backLabelForDetailOrigin,
    goToMahasiswaDetailOrigin,
    type MahasiswaDetailOrigin,
    type MahasiswaDetailNavigationOptions,
    resolveDetailOrigin,
} from './detail-navigation';
import {
    ACTIVE_READONLY_LETTER_STATUSES,
    canDownloadDocument,
    getLetterLabel,
    getLetterStatusLabel,
    getLetterStatusTone,
    isStudentReviewStage,
    LETTER_TYPES,
    LETTER_WORKFLOW_STATUS,
} from '../shared/letter-workflow';
import { showError, showSuccess, showWarning } from '../shared/toast';

type ProsesLuarNegeriApplication = {
    id: number;
    status: string;
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    jenis_kelamin?: string | null;
    semester?: number | string | null;
    nomor_paspor?: string | null;
    keperluan?: string | null;
    revision_note?: string | null;
    rejection_reason?: string | null;
    generated_pdf_path?: string | null;
    created_at?: string | null;
    submitted_at?: string | null;
    student_reviewed_at?: string | null;
    mahasiswa_profile?: StudentProfile | null;
    user?: StudentUser | null;
};

type StudentProfile = {
    nim?: string | null;
    fakultas?: string | null;
    program_studi?: string | null;
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    jenis_kelamin?: string | null;
};

type StudentUser = {
    name?: string | null;
    email?: string | null;
    study_program?: {
        name?: string | null;
        department?: {
            faculty?: {
                name?: string | null;
            } | null;
        } | null;
    } | null;
};

type ProsesLuarNegeriFormData = {
    tempat_lahir: string;
    tanggal_lahir: string;
    tanggal_lahir_day: string;
    tanggal_lahir_month: string;
    tanggal_lahir_year: string;
    jenis_kelamin: string;
    semester: string;
    nomor_paspor: string;
    keperluan: string;
};

type ProfileViewData = MahasiswaProfileDisplay;

const API_PREFIX = '/api/mahasiswa/proses-luar-negeri';
const GENERATED_LETTER_PREVIEW_ROOT_ID = 'pln-mahasiswa-generated-letter-preview';
const MONTH_NAMES = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
];

const activeEntryStatuses: readonly string[] = [
    ...ACTIVE_READONLY_LETTER_STATUSES,
    LETTER_WORKFLOW_STATUS.REVISION,
];

let currentStep = 1;
let application: ProsesLuarNegeriApplication | null = null;
let formData: ProsesLuarNegeriFormData = emptyFormData();
let profileData: ProfileViewData = emptyProfileData();
let hasAcceptedStatement = false;
let isSubmitting = false;
let revokeGeneratedLetterPreview: (() => void) | null = null;
// Identity-lock state: tempat_lahir / tanggal_lahir / jenis_kelamin are
// sourced exclusively from the SSO profile. If any are missing on the wire,
// continuing/submitting the form is blocked and the labels listed here are
// surfaced in the warning banner.
let profileIdentityMissing: string[] = [];

const cleanupGeneratedLetterPreview = (): void => {
    if (!revokeGeneratedLetterPreview) return;
    revokeGeneratedLetterPreview();
    revokeGeneratedLetterPreview = null;
};

const renderGeneratedLetterPreviewCard = (): string => renderProtectedPdfViewer(GENERATED_LETTER_PREVIEW_ROOT_ID, {
    title: 'Pratinjau Proses Luar Negeri',
    subtitle: 'Pratinjau PDF dokumen pengajuan',
    loading: 'Memuat pratinjau surat...',
});

export const renderProsesLuarNegeriForm = async (forceEditRevision = false) => {
    resetState();
    renderLoading('Memuat formulir Proses Luar Negeri...');

    try {
        if (!forceEditRevision) {
            const activeApplication = await fetchLatestActiveApplication();
            if (activeApplication) {
                renderProsesLuarNegeriDetail(activeApplication.id);
                return;
            }
        }

        const draftData = await fetchDraftData();
        const draftSource = {
            profile_summary: draftData.profile_summary,
            user: draftData.user,
            profile: draftData.profile,
            application: draftData.application,
        };
        profileData = mergeMahasiswaProfileDisplay(draftSource);
        validateProfileIdentity(draftData.profile);

        if (draftData.application) {
            application = draftData.application;
            formData = mapApplicationData(draftData.application);
        }

        // Identity is profile-sourced and always overrides whatever the
        // application row may have stored (locked, no manual override).
        lockIdentityFromProfile(draftData.profile);

        // Semester prefill from the canonical AcademicContextService
        // computation, now exposed via /draft.profile_summary.current_semester
        // (Global Profile.1). Fills empty values only — a saved draft /
        // revision still wins, and the field stays editable so administrative
        // overrides remain possible.
        applySemesterPrefill(profileData.currentSemester);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal memuat formulir Proses Luar Negeri.');
    }

    renderForm();
};

export const renderProsesLuarNegeriDetail = async (applicationId: number | string, options?: MahasiswaDetailNavigationOptions) => {
    const origin = resolveDetailOrigin(options);
    const activePage = activePageForDetailOrigin(origin);

    cleanupGeneratedLetterPreview();
    renderLoading('Memuat detail pengajuan...', activePage);

    try {
        // With Global Profile.1 the PLN detail endpoint ships an additive
        // root-level `profile_summary` block, so the previous parallel
        // /api/profile fallback is no longer needed.
        const response = await apiFetch(`${API_PREFIX}/${applicationId}`, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        const detailApplication = payload.application as ProsesLuarNegeriApplication;
        const viewProfile = mergeMahasiswaProfileDisplay({
            profile_summary: payload.profile_summary,
            user: detailApplication.user,
            profile: detailApplication.mahasiswa_profile,
            application: detailApplication,
        });

        renderDashboardLayout('Detail Pengajuan', renderDetailContent(detailApplication, viewProfile, origin), 'mahasiswa', activePage);
        attachDetailEvents(detailApplication, origin);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal memuat detail pengajuan.');
        goToMahasiswaDetailOrigin(origin);
    }
};

const resetState = () => {
    currentStep = 1;
    application = null;
    formData = emptyFormData();
    profileData = emptyProfileData();
    hasAcceptedStatement = false;
    isSubmitting = false;
    profileIdentityMissing = [];
};

function emptyFormData(): ProsesLuarNegeriFormData {
    return {
        tempat_lahir: '',
        tanggal_lahir: '',
        tanggal_lahir_day: '',
        tanggal_lahir_month: '',
        tanggal_lahir_year: '',
        jenis_kelamin: '',
        semester: '',
        nomor_paspor: '',
        keperluan: '',
    };
}

function emptyProfileData(): ProfileViewData {
    return {
        fullName: '',
        nim: '',
        email: '',
        faculty: '',
        studyProgram: '',
        studyProgramCode: '',
        department: '',
        tempatLahir: '',
        tanggalLahir: '',
        jenisKelamin: '',
        currentSemester: null,
    };
}

const fetchDraftData = async () => {
    const response = await apiFetch(`${API_PREFIX}/draft`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response));
    }

    return await response.json();
};

const fetchLatestActiveApplication = async (): Promise<ProsesLuarNegeriApplication | null> => {
    const response = await apiFetch(`${API_PREFIX}/applications`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        return null;
    }

    const payload = await response.json();
    const applications = (payload.applications || []) as ProsesLuarNegeriApplication[];

    return applications.find((item) => activeEntryStatuses.includes(item.status)) || null;
};

// Profile display is now sourced via the shared mahasiswa-profile-source
// helper. Each caller passes whichever payload shapes it has on hand —
// /draft, /api/profile, or detail-application — and the merger picks the
// first real value for every field with a documented precedence chain.

const mapApplicationData = (app: ProsesLuarNegeriApplication): ProsesLuarNegeriFormData => {
    const mapped = emptyFormData();
    const dateParts = parseDateParts(app.tanggal_lahir);

    mapped.tempat_lahir = valueOrEmpty(app.tempat_lahir);
    mapped.tanggal_lahir = dateParts.isoDate;
    mapped.tanggal_lahir_day = dateParts.day;
    mapped.tanggal_lahir_month = dateParts.month;
    mapped.tanggal_lahir_year = dateParts.year;
    mapped.jenis_kelamin = valueOrEmpty(app.jenis_kelamin);
    mapped.semester = app.semester === null || app.semester === undefined ? '' : String(app.semester);
    mapped.nomor_paspor = valueOrEmpty(app.nomor_paspor);
    mapped.keperluan = valueOrEmpty(app.keperluan);

    return mapped;
};

// PLN treats identity (tempat_lahir / tanggal_lahir / jenis_kelamin) as
// profile-locked, mirroring SKA. The form does not allow the student to
// edit these in step 2 — the values are always overwritten from the SSO
// profile on load so the saved/legacy application's editable copy can
// never drift.
const lockIdentityFromProfile = (profile?: StudentProfile | null) => {
    formData.tempat_lahir = String(profile?.tempat_lahir ?? '').trim();
    const parts = parseDateParts(profile?.tanggal_lahir);
    formData.tanggal_lahir = parts.isoDate;
    formData.tanggal_lahir_day = parts.day;
    formData.tanggal_lahir_month = parts.month;
    formData.tanggal_lahir_year = parts.year;
    formData.jenis_kelamin = genderEnumToLabel(profile?.jenis_kelamin);
};

const validateProfileIdentity = (profile?: StudentProfile | null): void => {
    const missing: string[] = [];
    if (!String(profile?.tempat_lahir ?? '').trim()) missing.push('Tempat Lahir');
    if (!normalizeDateOnly(profile?.tanggal_lahir)) missing.push('Tanggal Lahir');
    if (!genderEnumToLabel(profile?.jenis_kelamin)) missing.push('Jenis Kelamin');
    profileIdentityMissing = missing;
};

const genderEnumToLabel = (value?: string | null): string => {
    const upper = String(value ?? '').trim().toUpperCase();
    if (upper === 'L') return 'Laki-laki';
    if (upper === 'P') return 'Perempuan';
    return '';
};

// Canonical current_semester is computed on the backend in
// AcademicContextService from the NIM angkatan + the active AcademicPeriod.
// As of Global Profile.1 it is exposed directly on /draft.profile_summary,
// so the shared merger surfaces it as `profileData.currentSemester` and we
// no longer need a separate /api/profile round-trip. The field stays
// editable so administrative cases (cuti, lambat lulus, etc.) can override.

const applySemesterPrefill = (currentSemester: number | null): void => {
    if (currentSemester === null) return;
    if (formData.semester.trim()) return;
    formData.semester = String(currentSemester);
};

const renderLoading = (message: string, activePage = 'administrasi') => {
    renderDashboardLayout('Formulir Surat', `
        <div class="max-w-5xl mx-auto">
            <div class="bg-white border border-gray-100 rounded-[24px] p-10 shadow-sm flex items-center gap-4">
                <div class="w-9 h-9 rounded-full border-4 border-teal-100 border-t-primary-teal animate-spin"></div>
                <p class="text-sm font-semibold text-gray-600">${escapeHtml(message)}</p>
            </div>
        </div>
    `, 'mahasiswa', activePage);
};

const renderForm = () => {
    const isRevision = application?.status === LETTER_WORKFLOW_STATUS.REVISION;
    const content = `
        <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
            ${isRevision ? renderRevisionBanner(application?.revision_note) : ''}
            ${renderStepper()}

            <section class="bg-white rounded-[18px] border border-gray-200 shadow-sm overflow-hidden">
                <form id="proses-luar-negeri-form" class="p-6 md:p-12">
                    ${renderStepContent()}
                    ${renderNavigationButtons()}
                </form>
            </section>
        </div>
    `;

    renderDashboardLayout('Formulir Surat', content, 'mahasiswa', 'administrasi');
    attachFormEvents();
};

const renderStepper = () => {
    const steps = [
        { number: 1, label: 'Profil SSO' },
        { number: 2, label: 'Detail Profil & Pengajuan' },
        { number: 3, label: 'Tinjau Pengajuan' },
    ];

    return `
        <nav class="bg-white rounded-[18px] border border-gray-200 shadow-sm px-5 py-4" aria-label="Tahap formulir">
            <ol class="grid grid-cols-1 gap-3 md:grid-cols-3">
                ${steps.map((step, index) => {
                    const isComplete = currentStep > step.number;
                    const isCurrent = currentStep === step.number;
                    return `
                        <li class="flex items-center gap-3 ${isCurrent ? 'text-gray-900' : 'text-gray-400'}">
                            <span class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isComplete ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-white text-primary-teal border-2 border-primary-teal' : 'bg-gray-100 text-gray-400'}">
                                ${isComplete ? iconCheck('18') : step.number}
                            </span>
                            <span class="text-sm font-bold">${escapeHtml(step.label)}</span>
                            ${index < steps.length - 1 ? `<span class="hidden md:block ml-auto text-gray-700">${iconChevronRight('18')}</span>` : ''}
                        </li>
                    `;
                }).join('')}
            </ol>
        </nav>
    `;
};

const renderStepContent = () => {
    if (currentStep === 1) {
        return `
            <div class="space-y-8">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">Profil SSO</h2>
                    <p class="text-sm text-gray-600 mt-2">Periksa kesesuaian data profil dengan data yang terdaftar pada sistem</p>
                </div>
                <div class="space-y-4 max-w-4xl">
                    ${renderReadonlyField('Nama Lengkap', profileData.fullName)}
                    ${renderReadonlyField('NIM', profileData.nim)}
                    ${renderReadonlyField('Fakultas', profileData.faculty)}
                    ${renderReadonlyField('Program Studi', profileData.studyProgram)}
                    ${renderReadonlyField('Email Aktif', profileData.email)}
                </div>
            </div>
        `;
    }

    if (currentStep === 2) {
        return `
            <div class="space-y-9">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800">Detail Profil & Pengajuan</h2>
                    <p class="text-sm text-gray-600 mt-2">Lengkapi data berikut sesuai kebutuhan pengajuan surat</p>
                </div>

                ${renderIdentityLockCard()}

                <div class="space-y-5">
                    ${renderNumberInputWithHint('semester', 'Semester', 'Contoh: 4', formData.semester, 'Diisi otomatis dari profil bila tersedia. Anda dapat menyesuaikan bila perlu.')}
                    ${renderTextInput('nomor_paspor', 'Nomor Paspor', 'Contoh: A1234567', formData.nomor_paspor)}
                    ${renderTextarea('keperluan', 'Keperluan', 'Contoh: Surat rekomendasi pendaftaran student exchange ke universitas tujuan', formData.keperluan)}
                </div>
            </div>
        `;
    }

    return `
        <div class="space-y-8">
            <div>
                <h2 class="text-2xl font-bold text-gray-800">Tinjau Pengajuan</h2>
                <p class="text-sm text-gray-600 mt-2">Periksa kembali kebenaran data yang Anda masukkan</p>
            </div>

            <div class="space-y-8">
                ${renderReviewSection('Profil SSO', [
                    ['Nama Lengkap', profileData.fullName],
                    ['NIM', profileData.nim],
                    ['Fakultas', profileData.faculty],
                    ['Program Studi', profileData.studyProgram],
                    ['Email Aktif', profileData.email],
                ])}
                ${renderReviewSection('Detail Profil & Pengajuan', [
                    ['Tempat, Tanggal Lahir', formatPlaceAndDate()],
                    ['Jenis Kelamin', formData.jenis_kelamin],
                    ['Semester', formData.semester],
                    ['Nomor Paspor', formData.nomor_paspor],
                    ['Keperluan', formData.keperluan],
                ])}
            </div>

            <label class="flex items-start gap-4 text-sm text-gray-700 cursor-pointer">
                <input id="agreement-checkbox" type="checkbox" ${hasAcceptedStatement ? 'checked' : ''} class="mt-1 w-4 h-4 rounded border-gray-300 text-primary-teal focus:ring-primary-teal">
                <span>Dengan ini saya menyatakan bahwa seluruh data yang saya kirimkan adalah benar dan dapat dipertanggungjawabkan</span>
            </label>
        </div>
    `;
};

const renderReadonlyField = (label: string, value: string) => `
    <div class="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2 md:gap-6 md:items-center">
        <label class="text-sm font-bold text-gray-900">${escapeHtml(label)}</label>
        <input type="text" value="${escapeAttribute(value || '-')}" readonly class="w-full px-4 py-2.5 bg-[#E1E3E8] border border-[#E1E3E8] rounded-lg text-gray-500 cursor-not-allowed outline-none">
    </div>
`;

const renderTextInput = (name: keyof ProsesLuarNegeriFormData, label: string, placeholder: string, value: string) => `
    <div class="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-3 md:gap-6 md:items-center">
        <label for="${name}" class="text-sm font-semibold text-gray-800">${escapeHtml(label)}</label>
        <input id="${name}" name="${name}" type="text" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">
    </div>
`;

const renderTextarea = (name: keyof ProsesLuarNegeriFormData, label: string, placeholder: string, value: string) => `
    <div class="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-3 md:gap-6 md:items-start">
        <label for="${name}" class="text-sm font-semibold text-gray-800 pt-2">${escapeHtml(label)}</label>
        <textarea id="${name}" name="${name}" rows="3" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">${escapeHtml(value)}</textarea>
    </div>
`;

// PLN identity rows are locked: values come from the SSO profile. Editing
// must be done on the Profil Mahasiswa page, never inside this form.
// Mirrors the SKA identity card so the two letter forms share visual
// language for "profile-connected, read-only".
const renderIdentityLockCard = (): string => {
    const place = formData.tempat_lahir.trim();
    const dateLabel = formatIndonesianDate(formData.tanggal_lahir);
    const placeAndDate = [place, dateLabel].filter(Boolean).join(', ');
    const gender = formData.jenis_kelamin;
    const missing = profileIdentityMissing;
    const hasMissing = missing.length > 0;

    return `
        <div class="space-y-4">
            <div class="bg-teal-50 border border-teal-100 p-5 rounded-2xl flex gap-4 items-start shadow-sm">
                <div class="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </div>
                <div class="flex-1">
                    <h4 class="text-sm font-bold text-teal-800 mb-1">Data Terhubung dengan Profil</h4>
                    <p class="text-xs text-teal-700/80 leading-relaxed">Tempat &amp; Tanggal Lahir serta Jenis Kelamin diambil otomatis dari profil Anda. Jika perlu diperbarui, silakan ubah melalui halaman <span class="font-bold">Profil Mahasiswa</span>.</p>
                </div>
            </div>

            <div class="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
                <div class="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-6 md:items-baseline">
                    <label class="text-sm font-bold text-gray-800">Tempat, Tanggal Lahir</label>
                    <p class="text-sm font-medium text-gray-700">${escapeHtml(placeAndDate || '-')}</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-6 md:items-baseline">
                    <label class="text-sm font-bold text-gray-800">Jenis Kelamin</label>
                    <p class="text-sm font-medium text-gray-700">${escapeHtml(gender || '-')}</p>
                </div>
            </div>

            ${hasMissing ? `
                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3" role="alert">
                    <div class="text-amber-600 shrink-0">${iconAlert('22')}</div>
                    <div class="flex-1 space-y-1">
                        <p class="font-bold text-amber-900">Data profil belum lengkap</p>
                        <p class="text-sm text-amber-800">Lengkapi data berikut pada Profil Mahasiswa sebelum melanjutkan pengajuan:</p>
                        <ul class="text-sm text-amber-800 list-disc list-inside font-semibold">
                            ${missing.map((label) => `<li>${escapeHtml(label)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
};

const renderNumberInputWithHint = (name: keyof ProsesLuarNegeriFormData, label: string, placeholder: string, value: string, hint: string) => `
    <div class="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-3 md:gap-6 md:items-start">
        <label for="${name}" class="text-sm font-semibold text-gray-800 md:pt-2">${escapeHtml(label)}</label>
        <div class="space-y-1">
            <input id="${name}" name="${name}" type="number" min="1" max="14" step="1" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">
            <p class="text-xs text-gray-500 leading-relaxed">${escapeHtml(hint)}</p>
        </div>
    </div>
`;

const renderReviewSection = (title: string, rows: [string, string][]) => `
    <section class="bg-[#F0F8F7] rounded-2xl p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-5">${escapeHtml(title)}</h3>
        <div class="space-y-3">
            ${rows.map(([label, value]) => `
                <div class="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 text-sm text-gray-700">
                    <span class="font-semibold">${escapeHtml(label)}</span>
                    <span class="break-words">: ${escapeHtml(value || '-')}</span>
                </div>
            `).join('')}
        </div>
    </section>
`;

const renderNavigationButtons = () => {
    const isSubmitStep = currentStep === 3;
    // Profile-identity gate: any step that would lead to a payload (advancing
    // past step 1, or submitting on step 3) is blocked when the SSO profile
    // lacks tempat_lahir / tanggal_lahir / jenis_kelamin.
    const identityBlocked = currentStep > 1 && profileIdentityMissing.length > 0;
    const submitDisabled = (isSubmitStep && !hasAcceptedStatement) || identityBlocked;
    const nextLabel = isSubmitStep
        ? application?.status === LETTER_WORKFLOW_STATUS.REVISION ? 'Perbaiki & Kirim Ulang' : 'Kirim Pengajuan'
        : 'Lanjutkan';

    return `
        <div class="pt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button id="btn-prev-step" type="button" class="px-6 py-2.5 border border-primary-teal text-primary-teal font-bold rounded-xl hover:bg-teal-50 transition-colors">
                ${currentStep === 1 ? 'Batalkan' : 'Kembali'}
            </button>
            <button id="btn-next-step" type="button" ${submitDisabled || isSubmitting ? 'disabled' : ''} class="px-7 py-2.5 rounded-xl font-bold transition-colors ${submitDisabled || isSubmitting ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-primary-teal text-white hover:bg-teal-800'}">
                ${isSubmitting ? 'Memproses...' : escapeHtml(nextLabel)}
            </button>
        </div>
    `;
};

const attachFormEvents = () => {
    document.getElementById('btn-prev-step')?.addEventListener('click', () => {
        if (currentStep === 1) {
            goToAdministrasiSurat();
            return;
        }

        collectStep2Values();
        currentStep -= 1;
        renderForm();
    });

    document.getElementById('btn-next-step')?.addEventListener('click', async () => {
        if (currentStep === 1) {
            currentStep = 2;
            renderForm();
            return;
        }

        if (currentStep === 2) {
            collectStep2Values();
            if (!validateStep2()) {
                return;
            }

            const saved = await saveDraft();
            if (saved) {
                currentStep = 3;
                renderForm();
            }
            return;
        }

        if (!hasAcceptedStatement) {
            showWarning('Centang pernyataan kebenaran data sebelum mengirim pengajuan.');
            return;
        }

        await submitApplication();
    });

    document.getElementById('agreement-checkbox')?.addEventListener('change', (event) => {
        hasAcceptedStatement = (event.currentTarget as HTMLInputElement).checked;
        renderForm();
    });
};

const collectStep2Values = () => {
    if (currentStep !== 2) {
        return;
    }

    // Identity fields (tempat_lahir / tanggal_lahir / jenis_kelamin) are
    // profile-locked — never read them from the DOM. Their values are set
    // by lockIdentityFromProfile on form load and stay in formData.
    formData.semester = readInputValue('semester');
    formData.nomor_paspor = readInputValue('nomor_paspor');
    formData.keperluan = readInputValue('keperluan');
};

const validateStep2 = () => {
    if (profileIdentityMissing.length > 0) {
        showError(`Lengkapi profil mahasiswa terlebih dahulu: ${profileIdentityMissing.join(', ')}.`);
        return false;
    }

    const requiredFields: [keyof ProsesLuarNegeriFormData, string][] = [
        ['semester', 'Semester'],
        ['nomor_paspor', 'Nomor paspor'],
        ['keperluan', 'Keperluan'],
    ];

    const missing = requiredFields.find(([key]) => !formData[key].trim());
    if (missing) {
        showWarning(`${missing[1]} wajib diisi.`);
        return false;
    }

    const semesterNumber = Number(formData.semester);
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 14) {
        showWarning('Semester wajib berupa angka bulat antara 1 sampai 14.');
        return false;
    }

    formData.semester = String(semesterNumber);
    return true;
};

const saveDraft = async () => {
    isSubmitting = true;
    renderForm();

    try {
        const response = await apiFetch(`${API_PREFIX}/draft`, {
            method: 'POST',
            body: JSON.stringify(toPayload()),
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        application = payload.application;
        formData = mapApplicationData(payload.application);
        return true;
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal menyimpan draf pengajuan.');
        return false;
    } finally {
        isSubmitting = false;
        if (currentStep === 2) {
            renderForm();
        }
    }
};

const submitApplication = async () => {
    collectStep2Values();
    if (!validateStep2()) {
        currentStep = 2;
        renderForm();
        return;
    }

    isSubmitting = true;
    renderForm();

    try {
        const saved = await saveDraftSilently();
        if (!saved) {
            isSubmitting = false;
            renderForm();
            return;
        }

        const response = await apiFetch(`${API_PREFIX}/submit`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        showSuccess(
            application?.status === LETTER_WORKFLOW_STATUS.REVISION
                ? 'Revisi Proses Luar Negeri berhasil dikirim ulang.'
                : 'Pengajuan Proses Luar Negeri berhasil dikirim.',
        );
        renderProsesLuarNegeriDetail(payload.application.id);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal mengirim pengajuan.');
        isSubmitting = false;
        renderForm();
    }
};

const saveDraftSilently = async () => {
    try {
        const response = await apiFetch(`${API_PREFIX}/draft`, {
            method: 'POST',
            body: JSON.stringify(toPayload()),
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        application = payload.application;
        formData = mapApplicationData(payload.application);
        return true;
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal menyimpan draf sebelum mengirim pengajuan.');
        return false;
    }
};

const toPayload = () => ({
    tempat_lahir: formData.tempat_lahir,
    tanggal_lahir: formData.tanggal_lahir,
    jenis_kelamin: formData.jenis_kelamin,
    semester: Number(formData.semester),
    nomor_paspor: formData.nomor_paspor,
    keperluan: formData.keperluan,
});

const renderDetailContent = (detailApplication: ProsesLuarNegeriApplication, viewProfile: ProfileViewData, origin: MahasiswaDetailOrigin) => `
    <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button id="btn-detail-back" type="button" class="inline-flex items-center gap-2 text-gray-700 hover:text-primary-teal font-semibold w-fit">
                ${iconArrowLeft('20')}
                <span>${backLabelForDetailOrigin(origin)}</span>
            </button>
            <span class="${statusBadgeClass(detailApplication.status)} px-4 py-1.5 rounded-full text-xs font-bold border w-fit">
                ${escapeHtml(statusLabel(detailApplication.status))}
            </span>
        </div>

        ${detailApplication.status === LETTER_WORKFLOW_STATUS.REVISION ? renderRevisionBanner(detailApplication.revision_note) : ''}
        ${detailApplication.status === LETTER_WORKFLOW_STATUS.REJECTED ? renderRejectedBanner(detailApplication.rejection_reason) : ''}

        <section class="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 md:p-10 space-y-6">
            <div>
                <h2 class="text-2xl font-bold text-gray-800">Detail Pengajuan</h2>
                <p class="text-sm text-gray-500 mt-2">${escapeHtml(getLetterLabel(LETTER_TYPES.PROSES_LUAR_NEGERI))}</p>
            </div>

            ${renderReviewSection('Profil SSO', [
                ['Nama Lengkap', viewProfile.fullName],
                ['NIM', viewProfile.nim],
                ['Fakultas', viewProfile.faculty],
                ['Program Studi', viewProfile.studyProgram],
                ['Email Aktif', viewProfile.email],
            ])}
            ${renderReviewSection('Detail Profil & Pengajuan', [
                ['Tempat, Tanggal Lahir', formatPlaceAndDate(detailApplication)],
                ['Jenis Kelamin', valueOrEmpty(detailApplication.jenis_kelamin)],
                ['Semester', valueOrEmpty(detailApplication.semester)],
                ['Nomor Paspor', valueOrEmpty(detailApplication.nomor_paspor)],
                ['Keperluan', valueOrEmpty(detailApplication.keperluan)],
            ])}

            ${renderTimeline(detailApplication.status)}
            ${renderDocumentReviewSection(detailApplication)}

            <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
                ${detailApplication.status === LETTER_WORKFLOW_STATUS.REVISION ? `
                    <button id="btn-edit-revision" type="button" class="px-6 py-2.5 bg-primary-teal text-white font-bold rounded-xl hover:bg-teal-800 transition-colors">
                        Perbaiki Pengajuan
                    </button>
                ` : ''}
            </div>
        </section>
    </div>
`;

const attachDetailEvents = (detailApplication: ProsesLuarNegeriApplication, origin: MahasiswaDetailOrigin) => {
    document.getElementById('btn-detail-back')?.addEventListener('click', () => goToMahasiswaDetailOrigin(origin));
    document.getElementById('btn-edit-revision')?.addEventListener('click', () => {
        if (detailApplication.status === LETTER_WORKFLOW_STATUS.REVISION) {
            renderProsesLuarNegeriForm(true);
        }
    });
    document.getElementById('btn-complete-application')?.addEventListener('click', () => {
        completeApplicationAfterReview(detailApplication, origin);
    });
    document.getElementById('btn-download-document')?.addEventListener('click', () => {
        downloadCompletedDocument(detailApplication);
    });

    // Attach the protected PDF.js viewer for student-review and completed states.
    // The viewer fetches the protected generated-preview endpoint as an
    // ArrayBuffer and renders via canvas — no iframe, no blob URL, no
    // legacy /preview dependency.
    if (
        isStudentReviewStage(detailApplication.status)
        || canDownloadDocument(detailApplication.status)
    ) {
        cleanupGeneratedLetterPreview();
        revokeGeneratedLetterPreview = attachProtectedPdfViewer({
            rootId: GENERATED_LETTER_PREVIEW_ROOT_ID,
            endpointUrl: `${API_PREFIX}/${detailApplication.id}/generated-preview`,
        });
    }
};

const renderDocumentReviewSection = (detailApplication: ProsesLuarNegeriApplication) => {
    if (isStudentReviewStage(detailApplication.status)) {
        return `
            <section class="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">Review Dokumen</h3>
                        <p class="text-sm text-gray-600 mt-1">Periksa pratinjau di bawah sebelum menyelesaikan pengajuan.</p>
                    </div>
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button id="btn-complete-application" type="button" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-colors bg-primary-teal text-white hover:bg-teal-800">
                            ${iconCheck('18')}
                            <span>Selesaikan Pengajuan</span>
                        </button>
                    </div>
                </div>
                ${renderGeneratedLetterPreviewCard()}
            </section>
        `;
    }

    if (canDownloadDocument(detailApplication.status)) {
        return `
            <section class="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">Dokumen Selesai</h3>
                        <p class="text-sm text-gray-600 mt-1">Pengajuan telah selesai. Dokumen dapat diunduh sebagai PDF.</p>
                    </div>
                    <button id="btn-download-document" type="button" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-teal text-white font-bold rounded-xl hover:bg-teal-800 transition-colors">
                        ${iconDownload('18')}
                        <span>Unduh Dokumen Final</span>
                    </button>
                </div>
                ${renderGeneratedLetterPreviewCard()}
            </section>
        `;
    }

    return '';
};

const completeApplicationAfterReview = async (detailApplication: ProsesLuarNegeriApplication, origin: MahasiswaDetailOrigin) => {
    if (!isStudentReviewStage(detailApplication.status)) {
        showWarning('Pengajuan belum berada pada tahap review mahasiswa.');
        return;
    }

    const button = document.getElementById('btn-complete-application') as HTMLButtonElement | null;
    setButtonLoading(button, 'Memproses...');

    try {
        const response = await apiFetch(`${API_PREFIX}/${detailApplication.id}/complete`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        showSuccess('Pengajuan Proses Luar Negeri telah diselesaikan.');
        cleanupGeneratedLetterPreview();
        renderProsesLuarNegeriDetail(payload.application?.id || detailApplication.id, { origin });
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal menyelesaikan pengajuan. Status pengajuan tidak diubah.');
        restoreButton(button, `${iconCheck('18')}<span>Selesaikan Pengajuan</span>`);
    }
};

const downloadCompletedDocument = async (detailApplication: ProsesLuarNegeriApplication) => {
    if (!canDownloadDocument(detailApplication.status)) {
        showWarning('Download dokumen hanya tersedia setelah pengajuan selesai.');
        return;
    }

    const button = document.getElementById('btn-download-document') as HTMLButtonElement | null;
    setButtonLoading(button, 'Mengunduh...');

    try {
        const response = await apiFetch(`${API_PREFIX}/${detailApplication.id}/final-download`, {
            cache: 'no-store',
            headers: { Accept: 'application/pdf' },
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `Proses_Luar_Negeri_${downloadIdentifier(detailApplication)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal mengunduh dokumen. Silakan coba beberapa saat lagi.');
    } finally {
        restoreButton(button, `${iconDownload('18')}<span>Unduh Dokumen Final</span>`);
    }
};

const renderTimeline = (status: string) => {
    const steps = [
        { key: LETTER_WORKFLOW_STATUS.SUBMITTED, label: 'Diajukan' },
        { key: LETTER_WORKFLOW_STATUS.APPROVED_TENDIK, label: 'Menunggu verifikasi Tenaga Pendidik' },
        { key: LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI, label: 'Menunggu persetujuan Ketua Program Studi' },
        { key: LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW, label: 'Menunggu tanda tangan Ketua Departemen' },
        { key: LETTER_WORKFLOW_STATUS.COMPLETED, label: 'Selesai' },
    ];
    const foundIndex = steps.findIndex((step) => step.key === status);
    const currentIndex = status === LETTER_WORKFLOW_STATUS.REVISION || status === LETTER_WORKFLOW_STATUS.REJECTED
        ? 0
        : Math.max(0, foundIndex);
    const inactiveStatuses = [
        LETTER_WORKFLOW_STATUS.REVISION,
        LETTER_WORKFLOW_STATUS.REJECTED,
        LETTER_WORKFLOW_STATUS.COMPLETED,
    ] as readonly string[];

    return `
        <section class="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-5">Tahap Pengajuan</h3>
            <ol class="space-y-4">
                ${steps.map((step, index) => {
                    const done = index <= currentIndex && status !== LETTER_WORKFLOW_STATUS.REJECTED;
                    const active = index === currentIndex && !inactiveStatuses.includes(status);
                    return `
                        <li class="flex gap-4">
                            <span class="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-amber-100 text-amber-600 border border-amber-300' : 'bg-gray-100 text-gray-400'}">
                                ${done ? iconCheck('14') : ''}
                            </span>
                            <span class="text-sm font-semibold ${done || active ? 'text-gray-800' : 'text-gray-400'}">${escapeHtml(step.label)}</span>
                        </li>
                    `;
                }).join('')}
            </ol>
        </section>
    `;
};

const renderRevisionBanner = (note?: string | null) => `
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
        <div class="text-amber-600 shrink-0">${iconAlert('22')}</div>
        <div>
            <p class="font-bold text-amber-900">Pengajuan membutuhkan revisi</p>
            <p class="text-sm text-amber-800 mt-1">${escapeHtml(note || 'Silakan periksa kembali data pengajuan sebelum mengirim ulang.')}</p>
        </div>
    </div>
`;

const renderRejectedBanner = (reason?: string | null) => `
    <div class="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-3">
        <div class="text-red-600 shrink-0">${iconAlert('22')}</div>
        <div>
            <p class="font-bold text-red-900">Pengajuan ditolak</p>
            <p class="text-sm text-red-800 mt-1">${escapeHtml(reason || 'Pengajuan ini telah ditolak.')}</p>
        </div>
    </div>
`;

const parseDateParts = (value?: string | null) => {
    const isoDate = normalizeDateOnly(value);
    const [year = '', month = '', day = ''] = isoDate ? isoDate.split('-') : [];
    return { isoDate, day, month, year };
};

// Backend casts `tanggal_lahir` to `date` while config('app.timezone') is
// Asia/Jakarta (+7). Carbon serialises that as e.g. "2004-03-15T17:00:00.000000Z"
// for a stored date of 2004-03-16, so a naive leading-date regex would pick the
// UTC date and produce an off-by-one. This normaliser keeps the original
// Jakarta date by reverse-shifting Z/UTC wire values; explicit-offset wire
// values keep their leading date as-is.
const JAKARTA_OFFSET_MILLIS = 7 * 60 * 60 * 1000;

const normalizeDateOnly = (value?: string | null): string => {
    if (value == null) return '';
    const s = String(value).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
    if (!match) {
        const fallback = s.match(/\d{4}-\d{2}-\d{2}/);
        return fallback ? fallback[0] : '';
    }
    const [, y, mo, d, hh, mm, ss, tz] = match;
    if (tz && tz !== 'Z' && !/^[+-]00:?00$/.test(tz)) {
        return `${y}-${mo}-${d}`;
    }
    const utcMillis = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    const projected = new Date(utcMillis + JAKARTA_OFFSET_MILLIS);
    const newY = String(projected.getUTCFullYear());
    const newM = String(projected.getUTCMonth() + 1).padStart(2, '0');
    const newD = String(projected.getUTCDate()).padStart(2, '0');
    return `${newY}-${newM}-${newD}`;
};

const formatPlaceAndDate = (detailApplication?: ProsesLuarNegeriApplication): string => {
    const place = valueOrEmpty(detailApplication?.tempat_lahir) || formData.tempat_lahir;
    const dateValue = detailApplication?.tanggal_lahir
        ? parseDateParts(detailApplication.tanggal_lahir).isoDate
        : formData.tanggal_lahir;
    const date = formatIndonesianDate(dateValue);

    if (!place && !date) {
        return '';
    }

    return [place, date].filter(Boolean).join(', ');
};

const formatIndonesianDate = (value?: string | null): string => {
    const parts = parseDateParts(value);
    if (!parts.isoDate) {
        return '';
    }

    const monthIndex = Number(parts.month) - 1;
    return `${Number(parts.day)} ${MONTH_NAMES[monthIndex] || ''} ${parts.year}`.trim();
};

const setButtonLoading = (button: HTMLButtonElement | null, label: string) => {
    if (!button) return;
    button.disabled = true;
    button.dataset.originalLabel = button.innerHTML;
    button.innerHTML = label;
};

const restoreButton = (button: HTMLButtonElement | null, fallbackLabel: string) => {
    if (!button) return;
    button.disabled = false;
    button.innerHTML = button.dataset.originalLabel || fallbackLabel;
    delete button.dataset.originalLabel;
};

const statusLabel = (status: string) => getLetterStatusLabel(status);

const statusBadgeClass = (status: string) => getLetterStatusTone(status, 'student-detail');

const readInputValue = (id: string) => {
    const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    return element?.value.trim() || '';
};


const parseApiError = async (response: Response) => {
    try {
        const payload = await response.json();
        if (payload.errors) {
            const firstKey = Object.keys(payload.errors)[0];
            return payload.errors[firstKey]?.[0] || 'Validasi gagal.';
        }
        return payload.message || `Terjadi kesalahan (${response.status}).`;
    } catch {
        return `Terjadi kesalahan (${response.status}).`;
    }
};

const goToAdministrasiSurat = () => {
    import('./AdministrasiSurat').then(({ renderAdministrasiSurat }) => {
        renderAdministrasiSurat();
    });
};

const valueOrEmpty = (value?: string | number | null) => value === null || value === undefined ? '' : String(value);

const downloadIdentifier = (detailApplication: ProsesLuarNegeriApplication) => {
    const identifier = valueOrEmpty(detailApplication.mahasiswa_profile?.nim) || String(detailApplication.id);
    return identifier.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || String(detailApplication.id);
};

const escapeHtml = (value: string | number | null | undefined) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeAttribute = escapeHtml;

const iconCheck = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const iconChevronRight = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
const iconArrowLeft = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;
const iconAlert = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
const iconDownload = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
