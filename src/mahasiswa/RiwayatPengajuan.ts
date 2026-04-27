import { renderDashboardLayout } from '../dashboard/DashboardLayout';

export const renderRiwayatPengajuan = async () => {
    // Show loading state or fetch before rendering
    const token = localStorage.getItem('auth_token');
    let applications: any[] = [];
    
    try {
        const res = await fetch('/api/mahasiswa/scholarship/applications', {
            headers: { 'Authorization': 'Bearer ' + token },
            cache: 'no-store'
        });
        if (res.ok) {
            const data = await res.json();
            applications = data.applications || [];
        }
    } catch (e) {
        console.error("Failed to fetch applications", e);
    }

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'Diproses': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'Revisi': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'Ditolak': return 'bg-red-50 text-red-600 border-red-100';
            case 'Selesai': return 'bg-teal-50 text-teal-600 border-teal-100';
            default: return 'bg-gray-50 text-gray-600 border-gray-100';
        }
    };

    let tableHtml = '';
    if (applications.length === 0) {
        tableHtml = `<tr><td colspan="4" class="px-8 py-8 text-center text-gray-500 font-medium">Belum ada riwayat pengajuan surat.</td></tr>`;
    } else {
        tableHtml = applications.map((app: any) => {
            const dateStr = new Date(app.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
            let statusText = app.status;
            
            if (app.status === 'Completed') {
                statusText = 'Selesai';
            } else if (app.status === 'Rejected') {
                statusText = 'Ditolak';
            } else if (app.status === 'Revision') {
                statusText = 'Revisi';
            } else {
                statusText = 'Diproses';
            }

            return `
                <tr class="hover:bg-gray-50/50 transition-colors group">
                    <td class="px-8 py-5 text-sm text-gray-500 font-medium">${dateStr}</td>
                    <td class="px-8 py-5 text-sm font-bold text-gray-800">${app.scholarship_name || 'Surat Permohonan Beasiswa'}</td>
                    <td class="px-8 py-5">
                        <span class="${getStatusClass(statusText)} px-4 py-1.5 rounded-full font-bold text-[11px] uppercase tracking-wider border">
                            ${statusText}
                        </span>
                    </td>
                    <td class="px-8 py-5 text-right">
                        ${app.generated_docx_path ? 
                            `<a href="/api/storage/${app.generated_docx_path.replace('/storage/', '')}" target="_blank" class="text-primary-teal font-bold text-sm hover:underline">Download Dokumen</a>` 
                            : `<span class="text-gray-400 text-sm">Menunggu</span>`
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }

    const content = `
        <div class="space-y-6">
            <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left font-['Inter']">
                        <thead>
                            <tr class="bg-white border-b border-gray-50">
                                <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Tanggal Unggah</th>
                                <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Nama Dokumen</th>
                                <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Status</th>
                                <th class="px-8 py-5 text-[13px] font-bold text-gray-700 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${tableHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Pagination -->
            <div class="flex items-center justify-between px-2">
                <p class="text-sm font-bold text-gray-700">Showing <span class="text-black">${applications.length > 0 ? 1 : 0} to ${applications.length}</span> of <span class="text-black">${applications.length}</span> results</p>
            </div>
        </div>
    `;

    renderDashboardLayout('Riwayat Pengajuan', content, 'mahasiswa', 'history');
};
