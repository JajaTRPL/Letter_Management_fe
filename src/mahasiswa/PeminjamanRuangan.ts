import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderMahasiswaDashboard } from '../dashboard/MahasiswaDashboard';
import Toastify from 'toastify-js';

export const renderPeminjamanRuangan = () => {
    const content = `
        <div class="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">

            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-3xl font-bold text-gray-800 tracking-tight">Peminjaman Ruangan</h2>
                    <p class="text-gray-500 mt-2">Pilih jenis ruangan yang ingin Anda pinjam.</p>
                </div>
                <button id="btn-back-dashboard-peminjaman" class="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm text-sm">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Kembali ke Dashboard
                </button>
            </div>

            <!-- Jenis Ruangan Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

                <!-- Peminjaman Ruang Kelas -->
                <div class="room-card bg-white rounded-[24px] p-8 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group">
                    <div class="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 mb-1">Peminjaman Ruang Kelas</h3>
                    <p class="text-sm text-gray-500 mb-4">Ajukan peminjaman ruang kelas untuk kegiatan akademik atau organisasi.</p>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        1-2 Hari Kerja
                    </span>
                </div>

                <!-- Peminjaman Ruang Laboratorium -->
                <div class="room-card bg-white rounded-[24px] p-8 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-200 cursor-pointer group">
                    <div class="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 3h6v11l-3 3-3-3z"></path>
                            <path d="M6 21h12"></path>
                            <path d="M3 9h4"></path>
                            <path d="M17 9h4"></path>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 mb-1">Peminjaman Ruang Laboratorium</h3>
                    <p class="text-sm text-gray-500 mb-4">Ajukan peminjaman ruang laboratorium untuk praktikum atau riset.</p>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        2-3 Hari Kerja
                    </span>
                </div>

            </div>

            <!-- Calendar Placeholder -->
            <div class="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100 mt-2">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-gray-800">Kalender Ketersediaan Ruangan</h3>
                        <p class="text-sm text-gray-400">Coming Soon</p>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-2xl p-12 flex flex-col items-center justify-center border border-dashed border-gray-200">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <p class="text-sm text-gray-400 mt-4 font-medium">Fitur kalender ketersediaan ruangan akan segera tersedia.</p>
                    <p class="text-xs text-gray-300 mt-1">Anda akan dapat melihat jadwal ketersediaan ruangan secara real-time.</p>
                </div>
            </div>
        </div>
    `;

    renderDashboardLayout('Peminjaman Ruangan', content, 'mahasiswa', 'peminjaman');

    setTimeout(() => {
        document.getElementById('btn-back-dashboard-peminjaman')?.addEventListener('click', () => {
            renderMahasiswaDashboard();
        });

        // Bind room cards
        document.querySelectorAll('.room-card').forEach(card => {
            card.addEventListener('click', () => {
                Toastify({
                    text: "Fitur peminjaman ruangan segera hadir.",
                    duration: 2000,
                    gravity: "top",
                    position: "right",
                    style: { background: "#6b7280" }
                }).showToast();
            });
        });
    }, 100);
};
