import { tabManager } from './types';
import { mapUserPayload } from './ui-utils';
import { attachNimUppercaseHandler, normalizeNim } from '../../shared/nim-utils';
import { populateStudyProgramSelect } from '../../shared/study-program-select';
import { populateDepartmentSelect } from '../../shared/department-select';
import { apiFetch } from '../../shared/api-client';
import { showSuccess, showError, showInfo } from '../../shared/toast';

// Global cache for modal static data (laboratories, surat types)
let cachedLaboratories: any[] | null = null;
let cachedSuratTypes: any[] | null = null;

const DRAWER_ID = 'global-drawer-root';

export const closeDrawer = () => {
    const container = document.getElementById(DRAWER_ID);
    if (!container) return;
    const overlay = container.querySelector('.drawer-overlay') as HTMLElement;
    const panel = container.querySelector('.drawer-panel') as HTMLElement;
    if (overlay) overlay.style.opacity = '0';
    if (panel) panel.style.transform = 'translateX(100%)';
    setTimeout(() => {
        container.remove();
    }, 300);
};

export const getOrCreateDrawerRoot = (): HTMLElement => {
    let root = document.getElementById(DRAWER_ID);
    if (!root) {
        root = document.createElement('div');
        root.id = DRAWER_ID;
        document.body.appendChild(root);
    }
    return root;
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
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Role</label>
                        <select id="modal-role-select" name="role" required class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            <option value="mahasiswa" ${defaultRole === 'mahasiswa' ? 'selected' : ''}>Mahasiswa</option>
                            <option value="tendik" ${defaultRole === 'tendik' ? 'selected' : ''}>Tenaga Pendidik (Tendik)</option>
                            <option value="akademik" ${defaultRole === 'akademik' ? 'selected' : ''}>Akademik</option>
                            <option value="super_admin" ${defaultRole === 'super_admin' ? 'selected' : ''}>Super Admin</option>
                        </select>
                    </div>
                    <div id="sub-role-container" class="${defaultRole === 'akademik' ? '' : 'hidden'}">
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipe Jabatan Akademik</label>
                        <select name="sub_role" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            <option value="" ${!user?.sub_role ? 'selected' : ''}>Pilih Jabatan...</option>
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

        const populate = (types: any[]) => {
            const assigned = user?.assigned_tasks || [];
            if (types.length === 0) {
                container.innerHTML = '<p class="text-xs text-gray-400">Belum ada jenis surat aktif.</p>';
                return;
            }
            container.innerHTML = types.map((item: any) => `
                <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" name="assigned_tasks" value="${item.key}" ${assigned.includes(item.key) ? 'checked' : ''} class="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500">
                    <span class="text-xs text-gray-600 group-hover:text-teal-700 transition-colors">${item.name}</span>
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
        const formData = new FormData(form);
        // Normalize NIM uppercase before sending
        if (formData.get('nim')) {
            formData.set('nim', normalizeNim(formData.get('nim') as string));
        }
        let data: any = Object.fromEntries(formData.entries());
        data = mapUserPayload(data);

        // Handle akademik fields: send correct FK based on sub_role
        if (data.role === 'akademik') {
            if (['kaprodi', 'sekprodi'].includes(data.sub_role)) {
                delete data.department_id;
                if (data.study_program_id) data.study_program_id = parseInt(data.study_program_id);
            } else if (['kadep', 'sekdep'].includes(data.sub_role)) {
                delete data.study_program_id;
                if (data.department_id) data.department_id = parseInt(data.department_id);
            }
        } else if (data.role === 'mahasiswa') {
            delete data.department_id;
            if (!data.study_program_id) {
                showError('Program Studi wajib dipilih untuk Mahasiswa');
                return; // Prevent form submission
            }
            data.study_program_id = parseInt(data.study_program_id);
        } else {
            delete data.study_program_id;
            delete data.department_id;
        }

        const assignedTasks = Array.from(form.querySelectorAll('input[name="assigned_tasks"]:checked')).map((cb: any) => cb.value);
        if (data.role === 'tendik') {
            if (['kepala_lab', 'laboran'].includes(data.tendik_role)) {
                if (!data.laboratory_id) {
                    showError('Pilihan laboratorium tidak valid. Data laboratorium belum tersedia.');
                    return; // Prevent form submission
                }
            }

            if (data.tendik_role === 'persuratan') {
                data.assigned_tasks = assignedTasks;
            } else {
                delete data.assigned_tasks; // Only Persuratan has these tasks
            }

            if (!['kepala_lab', 'laboran'].includes(data.tendik_role)) {
                delete data.laboratory_id;
            }
        } else {
            delete data.assigned_tasks;
            delete data.tendik_role;
            delete data.laboratory_id;
        }

        // Handle role_level: only for super_admin
        if (data.role !== 'super_admin') {
            delete data.role_level;
        }

        if (!user && data.role === 'mahasiswa') {
            const nim = (data.nim as string || '').replace(/[^a-zA-Z0-9]/g, '');
            const dobParts = (data.tanggal_lahir as string || '').split('-');
            const dobFormatted = dobParts.length === 3 ? `${dobParts[2]}${dobParts[1]}${dobParts[0]}` : '';
            data.password = `${nim}${dobFormatted}`;
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

export function renderExportDrawer() {
    const container = getOrCreateDrawerRoot();
    container.innerHTML = `
        <div class="drawer-overlay fixed inset-0 bg-black/40 z-[200]" style="opacity:0; transition: opacity 0.3s ease;"></div>
        <div class="drawer-panel fixed top-0 right-0 h-full w-[420px] bg-white z-[201] flex flex-col shadow-2xl" style="transform: translateX(100%); transition: transform 0.3s ease;">
            <div class="flex items-start justify-between px-7 pt-8 pb-4">
                <div>
                    <h2 class="text-xl font-bold text-gray-900">Ekspor Data Pengguna</h2>
                    <p class="text-sm text-gray-500 mt-1">Unduh data pengguna dalam format file</p>
                </div>
                <button id="close-export-drawer" class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="flex-1 overflow-y-auto px-7 py-4 space-y-5">
                <div class="space-y-1.5">
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Jenis Pengguna</label>
                    <div class="relative">
                        <select id="export-user-type" class="w-full appearance-none px-4 py-2.5 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 bg-white text-gray-700 cursor-pointer">
                            <option value="">Semua Pengguna</option>
                            <option value="mahasiswa">Mahasiswa</option>
                            <option value="tendik">Tendik</option>
                            <option value="akademik">Akademik</option>
                        </select>
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </span>
                    </div>
                </div>
                <div class="space-y-1.5">
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Format File</label>
                    <div class="relative">
                        <select id="export-format" class="w-full appearance-none px-4 py-2.5 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 bg-white text-gray-700 cursor-pointer">
                            <option value="xlsx">Excel (.xlsx)</option>
                            <option id="opt-csv" value="csv">CSV (.csv)</option>
                        </select>
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </span>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Kolom yang Diekspor</p>
                    <p class="text-xs text-gray-500 leading-relaxed">Nama, Email, NIM, Kode Prodi, Tanggal Lahir, Program Studi, Departemen, Fakultas, Angkatan, Role, Status, Dibuat Pada</p>
                </div>
            </div>
            <div class="border-t border-gray-100 px-7 py-5 flex items-center justify-end gap-3">
                <button id="cancel-export-btn" class="px-5 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all">Batal</button>
                <button id="confirm-export-btn" class="px-5 py-2.5 text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-all shadow-sm flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Ekspor
                </button>
            </div>
        </div>
    `;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const overlay = container.querySelector('.drawer-overlay') as HTMLElement;
            const panel = container.querySelector('.drawer-panel') as HTMLElement;
            if (overlay) overlay.style.opacity = '1';
            if (panel) panel.style.transform = 'translateX(0)';
        });
    });

    container.querySelector('.drawer-overlay')?.addEventListener('click', closeDrawer);
    container.querySelector('#close-export-drawer')?.addEventListener('click', closeDrawer);
    container.querySelector('#cancel-export-btn')?.addEventListener('click', closeDrawer);

    const userTypeSelect = container.querySelector('#export-user-type') as HTMLSelectElement;
    const formatSelect = container.querySelector('#export-format') as HTMLSelectElement;
    const optCsv = container.querySelector('#opt-csv') as HTMLOptionElement;

    const updateFormatOptions = () => {
        if (userTypeSelect.value === '') {
            optCsv.disabled = true;
            if (formatSelect.value === 'csv') formatSelect.value = 'xlsx';
        } else {
            optCsv.disabled = false;
        }
    };

    userTypeSelect?.addEventListener('change', () => {
        updateFormatOptions();
        if (userTypeSelect.value === '') {
            showInfo('Multi-sheet hanya tersedia dalam format Excel');
        }
    });

    updateFormatOptions();

    container.querySelector('#confirm-export-btn')?.addEventListener('click', async () => {
        const format = (container.querySelector('#export-format') as HTMLSelectElement)?.value || 'xlsx';
        const userType = (container.querySelector('#export-user-type') as HTMLSelectElement)?.value || '';
        const url = `/api/super-admin/users/export?format=${format}${userType ? '&role=' + userType : ''}`;

        const btn = container.querySelector('#confirm-export-btn') as HTMLButtonElement;
        const originalText = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = 'Memproses...';

            const response = await apiFetch(url);

            if (!response.ok) throw new Error(`Export failed with status ${response.status}`);

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `users_export_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 500);

            showSuccess('Data berhasil diunduh');
            closeDrawer();
        } catch (error: any) {
            console.error(error);
            showError(`Gagal mengunduh data: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

export function renderImportDrawer(onRefresh: () => void) {
    const container = getOrCreateDrawerRoot();
    let fileHash = '';
    let cachedInvalidRows: any[] = [];
    let selectedFile: File | null = null;

    container.innerHTML = `
        <div class="drawer-overlay fixed inset-0 bg-black/40 z-[200]" style="opacity:0; transition: opacity 0.3s ease;"></div>
        <div class="drawer-panel fixed top-0 right-0 h-full w-[480px] bg-white z-[201] flex flex-col shadow-2xl" style="transform: translateX(100%); transition: transform 0.3s ease;">
            <div class="flex items-start justify-between px-7 pt-8 pb-4">
                <div>
                    <h2 class="text-xl font-bold text-gray-900">Impor Data Mahasiswa</h2>
                    <p class="text-sm text-gray-500 mt-1">Unggah file CSV untuk menambah atau memperbarui data</p>
                </div>
                <button id="close-import-drawer" class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div id="import-step-upload" class="flex-1 overflow-y-auto px-7 py-4 space-y-5">
                <div class="space-y-2">
                    <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Template</p>
                    <p class="text-xs text-gray-400">Unduh template CSV untuk memastikan format sesuai sistem</p>
                    <button id="download-template-btn" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-teal-700 text-teal-700 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Unduh Template (.csv)
                    </button>
                </div>
                <hr class="border-gray-100">
                <div class="space-y-2">
                    <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Unggah File</p>
                    <div id="drop-zone" class="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-300"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <p class="text-sm font-medium text-gray-500">Seret file atau klik untuk mengunggah</p>
                        <p class="text-[10px] text-gray-400">Format: .CSV • Maks 2MB</p>
                        <input type="file" id="import-file-input" accept=".csv" class="hidden">
                    </div>
                    <div id="file-preview" class="hidden bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-teal-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            </div>
                            <div class="min-w-0">
                                <p id="file-name" class="text-sm font-medium text-gray-700 truncate"></p>
                                <p id="file-size" class="text-[10px] text-gray-400"></p>
                            </div>
                        </div>
                        <button id="remove-file-btn" class="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Kolom Template</p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-md">name*</span>
                        <span class="text-[10px] bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-md">email*</span>
                        <span class="text-[10px] bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-md">nim*</span>
                        <span class="text-[10px] bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-md">study_program_code*</span>
                        <span class="text-[10px] bg-gray-200 text-gray-600 font-semibold px-2 py-0.5 rounded-md">tanggal_lahir</span>
                    </div>
                    <p class="text-[10px] text-gray-400">* = wajib</p>
                </div>
            </div>
            <div id="import-step-preview" class="flex-1 overflow-y-auto px-7 py-4 space-y-4 hidden">
                <div id="preview-summary" class="space-y-3"></div>
                <div id="preview-errors" class="space-y-2"></div>
            </div>
            <div class="border-t border-gray-100 px-7 py-5 flex items-center justify-end gap-3">
                <button id="cancel-import-btn" class="px-5 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all">Batal</button>
                <button id="validate-import-btn" class="px-5 py-2.5 text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled>Validasi</button>
                <button id="confirm-import-btn" class="hidden px-5 py-2.5 text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Konfirmasi Impor</button>
                <button id="back-import-btn" class="hidden px-5 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all">Kembali</button>
            </div>
        </div>
    `;

    requestAnimationFrame(() => { requestAnimationFrame(() => {
        const overlay = container.querySelector('.drawer-overlay') as HTMLElement;
        const panel = container.querySelector('.drawer-panel') as HTMLElement;
        if (overlay) overlay.style.opacity = '1';
        if (panel) panel.style.transform = 'translateX(0)';
    }); });

    container.querySelector('.drawer-overlay')?.addEventListener('click', closeDrawer);
    container.querySelector('#close-import-drawer')?.addEventListener('click', closeDrawer);
    container.querySelector('#cancel-import-btn')?.addEventListener('click', closeDrawer);

    container.querySelector('#download-template-btn')?.addEventListener('click', async () => {
        try {
            const res = await apiFetch('/api/super-admin/users/import-template');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'template_import_mahasiswa.csv'; a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) { console.error(err); }
    });

    const dropZone = container.querySelector('#drop-zone')!;
    const fileInput = container.querySelector('#import-file-input') as HTMLInputElement;
    const filePreview = container.querySelector('#file-preview') as HTMLElement;
    const fileNameEl = container.querySelector('#file-name') as HTMLElement;
    const fileSizeEl = container.querySelector('#file-size') as HTMLElement;
    const validateBtn = container.querySelector('#validate-import-btn') as HTMLButtonElement;

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const showFilePreview = (file: File) => {
        selectedFile = file;
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = formatFileSize(file.size);
        filePreview.classList.remove('hidden');
        dropZone.classList.add('hidden');
        validateBtn.disabled = false;
    };

    const clearFile = () => {
        selectedFile = null;
        fileInput.value = '';
        filePreview.classList.add('hidden');
        dropZone.classList.remove('hidden');
        validateBtn.disabled = true;
    };

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files?.[0]) showFilePreview(fileInput.files[0]); });
    container.querySelector('#remove-file-btn')?.addEventListener('click', clearFile);

    // Drag-and-drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-teal-400', 'bg-teal-50/50'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-teal-400', 'bg-teal-50/50'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-teal-400', 'bg-teal-50/50');
        const file = (e as DragEvent).dataTransfer?.files?.[0];
        if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
            showFilePreview(file);
        } else {
            showError('Hanya file CSV yang didukung');
        }
    });

    const stepUpload = container.querySelector('#import-step-upload') as HTMLElement;
    const stepPreview = container.querySelector('#import-step-preview') as HTMLElement;
    const confirmBtn = container.querySelector('#confirm-import-btn') as HTMLButtonElement;
    const backBtn = container.querySelector('#back-import-btn') as HTMLButtonElement;
    const cancelBtn = container.querySelector('#cancel-import-btn') as HTMLButtonElement;
    const previewSummary = container.querySelector('#preview-summary') as HTMLElement;
    const previewErrors = container.querySelector('#preview-errors') as HTMLElement;

    const showPreview = () => { stepUpload.classList.add('hidden'); stepPreview.classList.remove('hidden'); validateBtn.classList.add('hidden'); cancelBtn.classList.add('hidden'); confirmBtn.classList.remove('hidden'); backBtn.classList.remove('hidden'); };
    const showUpload = () => { stepPreview.classList.add('hidden'); stepUpload.classList.remove('hidden'); validateBtn.classList.remove('hidden'); cancelBtn.classList.remove('hidden'); confirmBtn.classList.add('hidden'); backBtn.classList.add('hidden'); };
    backBtn.addEventListener('click', showUpload);

    const downloadErrorCsv = async () => {
        if (cachedInvalidRows.length === 0) return;
        try {
            const res = await apiFetch('/api/super-admin/users/import-errors', { method: 'POST', body: JSON.stringify({ invalid_rows: cachedInvalidRows }) });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `import_errors_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) { console.error(err); }
    };

    validateBtn.addEventListener('click', async () => {
        if (!selectedFile) { showError('Pilih file CSV terlebih dahulu'); return; }
        validateBtn.disabled = true; validateBtn.innerHTML = 'Memvalidasi...';
        const formData = new FormData(); formData.append('file', selectedFile);
        try {
            const response = await apiFetch('/api/super-admin/users/validate-import', { method: 'POST', body: formData, isFormData: true });
            const result = await response.json();
            if (!response.ok) { showError(result.message || 'Validasi gagal'); validateBtn.disabled = false; validateBtn.innerHTML = 'Validasi'; return; }

            fileHash = result.file_hash || '';
            cachedInvalidRows = result.invalid_rows || [];
            const { summary, invalid_rows } = result;

            previewSummary.innerHTML = `<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">Hasil Validasi</h3>
                <div class="grid grid-cols-3 gap-3">
                    <div class="bg-gray-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-gray-800">${summary.total}</p><p class="text-[10px] text-gray-500 uppercase font-semibold mt-1">Total</p></div>
                    <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-emerald-600">${summary.valid}</p><p class="text-[10px] text-emerald-600 uppercase font-semibold mt-1">Valid</p></div>
                    <div class="bg-red-50 border border-red-100 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-red-500">${summary.invalid}</p><p class="text-[10px] text-red-500 uppercase font-semibold mt-1">Invalid</p></div>
                </div>`;

            if (invalid_rows.length > 0) {
                previewErrors.innerHTML = `<div class="flex items-center justify-between"><h4 class="text-xs font-bold text-red-600 uppercase tracking-wider">Detail Error</h4><button id="download-error-csv" class="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 hover:underline"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Unduh Laporan</button></div>
                    <div class="max-h-[280px] overflow-y-auto space-y-2 pr-1">${invalid_rows.map((r: any) => `<div class="bg-red-50 border border-red-100 rounded-xl p-3"><div class="flex items-center justify-between mb-1"><span class="text-xs font-bold text-red-700">Baris ${r.row}</span><span class="text-[10px] text-red-400 font-mono">${r.data?.email || '-'}</span></div><ul class="space-y-0.5">${r.errors.map((e: string) => `<li class="text-[11px] text-red-600 flex items-start gap-1.5"><span class="text-red-400 mt-0.5">•</span> ${e}</li>`).join('')}</ul></div>`).join('')}</div>`;
                container.querySelector('#download-error-csv')?.addEventListener('click', downloadErrorCsv);
            } else {
                previewErrors.innerHTML = `<div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-500 shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><p class="text-sm text-emerald-700 font-medium">Semua baris valid dan siap diimpor.</p></div>`;
            }

            confirmBtn.disabled = summary.valid === 0;
            confirmBtn.textContent = summary.valid > 0 ? `Konfirmasi Impor (${summary.valid} baris)` : 'Tidak ada data valid';
            showPreview();
        } catch (err) { console.error(err); showError('Gagal menghubungi server'); } finally { validateBtn.disabled = !selectedFile; validateBtn.innerHTML = 'Validasi'; }
    });

    confirmBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        confirmBtn.disabled = true; confirmBtn.innerHTML = 'Mengimpor...';
        const formData = new FormData(); formData.append('file', selectedFile);
        if (fileHash) formData.append('file_hash', fileHash);
        try {
            const response = await apiFetch('/api/super-admin/users/bulk-import', { method: 'POST', body: formData, isFormData: true });
            const result = await response.json();
            if (response.ok) {
                const msg = `Berhasil: ${result.summary.success} mahasiswa diimpor` + (result.summary.failed > 0 ? `, ${result.summary.failed} gagal` : '');
                showSuccess(msg);
                closeDrawer(); onRefresh();
            } else { showError(result.message || 'Import gagal'); confirmBtn.disabled = false; confirmBtn.innerHTML = 'Konfirmasi Impor'; }
        } catch (err) { console.error(err); showError('Gagal menghubungi server'); confirmBtn.disabled = false; confirmBtn.innerHTML = 'Konfirmasi Impor'; }
    });
}

