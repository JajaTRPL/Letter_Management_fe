import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderMahasiswaDashboard } from '../dashboard/MahasiswaDashboard';
import { renderScholarshipForm } from './ScholarshipForm';
import Toastify from 'toastify-js';

export const renderDokumenMahasiswa = () => {
    const content = `
        <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">

            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-3xl font-bold text-gray-800 tracking-tight">Ajukan Surat</h2>
                    <p class="text-gray-500 mt-2">Pilih jenis surat yang ingin Anda ajukan.</p>
                </div>
                <button id="btn-back-dashboard-dokumen" class="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm text-sm">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Kembali ke Dashboard
                </button>
            </div>

            <!-- Jenis Surat Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                <!-- Surat Keterangan Aktif -->
                <div class="doc-card bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group">
                    <div class="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-100 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 mb-1">Surat Keterangan Aktif</h3>
                    <p class="text-sm text-gray-500 mb-4">Surat yang menerangkan bahwa Anda adalah mahasiswa aktif.</p>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        1-3 Hari Kerja
                    </span>
                </div>

                <!-- Surat Pengantar Magang -->
                <div class="doc-card bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group">
                    <div class="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 mb-1">Surat Pengantar Magang</h3>
                    <p class="text-sm text-gray-500 mb-4">Surat pengantar untuk keperluan kerja praktik atau magang.</p>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        2-5 Hari Kerja
                    </span>
                </div>

                <!-- Surat Permohonan Beasiswa -->
                <div id="card-beasiswa" class="doc-card bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group">
                    <div class="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="8" r="6"></circle>
                            <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"></path>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 mb-1">Surat Permohonan Beasiswa</h3>
                    <p class="text-sm text-gray-500 mb-4">Surat permohonan dari departemen untuk pengajuan beasiswa.</p>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        3-7 Hari Kerja
                    </span>
                </div>

                <!-- Surat Permohonan Penundaan Pembayaran UKT -->
                <div class="doc-card bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group">
                    <div class="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-rose-100 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 mb-1">Penundaan Bayar UKT</h3>
                    <p class="text-sm text-gray-500 mb-4">Permohonan penundaan pembayaran UKT per semester.</p>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        3-5 Hari Kerja
                    </span>
                </div>

                <!-- Surat Peminjaman Ruangan -->
                <div class="doc-card bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group">
                    <div class="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 mb-1">Peminjaman Ruangan</h3>
                    <p class="text-sm text-gray-500 mb-4">Surat izin peminjaman ruangan di lingkungan kampus.</p>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        1-2 Hari Kerja
                    </span>
                </div>

                <!-- Surat Proses Luar Negeri -->
                <div class="doc-card bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group">
                    <div class="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 mb-1">Proses Luar Negeri</h3>
                    <p class="text-sm text-gray-500 mb-4">Surat pengantar untuk keperluan visa atau studi ke luar negeri.</p>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        2-4 Hari Kerja
                    </span>
                </div>

                <!-- Surat Transkrip Nilai -->
                <div class="doc-card bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group">
                    <div class="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-100 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 mb-1">Transkrip Nilai</h3>
                    <p class="text-sm text-gray-500 mb-4">Permohonan transkrip nilai akademik sementara.</p>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        1-3 Hari Kerja
                    </span>
                </div>

            </div>
        </div>
    `;

    renderDashboardLayout('Ajukan Surat', content, 'mahasiswa', 'pengajuan');

    setTimeout(() => {
        document.getElementById('btn-back-dashboard-dokumen')?.addEventListener('click', () => {
            renderMahasiswaDashboard();
        });

        const handleCardClick = async (callback?: () => void) => {
            const token = localStorage.getItem('auth_token');
            try {
                const res = await fetch('/api/profile', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
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
                } else {
                    handleCardClick();
                }
            });
        });
    }, 100);
};
