import { renderProfilMahasiswa } from '../ProfilMahasiswa';

export const renderStep2Keluarga = (formData: any) => `
    <div class="animate-enter-right space-y-10 pb-8">
        <!-- Info Alert -->
        <div class="bg-teal-50 border border-teal-100 p-5 rounded-[20px] flex gap-4 items-start shadow-sm">
            <div class="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </div>
            <div class="flex-1">
                <h4 class="text-sm font-bold text-teal-800 mb-1">Data Terhubung dengan Profil</h4>
                <p class="text-xs text-teal-600/80 leading-relaxed mb-3">Data di bawah ini diambil otomatis dari profil Anda. Jika ada informasi yang sudah tidak sesuai atau ingin diubah, silakan perbarui melalui halaman Profil.</p>
                <button type="button" id="btn-go-to-profile" class="px-4 py-2 bg-teal-600 text-white text-[10px] font-bold rounded-lg hover:bg-teal-700 transition-all flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    PERBARUI PROFIL SAYA
                </button>
            </div>
        </div>

        <!-- Detail Profil -->
        <div class="space-y-6">
            <div class="border-b border-gray-300 pb-3">
                <h3 class="text-xl font-bold text-gray-800">Detail Profil</h3>
            </div>
            
            <div class="space-y-5">
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Tempat, Tanggal Lahir</label>
                    <p class="text-sm text-gray-600 font-medium">${formData.pob || '-'}, ${formData.dob || '-'}</p>
                </div>
                
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Jenis Kelamin</label>
                    <p class="text-sm text-gray-600 font-medium">${formData.gender || '-'}</p>
                </div>

                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Alamat Asal</label>
                    <p class="text-sm text-gray-600 font-medium leading-relaxed">${formData.origin_address || '-'}</p>
                </div>

                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Alamat di Yogyakarta</label>
                    <p class="text-sm text-gray-600 font-medium leading-relaxed">${formData.jogja_address || '-'}</p>
                </div>

                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">No. Telp</label>
                    <p class="text-sm text-gray-600 font-medium">${formData.phone || '-'}</p>
                </div>

                <div class="grid grid-cols-[200px_1fr] items-start gap-4">
                    <label class="text-sm font-bold text-gray-800 pt-2">Pas Foto 3x4</label>
                    <div class="space-y-3">
                        ${formData.pas_foto_path ? `
                            <div class="w-32 h-40 rounded-xl border-2 border-gray-100 overflow-hidden bg-gray-50 shadow-sm relative group">
                                <img src="${formData.pas_foto_path}" class="w-full h-full object-cover">
                                <div class="absolute inset-0 bg-black/40 opacity-100 transition-opacity flex items-center justify-center">
                                    <span class="text-[10px] text-white font-bold">Terunggah</span>
                                </div>
                            </div>
                        ` : '<p class="text-sm text-red-500 font-medium italic">Belum diunggah di profil</p>'}
                    </div>
                </div>
            </div>
        </div>

        <!-- Data Ayah -->
        <div class="space-y-6 pt-4">
            <div class="border-b border-gray-300 pb-2">
                <h3 class="text-lg font-bold text-gray-800">Data Ayah</h3>
            </div>
            <div class="space-y-4">
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Nama</label>
                    <p class="text-sm text-gray-700 font-bold">${formData.father_name || '-'}</p>
                </div>
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Pekerjaan</label>
                    <p class="text-sm text-gray-600 font-medium">${formData.father_job || '-'}</p>
                </div>
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Penghasilan</label>
                    <p class="text-sm text-gray-600 font-medium">
                        ${formData.father_income !== undefined && formData.father_income !== null && formData.father_income !== '' ? 
                          (['1','2','3','4','5'].includes(String(formData.father_income)) ? 
                            (formData.father_income == '1' ? 'Tidak Berpenghasilan' :
                            formData.father_income == '2' ? '< Rp 1.000.000' :
                            formData.father_income == '3' ? 'Rp 1.000.000 - Rp 3.000.000' :
                            formData.father_income == '4' ? 'Rp 3.000.000 - Rp 5.000.000' : '> Rp 5.000.000') : 
                            'Rp ' + Number(formData.father_income).toLocaleString('id-ID')) : '-'}
                    </p>
                </div>
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Status</label>
                    <p class="text-sm text-gray-600 font-medium">${formData.father_status || 'Hidup'}</p>
                </div>
            </div>
        </div>

        <!-- Data Ibu -->
        <div class="space-y-6 pt-4">
            <div class="border-b border-gray-300 pb-2">
                <h3 class="text-lg font-bold text-gray-800">Data Ibu</h3>
            </div>
            <div class="space-y-4">
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Nama</label>
                    <p class="text-sm text-gray-700 font-bold">${formData.mother_name || '-'}</p>
                </div>
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Pekerjaan</label>
                    <p class="text-sm text-gray-600 font-medium">${formData.mother_job || '-'}</p>
                </div>
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Penghasilan</label>
                    <p class="text-sm text-gray-600 font-medium">
                        ${formData.mother_income !== undefined && formData.mother_income !== null && formData.mother_income !== '' ? 
                          (['1','2','3','4','5'].includes(String(formData.mother_income)) ? 
                            (formData.mother_income == '1' ? 'Tidak Berpenghasilan' :
                            formData.mother_income == '2' ? '< Rp 1.000.000' :
                            formData.mother_income == '3' ? 'Rp 1.000.000 - Rp 3.000.000' :
                            formData.mother_income == '4' ? 'Rp 3.000.000 - Rp 5.000.000' : '> Rp 5.000.000') : 
                            'Rp ' + Number(formData.mother_income).toLocaleString('id-ID')) : '-'}
                    </p>
                </div>
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Status</label>
                    <p class="text-sm text-gray-600 font-medium">${formData.mother_status || 'Hidup'}</p>
                </div>
            </div>
        </div>

        <!-- Data Wali (opsional) -->
        <div class="space-y-6 pt-4 ${(formData.guardian_name) ? '' : 'hidden'}" id="wali_container_read">
            <div class="border-b border-gray-300 pb-2">
                <h3 class="text-lg font-bold text-gray-800">Data Wali</h3>
            </div>
            <div class="space-y-4">
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Nama</label>
                    <p class="text-sm text-gray-700 font-bold">${formData.guardian_name || '-'}</p>
                </div>
                <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                    <label class="text-sm font-bold text-gray-800">Pekerjaan</label>
                    <p class="text-sm text-gray-600 font-medium">${formData.guardian_job || '-'}</p>
                </div>
            </div>
        </div>

        <!-- Data Saudara Kandung -->
        <div class="space-y-6 pt-4">
            <div class="border-b border-gray-300 pb-2 flex justify-between items-end">
                <h3 class="text-lg font-bold text-gray-800">Data Saudara Kandung</h3>
            </div>
            <div id="siblings-container-read" class="space-y-6">
                ${formData.siblings && formData.siblings.length > 0 ? formData.siblings.map((s: any) => `
                    <div class="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                        <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">Nama</label>
                            <p class="text-sm text-gray-700 font-bold">${s.name || '-'}</p>
                        </div>
                        <div class="grid grid-cols-[200px_1fr] items-baseline gap-4">
                            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">Pekerjaan/Sekolah</label>
                            <p class="text-sm text-gray-600 font-medium">${s.job_or_school || '-'}</p>
                        </div>
                    </div>
                `).join('') : `
                    <p class="text-sm text-gray-400 italic">Belum ada data saudara.</p>
                `}
            </div>
        </div>
    </div>
`;

export const attachStep2Events = () => {
    document.getElementById('btn-go-to-profile')?.addEventListener('click', () => {
        renderProfilMahasiswa();
    });
};
