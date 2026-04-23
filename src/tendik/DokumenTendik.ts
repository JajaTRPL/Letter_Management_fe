import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderReviewScholarship } from './ReviewScholarship';

export const renderDokumenTendik = async (role: string) => {
    const token = localStorage.getItem('auth_token');
    
    // Initial content with loading state
    const initialContent = `
        <div class="w-full max-w-6xl mx-auto pb-12 animate-fade-in space-y-6">
            <p class="text-gray-600 text-sm mb-4 font-medium">Daftar pengajuan surat mahasiswa yang menunggu verifikasi</p>
            <div class="flex items-center justify-center py-20">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D4A46]"></div>
            </div>
        </div>
    `;
    renderDashboardLayout('Dokumen', initialContent, role, 'dokumen');

    try {
        const response = await fetch('/api/tendik/dashboard/tasks', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.message || 'Gagal mengambil data');

        const tasks = result.tasks;

        const generateRows = () => {
            if (tasks.length === 0) {
                return `
                <tr>
                    <td colspan="5" class="px-7 py-20 text-center">
                        <div class="flex flex-col items-center gap-3 grayscale opacity-40">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            <p class="text-sm font-bold text-gray-500">Tidak ada pengajuan yang perlu diverifikasi</p>
                        </div>
                    </td>
                </tr>
                `;
            }

            return tasks.map((item: any) => {
                const delayHtml = item.is_overdue ? `
                    <div class="flex items-center gap-1 text-[#EF4444] mt-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <span class="text-[10px] font-semibold">Melebihi 24 jam</span>
                    </div>
                ` : '';

                return `
                <tr class="hover:bg-gray-50/50 transition-colors">
                    <td class="px-7 py-4 align-top">
                        <p class="text-xs font-semibold text-gray-500 mt-0.5">${item.submitted_at}</p>
                        ${delayHtml}
                    </td>
                    <td class="px-4 py-4 align-top">
                        <p class="text-xs font-bold text-gray-700 mb-0.5">${item.student_name}</p>
                        <p class="text-[10px] font-medium text-gray-400">${item.nim}</p>
                    </td>
                    <td class="px-4 py-4 align-top pt-5">
                        <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60">
                            ${item.type}
                        </span>
                    </td>
                    <td class="px-4 py-4 align-top pt-5 whitespace-nowrap">
                        <span class="inline-flex items-center justify-center min-w-[120px] px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#FEF08A]/60 text-yellow-800">
                            ${item.status}
                        </span>
                    </td>
                    <td class="px-7 py-4 align-top text-right">
                        <button class="review-btn text-[11px] font-bold text-[#0D4A46] border-2 border-[#0D4A46] rounded-full px-5 py-1.5 hover:bg-[#0D4A46] hover:text-white transition-colors duration-200" data-id="${item.id}">
                            Review Dokumen
                        </button>
                    </td>
                </tr>
                `;
            }).join('');
        };

        const content = `
            <div class="w-full max-w-6xl mx-auto pb-12 animate-fade-in space-y-6">
                <p class="text-gray-600 text-sm mb-4 font-medium">Daftar pengajuan surat mahasiswa yang menunggu verifikasi</p>

                <div class="flex items-center gap-0 mb-6 bg-white rounded-xl overflow-hidden border border-gray-200 w-fit shadow-sm">
                    <button class="px-6 py-2.5 text-sm font-bold bg-[#0D4A46] text-white outline-none border-r border-gray-200 transition-colors">Tugas Saya</button>
                    <button class="px-6 py-2.5 text-sm font-bold bg-white text-gray-600 hover:bg-gray-50 outline-none transition-colors">Semua Pengajuan</button>
                </div>

                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-7 py-5 flex flex-wrap gap-4 items-center justify-between border-b border-gray-50 bg-[#F8FAFC]/50">
                        <div class="relative flex-1 min-w-[260px] max-w-md">
                            <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Cari berdasarkan Nama atau NIM"
                                class="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all bg-white"
                            >
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left bg-white">
                            <thead>
                                <tr class="border-b border-gray-100 bg-white">
                                    <th class="px-7 py-4 text-xs font-bold text-gray-700 whitespace-nowrap w-[200px]">Tanggal Masuk</th>
                                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap w-[240px]">Mahasiswa</th>
                                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Jenis Surat</th>
                                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Status</th>
                                    <th class="px-7 py-4"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${generateRows()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="flex items-center justify-between mt-4 mx-2">
                    <p class="text-xs font-medium text-gray-700">Menampilkan <span class="font-bold">1 - ${tasks.length}</span> dari <span class="font-bold">${tasks.length}</span> data</p>
                </div>
            </div>
        `;

        renderDashboardLayout('Dokumen', content, role, 'dokumen');

        // Add Listeners to Review Buttons
        document.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id') || '0');
                renderReviewScholarship(id);
            });
        });

    } catch (error: any) {
        renderDashboardLayout('Error', `<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">${error.message}</div>`, role, 'dokumen');
    }
};
