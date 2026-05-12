export const renderSectionDetail = () => `
    <div class="profile-section bg-white rounded-[24px] p-8 shadow-sm border border-gray-100" data-section="detail">
        <button type="button" class="profile-section-header" data-section-toggle="detail" aria-expanded="false" aria-controls="profile-section-body-detail">
            <span class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Detail Profil
            </span>
            <span class="profile-section-chevron" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
        </button>

        <div id="profile-section-body-detail" class="profile-section-body-wrapper">
            <div class="profile-section-body pt-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Tempat Lahir</label>
                        <input type="text" id="tempat_lahir" placeholder="Masukkan tempat lahir" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Tanggal Lahir</label>
                        <input type="date" id="tanggal_lahir" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">Jenis Kelamin</label>
                        <select id="jenis_kelamin" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-gray-700 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center]">
                            <option value="">Pilih Jenis Kelamin</option>
                            <option value="L">Laki-Laki</option>
                            <option value="P">Perempuan</option>
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-gray-700">No. Telp / WhatsApp</label>
                        <input type="text" id="no_hp" inputmode="numeric" pattern="[0-9]*" autocomplete="tel" placeholder="Contoh: 08123456789" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400">
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <label class="block text-sm font-semibold text-gray-700">Alamat Asal</label>
                        <textarea id="alamat_asal" rows="2" placeholder="Masukkan alamat asal lengkap" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400 resize-none"></textarea>
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <label class="block text-sm font-semibold text-gray-700">Alamat di Yogyakarta (Domisili)</label>
                        <textarea id="alamat_domisili" rows="2" placeholder="Masukkan alamat kos/kontrakan di Yogyakarta" class="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all placeholder-gray-400 resize-none"></textarea>
                    </div>
                    
                    <!-- Uploads -->
                    <div class="space-y-2 mt-4">
                        <label class="block text-sm font-semibold text-gray-700">Pas Foto 3x4</label>
                        <div class="flex items-center gap-4">
                            <label class="flex-1 cursor-pointer">
                                <div id="preview-foto-container" class="flex items-center justify-center gap-2 py-3 px-4 border border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-600 overflow-hidden min-h-[50px]">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    <span id="label-foto" class="text-sm font-medium">Unggah Foto</span>
                                </div>
                                <input type="file" id="input-foto" class="hidden" accept="image/*">
                            </label>
                            <span class="text-xs text-gray-400 w-1/2">Format JPG/PNG, maks 5MB</span>
                        </div>
                    </div>

                    <div class="space-y-2 mt-4">
                        <label class="block text-sm font-semibold text-gray-700">Tanda Tangan</label>
                        <div class="flex items-center gap-4">
                            <label class="flex-1 cursor-pointer">
                                <div id="preview-ttd-container" class="flex items-center justify-center gap-2 py-3 px-4 border border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-600 overflow-hidden min-h-[50px]">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"></path></svg>
                                    <span id="label-ttd" class="text-sm font-medium">Unggah TTD</span>
                                </div>
                                <input type="file" id="input-ttd" class="hidden" accept="image/*">
                            </label>
                            <span class="text-xs text-gray-400 w-1/2">Format PNG (transparan), maks 2MB</span>
                        </div>
                    </div>
                </div>
                <div class="section-status hidden mt-5" data-section-status="detail" role="status" aria-live="polite"></div>
                <div class="mt-6 flex items-center justify-end gap-4">
                    <button type="button" class="btn-batal-section hidden px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm" data-section="detail">
                        Batal
                    </button>
                    <button type="button" class="btn-simpan-section hidden px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm flex items-center gap-2" data-section="detail">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Simpan
                    </button>
                    <button type="button" class="btn-edit-section btn-primary-outline" data-section="detail">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
