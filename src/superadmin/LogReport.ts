import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';

export const renderLogReport = async (page: number = 1) => {
    renderDashboardLayout('Log Report', '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div></div>', 'super_admin', 'logs');

    try {
        const response = await apiFetch(`/api/super-admin/reports/admin-logs?page=${page}`);
        const result = await response.json();
        const logs = result.data.data;
        const pagination = result.data;

        const content = `
            <div class="space-y-6 animate-fade-in pb-12">
                <div>
                    <h2 class="text-xl font-bold text-gray-800">Laporan Aktivitas Sistem</h2>
                    <p class="text-sm text-gray-500">Monitor setiap tindakan yang dilakukan oleh pengguna pada sistem.</p>
                </div>

                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Aktor</th>
                                    <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Tindakan</th>
                                    <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Target</th>
                                    <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Waktu</th>
                                    <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Info Tambahan</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                ${logs.map((log: any) => `
                                    <tr class="hover:bg-gray-50/50 transition-colors">
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-3">
                                                <div class="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-xs shrink-0">
                                                    ${log.user?.name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p class="text-xs font-bold text-gray-800">${log.user?.name || 'Unknown'}</p>
                                                    <p class="text-[10px] text-gray-500">${log.user?.email || '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4">
                                            <span class="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                                                ${log.action}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4 text-xs text-gray-600">
                                            ${log.target_user || '-'}
                                        </td>
                                        <td class="px-6 py-4 text-[10px] text-gray-500 font-medium">
                                            ${new Date(log.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td class="px-6 py-4 text-[10px] text-gray-400 italic">
                                            ${log.details || '-'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Pagination -->
                    <div class="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
                        <span class="text-xs text-gray-500">Menampilkan ${pagination.from || 0} - ${pagination.to || 0} dari ${pagination.total} data</span>
                        <div class="flex gap-2">
                             <button id="prev-page" ${!pagination.prev_page_url ? 'disabled' : ''} class="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all">
                                Prev
                             </button>
                             <button id="next-page" ${!pagination.next_page_url ? 'disabled' : ''} class="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all">
                                Next
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderDashboardLayout('Log Report', content, 'super_admin', 'logs');

        document.getElementById('prev-page')?.addEventListener('click', () => {
            if (pagination.current_page > 1) renderLogReport(pagination.current_page - 1);
        });

        document.getElementById('next-page')?.addEventListener('click', () => {
            if (pagination.current_page < pagination.last_page) renderLogReport(pagination.current_page + 1);
        });

    } catch (error) {
        console.error('Error fetching logs:', error);
        renderDashboardLayout('Log Report', '<div class="p-8 text-center text-red-600 bg-red-50 rounded-2xl">Gagal memuat log aktivitas.</div>', 'super_admin', 'logs');
    }
};
