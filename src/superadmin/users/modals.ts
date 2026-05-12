import { tabManager } from './types';
import { buildUserPayload } from './ui-utils';
import { attachNimUppercaseHandler, normalizeNim } from '../../shared/nim-utils';
import { populateStudyProgramSelect } from '../../shared/study-program-select';
import { populateDepartmentSelect } from '../../shared/department-select';
import { apiFetch } from '../../shared/api-client';
import { showSuccess, showError } from '../../shared/toast';

// Global cache for modal static data (laboratories, surat types)
let cachedLaboratories: any[] | null = null;
let cachedSuratTypes: any[] | null = null;

type SuratType = {
    key: string;
    label?: string;
    name?: string;
    category?: string;
    legacy_keys?: string[];
};

const suratTypeLabel = (item: SuratType): string => item.label || item.name || item.key;

const isSuratTypeAssigned = (item: SuratType, assignedTasks: string[]): boolean => {
    const assigned = new Set(assignedTasks);

    return assigned.has(item.key) || (item.legacy_keys || []).some((legacyKey) => assigned.has(legacyKey));
};

export const renderUserModal = (user: any = null, onRefresh: () => void) => {
    const defaultRole = user?.role || tabManager.getActive();
    const modalContainer = document.getElementById('modal-container')!;
    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto">
                <div class="bg-teal-700 px-6 py-4 flex justify-between items-center text-white sticky top-0 z-10">
                    <h3 class="font-bold">${user ? 'Edit Akun' : 'Tambah Akun Baru'}</h3>
                    <button id="close-modal" class="hover:bg-white/10 p-1 rounded-lg transition-colors">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="user-form" class="p-6 space-y-4">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nama Lengkap</label>
                        <input type="text" name="name" value="${user?.name || ''}" required class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email</label>
                        <input type="email" name="email" value="${user?.email || ''}" required class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">NIP</label>
                        <input type="text" name="nip" value="${user?.nip || ''}" placeholder="Masukkan NIP" maxlength="50" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Role</label>
                        <select id="modal-role-select" name="role" required class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            <option value="mahasiswa" ${defaultRole === 'mahasiswa' ? 'selected' : ''}>Mahasiswa</option>
                            <option value="tendik" ${defaultRole === 'tendik' ? 'selected' : ''}>Tenaga Pendidik (Tendik)</option>
                            <option value="akademik" ${defaultRole === 'akademik' ? 'selected' : ''}>Akademik</option>
                            <option value="super_admin" ${defaultRole === 'super_admin' ? 'selected' : ''}>Super Admin</option>
                        </select>
                    </div>
                    <div id="sub-role-container" class="${defaultRole === 'akademik' ? '' : 'hidden'}">
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Peran Akademik</label>
                        <select name="sub_role" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            <option value="" ${!user?.sub_role ? 'selected' : ''}>Pilih Peran...</option>
                            <option value="kadep" ${user?.sub_role === 'kadep' ? 'selected' : ''}>Ketua Departemen (Kadep)</option>
                            <option value="kaprodi" ${user?.sub_role === 'kaprodi' ? 'selected' : ''}>Ketua Program Studi (Kaprodi)</option>
                            <option value="sekdep" ${user?.sub_role === 'sekdep' ? 'selected' : ''}>Sekretaris Departemen (Sekdep)</option>
                            <option value="sekprodi" ${user?.sub_role === 'sekprodi' ? 'selected' : ''}>Sekretaris Program Studi (Sekprodi)</option>
                        </select>
                    </div>
                    <div id="role-level-container" class="${defaultRole === 'super_admin' ? '' : 'hidden'}">
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Role Level</label>
                        <select name="role_level" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            <option value="secondary" ${user?.role_level !== 'primary' ? 'selected' : ''}>Secondary</option>
                            <option value="primary" ${user?.role_level === 'primary' ? 'selected' : ''}>Primary</option>
                        </select>
                    </div>

                    <div id="study-program-container" class="${defaultRole === 'akademik' && ['kaprodi', 'sekprodi'].includes(user?.sub_role) ? '' : 'hidden'}">
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Program Studi</label>
                        <select name="study_program_id" id="study-program-select" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            <option value="">Memuat program studi...</option>
                        </select>
                    </div>
                    <div id="department-container" class="${defaultRole === 'akademik' && ['kadep', 'sekdep'].includes(user?.sub_role) ? '' : 'hidden'}">
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Departemen</label>
                        <select name="department_id" id="department-select" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            <option value="">Memuat departemen...</option>
                        </select>
                    </div>

                    <!-- Mahasiswa Fields -->
                    <div id="mahasiswa-fields" class="${defaultRole === 'mahasiswa' ? '' : 'hidden'} space-y-4 pt-2 border-t border-gray-50">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">NIM</label>
                                <input type="text" name="nim" value="${user?.mahasiswa_profile?.nim || ''}" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all uppercase" placeholder="••••••••">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tgl Lahir</label>
                                <input type="date" name="tanggal_lahir" value="${user?.mahasiswa_profile?.tanggal_lahir || ''}" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            </div>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Program Studi</label>
                            <select name="study_program_id" id="mhs-study-program-select" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                                <option value="">Memuat program studi...</option>
                            </select>
                        </div>
                    </div>

                    <!-- Tendik Fields -->
                    <div id="tendik-fields" class="${defaultRole === 'tendik' ? '' : 'hidden'} space-y-5 pt-4 border-t border-gray-100">
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Jenis Peran Tendik</label>
                            <select name="tendikRole" id="modal-tendik-role-select" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                                <optgroup label="Administrasi">
                                    <option value="persuratan" ${(!user?.tendik_role || user?.tendik_role === 'persuratan') ? 'selected' : ''}>Persuratan</option>
                                </optgroup>
                                <optgroup label="Sarana & Prasarana">
                                    <option value="sarpras" ${user?.tendik_role === 'sarpras' ? 'selected' : ''}>Sarpras</option>
                                </optgroup>
                                <optgroup label="Laboratorium">
                                    <option value="kepala_lab" ${user?.tendik_role === 'kepala_lab' ? 'selected' : ''}>Kepala Lab</option>
                                    <option value="laboran" ${user?.tendik_role === 'laboran' ? 'selected' : ''}>Laboran</option>
                                </optgroup>
                            </select>
                            <p id="tendik-role-helper" class="text-[10px] text-gray-500 mt-1.5 font-medium transition-all duration-300"></p>
                            
                            <div id="sarpras-info-box" class="hidden mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5 animate-fade-in transition-all">
                                <svg class="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <p class="text-[11px] text-blue-700 leading-relaxed font-medium">Pengguna dengan peran Sarpras akan mengelola peminjaman ruang kelas (teori).</p>
                            </div>
                        </div>
                        
                        <div id="tendik-tasks-container" class="${(!user?.tendik_role || user?.tendik_role === 'persuratan') ? '' : 'hidden'} pt-2 border-t border-gray-50">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Penugasan Verifikasi Dokumen</label>
                            <div id="dynamic-tasks-container" class="grid grid-cols-1 gap-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <div class="text-xs text-gray-400 animate-pulse">Memuat daftar tugas...</div>
                            </div>
                        </div>

                        <div id="laboratory-select-container" class="${['kepala_lab', 'laboran'].includes(user?.tendik_role) ? '' : 'hidden'} pt-2 border-t border-gray-50">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Pilih Laboratorium</label>
                            <select name="laboratoryId" id="laboratory-select" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400">
                                <option value="">Memuat laboratorium...</option>
                            </select>
                            <p id="laboratory-warning" class="hidden text-[10px] text-red-500 mt-1.5 font-bold">Data laboratorium belum tersedia. Hubungi sistem administrator.</p>
                        </div>
                    </div>

                    <div id="password-section" class="${!user ? '' : 'hidden'}">
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Password</label>
                        <div class="flex gap-2">
                            <div class="relative flex-1">
                                <input type="password" id="modal-password-input" name="password" ${!user ? 'required' : ''} class="w-full px-4 pl-4 pr-10 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all" placeholder="••••••••">
                                <button type="button" id="toggle-password-btn" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600 transition-colors">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                            </div>
                            <button type="button" id="generate-password-btn" class="px-4 py-2 bg-gray-50 hover:bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wider border border-gray-100 rounded-xl transition-all shadow-sm hidden">
                                Generate
                            </button>
                        </div>
                        <p id="password-hint" class="text-[9px] text-gray-400 mt-1 hidden italic">Auto-generated: [NIM] + [TglLahir]</p>
                    </div>

                    <div class="mt-8 flex gap-3 justify-end pt-4 border-t border-gray-100">
                        <button type="button" class="close-drawer px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-all text-sm shadow-sm">Batal</button>
                        <button type="submit" id="submit-user-btn" class="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            ${user ? 'Simpan Perubahan' : 'Buat Akun'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const form = document.getElementById('user-form') as HTMLFormElement;
    const roleSelect = form.querySelector('#modal-role-select') as HTMLSelectElement;
    const mhsFields = form.querySelector('#mahasiswa-fields')!;
    const tendikFields = form.querySelector('#tendik-fields')!;
    const passInput = form.querySelector('#modal-password-input') as HTMLInputElement;
    const passHint = form.querySelector('#password-hint')!;

    const updateVisibility = () => {
        const isMhs = roleSelect.value === 'mahasiswa';
        const isTendik = roleSelect.value === 'tendik';
        const isAkademik = roleSelect.value === 'akademik';

        mhsFields.classList.toggle('hidden', !isMhs);
        tendikFields.classList.toggle('hidden', !isTendik);

        // Disable hidden selects with duplicate name="study_program_id" to prevent FormData collision
        const akademikProgSelect = form.querySelector('#study-program-select') as HTMLSelectElement;
        const mhsProgSelect = form.querySelector('#mhs-study-program-select') as HTMLSelectElement;
        if (akademikProgSelect) akademikProgSelect.disabled = !isAkademik;
        if (mhsProgSelect) mhsProgSelect.disabled = !isMhs;
        form.querySelector('#sub-role-container')?.classList.toggle('hidden', !isAkademik);
        form.querySelector('#role-level-container')?.classList.toggle('hidden', roleSelect.value !== 'super_admin');

        // Academic dropdowns visibility
        const subRoleSelect = form.querySelector('select[name="sub_role"]') as HTMLSelectElement;
        const studyProgramContainer = form.querySelector('#study-program-container');
        const departmentContainer = form.querySelector('#department-container');
        if (subRoleSelect) {
            const subVal = subRoleSelect.value;
            const showProgram = isAkademik && ['kaprodi', 'sekprodi'].includes(subVal);
            const showDept = isAkademik && ['kadep', 'sekdep'].includes(subVal);
            studyProgramContainer?.classList.toggle('hidden', !showProgram);
            departmentContainer?.classList.toggle('hidden', !showDept);
        } else {
            studyProgramContainer?.classList.add('hidden');
            departmentContainer?.classList.add('hidden');
        }

        // Show generate button only for tendik and akademik
        const genBtn = form.querySelector('#generate-password-btn');
        if (genBtn) {
            genBtn.classList.toggle('hidden', !(isTendik || isAkademik));
        }

        const tendikRoleSelect = form.querySelector('#modal-tendik-role-select') as HTMLSelectElement;
        const tendikTasksContainer = form.querySelector('#tendik-tasks-container');
        const labSelectContainer = form.querySelector('#laboratory-select-container');
        const tendikHelper = form.querySelector('#tendik-role-helper');
        const sarprasInfoBox = form.querySelector('#sarpras-info-box');
        const submitBtn = form.querySelector('#submit-user-btn') as HTMLButtonElement;
        const labSelect = form.querySelector('#laboratory-select') as HTMLSelectElement;

        const checkValidity = () => {
            if (submitBtn && roleSelect) {
                if (roleSelect.value === 'tendik' && tendikRoleSelect) {
                    if (['kepala_lab', 'laboran'].includes(tendikRoleSelect.value)) {
                        if (!labSelect || !labSelect.value || labSelect.disabled) {
                            submitBtn.disabled = true;
                            return;
                        }
                    }
                } else if (roleSelect.value === 'mahasiswa') {
                    const mhsProg = form.querySelector('#mhs-study-program-select') as HTMLSelectElement;
                    if (!mhsProg || !mhsProg.value) {
                        submitBtn.disabled = true;
                        return;
                    }
                }
                submitBtn.disabled = false;
            }
        };

        if (tendikRoleSelect) {
            const val = tendikRoleSelect.value;

            if (tendikTasksContainer) {
                if (val !== 'persuratan') {
                    tendikTasksContainer.classList.add('hidden');
                    tendikTasksContainer.classList.remove('animate-fade-in');
                    // Defensive state reset
                    form.querySelectorAll('input[name="assigned_tasks"]').forEach((cb) => {
                        (cb as HTMLInputElement).checked = false;
                    });
                } else {
                    tendikTasksContainer.classList.remove('hidden');
                    tendikTasksContainer.classList.add('animate-fade-in');
                }
            }

            if (labSelectContainer) {
                if (!['kepala_lab', 'laboran'].includes(val)) {
                    labSelectContainer.classList.add('hidden');
                    labSelectContainer.classList.remove('animate-fade-in');
                    // Defensive state reset
                    if (labSelect) labSelect.value = '';
                } else {
                    labSelectContainer.classList.remove('hidden');
                    labSelectContainer.classList.add('animate-fade-in');
                }
            }

            if (sarprasInfoBox) {
                if (val === 'sarpras') {
                    sarprasInfoBox.classList.remove('hidden');
                    sarprasInfoBox.classList.add('animate-fade-in');
                } else {
                    sarprasInfoBox.classList.add('hidden');
                    sarprasInfoBox.classList.remove('animate-fade-in');
                }
            }

            if (tendikHelper) {
                if (val === 'persuratan') tendikHelper.textContent = 'Mengelola dan memverifikasi surat administrasi mahasiswa';
                else if (val === 'sarpras') tendikHelper.textContent = 'Mengelola peminjaman ruang kelas';
                else if (val === 'kepala_lab') tendikHelper.textContent = 'Bertanggung jawab atas operasional laboratorium';
                else if (val === 'laboran') tendikHelper.textContent = 'Mendukung operasional laboratorium';
            }
        }

        checkValidity();

        if (!user) {
            if (isMhs) {
                passInput.readOnly = true;
                passInput.placeholder = '••••••••';
                passHint.classList.remove('hidden');
            } else {
                passInput.readOnly = false;
                passInput.placeholder = '••••••••';
                passHint.classList.add('hidden');
            }
        }
    };

    roleSelect.addEventListener('change', updateVisibility);
    form.querySelector('select[name="sub_role"]')?.addEventListener('change', updateVisibility);
    form.querySelector('#modal-tendik-role-select')?.addEventListener('change', updateVisibility);
    form.querySelector('#laboratory-select')?.addEventListener('change', updateVisibility);
    form.querySelector('#mhs-study-program-select')?.addEventListener('change', updateVisibility);
    updateVisibility();

    // Load academic dropdowns from API
    const loadStudyPrograms = async () => {
        const select = form.querySelector('#study-program-select') as HTMLSelectElement;
        if (!select) return;
        await populateStudyProgramSelect(select, user?.study_program_id);
    };
    const loadDepartments = async () => {
        const select = form.querySelector('#department-select') as HTMLSelectElement;
        if (!select) return;
        await populateDepartmentSelect(select, user?.department_id);
    };
    const loadLaboratories = async () => {
        const select = form.querySelector('#laboratory-select') as HTMLSelectElement;
        const warning = form.querySelector('#laboratory-warning');
        if (!select) return;

        const populate = (labs: any[]) => {
            if (labs.length === 0) {
                select.innerHTML = '<option value="">Data laboratorium belum tersedia</option>';
                select.disabled = true;
                warning?.classList.remove('hidden');
            } else {
                select.innerHTML = '<option value="">Pilih Laboratorium...</option>' +
                    labs.map((l: any) => `<option value="${l.id}" ${user?.laboratory_id == l.id ? 'selected' : ''}>${l.code} - ${l.name}</option>`).join('');
                select.disabled = false;
                warning?.classList.add('hidden');
            }
            updateVisibility();
        };

        if (cachedLaboratories !== null) {
            populate(cachedLaboratories);
            return;
        }

        try {
            const res = await apiFetch('/api/laboratories');
            if (res.ok) {
                const labs = await res.json();
                cachedLaboratories = labs;
                populate(labs);
            } else {
                select.innerHTML = '<option value="">Gagal memuat data laboratorium</option>';
                select.disabled = true;
                updateVisibility();
            }
        } catch {
            select.innerHTML = '<option value="">Gagal memuat data laboratorium</option>';
            select.disabled = true;
            updateVisibility();
        }
    };
    const loadSuratTypes = async () => {
        const container = form.querySelector('#dynamic-tasks-container');
        if (!container) return;

        const populate = (types: SuratType[]) => {
            const assigned = (user?.assigned_tasks || []).filter((task: unknown): task is string => typeof task === 'string');
            if (types.length === 0) {
                container.innerHTML = '<p class="text-xs text-gray-400">Belum ada jenis surat aktif.</p>';
                return;
            }
            container.innerHTML = types.map((item: SuratType) => `
                <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" name="assigned_tasks" value="${item.key}" ${isSuratTypeAssigned(item, assigned) ? 'checked' : ''} class="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500">
                    <span class="text-xs text-gray-600 group-hover:text-teal-700 transition-colors">${suratTypeLabel(item)}</span>
                </label>
            `).join('');
        };

        if (cachedSuratTypes !== null) {
            populate(cachedSuratTypes);
            return;
        }

        try {
            const res = await apiFetch('/api/surat-types');
            if (res.ok) {
                const types = await res.json();
                cachedSuratTypes = types;
                populate(types);
            } else {
                container.innerHTML = '<p class="text-xs text-red-500">Gagal memuat tugas verifikasi.</p>';
            }
        } catch {
            container.innerHTML = '<p class="text-xs text-red-500">Gagal memuat tugas verifikasi.</p>';
        }
    };

    loadStudyPrograms();
    loadDepartments();
    loadLaboratories();
    loadSuratTypes();

    // --- Mahasiswa: study program dropdown (uses shared component) ---
    const loadMhsStudyPrograms = async () => {
        const mhsSelect = form.querySelector('#mhs-study-program-select') as HTMLSelectElement;
        if (!mhsSelect) return;
        await populateStudyProgramSelect(mhsSelect, user?.study_program_id);
        updateVisibility();
    };
    loadMhsStudyPrograms();


    // --- Modal close handlers ---
    const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeModal();
    };

    const closeModal = () => {
        modalContainer.innerHTML = '';
        document.removeEventListener('keydown', escHandler);
    };

    document.addEventListener('keydown', escHandler);
    modalContainer.querySelector('#close-modal')?.addEventListener('click', closeModal);
    form.querySelector('.close-drawer')?.addEventListener('click', closeModal);
    modalContainer.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('fixed')) closeModal();
    });

    // Toggle Password Visibility
    form.querySelector('#toggle-password-btn')?.addEventListener('click', () => {
        const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passInput.setAttribute('type', type);
        const btn = form.querySelector('#toggle-password-btn')!;
        if (type === 'text') {
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
    });

    // Generate Password
    form.querySelector('#generate-password-btn')?.addEventListener('click', () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        passInput.value = password;
        passInput.setAttribute('type', 'text');
        const toggleBtn = form.querySelector('#toggle-password-btn')!;
        toggleBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    });

    // NIM auto-uppercase (uses shared handler)
    const nimInput = form.querySelector('input[name="nim"]') as HTMLInputElement;
    if (nimInput) {
        attachNimUppercaseHandler(nimInput);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // FormData Guard: detect duplicate enabled field names at submit time
        // Prevents silent data corruption from FormData key collisions (e.g. duplicate study_program_id)
        const enabledNames = Array.from(form.querySelectorAll('[name]:not(:disabled)'))
            .map(el => (el as HTMLInputElement).name)
            .filter(name => name !== 'assigned_tasks'); // checkboxes share name intentionally
        const dupeNames = enabledNames.filter((name, i) => enabledNames.indexOf(name) !== i);
        if (dupeNames.length > 0) {
            console.error(`[FormData Guard] Duplicate enabled field names: ${[...new Set(dupeNames)].join(', ')}`);
            showError('Form error: duplikasi field terdeteksi. Hubungi administrator.');
            return;
        }

        const formData = new FormData(form);
        // Normalize NIM uppercase before sending
        if (formData.get('nim')) {
            formData.set('nim', normalizeNim(formData.get('nim') as string));
        }
        const rawData = Object.fromEntries(formData.entries());
        const assignedTasks = Array.from(form.querySelectorAll('input[name="assigned_tasks"]:checked')).map((cb: any) => cb.value);

        const { data, error } = buildUserPayload(rawData, assignedTasks, !user);
        if (error) {
            showError(error);
            return;
        }

        const endpoint = user ? `/api/super-admin/users/${user.id}` : '/api/super-admin/users';
        const method = user ? 'PUT' : 'POST';

        try {
            const response = await apiFetch(endpoint, {
                method,
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (response.ok) {
                showSuccess(result.message);
                modalContainer.innerHTML = '';
                onRefresh();
            } else {
                showError(result.message || 'Gagal menyimpan akun');
            }
        } catch (err) {
            console.error(err);
        }
    });
};
