import { renderDashboardLayout } from '../../dashboard/DashboardLayout';

const typeColors: Record<string, { bg: string; text: string }> = {
    'Surat Beasiswa': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    'Surat Magang': { bg: 'bg-blue-50', text: 'text-blue-700' },
    'Surat Keaktifan': { bg: 'bg-amber-50', text: 'text-amber-700' },
    'Surat Fasilitas': { bg: 'bg-purple-50', text: 'text-purple-700' },
    'Surat Luar Negeri': { bg: 'bg-cyan-50', text: 'text-cyan-700' },
};

const getTypeBadge = (type: string) => {
    const color = typeColors[type] || { bg: 'bg-gray-100', text: 'text-gray-600' };
    return `<span class="px-2.5 py-1 rounded-lg ${color.bg} ${color.text} text-[10px] font-bold uppercase tracking-wider">${type}</span>`;
};

interface Template {
    updated_at: string;
    name: string;
    type: string;
    pdfUrl?: string;
    editUrl?: string;
}

export const renderTemplateDokumen = () => {
    const now = new Date();
    const currentDate = now.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    const templates: Template[] = [
        { 
            updated_at: currentDate, 
            name: 'Surat Permohonan Beasiswa', 
            type: 'Surat Beasiswa', 
            pdfUrl: '/api/templates/proxy-google-doc/1wnQYvwVO45M3LDDLEitsfjMFgkwj9S7f',
            editUrl: 'https://docs.google.com/document/d/1wnQYvwVO45M3LDDLEitsfjMFgkwj9S7f/edit?usp=sharing'
        },
        { updated_at: currentDate, name: 'Formulir Beasiswa (Lokal)', type: 'Surat Beasiswa', pdfUrl: '/files/Formulir-Permohonan-Beasiswa.pdf' },
        { updated_at: currentDate, name: 'Surat Rekomendasi Magang', type: 'Surat Magang' },
        { updated_at: currentDate, name: 'Surat Keaktifan Mahasiswa', type: 'Surat Keaktifan' },
        { updated_at: currentDate, name: 'Surat Peminjaman Ruang', type: 'Surat Fasilitas' },
        { updated_at: currentDate, name: 'Surat Proses Luar Negeri (Student Exchange)', type: 'Surat Luar Negeri' },
    ];

    const content = `
        <div class="space-y-6 animate-fade-in pb-12">
            <!-- Header Section -->
            <div>
                <h2 class="text-xl font-bold text-gray-800">Daftar Template Dokumen</h2>
                <p class="text-sm text-gray-500 mt-1">Kelola template dokumen yang digunakan dalam proses persuratan</p>
            </div>

            <!-- Main Card -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <!-- Search & Filter Bar -->
                <div class="p-5 border-b border-gray-100">
                    <div class="flex items-center gap-3">
                        <div class="relative flex-1">
                            <input type="text" 
                                id="template-search"
                                placeholder="Cari berdasarkan nama atau jenis surat..." 
                                class="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                            >
                            <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                        </div>
                        <div class="text-xs text-gray-400 font-medium shrink-0" id="template-count">
                            ${templates.length} template
                        </div>
                    </div>
                </div>

                <!-- Table -->
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-12">No</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Nama Surat</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Jenis Surat</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Terakhir Diperbarui <span class="ml-1 text-gray-300 cursor-pointer">↓↑</span>
                                </th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="template-table-body" class="divide-y divide-gray-50">
                            ${templates.map((tpl, i) => renderRow(tpl, i + 1, i)).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Footer -->
                <div class="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
                    <span class="text-xs text-gray-500">Menampilkan <span id="template-showing">${templates.length}</span> dari ${templates.length} template</span>
                </div>
            </div>
        </div>
    `;

    renderDashboardLayout('Template Dokumen', content, 'super_admin', 'template');

    // Attach detail click handlers
    const attachDetailHandlers = (templateList: Template[]) => {
        templateList.forEach((tpl, idx) => {
            const link = document.getElementById(`detail-link-${idx}`);
            link?.addEventListener('click', (e) => {
                e.preventDefault();
                if (tpl.pdfUrl) {
                    import('./TemplateDetailBeasiswa').then(({ renderTemplateDetail }) => {
                        renderTemplateDetail({
                            name: tpl.name,
                            pdfUrl: tpl.pdfUrl!,
                            editUrl: tpl.editUrl,
                            pageInfo: ''
                        });
                    });
                }
            });
        });
    };

    attachDetailHandlers(templates);

    // Search Event Listener
    const searchInput = document.getElementById('template-search') as HTMLInputElement;
    const tableBody = document.getElementById('template-table-body');
    const countEl = document.getElementById('template-count');
    const showingEl = document.getElementById('template-showing');

    searchInput?.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const filtered = templates.filter(tpl =>
            tpl.name.toLowerCase().includes(query) ||
            tpl.type.toLowerCase().includes(query)
        );

        if (tableBody) {
            tableBody.innerHTML = filtered.length > 0
                ? filtered.map((tpl, i) => renderRow(tpl, i + 1, templates.indexOf(tpl))).join('')
                : `<tr>
                    <td colspan="5" class="px-6 py-12 text-center">
                        <div class="flex flex-col items-center gap-2">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" stroke-width="1.5">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <p class="text-sm text-gray-400 font-medium">Tidak ada template yang cocok</p>
                            <p class="text-xs text-gray-300">Coba ubah kata kunci pencarian</p>
                        </div>
                    </td>
                </tr>`;
        }
        if (countEl) countEl.textContent = `${filtered.length} template`;
        if (showingEl) showingEl.textContent = `${filtered.length}`;

        // Re-attach handlers after search
        filtered.forEach((tpl) => {
            const originalIdx = templates.indexOf(tpl);
            const link = document.getElementById(`detail-link-${originalIdx}`);
            link?.addEventListener('click', (e) => {
                e.preventDefault();
                if (tpl.pdfUrl) {
                    import('./TemplateDetailBeasiswa').then(({ renderTemplateDetail }) => {
                        renderTemplateDetail({
                            name: tpl.name,
                            pdfUrl: tpl.pdfUrl!,
                            editUrl: tpl.editUrl,
                            pageInfo: ''
                        });
                    });
                }
            });
        });
    });
};

const renderRow = (tpl: Template, displayIndex: number, dataIndex: number) => `
    <tr class="hover:bg-gray-50/50 transition-colors group">
        <td class="px-6 py-4 text-xs text-gray-400 font-medium">${displayIndex}</td>
        <td class="px-6 py-4">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                </div>
                <span class="text-sm font-semibold text-gray-800">${tpl.name}</span>
            </div>
        </td>
        <td class="px-6 py-4">${getTypeBadge(tpl.type)}</td>
        <td class="px-6 py-4 text-xs text-gray-500 font-medium">${tpl.updated_at}</td>
        <td class="px-6 py-4 text-right">
            <a href="#" id="detail-link-${dataIndex}" class="text-teal-600 hover:text-teal-700 text-sm font-bold transition-colors">Lihat Detail</a>
        </td>
    </tr>
`;
