import { closeDrawer, getOrCreateDrawerRoot } from './drawer-utils';
import { apiFetch } from '../../shared/api-client';
import { showSuccess, showError } from '../../shared/toast';

export function renderImportDrawer(onRefresh: () => void) {
    const container = getOrCreateDrawerRoot();
    let fileHash = '';
    let cachedInvalidRows: any[] = [];
    let selectedFile: File | null = null;

    container.innerHTML = `
        <div class="drawer-overlay fixed inset-0 bg-black/40 z-[200]" style="opacity:0; transition: opacity 0.3s ease;"></div>
        <div class="drawer-panel fixed top-0 right-0 h-full w-[480px] bg-white z-[201] flex flex-col shadow-2xl" style="transform: translateX(100%); transition: transform 0.3s ease;">
            <div class="flex items-start justify-between px-7 pt-8 pb-4">
                <div>
                    <h2 class="text-xl font-bold text-gray-900">Impor Data Mahasiswa</h2>
                    <p class="text-sm text-gray-500 mt-1">Unggah file CSV untuk menambah atau memperbarui data</p>
                </div>
                <button id="close-import-drawer" class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div id="import-step-upload" class="flex-1 overflow-y-auto px-7 py-4 space-y-5">
                <div class="space-y-2">
                    <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Template</p>
                    <p class="text-xs text-gray-400">Unduh template CSV untuk memastikan format sesuai sistem</p>
                    <button id="download-template-btn" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-teal-700 text-teal-700 rounded-xl text-sm font-semibold hover:bg-teal-50 transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Unduh Template (.csv)
                    </button>
                </div>
                <hr class="border-gray-100">
                <div class="space-y-2">
                    <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Unggah File</p>
                    <div id="drop-zone" class="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-300"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <p class="text-sm font-medium text-gray-500">Seret file atau klik untuk mengunggah</p>
                        <p class="text-[10px] text-gray-400">Format: .CSV • Maks 2MB</p>
                        <input type="file" id="import-file-input" accept=".csv" class="hidden">
                    </div>
                    <div id="file-preview" class="hidden bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-teal-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            </div>
                            <div class="min-w-0">
                                <p id="file-name" class="text-sm font-medium text-gray-700 truncate"></p>
                                <p id="file-size" class="text-[10px] text-gray-400"></p>
                            </div>
                        </div>
                        <button id="remove-file-btn" class="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Kolom Template</p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-md">name*</span>
                        <span class="text-[10px] bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-md">email*</span>
                        <span class="text-[10px] bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-md">nim*</span>
                        <span class="text-[10px] bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-md">study_program_code*</span>
                        <span class="text-[10px] bg-gray-200 text-gray-600 font-semibold px-2 py-0.5 rounded-md">tanggal_lahir</span>
                    </div>
                    <p class="text-[10px] text-gray-400">* = wajib</p>
                </div>
            </div>
            <div id="import-step-preview" class="flex-1 overflow-y-auto px-7 py-4 space-y-4 hidden">
                <div id="preview-summary" class="space-y-3"></div>
                <div id="preview-errors" class="space-y-2"></div>
            </div>
            <div class="border-t border-gray-100 px-7 py-5 flex items-center justify-end gap-3">
                <button id="cancel-import-btn" class="px-5 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all">Batal</button>
                <button id="validate-import-btn" class="px-5 py-2.5 text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled>Validasi</button>
                <button id="confirm-import-btn" class="hidden px-5 py-2.5 text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Konfirmasi Impor</button>
                <button id="back-import-btn" class="hidden px-5 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all">Kembali</button>
            </div>
        </div>
    `;

    requestAnimationFrame(() => { requestAnimationFrame(() => {
        const overlay = container.querySelector('.drawer-overlay') as HTMLElement;
        const panel = container.querySelector('.drawer-panel') as HTMLElement;
        if (overlay) overlay.style.opacity = '1';
        if (panel) panel.style.transform = 'translateX(0)';
    }); });

    container.querySelector('.drawer-overlay')?.addEventListener('click', closeDrawer);
    container.querySelector('#close-import-drawer')?.addEventListener('click', closeDrawer);
    container.querySelector('#cancel-import-btn')?.addEventListener('click', closeDrawer);

    container.querySelector('#download-template-btn')?.addEventListener('click', async () => {
        try {
            const res = await apiFetch('/api/super-admin/users/import-template');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'template_import_mahasiswa.csv'; a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) { console.error(err); }
    });

    const dropZone = container.querySelector('#drop-zone')!;
    const fileInput = container.querySelector('#import-file-input') as HTMLInputElement;
    const filePreview = container.querySelector('#file-preview') as HTMLElement;
    const fileNameEl = container.querySelector('#file-name') as HTMLElement;
    const fileSizeEl = container.querySelector('#file-size') as HTMLElement;
    const validateBtn = container.querySelector('#validate-import-btn') as HTMLButtonElement;

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const showFilePreview = (file: File) => {
        selectedFile = file;
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = formatFileSize(file.size);
        filePreview.classList.remove('hidden');
        dropZone.classList.add('hidden');
        validateBtn.disabled = false;
    };

    const clearFile = () => {
        selectedFile = null;
        fileInput.value = '';
        filePreview.classList.add('hidden');
        dropZone.classList.remove('hidden');
        validateBtn.disabled = true;
    };

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files?.[0]) showFilePreview(fileInput.files[0]); });
    container.querySelector('#remove-file-btn')?.addEventListener('click', clearFile);

    // Drag-and-drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-teal-400', 'bg-teal-50/50'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-teal-400', 'bg-teal-50/50'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-teal-400', 'bg-teal-50/50');
        const file = (e as DragEvent).dataTransfer?.files?.[0];
        if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
            showFilePreview(file);
        } else {
            showError('Hanya file CSV yang didukung');
        }
    });

    const stepUpload = container.querySelector('#import-step-upload') as HTMLElement;
    const stepPreview = container.querySelector('#import-step-preview') as HTMLElement;
    const confirmBtn = container.querySelector('#confirm-import-btn') as HTMLButtonElement;
    const backBtn = container.querySelector('#back-import-btn') as HTMLButtonElement;
    const cancelBtn = container.querySelector('#cancel-import-btn') as HTMLButtonElement;
    const previewSummary = container.querySelector('#preview-summary') as HTMLElement;
    const previewErrors = container.querySelector('#preview-errors') as HTMLElement;

    const showPreview = () => { stepUpload.classList.add('hidden'); stepPreview.classList.remove('hidden'); validateBtn.classList.add('hidden'); cancelBtn.classList.add('hidden'); confirmBtn.classList.remove('hidden'); backBtn.classList.remove('hidden'); };
    const showUpload = () => { stepPreview.classList.add('hidden'); stepUpload.classList.remove('hidden'); validateBtn.classList.remove('hidden'); cancelBtn.classList.remove('hidden'); confirmBtn.classList.add('hidden'); backBtn.classList.add('hidden'); };
    backBtn.addEventListener('click', showUpload);

    const downloadErrorCsv = async () => {
        if (cachedInvalidRows.length === 0) return;
        try {
            const res = await apiFetch('/api/super-admin/users/import-errors', { method: 'POST', body: JSON.stringify({ invalid_rows: cachedInvalidRows }) });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `import_errors_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) { console.error(err); }
    };

    validateBtn.addEventListener('click', async () => {
        if (!selectedFile) { showError('Pilih file CSV terlebih dahulu'); return; }
        validateBtn.disabled = true; validateBtn.innerHTML = 'Memvalidasi...';
        const formData = new FormData(); formData.append('file', selectedFile);
        try {
            const response = await apiFetch('/api/super-admin/users/validate-import', { method: 'POST', body: formData, isFormData: true });
            const result = await response.json();
            if (!response.ok) { showError(result.message || 'Validasi gagal'); validateBtn.disabled = false; validateBtn.innerHTML = 'Validasi'; return; }

            fileHash = result.file_hash || '';
            cachedInvalidRows = result.invalid_rows || [];
            const { summary, invalid_rows } = result;

            previewSummary.innerHTML = `<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">Hasil Validasi</h3>
                <div class="grid grid-cols-3 gap-3">
                    <div class="bg-gray-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-gray-800">${summary.total}</p><p class="text-[10px] text-gray-500 uppercase font-semibold mt-1">Total</p></div>
                    <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-emerald-600">${summary.valid}</p><p class="text-[10px] text-emerald-600 uppercase font-semibold mt-1">Valid</p></div>
                    <div class="bg-red-50 border border-red-100 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-red-500">${summary.invalid}</p><p class="text-[10px] text-red-500 uppercase font-semibold mt-1">Invalid</p></div>
                </div>`;

            if (invalid_rows.length > 0) {
                previewErrors.innerHTML = `<div class="flex items-center justify-between"><h4 class="text-xs font-bold text-red-600 uppercase tracking-wider">Detail Error</h4><button id="download-error-csv" class="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 hover:underline"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Unduh Laporan</button></div>
                    <div class="max-h-[280px] overflow-y-auto space-y-2 pr-1">${invalid_rows.map((r: any) => `<div class="bg-red-50 border border-red-100 rounded-xl p-3"><div class="flex items-center justify-between mb-1"><span class="text-xs font-bold text-red-700">Baris ${r.row}</span><span class="text-[10px] text-red-400 font-mono">${r.data?.email || '-'}</span></div><ul class="space-y-0.5">${r.errors.map((e: string) => `<li class="text-[11px] text-red-600 flex items-start gap-1.5"><span class="text-red-400 mt-0.5">•</span> ${e}</li>`).join('')}</ul></div>`).join('')}</div>`;
                container.querySelector('#download-error-csv')?.addEventListener('click', downloadErrorCsv);
            } else {
                previewErrors.innerHTML = `<div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-500 shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><p class="text-sm text-emerald-700 font-medium">Semua baris valid dan siap diimpor.</p></div>`;
            }

            confirmBtn.disabled = summary.valid === 0;
            confirmBtn.textContent = summary.valid > 0 ? `Konfirmasi Impor (${summary.valid} baris)` : 'Tidak ada data valid';
            showPreview();
        } catch (err) { console.error(err); showError('Gagal menghubungi server'); } finally { validateBtn.disabled = !selectedFile; validateBtn.innerHTML = 'Validasi'; }
    });

    confirmBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        confirmBtn.disabled = true; confirmBtn.innerHTML = 'Mengimpor...';
        const formData = new FormData(); formData.append('file', selectedFile);
        if (fileHash) formData.append('file_hash', fileHash);
        try {
            const response = await apiFetch('/api/super-admin/users/bulk-import', { method: 'POST', body: formData, isFormData: true });
            const result = await response.json();
            if (response.ok) {
                const msg = `Berhasil: ${result.summary.success} mahasiswa diimpor` + (result.summary.failed > 0 ? `, ${result.summary.failed} gagal` : '');
                showSuccess(msg);
                closeDrawer(); onRefresh();
            } else { showError(result.message || 'Import gagal'); confirmBtn.disabled = false; confirmBtn.innerHTML = 'Konfirmasi Impor'; }
        } catch (err) { console.error(err); showError('Gagal menghubungi server'); confirmBtn.disabled = false; confirmBtn.innerHTML = 'Konfirmasi Impor'; }
    });
}
