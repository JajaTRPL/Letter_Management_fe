import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { SPINNER_CLASS, surfaceClass } from './design-system';

/**
 * "Panduan" page for staff roles. Each role only gets its own chapter of the
 * Buku Panduan Sistem Persuratan DTEDI: Tendik Persuratan and Pejabat Akademik
 * (Kaprodi/Sekprodi/Kadep/Sekdep), plus the Sarpras, Laboran, Kepala Lab and
 * Super Admin guides.
 */
export const TENDIK_PERSURATAN_MANUAL_URL = '/panduan/user-manual-tendik-persuratan.pdf';
export const PEJABAT_AKADEMIK_MANUAL_URL = '/panduan/user-manual-pejabat-akademik.pdf';
export const SARPRAS_MANUAL_URL = '/panduan/user-manual-sarpras.pdf';
export const LABORAN_MANUAL_URL = '/panduan/user-manual-laboran.pdf';
export const SUPER_ADMIN_MANUAL_URL = '/panduan/user-manual-super-admin.pdf';
export const KEPALA_LAB_MANUAL_URL = '/panduan/user-manual-kepala-lab.pdf';

const ACADEMIC_ROLES = ['kadep', 'kaprodi', 'sekdep', 'sekprodi', 'akademik'];

interface StafManual {
    url: string;
    title: string;
    description: string;
    downloadName: string;
}

const currentTendikRole = (): string => {
    try {
        return localStorage.getItem('auth_tendik_role') ?? '';
    } catch {
        return '';
    }
};

const SARPRAS_MANUAL: StafManual = {
    url: SARPRAS_MANUAL_URL,
    title: 'Panduan Sarana & Prasarana',
    description: 'Pelajari cara meninjau pengajuan peminjaman ruang kelas, menyerahkan kunci, memverifikasi pengembalian, memakai kalender, dan mengelola ruangan.',
    downloadName: 'Panduan Sarpras.pdf',
};

const LABORAN_MANUAL: StafManual = {
    url: LABORAN_MANUAL_URL,
    title: 'Panduan Laboran / Teknisi Lab',
    description: 'Pelajari cara meninjau pengajuan peminjaman laboratorium, menyerahkan kunci, memverifikasi pengembalian, memakai jadwal laboratorium, dan melengkapi data ruangan.',
    downloadName: 'Panduan Laboran.pdf',
};

const SUPER_ADMIN_MANUAL: StafManual = {
    url: SUPER_ADMIN_MANUAL_URL,
    title: 'Panduan Super Admin',
    description: 'Pelajari pengelolaan ruangan, akun, template dokumen, periode akademik, arsip, batas waktu pemeriksaan, serta pemantauan surat dan aktivitas sistem.',
    downloadName: 'Panduan Super Admin.pdf',
};

const KEPALA_LAB_MANUAL: StafManual = {
    url: KEPALA_LAB_MANUAL_URL,
    title: 'Panduan Kepala Laboratorium',
    description: 'Pelajari cara meninjau pengajuan peminjaman laboratorium, meninjau aktivitas lab, memantau kondisi kunci dan pengembalian, memakai kalender, dan mengelola ruangan.',
    downloadName: 'Panduan Kepala Laboratorium.pdf',
};

export const stafManualFor = (role: string, tendikRole: string = currentTendikRole()): StafManual => {
    if (role === 'super_admin') return SUPER_ADMIN_MANUAL;
    if (!ACADEMIC_ROLES.includes(role) && tendikRole === 'sarpras') return SARPRAS_MANUAL;
    if (!ACADEMIC_ROLES.includes(role) && tendikRole === 'laboran') return LABORAN_MANUAL;
    if (!ACADEMIC_ROLES.includes(role) && tendikRole === 'kepala_lab') return KEPALA_LAB_MANUAL;
    return stafManualForPersuratanOrAkademik(role);
};

const stafManualForPersuratanOrAkademik = (role: string): StafManual => ACADEMIC_ROLES.includes(role)
    ? {
        url: PEJABAT_AKADEMIK_MANUAL_URL,
        title: 'Panduan Pejabat Akademik',
        description: 'Pelajari cara meninjau, menolak, dan menyetujui pengajuan surat, memantau surat berjalan, serta memperbarui profil.',
        downloadName: 'Panduan Pejabat Akademik.pdf',
    }
    : {
        url: TENDIK_PERSURATAN_MANUAL_URL,
        title: 'Panduan Tenaga Kependidikan',
        description: 'Pelajari cara memverifikasi pengajuan, meminta perbaikan, menolak atau menyetujui surat, memantau surat berjalan, serta memperbarui profil.',
        downloadName: 'Panduan Tenaga Kependidikan.pdf',
    };

export const renderPanduanStaf = (role: string): void => {
    const manual = stafManualFor(role);
    const content = `
        <section class="mx-auto max-w-7xl space-y-5" aria-labelledby="panduan-staf-title">
            <div class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div class="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-teal-600">Panduan Pengguna</p>
                        <h2 id="panduan-staf-title" class="mt-1 text-xl font-bold text-gray-900">${manual.title}</h2>
                        <p class="mt-1 max-w-2xl text-sm leading-6 text-gray-500">${manual.description}</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <a id="panduan-open-full" href="${manual.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-300">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3h7v7"></path><path d="M10 14 21 3"></path><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path></svg>
                            Lihat Penuh
                        </a>
                        <a id="panduan-download" href="${manual.url}" download="${manual.downloadName}" class="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-200">
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
                    <object id="panduan-pdf-preview" data="${manual.url}#view=FitH" type="application/pdf" aria-label="Preview PDF ${manual.title}" class="h-[70vh] min-h-[520px] w-full rounded-xl bg-white shadow-inner">
                        <div class="flex min-h-[420px] flex-col items-center justify-center rounded-xl bg-white px-6 text-center">
                            <p class="text-base font-semibold text-gray-800">Preview PDF tidak didukung oleh browser ini.</p>
                            <p class="mt-2 text-sm text-gray-500">Gunakan tombol Lihat Penuh atau Unduh PDF untuk membaca panduan.</p>
                            <a href="${manual.url}" target="_blank" rel="noopener noreferrer" class="mt-4 rounded-xl bg-primary-teal px-4 py-2.5 text-sm font-semibold text-white">Buka Panduan</a>
                        </div>
                    </object>
                </div>
            </div>
        </section>
    `;

    renderDashboardLayout('Panduan', content, role, 'panduan');

    if (typeof document === 'undefined') return;

    // Same fallback as the mahasiswa guide: the <object> load event is
    // unreliable for PDFs, so a timeout also removes the spinner.
    const hideLoading = () => {
        document.getElementById('panduan-pdf-loading')?.remove();
    };
    document.getElementById('panduan-pdf-preview')?.addEventListener('load', hideLoading, { once: true });
    setTimeout(hideLoading, 2500);
};
