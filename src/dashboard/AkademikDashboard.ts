import { renderDashboardLayout } from './DashboardLayout';
import { getGreetingName } from '../utils/nameHelper';
import { renderReviewScholarship } from '../tendik/ReviewScholarship';

export const renderAkademikDashboard = async (role: string) => {
    const userName = getGreetingName(localStorage.getItem('auth_name')) || 'Pejabat';
    const token = localStorage.getItem('auth_token');

    // Initial skeleton/loading state
    renderDashboardLayout('Dashboard Akademik', `
        <div class="flex items-center justify-center min-h-[400px]">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
            <div class="space-y-6 animate-fade-in pb-12 w-full max-w-[1200px] mx-auto">
                <!-- Welcome Section -->
                <div class="mt-2">
                    <h2 class="text-[28px] font-bold text-gray-800 leading-tight">Halo, ${userName}!</h2>
                    <p class="text-xs text-gray-600 mt-1 mb-3">Selamat datang di portal persetujuan kurikulum dan surat akademik</p>
                    <div class="flex flex-wrap gap-2">
                        <span class="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold px-3 py-1.5 rounded-md shadow-sm">Role: ${role.toUpperCase()}</span>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
                    <div class="bg-white border border-gray-100 p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                        <div>
                            <h3 class="text-[38px] font-black text-purple-600 leading-none mb-1">${stats.total_incoming}</h3>
                            <p class="text-xs font-semibold text-gray-600">Total Antrean Masuk</p>
                        </div>
                        <div class="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
                        </div>
                    </div>

                    <div class="bg-white border border-gray-100 p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                        <div>
                            <h3 class="text-[38px] font-black text-orange-500 leading-none mb-1">${stats.needs_verification}</h3>
                            <p class="text-xs font-semibold text-gray-600">Perlu Persetujuan Anda</p>
                        </div>
                        <div class="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                    </div>

                    <div class="bg-white border border-gray-100 p-5 rounded-[20px] flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                        <div>
                            <h3 class="text-[38px] font-black text-emerald-500 leading-none mb-1">${stats.finished_this_month}</h3>
                            <p class="text-xs font-semibold text-gray-600">Telah Disetujui (Bulan Ini)</p>
                        </div>
                        <div class="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                    </div>
                </div>

                <!-- Approval Queue Section -->
                <div class="mt-10">
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
                        <div class="px-7 py-5 border-b border-gray-100 bg-[#F8FAFC]/50 flex justify-between items-center">
                            <div>
                                <h2 class="text-[17px] font-bold text-gray-800">Antrean Persetujuan Pejabat</h2>
                                <p class="text-[11px] text-gray-500 mt-1">Daftar dokumen yang memerlukan tanda tangan atau persetujuan akhir Anda</p>
                            </div>
                        </div>

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
                                                <p class="text-xs font-medium text-gray-500">${task.submitted_at}</p>
                                                ${task.is_overdue ? '<span class="text-[10px] text-red-500 font-bold">Terlampaui 24 Jam</span>' : ''}
                                            </td>
                                            <td class="px-4 py-4 align-top">
                                                <p class="text-xs font-bold text-gray-700 mb-0.5">${task.student_name}</p>
                                                <p class="text-[10px] font-medium text-gray-400">${task.nim}</p>
                                            </td>
                                            <td class="px-4 py-4 align-top">
                                                <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60 uppercase">
                                                    ${task.type}
                                                </span>
                                            </td>
                                            <td class="px-4 py-4 align-top whitespace-nowrap">
                                                <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-white text-orange-600 border border-orange-200">
                                                    MENUNGGU PERSETUJUAN ANDA
                                                </span>
                                            </td>
                                            <td class="px-7 py-3 align-top text-right">
                                                <button class="review-btn inline-block text-center text-[10px] font-bold border-2 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white transition-colors rounded-xl px-4 py-2 w-full max-w-[140px] shadow-sm" data-id="${task.id}">
                                                    Review & Setujui
                                                </button>
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
        renderDashboardLayout('Dashboard Akademik', content, role, 'dashboard');

        // Add Listeners to Review Buttons
        document.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id') || '0');
                renderReviewScholarship(id);
            });
        });

    } catch (error) {
        console.error(error);
        renderDashboardLayout('Dashboard Akademik', `
            <div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600">Gagal mengambil data dashboard akademik.</div>
        `, role, 'dashboard');
    }
};
