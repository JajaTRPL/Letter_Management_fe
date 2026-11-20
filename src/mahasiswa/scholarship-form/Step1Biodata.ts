import { escapeFormAttribute, escapeFormHtml, renderFormField } from '../../shared/form-primitives';

// Same "Profil SSO" read-only layout as SKA / Magang / Surat Tugas / PLN.
// The inputs keep their `name` attributes because saveStep1 posts
// nim / faculty / study_program from this form.
const renderReadonlyField = (label: string, name: string, value: unknown) => renderFormField({
    label,
    columnsClassName: 'grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2 md:gap-6 md:items-center',
    controlHtml: `<input type="text" name="${escapeFormAttribute(name)}" value="${escapeFormAttribute(String(value ?? ''))}" placeholder="-" readonly class="w-full px-4 py-2.5 bg-[#E1E3E8] border border-[#E1E3E8] rounded-lg text-gray-500 cursor-not-allowed outline-none">`,
});

export const renderStep1Biodata = (formData: any) => `
    <div class="space-y-8">
        <div>
            <h2 class="text-2xl font-bold text-gray-900">${escapeFormHtml('Profil SSO')}</h2>
            <p class="text-sm text-gray-600 mt-2">Periksa kesesuaian data profil dengan data yang terdaftar pada sistem</p>
        </div>
        <div class="space-y-4 max-w-4xl">
            ${renderReadonlyField('Nama Lengkap', 'full_name', formData.full_name)}
            ${renderReadonlyField('NIM', 'nim', formData.nim)}
            ${renderReadonlyField('Fakultas', 'faculty', formData.faculty)}
            ${renderReadonlyField('Program Studi', 'study_program', formData.study_program)}
            ${renderReadonlyField('Email Aktif', 'email', formData.email)}
        </div>
    </div>
`;
