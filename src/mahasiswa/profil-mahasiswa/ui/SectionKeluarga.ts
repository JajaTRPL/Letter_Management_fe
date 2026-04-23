export const renderSectionKeluarga = () => `
    <!-- DATA AYAH -->
    <div class="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100">
        <h3 class="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Data Ayah
        </h3>
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
                <input type="number" id="ayah_penghasilan" placeholder="Contoh: 3000000" min="0" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
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
    </div>

    <!-- DATA IBU -->
    <div class="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100">
        <h3 class="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Data Ibu
        </h3>
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
                <input type="number" id="ibu_penghasilan" placeholder="Contoh: 3000000" min="0" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
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
    </div>

    <!-- DATA WALI -->
    <div id="section-wali" class="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100 transition-all duration-300">
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Data Wali <span class="text-xs font-normal text-gray-400 ml-2">(Opsional jika tidak ada wali)</span>
            </h3>
        </div>
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
                <input type="number" id="wali_penghasilan" placeholder="Contoh: 3000000" min="0" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
            </div>
            <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">Status</label>
                <select id="wali_status" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
                    <option value="hidup">Masih Hidup</option>
                    <option value="meninggal">Meninggal</option>
                </select>
            </div>
        </div>
    </div>
`;
