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

            <!-- SUBMIT / EDIT BUTTONS -->
            <div class="pt-6 border-t border-gray-200 flex justify-end gap-4" id="action-buttons-container">
                <button type="button" id="btn-edit-profil" class="px-8 py-3 bg-white border border-gray-200 text-teal-600 font-bold rounded-xl hover:bg-teal-50 hover:border-teal-200 transition-all shadow-sm flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Edit Profil
                </button>
                <button type="button" id="btn-batal-edit" class="hidden px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                    Batal
                </button>
                <button type="submit" id="btn-simpan-profil" class="hidden px-8 py-3 bg-primary-teal text-white font-bold rounded-xl hover:bg-teal-800 transition-colors shadow-sm focus:ring-4 focus:ring-teal-100 flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Simpan Perubahan
                </button>
            </div>
        </form>
    </div>
`;
