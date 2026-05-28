export const renderStep3Akademik = (formData: any) => `
    <div class="animate-enter-right space-y-8 pb-8">
        <div class="border-b border-gray-100 pb-4">
            <h3 class="text-xl font-bold text-gray-800">Data Pengajuan & Akademik</h3>
            <p class="text-sm text-gray-500">Harap isi data di bawah ini dengan benar untuk mendukung kelancaran pengajuan surat</p>
        </div>

        <div class="space-y-4">
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">Nama Beasiswa</label>
                <input type="text" name="scholarship_name" value="${formData.scholarship_name || ''}" placeholder="Contoh: Beasiswa Djarum Plus" class="w-full px-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">Jenjang Studi</label>
                <input type="text" name="study_level" value="${formData.study_level || 'D4'}" readonly class="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm text-gray-500 cursor-not-allowed">
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">Semester Saat Ini</label>
                <input type="number" name="current_semester" value="${formData.current_semester || ''}" placeholder="Contoh: 4" class="w-full px-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">Jumlah Tanggungan Keluarga</label>
                <input type="number" name="family_dependents" value="${formData.family_dependents || ''}" placeholder="Contoh: 3" class="w-full px-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">IP 2 Semester Terakhir</label>
                <input type="number" step="0.01" name="gpa_last_semesters" value="${formData.gpa_last_2_semesters || ''}" placeholder="Contoh: 3.75" class="w-full px-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">IPK</label>
                <input type="number" step="0.01" name="ipk" value="${formData.ipk || ''}" placeholder="Contoh: 3.75" class="w-full px-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">Jumlah SKS 2 Semester Terakhir</label>
                <input type="number" name="sks_last_semesters" value="${formData.sks_last_2_semesters || ''}" placeholder="Contoh: 24" class="w-full px-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
            </div>
            <div class="grid grid-cols-[200px_1fr] items-start gap-4">
                <label class="text-sm font-bold text-gray-800 pt-2">SKSK (SKS Kumulatif)</label>
                <div class="space-y-1">
                    <input type="number" name="total_sks_passed" value="${formData.total_sks_passed || ''}" placeholder="Contoh: 38" class="w-full px-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
                    <p class="text-[10px] text-gray-400">Total SKS yang sudah ditempuh sampai saat ini.</p>
                </div>
            </div>
            <div class="grid grid-cols-[200px_1fr] items-start gap-4">
                <label class="text-sm font-bold text-gray-800 pt-2">Jumlah Beban SKS untuk Lulus</label>
                <div class="space-y-1">
                    <input type="number" name="total_sks_required" value="${formData.total_sks_required || ''}" placeholder="Contoh: 144" class="w-full px-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
                    <p class="text-[10px] text-gray-400">Total minimal SKS kurikulum untuk lulus. Contoh: 144.</p>
                </div>
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">Status Cuti Kuliah</label>
                <div class="flex items-center gap-6">
                    <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="radio" name="on_leave" value="Belum" ${formData.on_leave !== 'Sudah' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                        Belum
                    </label>
                    <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="radio" name="on_leave" value="Sudah" ${formData.on_leave === 'Sudah' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                        Sudah
                    </label>
                    <div id="leave-semester-container" class="${formData.on_leave === 'Sudah' ? 'flex' : 'hidden'} items-center gap-2">
                        <span class="text-sm font-bold text-gray-800 ml-2">Semester</span>
                        <input type="number" name="leave_semester" value="${formData.leave_semester || ''}" placeholder="Contoh: 4" class="w-24 px-3 py-1 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">Status Skripsi</label>
                <div class="flex items-center gap-6">
                    <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="radio" name="thesis_status" value="Belum" ${formData.thesis_status !== 'Sudah' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                        Belum
                    </label>
                    <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="radio" name="thesis_status" value="Sudah" ${formData.thesis_status === 'Sudah' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                        Sudah
                    </label>
                </div>
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">Rencana Ujian Pendadaran <span class="text-[10px] text-gray-400 font-normal ml-1">(opsional)</span></label>
                <input type="date" name="exam_plan_date" value="${formData.exam_plan_date || ''}" class="w-full px-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500">
            </div>
            <div class="grid grid-cols-[200px_1fr] items-center gap-4">
                <label class="text-sm font-bold text-gray-800">Riwayat Menerima Beasiswa</label>
                <div class="flex items-center gap-6">
                    <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="radio" name="has_scholarship_history" value="1" ${formData.has_scholarship_history === true || formData.has_scholarship_history == 1 ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                        Pernah
                    </label>
                    <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="radio" name="has_scholarship_history" value="0" ${formData.has_scholarship_history !== true && formData.has_scholarship_history != 1 ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                        Belum Pernah
                    </label>
                </div>
            </div>
        </div>

        <div id="history-section" class="${formData.has_scholarship_history === true || formData.has_scholarship_history == 1 ? 'block' : 'hidden'} space-y-6 pt-4 border-t border-gray-100">
            <div class="flex justify-between items-center">
                <h4 class="text-lg font-bold text-gray-800">Riwayat Penerimaan Beasiswa (opsional)</h4>
                <button type="button" id="btn-tambah-beasiswa-form" class="text-teal-600 text-sm font-bold flex items-center gap-1 hover:text-teal-700">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Tambah &nbsp;<span id="beasiswa-counter-form" class="text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full font-bold">0 / 5</span>
                </button>
            </div>
            <div class="space-y-4">
                <div class="overflow-x-auto">
                    <table class="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <thead class="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-6 py-3 text-xs font-bold text-gray-400 tracking-wider">SUMBER DANA / NAMA BEASISWA</th>
                                <th class="px-6 py-3 text-xs font-bold text-gray-400 tracking-wider">PERIODE</th>
                                <th class="px-6 py-3 text-xs font-bold text-gray-400 tracking-wider">DANA PER BULAN</th>
                                <th class="px-6 py-3 text-xs font-bold text-gray-400 tracking-wider">STATUS</th>
                                <th class="px-6 py-3 text-xs font-bold text-gray-400 tracking-wider text-center">AKSI</th>
                            </tr>
                        </thead>
                        <tbody id="beasiswa-tbody-form" class="divide-y divide-gray-100">
                            ${formData.scholarship_histories && formData.scholarship_histories.length > 0 ? formData.scholarship_histories.map((h: any, idx: number) => `
                                <tr>
                                    <td class="px-6 py-4 font-medium text-gray-800"><input type="text" name="scholarship_histories[${idx}][nama_beasiswa]" value="${h.nama_beasiswa}" placeholder="Nama beasiswa" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                                    <td class="px-6 py-4"><input type="text" name="scholarship_histories[${idx}][periode]" value="${h.periode || ''}" placeholder="cth: 2024/2025" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                                    <td class="px-6 py-4"><input type="text" name="scholarship_histories[${idx}][jumlah]" value="${h.jumlah || ''}" placeholder="cth: 5000000" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                                    <td class="px-6 py-4">
                                        <select name="scholarship_histories[${idx}][status]" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold">
                                            <option ${h.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                                            <option ${h.status === 'Aktif' ? 'selected' : ''}>Aktif</option>
                                        </select>
                                    </td>
                                    <td class="px-6 py-4 text-center">
                                        <button type="button" class="btn-hapus-beasiswa-form text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </td>
                                </tr>
                            `).join('') : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="space-y-6 pt-6 border-t border-gray-100">
            <h4 class="text-lg font-bold text-gray-800">Dokumen Pendukung</h4>
            
            <div class="space-y-4">
                <div class="grid grid-cols-[200px_1fr] items-start gap-4">
                    <label class="text-sm font-bold text-gray-800 pt-2">Transkrip Nilai <span class="text-red-500">*</span></label>
                    <div class="space-y-1">
                        <input type="file" id="transkrip-nilai-upload" name="transkrip-nilai" accept=".pdf" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200">
                        <p class="text-[10px] text-gray-400">Format: PDF (MAX 2MB)</p>
                    </div>
                </div>
                <div class="grid grid-cols-[200px_1fr] items-start gap-4">
                    <label class="text-sm font-bold text-gray-800 pt-2">Slip Gaji Ayah</label>
                    <div class="space-y-1">
                        <input type="file" id="slip-gaji-ayah-upload" name="slip-ayah" accept="application/pdf,.pdf" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200">
                        <p class="text-[10px] text-gray-400">Format: PDF (MAX 2MB)</p>
                    </div>
                </div>
                <div class="grid grid-cols-[200px_1fr] items-start gap-4">
                    <label class="text-sm font-bold text-gray-800 pt-2">Slip Gaji Ibu</label>
                    <div class="space-y-1">
                        <input type="file" id="slip-gaji-ibu-upload" name="slip-ibu" accept="application/pdf,.pdf" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200">
                        <p class="text-[10px] text-gray-400">Format: PDF (MAX 2MB)</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;

export const attachStep3Events = () => {
    // leave semester toggle
    const leaveRadios = document.querySelectorAll('input[name="on_leave"]');
    const leaveContainer = document.getElementById('leave-semester-container');
    leaveRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if ((e.target as HTMLInputElement).value === 'Sudah') {
                leaveContainer?.classList.remove('hidden');
                leaveContainer?.classList.add('flex');
            } else {
                leaveContainer?.classList.add('hidden');
                leaveContainer?.classList.remove('flex');
            }
        });
    });

    // scholarship history toggle
    const historyRadios = document.querySelectorAll('input[name="has_scholarship_history"]');
    const historySection = document.getElementById('history-section');
    historyRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if ((e.target as HTMLInputElement).value == '1') {
                historySection?.classList.remove('hidden');
                historySection?.classList.add('block');
            } else {
                historySection?.classList.add('hidden');
                historySection?.classList.remove('block');
            }
        });
    });

    const updateBeasiswaCounter = () => {
        const tbody = document.getElementById('beasiswa-tbody-form');
        const counter = document.getElementById('beasiswa-counter-form');
        if (tbody && counter) {
            const count = tbody.children.length;
            counter.innerText = `${count} / 5`;
            const btn = document.getElementById('btn-tambah-beasiswa-form') as HTMLButtonElement;
            if (btn) btn.disabled = count >= 5;
        }
    };

    const bindHapusBeasiswa = () => {
        document.querySelectorAll('.btn-hapus-beasiswa-form').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tr = (e.currentTarget as HTMLElement).closest('tr');
                if (tr) {
                    tr.remove();
                    updateBeasiswaCounter();
                }
            });
        });
    };

    document.getElementById('btn-tambah-beasiswa-form')?.addEventListener('click', () => {
        const tbody = document.getElementById('beasiswa-tbody-form');
        if (tbody && tbody.children.length < 5) {
            const idx = tbody.children.length;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-800"><input type="text" name="scholarship_histories[${idx}][nama_beasiswa]" placeholder="Nama beasiswa" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                <td class="px-6 py-4"><input type="text" name="scholarship_histories[${idx}][periode]" placeholder="cth: 2024/2025" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                <td class="px-6 py-4"><input type="text" name="scholarship_histories[${idx}][jumlah]" placeholder="cth: 5000000" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                <td class="px-6 py-4">
                    <select name="scholarship_histories[${idx}][status]" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold">
                        <option>Selesai</option>
                        <option>Aktif</option>
                    </select>
                </td>
                <td class="px-6 py-4 text-center">
                    <button type="button" class="btn-hapus-beasiswa-form text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
            bindHapusBeasiswa();
            updateBeasiswaCounter();
        }
    });

    bindHapusBeasiswa();
    updateBeasiswaCounter();
};
