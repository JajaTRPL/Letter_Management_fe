import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import Toastify from 'toastify-js';

export const renderReviewScholarship = async (appId: number) => {
    const role = localStorage.getItem('auth_role') || 'tendik';
    const token = localStorage.getItem('auth_token');

    // Show loading state
    renderDashboardLayout('Review Dokumen', '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-800"></div></div>', role, 'dokumen');

    const isAcademic = ['akademik', 'kaprodi', 'sekprodi', 'kadep', 'sekdep'].includes(role);
    const apiPrefix = isAcademic ? 'akademik' : 'tendik';

    try {
        const response = await fetch(`/api/${apiPrefix}/scholarship/${appId}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") === -1) {
            const text = await response.text();
            console.error("Non-JSON response:", text);
            throw new Error("Server mengembalikan format non-JSON (Kemungkinan error Laravel)");
        }

        const data = await response.json();
        
        if (!response.ok) throw new Error(data.message || 'Gagal mengambil data');

        const { student, docx_url, application } = data;

        const content = `
            <div class="w-full max-w-6xl mx-auto pb-20 animate-fade-in">
                <!-- Header with Back Button -->
                <div class="mb-8 flex items-center justify-between">
                    <button id="back-to-list" class="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-semibold">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Kembali ke Daftar
                    </button>
                    <div class="flex items-center gap-4 text-xs font-medium text-gray-400">
                        <span>Diajukan pada: ${student.submitted_at}</span>
                        <span class="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span class="text-teal-600 font-bold uppercase tracking-wider">${student.target}</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Left Column: Student Info -->
                    <div class="lg:col-span-1 space-y-6">
                        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div class="flex flex-col items-center text-center mb-6">
                                <div class="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 mb-4 bg-gray-100 flex items-center justify-center">
                                    <img src="${student.photo || '/avatar-placeholder.png'}" alt="Photo" class="w-full h-full object-cover">
                                </div>
                                <h2 class="text-xl font-bold text-gray-800">${student.name}</h2>
                                <p class="text-sm font-medium text-gray-500">${student.nim}</p>
                            </div>

                            <div class="space-y-4">
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">PROGRAM STUDI</p>
                                    <p class="text-sm font-semibold text-gray-700">${student.prodi}</p>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">EMAIL / TELEPON</p>
                                    <p class="text-sm font-semibold text-gray-700 truncate">${student.email}</p>
                                    <p class="text-xs text-gray-500 mt-0.5">${student.phone}</p>
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">IPK</p>
                                        <p class="text-sm font-bold text-teal-700">${student.ipk}</p>
                                    </div>
                                    <div>
                                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">SEMESTER</p>
                                        <p class="text-sm font-semibold text-gray-700">${student.term.split('Semester')[1] || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                            <p class="text-xs font-bold text-gray-600 mb-4">DOKUMEN YANG DIUNGGAH:</p>
                            <div class="space-y-3">
                                <div onclick="window.open('${docx_url}', '_blank')" class="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-teal-600/20 shadow-sm cursor-pointer hover:bg-teal-50/50 transition-all group">
                                    <div class="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center text-teal-700 group-hover:bg-teal-100 transition-colors">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-xs font-bold text-gray-800 truncate">Formulir Pengajuan</p>
                                        <p class="text-[10px] text-gray-400 uppercase font-medium">OTOMATIS GENERATED</p>
                                    </div>
                                    <div class="text-teal-600 group-hover:scale-110 transition-transform">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    </div>
                                </div>
                                
                                ${application?.transkrip_nilai_path ? `
                                <div onclick="window.open('/api/storage/${application.transkrip_nilai_path.replace('/storage/', '')}', '_blank')" class="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-all group">
                                    <div class="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-600 group-hover:bg-red-100 transition-colors">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-xs font-bold text-gray-800 truncate">Transkrip Nilai</p>
                                        <p class="text-[10px] text-gray-400 uppercase font-medium">UNGGAHAN MAHASISWA</p>
                                    </div>
                                    <div class="text-teal-600 group-hover:scale-110 transition-transform">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    </div>
                                </div>
                                ` : ''}

                                ${application?.slip_gaji_ayah_path ? `
                                <div onclick="window.open('/api/storage/${application.slip_gaji_ayah_path.replace('/storage/', '')}', '_blank')" class="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-all group">
                                    <div class="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-xs font-bold text-gray-800 truncate">Slip Gaji Ayah</p>
                                        <p class="text-[10px] text-gray-400 uppercase font-medium">UNGGAHAN MAHASISWA</p>
                                    </div>
                                    <div class="text-teal-600 group-hover:scale-110 transition-transform">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    </div>
                                </div>
                                ` : ''}

                                ${application?.slip_gaji_ibu_path ? `
                                <div onclick="window.open('/api/storage/${application.slip_gaji_ibu_path.replace('/storage/', '')}', '_blank')" class="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-all group">
                                    <div class="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-xs font-bold text-gray-800 truncate">Slip Gaji Ibu</p>
                                        <p class="text-[10px] text-gray-400 uppercase font-medium">UNGGAHAN MAHASISWA</p>
                                    </div>
                                    <div class="text-teal-600 group-hover:scale-110 transition-transform">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Document Preview and Actions -->
                    <div class="lg:col-span-2 space-y-6">
                        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[650px]">
                            <div class="px-6 py-4 border-b border-gray-100 bg-[#F8FAFC]/50 flex justify-between items-center">
                                <h2 class="text-base font-bold text-gray-800">Preview Formulir Pengajuan</h2>
                                <span class="bg-teal-50 text-teal-700 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase border border-teal-100">Format .docx</span>
                            </div>
                            <div class="flex-1 bg-gray-50 flex items-center justify-center p-4 relative capitalize">
                                <div onclick="window.open('${docx_url}', '_blank')" class="bg-white w-full max-w-[500px] h-full shadow-lg rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all group">
                                    <div class="w-24 h-24 bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl flex items-center justify-center text-teal-700 mb-8 shadow-sm group-hover:from-teal-100 group-hover:to-teal-200 transition-colors">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>
                                    </div>
                                    <h3 class="text-xl font-bold text-gray-800 mb-2">Formulir Pengajuan Beasiswa</h3>
                                    <p class="text-sm text-gray-500 mb-2 max-w-sm">Dokumen formulir pengajuan telah di-generate secara otomatis oleh sistem dalam format Microsoft Word (.docx)</p>
                                    <p class="text-xs text-gray-400 mb-8">Klik area ini atau tombol di bawah untuk mendownload</p>
                                    <div class="px-8 py-3.5 bg-teal-800 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-teal-900 transition-all flex items-center gap-3 group-hover:bg-teal-900">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Download & Tinjau Dokumen
                                    </div>
                                    <p class="mt-8 text-[10px] text-gray-400 italic font-medium">Klik untuk mendownload & buka di Microsoft Word</p>
                                </div>
                            </div>
                        </div>


                        <!-- Verification Actions -->
                        <div class="bg-teal-900 rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                            <div class="relative z-10">
                                <h3 class="text-xl font-bold mb-1">Tindakan Verifikasi</h3>
                                <p class="text-teal-200/80 text-sm">Berikan keputusan untuk pengajuan beasiswa ini setelah memeriksa kelengkapan data.</p>
                            </div>
                            <div class="flex items-center gap-4 relative z-10">
                                <button id="revise-btn" class="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95">
                                    Minta Perbaikan
                                </button>
                                <button id="reject-btn" class="px-6 py-3 bg-white/10 hover:bg-red-500/20 text-white border border-white/20 rounded-xl font-bold text-sm transition-all active:scale-95">
                                    Tolak
                                </button>
                                <button id="approve-btn" class="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/30 active:scale-95">
                                    Setuju
                                </button>
                            </div>
                            <!-- Background Decoration -->
                            <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderDashboardLayout('Review Dokumen', content, role, 'dokumen');

        // Back Event
        document.getElementById('back-to-list')?.addEventListener('click', () => {
            if (isAcademic) {
                import('../dashboard/AkademikDashboard').then(({ renderAkademikDashboard }) => {
                    renderAkademikDashboard(role);
                });
            } else {
                import('./DokumenTendik').then(({ renderDokumenTendik }) => {
                    renderDokumenTendik(role);
                });
            }
        });

        // Verification Actions
        document.getElementById('approve-btn')?.addEventListener('click', async () => {
            if (confirm('Apakah Anda yakin ingin menyetujui pendaftaran ini?')) {
                try {
                    const res = await fetch(`/api/${apiPrefix}/scholarship/${appId}/approve`, {
                        method: 'PATCH',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    });

                    const result = await res.json();
                    
                    if (res.ok) {
                        Toastify({ text: result.message || "Pendaftaran berhasil disetujui!", style: { background: "#10B981" } }).showToast();
                        document.getElementById('back-to-list')?.click();
                    } else {
                        console.error('Approval failed:', result);
                        alert(`Gagal menyetujui: ${result.message || 'Error tidak diketahui'}`);
                    }
                } catch (e) {
                    console.error('Fetch error:', e);
                    alert("Gagal menghubungi server. Pastikan koneksi internet aktif.");
                }
            }
        });

        document.getElementById('reject-btn')?.addEventListener('click', async () => {
            if (confirm('Apakah Anda yakin ingin menolak pendaftaran ini?')) {
                try {
                    const res = await fetch(`/api/${apiPrefix}/scholarship/${appId}/reject`, {
                        method: 'PATCH',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    });
                    if (res.ok) {
                        Toastify({ text: "Pendaftaran berhasil ditolak", style: { background: "#EF4444" } }).showToast();
                        document.getElementById('back-to-list')?.click();
                    }
                } catch (e) {
                    Toastify({ text: "Terjadi kesalahan", style: { background: "#EF4444" } }).showToast();
                }
            }
        });

        document.getElementById('revise-btn')?.addEventListener('click', async () => {
            const note = prompt('Masukkan catatan revisi untuk mahasiswa:');
            if (note !== null) {
                try {
                    const res = await fetch(`/api/${apiPrefix}/scholarship/${appId}/revise`, {
                        method: 'PATCH',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ note })
                    });
                    if (res.ok) {
                        Toastify({ text: "Permintaan revisi berhasil dikirim!", style: { background: "#F59E0B" } }).showToast();
                        document.getElementById('back-to-list')?.click();
                    }
                } catch (e) {
                    Toastify({ text: "Terjadi kesalahan", style: { background: "#EF4444" } }).showToast();
                }
            }
        });

    } catch (error: any) {
        renderDashboardLayout('Error', `<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">${error.message}</div>`, role, 'dokumen');
    }
};
