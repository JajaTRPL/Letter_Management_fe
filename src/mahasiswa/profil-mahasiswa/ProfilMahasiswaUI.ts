import { renderSectionSSO } from './ui/SectionSSO';
import { renderSectionDetail } from './ui/SectionDetail';
import { renderSectionKeluarga } from './ui/SectionKeluarga';
import { renderSectionSaudara } from './ui/SectionSaudara';
import { renderSectionBeasiswa } from './ui/SectionBeasiswa';

export const renderProfilMahasiswaUI = () => `
    <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
        
        <div class="flex justify-between items-end">
            <div>
                <h2 class="text-3xl font-bold text-gray-800 tracking-tight">Profil Mahasiswa</h2>
                <p class="text-gray-500 mt-2">Lengkapi data diri dan keluarga Anda di bawah ini untuk keperluan pengajuan surat.</p>
            </div>
            <button id="btn-back-dashboard" class="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm text-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Kembali ke Dashboard
            </button>
        </div>

        <form id="form-update-profil" class="space-y-8">
            
            ${renderSectionSSO()}
            ${renderSectionDetail()}
            ${renderSectionKeluarga()}
            ${renderSectionSaudara()}
            ${renderSectionBeasiswa()}

        </form>
    </div>
`;
