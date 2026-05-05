import type { SectionController } from './SectionController';

export const SectionBeasiswaController: SectionController = {
    getPayload() {
        const beasiswa: any[] = [];
        const tbody = document.getElementById('beasiswa-tbody');
        if (tbody) {
            Array.from(tbody.children).forEach(tr => {
                const inputs = tr.querySelectorAll('input[type="text"]');
                const select = tr.querySelector('select');
                if (inputs.length >= 3 && (inputs[0] as HTMLInputElement).value) {
                    beasiswa.push({
                        nama_beasiswa: (inputs[0] as HTMLInputElement).value,
                        periode: (inputs[1] as HTMLInputElement).value,
                        jumlah: (inputs[2] as HTMLInputElement).value,
                        status: select?.value
                    });
                }
            });
        }
        return { beasiswa };
    },

    captureSnapshot() {
        return this.getPayload().beasiswa;
    },

    restoreSnapshot(snapshot: any) {
        const tbody = document.getElementById('beasiswa-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        if (Array.isArray(snapshot)) {
            snapshot.forEach((b: any) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-6 py-4 font-medium text-gray-800"><input type="text" value="${b.nama_beasiswa || ''}" placeholder="Nama Beasiswa" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                    <td class="px-6 py-4"><input type="text" value="${b.periode || ''}" placeholder="Tahun/Semester" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                    <td class="px-6 py-4">
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">Rp</span>
                            <input type="text" value="${b.jumlah || ''}" class="input-ribuan w-full pl-9 pr-3 py-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold" placeholder="0">
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <select class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold">
                            <option ${b.status === 'Aktif' ? 'selected' : ''}>Aktif</option>
                            <option ${b.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                        </select>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <button type="button" class="btn-hapus-beasiswa text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            document.dispatchEvent(new CustomEvent('beasiswa-restored'));
        }
    }
};
