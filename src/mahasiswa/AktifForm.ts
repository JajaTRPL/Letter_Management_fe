import { renderAdministrasiSurat } from './AdministrasiSurat';
import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import Toastify from 'toastify-js';

import { mapApplicationToFormData, mapProfileToFormData } from './aktif-form/AktifDataMapper';
import { renderStep1Biodata } from './aktif-form/Step1BiodataAktif';
import { renderStep2Keperluan, renderConditionalFields } from './aktif-form/Step2KeperluanAktif';
import { renderStep3Submit } from './aktif-form/Step3SubmitAktif';

export const renderAktifForm = () => {
    let currentStep = 1;
    let hasFetchedInitial = false;
    let formData: any = {};

    const render = () => {
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
                            <h2 class="text-xl font-bold text-gray-800">Formulir Surat</h2>
                            <p class="text-xs text-gray-500">Formulir pengajuan surat keterangan mahasiswa aktif</p>
                        </div>
                    </div>
                </div>

                <!-- Progress Stepper -->
                <div class="bg-white px-8 py-5 rounded-[20px] shadow-sm border border-gray-100">
                    <div class="flex items-center justify-between max-w-3xl mx-auto">
                        ${[1, 2, 3].map(step => `
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    currentStep === step 
                                    ? 'border-2 border-teal-600 text-teal-600 bg-white shadow-sm ring-4 ring-teal-50' 
                                    : currentStep > step 
                                        ? 'bg-teal-600 text-white' 
                                        : 'bg-gray-100 text-gray-400'
                                }">
                                    ${currentStep > step 
                                        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' 
                                        : `<span class="text-sm font-bold">${step}</span>`
                                    }
                                </div>
                                <span class="text-sm font-semibold tracking-tight ${
                                    currentStep === step ? 'text-gray-800' : 'text-gray-400'
                                }">
                                    ${step === 1 ? 'Profil SSO' : step === 2 ? 'Detail Profil & Pengajuan' : 'Tinjau Pengajuan'}
                                </span>
                            </div>
                            ${step < 3 ? `
                                <div class="text-gray-300">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </div>
                            ` : ''}
                        `).join('')}
                    </div>
                </div>

                <!-- Form Card -->
                <div class="bg-white rounded-[32px] shadow-xl shadow-teal-900/5 border border-gray-100 overflow-hidden min-h-[400px]">
                    <div class="p-8 md:p-12">
                        <form id="aktif-form" class="space-y-8">
                            ${renderStepContent()}

                            <!-- Navigation Buttons -->
                            <div class="pt-8 flex justify-between items-center border-t border-gray-50">
                                <button type="button" id="btn-prev" class="px-8 py-2.5 border border-teal-600 text-teal-700 font-bold rounded-xl hover:bg-teal-50 transition-all">
                                    ${currentStep === 1 ? 'Batalkan' : 'Kembali'}
                                </button>
                                <button type="button" id="btn-next" class="px-10 py-2.5 bg-[#005752] text-white font-bold rounded-xl hover:bg-teal-900 transition-all shadow-lg active:scale-95 flex items-center gap-2">
                                    ${currentStep === 3 ? 'Kirim Pengajuan' : 'Lanjutkan'}
                                    ${currentStep < 3 ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' : ''}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        renderDashboardLayout('Surat Keterangan Aktif', content, 'mahasiswa', 'administrasi');
        attachEvents();
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return renderStep1Biodata(formData);
            case 2: return renderStep2Keperluan(formData);
            case 3: return renderStep3Submit(formData);
            default: return '';
        }
    };

    const attachEvents = () => {
        document.getElementById('btn-back-to-docs')?.addEventListener('click', () => {
            renderAdministrasiSurat();
        });

        document.getElementById('btn-prev')?.addEventListener('click', () => {
            if (currentStep === 1) {
                renderAdministrasiSurat();
            } else {
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
                if (currentStep < 3) {
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

        // Handle Parent Job Type Change (Step 2)
        const jobTypeSelect = document.getElementById('parent_job_type_select') as HTMLSelectElement;
        const conditionalContainer = document.getElementById('conditional-fields-container');
        
        if (jobTypeSelect && conditionalContainer) {
            jobTypeSelect.addEventListener('change', (e) => {
                const selectedType = (e.target as HTMLSelectElement).value;
                formData.parent_job_type = selectedType;
                
                // Re-render only the conditional part
                const labelClass = "text-sm font-bold text-gray-700 w-full md:w-52 shrink-0";
                const inputClass = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 outline-none transition-all text-sm font-medium placeholder:text-gray-300 placeholder:font-normal text-gray-600";
                
                conditionalContainer.innerHTML = renderConditionalFields(formData, labelClass, inputClass);
            });
        }

        // Handle Checkbox for Step 3
        const checkbox = document.getElementById('agreement-checkbox') as HTMLInputElement;
        const nextBtn = document.getElementById('btn-next') as HTMLButtonElement;

        if (checkbox && currentStep === 3) {
            const updateBtnState = () => {
                if (checkbox.checked) {
                    nextBtn.disabled = false;
                    nextBtn.classList.remove('bg-slate-400', 'cursor-not-allowed', 'shadow-none');
                    nextBtn.classList.add('bg-[#005752]', 'hover:bg-teal-900', 'shadow-lg');
                } else {
                    nextBtn.disabled = true;
                    nextBtn.classList.add('bg-slate-400', 'cursor-not-allowed', 'shadow-none');
                    nextBtn.classList.remove('bg-[#005752]', 'hover:bg-teal-900', 'shadow-lg');
                }
            };
            
            updateBtnState();
            checkbox.addEventListener('change', updateBtnState);
        }

        if (!hasFetchedInitial) {
            hasFetchedInitial = true;
            fetchInitialData();
        }
    };

    const fetchInitialData = async () => {
        const token = localStorage.getItem('auth_token');
        try {
            // 1. Fetch Profile
            const resProf = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resProf.ok) {
                const data = await resProf.json();
                if (data.profile) {
                    const mapped = mapProfileToFormData(data.profile, data.user || {}, formData);
                    Object.assign(formData, mapped);
                }
            }

            // 2. Fetch Draft
            const resDraft = await fetch('/api/mahasiswa/aktif/step-1', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resDraft.ok) {
                const data = await resDraft.json();
                if (data.application) {
                    const mapped = mapApplicationToFormData(data.application, formData);
                    Object.assign(formData, mapped);
                }
            }
            render();
        } catch (e) {
            console.error("Fetch Initial Data Error:", e);
        }
    };

    const saveCurrentStep = async () => {
        const token = localStorage.getItem('auth_token');
        const formElement = document.getElementById('aktif-form') as HTMLFormElement;
        const data = new FormData(formElement);
        const payload: any = {};
        data.forEach((value, key) => { payload[key] = value; });

        try {
            const res = await fetch('/api/mahasiswa/aktif/step-1', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const result = await res.json();
                const mapped = mapApplicationToFormData(result.application, formData);
                Object.assign(formData, mapped);
                return true;
            } else {
                Toastify({
                    text: "Gagal menyimpan draft.",
                    duration: 3000,
                    style: { background: "#EF4444" }
                }).showToast();
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const submitFinal = async () => {
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch('/api/mahasiswa/aktif/submit', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const assignedName = data.assigned_to || 'staf kemahasiswaan';

                Toastify({
                    text: `Berhasil! Pengajuan telah dikirim dan ditugaskan kepada ${assignedName}.`,
                    duration: 4000,
                    style: { background: "#10B981" }
                }).showToast();
                setTimeout(() => renderAdministrasiSurat(), 2000);
            } else {
                Toastify({
                    text: "Gagal mengirim pengajuan.",
                    duration: 3000,
                    style: { background: "#EF4444" }
                }).showToast();
            }
        } catch (e) {
            console.error(e);
            Toastify({
                text: "Terjadi kesalahan sistem.",
                duration: 3000,
                style: { background: "#EF4444" }
            }).showToast();
        }
    };

    render();
};
