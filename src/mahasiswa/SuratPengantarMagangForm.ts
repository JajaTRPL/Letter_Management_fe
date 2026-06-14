import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import { attachProtectedPdfViewer, renderProtectedPdfViewer } from '../shared/protected-pdf-viewer';
import {
    attachSupportingDocumentGallery,
    renderSupportingDocumentGallery,
} from '../shared/supporting-document-gallery';
import { magangSupportingDescriptors } from '../shared/magang-supporting-documents';
import {
    formatDetailDateTime,
    renderDetailHeaderCard,
    renderDetailInfoCard,
} from '../shared/mahasiswa-letter-detail';
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
    getLetterStatusLabel,
    getLetterStatusTone,
    isStudentReviewStage,
    LETTER_WORKFLOW_STATUS,
} from '../shared/letter-workflow';
import { showError, showSuccess, showWarning } from '../shared/toast';
import {
    attachBlurDigitsOnly,
    attachBlurTitleCase,
    titleCaseIndonesian,
} from '../shared/formatters';
import {
    escapeFormAttribute,
    escapeFormHtml,
    renderFormActionFooter,
    renderFormField,
} from '../shared/form-primitives';
import {
    attachSupportingDocumentUploadSection,
    createSupportingDocumentUploadState,
    renderSupportingDocumentUploadSection,
    validateSupportingDocumentUploads,
    type SupportingDocumentUploadState,
} from '../shared/supporting-document-upload';
import type { SupportingDocumentMetadataMap } from '../shared/supporting-document-metadata';
import {
    canDownloadFinalForMahasiswa,
    canPreviewFinalForMahasiswa,
    resolveMahasiswaRetentionState,
    retentionAwareSupportingDescriptors,
    type LetterRetentionSummary,
} from '../shared/retention-state';
import {
    createMagangDraftPayload,
    emptyMagangDraftValues,
    MAGANG_MAHASISWA_ENDPOINTS,
    MAGANG_SUPPORTING_DOCUMENT_UPLOADS,
    magangExistingSupportingDocumentValues,
    mapMagangDraftValues,
    type MagangDraftValues,
} from '../shared/magang-form';

type MagangApplication = {
    id: number;
    status: string;
    // Legacy fields kept for transitional read of old records.
    nama_penerima?: string | null;
    alamat_perusahaan?: string | null;
    rentang_tanggal?: string | null;
    // Final structured contract.
    jabatan_penerima?: string | null;
    nama_perusahaan?: string | null;
    alamat_jalan?: string | null;
    alamat_kelurahan?: string | null;
    alamat_kecamatan?: string | null;
    alamat_kota_kabupaten?: string | null;
    alamat_provinsi?: string | null;
    kode_pos?: string | null;
    tgl_mulai?: string | null;
    tgl_selesai?: string | null;
    peran?: string | null;
    dosen_pembimbing_dpa?: string | null;
    supporting_documents?: SupportingDocumentMetadataMap | null;
    revision_note?: string | null;
    rejection_reason?: string | null;
    created_at?: string | null;
    submitted_at?: string | null;
    student_reviewed_at?: string | null;
    retention_summary?: LetterRetentionSummary | null;
    mahasiswa_profile?: StudentProfile | null;
    user?: StudentUser | null;
};

type StudentProfile = {
    nim?: string | null;
    fakultas?: string | null;
    program_studi?: string | null;
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

type ProfileViewData = MahasiswaProfileDisplay;
type MagangFormData = MagangDraftValues;

const activeReadonlyStatuses: readonly string[] = ACTIVE_READONLY_LETTER_STATUSES;

let currentStep = 1;
let application: MagangApplication | null = null;
let formData: MagangFormData = emptyFormData();
let profileData: ProfileViewData = emptyProfileData();
let supportingDocumentUploadState: SupportingDocumentUploadState = createSupportingDocumentUploadState();
let hasAcceptedStatement = false;
let isSubmitting = false;
let revokeGeneratedLetterPreview: (() => void) | null = null;
const GENERATED_LETTER_PREVIEW_ROOT_ID = 'magang-mahasiswa-generated-letter-preview';

// Uploaded supporting document (proposal) preview — owner-side. Uses the shared
// supporting-document gallery against the dedicated, role-scoped preview
// endpoint (NOT /api/storage). Mirrors the Tendik/Akademik reviewer pages.
let revokeSupportingGallery: (() => void) | null = null;
const SUPPORTING_GALLERY_ROOT_ID = 'magang-mahasiswa-supporting-gallery';

let revokeSupportingDocumentUploadInputs: (() => void) | null = null;

const cleanupGeneratedLetterPreview = (): void => {
    if (!revokeGeneratedLetterPreview) return;
    revokeGeneratedLetterPreview();
    revokeGeneratedLetterPreview = null;
};

const cleanupProposalPreview = (): void => {
    if (!revokeSupportingGallery) return;
    revokeSupportingGallery();
    revokeSupportingGallery = null;
};

const cleanupSupportingDocumentUploadInputs = (): void => {
    if (!revokeSupportingDocumentUploadInputs) return;
    revokeSupportingDocumentUploadInputs();
    revokeSupportingDocumentUploadInputs = null;
};

const renderGeneratedLetterPreviewCard = (): string => renderProtectedPdfViewer(GENERATED_LETTER_PREVIEW_ROOT_ID, {
    title: 'Pratinjau Surat Pengantar Magang',
    subtitle: 'Pratinjau PDF dokumen pengajuan',
    loading: 'Memuat pratinjau surat...',
});

export const renderSuratPengantarMagangForm = async () => {
    resetState();
    renderLoading('Memuat formulir Surat Pengantar Magang...');

    try {
        const draftData = await fetchDraftData();
        profileData = mergeMahasiswaProfileDisplay({
            profile_summary: draftData.profile_summary,
            user: draftData.user,
            profile: draftData.profile,
            application: draftData.application,
        });

        if (draftData.application) {
            application = draftData.application;
            formData = mapApplicationData(draftData.application);
            supportingDocumentUploadState = createSupportingDocumentUploadState(
                magangExistingSupportingDocumentValues(draftData.application),
            );
        }

        if (!application) {
            const activeApplication = await fetchLatestActiveApplication();
            if (activeApplication) {
                renderSuratPengantarMagangDetail(activeApplication.id);
                return;
            }
        }
    } catch (error) {
        console.error(error);
        showError('Gagal memuat formulir Surat Pengantar Magang.');
    }

    renderForm();
};

export const renderSuratPengantarMagangDetail = async (applicationId: number | string, options?: MahasiswaDetailNavigationOptions) => {
    const origin = resolveDetailOrigin(options);
    const activePage = activePageForDetailOrigin(origin);

    cleanupGeneratedLetterPreview();
    cleanupProposalPreview();
    renderLoading('Memuat detail pengajuan...', activePage);

    try {
        // With Global Profile.1 the Magang detail endpoint now ships an
        // additive root-level `profile_summary` block alongside the
        // legacy `application` payload. The shared merger reads from
        // `profile_summary` first, so the older parallel /api/profile
        // fetch is no longer needed.
        const response = await apiFetch(MAGANG_MAHASISWA_ENDPOINTS.detail(applicationId), {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        const detailApplication = payload.application as MagangApplication;
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
        if (origin === 'riwayat') {
            goToMahasiswaDetailOrigin(origin);
        } else {
            renderSuratPengantarMagangForm();
        }
    }
};

const resetState = () => {
    cleanupSupportingDocumentUploadInputs();
    currentStep = 1;
    application = null;
    formData = emptyFormData();
    profileData = emptyProfileData();
    supportingDocumentUploadState = createSupportingDocumentUploadState();
    hasAcceptedStatement = false;
    isSubmitting = false;
};

function emptyFormData(): MagangFormData {
    return emptyMagangDraftValues();
}

function emptyProfileData(): ProfileViewData {
    return {
        fullName: '',
        nim: '',
        email: '',
        phone: '',
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
    const response = await apiFetch(MAGANG_MAHASISWA_ENDPOINTS.draft, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response));
    }

    return await response.json();
};

const fetchLatestActiveApplication = async (): Promise<MagangApplication | null> => {
    const response = await apiFetch(MAGANG_MAHASISWA_ENDPOINTS.applications, {
        cache: 'no-store',
    });

    if (!response.ok) {
        return null;
    }

    const payload = await response.json();
    const applications = (payload.applications || []) as MagangApplication[];
    return applications.find((item) => activeReadonlyStatuses.includes(item.status)) || null;
};

// Profile display is now sourced via the shared mahasiswa-profile-source
// helper. Each caller passes whichever payload shapes it has on hand —
// /draft, /api/profile, or detail-application — and the merger picks the
// first real value for every field with a documented precedence chain.

const mapApplicationData = (app: MagangApplication): MagangFormData => mapMagangDraftValues(app);

const renderLoading = (message: string, activePage = 'administrasi') => {
    cleanupSupportingDocumentUploadInputs();
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
    cleanupSupportingDocumentUploadInputs();
    const isRevision = application?.status === LETTER_WORKFLOW_STATUS.REVISION;
    const content = `
        <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button id="btn-back-to-docs" type="button" class="inline-flex items-center gap-2 text-gray-700 hover:text-primary-teal font-semibold w-fit" aria-label="Kembali ke administrasi surat">
                    ${iconArrowLeft('20')}
                    <span>Kembali</span>
                </button>
                ${application ? `
                    <span class="${statusBadgeClass(application.status)} px-4 py-1.5 rounded-full text-xs font-bold border w-fit">
                        ${escapeHtml(statusLabel(application.status))}
                    </span>
                ` : ''}
            </div>

            ${isRevision ? renderRevisionBanner(application?.revision_note) : ''}
            ${renderStepper()}

            <section class="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
                <form id="magang-form" class="p-6 md:p-10">
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
        { number: 2, label: 'Detail Pengajuan' },
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
                    <h2 class="text-2xl font-bold text-gray-800">Profil SSO</h2>
                    <p class="text-sm text-gray-500 mt-2">Periksa kesesuaian data profil dengan data yang terdaftar pada sistem.</p>
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
            <div class="space-y-8">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800">Detail Pengajuan</h2>
                    <p class="text-sm text-gray-500 mt-2">Data di bawah ini akan digunakan untuk pengajuan Surat Pengantar Magang.</p>
                </div>

                <div class="space-y-5">
                    ${renderTextInput('jabatan_penerima', 'Jabatan Penerima / Tujuan Surat', 'Contoh: Direktur', formData.jabatan_penerima)}
                    ${renderTextInput('nama_perusahaan', 'Nama Perusahaan/Instansi', 'Contoh: Direktorat Teknologi Informasi UGM', formData.nama_perusahaan)}
                </div>

                <div class="border-t border-gray-200 pt-8 space-y-5">
                    <h3 class="text-xl font-bold text-gray-800">Alamat Perusahaan</h3>
                    ${renderTextarea('alamat_jalan', 'Alamat Jalan', 'Contoh: Jl. Grafika No. 2', formData.alamat_jalan)}
                    ${renderTextInput('alamat_kelurahan', 'Kelurahan/Desa', 'Contoh: Sinduadi', formData.alamat_kelurahan)}
                    ${renderTextInput('alamat_kecamatan', 'Kecamatan', 'Contoh: Mlati', formData.alamat_kecamatan)}
                    ${renderTextInput('alamat_kota_kabupaten', 'Kota/Kabupaten', 'Contoh: Sleman', formData.alamat_kota_kabupaten)}
                    ${renderTextInput('alamat_provinsi', 'Provinsi', 'Contoh: D.I. Yogyakarta', formData.alamat_provinsi)}
                    ${renderTextInput('kode_pos', 'Kode Pos', 'Contoh: 55281', formData.kode_pos)}
                </div>

                <div class="border-t border-gray-200 pt-8 space-y-5">
                    <h3 class="text-xl font-bold text-gray-800">Informasi Kegiatan</h3>
                    ${renderTextInput('peran', 'Posisi Magang', 'Contoh: Fullstack Developer Intern', formData.peran)}
                    ${renderDateInput('tgl_mulai', 'Tanggal Mulai Magang', formData.tgl_mulai)}
                    ${renderDateInput('tgl_selesai', 'Tanggal Selesai Magang', formData.tgl_selesai)}
                    ${renderTextInput('dosen_pembimbing_dpa', 'Dosen Pembimbing Akademik / DPA', 'Masukkan nama lengkap Dosen Pembimbing Akademik (DPA)', formData.dosen_pembimbing_dpa)}
                </div>

                ${renderSupportingDocumentUploadSection(
                    MAGANG_SUPPORTING_DOCUMENT_UPLOADS,
                    supportingDocumentUploadState,
                    { disabled: isSubmitting },
                )}
            </div>
        `;
    }

    return `
        <div class="space-y-8">
            <div>
                <h2 class="text-2xl font-bold text-gray-800">Tinjau Pengajuan</h2>
                <p class="text-sm text-gray-500 mt-2">Periksa kembali kebenaran data yang Anda masukkan.</p>
            </div>

            <div class="space-y-6">
                ${renderReviewSection('Profil SSO', [
                    ['Nama Lengkap', profileData.fullName],
                    ['NIM', profileData.nim],
                    ['Fakultas', profileData.faculty],
                    ['Program Studi', profileData.studyProgram],
                    ['Email Aktif', profileData.email],
                ])}
                ${renderReviewSection('Detail Pengajuan', [
                    ['Jabatan Penerima / Tujuan Surat', formData.jabatan_penerima],
                    ['Nama Perusahaan/Instansi', formData.nama_perusahaan],
                ])}
                ${renderReviewSection('Alamat Perusahaan', [
                    ['Alamat Jalan', formData.alamat_jalan],
                    ['Kelurahan/Desa', formData.alamat_kelurahan],
                    ['Kecamatan', formData.alamat_kecamatan],
                    ['Kota/Kabupaten', formData.alamat_kota_kabupaten],
                    ['Provinsi', formData.alamat_provinsi],
                    ['Kode Pos', formData.kode_pos],
                ])}
                ${renderReviewSection('Informasi Kegiatan', [
                    ['Posisi Magang', formData.peran],
                    ['Tanggal Mulai Magang', formatIndonesianDate(formData.tgl_mulai)],
                    ['Tanggal Selesai Magang', formatIndonesianDate(formData.tgl_selesai)],
                    ['Dosen Pembimbing Akademik / DPA', formData.dosen_pembimbing_dpa],
                ])}
                ${renderReviewSection('Dokumen Pendukung', [
                    ['Proposal Kegiatan Magang', supportingDocumentReviewValue('proposal')],
                ])}
            </div>

            <label class="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                <input id="agreement-checkbox" type="checkbox" ${hasAcceptedStatement ? 'checked' : ''} class="mt-1 w-4 h-4 rounded border-gray-300 text-primary-teal focus:ring-primary-teal">
                <span>Dengan ini saya menyatakan bahwa seluruh data yang saya kirimkan adalah benar dan dapat dipertanggungjawabkan.</span>
            </label>
        </div>
    `;
};

const renderReadonlyField = (label: string, value: string) => {
    const id = `readonly-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return renderFormField({
        id,
        label,
        columnsClassName: 'grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-6 md:items-center',
        controlHtml: `<input id="${id}" type="text" value="${escapeAttribute(value || '-')}" readonly class="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed outline-none">`,
    });
};

const renderTextInput = (name: keyof MagangFormData, label: string, placeholder: string, value: string) => renderFormField({
    id: name,
    label,
    controlHtml: `<input id="${name}" name="${name}" type="text" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">`,
});

const renderTextarea = (name: keyof MagangFormData, label: string, placeholder: string, value: string) => renderFormField({
    id: name,
    label,
    align: 'start',
    controlHtml: `<textarea id="${name}" name="${name}" rows="4" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">${escapeHtml(value)}</textarea>`,
});

const renderDateInput = (name: keyof MagangFormData, label: string, value: string) => renderFormField({
    id: name,
    label,
    controlHtml: `<input id="${name}" name="${name}" type="date" value="${escapeAttribute(value)}" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">`,
});

const renderReviewSection = (title: string, rows: [string, string][]) => `
    <section class="bg-[#F0F8F7] rounded-2xl p-6">
        <h3 class="text-lg font-bold text-gray-800 mb-5">${escapeHtml(title)}</h3>
        <div class="space-y-3">
            ${rows.map(([label, value]) => `
                <div class="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 text-sm text-gray-700">
                    <span class="font-semibold">${escapeHtml(label)}</span>
                    <span class="break-words">: ${escapeHtml(value || '-')}</span>
                </div>
            `).join('')}
        </div>
    </section>
`;

const supportingDocumentReviewValue = (key: string): string => {
    const value = supportingDocumentUploadState.existingValues[key];
    return typeof value === 'string' && value.trim() !== '' ? value : '-';
};

const renderNavigationButtons = () => {
    const isSubmitStep = currentStep === 3;
    const submitDisabled = isSubmitStep && !hasAcceptedStatement;
    const nextLabel = isSubmitStep
        ? application?.status === LETTER_WORKFLOW_STATUS.REVISION ? 'Kirim Ulang Pengajuan' : 'Kirim Pengajuan'
        : 'Lanjutkan';

    return renderFormActionFooter({
        previous: {
            id: 'btn-prev-step',
            label: currentStep === 1 ? 'Batalkan' : 'Kembali',
            invisible: currentStep === 1,
        },
        next: {
            id: 'btn-next-step',
            label: nextLabel,
            disabled: submitDisabled,
            loading: isSubmitting,
        },
    });
};

const attachFormEvents = () => {
    document.getElementById('btn-back-to-docs')?.addEventListener('click', goToAdministrasiSurat);

    document.getElementById('btn-prev-step')?.addEventListener('click', () => {
        if (currentStep === 1) {
            goToAdministrasiSurat();
            return;
        }
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

    revokeSupportingDocumentUploadInputs = attachSupportingDocumentUploadSection(
        MAGANG_SUPPORTING_DOCUMENT_UPLOADS,
        supportingDocumentUploadState,
        {
            disabled: isSubmitting,
            onValidationError: showWarning,
        },
    );

    document.getElementById('agreement-checkbox')?.addEventListener('change', (event) => {
        hasAcceptedStatement = (event.currentTarget as HTMLInputElement).checked;
        renderForm();
    });

    wirePhase2AFormatters();
};

// Phase 2A — wire approved low-risk text/digit fields. Pure inline binding;
// helpers from src/shared/formatters.ts. Only Step 2 inputs exist in the DOM
// at this point; missing-id lookups are no-ops, so a guarded query is enough.
// No keystroke transforms (would mangle in-progress acronyms); blur only.
const wirePhase2AFormatters = () => {
    const byId = (id: string) => document.getElementById(id) as HTMLInputElement | null;

    // titleCaseIndonesian — no acronym whitelist applied here.
    (['jabatan_penerima', 'peran', 'alamat_kelurahan', 'alamat_kecamatan', 'alamat_kota_kabupaten', 'alamat_provinsi'] as const)
        .forEach(id => {
            const el = byId(id);
            if (!el) return;
            el.addEventListener('blur', () => {
                const next = titleCaseIndonesian(el.value);
                if (next !== el.value) el.value = next;
            });
        });

    // titleCaseWithAcronyms — needed for institutional names (PT, CV, BCA, …).
    const namaPerusahaan = byId('nama_perusahaan');
    if (namaPerusahaan) attachBlurTitleCase(namaPerusahaan);

    // Digits-only blur normalization. No passLiteralDash — postal codes are numeric.
    const kodePos = byId('kode_pos');
    if (kodePos) attachBlurDigitsOnly(kodePos);
};

const collectStep2Values = () => {
    formData.jabatan_penerima = readInputValue('jabatan_penerima');
    formData.nama_perusahaan = readInputValue('nama_perusahaan');
    formData.alamat_jalan = readInputValue('alamat_jalan');
    formData.alamat_kelurahan = readInputValue('alamat_kelurahan');
    formData.alamat_kecamatan = readInputValue('alamat_kecamatan');
    formData.alamat_kota_kabupaten = readInputValue('alamat_kota_kabupaten');
    formData.alamat_provinsi = readInputValue('alamat_provinsi');
    formData.kode_pos = readInputValue('kode_pos');
    formData.peran = readInputValue('peran');
    formData.tgl_mulai = readInputValue('tgl_mulai');
    formData.tgl_selesai = readInputValue('tgl_selesai');
    formData.dosen_pembimbing_dpa = readInputValue('dosen_pembimbing_dpa');
};

const validateStep2 = () => {
    const requiredFields: [keyof MagangFormData, string][] = [
        ['jabatan_penerima', 'Jabatan Penerima / Tujuan Surat'],
        ['nama_perusahaan', 'Nama Perusahaan/Instansi'],
        ['alamat_jalan', 'Alamat Jalan'],
        ['alamat_kelurahan', 'Kelurahan/Desa'],
        ['alamat_kecamatan', 'Kecamatan'],
        ['alamat_kota_kabupaten', 'Kota/Kabupaten'],
        ['alamat_provinsi', 'Provinsi'],
        ['kode_pos', 'Kode Pos'],
        ['peran', 'Posisi Magang'],
        ['tgl_mulai', 'Tanggal Mulai Magang'],
        ['tgl_selesai', 'Tanggal Selesai Magang'],
        ['dosen_pembimbing_dpa', 'Dosen Pembimbing Akademik / DPA'],
    ];

    const missing = requiredFields.find(([key]) => !formData[key].trim());
    if (missing) {
        showWarning(`${missing[1]} wajib diisi.`);
        return false;
    }

    if (formData.tgl_selesai < formData.tgl_mulai) {
        showWarning('Tanggal Selesai Magang harus pada atau setelah Tanggal Mulai Magang.');
        return false;
    }

    const uploadValidation = validateSupportingDocumentUploads(
        MAGANG_SUPPORTING_DOCUMENT_UPLOADS,
        supportingDocumentUploadState,
    );
    if (!uploadValidation.valid) {
        showWarning(uploadValidation.firstError || 'Dokumen pendukung wajib dilengkapi.');
        return false;
    }

    return true;
};

const saveDraft = async () => {
    isSubmitting = true;
    renderForm();

    const body = createMagangDraftPayload(formData, supportingDocumentUploadState);

    try {
        const response = await apiFetch(MAGANG_MAHASISWA_ENDPOINTS.draft, {
            method: 'POST',
            body,
            isFormData: true,
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        application = payload.application;
        formData = mapApplicationData(payload.application);
        supportingDocumentUploadState = createSupportingDocumentUploadState(
            magangExistingSupportingDocumentValues(payload.application),
        );
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
    isSubmitting = true;
    renderForm();

    try {
        const response = await apiFetch(MAGANG_MAHASISWA_ENDPOINTS.submit, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        showSuccess('Pengajuan Surat Pengantar Magang berhasil dikirim.');
        renderSuratPengantarMagangDetail(payload.application.id);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal mengirim pengajuan.');
        isSubmitting = false;
        renderForm();
    }
};

const renderProposalCard = (detailApplication: MagangApplication): string => {
    const retention = resolveMahasiswaRetentionState(detailApplication.retention_summary);

    return `
        <div class="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-7 py-5 border-b border-gray-50">
                <h3 class="text-base font-bold text-gray-800">Dokumen Pendukung</h3>
            </div>
            <div class="p-6 md:p-7">
                ${renderSupportingDocumentGallery(
                    SUPPORTING_GALLERY_ROOT_ID,
                    retentionAwareSupportingDescriptors(
                        detailApplication.retention_summary,
                        magangSupportingDescriptors(detailApplication),
                    ),
                    { emptyLabel: retention.supportingDocumentsEmptyLabel },
                )}
            </div>
        </div>
    `;
};

const renderDetailContent = (detailApplication: MagangApplication, viewProfile: ProfileViewData, origin: MahasiswaDetailOrigin) => {
    const status = detailApplication.status;
    return `
    <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
        ${renderDetailHeaderCard({
            backId: 'btn-detail-back',
            backLabel: backLabelForDetailOrigin(origin),
            title: 'Detail Pengajuan',
            subtitle: 'Surat Pengantar Magang',
            statusLabel: statusLabel(status),
            statusBadgeClass: statusBadgeClass(status),
        })}

        ${status === LETTER_WORKFLOW_STATUS.REVISION ? renderRevisionBanner(detailApplication.revision_note) : ''}
        ${status === LETTER_WORKFLOW_STATUS.REJECTED ? renderRejectedBanner(detailApplication.rejection_reason) : ''}

        ${renderDetailInfoCard('Informasi Surat', [
            ['Jenis Surat', 'Surat Pengantar Magang'],
            ['Tanggal pengajuan', formatDetailDateTime(detailApplication.submitted_at || detailApplication.created_at)],
            ['Status', statusLabel(status)],
        ])}

        ${renderDetailInfoCard('Pemohon', [
            ['Nama', viewProfile.fullName],
            ['NIM', viewProfile.nim],
            ['Program Studi', viewProfile.studyProgram],
            ['Fakultas', viewProfile.faculty],
            ['Departemen', viewProfile.department],
            ['Email Aktif', viewProfile.email],
            ['No. Telepon', viewProfile.phone],
        ])}

        ${renderDetailInfoCard('Detail Pengajuan', [
            ['Jabatan Penerima / Tujuan Surat', valueOrEmpty(detailApplication.jabatan_penerima) || valueOrEmpty(detailApplication.nama_penerima)],
            ['Nama Perusahaan/Instansi', valueOrEmpty(detailApplication.nama_perusahaan)],
        ])}

        ${renderDetailInfoCard('Alamat Perusahaan', [
            ['Alamat Jalan', valueOrEmpty(detailApplication.alamat_jalan) || valueOrEmpty(detailApplication.alamat_perusahaan)],
            ['Kelurahan/Desa', valueOrEmpty(detailApplication.alamat_kelurahan)],
            ['Kecamatan', valueOrEmpty(detailApplication.alamat_kecamatan)],
            ['Kota/Kabupaten', valueOrEmpty(detailApplication.alamat_kota_kabupaten)],
            ['Provinsi', valueOrEmpty(detailApplication.alamat_provinsi)],
            ['Kode Pos', valueOrEmpty(detailApplication.kode_pos)],
        ])}

        ${renderDetailInfoCard('Informasi Kegiatan', [
            ['Posisi Magang', valueOrEmpty(detailApplication.peran)],
            ['Tanggal Mulai Magang', formatIndonesianDate(detailApplication.tgl_mulai)],
            ['Tanggal Selesai Magang', formatIndonesianDate(detailApplication.tgl_selesai)],
            ['Dosen Pembimbing Akademik / DPA', valueOrEmpty(detailApplication.dosen_pembimbing_dpa)],
        ])}

        ${detailApplication.rentang_tanggal && !detailApplication.tgl_mulai && !detailApplication.tgl_selesai ? renderDetailInfoCard('Rentang Tanggal (data lama)', [
            ['Rentang Tanggal', valueOrEmpty(detailApplication.rentang_tanggal)],
        ]) : ''}

        ${renderProposalCard(detailApplication)}

        ${renderDocumentReviewSection(detailApplication)}

        ${renderTimeline(status)}

        ${status === LETTER_WORKFLOW_STATUS.REVISION ? `
            <div class="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 md:p-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button id="btn-edit-revision" type="button" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-teal text-white font-bold rounded-xl hover:bg-teal-800 transition-colors">
                    Perbaiki Pengajuan
                </button>
            </div>
        ` : ''}
    </div>
`;
};

const attachDetailEvents = (detailApplication: MagangApplication, origin: MahasiswaDetailOrigin) => {
    document.getElementById('btn-detail-back')?.addEventListener('click', () => {
        cleanupGeneratedLetterPreview();
        cleanupProposalPreview();
        goToMahasiswaDetailOrigin(origin);
    });
    document.getElementById('btn-edit-revision')?.addEventListener('click', () => {
        if (detailApplication.status === LETTER_WORKFLOW_STATUS.REVISION) {
            renderSuratPengantarMagangForm();
        }
    });
    document.getElementById('btn-complete-application')?.addEventListener('click', () => {
        completeApplicationAfterReview(detailApplication, origin);
    });
    document.getElementById('btn-download-document')?.addEventListener('click', () => {
        downloadCompletedDocument(detailApplication);
    });

    // Uploaded proposal preview — rendered through the shared supporting-document
    // gallery against the dedicated, role-scoped preview endpoint (owner-readable).
    // Not the /api/storage attachment route; no window.open/iframe/download.
    cleanupProposalPreview();
    revokeSupportingGallery = attachSupportingDocumentGallery(
        SUPPORTING_GALLERY_ROOT_ID,
        retentionAwareSupportingDescriptors(
            detailApplication.retention_summary,
            magangSupportingDescriptors(detailApplication),
        ),
    );

    // Attach the protected PDF.js viewer for student-review and completed states.
    // The viewer fetches the protected generated-preview endpoint as an
    // ArrayBuffer and renders via canvas — no iframe, no blob URL, no
    // legacy /preview dependency.
    if (
        canPreviewFinalForMahasiswa(detailApplication.status, detailApplication.retention_summary)
    ) {
        cleanupGeneratedLetterPreview();
        revokeGeneratedLetterPreview = attachProtectedPdfViewer({
            rootId: GENERATED_LETTER_PREVIEW_ROOT_ID,
            endpointUrl: `/api/mahasiswa/surat-pengantar-magang/${detailApplication.id}/generated-preview`,
        });
    }
};

const renderDocumentReviewSection = (detailApplication: MagangApplication) => {
    const retention = resolveMahasiswaRetentionState(detailApplication.retention_summary);

    if (isStudentReviewStage(detailApplication.status)) {
        return `
            <section class="bg-white border border-gray-100 rounded-[24px] shadow-sm p-6 md:p-7 space-y-5">
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

    if (detailApplication.status === LETTER_WORKFLOW_STATUS.COMPLETED) {
        if (!retention.finalDownloadAvailable) {
            return retention.noticeHtml ? `
                <section class="bg-white border border-gray-100 rounded-[24px] shadow-sm p-6 md:p-7 space-y-5">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">Dokumen Selesai</h3>
                        <p class="text-sm text-gray-600 mt-1">Pengajuan telah selesai.</p>
                    </div>
                    ${retention.noticeHtml}
                </section>
            ` : '';
        }

        return `
            <section class="bg-white border border-gray-100 rounded-[24px] shadow-sm p-6 md:p-7 space-y-5">
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
                ${retention.noticeHtml}
                ${renderGeneratedLetterPreviewCard()}
            </section>
        `;
    }

    return '';
};

const completeApplicationAfterReview = async (detailApplication: MagangApplication, origin: MahasiswaDetailOrigin) => {
    if (!isStudentReviewStage(detailApplication.status)) {
        showWarning('Pengajuan belum berada pada tahap review mahasiswa.');
        return;
    }

    const button = document.getElementById('btn-complete-application') as HTMLButtonElement | null;
    setButtonLoading(button, 'Memproses...');

    try {
        const response = await apiFetch(`/api/mahasiswa/surat-pengantar-magang/${detailApplication.id}/complete`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        showSuccess('Pengajuan Surat Pengantar Magang telah diselesaikan.');
        cleanupGeneratedLetterPreview();
        renderSuratPengantarMagangDetail(payload.application?.id || detailApplication.id, { origin });
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal menyelesaikan pengajuan. Status pengajuan tidak diubah.');
        restoreButton(button, `${iconCheck('18')}<span>Selesaikan Pengajuan</span>`);
    }
};

const downloadCompletedDocument = async (detailApplication: MagangApplication) => {
    if (!canDownloadFinalForMahasiswa(detailApplication.status, detailApplication.retention_summary)) {
        showWarning('Masa unduh surat resmi telah berakhir.');
        return;
    }

    const button = document.getElementById('btn-download-document') as HTMLButtonElement | null;
    setButtonLoading(button, 'Mengunduh...');

    try {
        const response = await apiFetch(`/api/mahasiswa/surat-pengantar-magang/${detailApplication.id}/final-download`, {
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
        link.download = `Surat_Pengantar_Magang_${downloadIdentifier(detailApplication)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
        console.error(error);
        showWarning(error instanceof Error ? error.message : 'Gagal mengunduh dokumen. Silakan coba beberapa saat lagi.');
    } finally {
        restoreButton(button, `${iconDownload('18')}<span>Unduh Dokumen Final</span>`);
    }
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

const renderTimeline = (status: string) => {
    const steps = [
        { key: LETTER_WORKFLOW_STATUS.SUBMITTED, label: 'Diajukan' },
        { key: LETTER_WORKFLOW_STATUS.APPROVED_TENDIK, label: 'Verifikasi Tendik' },
        { key: LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI, label: 'Paraf Kaprodi/Sekprodi' },
        { key: LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW, label: 'Tanda Tangan Kadep/Sekdep' },
        { key: LETTER_WORKFLOW_STATUS.COMPLETED, label: 'Selesai' },
    ];
    const currentIndex = status === LETTER_WORKFLOW_STATUS.REVISION || status === LETTER_WORKFLOW_STATUS.REJECTED
        ? 0
        : Math.max(0, steps.findIndex((step) => step.key === status));

    return `
        <div class="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-7 py-5 border-b border-gray-50">
                <h3 class="text-base font-bold text-gray-800">Tahap Persetujuan</h3>
            </div>
            <ol class="px-7 py-6 space-y-4">
                ${steps.map((step, index) => {
                    const done = index <= currentIndex && status !== LETTER_WORKFLOW_STATUS.REJECTED;
                    const active = index === currentIndex && ![
                        LETTER_WORKFLOW_STATUS.REVISION,
                        LETTER_WORKFLOW_STATUS.REJECTED,
                        LETTER_WORKFLOW_STATUS.COMPLETED,
                    ].includes(status as any);
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
        </div>
    `;
};

const renderRevisionBanner = (note?: string | null) => `
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
        <div class="text-amber-600 shrink-0">${iconAlert('22')}</div>
        <div>
            <p class="font-bold text-amber-900">Pengajuan membutuhkan revisi</p>
            <p class="text-sm text-amber-800 mt-1">${escapeHtml(note || 'Silakan periksa kembali data dan dokumen pengajuan.')}</p>
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

const statusLabel = (status: string) => {
    return getLetterStatusLabel(status);
};

const statusBadgeClass = (status: string) => {
    return getLetterStatusTone(status, 'student-detail');
};

const readInputValue = (id: string) => {
    const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
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

const isoDateOnly = (value?: string | null): string => {
    const match = valueOrEmpty(value).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
};

const INDONESIAN_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const formatIndonesianDate = (value?: string | null): string => {
    const iso = isoDateOnly(value);
    if (!iso) return '';
    const [year, month, day] = iso.split('-');
    const monthName = INDONESIAN_MONTHS[Number(month) - 1] || '';
    return monthName ? `${Number(day)} ${monthName} ${year}` : iso;
};

const valueOrEmpty = (value?: string | null) => value ? String(value) : '';
const downloadIdentifier = (detailApplication: MagangApplication) => {
    const identifier = valueOrEmpty(detailApplication.mahasiswa_profile?.nim) || String(detailApplication.id);
    return identifier.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || String(detailApplication.id);
};

const escapeHtml = escapeFormHtml;
const escapeAttribute = escapeFormAttribute;

const iconCheck = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const iconArrowLeft = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;
const iconChevronRight = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
const iconAlert = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
const iconDownload = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
