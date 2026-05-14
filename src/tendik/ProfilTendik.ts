import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import Toastify from 'toastify-js';
import { renderLogin } from '../login/Login';
import { apiFetch } from '../shared/api-client';

let isEditingData = false;
let isEditingPassword = false;

export const renderProfilTendik = (role: string) => {
    // Hide standard layout header
    const styleBlock = `
        <style>
            header { display: none !important; }
        </style>
    `;

    const userName = localStorage.getItem('auth_name') || 'Fajar';
    const email = 'fajar@mail.ugm.ac.id'; // Dummy or from API

    const renderDataFields = () => {
        const inputClass = isEditingData 
            ? "w-full bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
            : "w-full bg-[#E5E7EB]/50 border border-transparent px-4 py-2 rounded-lg text-sm text-gray-500 font-medium cursor-default focus:outline-none";
            
        const disabledClass = "w-full bg-[#E5E7EB]/50 border border-transparent px-4 py-2 rounded-lg text-sm text-gray-400 font-medium cursor-not-allowed";

        return `
            <div class="space-y-4 max-w-3xl">
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Nama Lengkap</label>
                    <input type="text" value="${userName}" class="${inputClass}" ${!isEditingData ? 'readonly' : ''}>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Email</label>
                    <input type="email" value="${email}" class="${inputClass}" ${!isEditingData ? 'readonly' : ''}>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Telepon</label>
                    <input type="text" value="081299995555" class="${inputClass}" ${!isEditingData ? 'readonly' : ''}>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Unit Kerja</label>
                    <input type="text" value="Sekolah Vokasi" class="${inputClass}" ${!isEditingData ? 'readonly' : ''}>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Departemen</label>
                    <input type="text" value="Teknik Elektro dan Informatika" class="${inputClass}" ${!isEditingData ? 'readonly' : ''}>
                </div>
                <div class="flex flex-col md:flex-row gap-2 md:gap-4 mt-2">
                    <label class="w-40 text-sm font-semibold text-gray-600 pt-2">Tugas</label>
                    <div class="flex-1 space-y-2">
                        <input type="text" value="Surat Rekomendasi Magang" class="${disabledClass}" readonly>
                        <input type="text" value="Surat Permohonan Beasiswa" class="${disabledClass}" readonly>
                        <input type="text" value="Surat Keaktifan Mahasiswa" class="${disabledClass}" readonly>
                        <p class="text-[10px] text-gray-700 font-bold mt-1">Tugas ditentukan oleh Super Admin</p>
                    </div>
                </div>
                ${isEditingData ? `
                    <div class="flex justify-end gap-3 mt-6 pt-4">
                        <button id="cancel-data-btn" class="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">Batal</button>
                        <button id="save-data-btn" class="px-5 py-2 rounded-lg bg-teal-800 text-white font-semibold text-sm shadow-sm hover:bg-teal-900 transition-colors">Simpan Perubahan</button>
                    </div>
                ` : ''}
            </div>
        `;
    };

    const renderPasswordFields = () => {
        if (!isEditingPassword) {
            return `
                <div class="flex justify-between items-center max-w-3xl">
                    <p class="text-sm text-gray-500">Kata sandi Anda dilindungi dan dienkripsi.</p>
                </div>
            `;
        }
        
        const inputContainerClass = "relative flex-1";
        const passInputClass = "w-full bg-white border border-gray-200 px-10 py-2.5 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all";
        const lockIcon = `<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>`;
        const eyeIcon = `<button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>`;

        return `
            <div class="space-y-4 max-w-3xl">
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Kata Sandi Saat Ini</label>
                    <div class="${inputContainerClass}">
                        ${lockIcon}
                        <input type="password" placeholder="Masukkan kata sandi" class="${passInputClass}">
                        ${eyeIcon}
                    </div>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Kata Sandi Baru</label>
                    <div class="${inputContainerClass}">
                        ${lockIcon}
                        <input type="password" placeholder="Masukkan kata sandi" class="${passInputClass}">
                        ${eyeIcon}
                    </div>
                </div>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <label class="w-40 text-sm font-semibold text-gray-600">Konfirmasi Kata Sandi Baru</label>
                    <div class="${inputContainerClass}">
                        ${lockIcon}
                        <input type="password" placeholder="Masukkan kata sandi" class="${passInputClass}">
                        ${eyeIcon}
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-6 pt-4">
                    <button id="cancel-pwd-btn" class="px-5 py-2 rounded-lg border-2 border-teal-800 text-teal-800 font-bold text-sm hover:bg-teal-50 transition-colors">Batal</button>
                    <button id="save-pwd-btn" class="px-5 py-2 rounded-lg bg-teal-800 text-white font-bold text-sm shadow-sm hover:bg-teal-900 transition-colors">Ganti Kata Sandi</button>
                </div>
            </div>
        `;
    };

    const updateUI = () => {
        const dataContainer = document.getElementById('data-form-container');
        if (dataContainer) dataContainer.innerHTML = renderDataFields();
        
        const pwdContainer = document.getElementById('pwd-form-container');
        if (pwdContainer) pwdContainer.innerHTML = renderPasswordFields();

        const dataEditBtn = document.getElementById('edit-data-btn');
        if (dataEditBtn) {
            dataEditBtn.style.display = isEditingData ? 'none' : 'block';
        }
        
        const pwdEditBtn = document.getElementById('edit-pwd-btn');
        if (pwdEditBtn) {
            pwdEditBtn.style.display = isEditingPassword ? 'none' : 'block';
        }

        attachDynamicListeners();
    };

    const content = `
        ${styleBlock}
        <div class="w-full max-w-5xl mx-auto py-8">
            <!-- Custom Header -->
            <div class="flex justify-between items-center mb-8">
                <div class="flex items-center gap-3 cursor-pointer text-gray-800 hover:text-teal-800 transition-colors" id="back-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    <h1 class="text-3xl font-bold">Profil Saya</h1>
                </div>
                <button id="logout-btn-profil" class="flex items-center gap-2 bg-[#EF4444] hover:bg-red-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Keluar
                </button>
            </div>

            <!-- Top Cards -->
            <div class="flex flex-col lg:flex-row gap-6 mb-6">
                <!-- Profile Avatar Card -->
                <div class="bg-white rounded-[20px] p-8 flex flex-col items-center justify-center border border-gray-100 shadow-sm w-full lg:w-1/3">
                    <div class="w-24 h-24 rounded-full border-4 border-gray-100 flex items-center justify-center mb-4 text-gray-700 bg-gray-50 overflow-hidden">
                        <!-- Icon avatar / placeholder -->
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 mb-1">Anang</h3>
                    <p class="text-sm text-gray-500 mb-3">anang@mail.ugm.ac.id</p>
                    <span class="bg-[#ECFDF5] text-[#059669] text-[11px] font-bold px-4 py-1.5 rounded-full border border-green-100">Aktif</span>
                </div>

                <!-- Info Cards -->
                <div class="flex-1 flex flex-col gap-4">
                    <div class="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p class="text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Role</p>
                        <p class="text-sm font-semibold text-gray-800">Tenaga Pendidik</p>
                    </div>
                    <div class="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p class="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Task</p>
                        <div class="flex flex-wrap gap-2">
                            <span class="bg-[#FEF08A]/60 text-yellow-800 text-[10px] font-bold px-3 py-1.5 rounded-full">Surat Magang</span>
                            <span class="bg-[#FEF08A]/60 text-yellow-800 text-[10px] font-bold px-3 py-1.5 rounded-full">Surat Beasiswa</span>
                            <span class="bg-[#FEF08A]/60 text-yellow-800 text-[10px] font-bold px-3 py-1.5 rounded-full">Surat Keaktifan</span>
                        </div>
                    </div>
                    <div class="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p class="text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Bergabung Sejak</p>
                        <p class="text-sm font-semibold text-gray-800">2026</p>
                    </div>
                </div>
            </div>

            <!-- Informasi Data Diri -->
            <div class="bg-white rounded-[20px] p-8 border border-gray-100 shadow-sm mb-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold text-gray-800">Informasi Data Diri</h3>
                    <button id="edit-data-btn" class="text-teal-700 font-bold text-sm hover:text-teal-900 transition-colors">Edit</button>
                </div>
                <div id="data-form-container">
                    ${renderDataFields()}
                </div>
            </div>

            <!-- Keamanan Akun -->
            <div class="bg-white rounded-[20px] p-8 border border-gray-100 shadow-sm mb-12">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold text-gray-800">Keamanan Akun</h3>
                    <button id="edit-pwd-btn" class="text-teal-700 font-bold text-sm hover:text-teal-900 transition-colors">Edit</button>
                </div>
                <div id="pwd-form-container">
                    ${renderPasswordFields()}
                </div>
            </div>

        </div>
    `;

    renderDashboardLayout('Profil Saya', content, role, 'dashboard');
    
    // Initial UI state apply
    updateUI();

    // Static event listeners
    document.getElementById('back-btn')?.addEventListener('click', () => {
        // Go back to dashboard
        import('../dashboard/TendikDashboard').then(({ renderTendikDashboard }) => {
            renderTendikDashboard(role);
        });
    });

    document.getElementById('logout-btn-profil')?.addEventListener('click', async () => {
        (window as any).clearDashboardInterval?.();
        const token = localStorage.getItem('auth_token');
        if (token) {
            try {
                await apiFetch('/api/logout', { method: 'POST' });
            } catch (e) {}
        }
        localStorage.clear();
        Toastify({ text: "Berhasil keluar!", duration: 2000, style: { background: "#10B981" } }).showToast();
        setTimeout(() => renderLogin(), 500);
    });

    document.getElementById('edit-data-btn')?.addEventListener('click', () => {
        isEditingData = true;
        updateUI();
    });

    document.getElementById('edit-pwd-btn')?.addEventListener('click', () => {
        isEditingPassword = true;
        updateUI();
    });

    function attachDynamicListeners() {
        document.getElementById('cancel-data-btn')?.addEventListener('click', () => {
            isEditingData = false;
            updateUI();
        });
        
        document.getElementById('save-data-btn')?.addEventListener('click', () => {
            Toastify({ text: "Data diri berhasil disimpan", duration: 2000, style: { background: "#10B981" } }).showToast();
            isEditingData = false;
            updateUI();
        });

        document.getElementById('cancel-pwd-btn')?.addEventListener('click', () => {
            isEditingPassword = false;
            updateUI();
        });
        
        document.getElementById('save-pwd-btn')?.addEventListener('click', () => {
            Toastify({ text: "Kata sandi berhasil diperbarui", duration: 2000, style: { background: "#10B981" } }).showToast();
            isEditingPassword = false;
            updateUI();
        });
    }
};
