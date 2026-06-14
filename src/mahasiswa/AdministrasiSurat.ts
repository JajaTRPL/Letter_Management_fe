import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderMahasiswaDashboard } from '../dashboard/MahasiswaDashboard';
import { renderScholarshipForm } from './ScholarshipForm';
import { renderSuratPengantarMagangForm } from './SuratPengantarMagangForm';
import { renderSuratKeteranganAktifForm } from './SuratKeteranganAktifForm';
import { renderProsesLuarNegeriForm } from './ProsesLuarNegeriForm';
import { renderSuratTugasForm } from './SuratTugasForm';
import Toastify from 'toastify-js';
import { apiFetch } from '../shared/api-client';
import { ADMINISTRASI_LETTER_CARDS, renderLetterCard } from '../shared/letter-presentation';

export const renderAdministrasiSurat = () => {
    const content = `
        <div class="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">

            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-3xl font-bold text-gray-800 tracking-tight">Administrasi Surat</h2>
                    <p class="text-gray-500 mt-2">Pilih jenis surat yang ingin Anda ajukan.</p>
                </div>
                <button id="btn-back-dashboard-dokumen" class="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm text-sm">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Kembali ke Dashboard
                </button>
            </div>

            <!-- Jenis Surat Grid. Each card's distinct accent + icon identity is
                 presentation-only metadata in letter-presentation; the page keeps
                 the card/duration ids and click → form dispatch below. -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${ADMINISTRASI_LETTER_CARDS.map(renderLetterCard).join('')}
            </div>
        </div>
    `;

    renderDashboardLayout('Administrasi Surat', content, 'mahasiswa', 'administrasi');

    setTimeout(() => {
        document.getElementById('btn-back-dashboard-dokumen')?.addEventListener('click', () => {
            renderMahasiswaDashboard();
        });

        // Fetch dynamic duration estimates
        fetchDurationEstimates();

        const handleCardClick = async (callback?: () => void) => {
            try {
                const res = await apiFetch('/api/profile');
                if (res.ok) {
                    const data = await res.json();
                    if (data.completeness && !data.completeness.is_complete) {
                        Toastify({
                            text: "⚠️ Mohon lengkapi profil Anda terlebih dahulu sebelum mengajukan surat.",
                            duration: 4000,
                            gravity: "top",
                            position: "right",
                            style: { background: "#F59E0B" }
                        }).showToast();

                        import('./ProfilMahasiswa').then(({ renderProfilMahasiswa }) => {
                            renderProfilMahasiswa();
                        });
                        return;
                    }
                }
            } catch (e) {
                console.error('Error checking completeness:', e);
            }
            if (callback) callback();
            else {
                Toastify({
                    text: "Fitur surat ini segera hadir.",
                    duration: 2000,
                    gravity: "top",
                    position: "right",
                    style: { background: "#6b7280" }
                }).showToast();
            }
        };

        // Bind all cards
        document.querySelectorAll('.doc-card').forEach(card => {
            card.addEventListener('click', () => {
                if (card.id === 'card-beasiswa') {
                    handleCardClick(() => renderScholarshipForm());
                } else if (card.id === 'card-magang') {
                    handleCardClick(() => renderSuratPengantarMagangForm());
                } else if (card.id === 'card-aktif') {
                    handleCardClick(() => renderSuratKeteranganAktifForm());
                } else if (card.id === 'card-luar-negeri') {
                    handleCardClick(() => renderProsesLuarNegeriForm());
                } else if (card.id === 'card-surat-tugas') {
                    handleCardClick(() => renderSuratTugasForm());
                } else {
                    handleCardClick();
                }
            });
        });
    }, 100);
};

/**
 * Fetch average duration data from API and update card badges.
 * On failure, static fallback labels remain in place (no-op).
 */
const fetchDurationEstimates = async () => {
    try {
        const res = await apiFetch('/api/surat/average-duration');
        if (!res.ok) return;

        const data: Record<string, { value: number | null; source: string; label: string | null }> = await res.json();

        // Clock icon SVG (reused in each badge)
        const clockSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';

        for (const [type, info] of Object.entries(data)) {
            const el = document.getElementById(`duration-${type}`);
            if (!el) continue;

            if (info.source === 'dynamic' && info.value !== null && info.value > 0) {
                // Round to nearest integer for clean display
                const rounded = Math.round(info.value);
                const display = rounded < 1 ? '<1' : `~${rounded}`;
                el.innerHTML = `${clockSvg} ${display} Hari Kerja`;
            } else if (info.source === 'fallback' && info.label) {
                el.innerHTML = `${clockSvg} ${info.label}`;
            }
            // else: keep existing static text (safe no-op)
        }
    } catch (e) {
        // Silently fail — static fallback labels remain
        console.error('Duration fetch failed (using fallback):', e);
    }
};
