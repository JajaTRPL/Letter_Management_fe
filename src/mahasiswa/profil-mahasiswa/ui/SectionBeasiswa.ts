export const renderSectionBeasiswa = () => `
    <!-- RIWAYAT PENERIMAAN BEASISWA -->
    <div class="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100">
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                Riwayat Penerimaan Beasiswa <span class="text-xs font-normal text-gray-400 ml-2">(Opsional, maks. 5 data)</span>
            </h3>
        </div>
        
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
        <div class="flex items-center justify-between">
            <button type="button" id="btn-tambah-beasiswa" class="text-sm font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Tambah Riwayat Beasiswa
            </button>
            <span id="beasiswa-counter" class="text-xs text-gray-400 font-semibold">0 / 5</span>
        </div>
    </div>
`;
