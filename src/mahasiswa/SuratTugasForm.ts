import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import { attachProtectedPdfViewer, renderProtectedPdfViewer } from '../shared/protected-pdf-viewer';
import {
    attachSupportingDocumentGallery,
    renderSupportingDocumentGallery,
} from '../shared/supporting-document-gallery';
import { suratTugasSupportingDescriptors } from '../shared/surat-tugas-supporting-documents';
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
import { attachBlurTitleCase, titleCaseIndonesian } from '../shared/formatters';
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
    createSuratTugasDraftPayload,
    emptySuratTugasDraftValues,
    mapSuratTugasDraftValues,
    SURAT_TUGAS_MAHASISWA_ENDPOINTS,
    SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS,
    suratTugasExistingSupportingDocumentValues,
    type SuratTugasDraftValues,
} from '../shared/surat-tugas-form';

// Surat Tugas is a first-class, standalone letter. It reuses the shared visual
// shell, PDF viewers, profile source and status helpers, but never the Magang
// identity, model, route prefix, or application id. The uploaded "Surat
// Pengantar Magang" PDF is a SUPPORTING document only — not a Magang linkage.

type SuratTugasApplication = {
    id: number;
    status: string;
    nama_perusahaan?: string | null;
    kegiatan?: string | null;
    posisi?: string | null;
    dosen_pembimbing_dpa?: string | null;
    tgl_mulai?: string | null;
    tgl_selesai?: string | null;
    nomor_surat_tugas?: string | null;
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
type SuratTugasFormData = SuratTugasDraftValues;

const activeReadonlyStatuses: readonly string[] = ACTIVE_READONLY_LETTER_STATUSES;

let currentStep = 1;
let application: SuratTugasApplication | null = null;
let formData: SuratTugasFormData = emptyFormData();
let profileData: ProfileViewData = emptyProfileData();
let supportingDocumentUploadState: SupportingDocumentUploadState = createSupportingDocumentUploadState();
let hasAcceptedStatement = false;
let isSubmitting = false;

let revokeGeneratedLetterPreview: (() => void) | null = null;
const GENERATED_LETTER_PREVIEW_ROOT_ID = 'surat-tugas-mahasiswa-generated-letter-preview';

let revokeSupportingGallery: (() => void) | null = null;
const SUPPORTING_GALLERY_ROOT_ID = 'surat-tugas-mahasiswa-supporting-gallery';

let revokeSupportingDocumentUploadInputs: (() => void) | null = null;

const cleanupGeneratedLetterPreview = (): void => {
    if (!revokeGeneratedLetterPreview) return;
    revokeGeneratedLetterPreview();
    revokeGeneratedLetterPreview = null;
};

const cleanupSupportingPreviews = (): void => {
    if (revokeSupportingGallery) {
        revokeSupportingGallery();
        revokeSupportingGallery = null;
    }
};

const cleanupSupportingDocumentUploadInputs = (): void => {
    if (!revokeSupportingDocumentUploadInputs) return;
    revokeSupportingDocumentUploadInputs();
    revokeSupportingDocumentUploadInputs = null;
};

const renderGeneratedLetterPreviewCard = (): string => renderProtectedPdfViewer(GENERATED_LETTER_PREVIEW_ROOT_ID, {
    title: 'Pratinjau Surat Tugas',
    subtitle: 'Pratinjau PDF dokumen pengajuan',
    loading: 'Memuat pratinjau surat...',
});

export const renderSuratTugasForm = async () => {
    resetState();
    renderLoading('Memuat formulir Surat Tugas...');

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
                suratTugasExistingSupportingDocumentValues(draftData.application),
            );
        }

        if (!application) {
            const activeApplication = await fetchLatestActiveApplication();
            if (activeApplication) {
                renderSuratTugasDetail(activeApplication.id);
                return;
            }
        }
    } catch (error) {
        console.error(error);
        showError('Gagal memuat formulir Surat Tugas.');
    }

    renderForm();
};

export const renderSuratTugasDetail = async (applicationId: number | string, options?: MahasiswaDetailNavigationOptions) => {
    const origin = resolveDetailOrigin(options);
    const activePage = activePageForDetailOrigin(origin);

    cleanupGeneratedLetterPreview();
    cleanupSupportingPreviews();
    renderLoading('Memuat detail pengajuan...', activePage);

    try {
        const response = await apiFetch(SURAT_TUGAS_MAHASISWA_ENDPOINTS.detail(applicationId), {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        const detailApplication = payload.application as SuratTugasApplication;
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
            renderSuratTugasForm();
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

function emptyFormData(): SuratTugasFormData {
    return emptySuratTugasDraftValues();
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
    const response = await apiFetch(SURAT_TUGAS_MAHASISWA_ENDPOINTS.draft, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(await parseApiError(response));
    }
    return await response.json();
};

const fetchLatestActiveApplication = async (): Promise<SuratTugasApplication | null> => {
    const response = await apiFetch(SURAT_TUGAS_MAHASISWA_ENDPOINTS.applications, { cache: 'no-store' });
    if (!response.ok) {
        return null;
    }
    const payload = await response.json();
    const applications = (payload.applications || []) as SuratTugasApplication[];
    return applications.find((item) => activeReadonlyStatuses.includes(item.status)) || null;
};

const mapApplicationData = (app: SuratTugasApplication): SuratTugasFormData => mapSuratTugasDraftValues(app);

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
                <form id="surat-tugas-form" class="p-6 md:p-10">
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
                    <p class="text-sm text-gray-500 mt-2">Data di bawah ini akan digunakan untuk pengajuan Surat Tugas.</p>
                </div>

                <div class="space-y-5">
                    ${renderTextInput('nama_perusahaan', 'Nama Perusahaan/Instansi', 'Contoh: Direktorat Teknologi Informasi UGM', formData.nama_perusahaan)}
                    ${renderTextarea('kegiatan', 'Kegiatan', 'Jelaskan kegiatan yang akan dilakukan', formData.kegiatan)}
                    ${renderTextInput('posisi', 'Posisi', 'Contoh: Fullstack Developer Intern', formData.posisi)}
                    ${renderTextInput('dosen_pembimbing_dpa', 'Dosen Pembimbing Akademik / DPA', 'Masukkan nama lengkap Dosen Pembimbing Akademik (DPA)', formData.dosen_pembimbing_dpa)}
                    ${renderDateInput('tgl_mulai', 'Tanggal Mulai', formData.tgl_mulai)}
                    ${renderDateInput('tgl_selesai', 'Tanggal Selesai', formData.tgl_selesai)}
                </div>

                ${renderSupportingDocumentUploadSection(
                    SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS,
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
                    ['Nama Perusahaan/Instansi', formData.nama_perusahaan],
                    ['Kegiatan', formData.kegiatan],
                    ['Posisi', formData.posisi],
                    ['Dosen Pembimbing Akademik / DPA', formData.dosen_pembimbing_dpa],
                    ['Tanggal Mulai', formatIndonesianDate(formData.tgl_mulai)],
                    ['Tanggal Selesai', formatIndonesianDate(formData.tgl_selesai)],
                ])}
                ${renderReviewSection('Dokumen Pendukung', [
                    ['Proposal Kegiatan Magang', supportingDocumentReviewValue('proposal')],
                    ['Surat Pengantar Magang', supportingDocumentReviewValue('surat_pengantar_magang')],
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

const renderTextInput = (name: keyof SuratTugasFormData, label: string, placeholder: string, value: string) => renderFormField({
    id: name,
    label,
    controlHtml: `<input id="${name}" name="${name}" type="text" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">`,
});

const renderTextarea = (name: keyof SuratTugasFormData, label: string, placeholder: string, value: string) => renderFormField({
    id: name,
    label,
    align: 'start',
    controlHtml: `<textarea id="${name}" name="${name}" rows="4" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">${escapeHtml(value)}</textarea>`,
});

const renderDateInput = (name: keyof SuratTugasFormData, label: string, value: string) => renderFormField({
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
        SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS,
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

    wireFormatters();
};

// Approved low-risk blur formatters only. nama_perusahaan keeps institutional
// acronyms (PT, CV, UGM, …); posisi uses plain Indonesian title-case. Free-text
// `kegiatan` and name-bearing `dosen_pembimbing_dpa` are intentionally left as-is.
const wireFormatters = () => {
    const byId = (id: string) => document.getElementById(id) as HTMLInputElement | null;

    const namaPerusahaan = byId('nama_perusahaan');
    if (namaPerusahaan) attachBlurTitleCase(namaPerusahaan);

    const posisi = byId('posisi');
    if (posisi) {
        posisi.addEventListener('blur', () => {
            const next = titleCaseIndonesian(posisi.value);
            if (next !== posisi.value) posisi.value = next;
        });
    }
};

const collectStep2Values = () => {
    formData.nama_perusahaan = readInputValue('nama_perusahaan');
    formData.kegiatan = readInputValue('kegiatan');
    formData.posisi = readInputValue('posisi');
    formData.dosen_pembimbing_dpa = readInputValue('dosen_pembimbing_dpa');
    formData.tgl_mulai = readInputValue('tgl_mulai');
    formData.tgl_selesai = readInputValue('tgl_selesai');
};

const validateStep2 = () => {
    const requiredFields: [keyof SuratTugasFormData, string][] = [
        ['nama_perusahaan', 'Nama Perusahaan/Instansi'],
        ['kegiatan', 'Kegiatan'],
        ['posisi', 'Posisi'],
        ['dosen_pembimbing_dpa', 'Dosen Pembimbing Akademik / DPA'],
        ['tgl_mulai', 'Tanggal Mulai'],
        ['tgl_selesai', 'Tanggal Selesai'],
    ];

    const missing = requiredFields.find(([key]) => !formData[key].trim());
    if (missing) {
        showWarning(`${missing[1]} wajib diisi.`);
        return false;
    }

    if (formData.tgl_selesai < formData.tgl_mulai) {
        showWarning('Tanggal Selesai harus pada atau setelah Tanggal Mulai.');
        return false;
    }

    const uploadValidation = validateSupportingDocumentUploads(
        SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS,
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

    const body = createSuratTugasDraftPayload(formData, supportingDocumentUploadState);

    try {
        const response = await apiFetch(SURAT_TUGAS_MAHASISWA_ENDPOINTS.draft, {
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
            suratTugasExistingSupportingDocumentValues(payload.application),
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
        const response = await apiFetch(SURAT_TUGAS_MAHASISWA_ENDPOINTS.submit, { method: 'POST' });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        showSuccess('Pengajuan Surat Tugas berhasil dikirim.');
        renderSuratTugasDetail(payload.application.id);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal mengirim pengajuan.');
        isSubmitting = false;
        renderForm();
    }
};

const renderSupportingDocsCard = (detailApplication: SuratTugasApplication): string => {
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
                        suratTugasSupportingDescriptors(detailApplication),
                    ),
                    { emptyLabel: retention.supportingDocumentsEmptyLabel },
                )}
            </div>
        </div>
    `;
};

const renderDetailContent = (detailApplication: SuratTugasApplication, viewProfile: ProfileViewData, origin: MahasiswaDetailOrigin) => {
    const status = detailApplication.status;
    const informasiRows: [string, string][] = [
        ['Jenis Surat', 'Surat Tugas'],
        ['Tanggal pengajuan', formatDetailDateTime(detailApplication.submitted_at || detailApplication.created_at)],
        ['Status', statusLabel(status)],
    ];
    if (valueOrEmpty(detailApplication.nomor_surat_tugas)) {
        informasiRows.push(['Nomor Surat Tugas', valueOrEmpty(detailApplication.nomor_surat_tugas)]);
    }

    return `
    <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
        ${renderDetailHeaderCard({
            backId: 'btn-detail-back',
            backLabel: backLabelForDetailOrigin(origin),
            title: 'Detail Pengajuan',
            subtitle: 'Surat Tugas',
            statusLabel: statusLabel(status),
            statusBadgeClass: statusBadgeClass(status),
        })}

        ${status === LETTER_WORKFLOW_STATUS.REVISION ? renderRevisionBanner(detailApplication.revision_note) : ''}
        ${status === LETTER_WORKFLOW_STATUS.REJECTED ? renderRejectedBanner(detailApplication.rejection_reason) : ''}

        ${renderDetailInfoCard('Informasi Surat', informasiRows)}

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
            ['Nama Perusahaan/Instansi', valueOrEmpty(detailApplication.nama_perusahaan)],
            ['Kegiatan', valueOrEmpty(detailApplication.kegiatan)],
            ['Posisi', valueOrEmpty(detailApplication.posisi)],
            ['Dosen Pembimbing Akademik / DPA', valueOrEmpty(detailApplication.dosen_pembimbing_dpa)],
            ['Tanggal Mulai', formatIndonesianDate(detailApplication.tgl_mulai)],
            ['Tanggal Selesai', formatIndonesianDate(detailApplication.tgl_selesai)],
        ])}

        ${renderSupportingDocsCard(detailApplication)}

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

const attachDetailEvents = (detailApplication: SuratTugasApplication, origin: MahasiswaDetailOrigin) => {
    document.getElementById('btn-detail-back')?.addEventListener('click', () => {
        cleanupGeneratedLetterPreview();
        cleanupSupportingPreviews();
        goToMahasiswaDetailOrigin(origin);
    });
    document.getElementById('btn-edit-revision')?.addEventListener('click', () => {
        if (detailApplication.status === LETTER_WORKFLOW_STATUS.REVISION) {
            renderSuratTugasForm();
        }
    });
    document.getElementById('btn-complete-application')?.addEventListener('click', () => {
        completeApplicationAfterReview(detailApplication, origin);
    });
    document.getElementById('btn-download-document')?.addEventListener('click', () => {
        downloadCompletedDocument(detailApplication);
    });

    revokeSupportingGallery = attachSupportingDocumentGallery(
        SUPPORTING_GALLERY_ROOT_ID,
        retentionAwareSupportingDescriptors(
            detailApplication.retention_summary,
            suratTugasSupportingDescriptors(detailApplication),
        ),
    );

    if (
        canPreviewFinalForMahasiswa(detailApplication.status, detailApplication.retention_summary)
    ) {
        cleanupGeneratedLetterPreview();
        revokeGeneratedLetterPreview = attachProtectedPdfViewer({
            rootId: GENERATED_LETTER_PREVIEW_ROOT_ID,
            endpointUrl: `/api/mahasiswa/surat-tugas/${detailApplication.id}/generated-preview`,
        });
    }
};

const renderDocumentReviewSection = (detailApplication: SuratTugasApplication) => {
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

const completeApplicationAfterReview = async (detailApplication: SuratTugasApplication, origin: MahasiswaDetailOrigin) => {
    if (!isStudentReviewStage(detailApplication.status)) {
        showWarning('Pengajuan belum berada pada tahap review mahasiswa.');
        return;
    }

    const button = document.getElementById('btn-complete-application') as HTMLButtonElement | null;
    setButtonLoading(button, 'Memproses...');

    try {
        const response = await apiFetch(`/api/mahasiswa/surat-tugas/${detailApplication.id}/complete`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        showSuccess('Pengajuan Surat Tugas telah diselesaikan.');
        cleanupGeneratedLetterPreview();
        renderSuratTugasDetail(payload.application?.id || detailApplication.id, { origin });
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal menyelesaikan pengajuan. Status pengajuan tidak diubah.');
        restoreButton(button, `${iconCheck('18')}<span>Selesaikan Pengajuan</span>`);
    }
};

const downloadCompletedDocument = async (detailApplication: SuratTugasApplication) => {
    if (!canDownloadFinalForMahasiswa(detailApplication.status, detailApplication.retention_summary)) {
        showWarning('Masa unduh surat resmi telah berakhir.');
        return;
    }

    const button = document.getElementById('btn-download-document') as HTMLButtonElement | null;
    setButtonLoading(button, 'Mengunduh...');

    try {
        const response = await apiFetch(`/api/mahasiswa/surat-tugas/${detailApplication.id}/final-download`, {
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
        link.download = `Surat_Tugas_${downloadIdentifier(detailApplication)}.pdf`;
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
        { key: LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI, label: 'Persetujuan Prodi' },
        { key: LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW, label: 'Persetujuan Departemen' },
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

const statusLabel = (status: string) => getLetterStatusLabel(status);

const statusBadgeClass = (status: string) => getLetterStatusTone(status, 'student-detail');

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

const downloadIdentifier = (detailApplication: SuratTugasApplication) => {
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
