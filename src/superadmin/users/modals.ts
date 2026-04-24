import Toastify from 'toastify-js';
import { state } from './types';

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
                            <option value="mahasiswa" ${user?.role === 'mahasiswa' ? 'selected' : ''}>Mahasiswa</option>
                            <option value="tendik" ${user?.role === 'tendik' ? 'selected' : ''}>Tenaga Pendidik (Tendik)</option>
                            <option value="akademik" ${user?.role === 'akademik' ? 'selected' : ''}>Akademik</option>
                            <option value="super_admin" ${user?.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
                        </select>
                    </div>
                    <div id="sub-role-container" class="${user?.role === 'akademik' ? '' : 'hidden'}">
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipe Jabatan Akademik</label>
                        <select name="sub_role" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            <option value="" ${!user?.sub_role ? 'selected' : ''}>Pilih Jabatan...</option>
                            <option value="kadep" ${user?.sub_role === 'kadep' ? 'selected' : ''}>Ketua Departemen (Kadep)</option>
                            <option value="kaprodi" ${user?.sub_role === 'kaprodi' ? 'selected' : ''}>Ketua Program Studi (Kaprodi)</option>
                            <option value="sekdep" ${user?.sub_role === 'sekdep' ? 'selected' : ''}>Sekretaris Departemen (Sekdep)</option>
                            <option value="sekprodi" ${user?.sub_role === 'sekprodi' ? 'selected' : ''}>Sekretaris Program Studi (Sekprodi)</option>
                        </select>
                    </div>

                    <div id="prodi-selection-container" class="hidden">
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Program Studi</label>
                        <select name="program_studi_pimpinan" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            <option value="">Pilih Program Studi...</option>
                            <option value="Teknologi Rekayasa Elektro" ${user?.program_studi === 'Teknologi Rekayasa Elektro' ? 'selected' : ''}>Teknologi Rekayasa Elektro</option>
                            <option value="Teknologi Rekayasa Perangkat Lunak" ${user?.program_studi === 'Teknologi Rekayasa Perangkat Lunak' ? 'selected' : ''}>Teknologi Rekayasa Perangkat Lunak</option>
                            <option value="Teknologi Rekayasa Internet" ${user?.program_studi === 'Teknologi Rekayasa Internet' ? 'selected' : ''}>Teknologi Rekayasa Internet</option>
                            <option value="Teknologi Rekayasa Instrumen Kontrol" ${user?.program_studi === 'Teknologi Rekayasa Instrumen Kontrol' ? 'selected' : ''}>Teknologi Rekayasa Instrumen Kontrol</option>
                        </select>
                    </div>

                    <!-- Mahasiswa Fields -->
                    <div id="mahasiswa-fields" class="${user?.role === 'mahasiswa' || (!user && state.activeTab === 'mahasiswa') ? '' : 'hidden'} space-y-4 pt-2 border-t border-gray-50">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">NIM</label>
                                <input type="text" name="nim" value="${user?.mahasiswa_profile?.nim || ''}" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all" placeholder="Contoh: 21/123...">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tgl Lahir</label>
                                <input type="date" name="tanggal_lahir" value="${user?.mahasiswa_profile?.tanggal_lahir || ''}" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                            </div>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fakultas</label>
                            <input type="text" name="fakultas" value="${user?.mahasiswa_profile?.fakultas || ''}" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Program Studi</label>
                            <input type="text" name="program_studi" value="${user?.mahasiswa_profile?.program_studi || ''}" class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                        </div>
                    </div>

                    <!-- Tendik Fields -->
                    <div id="tendik-fields" class="${user?.role === 'tendik' ? '' : 'hidden'} space-y-4 pt-2 border-t border-gray-50">
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Penugasan Verifikasi Dokumen</label>
                        <div class="grid grid-cols-1 gap-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            ${[
            'Surat Keterangan Aktif',
            'Surat Pengantar Magang',
            'Surat Permohonan Beasiswa',
            'Surat Keterangan Lulus',
            'Surat Permohonan Cuti',
            'Surat Keterangan Pengganti KTM',
            'Surat Rekomendasi',
            'Surat Bebas Pustaka'
        ].map(task => `
                                <label class="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" name="assigned_tasks" value="${task}" ${user?.assigned_tasks?.includes(task) ? 'checked' : ''} class="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500">
                                    <span class="text-xs text-gray-600 group-hover:text-teal-700 transition-colors">${task}</span>
                                </label>
                            `).join('')}
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

                    <div class="pt-4">
                        <button type="submit" class="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm">
                            ${user ? 'Simpan Perubahan' : 'Buat Akun'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const roleSelect = document.getElementById('modal-role-select') as HTMLSelectElement;
    const mhsFields = document.getElementById('mahasiswa-fields')!;
    const tendikFields = document.getElementById('tendik-fields')!;
    const passInput = document.getElementById('modal-password-input') as HTMLInputElement;
    const passHint = document.getElementById('password-hint')!;

    const updateVisibility = () => {
        const isMhs = roleSelect.value === 'mahasiswa';
        const isTendik = roleSelect.value === 'tendik';
        const isAkademik = roleSelect.value === 'akademik';

        mhsFields.classList.toggle('hidden', !isMhs);
        tendikFields.classList.toggle('hidden', !isTendik);
        document.getElementById('sub-role-container')?.classList.toggle('hidden', !isAkademik);

        // Prodi selection visibility
        const subRoleSelect = document.querySelector('select[name="sub_role"]') as HTMLSelectElement;
        const prodiContainer = document.getElementById('prodi-selection-container');
        if (prodiContainer && subRoleSelect) {
            const isProdiRequired = ['kaprodi', 'sekprodi'].includes(subRoleSelect.value);
            prodiContainer.classList.toggle('hidden', !isProdiRequired);
        }

        // Show generate button only for tendik and akademik
        const genBtn = document.getElementById('generate-password-btn');
        if (genBtn) {
            genBtn.classList.toggle('hidden', !(isTendik || isAkademik));
        }

        if (!user) {
            if (isMhs) {
                passInput.readOnly = true;
                passInput.placeholder = 'Auto-generated';
                passHint.classList.remove('hidden');
            } else {
                passInput.readOnly = false;
                passInput.placeholder = '••••••••';
                passHint.classList.add('hidden');
            }
        }
    };

    roleSelect.addEventListener('change', updateVisibility);
    document.querySelector('select[name="sub_role"]')?.addEventListener('change', updateVisibility);
    updateVisibility();

    document.getElementById('close-modal')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
    });

    // Toggle Password Visibility
    document.getElementById('toggle-password-btn')?.addEventListener('click', () => {
        const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passInput.setAttribute('type', type);
        const btn = document.getElementById('toggle-password-btn')!;
        if (type === 'text') {
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
    });

    // Generate Password
    document.getElementById('generate-password-btn')?.addEventListener('click', () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        passInput.value = password;
        passInput.setAttribute('type', 'text');
        const toggleBtn = document.getElementById('toggle-password-btn')!;
        toggleBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    });

    const form = document.getElementById('user-form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data: any = Object.fromEntries(formData.entries());

        // Handle Program Studi for Pimpinan
        if (data.program_studi_pimpinan) {
            data.program_studi = data.program_studi_pimpinan;
            delete data.program_studi_pimpinan;
        }

        const assignedTasks = Array.from(form.querySelectorAll('input[name="assigned_tasks"]:checked')).map((cb: any) => cb.value);
        if (data.role === 'tendik') {
            data.assigned_tasks = assignedTasks;
        } else {
            delete data.assigned_tasks;
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
            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (response.ok) {
                Toastify({ text: result.message, duration: 2000, style: { background: '#10B981' } }).showToast();
                modalContainer.innerHTML = '';
                onRefresh();
            } else {
                Toastify({ text: result.message || 'Gagal menyimpan akun', duration: 2000, style: { background: '#EF4444' } }).showToast();
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
                    <p class="text-sm text-gray-500 mt-1">Unduh data pengguna dari sistem dalam format file</p>
                </div>
                <button id="close-export-drawer" class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="flex-1 overflow-y-auto px-7 py-4 space-y-6">
                <div class="space-y-2">
                    <label class="block text-sm font-semibold text-gray-700">Jenis Pengguna</label>
                    <div class="relative">
                        <select id="export-user-type" class="w-full appearance-none px-4 py-2.5 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-700">
                            <option value="">Semua Pengguna</option>
                            <option value="tendik">Tendik</option>
                            <option value="akademik">Akademik</option>
                            <option value="mahasiswa">Mahasiswa</option>
                        </select>
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </span>
                    </div>
                </div>
                <div class="space-y-2">
                    <label class="block text-sm font-semibold text-gray-700">Format File</label>
                    <div class="relative">
                        <select id="export-format" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all cursor-pointer">
                            <option value="xlsx">Excel (.xlsx)</option>
                            <option id="opt-csv" value="csv">CSV (.csv)</option>
                        </select>
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </span>
                    </div>
                </div>
            </div>
            <div class="border-t border-gray-100 px-7 py-5 flex items-center justify-end gap-3">
                <button id="cancel-export-btn" class="px-5 py-2 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all">Batal</button>
                <button id="confirm-export-btn" class="px-5 py-2 text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-all shadow-sm">Ekspor</button>
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
    document.getElementById('close-export-drawer')?.addEventListener('click', closeDrawer);
    document.getElementById('cancel-export-btn')?.addEventListener('click', closeDrawer);

    const userTypeSelect = document.getElementById('export-user-type') as HTMLSelectElement;
    const formatSelect = document.getElementById('export-format') as HTMLSelectElement;
    const optCsv = document.getElementById('opt-csv') as HTMLOptionElement;

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
            Toastify({ text: 'Multi-sheet hanya tersedia dalam format Excel', duration: 3000, style: { background: '#3B82F6' } }).showToast();
        }
    });

    updateFormatOptions();

    document.getElementById('confirm-export-btn')?.addEventListener('click', async () => {
        const format = (document.getElementById('export-format') as HTMLSelectElement)?.value || 'xlsx';
        const userType = (document.getElementById('export-user-type') as HTMLSelectElement)?.value || '';
        const url = `/api/super-admin/users/export?format=${format}${userType ? '&role=' + userType : ''}`;

        const btn = document.getElementById('confirm-export-btn') as HTMLButtonElement;
        const originalText = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = 'Memproses...';

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });

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

            Toastify({ text: 'Data berhasil diunduh', duration: 3000, style: { background: '#10B981' } }).showToast();
            closeDrawer();
        } catch (error: any) {
            console.error(error);
            Toastify({ text: `Gagal mengunduh data: ${error.message}`, duration: 4000, style: { background: '#EF4444' } }).showToast();
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

export function renderImportDrawer(onRefresh: () => void) {
    const container = getOrCreateDrawerRoot();
    container.innerHTML = `
        <div class="drawer-overlay fixed inset-0 bg-black/40 z-[200]" style="opacity:0; transition: opacity 0.3s ease;"></div>
        <div class="drawer-panel fixed top-0 right-0 h-full w-[420px] bg-white z-[201] flex flex-col shadow-2xl" style="transform: translateX(100%); transition: transform 0.3s ease;">
            <div class="flex items-start justify-between px-7 pt-8 pb-4">
                <div>
                    <h2 class="text-xl font-bold text-gray-900">Impor Data Pengguna</h2>
                    <p class="text-sm text-gray-500 mt-1">Unggah file untuk menambahkan data secara massal</p>
                </div>
                <button id="close-import-drawer" class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="flex-1 overflow-y-auto px-7 py-4 space-y-6">
                <button id="download-template-btn" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-teal-700 text-teal-700 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-all">
                    Unduh Template
                </button>
                <div id="drop-zone" class="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all">
                    <p id="drop-zone-text" class="text-sm font-medium text-gray-600">Seret file atau klik untuk mengunggah</p>
                    <input type="file" id="import-file-input" accept=".csv,.xlsx" class="hidden">
                </div>
            </div>
            <div class="border-t border-gray-100 px-7 py-5 flex items-center justify-end gap-3">
                <button id="cancel-import-btn" class="px-5 py-2 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all">Batal</button>
                <button id="confirm-import-btn" class="px-5 py-2 text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-all shadow-sm">Impor</button>
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
    document.getElementById('close-import-drawer')?.addEventListener('click', closeDrawer);
    document.getElementById('cancel-import-btn')?.addEventListener('click', closeDrawer);

    document.getElementById('download-template-btn')?.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/super-admin/users/import-template', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'template_import_users.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) { console.error(err); }
    });

    const dropZone = document.getElementById('drop-zone')!;
    const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
    const dropText = document.getElementById('drop-zone-text')!;
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files?.[0]) dropText.textContent = fileInput.files[0].name; });

    document.getElementById('confirm-import-btn')?.addEventListener('click', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch('/api/super-admin/users/bulk-import', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
                body: formData
            });
            if (response.ok) {
                Toastify({ text: 'Impor berhasil', duration: 2500, style: { background: '#10B981' } }).showToast();
                closeDrawer();
                onRefresh();
            }
        } catch (err) { console.error(err); }
    });
}
