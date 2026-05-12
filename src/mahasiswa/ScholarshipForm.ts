import { renderAdministrasiSurat } from './AdministrasiSurat';
import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import Toastify from 'toastify-js';
import { apiFetch } from '../shared/api-client';

import { mapApplicationToFormData, mapProfileToFormData } from './scholarship-form/ScholarshipDataMapper';
import { renderStep1Biodata } from './scholarship-form/Step1Biodata';
import { renderStep2Keluarga, attachStep2Events } from './scholarship-form/Step2Keluarga';
import { renderStep3Akademik, attachStep3Events } from './scholarship-form/Step3Akademik';
import { renderStep4Submit } from './scholarship-form/Step4Submit';
import { LETTER_WORKFLOW_STATUS } from '../shared/letter-workflow';

const BEASISWA_API_PREFIX = '/api/mahasiswa/surat-permohonan-beasiswa';

export const renderScholarshipForm = () => {
    let currentStep = 1;
    let hasFetchedDraft = false;
    let formData: any = {
        siblings: [],
        scholarship_histories: []
    };

    const render = () => {
        const isRevision = formData.status === LETTER_WORKFLOW_STATUS.REVISION;
        const content = `
            <div class="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
                <!-- Header & Back Button -->
                <div class="flex justify-between items-center bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <button id="btn-back-to-docs" class="p-2.5 hover:bg-gray-50 rounded-xl text-gray-500 transition-colors">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </button>
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Permohonan Beasiswa</h2>
                            <p class="text-xs text-gray-500">Lengkapi formulir pengajuan surat rekomendasi</p>
                        </div>
                    </div>
                    <div class="hidden md:flex items-center gap-2 px-4 py-2 ${isRevision ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'} rounded-xl text-xs font-bold border">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${isRevision ? 'Perlu Revisi' : 'Draft Autosaved'}
                    </div>
                </div>

                <!-- Progress Stepper -->
                <div class="bg-white p-8 rounded-[24px] shadow-sm border border-gray-100">
                    <div class="relative flex justify-between">
                        <!-- Progress Line Background -->
                        <div class="absolute top-5 left-0 right-0 h-0.5 bg-gray-100 -z-0 mx-8"></div>
                        <!-- Active Progress Line -->
                        <div class="absolute top-5 left-0 h-0.5 bg-primary-teal transition-all duration-500 -z-0 mx-8" style="width: ${(currentStep - 1) * 33.33}%"></div>

                        ${[1, 2, 3, 4].map(step => `
                            <div class="relative z-10 flex flex-col items-center gap-3">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-all duration-300 ${currentStep === step ? 'bg-primary-teal text-white scale-110 ring-4 ring-teal-50' :
                currentStep > step ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
            }">
                                    ${currentStep > step ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : `<span class="font-bold text-sm">${step}</span>`}
                                </div>
                                <span class="text-[10px] font-bold uppercase tracking-wider ${currentStep === step ? 'text-primary-teal' : 'text-gray-400'}">
                                    ${step === 1 ? 'Biodata' : step === 2 ? 'Keluarga' : step === 3 ? 'Akademik' : 'Submit'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${isRevision ? renderRevisionBanner(formData.revision_note) : ''}

                <!-- Form Card -->
                <div class="bg-white rounded-[32px] shadow-xl shadow-teal-900/5 border border-gray-100 overflow-hidden min-h-[400px]">
                    <div class="p-8 md:p-12">
                        <form id="scholarship-form" class="space-y-8">
                            ${renderStepContent()}

                            <!-- Navigation Buttons -->
                            <div class="pt-8 flex justify-between items-center border-t border-gray-50">
                                <button type="button" id="btn-prev" class="px-8 py-3.5 text-gray-500 font-bold hover:text-gray-800 transition-colors ${currentStep === 1 ? 'invisible' : ''}">
                                    Sebelumnya
                                </button>
                                <button type="button" id="btn-next" class="px-10 py-3.5 bg-primary-teal text-white font-bold rounded-2xl hover:bg-teal-800 transition-all shadow-lg active:scale-95 flex items-center gap-2">
                                    ${currentStep === 4 ? (isRevision ? 'Perbaiki & Kirim Ulang' : 'Kirim Pengajuan') : 'Lanjutkan'}
                                    ${currentStep < 4 ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' : ''}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        renderDashboardLayout('Permohonan Beasiswa', content, 'mahasiswa', 'administrasi');
        attachEvents();
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return renderStep1Biodata(formData);
            case 2: return renderStep2Keluarga(formData);
            case 3: return renderStep3Akademik(formData);
            case 4: return renderStep4Submit(formData);
            default: return '';
        }
    };

    const attachEvents = () => {
        document.getElementById('btn-back-to-docs')?.addEventListener('click', () => {
            renderAdministrasiSurat();
        });

        document.getElementById('btn-prev')?.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                render();
            }
        });

        document.getElementById('btn-next')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.currentTarget as HTMLButtonElement;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="animate-spin mr-2">⏳</span> Menyimpan...';
            btn.disabled = true;

            try {
                if (currentStep < 4) {
                    const stepSaved = await saveCurrentStep();
                    if (stepSaved) {
                        currentStep++;
                        render();
                    }
                } else {
                    submitFinal();
                }
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

        // Auto-fill initial data if not already filled (only once)
        if (!formData.nim && !hasFetchedDraft) {
            hasFetchedDraft = true;
            fetchDraft();
        }

        if (currentStep === 2) {
            attachStep2Events();
        }

        if (currentStep === 3) {
            // File upload previews for Step 3
            ['transkrip-nilai-upload', 'slip-gaji-ayah-upload', 'slip-gaji-ibu-upload'].forEach(id => {
                const input = document.getElementById(id) as HTMLInputElement;
                input?.addEventListener('change', () => {
                    if (input.files && input.files[0]) {
                        const label = input.parentElement?.previousElementSibling as HTMLLabelElement;
                        if (label) {
                            label.innerHTML = `${label.innerText.split(' (')[0]} <span class="text-teal-600">(Terpilih: ${input.files[0].name.substring(0, 15)}...)</span>`;
                        }
                    }
                });
            });

            attachStep3Events();
        }
    };

    const fetchDraft = async () => {
        console.log("Fetching initial data...");

        try {
            // 1. Ambil data profil SSO (Utama)
            const resOpt = await apiFetch('/api/profile');
            if (resOpt.ok) {
                const data = await resOpt.json();
                console.log("SSO Profile received:", data.profile);
                if (data.profile) {
                    const profileData = mapProfileToFormData(data.profile, data.user || {}, formData);
                    Object.assign(formData, profileData);
                    console.log("Mapped SSO data to formData:", formData);
                }
            }

            // 2. Ambil data draf beasiswa
            const res = await apiFetch(`${BEASISWA_API_PREFIX}/step-1`);
            if (res.ok) {
                const data = await res.json();
                console.log("Scholarship Draft received:", data.application);
                if (data.application) {
                    const draftData = mapApplicationToFormData(data.application, formData);
                    Object.keys(draftData).forEach(key => {
                        const val = draftData[key];
                        // Hanya timpa jika draf memiliki nilai nyata
                        if (val !== null && val !== undefined && val !== '' && val !== 0 && val !== '0') {
                            formData[key] = val;
                        }
                    });
                    console.log("Final Merged formData:", formData);
                }
            }
        } catch (e) {
            console.error("Fetch Error Details:", e);
        } finally {
            render();
            console.log("Step rendered with current formData");
        }
    };

    const saveCurrentStep = async () => {
        const formElement = document.getElementById('scholarship-form') as HTMLFormElement;
        const currentFormData = new FormData(formElement);
        const data: any = {};
        currentFormData.forEach((value, key) => { data[key] = value; });

        // Preproses untuk Step 2 (Send existing formData because fields are now read-only in UI)
        if (currentStep === 2) {
            data.pob = formData.pob;
            data.dob = formData.dob;
            data.gender = formData.gender;
            data.origin_address = formData.origin_address;
            data.jogja_address = formData.jogja_address;
            data.phone = formData.phone;
            data.father_name = formData.father_name;
            data.father_job = formData.father_job;
            data.father_income = formData.father_income;
            data.father_status = formData.father_status;
            data.father_death_date = formData.father_death_date;
            data.mother_name = formData.mother_name;
            data.mother_job = formData.mother_job;
            data.mother_income = formData.mother_income;
            data.mother_status = formData.mother_status;
            data.mother_death_date = formData.mother_death_date;
            data.guardian_name = formData.guardian_name;
            data.guardian_job = formData.guardian_job;
            data.guardian_income = formData.guardian_income;
            data.guardian_status = formData.guardian_status;
            data.guardian_death_date = formData.guardian_death_date;
            data.siblings = formData.siblings || [];

            delete data['pas_foto'];
        }

        let endpoint = `${BEASISWA_API_PREFIX}/step-${currentStep}`;
        let body: any = data;

        // Custom handling for Step 3 (File Upload)
        if (currentStep === 3) {
            const bodyFormData = new FormData();
            Object.keys(data).forEach(key => {
                // Jangan append file dummy ke JSON key
                if (!['transkrip-nilai', 'slip-ayah', 'slip-ibu'].includes(key)) {
                    bodyFormData.append(key, data[key]);
                }
            });

            const transkripFile = (document.getElementById('transkrip-nilai-upload') as HTMLInputElement)?.files?.[0];
            const slipAyahFile = (document.getElementById('slip-gaji-ayah-upload') as HTMLInputElement)?.files?.[0];
            const slipIbuFile = (document.getElementById('slip-gaji-ibu-upload') as HTMLInputElement)?.files?.[0];

            if (transkripFile) bodyFormData.append('transkrip_nilai', transkripFile);
            if (slipAyahFile) bodyFormData.append('slip_gaji_ayah', slipAyahFile);
            if (slipIbuFile) bodyFormData.append('slip_gaji_ibu', slipIbuFile);

            body = bodyFormData;
        } else {
            body = JSON.stringify(data);
        }

        try {
            const res = await apiFetch(endpoint, {
                method: 'POST',
                isFormData: currentStep === 3,
                body: body
            });

            if (res.ok) {
                const result = await res.json();
                const newDraftData = mapApplicationToFormData(result.application, formData);
                Object.keys(newDraftData).forEach(key => {
                    const val = newDraftData[key];
                    // Only overwrite with meaningful values.
                    if (val !== null && val !== undefined && val !== '' && val !== 0 && val !== '0') {
                        formData[key] = val;
                    }
                });
                return true;
            } else {
                let errorMsg = "Pastikan semua kolom terisi dengan benar.";
                const contentType = res.headers.get("content-type");

                if (contentType && contentType.includes("application/json")) {
                    try {
                        const err = await res.json();
                        if (err.errors) {
                            const firstKey = Object.keys(err.errors)[0];
                            errorMsg = err.errors[firstKey][0];
                        } else if (err.message) {
                            errorMsg = err.message;
                        }
                    } catch (e) {
                        console.error("Error parsing JSON failure", e);
                    }
                } else {
                    errorMsg = `Server Error (${res.status}): ${res.statusText}`;
                }

                // @ts-ignore
                Toastify({
                    text: "Gagal menyimpan: " + errorMsg,
                    duration: 5000,
                    style: { background: "#EF4444" }
                }).showToast();
                return false;
            }
        } catch (error) {
            console.error(error);
            // @ts-ignore
            Toastify({
                text: "Koneksi terputus atau server mati",
                duration: 3000,
                style: { background: "#EF4444" }
            }).showToast();
            return false;
        }
    };

    const submitFinal = async () => {
        const isRevision = formData.status === LETTER_WORKFLOW_STATUS.REVISION;
        try {
            const res = await apiFetch(`${BEASISWA_API_PREFIX}/submit`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                const assignedName = data.assigned_to || 'staf beasiswa';

                // @ts-ignore
                Toastify({
                    text: isRevision
                        ? `Berhasil! Revisi pengajuan telah dikirim ulang kepada ${assignedName}.`
                        : `Berhasil! Pengajuan telah dikirim dan ditugaskan kepada ${assignedName}.`,
                    duration: 4000,
                    style: { background: "#10B981" }
                }).showToast();
                setTimeout(() => renderAdministrasiSurat(), 2000);
            } else {
                // @ts-ignore
                Toastify({
                    text: "Gagal mengirim pengajuan.",
                    duration: 3000,
                    style: { background: "#EF4444" }
                }).showToast();
            }
        } catch (e) {
            console.error(e);
            // @ts-ignore
            Toastify({
                text: "Terjadi kesalahan sistem.",
                duration: 3000,
                style: { background: "#EF4444" }
            }).showToast();
        }
    };

    render();
};

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const renderRevisionBanner = (note?: string | null) => `
    <div class="bg-amber-50 border border-amber-200 rounded-[24px] p-6 shadow-sm">
        <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
            </div>
            <div>
                <h3 class="text-sm font-black text-amber-900 uppercase tracking-wide">Catatan Revisi</h3>
                <p class="mt-2 text-sm text-amber-900 leading-relaxed whitespace-pre-line">
                    ${escapeHtml(note || 'Pengajuan Anda memerlukan perbaikan. Silakan periksa kembali data dan dokumen sebelum mengirim ulang.')}
                </p>
            </div>
        </div>
    </div>
`;
