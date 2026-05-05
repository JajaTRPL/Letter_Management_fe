import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import {
    ACTIVE_READONLY_LETTER_STATUSES,
    canCompleteSubmission,
    canDownloadDocument,
    canPreviewDocument,
    getLetterStatusLabel,
    getLetterStatusTone,
    isStudentReviewStage,
    LETTER_WORKFLOW_STATUS,
} from '../shared/letter-workflow';
import { showError, showSuccess, showWarning } from '../shared/toast';

type MagangApplication = {
    id: number;
    status: string;
    nama_penerima?: string | null;
    nama_perusahaan?: string | null;
    alamat_perusahaan?: string | null;
    peran?: string | null;
    rentang_tanggal?: string | null;
    dosen_pembimbing_dpa?: string | null;
    proposal_kegiatan_magang_path?: string | null;
    revision_note?: string | null;
    rejection_reason?: string | null;
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

type MagangFormData = {
    nama_penerima: string;
    nama_perusahaan: string;
    alamat_perusahaan: string;
    peran: string;
    rentang_tanggal: string;
    dosen_pembimbing_dpa: string;
    proposal_kegiatan_magang_path: string;
};

type ProfileViewData = {
    fullName: string;
    nim: string;
    faculty: string;
    studyProgram: string;
    email: string;
};

const activeReadonlyStatuses: readonly string[] = ACTIVE_READONLY_LETTER_STATUSES;

let currentStep = 1;
let application: MagangApplication | null = null;
let formData: MagangFormData = emptyFormData();
let profileData: ProfileViewData = emptyProfileData();
let selectedProposalFile: File | null = null;
let hasAcceptedStatement = false;
let isSubmitting = false;
const previewedApplicationIds = new Set<number>();
let activePreviewObjectUrl: string | null = null;

export const renderSuratPengantarMagangForm = async () => {
    resetState();
    renderLoading('Memuat formulir Surat Pengantar Magang...');

    try {
        const draftData = await fetchDraftData();
        profileData = mapProfileData(draftData.user, draftData.profile);

        if (draftData.application) {
            application = draftData.application;
            formData = mapApplicationData(draftData.application);
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

export const renderSuratPengantarMagangDetail = async (applicationId: number | string) => {
    renderLoading('Memuat detail pengajuan...');

    try {
        const response = await apiFetch(`/api/mahasiswa/surat-pengantar-magang/${applicationId}`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        const detailApplication = payload.application as MagangApplication;
        const viewProfile = mapProfileData(detailApplication.user, detailApplication.mahasiswa_profile);

        renderDashboardLayout('Detail Pengajuan', renderDetailContent(detailApplication, viewProfile), 'mahasiswa', 'administrasi');
        attachDetailEvents(detailApplication);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal memuat detail pengajuan.');
        renderSuratPengantarMagangForm();
    }
};

const resetState = () => {
    currentStep = 1;
    application = null;
    formData = emptyFormData();
    profileData = emptyProfileData();
    selectedProposalFile = null;
    hasAcceptedStatement = false;
    isSubmitting = false;
};

function emptyFormData(): MagangFormData {
    return {
        nama_penerima: '',
        nama_perusahaan: '',
        alamat_perusahaan: '',
        peran: '',
        rentang_tanggal: '',
        dosen_pembimbing_dpa: '',
        proposal_kegiatan_magang_path: '',
    };
}

function emptyProfileData(): ProfileViewData {
    return {
        fullName: '',
        nim: '',
        faculty: '',
        studyProgram: '',
        email: '',
    };
}

const fetchDraftData = async () => {
    const response = await apiFetch('/api/mahasiswa/surat-pengantar-magang/draft', {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response));
    }

    return await response.json();
};

const fetchLatestActiveApplication = async (): Promise<MagangApplication | null> => {
    const response = await apiFetch('/api/mahasiswa/surat-pengantar-magang/applications', {
        cache: 'no-store',
    });

    if (!response.ok) {
        return null;
    }

    const payload = await response.json();
    const applications = (payload.applications || []) as MagangApplication[];
    return applications.find((item) => activeReadonlyStatuses.includes(item.status)) || null;
};

const mapProfileData = (user?: StudentUser | null, profile?: StudentProfile | null): ProfileViewData => ({
    fullName: valueOrEmpty(user?.name) || valueOrEmpty(localStorage.getItem('auth_name')),
    nim: valueOrEmpty(profile?.nim),
    faculty: valueOrEmpty(user?.study_program?.department?.faculty?.name) || valueOrEmpty(profile?.fakultas),
    studyProgram: valueOrEmpty(user?.study_program?.name) || valueOrEmpty(profile?.program_studi),
    email: valueOrEmpty(user?.email),
});

const mapApplicationData = (app: MagangApplication): MagangFormData => ({
    nama_penerima: valueOrEmpty(app.nama_penerima),
    nama_perusahaan: valueOrEmpty(app.nama_perusahaan),
    alamat_perusahaan: valueOrEmpty(app.alamat_perusahaan),
    peran: valueOrEmpty(app.peran),
    rentang_tanggal: valueOrEmpty(app.rentang_tanggal),
    dosen_pembimbing_dpa: valueOrEmpty(app.dosen_pembimbing_dpa),
    proposal_kegiatan_magang_path: valueOrEmpty(app.proposal_kegiatan_magang_path),
});

const renderLoading = (message: string) => {
    renderDashboardLayout('Formulir Surat', `
        <div class="max-w-5xl mx-auto">
            <div class="bg-white border border-gray-100 rounded-[24px] p-10 shadow-sm flex items-center gap-4">
                <div class="w-9 h-9 rounded-full border-4 border-teal-100 border-t-primary-teal animate-spin"></div>
                <p class="text-sm font-semibold text-gray-600">${escapeHtml(message)}</p>
            </div>
        </div>
    `, 'mahasiswa', 'administrasi');
};

const renderForm = () => {
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
                    ${renderTextInput('nama_penerima', 'Nama Penerima', 'Contoh: Direktur', formData.nama_penerima)}
                    ${renderTextInput('nama_perusahaan', 'Nama Perusahaan', 'Contoh: Direktorat Teknologi Informasi UGM', formData.nama_perusahaan)}
                    ${renderTextarea('alamat_perusahaan', 'Alamat Perusahaan', 'Masukkan alamat perusahaan', formData.alamat_perusahaan)}
                </div>

                <div class="border-t border-gray-200 pt-8 space-y-5">
                    <h3 class="text-xl font-bold text-gray-800">Informasi Kegiatan</h3>
                    ${renderTextInput('peran', 'Peran', 'Contoh: Fullstack Developer Intern', formData.peran)}
                    ${renderTextInput('rentang_tanggal', 'Rentang Tanggal', 'Contoh: 23 Februari 2026 s.d. 23 Juni 2026', formData.rentang_tanggal)}
                    ${renderTextInput('dosen_pembimbing_dpa', 'Dosen Pembimbing/DPA', 'Masukkan nama lengkap Dosen Pembimbing/DPA', formData.dosen_pembimbing_dpa)}
                </div>

                <div class="border-t border-gray-200 pt-8 space-y-5">
                    <h3 class="text-xl font-bold text-gray-800">Dokumen Pendukung</h3>
                    <div class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 md:gap-6 md:items-start">
                        <label for="proposal_kegiatan_magang" class="text-sm font-bold text-gray-800 pt-2">Proposal Kegiatan Magang</label>
                        <div>
                            <input id="proposal_kegiatan_magang" name="proposal_kegiatan_magang" type="file" class="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:bg-gray-200 file:text-gray-600 hover:file:bg-gray-300 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-primary-teal">
                            <p id="proposal-file-name" class="text-xs text-gray-500 mt-2">
                                ${formData.proposal_kegiatan_magang_path ? `File tersimpan: ${escapeHtml(fileNameFromPath(formData.proposal_kegiatan_magang_path))}` : 'Unggah proposal kegiatan magang. Maks. 2 MB.'}
                            </p>
                        </div>
                    </div>
                </div>
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
                    ['Nama Penerima', formData.nama_penerima],
                    ['Nama Perusahaan', formData.nama_perusahaan],
                    ['Alamat Perusahaan', formData.alamat_perusahaan],
                ])}
                ${renderReviewSection('Informasi Kegiatan', [
                    ['Peran', formData.peran],
                    ['Rentang Tanggal', formData.rentang_tanggal],
                    ['Dosen Pembimbing/DPA', formData.dosen_pembimbing_dpa],
                ])}
                ${renderReviewSection('Dokumen Pendukung', [
                    ['Proposal Kegiatan Magang', fileNameFromPath(formData.proposal_kegiatan_magang_path)],
                ])}
            </div>

            <label class="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                <input id="agreement-checkbox" type="checkbox" ${hasAcceptedStatement ? 'checked' : ''} class="mt-1 w-4 h-4 rounded border-gray-300 text-primary-teal focus:ring-primary-teal">
                <span>Dengan ini saya menyatakan bahwa seluruh data yang saya kirimkan adalah benar dan dapat dipertanggungjawabkan.</span>
            </label>
        </div>
    `;
};

const renderReadonlyField = (label: string, value: string) => `
    <div class="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-6 md:items-center">
        <label class="text-sm font-bold text-gray-800">${escapeHtml(label)}</label>
        <input type="text" value="${escapeAttribute(value || '-')}" readonly class="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed outline-none">
    </div>
`;

const renderTextInput = (name: keyof MagangFormData, label: string, placeholder: string, value: string) => `
    <div class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 md:gap-6 md:items-center">
        <label for="${name}" class="text-sm font-bold text-gray-800">${escapeHtml(label)}</label>
        <input id="${name}" name="${name}" type="text" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">
    </div>
`;

const renderTextarea = (name: keyof MagangFormData, label: string, placeholder: string, value: string) => `
    <div class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 md:gap-6 md:items-start">
        <label for="${name}" class="text-sm font-bold text-gray-800 pt-2">${escapeHtml(label)}</label>
        <textarea id="${name}" name="${name}" rows="4" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">${escapeHtml(value)}</textarea>
    </div>
`;

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

const renderNavigationButtons = () => {
    const isSubmitStep = currentStep === 3;
    const submitDisabled = isSubmitStep && !hasAcceptedStatement;
    const nextLabel = isSubmitStep
        ? application?.status === LETTER_WORKFLOW_STATUS.REVISION ? 'Kirim Ulang Pengajuan' : 'Kirim Pengajuan'
        : 'Lanjutkan';

    return `
        <div class="pt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button id="btn-prev-step" type="button" class="px-6 py-2.5 border border-primary-teal text-primary-teal font-bold rounded-xl hover:bg-teal-50 transition-colors ${currentStep === 1 ? 'sm:invisible' : ''}">
                ${currentStep === 1 ? 'Batalkan' : 'Kembali'}
            </button>
            <button id="btn-next-step" type="button" ${submitDisabled || isSubmitting ? 'disabled' : ''} class="px-7 py-2.5 rounded-xl font-bold transition-colors ${submitDisabled || isSubmitting ? 'bg-gray-300 text-white cursor-not-allowed' : 'bg-primary-teal text-white hover:bg-teal-800'}">
                ${isSubmitting ? 'Memproses...' : escapeHtml(nextLabel)}
            </button>
        </div>
    `;
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

    document.getElementById('proposal_kegiatan_magang')?.addEventListener('change', (event) => {
        const input = event.currentTarget as HTMLInputElement;
        selectedProposalFile = input.files?.[0] || null;
        const label = document.getElementById('proposal-file-name');
        if (label && selectedProposalFile) {
            label.textContent = `File dipilih: ${selectedProposalFile.name}`;
        }
    });

    document.getElementById('agreement-checkbox')?.addEventListener('change', (event) => {
        hasAcceptedStatement = (event.currentTarget as HTMLInputElement).checked;
        renderForm();
    });
};

const collectStep2Values = () => {
    formData.nama_penerima = readInputValue('nama_penerima');
    formData.nama_perusahaan = readInputValue('nama_perusahaan');
    formData.alamat_perusahaan = readInputValue('alamat_perusahaan');
    formData.peran = readInputValue('peran');
    formData.rentang_tanggal = readInputValue('rentang_tanggal');
    formData.dosen_pembimbing_dpa = readInputValue('dosen_pembimbing_dpa');
};

const validateStep2 = () => {
    const requiredFields: [keyof MagangFormData, string][] = [
        ['nama_penerima', 'Nama Penerima'],
        ['nama_perusahaan', 'Nama Perusahaan'],
        ['alamat_perusahaan', 'Alamat Perusahaan'],
        ['peran', 'Peran'],
        ['rentang_tanggal', 'Rentang Tanggal'],
        ['dosen_pembimbing_dpa', 'Dosen Pembimbing/DPA'],
    ];

    const missing = requiredFields.find(([key]) => !formData[key].trim());
    if (missing) {
        showWarning(`${missing[1]} wajib diisi.`);
        return false;
    }

    if (!selectedProposalFile && !formData.proposal_kegiatan_magang_path) {
        showWarning('Proposal Kegiatan Magang wajib diunggah.');
        return false;
    }

    if (selectedProposalFile && selectedProposalFile.size > 2 * 1024 * 1024) {
        showWarning('Ukuran Proposal Kegiatan Magang maksimal 2 MB.');
        return false;
    }

    return true;
};

const saveDraft = async () => {
    isSubmitting = true;
    renderForm();

    const body = new FormData();
    body.append('nama_penerima', formData.nama_penerima);
    body.append('nama_perusahaan', formData.nama_perusahaan);
    body.append('alamat_perusahaan', formData.alamat_perusahaan);
    body.append('peran', formData.peran);
    body.append('rentang_tanggal', formData.rentang_tanggal);
    body.append('dosen_pembimbing_dpa', formData.dosen_pembimbing_dpa);
    if (selectedProposalFile) {
        body.append('proposal_kegiatan_magang', selectedProposalFile);
    }

    try {
        const response = await apiFetch('/api/mahasiswa/surat-pengantar-magang/draft', {
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
        selectedProposalFile = null;
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
        const response = await apiFetch('/api/mahasiswa/surat-pengantar-magang/submit', {
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

const renderDetailContent = (detailApplication: MagangApplication, viewProfile: ProfileViewData) => `
    <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button id="btn-detail-back" type="button" class="inline-flex items-center gap-2 text-gray-700 hover:text-primary-teal font-semibold w-fit">
                ${iconArrowLeft('20')}
                <span>Kembali ke Administrasi Surat</span>
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
                <p class="text-sm text-gray-500 mt-2">Surat Pengantar Magang</p>
            </div>

            ${renderReviewSection('Profil SSO', [
                ['Nama Lengkap', viewProfile.fullName],
                ['NIM', viewProfile.nim],
                ['Fakultas', viewProfile.faculty],
                ['Program Studi', viewProfile.studyProgram],
                ['Email Aktif', viewProfile.email],
            ])}
            ${renderReviewSection('Detail Pengajuan', [
                ['Nama Penerima', valueOrEmpty(detailApplication.nama_penerima)],
                ['Nama Perusahaan', valueOrEmpty(detailApplication.nama_perusahaan)],
                ['Alamat Perusahaan', valueOrEmpty(detailApplication.alamat_perusahaan)],
            ])}
            ${renderReviewSection('Informasi Kegiatan', [
                ['Peran', valueOrEmpty(detailApplication.peran)],
                ['Rentang Tanggal', valueOrEmpty(detailApplication.rentang_tanggal)],
                ['Dosen Pembimbing/DPA', valueOrEmpty(detailApplication.dosen_pembimbing_dpa)],
            ])}
            ${renderReviewSection('Dokumen Pendukung', [
                ['Proposal Kegiatan Magang', fileNameFromPath(valueOrEmpty(detailApplication.proposal_kegiatan_magang_path))],
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

const attachDetailEvents = (detailApplication: MagangApplication) => {
    document.getElementById('btn-detail-back')?.addEventListener('click', goToAdministrasiSurat);
    document.getElementById('btn-edit-revision')?.addEventListener('click', () => {
        if (detailApplication.status === LETTER_WORKFLOW_STATUS.REVISION) {
            renderSuratPengantarMagangForm();
        }
    });
    document.getElementById('btn-review-document')?.addEventListener('click', () => {
        openDocumentPreview(detailApplication);
    });
    document.getElementById('btn-complete-application')?.addEventListener('click', () => {
        completeApplicationAfterReview(detailApplication);
    });
    document.getElementById('btn-download-document')?.addEventListener('click', () => {
        downloadCompletedDocument(detailApplication);
    });
};

const renderDocumentReviewSection = (detailApplication: MagangApplication) => {
    if (isStudentReviewStage(detailApplication.status)) {
        const hasPreviewed = hasDocumentBeenReviewed(detailApplication);
        return `
            <section class="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">Review Dokumen</h3>
                        <p id="document-review-message" class="text-sm text-gray-600 mt-1">
                            Silakan review dokumen sebelum menyelesaikan pengajuan.
                        </p>
                    </div>
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button id="btn-review-document" type="button" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-primary-teal text-primary-teal font-bold rounded-xl hover:bg-teal-50 transition-colors">
                            ${iconFileText('18')}
                            <span>Review Dokumen</span>
                        </button>
                        <button id="btn-complete-application" type="button" ${hasPreviewed ? '' : 'disabled'} class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-colors ${hasPreviewed ? 'bg-primary-teal text-white hover:bg-teal-800' : 'bg-gray-300 text-white cursor-not-allowed'}">
                            ${iconCheck('18')}
                            <span>Selesaikan Pengajuan</span>
                        </button>
                    </div>
                </div>
                <div id="document-preview-panel" class="hidden border border-gray-200 rounded-2xl overflow-hidden bg-gray-50">
                    <div class="px-4 py-3 bg-[#F0F8F7] border-b border-gray-200 flex items-center gap-2 text-sm font-bold text-gray-800">
                        ${iconFileText('18')}
                        <span>Pratinjau Surat Pengantar Magang</span>
                    </div>
                    <iframe id="document-preview-frame" title="Pratinjau Surat Pengantar Magang" class="w-full h-[70vh] bg-white"></iframe>
                </div>
            </section>
        `;
    }

    if (canDownloadDocument(detailApplication.status)) {
        return `
            <section class="bg-white border border-gray-100 rounded-2xl p-6">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">Dokumen Selesai</h3>
                        <p class="text-sm text-gray-600 mt-1">Pengajuan telah selesai. Dokumen dapat diunduh.</p>
                    </div>
                    <button id="btn-download-document" type="button" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-teal text-white font-bold rounded-xl hover:bg-teal-800 transition-colors">
                        ${iconDownload('18')}
                        <span>Download Dokumen</span>
                    </button>
                </div>
            </section>
        `;
    }

    return '';
};

const openDocumentPreview = async (detailApplication: MagangApplication) => {
    if (!canPreviewDocument(detailApplication.status)) {
        showWarning('Dokumen belum tersedia untuk direview.');
        return;
    }

    const button = document.getElementById('btn-review-document') as HTMLButtonElement | null;
    setButtonLoading(button, 'Memuat...');

    try {
        const response = await apiFetch(`/api/mahasiswa/surat-pengantar-magang/${detailApplication.id}/preview`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const blob = await response.blob();
        if (activePreviewObjectUrl) {
            URL.revokeObjectURL(activePreviewObjectUrl);
        }
        activePreviewObjectUrl = URL.createObjectURL(blob);

        const previewFrame = document.getElementById('document-preview-frame') as HTMLIFrameElement | null;
        const previewPanel = document.getElementById('document-preview-panel') as HTMLElement | null;
        if (previewFrame && previewPanel) {
            previewFrame.src = activePreviewObjectUrl;
            previewPanel.classList.remove('hidden');
            previewPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        previewedApplicationIds.add(detailApplication.id);
        enableCompleteButton();
        detailApplication.student_reviewed_at = detailApplication.student_reviewed_at || new Date().toISOString();
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Tidak dapat membuka pratinjau dokumen. Silakan coba beberapa saat lagi.');
    } finally {
        restoreButton(button, `${iconFileText('18')}<span>Review Dokumen</span>`);
    }
};

const completeApplicationAfterReview = async (detailApplication: MagangApplication) => {
    if (!isStudentReviewStage(detailApplication.status)) {
        showWarning('Pengajuan belum berada pada tahap review mahasiswa.');
        return;
    }

    if (!canCompleteSubmission(detailApplication.status, hasDocumentBeenReviewed(detailApplication))) {
        showWarning('Silakan review dokumen sebelum menyelesaikan pengajuan.');
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
        renderSuratPengantarMagangDetail(payload.application?.id || detailApplication.id);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal menyelesaikan pengajuan. Status pengajuan tidak diubah.');
        restoreButton(button, `${iconCheck('18')}<span>Selesaikan Pengajuan</span>`);
    }
};

const downloadCompletedDocument = async (detailApplication: MagangApplication) => {
    if (!canDownloadDocument(detailApplication.status)) {
        showWarning('Download dokumen hanya tersedia setelah pengajuan selesai.');
        return;
    }

    const button = document.getElementById('btn-download-document') as HTMLButtonElement | null;
    setButtonLoading(button, 'Mengunduh...');

    try {
        const response = await apiFetch(`/api/mahasiswa/surat-pengantar-magang/${detailApplication.id}/preview`, {
            cache: 'no-store',
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
        restoreButton(button, `${iconDownload('18')}<span>Download Dokumen</span>`);
    }
};

const hasDocumentBeenReviewed = (detailApplication: MagangApplication) => (
    Boolean(detailApplication.student_reviewed_at) || previewedApplicationIds.has(detailApplication.id)
);

const enableCompleteButton = () => {
    const button = document.getElementById('btn-complete-application') as HTMLButtonElement | null;
    if (!button) return;

    button.disabled = false;
    button.classList.remove('bg-gray-300', 'cursor-not-allowed');
    button.classList.add('bg-primary-teal', 'hover:bg-teal-800');
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
        <section class="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-5">Tahap Pengajuan</h3>
            <ol class="space-y-4">
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
        </section>
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

const fileNameFromPath = (path?: string | null) => {
    const cleanPath = valueOrEmpty(path);
    if (!cleanPath) return '-';
    const withoutQuery = cleanPath.split('?')[0] || cleanPath;
    return decodeURIComponent(withoutQuery.split('/').pop() || withoutQuery);
};

const valueOrEmpty = (value?: string | null) => value ? String(value) : '';
const downloadIdentifier = (detailApplication: MagangApplication) => {
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
const iconFileText = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`;
const iconDownload = (size: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
