import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch, openAuthFile } from '../shared/api-client';
import { attachProtectedPdfViewer, renderProtectedPdfViewer } from '../shared/protected-pdf-viewer';
import { getLetterStatusLabel, getLetterStatusTone, LETTER_WORKFLOW_STATUS } from '../shared/letter-workflow';
import { showError, showSuccess, showWarning } from '../shared/toast';
import {
    activePageForReviewerOrigin,
    goToReviewerOrigin,
    resolveReviewerOrigin,
    type ReviewerOrigin,
    type ReviewerNavigationOptions,
} from '../shared/reviewer-navigation';

type MagangReviewResponse = {
    application: MagangApplication;
};

type MagangApplication = {
    id: number;
    status?: string | null;
    // Legacy aggregate fields, retained for read of old records.
    nama_penerima?: string | null;
    alamat_perusahaan?: string | null;
    rentang_tanggal?: string | null;
    nomor_surat?: string | null;
    // Final structured contract.
    jabatan_penerima?: string | null;
    nama_perusahaan?: string | null;
    alamat_jalan?: string | null;
    alamat_kelurahan?: string | null;
    alamat_kecamatan?: string | null;
    alamat_kota_kabupaten?: string | null;
    alamat_provinsi?: string | null;
    kode_pos?: string | null;
    tgl_mulai?: string | null;
    tgl_selesai?: string | null;
    nomor_surat_pengantar?: string | null;
    nomor_surat_tugas?: string | null;
    peran?: string | null;
    dosen_pembimbing_dpa?: string | null;
    proposal_kegiatan_magang_path?: string | null;
    revision_note?: string | null;
    rejection_reason?: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    mahasiswa_profile?: StudentProfile | null;
    user?: StudentUser | null;
    assigned_tendik?: StudentUser | null;
};

type StudentProfile = {
    nama_lengkap?: string | null;
    nim?: string | null;
    fakultas?: string | null;
    program_studi?: string | null;
    email?: string | null;
    no_telp?: string | null;
};

type StudentUser = {
    name?: string | null;
    email?: string | null;
    study_program?: {
        id?: number | null;
        code?: string | null;
        name?: string | null;
        department?: {
            id?: number | null;
            code?: string | null;
            name?: string | null;
            faculty?: {
                id?: number | null;
                code?: string | null;
                name?: string | null;
            } | null;
        } | null;
    } | null;
};

const GENERATED_LETTER_PREVIEW_ROOT_ID = 'magang-tendik-generated-letter-preview';
let revokeGeneratedLetterPreview: (() => void) | null = null;

const PHASE_BEARING_STATUSES: readonly string[] = [
    LETTER_WORKFLOW_STATUS.SUBMITTED,
    LETTER_WORKFLOW_STATUS.APPROVED_TENDIK,
    LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI,
    LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW,
    LETTER_WORKFLOW_STATUS.COMPLETED,
    LETTER_WORKFLOW_STATUS.REVISION,
    LETTER_WORKFLOW_STATUS.REJECTED,
];

const hasGeneratedPreview = (status?: string | null): boolean =>
    typeof status === 'string' && PHASE_BEARING_STATUSES.includes(status);

const renderGeneratedLetterPreviewCard = (): string =>
    renderProtectedPdfViewer(GENERATED_LETTER_PREVIEW_ROOT_ID, {
        title: 'Pratinjau Surat Pengantar Magang',
        subtitle: 'Pratinjau PDF sesuai tahap pengajuan saat ini',
        loading: 'Memuat pratinjau surat...',
    });

const attachGeneratedLetterPreview = (applicationId: number): void => {
    cleanupGeneratedLetterPreview();
    revokeGeneratedLetterPreview = attachProtectedPdfViewer({
        rootId: GENERATED_LETTER_PREVIEW_ROOT_ID,
        endpointUrl: `/api/tendik/surat-pengantar-magang/${applicationId}/generated-preview`,
    });
};

const cleanupGeneratedLetterPreview = (): void => {
    if (!revokeGeneratedLetterPreview) return;
    revokeGeneratedLetterPreview();
    revokeGeneratedLetterPreview = null;
};

export const renderReviewSuratPengantarMagang = async (applicationId: number, options?: ReviewerNavigationOptions) => {
    const origin = resolveReviewerOrigin(options);
    const activePage = activePageForReviewerOrigin(origin);
    const role = localStorage.getItem('auth_role') || 'tendik';

    renderDashboardLayout(
        'Review Dokumen',
        '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-800"></div></div>',
        role,
        activePage
    );

    try {
        const response = await apiFetch(`/api/tendik/surat-pengantar-magang/${applicationId}`);
        const data = await response.json() as MagangReviewResponse & { message?: string };

        if (!response.ok) {
            throw new Error(data.message || 'Gagal mengambil data pengajuan magang');
        }

        const app = data.application;
        const profile = app.mahasiswa_profile;
        const studentName = valueOrDash(profile?.nama_lengkap || app.user?.name);
        const studentEmail = valueOrDash(profile?.email || app.user?.email);
        // Canonical academic display: prefer the relation tree over legacy text columns.
        const canonicalProdi = app.user?.study_program?.name ?? profile?.program_studi ?? null;
        const canonicalFakultas = app.user?.study_program?.department?.faculty?.name ?? profile?.fakultas ?? null;
        const canonicalDepartemen = app.user?.study_program?.department?.name ?? null;
        const proposalUrl = storageUrl(app.proposal_kegiatan_magang_path);
        const canAct = app.status === LETTER_WORKFLOW_STATUS.SUBMITTED;

        const content = `
            <div class="w-full max-w-5xl mx-auto pb-20 animate-fade-in space-y-6">
                <div class="flex items-center gap-4 mb-2">
                    <button id="back-to-document-list" class="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" aria-label="Kembali ke daftar dokumen">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-800">Review Surat Pengantar Magang</h1>
                        <p class="text-xs text-gray-500 mt-1">Data pengajuan ditampilkan untuk verifikasi Tendik.</p>
                    </div>
                </div>

                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
                    <div class="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 bg-[#F8FAFC]/50">
                        Data Mahasiswa
                    </div>
                    <div class="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${renderInfoBox('Nama Lengkap', studentName)}
                        ${renderInfoBox('NIM', valueOrDash(profile?.nim))}
                        ${renderInfoBox('Program Studi', valueOrDash(canonicalProdi))}
                        ${renderInfoBox('Fakultas', valueOrDash(canonicalFakultas))}
                        ${renderInfoBox('Departemen', valueOrDash(canonicalDepartemen))}
                        ${renderInfoBox('Email', studentEmail)}
                        ${renderInfoBox('No. Telepon', valueOrDash(profile?.no_telp))}
                    </div>
                </div>

                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
                    <div class="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 bg-[#F8FAFC]/50">
                        Detail Pengajuan
                    </div>
                    <div class="p-6 md:p-8 space-y-5">
                        <div class="flex flex-wrap items-center gap-3">
                            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</span>
                            <span class="${statusClass(app.status)}">${statusLabel(app.status)}</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${renderInfoBox('Jabatan Penerima / Tujuan Surat', valueOrDash(app.jabatan_penerima || app.nama_penerima))}
                            ${renderInfoBox('Nama Perusahaan/Instansi', valueOrDash(app.nama_perusahaan))}
                            ${renderInfoBox('Posisi Magang', valueOrDash(app.peran))}
                            ${renderInfoBox('Tanggal Mulai Magang', formatBirthDate(app.tgl_mulai))}
                            ${renderInfoBox('Tanggal Selesai Magang', formatBirthDate(app.tgl_selesai))}
                            ${renderInfoBox('Dosen Pembimbing Akademik / DPA', valueOrDash(app.dosen_pembimbing_dpa))}
                            ${renderInfoBox('Nomor Surat Pengantar', valueOrDash(app.nomor_surat_pengantar || app.nomor_surat))}
                            ${renderInfoBox('Nomor Surat Tugas', valueOrDash(app.nomor_surat_tugas))}
                        </div>
                        ${renderStructuredAddress(app)}
                        ${(!app.tgl_mulai && !app.tgl_selesai && app.rentang_tanggal) ? `
                            <div class="border border-amber-100 bg-amber-50 rounded-xl px-4 py-3">
                                <label class="block text-[10px] font-medium text-amber-700 capitalize mb-1">Rentang Tanggal (data lama)</label>
                                <p class="text-sm font-semibold text-amber-900">${escapeHtml(valueOrDash(app.rentang_tanggal))}</p>
                            </div>
                        ` : ''}
                        <div class="pt-2 border-t border-gray-100 border-dashed text-xs text-gray-500 font-medium">
                            Tanggal Pengajuan: ${formatDate(app.submitted_at || app.created_at)}
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
                    <div class="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 bg-[#F8FAFC]/50">
                        Dokumen Pendukung
                    </div>
                    <div class="p-6 md:p-8">
                        ${proposalUrl ? `
                            <button onclick="window.__openAuthFile('${proposalUrl}')" class="inline-flex items-center gap-3 p-4 bg-[#115E59] text-white rounded-xl shadow-sm border border-[#115E59] hover:bg-[#0d4a46] transition-colors min-w-[260px] text-left">
                                <span class="w-8 h-8 rounded border border-white/20 flex items-center justify-center shrink-0">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                </span>
                                <span>
                                    <span class="block text-xs font-bold leading-tight">Proposal Kegiatan Magang</span>
                                    <span class="block text-[10px] opacity-80 mt-0.5">${escapeHtml(fileNameFromPath(app.proposal_kegiatan_magang_path))}</span>
                                </span>
                            </button>
                        ` : `
                            <p class="text-sm font-semibold text-gray-400">Proposal kegiatan magang belum tersedia.</p>
                        `}
                    </div>
                </div>

                ${app.revision_note || app.rejection_reason ? `
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
                        <div class="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 bg-[#F8FAFC]/50">
                            Catatan Pengajuan
                        </div>
                        <div class="p-6 md:p-8 space-y-4">
                            ${app.revision_note ? renderNotice('Catatan Revisi', app.revision_note, 'bg-yellow-50 border-yellow-200 text-yellow-900') : ''}
                            ${app.rejection_reason ? renderNotice('Alasan Penolakan', app.rejection_reason, 'bg-red-50 border-red-200 text-red-700') : ''}
                        </div>
                    </div>
                ` : ''}

                ${hasGeneratedPreview(app.status) ? `
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
                        <div class="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 bg-[#F8FAFC]/50">
                            Pratinjau Dokumen
                        </div>
                        <div class="p-6 md:p-8">
                            ${renderGeneratedLetterPreviewCard()}
                        </div>
                    </div>
                ` : ''}

                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <p class="text-sm font-bold text-gray-800 mb-2">Tindakan Verifikasi</p>
                    ${canAct ? `
                        <div class="space-y-4">
                            <button id="magang-revise-btn" type="button" class="w-full py-3.5 bg-[#FACC15] hover:bg-[#EAB308] text-yellow-900 font-bold rounded-xl transition-colors border border-[#EAB308]/50 shadow-sm active:scale-[0.98]">
                                Minta Perbaikan Dokumen (Revisi)
                            </button>
                            <button id="magang-reject-btn" type="button" class="w-full py-3.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold rounded-xl transition-colors shadow-sm active:scale-[0.98]">
                                Tolak Pengajuan Surat
                            </button>
                            <button id="magang-approve-btn" type="button" class="w-full py-3.5 bg-[#115E59] hover:bg-[#0d4a46] text-white font-bold rounded-xl transition-colors shadow-sm active:scale-[0.98]">
                                Setujui dan Teruskan ke Pimpinan
                            </button>
                            <div class="mt-4 bg-[#FEF9C3]/50 border border-[#FEF08A] rounded-xl p-4 text-xs font-medium text-amber-900 shadow-inner">
                                <p><span class="font-bold">Catatan:</span> Pastikan data dan proposal sudah sesuai sebelum melanjutkan. Nomor surat wajib diisi manual saat menyetujui pengajuan.</p>
                            </div>
                        </div>
                    ` : `
                        <p class="text-xs text-gray-500 leading-relaxed">
                            Pengajuan berada pada status <span class="font-bold">${statusLabel(app.status)}</span>, sehingga tindakan Tendik tidak tersedia.
                        </p>
                    `}
                </div>
            </div>
            ${canAct ? renderActionModals(app, studentName, valueOrDash(profile?.nim)) : ''}
        `;

        renderDashboardLayout('Review Dokumen', content, role, activePage);
        (window as any).__openAuthFile = openAuthFile;
        document.getElementById('back-to-document-list')?.addEventListener('click', () => {
            cleanupGeneratedLetterPreview();
            void goToReviewerOrigin(origin, role);
        });

        if (hasGeneratedPreview(app.status)) {
            attachGeneratedLetterPreview(applicationId);
        } else {
            cleanupGeneratedLetterPreview();
        }

        if (canAct) {
            bindActionHandlers(applicationId, role, origin);
        }
    } catch (error) {
        cleanupGeneratedLetterPreview();
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data';
        renderDashboardLayout(
            'Error',
            `<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">${escapeHtml(message)}</div>`,
            role,
            'dokumen'
        );
    }
};

function renderActionModals(app: MagangApplication, studentName: string, nim: string): string {
    const letterType = 'Surat Pengantar Magang';
    const target = valueOrDash(app.nama_perusahaan);

    return `
        ${renderApprovalModal(studentName, nim, letterType, target)}
        ${renderTextActionModal({
            id: 'magang-revision-modal',
            title: 'Permintaan Perbaikan Dokumen',
            headerClass: 'bg-[#FACC15] text-gray-900',
            label: 'Catatan Revisi untuk Mahasiswa',
            placeholder: 'Contoh: Proposal kegiatan magang belum lengkap. Mohon unggah kembali dokumen yang sesuai.',
            helper: 'Tuliskan instruksi revisi secara jelas agar mahasiswa mengetahui bagian yang perlu diperbaiki.',
            confirmId: 'magang-confirm-revise',
            cancelId: 'magang-cancel-revise',
            textareaId: 'magang-revision-note',
            confirmText: 'Kirim Permintaan Revisi',
            confirmClass: 'bg-[#FACC15] hover:bg-[#EAB308] text-yellow-900 border border-[#0D4A46]',
            studentName,
            nim,
            letterType,
        })}
        ${renderTextActionModal({
            id: 'magang-rejection-modal',
            title: 'Tolak Pengajuan Surat',
            headerClass: 'bg-[#EF4444] text-white',
            label: 'Alasan Penolakan',
            placeholder: 'Contoh: Data yang diajukan tidak valid dan tidak dapat diproses lebih lanjut.',
            helper: 'Berikan penjelasan yang jelas mengapa pengajuan ditolak secara permanen.',
            confirmId: 'magang-confirm-reject',
            cancelId: 'magang-cancel-reject',
            textareaId: 'magang-rejection-reason',
            confirmText: 'Ya, Tolak Permanen',
            confirmClass: 'bg-[#EF4444] hover:bg-[#DC2626] text-white',
            studentName,
            nim,
            letterType,
        })}
    `;
}

function renderApprovalModal(studentName: string, nim: string, letterType: string, target: string): string {
    return `
        <div id="magang-approval-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="magang-approval-title">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div class="bg-[#115E59] px-8 py-5 text-white">
                    <h3 id="magang-approval-title" class="text-lg font-bold">Konfirmasi Persetujuan</h3>
                </div>
                <div class="p-8 space-y-6">
                    <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-900">
                        <p class="font-bold text-sm">Dokumen telah diverifikasi</p>
                        <p class="text-xs leading-relaxed mt-1">Anda akan meneruskan pengajuan surat ini ke Kaprodi/Sekprodi. Pastikan semua data sudah benar dan lengkap.</p>
                    </div>
                    <div class="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                        ${renderModalRow('Mahasiswa', studentName)}
                        ${renderModalRow('NIM', nim)}
                        ${renderModalRow('Jenis Surat', letterType)}
                        ${renderModalRow('Tujuan', target)}
                    </div>
                    <div class="space-y-2">
                        <label for="magang-nomor-surat-pengantar" class="text-[11px] font-black text-gray-500 uppercase tracking-widest pl-1">Nomor Surat Pengantar</label>
                        <input
                            id="magang-nomor-surat-pengantar"
                            type="text"
                            placeholder="Contoh: 123/UN1.P.III/TM.03/2026"
                            class="w-full px-5 py-3.5 bg-white border-2 border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-sm text-sm font-medium"
                        >
                    </div>
                    <div class="space-y-2">
                        <label for="magang-nomor-surat-tugas" class="text-[11px] font-black text-gray-500 uppercase tracking-widest pl-1">Nomor Surat Tugas</label>
                        <input
                            id="magang-nomor-surat-tugas"
                            type="text"
                            placeholder="Contoh: 456/UN1.P.III/TM.03/2026"
                            class="w-full px-5 py-3.5 bg-white border-2 border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-sm text-sm font-medium"
                        >
                        <p class="text-[10px] text-gray-400 pl-1 italic">Kedua nomor surat diinput manual oleh Tendik dan akan digunakan pada dokumen final.</p>
                    </div>
                </div>
                <div class="px-8 pb-8 flex gap-3">
                    <button id="magang-cancel-approve" type="button" class="flex-1 px-6 py-3.5 border-2 border-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-colors text-sm shadow-sm">
                        Batal
                    </button>
                    <button id="magang-confirm-approve" type="button" class="flex-[1.5] px-6 py-3.5 bg-[#115E59] text-white font-bold rounded-2xl hover:bg-[#0d4a46] transition-all shadow-lg active:scale-[0.98] text-sm">
                        Ya, Teruskan ke Kaprodi
                    </button>
                </div>
            </div>
        </div>
    `;
}

type TextActionModalConfig = {
    id: string;
    title: string;
    headerClass: string;
    label: string;
    placeholder: string;
    helper: string;
    confirmId: string;
    cancelId: string;
    textareaId: string;
    confirmText: string;
    confirmClass: string;
    studentName: string;
    nim: string;
    letterType: string;
};

function renderTextActionModal(config: TextActionModalConfig): string {
    return `
        <div id="${config.id}" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="${config.id}-title">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
                <div class="${config.headerClass} px-8 py-5">
                    <h3 id="${config.id}-title" class="text-lg font-bold">${escapeHtml(config.title)}</h3>
                </div>
                <div class="p-8 space-y-6">
                    ${config.id === 'magang-rejection-modal' ? `
                        <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-900 text-xs leading-relaxed">
                            <p class="font-bold text-sm mb-1">PERHATIAN - Tindakan Permanen:</p>
                            <p>Pengajuan akan ditolak permanen dan mahasiswa harus mengajukan ulang dari awal dengan persyaratan yang benar.</p>
                        </div>
                    ` : ''}
                    <div class="text-sm text-gray-700">
                        <p>Mahasiswa: <span class="font-bold">${escapeHtml(config.studentName)}</span> (${escapeHtml(config.nim)})</p>
                        <p>Jenis Surat: <span class="font-bold">${escapeHtml(config.letterType)}</span></p>
                    </div>
                    <div class="space-y-2">
                        <label for="${config.textareaId}" class="block text-sm font-bold text-gray-700">${escapeHtml(config.label)} *</label>
                        <textarea
                            id="${config.textareaId}"
                            rows="4"
                            placeholder="${escapeHtml(config.placeholder)}"
                            class="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm resize-none"
                        ></textarea>
                        <p class="text-xs font-medium text-gray-600">${escapeHtml(config.helper)}</p>
                    </div>
                </div>
                <div class="px-8 pb-8 flex gap-3">
                    <button id="${config.cancelId}" type="button" class="flex-1 px-6 py-3.5 border-2 border-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-colors text-sm">
                        Batal
                    </button>
                    <button id="${config.confirmId}" type="button" class="flex-[1.2] px-6 py-3.5 font-bold rounded-2xl transition-all active:scale-[0.98] text-sm ${config.confirmClass}">
                        ${escapeHtml(config.confirmText)}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderModalRow(label: string, value: string): string {
    return `
        <div class="flex justify-between gap-4 text-[11px]">
            <span class="text-gray-400 font-bold uppercase tracking-wider">${escapeHtml(label)}</span>
            <span class="text-gray-700 font-bold text-right">${escapeHtml(value)}</span>
        </div>
    `;
}

function bindActionHandlers(applicationId: number, role: string, origin: ReviewerOrigin): void {
    bindModalOpenClose('magang-approve-btn', 'magang-approval-modal', 'magang-cancel-approve');
    bindModalOpenClose('magang-revise-btn', 'magang-revision-modal', 'magang-cancel-revise');
    bindModalOpenClose('magang-reject-btn', 'magang-rejection-modal', 'magang-cancel-reject');

    document.getElementById('magang-confirm-approve')?.addEventListener('click', async () => {
        const nomorSuratPengantar = readTextareaOrInput('magang-nomor-surat-pengantar');
        const nomorSuratTugas = readTextareaOrInput('magang-nomor-surat-tugas');
        if (!nomorSuratPengantar) {
            showWarning('Nomor Surat Pengantar wajib diisi manual oleh Tendik.');
            return;
        }
        if (!nomorSuratTugas) {
            showWarning('Nomor Surat Tugas wajib diisi manual oleh Tendik.');
            return;
        }
        if (nomorSuratPengantar === nomorSuratTugas) {
            showWarning('Nomor Surat Pengantar dan Nomor Surat Tugas tidak boleh sama.');
            return;
        }

        await submitMagangAction({
            applicationId,
            role,
            origin,
            endpoint: 'approve',
            payload: {
                nomor_surat_pengantar: nomorSuratPengantar,
                nomor_surat_tugas: nomorSuratTugas,
            },
            buttonId: 'magang-confirm-approve',
            successFallback: 'Pengajuan berhasil diverifikasi dan diteruskan.',
        });
    });

    document.getElementById('magang-confirm-revise')?.addEventListener('click', async () => {
        const note = readTextareaOrInput('magang-revision-note');
        if (!note) {
            showWarning('Catatan revisi wajib diisi.');
            return;
        }

        await submitMagangAction({
            applicationId,
            role,
            origin,
            endpoint: 'revise',
            payload: { note },
            buttonId: 'magang-confirm-revise',
            successFallback: 'Permintaan revisi berhasil dikirim.',
        });
    });

    document.getElementById('magang-confirm-reject')?.addEventListener('click', async () => {
        const reason = readTextareaOrInput('magang-rejection-reason');
        if (!reason) {
            showWarning('Alasan penolakan wajib diisi.');
            return;
        }

        await submitMagangAction({
            applicationId,
            role,
            origin,
            endpoint: 'reject',
            payload: { reason },
            buttonId: 'magang-confirm-reject',
            successFallback: 'Pengajuan berhasil ditolak.',
        });
    });

    document.addEventListener('keydown', function closeMagangModalsWithEsc(event) {
        if (event.key === 'Escape') {
            closeAllMagangModals();
        }
    }, { once: true });
}

function bindModalOpenClose(buttonId: string, modalId: string, cancelId: string): void {
    document.getElementById(buttonId)?.addEventListener('click', () => {
        document.getElementById(modalId)?.classList.remove('hidden');
    });

    document.getElementById(cancelId)?.addEventListener('click', () => {
        document.getElementById(modalId)?.classList.add('hidden');
    });
}

type SubmitActionOptions = {
    applicationId: number;
    role: string;
    origin: ReviewerOrigin;
    endpoint: 'approve' | 'revise' | 'reject';
    payload: Record<string, string>;
    buttonId: string;
    successFallback: string;
};

async function submitMagangAction(options: SubmitActionOptions): Promise<void> {
    const button = document.getElementById(options.buttonId) as HTMLButtonElement | null;
    const originalText = button?.innerHTML || '';

    if (button) {
        button.disabled = true;
        button.innerHTML = 'Memproses...';
    }

    try {
        const response = await apiFetch(`/api/tendik/surat-pengantar-magang/${options.applicationId}/${options.endpoint}`, {
            method: 'PATCH',
            body: JSON.stringify(options.payload),
        });
        const result = await response.json() as { message?: string; errors?: Record<string, string[]> };

        if (!response.ok) {
            throw new Error(errorMessageFromResponse(result));
        }

        showSuccess(result.message || options.successFallback);
        closeAllMagangModals();
        cleanupGeneratedLetterPreview();
        void goToReviewerOrigin(options.origin, options.role);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal memproses pengajuan';
        showError(message);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

function readTextareaOrInput(id: string): string {
    const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    return field?.value.trim() || '';
}

function closeAllMagangModals(): void {
    ['magang-approval-modal', 'magang-revision-modal', 'magang-rejection-modal'].forEach((id) => {
        document.getElementById(id)?.classList.add('hidden');
    });
}

function errorMessageFromResponse(result: { message?: string; errors?: Record<string, string[]> }): string {
    if (result.message) {
        return result.message;
    }

    const firstError = Object.values(result.errors || {})[0]?.[0];
    return firstError || 'Gagal memproses pengajuan';
}

function renderInfoBox(label: string, value: string): string {
    return `
        <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
            <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">${escapeHtml(label)}</label>
            <p class="text-sm font-semibold text-gray-800">${escapeHtml(value)}</p>
        </div>
    `;
}

function renderStructuredAddress(app: MagangApplication): string {
    const hasStructured = Boolean(
        app.alamat_jalan
        || app.alamat_kelurahan
        || app.alamat_kecamatan
        || app.alamat_kota_kabupaten
        || app.alamat_provinsi
        || app.kode_pos
    );

    if (hasStructured) {
        return `
            <div class="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Alamat Perusahaan</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${renderInfoBox('Alamat Jalan', valueOrDash(app.alamat_jalan || app.alamat_perusahaan))}
                    ${renderInfoBox('Kelurahan/Desa', valueOrDash(app.alamat_kelurahan))}
                    ${renderInfoBox('Kecamatan', valueOrDash(app.alamat_kecamatan))}
                    ${renderInfoBox('Kota/Kabupaten', valueOrDash(app.alamat_kota_kabupaten))}
                    ${renderInfoBox('Provinsi', valueOrDash(app.alamat_provinsi))}
                    ${renderInfoBox('Kode Pos', valueOrDash(app.kode_pos))}
                </div>
            </div>
        `;
    }

    return `
        <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
            <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">Alamat Perusahaan</label>
            <p class="text-sm font-semibold text-gray-800 whitespace-pre-line">${escapeHtml(valueOrDash(app.alamat_perusahaan))}</p>
        </div>
    `;
}

function formatBirthDate(value?: string | null): string {
    if (!value) return '-';
    const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0] || value;
    const [year, month, day] = iso.split('-');
    if (!year || !month || !day) return value;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderNotice(title: string, message: string, classes: string): string {
    return `
        <div class="rounded-xl border p-4 ${classes}">
            <p class="text-xs font-black uppercase tracking-wider mb-1">${escapeHtml(title)}</p>
            <p class="text-sm font-semibold whitespace-pre-line">${escapeHtml(message)}</p>
        </div>
    `;
}

function valueOrDash(value?: string | null): string {
    const trimmed = value?.trim();
    return trimmed || '-';
}

function formatDate(value?: string | null): string {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function fileNameFromPath(path?: string | null): string {
    if (!path) {
        return '-';
    }

    const cleanPath = path.split('?')[0] || path;
    return cleanPath.split('/').pop() || cleanPath;
}

function storageUrl(path?: string | null): string {
    if (!path) {
        return '';
    }

    if (path.startsWith('/api/storage/') || path.startsWith('/storage/')) {
        return path.startsWith('/storage/') ? `/api${path}` : path;
    }

    const cleanPath = path.replace(/^\/+/, '').replace(/^storage\//, '');
    return `/api/storage/${cleanPath}`;
}

function statusLabel(status?: string | null): string {
    return getLetterStatusLabel(status, 'tendik-review') || valueOrDash(status);
}

function statusClass(status?: string | null): string {
    const base = 'inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold border';
    return `${base} ${getLetterStatusTone(status, 'tendik-review')}`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
