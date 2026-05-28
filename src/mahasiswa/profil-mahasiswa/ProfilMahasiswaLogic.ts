import { apiFetch, loadProtectedImageObjectUrl, revokeProtectedImageObjectUrl } from '../../shared/api-client';
import { showSuccess, showError, showWarning } from '../../shared/toast';

// Object URLs held for the currently-rendered Pas Foto / TTD previews, so
// we can revoke them before swapping in a new one on re-render.
let pasFotoObjectUrl: string | null = null;
let tandaTanganObjectUrl: string | null = null;
let headerAvatarObjectUrl: string | null = null;

import type { SectionController } from './logic/SectionController';
import { SectionDetailController } from './logic/SectionDetailController';
import { createKeluargaController } from './logic/SectionKeluargaController';
import { SectionSaudaraController } from './logic/SectionSaudaraController';
import { SectionBeasiswaController } from './logic/SectionBeasiswaController';

let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
let hasUnsavedChanges = false;

export const initProfilMahasiswaLogic = () => {
    const form = document.getElementById('form-update-profil');
    if (!form || form.hasAttribute('data-initialized')) return;
    form.setAttribute('data-initialized', 'true');

    hasUnsavedChanges = false;
    if (beforeUnloadHandler) {
        window.removeEventListener('beforeunload', beforeUnloadHandler);
    }
    beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    const btnTambahSaudara = document.getElementById('btn-tambah-saudara');
    const beasiswaTbody = document.getElementById('beasiswa-tbody');
    const btnTambahBeasiswa = document.getElementById('btn-tambah-beasiswa');

    const sections: Record<string, SectionController> = {
        'detail': SectionDetailController,
        'ayah': createKeluargaController('ayah'),
        'ibu': createKeluargaController('ibu'),
        'wali': createKeluargaController('wali'),
        'saudara': SectionSaudaraController,
        'beasiswa': SectionBeasiswaController
    };

    let formSnapshot: Record<string, any> = {};
    let isSaving = false;
    let initialUpdatedAt: string | null = null;
    let activeSectionId: string | null = null;
    let openSectionId: string | null = 'detail';

    type SectionStatusType = 'success' | 'error';
    type SectionView = {
        container: HTMLElement;
        header: HTMLButtonElement | null;
        status: HTMLElement | null;
        editBtn: HTMLButtonElement | null;
        batalBtn: HTMLButtonElement | null;
        simpanBtn: HTMLButtonElement | null;
    };

    const sectionViews = new Map<string, SectionView>();
    const sectionStatusTimers = new Map<string, number>();
    let saudaraDeleteButtons: HTMLButtonElement[] = [];
    let beasiswaDeleteButtons: HTMLButtonElement[] = [];
    const incomeInputIds = ['ayah_penghasilan', 'ibu_penghasilan', 'wali_penghasilan'];

    const onlyDigits = (value: string) => value.replace(/\D/g, '');

    const isValidIndonesianPhone = (value: string) => {
        const digits = onlyDigits(value);
        if (digits.startsWith('0')) return digits.length >= 9 && digits.length <= 13;
        if (digits.startsWith('62')) return digits.length >= 10 && digits.length <= 14;
        return false;
    };

    const getPhoneValidationMessage = (value: string) => {
        if (!value) return 'No. Telp / WhatsApp wajib diisi.';
        return 'No. Telp / WhatsApp harus diawali 0 atau 62 dengan panjang nomor yang sesuai.';
    };

    const clearFieldValidationError = (target: HTMLElement) => {
        target.classList.remove('profile-input-error');
        target.removeAttribute('aria-invalid');

        const fieldWrapper = target.closest('.space-y-2, td, label');
        if (fieldWrapper) {
            fieldWrapper.querySelectorAll('.profile-field-error').forEach(error => error.remove());
            return;
        }

        const nextElement = target.nextElementSibling;
        if (nextElement?.classList.contains('profile-field-error')) nextElement.remove();
    };

    const formatIndonesianThousands = (value: string) => {
        const digits = onlyDigits(value);
        if (!digits) return '';
        return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const formatProfileNumericFields = () => {
        const phoneInput = document.getElementById('no_hp') as HTMLInputElement | null;
        if (phoneInput) phoneInput.value = onlyDigits(phoneInput.value);

        incomeInputIds.forEach(id => {
            const input = document.getElementById(id) as HTMLInputElement | null;
            if (input) input.value = formatIndonesianThousands(input.value);
        });
    };

    const handleProfileNumericInput = (e: Event) => {
        const input = e.target as HTMLInputElement | null;
        if (!input) return;

        if (input.id === 'no_hp') {
            const nextValue = onlyDigits(input.value);
            if (input.value !== nextValue) input.value = nextValue;
            clearFieldValidationError(input);
            const sectionId = input.closest('.profile-section')?.getAttribute('data-section');
            if (sectionId) clearSectionStatus(sectionId);
            return;
        }

        if (incomeInputIds.includes(input.id)) {
            const nextValue = formatIndonesianThousands(input.value);
            if (input.value !== nextValue) input.value = nextValue;
        }
    };

    const captureFullSnapshot = () => {
        const snap: Record<string, any> = {};
        Object.keys(sections).forEach(key => {
            snap[key] = sections[key].captureSnapshot();
        });
        return snap;
    };
    const checkDirtyState = () => {
        if (!formSnapshot || !activeSectionId || !sections[activeSectionId]) return;
        const currentSnap = JSON.stringify(sections[activeSectionId].captureSnapshot());
        const originalSnap = JSON.stringify(formSnapshot[activeSectionId]);
        hasUnsavedChanges = currentSnap !== originalSnap;
    };

    document.getElementById('btn-back-dashboard')?.addEventListener('click', () => {
        import('../../dashboard/MahasiswaDashboard').then(({ renderMahasiswaDashboard }) => {
            renderMahasiswaDashboard();
        });
    });

    const hapusSaudara = (e: Event) => {
        const btn = e.currentTarget as HTMLElement;
        const tr = btn.closest('tr');
        if (tr) {
            tr.remove();
            checkDirtyState();
        }
    };

    const bindHapusButtons = () => {
        saudaraDeleteButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.btn-hapus-saudara'));
        saudaraDeleteButtons.forEach(btn => {
            btn.removeEventListener('click', hapusSaudara);
            btn.addEventListener('click', hapusSaudara);
        });
        syncDynamicRowControls();
    };

    const updateBeasiswaCounter = () => {
        const counter = document.getElementById('beasiswa-counter');
        const count = beasiswaTbody?.children.length || 0;
        if (counter) counter.textContent = `${count} / 5`;
        if (btnTambahBeasiswa) {
            if (count >= 5) {
                btnTambahBeasiswa.classList.add('opacity-40', 'pointer-events-none');
            } else {
                btnTambahBeasiswa.classList.remove('opacity-40', 'pointer-events-none');
            }
        }
    };

    const hapusBeasiswa = (e: Event) => {
        const btn = e.currentTarget as HTMLElement;
        const tr = btn.closest('tr');
        if (tr) {
            tr.remove();
            updateBeasiswaCounter();
            checkDirtyState();
        }
    };

    const bindHapusBeasiswaButtons = () => {
        beasiswaDeleteButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.btn-hapus-beasiswa'));
        beasiswaDeleteButtons.forEach(btn => {
            btn.removeEventListener('click', hapusBeasiswa);
            btn.addEventListener('click', hapusBeasiswa);
        });
        syncDynamicRowControls();
    };

    document.addEventListener('saudara-restored', bindHapusButtons);
    document.addEventListener('beasiswa-restored', bindHapusBeasiswaButtons);

    form.addEventListener('input', handleProfileNumericInput, true);
    form.addEventListener('input', checkDirtyState);
    form.addEventListener('change', checkDirtyState);

    // Lifecycle Safety: Automatically clean up global listeners when component unmounts
    const observer = new MutationObserver(() => {
        if (!document.body.contains(form)) {
            if (beforeUnloadHandler) {
                window.removeEventListener('beforeunload', beforeUnloadHandler);
                beforeUnloadHandler = null;
            }
            document.removeEventListener('saudara-restored', bindHapusButtons);
            document.removeEventListener('beasiswa-restored', bindHapusBeasiswaButtons);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const addBeasiswaRow = (nama = '', periode = '', jumlah = '', status = 'Selesai') => {
        if (!beasiswaTbody) return;
        if (beasiswaTbody.children.length >= 5) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-800"><input type="text" value="${nama}" placeholder="Nama beasiswa" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
            <td class="px-6 py-4"><input type="text" value="${periode}" placeholder="cth: 2024/2025" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
            <td class="px-6 py-4"><input type="text" value="${jumlah}" placeholder="cth: 5000000" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
            <td class="px-6 py-4">
                <select class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold">
                    <option ${status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                    <option ${status === 'Aktif' ? 'selected' : ''}>Aktif</option>
                </select>
            </td>
            <td class="px-6 py-4 text-center">
                <button type="button" class="btn-hapus-beasiswa text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </td>
        `;
        beasiswaTbody.appendChild(tr);
        bindHapusBeasiswaButtons();
        updateBeasiswaCounter();
        checkDirtyState();
    };

    const setInputsState = (container: Element | Document, isEditing: boolean) => {
        const selector = container === form ? '.profile-section input, .profile-section select, .profile-section textarea' : 'input, select, textarea';
        const inputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
        
        inputs.forEach(input => {
            input.classList.remove('pointer-events-none');
            
            if (!isEditing) {
                input.classList.add('bg-gray-50', 'text-gray-500');
                input.classList.remove('bg-white');
                if (input.tagName === 'SELECT' || input.type === 'radio' || input.type === 'checkbox' || input.type === 'file') {
                    (input as HTMLInputElement).disabled = true;
                } else {
                    input.setAttribute('readonly', 'true');
                }
            } else {
                input.classList.remove('bg-gray-50', 'text-gray-500');
                input.classList.add('bg-white');
                if (input.tagName === 'SELECT' || input.type === 'radio' || input.type === 'checkbox' || input.type === 'file') {
                    (input as HTMLInputElement).disabled = false;
                } else {
                    input.removeAttribute('readonly');
                }
            }
        });

        const fileSelector = container === form ? '.profile-section input[type="file"]' : 'input[type="file"]';
        const fileInputs = container.querySelectorAll<HTMLInputElement>(fileSelector);
        fileInputs.forEach(fileInput => {
            const label = fileInput.closest('label');
            if (label) {
                if (isEditing) {
                    label.classList.remove('opacity-60', 'pointer-events-none');
                } else {
                    label.classList.add('opacity-60', 'pointer-events-none');
                }
            }
        });
    };

    const cacheSectionViews = () => {
        sectionViews.clear();
        form.querySelectorAll<HTMLElement>('.profile-section[data-section]').forEach(container => {
            const sectionId = container.getAttribute('data-section');
            if (!sectionId || !sections[sectionId]) return;

            sectionViews.set(sectionId, {
                container,
                header: container.querySelector<HTMLButtonElement>('.profile-section-header'),
                status: container.querySelector<HTMLElement>('.section-status'),
                editBtn: container.querySelector<HTMLButtonElement>('.btn-edit-section'),
                batalBtn: container.querySelector<HTMLButtonElement>('.btn-batal-section'),
                simpanBtn: container.querySelector<HTMLButtonElement>('.btn-simpan-section'),
            });
        });
    };

    const setSectionOpen = (sectionId: string, isOpen: boolean) => {
        const view = sectionViews.get(sectionId);
        if (!view) return;

        view.container.classList.toggle('is-open', isOpen);
        view.header?.setAttribute('aria-expanded', String(isOpen));
    };

    const openSection = (sectionId: string, options: { force?: boolean } = {}) => {
        if (!sectionViews.has(sectionId)) return;
        if (!options.force && activeSectionId && activeSectionId !== sectionId) {
            showError('Harap simpan atau batalkan perubahan pada bagian saat ini terlebih dahulu.');
            return;
        }

        if (openSectionId && openSectionId !== sectionId) {
            setSectionOpen(openSectionId, false);
        }

        setSectionOpen(sectionId, true);
        openSectionId = sectionId;
    };

    const toggleSection = (sectionId: string) => {
        if (isSaving) return;

        if (activeSectionId && activeSectionId !== sectionId) {
            showError('Harap simpan atau batalkan perubahan pada bagian saat ini terlebih dahulu.');
            return;
        }

        if (activeSectionId === sectionId) {
            openSection(sectionId, { force: true });
            showWarning('Selesaikan atau batalkan edit sebelum menutup bagian ini.');
            return;
        }

        if (openSectionId === sectionId) {
            setSectionOpen(sectionId, false);
            openSectionId = null;
            return;
        }

        openSection(sectionId);
    };

    const isSectionVisible = (sectionId: string) => {
        const container = sectionViews.get(sectionId)?.container;
        if (!container || !document.body.contains(container)) return false;
        if (container.hidden || container.classList.contains('hidden')) return false;
        if (container.style.display === 'none') return false;
        return true;
    };

    const getFirstVisibleSectionId = () => {
        if (isSectionVisible('detail')) return 'detail';
        for (const sectionId of sectionViews.keys()) {
            if (isSectionVisible(sectionId)) return sectionId;
        }
        return null;
    };

    const syncAccordionAfterLoad = (sectionId?: string | null) => {
        const fallbackSectionId = getFirstVisibleSectionId();
        const targetSectionId = sectionId && isSectionVisible(sectionId) ? sectionId : fallbackSectionId;
        if (targetSectionId) openSection(targetSectionId, { force: true });
    };

    const clearSectionStatus = (sectionId: string) => {
        const timer = sectionStatusTimers.get(sectionId);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            sectionStatusTimers.delete(sectionId);
        }

        const status = sectionViews.get(sectionId)?.status;
        if (!status) return;
        status.textContent = '';
        status.removeAttribute('data-status');
        status.classList.add('hidden');
    };

    const setSectionStatus = (sectionId: string, type: SectionStatusType, message: string) => {
        const status = sectionViews.get(sectionId)?.status;
        if (!status) return;

        clearSectionStatus(sectionId);
        status.textContent = message;
        status.setAttribute('data-status', type);
        status.classList.remove('hidden');

        if (type === 'success') {
            const timer = window.setTimeout(() => clearSectionStatus(sectionId), 3000);
            sectionStatusTimers.set(sectionId, timer);
        }
    };

    const clearSectionValidationErrors = (container: HTMLElement) => {
        container.querySelectorAll('.profile-field-error').forEach(error => error.remove());
        container.querySelectorAll('.profile-input-error').forEach(input => {
            input.classList.remove('profile-input-error');
            input.removeAttribute('aria-invalid');
        });
    };

    const getRowFieldTarget = (
        row: HTMLElement,
        field: string,
        textInputIndexByField: Record<string, number>,
        selectorByField: Record<string, string>
    ) => {
        try {
            const namedField = row.querySelector<HTMLElement>(`[name="${field}"]`);
            if (namedField) return namedField;
        } catch (e) {
            // Ignore invalid selector field names and fall back to positional lookup.
        }

        const selector = selectorByField[field];
        if (selector) {
            const selectedField = row.querySelector<HTMLElement>(selector);
            if (selectedField) return selectedField;
        }

        const textInputIndex = textInputIndexByField[field];
        if (textInputIndex !== undefined) {
            return Array.from(row.querySelectorAll<HTMLInputElement>('input[type="text"]'))[textInputIndex] || null;
        }

        return null;
    };

    const resolveIndexedValidationTarget = (container: HTMLElement, key: string) => {
        const match = key.match(/^(keluarga|scholarship_histories)\.(\d+)\.([^.]+)$/);
        if (!match) return null;

        const [, collection, indexRaw, field] = match;
        const index = Number(indexRaw);

        if (collection === 'scholarship_histories') {
            const tbody = document.getElementById('beasiswa-tbody');
            const row = tbody?.children.item(index) as HTMLElement | null;
            if (!row || !container.contains(row)) return null;

            return getRowFieldTarget(
                row,
                field,
                { nama_beasiswa: 0, periode: 1, jumlah: 2 },
                { status: 'select' }
            );
        }

        const sectionName = container.getAttribute('data-section');
        if (sectionName === 'saudara') {
            const tbody = document.getElementById('saudara-tbody');
            const row = tbody?.children.item(index) as HTMLElement | null;
            if (!row || !container.contains(row)) return null;

            return getRowFieldTarget(
                row,
                field,
                { nama_lengkap: 0, pekerjaan: 1 },
                { status_kawin: 'select', keterangan: 'input[type="radio"]:checked, input[type="radio"]' }
            );
        }

        const relationByIndex = ['ayah', 'ibu', 'wali'];
        const relation = relationByIndex[index];
        if (!relation) return null;

        const localFieldByApiField: Record<string, string> = {
            nama_lengkap: 'nama',
            pekerjaan: 'pekerjaan',
            penghasilan: 'penghasilan',
            status_hidup: 'status',
            tanggal_meninggal: 'tgl_meninggal',
        };
        const localField = localFieldByApiField[field];
        const element = localField ? document.getElementById(`${relation}_${localField}`) : null;
        return element && container.contains(element) ? element as HTMLElement : null;
    };

    const resolveValidationTarget = (container: HTMLElement, key: string) => {
        const candidates = [key];
        if (key === 'pas_foto') candidates.push('input-foto');
        if (key === 'tanda_tangan') candidates.push('input-ttd');

        for (const candidate of candidates) {
            const element = document.getElementById(candidate);
            if (element && container.contains(element)) return element as HTMLElement;
        }

        const indexedTarget = resolveIndexedValidationTarget(container, key);
        if (indexedTarget) return indexedTarget;

        return null;
    };

    const applyValidationErrors = (container: HTMLElement, errors: Record<string, string[] | string>) => {
        let appliedCount = 0;

        Object.entries(errors).forEach(([key, value]) => {
            const target = resolveValidationTarget(container, key);
            if (!target) return;

            const message = Array.isArray(value) ? value[0] : value;
            target.classList.add('profile-input-error');
            target.setAttribute('aria-invalid', 'true');

            const errorEl = document.createElement('p');
            errorEl.className = 'profile-field-error';
            errorEl.textContent = message;

            const fieldWrapper = target.closest('.space-y-2, td, label');
            if (fieldWrapper) {
                fieldWrapper.appendChild(errorEl);
            } else {
                target.insertAdjacentElement('afterend', errorEl);
            }

            appliedCount += 1;
        });

        return appliedCount;
    };

    const validatePhoneBeforeSave = () => {
        const phoneInput = document.getElementById('no_hp') as HTMLInputElement | null;
        if (!phoneInput || phoneInput.disabled || phoneInput.readOnly) return true;

        const phoneContainer = phoneInput.closest('.profile-section') as HTMLElement | null;
        const phoneSectionId = phoneContainer?.getAttribute('data-section') || 'detail';
        const phoneValue = onlyDigits(phoneInput.value);

        if (phoneInput.value !== phoneValue) phoneInput.value = phoneValue;
        clearFieldValidationError(phoneInput);

        if (isValidIndonesianPhone(phoneValue)) return true;

        const message = getPhoneValidationMessage(phoneValue);
        if (phoneContainer) {
            applyValidationErrors(phoneContainer, { no_hp: message });
            openSection(phoneSectionId, { force: true });
            setSectionStatus(phoneSectionId, 'error', 'Periksa kembali No. Telp / WhatsApp.');
        }
        phoneInput.focus();
        showError('No. Telp / WhatsApp tidak valid');
        return false;
    };

    const syncDynamicRowControls = () => {
        const canEditSaudara = activeSectionId === 'saudara' && !isSaving;
        const canEditBeasiswa = activeSectionId === 'beasiswa' && !isSaving;

        if (btnTambahSaudara) btnTambahSaudara.classList.toggle('hidden', !canEditSaudara);
        if (btnTambahBeasiswa) btnTambahBeasiswa.classList.toggle('hidden', !canEditBeasiswa);

        saudaraDeleteButtons.forEach(btn => {
            btn.classList.toggle('hidden', !canEditSaudara);
            btn.disabled = isSaving;
        });
        beasiswaDeleteButtons.forEach(btn => {
            btn.classList.toggle('hidden', !canEditBeasiswa);
            btn.disabled = isSaving;
        });
    };

    const syncActionButtons = () => {
        const hasActiveSection = activeSectionId !== null;

        sectionViews.forEach((view, sectionId) => {
            const isActiveSection = activeSectionId === sectionId;

            if (view.header) view.header.disabled = isSaving;
            if (view.editBtn) {
                view.editBtn.classList.toggle('hidden', isActiveSection);
                view.editBtn.classList.toggle('opacity-50', hasActiveSection && !isActiveSection);
                view.editBtn.classList.toggle('pointer-events-none', hasActiveSection && !isActiveSection);
                view.editBtn.disabled = isSaving || (hasActiveSection && !isActiveSection);
            }
            if (view.batalBtn) {
                view.batalBtn.classList.toggle('hidden', !isActiveSection);
                view.batalBtn.disabled = isSaving;
            }
            if (view.simpanBtn) {
                view.simpanBtn.classList.toggle('hidden', !isActiveSection);
                view.simpanBtn.disabled = isSaving;
            }
        });

        syncDynamicRowControls();
    };

    const syncSectionChrome = () => {
        sectionViews.forEach((view, sectionId) => {
            const isActiveSection = activeSectionId === sectionId;
            view.container.classList.toggle('ring-2', isActiveSection);
            view.container.classList.toggle('ring-teal-500', isActiveSection);
            view.container.classList.toggle('shadow-md', isActiveSection);
            view.container.classList.toggle('border-teal-200', isActiveSection);
            view.container.classList.toggle('border-gray-100', !isActiveSection);
        });

        syncActionButtons();
    };

    const setSectionSaving = (container: HTMLElement, sectionIsSaving: boolean) => {
        const sectionId = container.getAttribute('data-section');
        const simpanBtn = sectionId ? sectionViews.get(sectionId)?.simpanBtn : null;

        container.classList.toggle('is-saving', sectionIsSaving);
        if (simpanBtn) {
            if (sectionIsSaving) {
                if (!simpanBtn.dataset.originalHtml) {
                    simpanBtn.dataset.originalHtml = simpanBtn.innerHTML;
                }
                simpanBtn.innerHTML = '<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> Menyimpan...';
            } else if (simpanBtn.dataset.originalHtml) {
                simpanBtn.innerHTML = simpanBtn.dataset.originalHtml;
                delete simpanBtn.dataset.originalHtml;
            }
        }

        syncActionButtons();
    };

    const initAccordion = () => {
        sectionViews.forEach((view, sectionId) => {
            if (view.header && !view.header.hasAttribute('data-accordion-bound')) {
                view.header.addEventListener('click', () => toggleSection(sectionId));
                view.header.setAttribute('data-accordion-bound', 'true');
            }
        });

        syncAccordionAfterLoad(openSectionId);
    };

    const cancelEditSection = (e: Event) => {
        const currentBtn = e.currentTarget as HTMLButtonElement;
        const container = currentBtn.closest('.profile-section') as HTMLElement;
        const sectionName = container?.getAttribute('data-section');
        if (!container || !sectionName || !sections[sectionName]) return;

        sections[sectionName].restoreSnapshot(formSnapshot[sectionName]);

        hasUnsavedChanges = false;
        activeSectionId = null;

        setInputsState(container, false);
        clearSectionStatus(sectionName);
        clearSectionValidationErrors(container);
        openSection(sectionName, { force: true });
        syncSectionChrome();
    };

    const handleEditSection = (e: Event) => {
        if (isSaving) return;

        const currentBtn = e.currentTarget as HTMLButtonElement;
        const container = currentBtn.closest('.profile-section') as HTMLElement;
        const sectionName = container?.getAttribute('data-section');
        if (!container || !sectionName) return;

        if (activeSectionId && activeSectionId !== sectionName) {
            showError('Harap simpan atau batalkan perubahan pada bagian saat ini terlebih dahulu.');
            return;
        }

        openSection(sectionName, { force: true });
        clearSectionStatus(sectionName);
        clearSectionValidationErrors(container);

        activeSectionId = sectionName;
        hasUnsavedChanges = false;
        formSnapshot = captureFullSnapshot();

        setTimeout(() => {
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);

        setInputsState(container, true);
        syncSectionChrome();
    };

    cacheSectionViews();
    initAccordion();
    syncSectionChrome();

    sectionViews.forEach(view => {
        if (view.editBtn && !view.editBtn.hasAttribute('data-listener-bound')) {
            view.editBtn.addEventListener('click', handleEditSection);
            view.editBtn.setAttribute('data-listener-bound', 'true');
        }
        if (view.batalBtn && !view.batalBtn.hasAttribute('data-listener-bound')) {
            view.batalBtn.addEventListener('click', cancelEditSection);
            view.batalBtn.setAttribute('data-listener-bound', 'true');
        }
        if (view.simpanBtn && !view.simpanBtn.hasAttribute('data-listener-bound')) {
            view.simpanBtn.addEventListener('click', (e) => saveProfile(false, e.currentTarget as HTMLButtonElement));
            view.simpanBtn.setAttribute('data-listener-bound', 'true');
        }
    });

    async function loadProfile() {
        try {
            const res = await apiFetch('/api/profile', {
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                const profile = data.profile;
                const user = data.user;

                if (user) {
                    if (document.getElementById('sso_nama')) (document.getElementById('sso_nama') as HTMLInputElement).value = user.name || '';
                    if (document.getElementById('sso_email')) (document.getElementById('sso_email') as HTMLInputElement).value = user.email || '';
                }

                if (profile) {
                    initialUpdatedAt = profile.updated_at || null;
                    if (document.getElementById('sso_nim')) (document.getElementById('sso_nim') as HTMLInputElement).value = profile.nim || '';

                    // Use relational chain from user (not legacy string fields)
                    const sp = user?.study_program;
                    if (document.getElementById('sso_program_studi')) (document.getElementById('sso_program_studi') as HTMLInputElement).value = sp ? `${sp.code} — ${sp.name}` : '';
                    if (document.getElementById('sso_departemen')) (document.getElementById('sso_departemen') as HTMLInputElement).value = sp?.department ? `${sp.department.code} — ${sp.department.name}` : '';
                    if (document.getElementById('sso_fakultas')) (document.getElementById('sso_fakultas') as HTMLInputElement).value = sp?.department?.faculty?.name || '';

                    if (document.getElementById('tempat_lahir')) (document.getElementById('tempat_lahir') as HTMLInputElement).value = profile.tempat_lahir || '';
                    if (document.getElementById('tanggal_lahir')) (document.getElementById('tanggal_lahir') as HTMLInputElement).value = profile.tanggal_lahir?.split('T')[0] || '';
                    if (document.getElementById('jenis_kelamin')) (document.getElementById('jenis_kelamin') as HTMLSelectElement).value = profile.jenis_kelamin || '';
                    if (document.getElementById('no_hp')) (document.getElementById('no_hp') as HTMLInputElement).value = profile.no_hp || '';
                    if (document.getElementById('alamat_asal')) (document.getElementById('alamat_asal') as HTMLTextAreaElement).value = profile.alamat_asal || '';
                    if (document.getElementById('alamat_domisili')) (document.getElementById('alamat_domisili') as HTMLTextAreaElement).value = profile.alamat_domisili || '';

                    const tbody = document.getElementById('saudara-tbody');
                    if (tbody) tbody.innerHTML = '';
                    
                    if (profile.keluarga && Array.isArray(profile.keluarga)) {
                        profile.keluarga.forEach((k: any) => {
                            if (k.jenis_relasi === 'ayah') {
                                if (document.getElementById('ayah_nama')) (document.getElementById('ayah_nama') as HTMLInputElement).value = k.nama_lengkap || '';
                                if (document.getElementById('ayah_pekerjaan')) (document.getElementById('ayah_pekerjaan') as HTMLInputElement).value = k.pekerjaan || '';
                                if (document.getElementById('ayah_penghasilan')) (document.getElementById('ayah_penghasilan') as HTMLInputElement).value = k.penghasilan || '';
                                if (document.getElementById('ayah_status')) (document.getElementById('ayah_status') as HTMLSelectElement).value = k.status_hidup || 'hidup';
                                if (document.getElementById('ayah_tgl_meninggal')) (document.getElementById('ayah_tgl_meninggal') as HTMLInputElement).value = k.tanggal_meninggal?.split('T')[0] || '';
                            } else if (k.jenis_relasi === 'ibu') {
                                if (document.getElementById('ibu_nama')) (document.getElementById('ibu_nama') as HTMLInputElement).value = k.nama_lengkap || '';
                                if (document.getElementById('ibu_pekerjaan')) (document.getElementById('ibu_pekerjaan') as HTMLInputElement).value = k.pekerjaan || '';
                                if (document.getElementById('ibu_penghasilan')) (document.getElementById('ibu_penghasilan') as HTMLInputElement).value = k.penghasilan || '';
                                if (document.getElementById('ibu_status')) (document.getElementById('ibu_status') as HTMLSelectElement).value = k.status_hidup || 'hidup';
                                if (document.getElementById('ibu_tgl_meninggal')) (document.getElementById('ibu_tgl_meninggal') as HTMLInputElement).value = k.tanggal_meninggal?.split('T')[0] || '';
                            } else if (k.jenis_relasi === 'wali') {
                                if (document.getElementById('wali_nama')) (document.getElementById('wali_nama') as HTMLInputElement).value = k.nama_lengkap || '';
                                if (document.getElementById('wali_pekerjaan')) (document.getElementById('wali_pekerjaan') as HTMLInputElement).value = k.pekerjaan || '';
                                if (document.getElementById('wali_penghasilan')) (document.getElementById('wali_penghasilan') as HTMLInputElement).value = k.penghasilan || '';
                                if (document.getElementById('wali_status')) (document.getElementById('wali_status') as HTMLSelectElement).value = k.status_hidup || 'hidup';
                            } else if (k.jenis_relasi === 'saudara' && tbody) {
                                const rowIndex = tbody.children.length;
                                const tr = document.createElement('tr');
                                tr.innerHTML = `
                                    <td class="px-6 py-4 font-medium text-gray-800"><input type="text" value="${k.nama_lengkap || ''}" placeholder="Nama saudara" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                                    <td class="px-6 py-4"><input type="text" value="${k.pekerjaan || ''}" placeholder="Pekerjaan/Sekolah" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                                    <td class="px-6 py-4">
                                        <select class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold">
                                            <option ${k.status_kawin === 'Belum Kawin' ? 'selected' : ''}>Belum Kawin</option>
                                            <option ${k.status_kawin === 'Sudah Kawin' ? 'selected' : ''}>Sudah Kawin</option>
                                        </select>
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-4">
                                            <label class="flex items-center gap-1.5 cursor-pointer">
                                                <input type="radio" name="ket_saudara_load_${rowIndex}" value="Kakak" ${k.keterangan === 'Kakak' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                                                <span class="text-sm text-gray-700 font-bold">Kakak</span>
                                            </label>
                                            <label class="flex items-center gap-1.5 cursor-pointer">
                                                <input type="radio" name="ket_saudara_load_${rowIndex}" value="Adik" ${k.keterangan === 'Adik' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                                                <span class="text-sm text-gray-700 font-bold">Adik</span>
                                            </label>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-center">
                                        <button type="button" class="btn-hapus-saudara text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </td>
                                `;
                                tbody.appendChild(tr);
                            }
                        });
                    }

                    if (beasiswaTbody) beasiswaTbody.innerHTML = '';
                    if (profile.scholarship_histories && Array.isArray(profile.scholarship_histories)) {
                        profile.scholarship_histories.forEach((sh: any) => {
                            addBeasiswaRow(sh.nama_beasiswa || '', sh.periode || '', sh.jumlah || '', sh.status || 'Selesai');
                        });
                    }
                    updateBeasiswaCounter();

                    if (profile.pas_foto_path) {
                        localStorage.setItem('auth_photo', profile.pas_foto_path);
                        void loadProtectedImageObjectUrl(profile.pas_foto_path).then((objectUrl) => {
                            revokeProtectedImageObjectUrl(pasFotoObjectUrl);
                            pasFotoObjectUrl = objectUrl;
                            const container = document.getElementById('preview-foto-container');
                            if (container) {
                                if (objectUrl) {
                                    container.innerHTML = `<img src="${objectUrl}" class="h-10 w-10 object-cover rounded-lg border border-gray-200"> <span class="text-xs text-teal-600 font-bold italic">Tersimpan</span>`;
                                } else {
                                    container.innerHTML = `<span class="text-xs text-gray-500 font-medium italic">Tersimpan, namun preview tidak tersedia.</span>`;
                                }
                            }
                        });
                        // Load a separate object URL for the header avatar so the
                        // preview lifecycle (revoked on re-render) doesn't yank the
                        // src out from under the topbar <img>.
                        const headerAvatar = document.getElementById('header-user-avatar') as HTMLImageElement | null;
                        if (headerAvatar) {
                            void loadProtectedImageObjectUrl(profile.pas_foto_path).then((avatarUrl) => {
                                if (!avatarUrl) return;
                                revokeProtectedImageObjectUrl(headerAvatarObjectUrl);
                                headerAvatarObjectUrl = avatarUrl;
                                headerAvatar.src = avatarUrl;
                                headerAvatar.className = 'w-full h-full object-cover';
                            });
                        }
                    }
                    if (profile.tanda_tangan_path) {
                        void loadProtectedImageObjectUrl(profile.tanda_tangan_path).then((objectUrl) => {
                            revokeProtectedImageObjectUrl(tandaTanganObjectUrl);
                            tandaTanganObjectUrl = objectUrl;
                            const container = document.getElementById('preview-ttd-container');
                            if (container) {
                                if (objectUrl) {
                                    container.innerHTML = `<img src="${objectUrl}" class="h-10 w-20 object-contain rounded-lg border border-gray-200 bg-gray-50"> <span class="text-xs text-teal-600 font-bold italic">Tersimpan</span>`;
                                } else {
                                    container.innerHTML = `<span class="text-xs text-gray-500 font-medium italic">Tersimpan, namun preview tidak tersedia.</span>`;
                                }
                            }
                        });
                    }
                    formatProfileNumericFields();
                    updateVisibility();
                }
            }
        } catch (e) { console.error('Fetch profile error:', e); }

        activeSectionId = null;
        hasUnsavedChanges = false;
        sectionViews.forEach(view => {
            setInputsState(view.container, false);
            clearSectionValidationErrors(view.container);
        });
        syncSectionChrome();
        syncAccordionAfterLoad(openSectionId);
        bindHapusButtons();
    }

    const updateVisibility = () => {
        const ayahStatus = (document.getElementById('ayah_status') as HTMLSelectElement)?.value;
        const ibuStatus = (document.getElementById('ibu_status') as HTMLSelectElement)?.value;
        const sectionWali = document.getElementById('section-wali');
        const ayahTglContainer = document.getElementById('ayah_tgl_meninggal_container');
        const ibuTglContainer = document.getElementById('ibu_tgl_meninggal_container');

        if (ayahTglContainer) {
            if (ayahStatus === 'meninggal') {
                ayahTglContainer.classList.remove('hidden');
            } else {
                ayahTglContainer.classList.add('hidden');
            }
        }

        if (ibuTglContainer) {
            if (ibuStatus === 'meninggal') {
                ibuTglContainer.classList.remove('hidden');
            } else {
                ibuTglContainer.classList.add('hidden');
            }
        }

        if (sectionWali) {
            if (ayahStatus === 'meninggal' && ibuStatus === 'meninggal') {
                sectionWali.classList.remove('hidden', 'opacity-50', 'pointer-events-none');
            } else {
                sectionWali.classList.add('hidden');
            }
        }
    };

    document.getElementById('ayah_status')?.addEventListener('change', updateVisibility);
    document.getElementById('ibu_status')?.addEventListener('change', updateVisibility);

    // Image Previews
    const handleImagePreview = (inputId: string, containerId: string) => {
        const input = document.getElementById(inputId) as HTMLInputElement;
        const container = document.getElementById(containerId);
        if (input && container) {
            input.addEventListener('change', () => {
                if (input.files && input.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        container.innerHTML = `<img src="${e.target?.result}" class="${inputId === 'input-foto' ? 'h-10 w-10 object-cover' : 'h-10 w-20 object-contain'} rounded-lg border border-gray-200"> <span class="text-xs text-teal-600 font-bold italic">Terpilih</span>`;
                    };
                    reader.readAsDataURL(input.files[0]);
                }
            });
        }
    };
    handleImagePreview('input-foto', 'preview-foto-container');
    handleImagePreview('input-ttd', 'preview-ttd-container');

    const showOCCModal = (onReload: () => void, onForceSave: () => void, onCancel: () => void) => {
        if (document.getElementById('occ-modal-overlay')) return;
        
        console.info('[Analytics] OCC Modal Triggered - Version Mismatch Detected');

        const overlay = document.createElement('div');
        overlay.id = 'occ-modal-overlay';
        overlay.className = 'fixed inset-0 bg-gray-900/60 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm transition-opacity duration-200 opacity-0';
        
        const modal = document.createElement('div');
        modal.className = 'bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-200 scale-95';
        
        modal.innerHTML = `
            <div class="p-6">
                <div class="flex items-center justify-center w-12 h-12 mx-auto bg-amber-100 rounded-full mb-4 ring-4 ring-amber-50">
                    <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <h3 class="text-lg font-bold text-center text-gray-900 mb-2">Perhatian: Data Telah Diperbarui</h3>
                <p class="text-sm text-center text-gray-600 mb-6 leading-relaxed">
                    Data profil ini baru saja diperbarui oleh sistem.<br><br>
                    Pilih <strong>Muat Ulang</strong> untuk memulihkan data terbaru (isian Anda akan terhapus).<br><br>
                    <span class="inline-block mt-1 text-red-600 font-medium px-2 py-1.5 bg-red-50 rounded border border-red-100">⚠️ <strong>Lanjut Simpan</strong> akan menimpa data terbaru di sistem secara permanen.</span>
                </p>
                <div class="flex flex-col gap-3">
                    <button id="occ-btn-reload" class="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors shadow-sm ring-1 ring-teal-700">
                        Muat Ulang Data (Disarankan)
                    </button>
                    <button id="occ-btn-force" class="w-full px-4 py-2.5 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-100 transition-colors border border-red-100">
                        Lanjut Simpan (Timpa Data)
                    </button>
                    <button id="occ-btn-cancel" class="w-full px-4 py-2 bg-transparent text-gray-500 rounded-lg font-medium hover:text-gray-700 hover:bg-gray-50 transition-colors">
                        Batal
                    </button>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-95');
            modal.classList.add('scale-100');
        });

        const close = () => {
            overlay.classList.add('opacity-0');
            modal.classList.remove('scale-100');
            modal.classList.add('scale-95');
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleEsc);
            setTimeout(() => overlay.remove(), 200);
        };

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                console.info('[Analytics] OCC Action Selected - Batal / ESC');
                close();
                onCancel();
            }
        };
        window.addEventListener('keydown', handleEsc);

        modal.querySelector('#occ-btn-reload')?.addEventListener('click', () => { 
            console.info('[Analytics] OCC Action Selected - Muat Ulang Data');
            close(); 
            onReload(); 
        });
        modal.querySelector('#occ-btn-force')?.addEventListener('click', () => { 
            console.info('[Analytics] OCC Action Selected - Lanjut Simpan (Force Overwrite)');
            close(); 
            onForceSave(); 
        });
        modal.querySelector('#occ-btn-cancel')?.addEventListener('click', () => { 
            console.info('[Analytics] OCC Action Selected - Batal');
            close(); 
            onCancel(); 
        });
    };

    const saveProfile = async (force = false, currentBtn?: HTMLButtonElement) => {
        if (isSaving) return;

        const savedSectionId = currentBtn?.closest('.profile-section')?.getAttribute('data-section') || activeSectionId || openSectionId || 'detail';
        const container = (sectionViews.get(savedSectionId)?.container || currentBtn?.closest('.profile-section')) as HTMLElement | null;
        if (container) {
            clearSectionStatus(savedSectionId);
            clearSectionValidationErrors(container);
        }

        if (!validatePhoneBeforeSave()) return;

        const token = localStorage.getItem('auth_token');
        if (!token) {
            if (container) setSectionStatus(savedSectionId, 'error', 'Sesi login berakhir. Silakan masuk kembali.');
            return;
        }

        isSaving = true;
        if (container) {
            openSection(savedSectionId, { force: true });
            setInputsState(container, false);
            setSectionSaving(container, true);
        } else {
            syncActionButtons();
        }

        if (!force && initialUpdatedAt) {
            try {
                const checkRes = await apiFetch('/api/profile', { cache: 'no-store' });
                if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    const currentUpdatedAt = checkData.profile?.updated_at;
                    if (currentUpdatedAt && currentUpdatedAt !== initialUpdatedAt) {
                        isSaving = false;
                        if (container) {
                            setSectionSaving(container, false);
                            setInputsState(container, true);
                            openSection(savedSectionId, { force: true });
                        } else {
                            syncActionButtons();
                        }
                        
                        showOCCModal(
                            () => { loadProfile().then(() => syncAccordionAfterLoad(savedSectionId)); },
                            () => { saveProfile(true, currentBtn); },
                            () => {
                                if (container) {
                                    setInputsState(container, true);
                                    openSection(savedSectionId, { force: true });
                                }
                            }
                        );
                        return;
                    }
                }
            } catch (e) {
                showWarning('Gagal memverifikasi versi data (gangguan jaringan). Proses simpan dilanjutkan.');
            }
        }

        try {
            const formData = new FormData();
            
            let keluarga: any[] = [];
            let beasiswas: any[] = [];

            Object.values(sections).forEach(controller => {
                const data = controller.getPayload();
                if (data.detail) {
                    Object.entries(data.detail).forEach(([key, value]) => {
                        formData.append(key, value as string);
                    });
                }
                if (data.ayah) keluarga.push(data.ayah);
                if (data.ibu) keluarga.push(data.ibu);
                if (data.wali) keluarga.push(data.wali);
                if (data.saudara) keluarga = keluarga.concat(data.saudara);
                if (data.beasiswa) beasiswas = beasiswas.concat(data.beasiswa);
            });

            formData.append('keluarga', JSON.stringify(keluarga));
            formData.append('scholarship_histories', JSON.stringify(beasiswas));

            const inputFoto = document.getElementById('input-foto') as HTMLInputElement | null;
            const inputTtd = document.getElementById('input-ttd') as HTMLInputElement | null;
            const fileFoto = inputFoto?.files?.[0];
            const fileTtd = inputTtd?.files?.[0];
            
            if (fileFoto) formData.append('pas_foto', fileFoto);
            if (fileTtd) formData.append('tanda_tangan', fileTtd);

            const res = await apiFetch('/api/profile', {
                method: 'POST',
                body: formData,
                isFormData: true,
            });

            if (res.ok) {
                console.info('[Analytics] Profile Save Success');
                if (inputFoto) inputFoto.value = '';
                if (inputTtd) inputTtd.value = '';
                
                await loadProfile();
                syncAccordionAfterLoad(savedSectionId);
                formSnapshot = captureFullSnapshot();
                showSuccess('Profil berhasil diperbarui');
                setSectionStatus(savedSectionId, 'success', 'Tersimpan');

            } else {
                let errorMsg = "Gagal memperbarui profil";
                let validationErrors: Record<string, string[] | string> | null = null;
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    try {
                        const err = await res.json();
                        errorMsg = err.message || errorMsg;
                        validationErrors = err.errors || null;
                    } catch (e) { }
                }
                console.warn('[Analytics] Profile Save Failed', errorMsg);
                showError(errorMsg);
                if (container) {
                    openSection(savedSectionId, { force: true });
                    setInputsState(container, true);
                    if (validationErrors) applyValidationErrors(container, validationErrors);
                    setSectionStatus(savedSectionId, 'error', errorMsg);
                }
            }
        } catch (e) {
            console.error('[Analytics] Profile Save Error', e);
            showError('Terjadi kesalahan sistem');
            if (container) {
                openSection(savedSectionId, { force: true });
                setInputsState(container, true);
                setSectionStatus(savedSectionId, 'error', 'Terjadi kesalahan sistem');
            }
        } finally {
            isSaving = false;
            if (container) {
                setSectionSaving(container, false);
            } else {
                syncActionButtons();
            }
        }
    };

    if (btnTambahSaudara) {
        btnTambahSaudara.addEventListener('click', () => {
            const tbody = document.getElementById('saudara-tbody');
            if (!tbody) return;
            const rowIndex = tbody.children.length;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-800"><input type="text" placeholder="Nama saudara" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none"></td>
                <td class="px-6 py-4"><input type="text" placeholder="Pekerjaan/Sekolah" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none"></td>
                <td class="px-6 py-4">
                    <select class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none">
                        <option>Belum Kawin</option>
                        <option>Sudah Kawin</option>
                    </select>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="ket_saudara_${rowIndex}" value="Kakak" checked class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                            <span class="text-sm text-gray-700">Kakak</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="ket_saudara_${rowIndex}" value="Adik" class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                            <span class="text-sm text-gray-700">Adik</span>
                        </label>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <button type="button" class="btn-hapus-saudara text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
            bindHapusButtons();
            checkDirtyState();
        });
    }

    if (btnTambahBeasiswa && beasiswaTbody) {
        btnTambahBeasiswa.addEventListener('click', () => {
            addBeasiswaRow();
        });
    }

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProfile(false);
    });

    loadProfile();
};
