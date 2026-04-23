import { renderDashboardLayout } from './DashboardLayout';
import { renderProfilMahasiswa } from '../mahasiswa/ProfilMahasiswa';
import { getGreetingName } from '../utils/nameHelper';

export const renderMahasiswaDashboard = () => {
    const content = `
        <div class="space-y-8">
            <!-- Greeting Banner -->
            <div class="bg-white rounded-[24px] p-8 text-white relative overflow-hidden shadow-lg border border-teal-800/30">
                <div class="relative z-10 flex flex-col gap-4">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div class="flex-1">
                            <h2 class="text-[32px] font-semibold text-gray-900 font-['Inter']">Halo, ${getGreetingName(localStorage.getItem('auth_name'))}! </h2>
                        </div>
                        <div>
                            <button id="btn-lengkapi-profil" class="font-['Inter'] hidden px-6 py-2.5 bg-primary-teal text-white font-semibold rounded-xl hover:bg-black hover:text-white transition-all duration-200 shadow-sm whitespace-nowrap">
                                Lengkapi Profil
                            </button>
                        </div>
                    </div>
                    <div id="profile-reminder-section" class="hidden transition-all duration-300">
                        <p id="profile-progress-text" class="font-['Inter'] font-normal text-sm text-gray-900 mb-3">Profil kamu baru terisi 0%. Lengkapi profil untuk mempercepat proses pengajuan surat.</p>
                        <div class="w-full">
                            <div class="h-2.5 w-full bg-gray-300 rounded-full overflow-hidden">
                                <div id="profile-progress-bar" class="h-full bg-primary-teal rounded-full w-[0%] shadow-[0_0_10px_rgba(255,255,255,0.4)] transition-all duration-500"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Decorative Elements -->
                <div class="absolute right-[-50px] top-[-50px] w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl"></div>
                <div class="absolute left-[-20px] bottom-[-20px] w-[150px] h-[150px] bg-white/5 rounded-full blur-2xl"></div>
            </div>

            <!-- Summary Status Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Diproses -->
                <div class="bg-[#F0F7F6] p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-md transition-shadow">
                    <div class="w-14 h-14 bg-[#3D4E4E]/5 rounded-xl flex items-center justify-center text-[#3D4E4E]">
                        <img src="proses-logo.png" class="w-14 h-14" />
                    </div>
                    <div>
                        <p class="text-3xl font-black text-green-800 leading-tight">2</p>
                        <p class="text-sm font-['Inter'] text-gray-500 font-normal">Sedang Diproses</p>
                    </div>
                </div>

                <!-- Butuh Revisi -->
                <div class="bg-[#FFF7ED] p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-md transition-shadow">
                    <div class="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                        <img src="revisi-logo.png" class="w-14 h-14" />
                    </div>
                    <div>
                        <p class="text-3xl font-black text-[#F59E0B] leading-tight">1</p>
                        <p class="text-sm font-['Inter'] text-gray-500 font-normal">Surat Butuh Revisi</p>
                    </div>
                </div>

                <!-- Selesai -->
                <div class="bg-[#ECFDF5] p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-md transition-shadow">
                    <div class="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                        <img src="selesai-logo.png" class="w-14 h-14" />
                    </div>
                    <div>
                        <p class="text-3xl font-black text-[#10B981] leading-tight">5</p>
                        <p class="text-sm font-['Inter'] text-gray-500 font-normal">Surat Selesai</p>
                    </div>
                </div>
            </div>

            <!-- Ajukan Surat Button -->
            <button id="btn-ajukan-surat" class="w-full py-4 bg-primary-teal text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-teal-800 transition-all duration-200 shadow-sm border border-teal-700/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Ajukan Surat Baru
            </button>

            <!-- Active Tracking Section -->
            <div>
                <h3 class="text-2xl font-normal text-gray-800 mb-6 flex items-center gap-2">
                    Pelacakan Pengajuan Aktif
                </h3>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <!-- Tracking Card 1 -->
                    <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div class="bg-primary-teal px-6 py-4">
                            <h4 class="font-['Inter'] font-normal text-white text-xl">Surat Rekomendasi - Beasiswa Djarum</h4>
                        </div>
                        <div class="p-8 flex-1">
                            <div class="relative flex justify-between items-start mb-12 px-2">
                                <!-- Connection Lines -->
                                <div class="absolute top-[18px] left-[10%] right-[10%] h-0.5 border-t-2 border-dashed border-gray-200 -z-0"></div>
                                <div class="absolute top-[18px] left-[10%] w-[35%] h-0.5 bg-emerald-500 -z-0"></div>
                                
                                <!-- Step 1 -->
                                <div class="relative z-10 flex flex-col items-center gap-3">
                                    <div class="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                    <span class="text-[10px] font-bold text-gray-600 text-center leading-tight">Diajukan</span>
                                </div>
                                
                                <!-- Step 2 -->
                                <div class="relative z-10 flex flex-col items-center gap-3">
                                    <div class="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                    <span class="text-[10px] font-bold text-gray-600 text-center leading-tight">Verifikasi<br>Tendik</span>
                                </div>
                                
                                <!-- Step 3 -->
                                <div class="relative z-10 flex flex-col items-center gap-3">
                                    <div class="w-9 h-9 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm animate-pulse">
                                        <div class="w-3 h-3 bg-amber-500 rounded-full"></div>
                                    </div>
                                    <span class="text-[10px] font-bold text-amber-600 text-center leading-tight">Menunggu<br>TTD Kaprodi</span>
                                </div>
                                
                                <!-- Step 4 -->
                                <div class="relative z-10 flex flex-col items-center gap-3 opacity-30">
                                    <div class="w-9 h-9 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center border-4 border-white"></div>
                                    <span class="text-[10px] font-bold text-gray-400 text-center leading-tight">TTD Kadep</span>
                                </div>
                                
                                <!-- Step 5 -->
                                <div class="relative z-10 flex flex-col items-center gap-3 opacity-30">
                                    <div class="w-9 h-9 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center border-4 border-white"></div>
                                    <span class="text-[10px] font-bold text-gray-400 text-center leading-tight">Selesai</span>
                                </div>
                            </div>
                            <button class="w-full py-3 bg-gray-500 text-white rounded-xl font-bold hover:bg-gray-600 transition-colors shadow-sm">
                                Lihat Detail
                            </button>
                        </div>
                    </div>

                    <!-- Tracking Card 2 -->
                    <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div class="bg-primary-teal px-6 py-4 text-white">
                            <h4 class="font-['Inter'] font-normal text-white text-xl">Surat Rekomendasi Magang - Shopee</h4>
                        </div>
                        <div class="p-8 flex-1">
                            <div class="relative flex justify-between items-start mb-8 px-2">
                                <!-- Connection Line -->
                                <div class="absolute top-[18px] left-[10%] right-[10%] h-0.5 border-t-2 border-dashed border-gray-200 -z-0"></div>
                                <div class="absolute top-[18px] left-[10%] w-[35%] h-0.5 bg-red-500 -z-0"></div>

                                <!-- Step 1 -->
                                <div class="relative z-10 flex flex-col items-center gap-3">
                                    <div class="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                    <span class="text-[10px] font-bold text-gray-600 text-center leading-tight">Diajukan</span>
                                </div>

                                <!-- Step 2 (Error) -->
                                <div class="relative z-10 flex flex-col items-center gap-3">
                                    <div class="w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center border-4 border-white shadow-md">
                                        <div class="w-3 h-3 bg-white rounded-full"></div>
                                    </div>
                                    <span class="text-[10px] font-bold text-red-600 text-center leading-tight">Ditolak<br>Tendik</span>
                                </div>

                                <!-- Others -->
                                <div class="relative z-10 flex flex-col items-center gap-3 opacity-20">
                                    <div class="w-9 h-9 bg-gray-100 rounded-full border-4 border-white"></div>
                                    <span class="text-[10px] font-bold text-gray-400">TTD Kaprodi</span>
                                </div>
                                <div class="relative z-10 flex flex-col items-center gap-3 opacity-20">
                                    <div class="w-9 h-9 bg-gray-100 rounded-full border-4 border-white"></div>
                                    <span class="text-[10px] font-bold text-gray-400">TTD Kadep</span>
                                </div>
                                <div class="relative z-10 flex flex-col items-center gap-3 opacity-20">
                                    <div class="w-9 h-9 bg-gray-100 rounded-full border-4 border-white"></div>
                                    <span class="text-[10px] font-bold text-gray-400">Selesai</span>
                                </div>
                            </div>
                            
                            <div class="bg-amber-50 rounded-xl p-4 mb-6 flex items-start gap-3 border border-amber-100">
                                <svg class="text-amber-500 mt-1 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                    <line x1="12" y1="9" x2="12" y2="13"></line>
                                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                <p class="text-xs font-semibold text-amber-800">Perhatian: <span class="font-medium text-amber-700">Ada dokumen tidak sesuai.</span></p>
                            </div>

                            <button class="w-full py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                LIHAT CATATAN REVISI & PERBAIKI
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recent History Section -->
            <div class="mt-8">
                <h3 class="text-2xl font-normal text-gray-800 mb-6 flex items-center gap-2">Riwayat Pengajuan</h3>
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left ">
                            <thead>
                                <tr class="text-[13px] font-['Inter'] font-medium text-gray-900 border-b border-gray-500">
                                    <th class="px-8 py-5 text-center">Tanggal Unggah</th>
                                    <th class="px-8 py-5 text-center">Nama Dokumen</th>
                                    <th class="px-8 py-5 text-center">Status</th>
                                    <th class="px-8 py-5 text-center">Detail</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                ${Array.from({ length: 4 }).map((_, i) => `
                                    <tr class="hover:bg-gray-50/50 transition-colors group">
                                        <td class="px-8 py-5 text-sm text-gray-400 font-['Inter'] font-normal text-center">Selasa, 24 Feb 2024</td>
                                        <td class="px-8 py-5 text-sm text-gray-900 font-['Inter'] font-normal text-center">Surat Rekomendasi Magang - Shopee</td>
                                        <td class="px-8 py-5 text-sm text-center">
                                            <span class="${i === 0 ? 'bg-teal-50 text-teal-600' : i === 1 ? 'bg-[#E0F2FE] text-[#0369A1]' : 'bg-[#FEE2E2] text-red-900'} px-4 py-1.5 rounded-full font-bold text-[11px] uppercase tracking-wider">
                                                ${i === 0 ? 'Selesai' : i === 1 ? 'Diproses' : 'Ditolak'}
                                            </span>
                                        </td>
                                        <td class="px-8 py-5">
                                            <div class="flex items-center justify-center gap-3 group-hover:opacity-100 transition-opacity">
                                                <button class="p-2 text-gray-400 hover:text-primary-teal transition-colors" title="Download">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                </button>
                                                <button class="p-2 text-gray-400 hover:text-primary-teal transition-colors" title="Detail">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    renderDashboardLayout('Dashboard', content, 'mahasiswa', 'dashboard');

    setTimeout(() => {
        const btnLengkapi = document.getElementById('btn-lengkapi-profil');
        if (btnLengkapi) {
            btnLengkapi.addEventListener('click', () => {
                renderProfilMahasiswa();
            });
        }

        const btnAjukan = document.getElementById('btn-ajukan-surat');
        if (btnAjukan) {
            btnAjukan.addEventListener('click', () => {
                import('../mahasiswa/DokumenMahasiswa').then(({ renderDokumenMahasiswa }) => {
                    renderDokumenMahasiswa();
                });
            });
        }

        async function fetchProfileProgress() {
            const token = localStorage.getItem('auth_token');
            if (!token) return;
            try {
                const res = await fetch('/api/profile', {
                    headers: { 'Authorization': 'Bearer ' + token },
                    cache: 'no-store'
                });
                if (res.ok) {
                    const data = await res.json();
                    const profile = data.profile;
                    if (profile) {
                        const requiredDetail = [
                            profile.tempat_lahir,
                            profile.tanggal_lahir,
                            profile.jenis_kelamin,
                            profile.no_hp,
                            profile.alamat_asal,
                            profile.alamat_domisili,
                            profile.pas_foto_path,
                            profile.tanda_tangan_path
                        ];

                        const ayah = profile.keluarga?.find((k: any) => k.jenis_relasi === 'ayah') || {};
                        const ibu = profile.keluarga?.find((k: any) => k.jenis_relasi === 'ibu') || {};

                        const requiredAyah = [ayah.nama_lengkap, ayah.pekerjaan, ayah.penghasilan, ayah.status_hidup];
                        const requiredIbu = [ibu.nama_lengkap, ibu.pekerjaan, ibu.penghasilan, ibu.status_hidup];

                        const allFields = [...requiredDetail, ...requiredAyah, ...requiredIbu];
                        const filledCount = allFields.filter(f => f && f.toString().trim() !== '').length;
                        const percent = Math.round((filledCount / allFields.length) * 100);

                        const txt = document.getElementById('profile-progress-text');
                        const bar = document.getElementById('profile-progress-bar');
                        const section = document.getElementById('profile-reminder-section');

                        if (txt) txt.innerText = `Profil kamu baru terisi ${percent}%. Lengkapi profil untuk mempercepat proses pengajuan surat.`;
                        if (bar) bar.style.width = `${percent}%`;

                        if (profile.pas_foto_path) {
                            localStorage.setItem('auth_photo', profile.pas_foto_path);
                            const headerAvatar = document.getElementById('header-user-avatar') as HTMLImageElement;
                            if (headerAvatar) {
                                headerAvatar.src = profile.pas_foto_path;
                                headerAvatar.className = 'w-full h-full object-cover';
                            }
                        }

                        if (percent < 100) {
                            if (section) section.classList.remove('hidden');
                            if (btnLengkapi) btnLengkapi.classList.remove('hidden');
                        } else {
                            if (section) section.classList.add('hidden');
                            if (btnLengkapi) btnLengkapi.classList.add('hidden');
                        }
                    }
                }
            } catch (e) { console.error(e); }
        }
        fetchProfileProgress();
    }, 100);
};
