import type { AcademicPeriod } from './types';
import { showError, showSuccess } from '../../shared/toast';
import { createAcademicPeriod, updateAcademicPeriod } from './api';

export const renderAcademicPeriodModal = (
    period: AcademicPeriod | null,
    onRefresh: () => void
): void => {
    const modalContainer = document.getElementById('modal-container')!;
    const isEdit = period !== null;

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto">
                <div class="bg-teal-700 px-6 py-4 flex justify-between items-center text-white sticky top-0 z-10">
                    <h3 class="font-bold">${isEdit ? 'Edit Periode Akademik' : 'Tambah Periode Akademik'}</h3>
                    <button id="ap-close-modal" class="hover:bg-white/10 p-1 rounded-lg transition-colors">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="ap-form" class="p-6 space-y-4">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tahun Akademik</label>
                        <input type="text" name="academic_year" value="${period?.academic_year ?? ''}" placeholder="2025/2026" required
                            class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipe Semester</label>
                        <select name="semester_type" required
                            class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all bg-white">
                            <option value="">Pilih...</option>
                            <option value="ganjil" ${period?.semester_type === 'ganjil' ? 'selected' : ''}>Ganjil</option>
                            <option value="genap"  ${period?.semester_type === 'genap'  ? 'selected' : ''}>Genap</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tanggal Mulai</label>
                            <input type="date" name="start_date" value="${period?.start_date ?? ''}" required
                                class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tanggal Selesai</label>
                            <input type="date" name="end_date" value="${period?.end_date ?? ''}" required
                                class="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                        </div>
                    </div>
                    <div class="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <input type="checkbox" id="ap-is-active" name="is_active" ${(isEdit ? period?.is_active : false) ? 'checked' : ''}
                            class="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0">
                        <div>
                            <label for="ap-is-active" class="text-sm text-gray-700 font-medium cursor-pointer">Aktif</label>
                            <p class="text-xs text-amber-700 mt-0.5">Hanya satu periode yang boleh aktif. Mengaktifkan periode ini otomatis menonaktifkan periode aktif lainnya. Periode aktif digunakan untuk menghitung semester mahasiswa pada pengajuan baru.</p>
                        </div>
                    </div>
                    <div class="mt-8 flex gap-3 justify-end pt-4 border-t border-gray-100">
                        <button type="button" id="ap-cancel-btn" class="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-all text-sm shadow-sm">Batal</button>
                        <button type="submit" class="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm">
                            ${isEdit ? 'Simpan Perubahan' : 'Tambah'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const form = document.getElementById('ap-form') as HTMLFormElement;

    const closeModal = (): void => {
        modalContainer.innerHTML = '';
        document.removeEventListener('keydown', escHandler);
    };

    const escHandler = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') closeModal();
    };

    document.addEventListener('keydown', escHandler);
    document.getElementById('ap-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('ap-cancel-btn')?.addEventListener('click', closeModal);
    modalContainer.addEventListener('click', (e: MouseEvent) => {
        if ((e.target as HTMLElement).classList.contains('fixed')) closeModal();
    });

    form.addEventListener('submit', async (e: SubmitEvent) => {
        e.preventDefault();

        const fd = new FormData(form);
        const academicYear = String(fd.get('academic_year') ?? '').trim();
        const semesterType = String(fd.get('semester_type') ?? '');
        const startDate    = String(fd.get('start_date') ?? '');
        const endDate      = String(fd.get('end_date') ?? '');
        const isActive     = (document.getElementById('ap-is-active') as HTMLInputElement).checked;

        if (!academicYear) { showError('Tahun akademik wajib diisi'); return; }
        if (!/^\d{4}\/\d{4}$/.test(academicYear)) { showError('Format tahun akademik harus YYYY/YYYY, contoh: 2025/2026'); return; }
        if (!semesterType) { showError('Tipe semester wajib dipilih'); return; }
        if (!startDate) { showError('Tanggal mulai wajib diisi'); return; }
        if (!endDate) { showError('Tanggal selesai wajib diisi'); return; }
        if (endDate < startDate) { showError('Tanggal selesai tidak boleh sebelum tanggal mulai'); return; }

        const payload: Record<string, unknown> = {
            academic_year: academicYear,
            semester_type: semesterType,
            start_date:    startDate,
            end_date:      endDate,
            is_active:     isActive,
        };

        try {
            const response = isEdit
                ? await updateAcademicPeriod(period!.id, payload)
                : await createAcademicPeriod(payload);

            const result = await response.json();
            if (response.ok) {
                showSuccess(result.message);
                closeModal();
                onRefresh();
            } else {
                const errors = result.errors as Record<string, string[]> | undefined;
                if (errors) {
                    showError(Object.values(errors).flat().join(' '));
                } else {
                    showError(result.message || 'Gagal menyimpan periode akademik');
                }
            }
        } catch (err) {
            console.error(err);
            showError('Terjadi kesalahan jaringan');
        }
    });
};
