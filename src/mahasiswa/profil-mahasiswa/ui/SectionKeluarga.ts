export const renderSectionKeluarga = () => `
    <!-- DATA AYAH -->
    <div class="profile-section bg-white rounded-[24px] p-8 shadow-sm border border-gray-100" data-section="ayah">
        <button type="button" class="profile-section-header" data-section-toggle="ayah" aria-expanded="false" aria-controls="profile-section-body-ayah">
            <span class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Data Ayah
            </span>
            <span class="profile-section-chevron" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
        </button>

        <div id="profile-section-body-ayah" class="profile-section-body-wrapper">
            <div class="profile-section-body pt-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2 md:col-span-2">
                        <label class="block text-sm font-semibold text-gray-700">Nama Lengkap Ayah</label>
                        <input type="text" id="ayah_nama" placeholder="Masukkan nama ayah" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Pekerjaan</label>
                        <input type="text" id="ayah_pekerjaan" placeholder="Pekerjaan ayah" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Penghasilan Per Bulan (Rp)</label>
                        <input type="text" id="ayah_penghasilan" inputmode="numeric" pattern="[0-9.]*" placeholder="Contoh: 3.000.000" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Status</label>
                        <select id="ayah_status" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
                            <option value="hidup">Masih Hidup</option>
                            <option value="meninggal">Meninggal</option>
                        </select>
                    </div>
                    <div class="space-y-2 hidden" id="ayah_tgl_meninggal_container">
                        <label class="block text-sm font-semibold text-gray-700">Tanggal Meninggal <span class="text-xs text-gray-400 font-normal">(opsional)</span></label>
                        <input type="date" id="ayah_tgl_meninggal" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-500">
                    </div>
                </div>
                <div class="section-status hidden mt-5" data-section-status="ayah" role="status" aria-live="polite"></div>
                <div class="mt-6 flex items-center justify-end gap-4">
                    <button type="button" class="btn-batal-section hidden px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm" data-section="ayah">
                        Batal
                    </button>
                    <button type="button" class="btn-simpan-section hidden px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm flex items-center gap-2" data-section="ayah">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Simpan
                    </button>
                    <button type="button" class="btn-edit-section btn-primary-outline" data-section="ayah">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- DATA IBU -->
    <div class="profile-section bg-white rounded-[24px] p-8 shadow-sm border border-gray-100" data-section="ibu">
        <button type="button" class="profile-section-header" data-section-toggle="ibu" aria-expanded="false" aria-controls="profile-section-body-ibu">
            <span class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Data Ibu
            </span>
            <span class="profile-section-chevron" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
        </button>

        <div id="profile-section-body-ibu" class="profile-section-body-wrapper">
            <div class="profile-section-body pt-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2 md:col-span-2">
                        <label class="block text-sm font-semibold text-gray-700">Nama Lengkap Ibu</label>
                        <input type="text" id="ibu_nama" placeholder="Masukkan nama ibu" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Pekerjaan</label>
                        <input type="text" id="ibu_pekerjaan" placeholder="Pekerjaan ibu" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Penghasilan Per Bulan (Rp)</label>
                        <input type="text" id="ibu_penghasilan" inputmode="numeric" pattern="[0-9.]*" placeholder="Contoh: 3.000.000" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Status</label>
                        <select id="ibu_status" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
                            <option value="hidup">Masih Hidup</option>
                            <option value="meninggal">Meninggal</option>
                        </select>
                    </div>
                    <div class="space-y-2 hidden" id="ibu_tgl_meninggal_container">
                        <label class="block text-sm font-semibold text-gray-700">Tanggal Meninggal <span class="text-xs text-gray-400 font-normal">(opsional)</span></label>
                        <input type="date" id="ibu_tgl_meninggal" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-500">
                    </div>
                </div>
                <div class="section-status hidden mt-5" data-section-status="ibu" role="status" aria-live="polite"></div>
                <div class="mt-6 flex items-center justify-end gap-4">
                    <button type="button" class="btn-batal-section hidden px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm" data-section="ibu">
                        Batal
                    </button>
                    <button type="button" class="btn-simpan-section hidden px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm flex items-center gap-2" data-section="ibu">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Simpan
                    </button>
                    <button type="button" class="btn-edit-section btn-primary-outline" data-section="ibu">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- DATA WALI -->
    <div id="section-wali" class="profile-section bg-white rounded-[24px] p-8 shadow-sm border border-gray-100 transition-all duration-300" data-section="wali">
        <button type="button" class="profile-section-header" data-section-toggle="wali" aria-expanded="false" aria-controls="profile-section-body-wali">
            <span class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Data Wali <span class="text-xs font-normal text-gray-400 ml-2">(Opsional jika tidak ada wali)</span>
            </span>
            <span class="profile-section-chevron" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
        </button>

        <div id="profile-section-body-wali" class="profile-section-body-wrapper">
            <div class="profile-section-body pt-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2 md:col-span-2">
                        <label class="block text-sm font-semibold text-gray-700">Nama Lengkap Wali</label>
                        <input type="text" id="wali_nama" placeholder="Masukkan nama wali (kosongkan jika tidak ada)" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Pekerjaan</label>
                        <input type="text" id="wali_pekerjaan" placeholder="Pekerjaan wali" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Penghasilan Per Bulan (Rp)</label>
                        <input type="text" id="wali_penghasilan" inputmode="numeric" pattern="[0-9.]*" placeholder="Contoh: 3.000.000" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Status</label>
                        <select id="wali_status" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
                            <option value="hidup">Masih Hidup</option>
                            <option value="meninggal">Meninggal</option>
                        </select>
                    </div>
                </div>
                <div class="section-status hidden mt-5" data-section-status="wali" role="status" aria-live="polite"></div>
                <div class="mt-6 flex items-center justify-end gap-4">
                    <button type="button" class="btn-batal-section hidden px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm" data-section="wali">
                        Batal
                    </button>
                    <button type="button" class="btn-simpan-section hidden px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm flex items-center gap-2" data-section="wali">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Simpan
                    </button>
                    <button type="button" class="btn-edit-section btn-primary-outline" data-section="wali">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
