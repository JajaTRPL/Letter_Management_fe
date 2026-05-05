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

type AktifApplication = {
    id: number;
    status: string;
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    jenis_kelamin?: string | null;
    keperluan?: string | null;
    nama_orang_tua_wali?: string | null;
    pekerjaan_orang_tua_wali?: string | null;
    nip_orang_tua_wali?: string | null;
    pangkat_gol_orang_tua_wali?: string | null;
    instansi_orang_tua_wali?: string | null;
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

type AktifFormData = {
    tempat_lahir: string;
    tanggal_lahir: string;
    tanggal_lahir_day: string;
    tanggal_lahir_month: string;
    tanggal_lahir_year: string;
    jenis_kelamin: string;
    keperluan: string;
    nama_orang_tua_wali: string;
    pekerjaan_orang_tua_wali: string;
    nip_orang_tua_wali: string;
    pangkat_gol_orang_tua_wali: string;
    instansi_orang_tua_wali: string;
};

type ProfileViewData = {
    fullName: string;
    nim: string;
    faculty: string;
    studyProgram: string;
    email: string;
};

const API_PREFIX = '/api/mahasiswa/surat-keterangan-aktif';
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
let application: AktifApplication | null = null;
let formData: AktifFormData = emptyFormData();
let profileData: ProfileViewData = emptyProfileData();
let hasAcceptedStatement = false;
let isSubmitting = false;
const previewedApplicationIds = new Set<number>();
let activePreviewObjectUrl: string | null = null;

export const renderSuratKeteranganAktifForm = async (forceEditRevision = false) => {
    resetState();
    renderLoading('Memuat formulir Surat Keterangan Aktif...');

    try {
        if (!forceEditRevision) {
            const activeApplication = await fetchLatestActiveApplication();
            if (activeApplication) {
                renderSuratKeteranganAktifDetail(activeApplication.id);
                return;
            }
        }

        const draftData = await fetchDraftData();
        profileData = mapProfileData(draftData.user, draftData.profile);

        if (draftData.application) {
            application = draftData.application;
            formData = mapApplicationData(draftData.application);
        }
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal memuat formulir Surat Keterangan Aktif.');
    }

    renderForm();
};

export const renderSuratKeteranganAktifDetail = async (applicationId: number | string) => {
    renderLoading('Memuat detail pengajuan...');

    try {
        const response = await apiFetch(`${API_PREFIX}/${applicationId}`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        const detailApplication = payload.application as AktifApplication;
        const viewProfile = mapProfileData(detailApplication.user, detailApplication.mahasiswa_profile);

        renderDashboardLayout('Detail Pengajuan', renderDetailContent(detailApplication, viewProfile), 'mahasiswa', 'administrasi');
        attachDetailEvents(detailApplication);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal memuat detail pengajuan.');
        goToAdministrasiSurat();
    }
};

const resetState = () => {
    currentStep = 1;
    application = null;
    formData = emptyFormData();
    profileData = emptyProfileData();
    hasAcceptedStatement = false;
    isSubmitting = false;
};

function emptyFormData(): AktifFormData {
    return {
        tempat_lahir: '',
        tanggal_lahir: '',
        tanggal_lahir_day: '',
        tanggal_lahir_month: '',
        tanggal_lahir_year: '',
        jenis_kelamin: '',
        keperluan: '',
        nama_orang_tua_wali: '',
        pekerjaan_orang_tua_wali: '',
        nip_orang_tua_wali: '',
        pangkat_gol_orang_tua_wali: '',
        instansi_orang_tua_wali: '',
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
    const response = await apiFetch(`${API_PREFIX}/draft`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response));
    }

    return await response.json();
};

const fetchLatestActiveApplication = async (): Promise<AktifApplication | null> => {
    const response = await apiFetch(`${API_PREFIX}/applications`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        return null;
    }

    const payload = await response.json();
    const applications = (payload.applications || []) as AktifApplication[];

    return applications.find((item) => activeEntryStatuses.includes(item.status)) || null;
};

const mapProfileData = (user?: StudentUser | null, profile?: StudentProfile | null): ProfileViewData => ({
    fullName: valueOrEmpty(user?.name) || valueOrEmpty(localStorage.getItem('auth_name')),
    nim: valueOrEmpty(profile?.nim),
    faculty: valueOrEmpty(user?.study_program?.department?.faculty?.name) || valueOrEmpty(profile?.fakultas),
    studyProgram: valueOrEmpty(user?.study_program?.name) || valueOrEmpty(profile?.program_studi),
    email: valueOrEmpty(user?.email),
});

const mapApplicationData = (app: AktifApplication): AktifFormData => {
    const mapped = emptyFormData();
    const dateParts = parseDateParts(app.tanggal_lahir);

    mapped.tempat_lahir = valueOrEmpty(app.tempat_lahir);
    mapped.tanggal_lahir = dateParts.isoDate;
    mapped.tanggal_lahir_day = dateParts.day;
    mapped.tanggal_lahir_month = dateParts.month;
    mapped.tanggal_lahir_year = dateParts.year;
    mapped.jenis_kelamin = valueOrEmpty(app.jenis_kelamin);
    mapped.keperluan = valueOrEmpty(app.keperluan);
    mapped.nama_orang_tua_wali = valueOrEmpty(app.nama_orang_tua_wali);
    mapped.pekerjaan_orang_tua_wali = valueOrEmpty(app.pekerjaan_orang_tua_wali);
    mapped.nip_orang_tua_wali = valueOrEmpty(app.nip_orang_tua_wali);
    mapped.pangkat_gol_orang_tua_wali = valueOrEmpty(app.pangkat_gol_orang_tua_wali);
    mapped.instansi_orang_tua_wali = valueOrEmpty(app.instansi_orang_tua_wali);

    return mapped;
};

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
            ${isRevision ? renderRevisionBanner(application?.revision_note) : ''}
            ${renderStepper()}

            <section class="bg-white rounded-[18px] border border-gray-200 shadow-sm overflow-hidden">
                <form id="aktif-form" class="p-6 md:p-12">
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

                <div class="space-y-5">
                    ${renderDatePlaceRow()}
                    ${renderRadioGroup()}
                    ${renderTextInput('keperluan', 'Keperluan', 'Contoh: Syarat administrasi beasiswa atau keperluan lainnya', formData.keperluan)}
                </div>

                <div class="border-t border-gray-400 pt-8 space-y-5">
                    <h3 class="text-2xl font-bold text-gray-800">Data Orang Tua/Wali</h3>
                    ${renderTextInput('nama_orang_tua_wali', 'Nama', 'Masukkan nama lengkap', formData.nama_orang_tua_wali)}
                    ${renderTextInput('pekerjaan_orang_tua_wali', 'Pekerjaan', 'Contoh: Pegawai Swasta', formData.pekerjaan_orang_tua_wali)}
                    ${renderTextInput('nip_orang_tua_wali', 'NIP', 'Masukkan NIP (jika ada)', formData.nip_orang_tua_wali)}
                    ${renderTextInput('pangkat_gol_orang_tua_wali', 'Pangkat/Gol', 'Contoh: III/a (jika ada)', formData.pangkat_gol_orang_tua_wali)}
                    ${renderTextInput('instansi_orang_tua_wali', 'Instansi', 'Contoh: Dinas Pendidikan DIY', formData.instansi_orang_tua_wali)}
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
                    ['Keperluan', formData.keperluan],
                ])}
                ${renderReviewSection('Data Orang Tua/Wali', [
                    ['Nama', formData.nama_orang_tua_wali],
                    ['Pekerjaan', formData.pekerjaan_orang_tua_wali],
                    ['NIP', formData.nip_orang_tua_wali],
                    ['Pangkat/Gol', formData.pangkat_gol_orang_tua_wali],
                    ['Instansi', formData.instansi_orang_tua_wali],
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

const renderTextInput = (name: keyof AktifFormData, label: string, placeholder: string, value: string) => `
    <div class="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-3 md:gap-6 md:items-center">
        <label for="${name}" class="text-sm font-semibold text-gray-800">${escapeHtml(label)}</label>
        <input id="${name}" name="${name}" type="text" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" class="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">
    </div>
`;

const renderDatePlaceRow = () => `
    <div class="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-3 md:gap-6 md:items-center">
        <label class="text-sm font-semibold text-gray-800">Tempat, Tanggal Lahir</label>
        <div class="grid grid-cols-1 sm:grid-cols-[minmax(180px,1fr)_128px_128px_128px] gap-3">
            <input id="tempat_lahir" name="tempat_lahir" type="text" value="${escapeAttribute(formData.tempat_lahir)}" placeholder="Contoh: Sleman" class="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50">
            ${renderSelect('tanggal_lahir_day', 'Tanggal', dayOptions(), formData.tanggal_lahir_day)}
            ${renderSelect('tanggal_lahir_month', 'Bulan', monthOptions(), formData.tanggal_lahir_month)}
            ${renderSelect('tanggal_lahir_year', 'Tahun', yearOptions(), formData.tanggal_lahir_year)}
        </div>
    </div>
`;

const renderSelect = (
    id: keyof AktifFormData,
    placeholder: string,
    options: { value: string; label: string }[],
    selectedValue: string,
) => `
    <select id="${id}" name="${id}" class="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-primary-teal focus:ring-2 focus:ring-teal-50 ${selectedValue ? 'text-gray-800' : 'text-gray-400'}">
        <option value="">${escapeHtml(placeholder)}</option>
        ${options.map((option) => `
            <option value="${escapeAttribute(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>
        `).join('')}
    </select>
`;

const renderRadioGroup = () => `
    <fieldset class="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-3 md:gap-6 md:items-center">
        <legend class="text-sm font-semibold text-gray-800">Jenis Kelamin</legend>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-14">
            ${renderRadio('Laki-laki')}
            ${renderRadio('Perempuan')}
        </div>
    </fieldset>
`;

const renderRadio = (value: string) => `
    <label class="inline-flex items-center gap-3 text-sm text-gray-800 cursor-pointer">
        <input type="radio" name="jenis_kelamin" value="${escapeAttribute(value)}" ${formData.jenis_kelamin === value ? 'checked' : ''} class="w-5 h-5 text-primary-teal border-gray-300 focus:ring-primary-teal">
        <span>${escapeHtml(value)}</span>
    </label>
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
    const submitDisabled = isSubmitStep && !hasAcceptedStatement;
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

    formData.tempat_lahir = readInputValue('tempat_lahir');
    formData.tanggal_lahir_day = readInputValue('tanggal_lahir_day');
    formData.tanggal_lahir_month = readInputValue('tanggal_lahir_month');
    formData.tanggal_lahir_year = readInputValue('tanggal_lahir_year');
    formData.jenis_kelamin = readRadioValue('jenis_kelamin');
    formData.keperluan = readInputValue('keperluan');
    formData.nama_orang_tua_wali = readInputValue('nama_orang_tua_wali');
    formData.pekerjaan_orang_tua_wali = readInputValue('pekerjaan_orang_tua_wali');
    formData.nip_orang_tua_wali = readInputValue('nip_orang_tua_wali');
    formData.pangkat_gol_orang_tua_wali = readInputValue('pangkat_gol_orang_tua_wali');
    formData.instansi_orang_tua_wali = readInputValue('instansi_orang_tua_wali');
};

const validateStep2 = () => {
    const requiredFields: [keyof AktifFormData, string][] = [
        ['tempat_lahir', 'Tempat lahir'],
        ['jenis_kelamin', 'Jenis kelamin'],
        ['keperluan', 'Keperluan'],
        ['nama_orang_tua_wali', 'Nama orang tua/wali'],
        ['pekerjaan_orang_tua_wali', 'Pekerjaan orang tua/wali'],
    ];

    const missing = requiredFields.find(([key]) => !formData[key].trim());
    if (missing) {
        showWarning(`${missing[1]} wajib diisi.`);
        return false;
    }

    const dateResult = buildIsoDate(
        formData.tanggal_lahir_day,
        formData.tanggal_lahir_month,
        formData.tanggal_lahir_year,
    );

    if (!dateResult.ok) {
        showWarning(dateResult.message);
        return false;
    }

    formData.tanggal_lahir = dateResult.value;
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
                ? 'Revisi Surat Keterangan Aktif berhasil dikirim ulang.'
                : 'Pengajuan Surat Keterangan Aktif berhasil dikirim.',
        );
        renderSuratKeteranganAktifDetail(payload.application.id);
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
    keperluan: formData.keperluan,
    nama_orang_tua_wali: formData.nama_orang_tua_wali,
    pekerjaan_orang_tua_wali: formData.pekerjaan_orang_tua_wali,
    nip_orang_tua_wali: formData.nip_orang_tua_wali,
    pangkat_gol_orang_tua_wali: formData.pangkat_gol_orang_tua_wali,
    instansi_orang_tua_wali: formData.instansi_orang_tua_wali,
});

const renderDetailContent = (detailApplication: AktifApplication, viewProfile: ProfileViewData) => `
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
                <p class="text-sm text-gray-500 mt-2">Surat Keterangan Aktif</p>
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
                ['Keperluan', valueOrEmpty(detailApplication.keperluan)],
            ])}
            ${renderReviewSection('Data Orang Tua/Wali', [
                ['Nama', valueOrEmpty(detailApplication.nama_orang_tua_wali)],
                ['Pekerjaan', valueOrEmpty(detailApplication.pekerjaan_orang_tua_wali)],
                ['NIP', valueOrEmpty(detailApplication.nip_orang_tua_wali)],
                ['Pangkat/Gol', valueOrEmpty(detailApplication.pangkat_gol_orang_tua_wali)],
                ['Instansi', valueOrEmpty(detailApplication.instansi_orang_tua_wali)],
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

const attachDetailEvents = (detailApplication: AktifApplication) => {
    document.getElementById('btn-detail-back')?.addEventListener('click', goToAdministrasiSurat);
    document.getElementById('btn-edit-revision')?.addEventListener('click', () => {
        if (detailApplication.status === LETTER_WORKFLOW_STATUS.REVISION) {
            renderSuratKeteranganAktifForm(true);
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

const renderDocumentReviewSection = (detailApplication: AktifApplication) => {
    if (isStudentReviewStage(detailApplication.status)) {
        const hasPreviewed = hasDocumentBeenReviewed(detailApplication);
        return `
            <section class="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">Review Dokumen</h3>
                        <p class="text-sm text-gray-600 mt-1">Silakan review dokumen sebelum menyelesaikan pengajuan.</p>
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
                        <span>Pratinjau Surat Keterangan Aktif</span>
                    </div>
                    <iframe id="document-preview-frame" title="Pratinjau Surat Keterangan Aktif" class="w-full h-[70vh] bg-white"></iframe>
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

const openDocumentPreview = async (detailApplication: AktifApplication) => {
    if (!canPreviewDocument(detailApplication.status)) {
        showWarning('Dokumen belum tersedia untuk direview.');
        return;
    }

    const button = document.getElementById('btn-review-document') as HTMLButtonElement | null;
    setButtonLoading(button, 'Memuat...');

    try {
        const response = await apiFetch(`${API_PREFIX}/${detailApplication.id}/preview`, {
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

const completeApplicationAfterReview = async (detailApplication: AktifApplication) => {
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
        const response = await apiFetch(`${API_PREFIX}/${detailApplication.id}/complete`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const payload = await response.json();
        showSuccess('Pengajuan Surat Keterangan Aktif telah diselesaikan.');
        renderSuratKeteranganAktifDetail(payload.application?.id || detailApplication.id);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal menyelesaikan pengajuan. Status pengajuan tidak diubah.');
        restoreButton(button, `${iconCheck('18')}<span>Selesaikan Pengajuan</span>`);
    }
};

const downloadCompletedDocument = async (detailApplication: AktifApplication) => {
    if (!canDownloadDocument(detailApplication.status)) {
        showWarning('Download dokumen hanya tersedia setelah pengajuan selesai.');
        return;
    }

    const button = document.getElementById('btn-download-document') as HTMLButtonElement | null;
    setButtonLoading(button, 'Mengunduh...');

    try {
        const response = await apiFetch(`${API_PREFIX}/${detailApplication.id}/preview`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response));
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `Surat_Keterangan_Aktif_${downloadIdentifier(detailApplication)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
        console.error(error);
        showError(error instanceof Error ? error.message : 'Gagal mengunduh dokumen. Silakan coba beberapa saat lagi.');
    } finally {
        restoreButton(button, `${iconDownload('18')}<span>Download Dokumen</span>`);
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

const dayOptions = () => Array.from({ length: 31 }, (_, index) => {
    const value = String(index + 1).padStart(2, '0');
    return { value, label: String(index + 1) };
});

const monthOptions = () => MONTH_NAMES.map((label, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label,
}));

const yearOptions = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 80 }, (_, index) => {
        const year = String(currentYear - index);
        return { value: year, label: year };
    });
};

type DateValidationResult =
    | { ok: true; value: string }
    | { ok: false; message: string };

const buildIsoDate = (day: string, month: string, year: string): DateValidationResult => {
    if (!day || !month || !year) {
        return { ok: false, message: 'Tanggal lahir wajib dipilih lengkap.' };
    }

    const dayNumber = Number(day);
    const monthNumber = Number(month);
    const yearNumber = Number(year);
    const candidate = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));

    if (
        candidate.getUTCFullYear() !== yearNumber
        || candidate.getUTCMonth() !== monthNumber - 1
        || candidate.getUTCDate() !== dayNumber
    ) {
        return { ok: false, message: 'Tanggal lahir tidak valid. Periksa kembali tanggal, bulan, dan tahun.' };
    }

    return {
        ok: true,
        value: `${year}-${month}-${day}`,
    };
};

const parseDateParts = (value?: string | null) => {
    const isoDate = (valueOrEmpty(value).match(/\d{4}-\d{2}-\d{2}/)?.[0]) || '';
    const [year = '', month = '', day = ''] = isoDate ? isoDate.split('-') : [];

    return { isoDate, day, month, year };
};

const formatPlaceAndDate = (detailApplication?: AktifApplication): string => {
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

const hasDocumentBeenReviewed = (detailApplication: AktifApplication) => (
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

const statusLabel = (status: string) => getLetterStatusLabel(status);

const statusBadgeClass = (status: string) => getLetterStatusTone(status, 'student-detail');

const readInputValue = (id: string) => {
    const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    return element?.value.trim() || '';
};

const readRadioValue = (name: string) => {
    const element = document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement | null;
    return element?.value || '';
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

const valueOrEmpty = (value?: string | null) => value ? String(value) : '';

const downloadIdentifier = (detailApplication: AktifApplication) => {
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
