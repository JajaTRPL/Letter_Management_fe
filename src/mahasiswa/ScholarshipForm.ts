// `renderAdministrasiSurat` is loaded lazily inside the back-button handler so
// the Beasiswa form does not statically depend on the AdministrasiSurat page —
// that page↔page edge is part of the inherited import cycle (C1). Identical
// behavior; the dynamic import matches the app's existing navigation convention.
import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderDashboardLoadingState } from '../shared/ui-primitives';
import { showSuccess, showError } from '../shared/toast';
import { apiFetch } from '../shared/api-client';
import { attachProtectedPdfViewer, renderProtectedPdfViewer } from '../shared/protected-pdf-viewer';
import {
    formatDetailDateTime,
    renderDetailHeaderCard,
    renderDetailInfoCard,
} from '../shared/mahasiswa-letter-detail';
import {
    activePageForDetailOrigin,
    backLabelForDetailOrigin,
    goToMahasiswaDetailOrigin,
    type MahasiswaDetailNavigationOptions,
    resolveDetailOrigin,
} from './detail-navigation';

import { mapApplicationToFormData, mapProfileToFormData } from './scholarship-form/ScholarshipDataMapper';
import { parseRupiahToDigits } from '../shared/formatters';
import {
    attachSupportingDocumentUploadSection,
    createSupportingDocumentUploadState,
    renderSupportingDocumentUploadSection,
    validateSupportingDocumentUploads,
    type SupportingDocumentUploadState,
} from '../shared/supporting-document-upload';
import {
    appendBeasiswaSupportingDocuments,
    beasiswaExistingSupportingDocumentValues,
    BEASISWA_SUPPORTING_DOCUMENT_UPLOADS,
} from '../shared/beasiswa-form';

// Phase 2B — keys produced by `new FormData(form)` for scholarship history
// amounts follow `scholarship_histories[<n>][jumlah]`. The displayed value
// is the rupiah-formatted string ("1.250.000"); the backend expects a
// digits-only string ("1250000"). This regex narrows the payload-normalize
// step to those keys only, leaving every other field untouched.
const SCHOLARSHIP_JUMLAH_KEY_PATTERN = /^scholarship_histories\[\d+\]\[jumlah\]$/;
import { renderStep1Biodata } from './scholarship-form/Step1Biodata';
import { renderStep2Keluarga, attachStep2Events } from './scholarship-form/Step2Keluarga';
import { renderStep3Akademik, attachStep3Events } from './scholarship-form/Step3Akademik';
import { renderStep4Submit } from './scholarship-form/Step4Submit';
import {
    LETTER_WORKFLOW_STATUS,
    ACTIVE_READONLY_LETTER_STATUSES,
    EDITABLE_LETTER_STATUSES,
    canCompleteSubmission,
    getLetterStatusLabel,
    getLetterStatusTone,
    isStudentReviewStage,
} from '../shared/letter-workflow';
import {
    canDownloadFinalForMahasiswa,
    canPreviewFinalForMahasiswa,
    resolveMahasiswaRetentionState,
} from '../shared/retention-state';
import { renderLetterApprovalTimeline } from '../shared/letter-approval-timeline';
import { renderFormActionFooter } from '../shared/form-primitives';
import { describeApiError, describeFetchFailure } from '../shared/api-error';
import { displaySupportingDocumentFilename } from '../shared/supporting-document-upload';

const BEASISWA_API_PREFIX = '/api/mahasiswa/surat-permohonan-beasiswa';
const GENERATED_LETTER_PREVIEW_ROOT_ID = 'beasiswa-mahasiswa-generated-letter-preview';
const AUTOSAVE_DEBOUNCE_MS = 800;
let revokeGeneratedLetterPreview: (() => void) | null = null;

type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

// Statuses that should route the student into the readonly detail view when they
// click "Beasiswa" while an in-progress application already exists. Terminal
// statuses (Completed, Rejected) are deliberately excluded: a finalized
// application must not block filing a new one. Riwayat keeps history access.
const READONLY_DETAIL_STATUSES: readonly string[] = [
    ...ACTIVE_READONLY_LETTER_STATUSES,
];

// Statuses that mark an application as "the one currently in flight" for this
// student. Anything outside this set (Completed, Rejected, or unknown) is
// treated as history and ignored by the form opener.
const BLOCKING_STATUSES: readonly string[] = [
    ...EDITABLE_LETTER_STATUSES,
    ...ACTIVE_READONLY_LETTER_STATUSES,
];

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const showErrorToast = (text: string) => {
    showError(text);
};

const showSuccessToast = (text: string) => {
    showSuccess(text);
};

const parseApiError = (res: Response, fallback: string): Promise<string> => describeApiError(res, fallback);

const iconArrowLeft = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';

// Picks the latest still-in-flight application. Terminal rows (Completed,
// Rejected) are filtered out so a finalized prior application cannot be
// mistaken for the "current" one and block a new submission.
const findLatestApplication = (apps: any[]): any | null => {
    if (!Array.isArray(apps) || apps.length === 0) return null;
    const inFlight = apps.filter((a) => BLOCKING_STATUSES.includes(a?.status));
    if (inFlight.length === 0) return null;
    return [...inFlight].sort((a, b) => {
        const aDate = new Date(a.submitted_at || a.updated_at || a.created_at || 0).getTime();
        const bDate = new Date(b.submitted_at || b.updated_at || b.created_at || 0).getTime();
        return bDate - aDate;
    })[0];
};

const fetchExistingApplication = async (): Promise<any | null> => {
    try {
        const res = await apiFetch(`${BEASISWA_API_PREFIX}/applications`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return findLatestApplication(data?.applications || []);
    } catch (e) {
        console.error('Failed to fetch existing beasiswa applications', e);
        return null;
    }
};

export const renderScholarshipForm = async () => {
    renderDashboardLayout('Permohonan Beasiswa', renderDashboardLoadingState(), 'mahasiswa', 'administrasi');
    const existing = await fetchExistingApplication();

    if (existing && READONLY_DETAIL_STATUSES.includes(existing.status)) {
        renderScholarshipDetail(existing.id);
        return;
    }

    // Revision, Draft, or no application at all -> enter the editable form flow.
    renderScholarshipFormEditable();
};

const renderScholarshipFormEditable = () => {
    let currentStep = 1;
    let hasFetchedDraft = false;
    let formData: any = {
        siblings: [],
        scholarship_histories: [],
    };
    let autosaveState: AutosaveState = 'idle';
    let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
    let autosaveInFlight = false;
    let submitInProgress = false;
    // Beasiswa's 3 supporting documents flow through the shared upload module
    // (config-driven render + listeners + PDF/size validation). State is rebuilt
    // from supporting_documents metadata on each render.
    let supportingDocumentUploadState: SupportingDocumentUploadState = createSupportingDocumentUploadState();
    let revokeSupportingDocumentUploadInputs: (() => void) | null = null;

    const isEditable = () => {
        const status = formData.status;
        return !status || status === LETTER_WORKFLOW_STATUS.DRAFT || status === LETTER_WORKFLOW_STATUS.REVISION;
    };

    const setAutosaveState = (state: AutosaveState) => {
        autosaveState = state;
        const badge = document.getElementById('scholarship-save-badge');
        if (!badge) return;
        badge.className = `${SAVE_BADGE_BASE_CLASS} ${badgeToneFor(state, formData.status)}`;
        badge.innerHTML = badgeContentFor(state, formData.status);
    };

    const render = () => {
        const isRevision = formData.status === LETTER_WORKFLOW_STATUS.REVISION;
        // Same page shell as Magang / Surat Tugas: back link + status row,
        // revision banner, stepper, one white form card, shared action footer.
        const content = `
            <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button id="btn-back-to-docs" type="button" class="inline-flex items-center gap-2 text-gray-700 hover:text-primary-teal font-semibold w-fit" aria-label="Kembali ke administrasi surat">
                        ${iconArrowLeft}
                        <span>Kembali</span>
                    </button>
                    <span id="scholarship-save-badge" class="${SAVE_BADGE_BASE_CLASS} ${badgeToneFor(autosaveState, formData.status)}" role="status" aria-live="polite">
                        ${badgeContentFor(autosaveState, formData.status)}
                    </span>
                </div>

                ${isRevision ? renderRevisionBanner(formData.revision_note) : ''}
                ${renderScholarshipStepper(currentStep)}

                <section class="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
                    <form id="scholarship-form" class="p-6 md:p-10" novalidate>
                        ${renderStepContent()}
                        ${renderFormActionFooter({
                            previous: {
                                id: 'btn-prev',
                                label: currentStep === 1 ? 'Batalkan' : 'Kembali',
                            },
                            next: {
                                id: 'btn-next',
                                label: currentStep === 4 ? (isRevision ? 'Perbaiki & Kirim Ulang' : 'Kirim Pengajuan') : 'Lanjutkan',
                                // Step 4 starts disabled until the declaration is ticked.
                                disabled: currentStep === 4,
                            },
                        })}
                    </form>
                </section>
            </div>
        `;

        renderDashboardLayout('Formulir Surat', content, 'mahasiswa', 'administrasi');
        attachEvents();
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return renderStep1Biodata(formData);
            case 2: return renderStep2Keluarga(formData);
            case 3: {
                // Rebuild the upload state from metadata so existing documents
                // render a safe filename label, then hand the shared section
                // markup to the step renderer.
                supportingDocumentUploadState = createSupportingDocumentUploadState(
                    beasiswaExistingSupportingDocumentValues(formData),
                );
                const supportingDocumentsHtml = renderSupportingDocumentUploadSection(
                    BEASISWA_SUPPORTING_DOCUMENT_UPLOADS,
                    supportingDocumentUploadState,
                    { disabled: !isEditable() },
                );
                return renderStep3Akademik(formData, supportingDocumentsHtml);
            }
            case 4: return renderStep4Submit(formData, supportingDocumentReviewRows());
            default: return '';
        }
    };

    const supportingDocumentReviewRows = (): Array<[string, string]> => {
        const existing = beasiswaExistingSupportingDocumentValues(formData);
        return BEASISWA_SUPPORTING_DOCUMENT_UPLOADS.map((definition) => {
            const selected = supportingDocumentUploadState.selectedFiles[definition.key];
            const name = selected?.name
                ?? displaySupportingDocumentFilename(existing[definition.key])
                ?? 'Belum diunggah';
            return [definition.label, name];
        });
    };

    const goBackToAdministrasi = () => {
        cancelPendingAutosave();
        void import('./AdministrasiSurat').then(({ renderAdministrasiSurat }) => renderAdministrasiSurat());
    };

    const attachEvents = () => {
        document.getElementById('btn-back-to-docs')?.addEventListener('click', goBackToAdministrasi);

        document.getElementById('btn-prev')?.addEventListener('click', () => {
            if (currentStep === 1) {
                goBackToAdministrasi();
                return;
            }
            currentStep--;
            render();
        });

        document.getElementById('btn-next')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.currentTarget as HTMLButtonElement;

            // Hard gate at Step 4: the declaration checkbox must be ticked before submit.
            // The backend repeats this check so a console call cannot bypass it.
            if (currentStep === 4 && !isDeclarationAccepted()) {
                showErrorToast('Centang pernyataan kebenaran data sebelum mengirim pengajuan.');
                return;
            }

            const originalText = btn.innerHTML;
            btn.innerHTML = currentStep === 4 ? 'Mengirim...' : 'Menyimpan...';
            btn.disabled = true;
            // While the user explicitly advances or submits, suspend autosave to avoid overlapping writes.
            submitInProgress = currentStep === 4;
            cancelPendingAutosave();

            try {
                if (currentStep < 4) {
                    const stepSaved = await saveCurrentStep();
                    if (stepSaved) {
                        currentStep++;
                        render();
                    }
                } else {
                    await submitFinal();
                }
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
                submitInProgress = false;
            }
        });

        // Step 4: wire the declaration checkbox to the submit button's enabled state.
        if (currentStep === 4) {
            attachDeclarationGate();
        }

        if (!formData.nim && !hasFetchedDraft) {
            hasFetchedDraft = true;
            fetchDraft();
        }

        if (currentStep === 2) {
            attachStep2Events();
        }

        if (currentStep === 3) {
            // Shared upload listeners: PDF + max-size validation, selected/existing
            // filename status, and a returned cleanup. Replaces the previous
            // hand-rolled per-input change handler (which had no validation).
            revokeSupportingDocumentUploadInputs?.();
            revokeSupportingDocumentUploadInputs = attachSupportingDocumentUploadSection(
                BEASISWA_SUPPORTING_DOCUMENT_UPLOADS,
                supportingDocumentUploadState,
                {
                    disabled: !isEditable(),
                    onValidationError: (message) => showErrorToast(message),
                },
            );

            attachStep3Events();
        } else {
            revokeSupportingDocumentUploadInputs?.();
            revokeSupportingDocumentUploadInputs = null;
        }

        attachAutosaveListeners();
    };

    const attachAutosaveListeners = () => {
        // Autosave only applies to editable text/number/date inputs in steps 1 and 3.
        // Step 2 fields are read-only (sync from profile) and step 3 has file uploads we never autosave.
        // Step 4 is review-only.
        if (currentStep !== 1 && currentStep !== 3) return;
        if (!isEditable()) return;

        const formElement = document.getElementById('scholarship-form');
        if (!formElement) return;

        const handler = () => scheduleAutosave();
        formElement.addEventListener('input', handler);
        formElement.addEventListener('change', handler);
    };

    const scheduleAutosave = () => {
        if (submitInProgress || !isEditable()) return;
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            void runAutosave();
        }, AUTOSAVE_DEBOUNCE_MS);
    };

    const cancelPendingAutosave = () => {
        if (autosaveTimer) {
            clearTimeout(autosaveTimer);
            autosaveTimer = null;
        }
    };

    const runAutosave = async () => {
        if (autosaveInFlight) return;
        if (submitInProgress || !isEditable()) return;
        autosaveInFlight = true;
        setAutosaveState('saving');
        try {
            const ok = await saveCurrentStep({ silent: true });
            setAutosaveState(ok ? 'saved' : 'error');
        } finally {
            autosaveInFlight = false;
        }
    };

    const fetchDraft = async () => {
        try {
            const profileRes = await apiFetch('/api/profile');
            if (profileRes.ok) {
                const data = await profileRes.json();
                if (data.profile) {
                    const profileData = mapProfileToFormData(data.profile, data.user || {}, formData, {
                        student: data.student,
                        normalized: data.normalized,
                    });
                    Object.assign(formData, profileData);
                }
            }

            const draftRes = await apiFetch(`${BEASISWA_API_PREFIX}/step-1`);
            if (draftRes.ok) {
                const data = await draftRes.json();
                if (data.application) {
                    const draftData = mapApplicationToFormData(data.application, formData);
                    Object.keys(draftData).forEach(key => {
                        const val = draftData[key];
                        if (val !== null && val !== undefined && val !== '' && val !== 0 && val !== '0') {
                            formData[key] = val;
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Beasiswa form load failed', e);
        } finally {
            render();
        }
    };

    const saveCurrentStep = async (options: { silent?: boolean } = {}): Promise<boolean> => {
        const formElement = document.getElementById('scholarship-form') as HTMLFormElement | null;
        if (!formElement) return false;
        const currentFormData = new FormData(formElement);
        const data: any = {};
        currentFormData.forEach((value, key) => { data[key] = value; });

        // Phase 2B — canonicalize scholarship history amount keys to a
        // digits-only string before serialization. Display reads "1.250.000";
        // backend persists as string per migration evidence and prefers
        // digits-only so PHP `is_numeric()` → `number_format(...)` renders
        // consistently in generated documents.
        Object.keys(data).forEach((key) => {
            if (SCHOLARSHIP_JUMLAH_KEY_PATTERN.test(key)) {
                data[key] = parseRupiahToDigits(data[key]);
            }
        });

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

        const endpoint = `${BEASISWA_API_PREFIX}/step-${currentStep}`;
        let body: any = data;

        if (currentStep === 3) {
            const bodyFormData = new FormData();
            // The shared upload inputs carry the canonical multipart names
            // (transkrip_nilai / slip_gaji_ayah / slip_gaji_ibu). Skip those raw
            // FormData entries here; the selected File objects are appended below
            // from the shared upload state via the adapter.
            const uploadInputNames = BEASISWA_SUPPORTING_DOCUMENT_UPLOADS.map((definition) => definition.inputName);
            Object.keys(data).forEach(key => {
                if (!uploadInputNames.includes(key)) {
                    bodyFormData.append(key, data[key]);
                }
            });

            appendBeasiswaSupportingDocuments(bodyFormData, supportingDocumentUploadState);

            body = bodyFormData;
        } else {
            body = JSON.stringify(data);
        }

        try {
            const res = await apiFetch(endpoint, {
                method: 'POST',
                isFormData: currentStep === 3,
                body,
            });

            if (res.ok) {
                const result = await res.json();
                const newDraftData = mapApplicationToFormData(result.application, formData);
                Object.keys(newDraftData).forEach(key => {
                    const val = newDraftData[key];
                    if (val !== null && val !== undefined && val !== '' && val !== 0 && val !== '0') {
                        formData[key] = val;
                    }
                });
                return true;
            }

            if (!options.silent) {
                const errorMsg = await parseApiError(res, 'Data belum dapat disimpan. Silakan coba lagi.');
                showErrorToast(errorMsg);
            }
            return false;
        } catch (error) {
            console.error(error);
            if (!options.silent) {
                showErrorToast(describeFetchFailure(error));
            }
            return false;
        }
    };

    const isDeclarationAccepted = (): boolean => {
        const checkbox = document.getElementById('agree-terms') as HTMLInputElement | null;
        return Boolean(checkbox?.checked);
    };

    const attachDeclarationGate = () => {
        const checkbox = document.getElementById('agree-terms') as HTMLInputElement | null;
        const submitBtn = document.getElementById('btn-next') as HTMLButtonElement | null;
        if (!checkbox || !submitBtn) return;

        // Mirrors renderFormActionFooter's disabled/enabled button styling.
        const sync = () => {
            const accepted = checkbox.checked;
            submitBtn.disabled = !accepted;
            submitBtn.classList.toggle('bg-gray-300', !accepted);
            submitBtn.classList.toggle('cursor-not-allowed', !accepted);
            submitBtn.classList.toggle('bg-primary-teal', accepted);
            submitBtn.classList.toggle('hover:bg-teal-800', accepted);
        };

        sync();
        checkbox.addEventListener('change', sync);
    };

    const submitFinal = async () => {
        // Defensive recheck — gate already enforced on btn-next, but a programmatic submit
        // (Enter key, console call, restored DOM) must not bypass the declaration.
        if (!isDeclarationAccepted()) {
            showErrorToast('Centang pernyataan kebenaran data sebelum mengirim pengajuan.');
            return;
        }

        const uploadValidation = validateSupportingDocumentUploads(
            BEASISWA_SUPPORTING_DOCUMENT_UPLOADS,
            supportingDocumentUploadState,
        );
        if (!uploadValidation.valid) {
            showErrorToast(uploadValidation.firstError || 'Dokumen pendukung wajib dilengkapi.');
            // The upload fields live on step 3 — take the student there.
            currentStep = 3;
            render();
            return;
        }

        const isRevision = formData.status === LETTER_WORKFLOW_STATUS.REVISION;
        try {
            const res = await apiFetch(`${BEASISWA_API_PREFIX}/submit`, {
                method: 'POST',
                body: JSON.stringify({ declaration_accepted: true }),
            });
            if (res.ok) {
                const data = await res.json();
                const assignedName = data.assigned_to || 'staf beasiswa';

                showSuccessToast(isRevision
                    ? `Berhasil! Revisi pengajuan telah dikirim ulang kepada ${assignedName}.`
                    : `Berhasil! Pengajuan telah dikirim dan ditugaskan kepada ${assignedName}.`);

                setTimeout(() => {
                    void renderScholarshipForm();
                }, 1500);
            } else {
                const errorMsg = await parseApiError(res, 'Pengajuan belum dapat dikirim. Silakan coba lagi.');
                showErrorToast(errorMsg);
            }
        } catch (e) {
            console.error(e);
            showErrorToast(describeFetchFailure(e));
        }
    };

    render();
};

// Same visual design as before (progress bar + numbered circles), wrapped as a
// proper <nav>/<ol> with an aria-label per step so assistive tech announces
// which step is current and which are done, instead of an unlabeled div grid.
const renderScholarshipStepper = (currentStep: number): string => {
    const steps: Array<{ number: number; label: string }> = [
        { number: 1, label: 'Profil SSO' },
        { number: 2, label: 'Data Keluarga' },
        { number: 3, label: 'Data Pengajuan' },
        { number: 4, label: 'Tinjau Pengajuan' },
    ];

    return `
        <nav class="bg-white p-8 rounded-[24px] shadow-sm border border-gray-100" aria-label="Tahap formulir pengajuan beasiswa">
            <ol class="relative flex justify-between list-none">
                <div class="absolute top-5 left-8 right-8 h-0.5 -z-0">
                    <div class="absolute inset-0 bg-gray-100"></div>
                    <div class="absolute inset-y-0 left-0 bg-primary-teal transition-all duration-500" style="width: ${(currentStep - 1) * 33.33}%"></div>
                </div>

                ${steps.map(({ number, label }) => {
                    const isDone = currentStep > number;
                    const isCurrent = currentStep === number;
                    const stepStatus = isDone ? 'selesai' : isCurrent ? 'sedang berlangsung' : 'belum dimulai';
                    return `
                        <li class="relative z-10 flex flex-col items-center gap-3" ${isCurrent ? 'aria-current="step"' : ''} aria-label="Langkah ${number}: ${escapeHtml(label)}, ${stepStatus}">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-all duration-300 ${isCurrent ? 'bg-primary-teal text-white scale-110 ring-4 ring-teal-50' : isDone ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}">
                                ${isDone ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>' : `<span class="font-bold text-sm" aria-hidden="true">${number}</span>`}
                            </div>
                            <span class="text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-primary-teal' : 'text-gray-400'}" aria-hidden="true">
                                ${escapeHtml(label)}
                            </span>
                        </li>
                    `;
                }).join('')}
            </ol>
        </nav>
    `;
};

const SAVE_BADGE_BASE_CLASS = 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border w-fit';

const badgeToneFor = (state: AutosaveState, status?: string): string => {
    if (status === LETTER_WORKFLOW_STATUS.REVISION) {
        return 'bg-red-50 text-red-700 border-red-100';
    }
    switch (state) {
        case 'saving': return 'bg-blue-50 text-blue-700 border-blue-100';
        case 'saved': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        case 'error': return 'bg-red-50 text-red-700 border-red-100';
        default: return 'bg-amber-50 text-amber-700 border-amber-100';
    }
};

const badgeContentFor = (state: AutosaveState, status?: string): string => {
    if (status === LETTER_WORKFLOW_STATUS.REVISION) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>Perlu Revisi`;
    }
    const icon = state === 'saving'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
    const label = state === 'saving'
        ? 'Menyimpan...'
        : state === 'saved'
            ? 'Draft tersimpan'
            : state === 'error'
                ? 'Gagal menyimpan'
                : 'Belum tersimpan';
    return icon + label;
};

// Same banners as the other letter forms (SKA / Magang / Surat Tugas / PLN).
const iconAlert = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

const renderRevisionBanner = (note?: string | null) => `
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
        <div class="text-amber-600 shrink-0">${iconAlert}</div>
        <div>
            <p class="font-bold text-amber-900">Pengajuan membutuhkan revisi</p>
            <p class="text-sm text-amber-800 mt-1 whitespace-pre-line">${escapeHtml(note || 'Silakan periksa kembali data dan dokumen pengajuan sebelum mengirim ulang.')}</p>
        </div>
    </div>
`;

const renderRejectedBanner = (reason?: string | null) => `
    <div class="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-3">
        <div class="text-red-600 shrink-0">${iconAlert}</div>
        <div>
            <p class="font-bold text-red-900">Pengajuan ditolak</p>
            <p class="text-sm text-red-800 mt-1 whitespace-pre-line">${escapeHtml(reason || 'Pengajuan ini telah ditolak.')}</p>
        </div>
    </div>
`;

// Banner shown to students at Ready_For_Student_Review.
const renderMenungguKonfirmasiBanner = (): string => `
    <div class="bg-amber-50 border border-amber-200 rounded-[20px] p-5 shadow-sm flex items-start gap-3">
        <div class="text-amber-600 shrink-0 mt-0.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        </div>
        <div>
            <p class="text-sm font-bold text-amber-900">Menunggu Konfirmasi Anda</p>
            <p class="text-xs text-amber-800 mt-1 leading-relaxed">
                Semua pihak telah menyetujui pengajuan. Selesaikan pengajuan untuk membuka akses unduhan dokumen final.
            </p>
        </div>
    </div>
`;

const renderGeneratedLetterPreviewCard = (): string => renderProtectedPdfViewer(GENERATED_LETTER_PREVIEW_ROOT_ID, {
    title: 'Pratinjau Surat Permohonan Beasiswa',
    subtitle: 'Pratinjau PDF dokumen pengajuan',
    loading: 'Memuat pratinjau surat...',
});

const attachGeneratedLetterPreview = (applicationId: number | string): void => {
    cleanupGeneratedLetterPreview();
    revokeGeneratedLetterPreview = attachProtectedPdfViewer({
        rootId: GENERATED_LETTER_PREVIEW_ROOT_ID,
        endpointUrl: `${BEASISWA_API_PREFIX}/${applicationId}/generated-preview`,
    });
};

const cleanupGeneratedLetterPreview = (): void => {
    if (!revokeGeneratedLetterPreview) return;
    revokeGeneratedLetterPreview();
    revokeGeneratedLetterPreview = null;
};

export const renderScholarshipDetail = async (applicationId: number | string, options?: MahasiswaDetailNavigationOptions) => {
    const origin = resolveDetailOrigin(options);
    const activePage = activePageForDetailOrigin(origin);

    renderDashboardLayout('Permohonan Beasiswa', renderDashboardLoadingState(), 'mahasiswa', activePage);

    let application: any = null;
    try {
        const res = await apiFetch(`${BEASISWA_API_PREFIX}/${applicationId}`, { cache: 'no-store' });
        if (!res.ok) {
            const message = await parseApiError(res, 'Detail pengajuan tidak tersedia');
            showErrorToast(message);
            goToMahasiswaDetailOrigin(origin);
            return;
        }
        const data = await res.json();
        application = data.application;
    } catch (e) {
        console.error('Failed to load Beasiswa detail', e);
        showErrorToast('Gagal memuat detail pengajuan.');
        goToMahasiswaDetailOrigin(origin);
        return;
    }

    if (!application) {
        goToMahasiswaDetailOrigin(origin);
        return;
    }

    let hasPreviewed = isStudentReviewStage(application.status) || Boolean(application.student_reviewed_at);

    const renderDetail = () => {
        const status: string = application.status;
        const statusLabel = getLetterStatusLabel(status, 'student-list');
        const statusBadge = getLetterStatusTone(status, 'student-detail');
        const scholarshipName = application.scholarship_name || 'Permohonan Beasiswa';
        const student = application.student || {};
        const profile = application.mahasiswa_profile || {};

        const isReadyForReview = isStudentReviewStage(status);
        const isRevision = status === LETTER_WORKFLOW_STATUS.REVISION;
        const isRejected = status === LETTER_WORKFLOW_STATUS.REJECTED;
        const showGeneratedPreview = isReadyForReview
            || isRevision
            || isRejected
            || canPreviewFinalForMahasiswa(status, application.retention_summary);

        const content = `
            <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
                ${renderDetailHeaderCard({
                    backId: 'btn-back-to-docs',
                    backLabel: backLabelForDetailOrigin(origin),
                    title: 'Detail Pengajuan',
                    subtitle: scholarshipName,
                    statusLabel,
                    statusBadgeClass: statusBadge,
                })}

                ${isReadyForReview ? renderMenungguKonfirmasiBanner() : ''}
                ${isRevision ? renderRevisionBanner(application.revision_note) : ''}
                ${isRejected ? renderRejectedBanner(application.rejection_reason) : ''}

                ${renderDetailInfoCard('Informasi Surat', [
                    ['Jenis Surat', 'Surat Permohonan Beasiswa'],
                    ['Tujuan', scholarshipName],
                    ['Tanggal pengajuan', formatDetailDateTime(application.submitted_at || application.created_at)],
                    ['Status', statusLabel],
                ])}

                ${renderDetailInfoCard('Pemohon', [
                    ['Nama', student?.name || profile?.nama_lengkap || '-'],
                    ['NIM', student?.nim || profile?.nim || '-'],
                    ['Program Studi', student?.program_studi_display || student?.study_program?.name || '-'],
                    ['Fakultas', student?.fakultas_display || student?.faculty?.name || '-'],
                    // No. Telepon — canonical MahasiswaProfile.no_hp, with legacy no_telp
                    // and scholarship student.phone as defensive fallbacks. Honest "-".
                    ['No. Telepon', profile?.no_hp || profile?.no_telp || student?.phone || profile?.phone || '-'],
                ])}

                ${renderReviewDokumenSection(status)}

                ${renderLetterApprovalTimeline(application)}
            </div>
        `;

        cleanupGeneratedLetterPreview();
        renderDashboardLayout('Permohonan Beasiswa', content, 'mahasiswa', activePage);
        attachDetailEvents();
        if (showGeneratedPreview) {
            attachGeneratedLetterPreview(application.id);
        }
    };

    // Unified "Review Dokumen" section: the action (complete / download /
    // revise) sits in the section header — directly ABOVE the PDF preview —
    // matching the SKA/PLN/Magang top-action placement instead of being buried
    // in a separate card below the preview. Behaviour, button IDs, endpoints,
    // and gates are unchanged; only the placement/visual wrapper moved.
    const renderReviewDokumenSection = (status: string): string => {
        const isReadyForReview = isStudentReviewStage(status);
        const isCompleted = status === LETTER_WORKFLOW_STATUS.COMPLETED;
        const isRevision = status === LETTER_WORKFLOW_STATUS.REVISION;
        const isRejected = status === LETTER_WORKFLOW_STATUS.REJECTED;
        const retention = resolveMahasiswaRetentionState(application.retention_summary);
        const showSection = isReadyForReview || isCompleted || isRevision || isRejected;
        if (!showSection) return '';

        const showComplete = canCompleteSubmission(status, hasPreviewed);
        const showDownload = canDownloadFinalForMahasiswa(status, application.retention_summary);

        const downloadIconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        const actionButtonClass = 'inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-teal text-white font-bold rounded-xl hover:bg-teal-800 transition-colors shadow-sm';

        let heading = 'Pratinjau Dokumen';
        let subtitle = 'Pratinjau PDF dokumen pengajuan.';
        let action = '';
        let extra = '';

        if (showDownload) {
            heading = 'Dokumen Selesai';
            subtitle = 'Pengajuan telah selesai. Dokumen dapat diunduh sebagai PDF.';
            action = `<button type="button" id="btn-download" class="${actionButtonClass}">${downloadIconSvg}<span>Unduh Dokumen Final</span></button>`;
            extra = retention.noticeHtml;
        } else if (isCompleted && retention.noticeHtml) {
            heading = 'Dokumen Selesai';
            subtitle = 'Pengajuan telah selesai.';
            extra = retention.noticeHtml;
        } else if (showComplete) {
            heading = 'Review Dokumen';
            subtitle = 'Periksa pratinjau di bawah sebelum menyelesaikan pengajuan.';
            action = `<button type="button" id="btn-complete" class="${actionButtonClass}"><span>Selesaikan Pengajuan</span></button>`;
            extra = `<div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900"><span class="font-bold">Catatan:</span> Pastikan data pengajuan dan pratinjau dokumen sudah sesuai sebelum menyelesaikan pengajuan. Tindakan ini tidak dapat dibatalkan.</div>`;
        } else if (isRevision) {
            heading = 'Perbaiki Pengajuan';
            subtitle = 'Pengajuan memerlukan revisi. Periksa pratinjau lalu perbaiki pengajuan Anda.';
            action = `<button type="button" id="btn-revise" class="${actionButtonClass}"><span>Perbaiki Pengajuan</span></button>`;
        } else if (isRejected) {
            heading = 'Pratinjau Dokumen';
            subtitle = 'Pengajuan ditolak. Berikut pratinjau dokumen pengajuan.';
        }

        return `
            <section class="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 md:p-7 space-y-5">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">${heading}</h3>
                        <p class="text-sm text-gray-600 mt-1">${subtitle}</p>
                    </div>
                    ${action ? `<div class="flex flex-col gap-3 sm:flex-row sm:items-center">${action}</div>` : ''}
                </div>
                ${extra}
                ${showDownload || showComplete || isRevision || isRejected ? renderGeneratedLetterPreviewCard() : ''}
            </section>
        `;
    };

    const attachDetailEvents = () => {
        document.getElementById('btn-back-to-docs')?.addEventListener('click', () => {
            cleanupGeneratedLetterPreview();
            goToMahasiswaDetailOrigin(origin);
        });

        document.getElementById('btn-revise')?.addEventListener('click', () => {
            cleanupGeneratedLetterPreview();
            void renderScholarshipForm();
        });

        document.getElementById('btn-complete')?.addEventListener('click', () => {
            void handleComplete();
        });

        document.getElementById('btn-download')?.addEventListener('click', () => {
            void handleDownload();
        });
    };

    const fetchFinalDownloadBlob = async (): Promise<Blob> => {
        const res = await apiFetch(`${BEASISWA_API_PREFIX}/${application.id}/final-download`, {
            cache: 'no-store',
            headers: { Accept: 'application/pdf' },
        });
        if (!res.ok) {
            throw new Error(await parseApiError(res, 'Dokumen belum dapat diakses'));
        }
        return res.blob();
    };

    const handleComplete = async () => {
        try {
            const res = await apiFetch(`${BEASISWA_API_PREFIX}/${application.id}/complete`, { method: 'POST' });
            if (!res.ok) {
                const message = await parseApiError(res, 'Pengajuan belum dapat diselesaikan');
                throw new Error(message);
            }
            const data = await res.json();
            if (data.application) {
                application = data.application;
            } else {
                application.status = LETTER_WORKFLOW_STATUS.COMPLETED;
            }
            showSuccessToast('Pengajuan berhasil diselesaikan.');
            renderDetail();
        } catch (e: any) {
            showErrorToast(e?.message || 'Gagal menyelesaikan pengajuan.');
        }
    };

    const handleDownload = async () => {
        if (!canDownloadFinalForMahasiswa(application.status, application.retention_summary)) {
            showErrorToast('Masa unduh surat resmi telah berakhir.');
            return;
        }

        try {
            const blob = await fetchFinalDownloadBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeNim = String(application.student?.nim || application.mahasiswa_profile?.nim || application.id).replace(/[^A-Za-z0-9_-]+/g, '_');
            a.href = url;
            a.download = `Surat_Permohonan_Beasiswa_${safeNim}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (e: any) {
            showErrorToast(e?.message || 'Gagal mengunduh dokumen.');
        }
    };

    renderDetail();
};
