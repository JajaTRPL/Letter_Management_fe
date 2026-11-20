import { escapeFormHtml } from '../../shared/form-primitives';

// "Tinjau Pengajuan" step, same layout as the review step of SKA / Magang /
// Surat Tugas / PLN: tinted summary sections followed by the declaration
// checkbox. The checkbox keeps id="agree-terms" — ScholarshipForm gates the
// submit button on it.

const text = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

const formatRupiah = (value: unknown): string => {
    const raw = text(value);
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (!digits) return raw;
    return `Rp ${Number(digits).toLocaleString('id-ID')}`;
};

const renderReviewSection = (title: string, rows: Array<[string, string]>) => `
    <section class="bg-[#F0F8F7] rounded-2xl p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-5">${escapeFormHtml(title)}</h3>
        <div class="space-y-3">
            ${rows.map(([label, value]) => `
                <div class="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 text-sm text-gray-700">
                    <span class="font-semibold">${escapeFormHtml(label)}</span>
                    <span class="break-words">: ${escapeFormHtml(value || '-')}</span>
                </div>
            `).join('')}
        </div>
    </section>
`;

export const renderStep4Submit = (formData: any, supportingDocumentRows: Array<[string, string]> = []) => {
    const histories: any[] = Array.isArray(formData.scholarship_histories) ? formData.scholarship_histories : [];
    const hasHistory = formData.has_scholarship_history === true || String(formData.has_scholarship_history) === '1';
    const onLeave = text(formData.on_leave) || 'Belum';

    return `
        <div class="space-y-8">
            <div>
                <h2 class="text-2xl font-bold text-gray-800">Tinjau Pengajuan</h2>
                <p class="text-sm text-gray-600 mt-2">Periksa kembali kebenaran data yang Anda masukkan</p>
            </div>

            <div class="space-y-8">
                ${renderReviewSection('Profil SSO', [
                    ['Nama Lengkap', text(formData.full_name)],
                    ['NIM', text(formData.nim)],
                    ['Fakultas', text(formData.faculty)],
                    ['Program Studi', text(formData.study_program)],
                    ['Email Aktif', text(formData.email)],
                ])}
                ${renderReviewSection('Data Keluarga', [
                    ['Nama Ayah', text(formData.father_name)],
                    ['Penghasilan Ayah', formatRupiah(formData.father_income)],
                    ['Nama Ibu', text(formData.mother_name)],
                    ['Penghasilan Ibu', formatRupiah(formData.mother_income)],
                    ['Jumlah Saudara Kandung', String(Array.isArray(formData.siblings) ? formData.siblings.length : 0)],
                ])}
                ${renderReviewSection('Data Pengajuan & Akademik', [
                    ['Nama Beasiswa', text(formData.scholarship_name)],
                    ['Semester Saat Ini', text(formData.current_semester)],
                    ['Jumlah Tanggungan Keluarga', text(formData.family_dependents)],
                    ['IP 2 Semester Terakhir', text(formData.gpa_last_2_semesters)],
                    ['IPK', text(formData.ipk)],
                    ['SKS 2 Semester Terakhir', text(formData.sks_last_2_semesters)],
                    ['SKS Kumulatif', text(formData.total_sks_passed)],
                    ['Status Cuti Kuliah', onLeave === 'Sudah' && text(formData.leave_semester) ? `Sudah (semester ${text(formData.leave_semester)})` : onLeave],
                    ['Status Skripsi', text(formData.thesis_status) || 'Belum'],
                    ['Riwayat Menerima Beasiswa', hasHistory ? `Pernah (${histories.length} riwayat)` : 'Belum Pernah'],
                ])}
                ${supportingDocumentRows.length > 0 ? renderReviewSection('Dokumen Pendukung', supportingDocumentRows) : ''}
            </div>

            <label class="flex items-start gap-4 text-sm text-gray-700 cursor-pointer">
                <input id="agree-terms" type="checkbox" class="mt-1 w-4 h-4 rounded border-gray-300 text-primary-teal focus:ring-primary-teal">
                <span>Dengan ini saya menyatakan bahwa seluruh data yang saya kirimkan adalah benar dan dapat dipertanggungjawabkan</span>
            </label>
        </div>
    `;
};
