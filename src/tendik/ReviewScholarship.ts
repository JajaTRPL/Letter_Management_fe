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

        const angkatanMatch = student.term.match(/Angkatan \\d+/);
        const semesterMatch = student.term.match(/Semester \\d+/);
        const angkatan = angkatanMatch ? angkatanMatch[0] : 'Angkatan -';
        const semester = semesterMatch ? semesterMatch[0] : 'Semester -';

        const content = `
            <div class="w-full max-w-5xl mx-auto pb-20 animate-fade-in space-y-6">
                <!-- Header with Back Button -->
                <div class="flex items-center gap-4 mb-2">
                    <button id="back-to-list" class="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <h1 class="text-2xl font-bold text-gray-800">Review Dokumen</h1>
                </div>

                <!-- Data Mahasiswa Section -->
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
                    <div class="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 bg-[#F8FAFC]/50">
                        Data Mahasiswa
                    </div>
                    <div class="p-6 md:p-8 space-y-6">
                        <!-- Profile Header -->
                        <div class="flex items-center gap-5">
                            <div class="w-[72px] h-[72px] rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
                                <img src="${student.photo || '/avatar-placeholder.png'}" alt="Photo" class="w-full h-full object-cover">
                            </div>
                            <div>
                                <h2 class="text-lg font-bold text-gray-800">${student.name}</h2>
                                <p class="text-xs font-semibold text-gray-500 mb-2">${student.nim}</p>
                                <div class="flex gap-2">
                                    <span class="bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">${angkatan}</span>
                                    <span class="bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">${semester}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Info Forms -->
                        <div class="space-y-4">
                            <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
                                <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">Program Studi</label>
                                <p class="text-sm font-semibold text-gray-800">${student.prodi}</p>
                            </div>
                            <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
                                <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">Email</label>
                                <p class="text-sm font-semibold text-gray-800">${student.email}</p>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
                                    <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">IPK</label>
                                    <p class="text-sm font-semibold text-gray-800">${student.ipk}</p>
                                </div>
                                <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
                                    <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">Telepon</label>
                                    <p class="text-sm font-semibold text-gray-800">${student.phone}</p>
                                </div>
                            </div>
                            <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
                                <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">Keperluan Surat</label>
                                <p class="text-sm font-semibold text-gray-800">${application.scholarship_name || student.target}</p>
                            </div>
                        </div>

                        <div class="pt-4 border-t border-gray-100 border-dashed text-xs text-gray-500 font-medium">
                            Tanggal Pengajuan: ${student.submitted_at}
                        </div>
                    </div>
                </div>

                <!-- Dokumen Yang Diunggah Section -->
                <div class="pt-2">
                    <p class="text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wider">DOKUMEN YANG DIUNGGAH:</p>
                    <p class="text-xs text-gray-400 mb-4">Klik dokumen untuk melihat pratinjau</p>
                    
                    <div class="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                        <!-- Formulir Pengajuan (Active by default for visual match) -->
                        <button onclick="window.open('${docx_url}', '_blank')" class="flex items-center gap-3 p-3 bg-[#115E59] text-white rounded-xl shadow-sm border border-[#115E59] hover:bg-[#0d4a46] transition-colors min-w-[220px] flex-shrink-0 text-left">
                            <div class="w-8 h-8 rounded border border-white/20 flex flex-col items-center justify-center shrink-0">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            </div>
                            <div class="flex-1">
                                <p class="text-xs font-bold leading-tight">Formulir Pengajuan</p>
                                <p class="text-[10px] opacity-80 mt-0.5">3 Halaman</p>
                            </div>
                        </button>
                        
                        ${application?.transkrip_nilai_path ? `
                        <button onclick="window.open('/api/storage/${application.transkrip_nilai_path.replace('/storage/', '')}', '_blank')" class="flex items-center gap-3 p-3 bg-white text-gray-700 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors min-w-[220px] flex-shrink-0 text-left">
                            <div class="w-8 h-8 rounded border border-gray-200 flex flex-col items-center justify-center shrink-0">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            </div>
                            <div class="flex-1">
                                <p class="text-xs font-bold leading-tight">Transkrip Nilai</p>
                                <p class="text-[10px] text-gray-400 mt-0.5">1 Halaman</p>
                            </div>
                        </button>
                        ` : ''}

                        ${application?.slip_gaji_ayah_path || application?.slip_gaji_ibu_path ? `
                        <button onclick="window.open('/api/storage/${(application.slip_gaji_ayah_path || application.slip_gaji_ibu_path).replace('/storage/', '')}', '_blank')" class="flex items-center gap-3 p-3 bg-white text-gray-700 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors min-w-[220px] flex-shrink-0 text-left">
                            <div class="w-8 h-8 rounded border border-gray-200 flex flex-col items-center justify-center shrink-0">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            </div>
                            <div class="flex-1">
                                <p class="text-xs font-bold leading-tight">Slip Gaji/Penghasilan</p>
                                <p class="text-[10px] text-gray-400 mt-0.5">1 Halaman</p>
                            </div>
                        </button>
                        ` : ''}

                    </div>

                    <!-- Preview Container -->
                    <div class="bg-[#A4C2B4] rounded-2xl p-4 overflow-hidden shadow-sm mt-2 relative">
                        <div class="flex justify-between items-center bg-[#A4C2B4]/80 p-2 text-white mb-2">
                             <div class="flex items-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D3748" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                <div class="text-[#2D3748]">
                                    <p class="text-xs font-bold">Preview Formulir Pengajuan</p>
                                    <p class="text-[10px]">Halaman 1 dari 3</p>
                                </div>
                             </div>
                             <div class="flex gap-2">
                                <button class="w-7 h-7 bg-white rounded flex items-center justify-center text-gray-600 hover:bg-gray-100"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
                                <span class="bg-white rounded px-2 flex items-center text-xs font-bold text-gray-600">100%</span>
                                <button class="w-7 h-7 bg-white rounded flex items-center justify-center text-gray-600 hover:bg-gray-100"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
                                <button onclick="window.open('${docx_url}', '_blank')" class="w-7 h-7 bg-white rounded flex items-center justify-center text-gray-600 hover:bg-gray-100 ml-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
                             </div>
                        </div>
                        
                        <!-- Dummy Doc Display -->
                        <div class="bg-white rounded-lg p-10 h-[500px] shadow-sm flex flex-col items-center justify-center text-center mx-auto" style="width: 80%;">
                            <p class="text-sm font-bold text-gray-800 mb-2">Dokumen DOCX Automatis</p>
                            <p class="text-xs text-gray-500 mb-6 max-w-sm">Preview langsung untuk dokumen DOCX tidak didukung secara native. Silakan download untuk melihat format utuhnya.</p>
                            <button onclick="window.open('${docx_url}', '_blank')" class="px-6 py-3 bg-[#115E59] text-white rounded-lg font-bold text-xs shadow-sm hover:bg-[#0d4a46] transition-colors">Unduh Dokumen (.docx)</button>
                        </div>
                        
                        <!-- Controls Bottom -->
                        <div class="flex justify-between mt-4 px-2">
                             <button class="bg-white text-[#115E59] px-4 py-1.5 rounded-full text-xs font-bold border border-[#115E59]/20 hover:bg-white/90">Sebelumnya</button>
                             <div class="flex items-center gap-2 text-xs font-medium text-[#2D3748]">
                                <span class="bg-white px-2 py-0.5 rounded shadow-sm">1</span> / 3
                             </div>
                             <button class="bg-[#115E59] text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-[#0d4a46]">Selanjutnya</button>
                        </div>
                    </div>
                </div>

                <!-- Tindakan Verifikasi -->
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
                    <div class="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 bg-[#F8FAFC]/50">
                        Tindakan Verifikasi
                    </div>
                    <div class="p-6 md:p-8 space-y-4">
                        ${!isAcademic ? `
                        <button id="revise-btn" class="w-full py-3.5 bg-[#FACC15] hover:bg-[#EAB308] text-yellow-900 font-bold rounded-xl transition-colors border border-[#EAB308]/50 shadow-sm active:scale-[0.98]">
                            Minta Perbaikan Dokumen (Revisi)
                        </button>
                        ` : ''}
                        <button id="reject-btn" class="w-full py-3.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold rounded-xl transition-colors shadow-sm active:scale-[0.98]">
                            Tolak Pengajuan Surat
                        </button>
                        <button id="approve-btn" class="w-full py-3.5 bg-[#115E59] hover:bg-[#0d4a46] text-white font-bold rounded-xl transition-colors shadow-sm active:scale-[0.98]">
                            ${isAcademic ? 'Setujui dan Teruskan ke Pimpinan Selanjutnya' : 'Setujui dan Teruskan ke Pimpinan'}
                        </button>
                        
                        <div class="mt-4 bg-[#FEF9C3]/50 border border-[#FEF08A] rounded-xl p-4 text-xs font-medium text-amber-900 flex gap-3 shadow-inner">
                            <p><span class="font-bold">Catatan:</span> Pastikan seluruh dokumen telah sesuai dengan persyaratan sebelum melanjutkan. Jika terdapat kesalahan, gunakan tombol ${isAcademic ? '"Tolak Pengajuan Surat" untuk memberi arahan kepada Tenaga Pendidik dan Mahasiswa.' : '"Minta Perbaikan Dokumen" untuk memberi arahan kepada mahasiswa.'}</p>
                        </div>
                    </div>
                </div>

                <!-- Riwayat Pengajuan -->
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
                    <div class="px-6 py-4 font-bold text-gray-800 flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Riwayat Pengajuan
                    </div>
                    <div class="p-6 pt-0">
                        <div class="relative pl-6 border-l-2 border-[#115E59] space-y-6 pb-2">
                            <!-- Step 1 -->
                            <div class="relative">
                                <div class="absolute -left-[31px] bg-[#115E59] rounded-full p-0.5 border-4 border-white">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <p class="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">${student.submitted_at || 'Baru Saja'}</p>
                                <p class="text-sm font-bold text-gray-800">Pengajuan Diterima</p>
                            </div>
                            
                            ${isAcademic ? `
                            <!-- Step 2 (Tendik Approved) -->
                            <div class="relative">
                                <div class="absolute -left-[31px] bg-[#115E59] rounded-full p-0.5 border-4 border-white">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <p class="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">Telah Diverifikasi</p>
                                <p class="text-sm font-bold text-gray-800">Dokumen Telah Diverifikasi Oleh Tendik</p>
                            </div>
                            ${['kadep', 'sekdep'].includes(localStorage.getItem('auth_sub_role') || '') ? `
                            <!-- Step 3 (Kaprodi Approved) -->
                            <div class="relative">
                                <div class="absolute -left-[31px] bg-[#115E59] rounded-full p-0.5 border-4 border-white">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <p class="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">Telah Diverifikasi</p>
                                <p class="text-sm font-bold text-gray-800">Dokumen Telah Disetujui Oleh Kaprodi TRPL</p>
                            </div>
                            <!-- Step 4 -->
                            <div class="relative">
                                <div class="absolute -left-[31px] bg-white border-2 border-yellow-400 w-5 h-5 rounded-full z-10 flex items-center justify-center">
                                     <div class="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                                </div>
                                <p class="text-sm font-medium text-gray-500 mt-1">Menunggu Tanda Tangan Kadept TEDI</p>
                            </div>
                            ` : `
                            <!-- Step 3 -->
                            <div class="relative">
                                <div class="absolute -left-[31px] bg-white border-2 border-yellow-400 w-5 h-5 rounded-full z-10 flex items-center justify-center">
                                     <div class="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                                </div>
                                <p class="text-sm font-medium text-gray-500 mt-1">Menunggu Paraf Kaprodi TRPL</p>
                            </div>
                            `}
                            ` : `
                            <!-- Step 2 -->
                            <div class="relative">
                                <div class="absolute -left-[31px] bg-white border-2 border-yellow-400 w-5 h-5 rounded-full z-10 flex items-center justify-center">
                                     <div class="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                                </div>
                                <p class="text-sm font-medium text-gray-500 mt-1">Menunggu Verifikasi Tenaga Pendidik</p>
                            </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;


        renderDashboardLayout('Review Dokumen', content, role, 'dokumen');

        // Modal for Approval
        const modalHtml = `
            <div id="approval-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in">
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
                    <!-- Modal Header -->
                    <div class="bg-[#115E59] px-8 py-5 text-white">
                        <h3 class="text-lg font-bold">Konfirmasi Persetujuan</h3>
                    </div>
                    
                    <!-- Modal Body -->
                    <div class="p-8 space-y-6">
                        <!-- Alert Box (Yellow) -->
                        <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4 text-amber-800">
                            <div class="mt-0.5">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            </div>
                            <div class="text-xs space-y-1">
                                <p class="font-bold">Dokumen telah diverifikasi</p>
                                <p class="opacity-90 leading-relaxed text-[11px]">Anda akan meneruskan pengajuan surat ini ke <strong>${isAcademic ? 'Kadept' : 'Kaprodi'}</strong> untuk ditandatangani. Pastikan semua dokumen sudah benar dan lengkap.</p>
                            </div>
                        </div>

                        <!-- Info Grid -->
                        <div class="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                            <div class="flex justify-between items-center text-[11px]">
                                <span class="text-gray-400 font-bold uppercase tracking-wider">Mahasiswa</span>
                                <span class="text-gray-700 font-bold">${student.name}</span>
                            </div>
                            <div class="flex justify-between items-center text-[11px]">
                                <span class="text-gray-400 font-bold uppercase tracking-wider">NIM</span>
                                <span class="text-gray-700 font-bold">${student.nim}</span>
                            </div>
                            <div class="flex justify-between items-center text-[11px]">
                                <span class="text-gray-400 font-bold uppercase tracking-wider">Jenis Surat</span>
                                <span class="text-gray-700 font-bold">Surat Permohonan Beasiswa</span>
                            </div>
                            <div class="flex justify-between items-center text-[11px]">
                                <span class="text-gray-400 font-bold uppercase tracking-wider">Tujuan</span>
                                <span class="text-gray-700 font-bold">${application.scholarship_name || student.target}</span>
                            </div>
                        </div>

                        ${!isAcademic ? `
                        <!-- Number Input -->
                        <div class="space-y-2">
                            <label class="text-[11px] font-black text-gray-500 uppercase tracking-widest pl-1">Tambahkan Nomor Surat</label>
                            <input 
                                type="text" 
                                id="input-nomor-surat" 
                                placeholder="Isi Nomor Surat"
                                class="w-full px-5 py-3.5 bg-white border-2 border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-sm text-sm font-medium"
                            >
                            <p class="text-[10px] text-gray-400 pl-1 italic">Nomor surat akan digunakan untuk proses administrasi selanjutnya</p>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Modal Actions -->
                    <div class="px-8 pb-8 flex gap-3">
                        <button id="cancel-modal" class="flex-1 px-6 py-3.5 border-2 border-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-colors text-sm shadow-sm">
                            Batal
                        </button>
                        <button id="confirm-approve" class="flex-[1.5] px-6 py-3.5 bg-[#115E59] text-white font-bold rounded-2xl hover:bg-[#0d4a46] transition-all shadow-lg active:scale-[0.98] text-sm">
                            Ya, Teruskan ke ${isAcademic ? 'Kadept' : 'Kaprodi'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

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
        document.getElementById('approve-btn')?.addEventListener('click', () => {
            document.getElementById('approval-modal')?.classList.remove('hidden');
        });

        document.getElementById('cancel-modal')?.addEventListener('click', () => {
            document.getElementById('approval-modal')?.classList.add('hidden');
        });

        // Overlay click-to-dismiss removed to prevent accidental closure

        // ESC key to close approval modal
        document.addEventListener('keydown', function approvalEsc(e) {
            const modal = document.getElementById('approval-modal');
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });

        document.getElementById('confirm-approve')?.addEventListener('click', async () => {
            let bodyData = {};
            if (!isAcademic) {
                const nomorSurat = (document.getElementById('input-nomor-surat') as HTMLInputElement)?.value;
                if (!nomorSurat) {
                    alert('Tolong isi nomor surat terlebih dahulu.');
                    return;
                }
                bodyData = { nomor_surat: nomorSurat };
            }

            const btn = document.getElementById('confirm-approve') as HTMLButtonElement;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="animate-spin mr-2">⏳</span> Memproses...';
            btn.disabled = true;

            try {
                const res = await fetch(`/api/${apiPrefix}/scholarship/${appId}/approve`, {
                    method: 'PATCH',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: Object.keys(bodyData).length > 0 ? JSON.stringify(bodyData) : undefined
                });

                const result = await res.json();
                
                if (res.ok) {
                    Toastify({ text: result.message || "Pendaftaran berhasil disetujui!", style: { background: "#10B981" } }).showToast();
                    document.getElementById('approval-modal')?.remove();
                    document.getElementById('back-to-list')?.click();
                } else {
                    console.error('Approval failed:', result);
                    alert(`Gagal menyetujui: ${result.message || 'Error tidak diketahui'}`);
                }
            } catch (e) {
                console.error('Fetch error:', e);
                alert("Gagal menghubungi server. Pastikan koneksi internet aktif.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
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
