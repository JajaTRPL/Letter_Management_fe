import { renderDashboardLayout } from './DashboardLayout';
import { getGreetingName } from '../utils/nameHelper';
import { renderReviewScholarship } from '../tendik/ReviewScholarship';

export const renderAkademikDashboard = async (role: string) => {
    const fullName = localStorage.getItem('auth_name') || 'Pejabat';
    const userName = getGreetingName(fullName);
    const token = localStorage.getItem('auth_token');

    // Map role to display label
    const roleLabels: Record<string, string> = {
        'kaprodi': 'Kaprodi',
        'sekprodi': 'Sekprodi',
        'kadep': 'Kadept',
        'sekdep': 'Sekdept',
        'akademik': 'Pejabat Akademik',
    };
    const roleLabel = roleLabels[role] || roleLabels[localStorage.getItem('auth_sub_role') || ''] || 'Pejabat Akademik';

    // Show loading state
    renderDashboardLayout('Dashboard', `
        <div class="flex items-center justify-center min-h-[400px]">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#115E59]"></div>
        </div>
    `, role, 'dashboard');

    try {
        const response = await fetch('/api/akademik/dashboard/tasks', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch academic dashboard data');
        
        const data = await response.json();
        const stats = data.stats;
        const tasks = data.tasks;

        const content = `
        <div class="space-y-6 animate-fade-in pb-12 w-full max-w-[1200px] mx-auto text-sm">
            <!-- Welcome Section -->
            <div class="mt-2">
                <h2 class="text-[28px] font-bold text-gray-800 leading-tight">Halo, ${userName}!</h2>
                <div class="flex flex-wrap gap-2 mt-3">
                    <span class="bg-[#FFD700] text-gray-900 border border-yellow-400/50 text-[10px] font-bold px-3 py-1.5 rounded-md shadow-sm">${roleLabel}</span>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
                <!-- Total Surat Masuk -->
                <div class="bg-[#EFF6FF] border border-blue-100 p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <div>
                        <h3 class="text-[38px] font-black text-[#0EA5E9] leading-none mb-1">${stats.total_incoming}</h3>
                        <p class="text-xs font-semibold text-gray-600">Total Antrean Masuk</p>
                    </div>
                    <div class="w-14 h-14 bg-blue-400/20 rounded-xl flex items-center justify-center text-blue-600">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                </div>

                <!-- Menunggu Paraf/Persetujuan -->
                <div class="bg-[#FFF8F1] border border-orange-200/60 p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <div>
                        <h3 class="text-[38px] font-black text-[#F59E0B] leading-none mb-1">${stats.needs_verification}</h3>
                        <p class="text-xs font-semibold text-gray-600">Perlu Persetujuan Anda</p>
                    </div>
                    <div class="w-14 h-14 bg-[#FEF08A]/60 rounded-xl flex items-center justify-center text-[#D97706]">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                </div>

                <!-- Disetujui Bulan Ini -->
                <div class="bg-[#F0FDF4] border border-green-200/60 p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <div>
                        <h3 class="text-[38px] font-black text-[#10B981] leading-none mb-1">${stats.finished_this_month}</h3>
                        <p class="text-xs font-semibold text-gray-600">Selesai Bulan Ini</p>
                    </div>
                    <div class="w-14 h-14 bg-green-300/40 rounded-xl flex items-center justify-center text-green-600">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                </div>
            </div>

            <!-- Antrean Perlu Tindakan Section -->
            <div class="mt-10">
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-7 py-5 border-b border-gray-100 flex gap-3">
                        <div class="w-6 h-6 rounded-full border border-red-500 text-red-500 flex flex-col items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="6" x2="12" y2="14"></line><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                        </div>
                        <div>
                            <h2 class="text-[17px] font-bold text-gray-800">Antrean Perlu Tindakan</h2>
                            <p class="text-[11px] text-gray-500 mt-1">Daftar pengajuan surat yang memerlukan persetujuan Anda</p>
                        </div>
                    </div>

                    <!-- Table -->
                    <div class="overflow-x-auto">
                        <table class="w-full text-left bg-white">
                            <thead>
                                <tr class="border-b border-gray-100 bg-white">
                                    <th class="px-7 py-4 text-xs font-bold text-gray-700 whitespace-nowrap w-[220px]">Tanggal Masuk</th>
                                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Mahasiswa</th>
                                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Jenis Surat</th>
                                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Status</th>
                                    <th class="px-7 py-4 w-40"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${tasks.length === 0 ? `
                                    <tr>
                                        <td colspan="5" class="px-7 py-12 text-center text-gray-400">
                                            Belum ada pengajuan yang memerlukan persetujuan Anda saat ini.
                                        </td>
                                    </tr>
                                ` : tasks.map((task: any) => `
                                    <tr class="hover:bg-gray-50/50 transition-colors">
                                        <td class="px-7 py-4 align-top">
                                            <p class="text-xs font-medium text-gray-500 mb-1">${task.submitted_at}</p>
                                            ${task.is_overdue ? `<p class="text-[10px] font-bold text-red-500 flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> 24 jam tertunda</p>` : ''}
                                        </td>
                                        <td class="px-4 py-4 align-top">
                                            <p class="text-xs font-bold text-gray-700 mb-0.5">${task.student_name}</p>
                                            <p class="text-[10px] font-medium text-gray-400">${task.nim}</p>
                                        </td>
                                        <td class="px-4 py-4 align-top">
                                            <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60">
                                                ${task.type}
                                            </span>
                                        </td>
                                        <td class="px-4 py-4 align-top whitespace-nowrap">
                                            <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#FEF9C3] text-[#A16207] border border-[#FDE047]">
                                                Menunggu Persetujuan
                                            </span>
                                        </td>
                                        <td class="px-7 py-3 align-top text-right">
                                            <button class="review-btn text-xs font-bold border-2 border-[#115E59] text-[#115E59] hover:bg-[#115E59] hover:text-white transition-colors rounded-xl px-4 py-2 w-full max-w-[140px] shadow-sm" data-id="${task.id}">
                                                Review Dokumen
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Riwayat Section (Placeholder for consistency) -->
            <div class="mt-12">
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-7 py-5 border-b border-gray-100 flex gap-3 items-start">
                        <div class="w-6 h-6 rounded-full border border-blue-500 text-blue-500 flex flex-col items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                        <div>
                            <h2 class="text-[17px] font-bold text-gray-800">Riwayat Persetujuan</h2>
                            <p class="text-[11px] text-gray-500 mt-1">Daftar surat yang telah Anda setujui atau tolak (Bulan Ini)</p>
                        </div>
                    </div>
                    <div class="px-7 py-12 text-center text-gray-400">
                        Fitur riwayat komprehensif sedang dalam pengembangan.
                    </div>
                </div>
            </div>
        </div>
        `;
        renderDashboardLayout('Dashboard', content, role, 'dashboard');

        // Add Listeners to Review Buttons
        document.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id') || '0');
                renderReviewScholarship(id);
            });
        });

    } catch (error) {
        console.error(error);
        renderDashboardLayout('Dashboard', `
            <div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600">Gagal mengambil data dashboard akademik.</div>
        `, role, 'dashboard');
    }
};

