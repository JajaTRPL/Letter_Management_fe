export const renderSectionBeasiswa = () => `
    <!-- RIWAYAT PENERIMAAN BEASISWA -->
    <div class="profile-section bg-white rounded-[24px] p-8 shadow-sm border border-gray-100" data-section="beasiswa">
        <button type="button" class="profile-section-header" data-section-toggle="beasiswa" aria-expanded="false" aria-controls="profile-section-body-beasiswa">
            <span class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                Riwayat Penerimaan Beasiswa <span class="text-xs font-normal text-gray-400 ml-2">(Opsional, maks. 5 data)</span>
            </span>
            <span class="profile-section-chevron" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
        </button>

        <div id="profile-section-body-beasiswa" class="profile-section-body-wrapper">
            <div class="profile-section-body pt-6">
                <div class="border border-gray-200 rounded-xl overflow-hidden mb-4">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase font-bold tracking-wider">
                            <tr>
                                <th class="px-6 py-4">Nama Beasiswa</th>
                                <th class="px-6 py-4">Periode</th>
                                <th class="px-6 py-4">Jumlah (Rp)</th>
                                <th class="px-6 py-4">Status</th>
                                <th class="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="beasiswa-tbody" class="divide-y divide-gray-100 text-sm">
                        </tbody>
                    </table>
                </div>
                <div class="section-status hidden mt-5" data-section-status="beasiswa" role="status" aria-live="polite"></div>
                <div class="mt-6 flex items-center justify-end gap-4">
                    <button type="button" class="btn-batal-section hidden px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm" data-section="beasiswa">
                        Batal
                    </button>
                    <button type="button" class="btn-simpan-section hidden px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm flex items-center gap-2" data-section="beasiswa">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Simpan
                    </button>
                    <button type="button" class="btn-edit-section btn-primary-outline" data-section="beasiswa">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                    <div class="flex items-center gap-4">
                        <button type="button" id="btn-tambah-beasiswa" class="text-sm font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Tambah Riwayat Beasiswa
                        </button>
                        <span id="beasiswa-counter" class="text-xs text-gray-400 font-semibold">0 / 5</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
