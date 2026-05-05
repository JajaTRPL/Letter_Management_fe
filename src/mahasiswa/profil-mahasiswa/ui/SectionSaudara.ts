export const renderSectionSaudara = () => `
    <!-- DATA SAUDARA KANDUNG -->
    <div class="profile-section bg-white rounded-[24px] p-8 shadow-sm border border-gray-100" data-section="saudara">
        <button type="button" class="profile-section-header" data-section-toggle="saudara" aria-expanded="false" aria-controls="profile-section-body-saudara">
            <span class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Data Saudara Kandung <span class="text-xs font-normal text-gray-400 ml-2">(Opsional jika tidak ada)</span>
            </span>
            <span class="profile-section-chevron" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
        </button>

        <div id="profile-section-body-saudara" class="profile-section-body-wrapper">
            <div class="profile-section-body pt-6">
                <div class="border border-gray-200 rounded-xl overflow-hidden mb-4">
                    <table class="w-full text-left ">
                        <thead class="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase font-bold tracking-wider">
                            <tr>
                                <th class="px-6 py-4">Nama</th>
                                <th class="px-6 py-4">Pekerjaan / Sekolah</th>
                                <th class="px-6 py-4">Status Kawin</th>
                                <th class="px-6 py-4">Keterangan</th>
                                <th class="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="saudara-tbody" class="divide-y divide-gray-100 text-sm">
                            <tr>
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
                                            <input type="radio" name="ket_saudara_0" value="Kakak" class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                                            <span class="text-sm text-gray-700">Kakak</span>
                                        </label>
                                        <label class="flex items-center gap-1.5 cursor-pointer">
                                            <input type="radio" name="ket_saudara_0" value="Adik" class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                                            <span class="text-sm text-gray-700">Adik</span>
                                        </label>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <button type="button" class="btn-hapus-saudara text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="section-status hidden mt-5" data-section-status="saudara" role="status" aria-live="polite"></div>
                <div class="flex items-center justify-end gap-4 mt-6">
                    <button type="button" class="btn-batal-section hidden px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm" data-section="saudara">
                        Batal
                    </button>
                    <button type="button" class="btn-simpan-section hidden px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm flex items-center gap-2" data-section="saudara">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Simpan
                    </button>
                    <button type="button" class="btn-edit-section btn-primary-outline" data-section="saudara">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                    <button type="button" id="btn-tambah-saudara" class="text-sm font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Tambah Saudara
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
