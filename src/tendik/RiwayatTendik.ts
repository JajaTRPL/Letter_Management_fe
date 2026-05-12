import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { getLetterStatusLabel, getLetterStatusTone } from '../shared/letter-workflow';
import { apiFetch } from '../shared/api-client';

export const renderRiwayatTendik = async (role: string) => {
    // Show loading
    renderDashboardLayout('Riwayat', `
        <div class="flex items-center justify-center min-h-[400px]">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D4A46]"></div>
        </div>
    `, role, 'riwayat');

    try {
        const response = await apiFetch('/api/tendik/riwayat');

        if (!response.ok) throw new Error('Failed to fetch history');
        
        const data = await response.json();
        const tasks = data.tasks || [];

        const getStatusBadge = (status: string) => {
            const label = getLetterStatusLabel(status, 'tendik-history') || status;
            const tone = getLetterStatusTone(status, 'tendik-history');
            return `<span class="inline-flex items-center justify-center min-w-[70px] px-3 py-1.5 rounded-full text-[10px] font-bold ${tone}">${label}</span>`;
        };

        const generateRows = () => {
            if (tasks.length === 0) {
                return `
                <tr>
                    <td colspan="6" class="px-7 py-20 text-center">
                        <div class="flex flex-col items-center gap-3 grayscale opacity-40">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            <p class="text-sm font-bold text-gray-500">Belum ada riwayat pengajuan</p>
                        </div>
                    </td>
                </tr>
                `;
            }

            return tasks.map((item: any) => `
            <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="px-7 py-4 align-top">
                    <p class="text-xs font-semibold text-gray-500">${item.submitted_at}</p>
                    ${item.is_overdue ? '<p class="text-[10px] font-bold text-red-500 mt-1">> 24 jam tertunda</p>' : ''}
                </td>
                <td class="px-4 py-4 align-top">
                    <p class="text-xs font-bold text-gray-700 mb-0.5">${item.student_name}</p>
                    <p class="text-[10px] font-medium text-gray-400">${item.nim}</p>
                </td>
                <td class="px-4 py-4 align-top">
                    <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-gray-600 border border-gray-200/60">
                        ${item.type}
                    </span>
                </td>
                <td class="px-4 py-4 align-top whitespace-nowrap">
                    ${getStatusBadge(item.status)}
                </td>
                <td class="px-7 py-4 align-top text-right">
                    ${item.docx_url ? `<a href="${item.docx_url}" target="_blank" class="text-xs font-bold text-blue-500 hover:text-blue-700 hover:underline transition-colors block mt-0.5">Unduh Dokumen</a>` : '<span class="text-xs text-gray-400">-</span>'}
                </td>
            </tr>
            `).join('');
        };

        const content = `
            <div class="w-full max-w-6xl mx-auto pb-12 animate-fade-in space-y-6">
                <p class="text-gray-600 text-sm mb-4">Daftar pengajuan surat yang telah diproses</p>

                <!-- Table Container -->
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <!-- Table -->
                    <div class="overflow-x-auto">
                        <table class="w-full text-left bg-white">
                            <thead>
                                <tr class="border-b border-gray-100 bg-white">
                                    <th class="px-7 py-4 text-xs font-bold text-gray-700 whitespace-nowrap w-[180px]">Tanggal Masuk</th>
                                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Mahasiswa</th>
                                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Jenis Surat</th>
                                    <th class="px-4 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">Status</th>
                                    <th class="px-7 py-4 w-32"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${generateRows()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Footer Pagination -->
                <div class="flex items-center justify-between mt-4 mx-2">
                    <p class="text-xs font-medium text-gray-700">Menampilkan <span class="font-bold">${tasks.length > 0 ? 1 : 0} - ${tasks.length}</span> dari <span class="font-bold">${tasks.length}</span> data</p>
                </div>
            </div>
        `;

        renderDashboardLayout('Riwayat', content, role, 'riwayat');

    } catch (error) {
        console.error(error);
        renderDashboardLayout('Riwayat', `
            <div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">Gagal mengambil data riwayat.</div>
        `, role, 'riwayat');
    }
};
