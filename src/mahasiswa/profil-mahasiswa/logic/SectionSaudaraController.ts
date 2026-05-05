import type { SectionController } from './SectionController';

export const SectionSaudaraController: SectionController = {
    getPayload() {
        const saudara: any[] = [];
        const tbody = document.getElementById('saudara-tbody');
        if (tbody) {
            Array.from(tbody.children).forEach(tr => {
                const inputs = tr.querySelectorAll('input[type="text"]');
                const select = tr.querySelector('select');
                const radio = tr.querySelector(`input[type="radio"]:checked`) as HTMLInputElement;
                
                if (inputs.length >= 2 && (inputs[0] as HTMLInputElement).value) {
                    saudara.push({
                        jenis_relasi: 'saudara',
                        nama_lengkap: (inputs[0] as HTMLInputElement).value,
                        pekerjaan: (inputs[1] as HTMLInputElement).value,
                        status_kawin: select?.value,
                        keterangan: radio?.value || 'Kakak'
                    });
                }
            });
        }
        return { saudara };
    },

    captureSnapshot() {
        // Snapshot matches exactly the payload structure to easily rebuild
        return this.getPayload().saudara;
    },

    restoreSnapshot(snapshot: any) {
        const tbody = document.getElementById('saudara-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        if (Array.isArray(snapshot)) {
            snapshot.forEach((k: any) => {
                const rowIndex = tbody.children.length;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-6 py-4 font-medium text-gray-800"><input type="text" value="${k.nama_lengkap || ''}" placeholder="Nama saudara" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                    <td class="px-6 py-4"><input type="text" value="${k.pekerjaan || ''}" placeholder="Pekerjaan/Sekolah" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                    <td class="px-6 py-4">
                        <select class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold">
                            <option ${k.status_kawin === 'Belum Kawin' ? 'selected' : ''}>Belum Kawin</option>
                            <option ${k.status_kawin === 'Sudah Kawin' ? 'selected' : ''}>Sudah Kawin</option>
                        </select>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-4">
                            <label class="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" name="ket_saudara_load_${rowIndex}" value="Kakak" ${k.keterangan === 'Kakak' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                                <span class="text-sm text-gray-700 font-bold">Kakak</span>
                            </label>
                            <label class="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" name="ket_saudara_load_${rowIndex}" value="Adik" ${k.keterangan === 'Adik' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                                <span class="text-sm text-gray-700 font-bold">Adik</span>
                            </label>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <button type="button" class="btn-hapus-saudara text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            // Hapus buttons logic must be re-bound by orchestrator, or we dispatch an event
            document.dispatchEvent(new CustomEvent('saudara-restored'));
        }
    }
};
