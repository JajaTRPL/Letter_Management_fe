import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { SPINNER_CLASS, surfaceClass } from '../shared/design-system';

export const MAHASISWA_MANUAL_URL = '/panduan/user-manual-mahasiswa.pdf';

export const renderPanduanMahasiswa = (): void => {
    const content = `
        <section class="mx-auto max-w-7xl space-y-5" aria-labelledby="panduan-mahasiswa-title">
            <div class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div class="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-teal-600">Panduan Pengguna</p>
                        <h2 id="panduan-mahasiswa-title" class="mt-1 text-xl font-bold text-gray-900">User Manual Mahasiswa</h2>
                        <p class="mt-1 max-w-2xl text-sm leading-6 text-gray-500">Pelajari pengajuan surat, peminjaman ruangan, revisi, pemantauan status, dan pengunduhan dokumen final.</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <a id="panduan-open-full" href="${MAHASISWA_MANUAL_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-300">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3h7v7"></path><path d="M10 14 21 3"></path><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path></svg>
                            Lihat Penuh
                        </a>
                        <a id="panduan-download" href="${MAHASISWA_MANUAL_URL}" download="User Manual Mahasiswa.pdf" class="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-200">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
                            Unduh PDF
                        </a>
                    </div>
                </div>
                <div class="relative bg-gray-100 p-2 sm:p-4">
                    <div id="panduan-pdf-loading" data-state="loading" class="${surfaceClass('card', 'absolute inset-2 z-10 flex items-center justify-center px-6 py-16 text-center sm:inset-4')}">
                        <div>
                            <div class="mx-auto h-10 w-10 ${SPINNER_CLASS}" aria-hidden="true"></div>
                            <p class="mt-4 text-sm font-bold text-gray-700">Memuat panduan...</p>
                        </div>
                    </div>
                    <object id="panduan-pdf-preview" data="${MAHASISWA_MANUAL_URL}#view=FitH" type="application/pdf" aria-label="Preview PDF User Manual Mahasiswa" class="h-[70vh] min-h-[520px] w-full rounded-xl bg-white shadow-inner">
                        <div class="flex min-h-[420px] flex-col items-center justify-center rounded-xl bg-white px-6 text-center">
                            <p class="text-base font-semibold text-gray-800">Preview PDF tidak didukung oleh browser ini.</p>
                            <p class="mt-2 text-sm text-gray-500">Gunakan tombol Lihat Penuh atau Unduh PDF untuk membaca panduan.</p>
                            <a href="${MAHASISWA_MANUAL_URL}" target="_blank" rel="noopener noreferrer" class="mt-4 rounded-xl bg-primary-teal px-4 py-2.5 text-sm font-semibold text-white">Buka Panduan</a>
                        </div>
                    </object>
                </div>
            </div>
        </section>
    `;

    renderDashboardLayout('Panduan', content, 'mahasiswa', 'panduan');

    if (typeof document === 'undefined') return;

    // The <object> load event is unreliable across browsers for PDFs, so back
    // it with a timeout fallback — either way the spinner disappears instead of
    // sitting on screen forever.
    const hideLoading = () => {
        document.getElementById('panduan-pdf-loading')?.remove();
    };
    const pdfPreview = document.getElementById('panduan-pdf-preview');
    pdfPreview?.addEventListener('load', hideLoading, { once: true });
    setTimeout(hideLoading, 2500);
};
