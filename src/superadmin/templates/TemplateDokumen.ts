import { renderDashboardLayout } from '../../dashboard/DashboardLayout';
import { apiFetch } from '../../shared/api-client';
import { showError, showSuccess } from '../../shared/toast';

interface ManagedTemplate {
    key: string;
    name: string;
    category: string;
    source_type: string;
    can_refresh: boolean;
    template_id_masked: string | null;
    cache_path_display: string | null;
    cache_exists: boolean;
    cached_at: string | null;
    size_bytes: number | null;
}

interface StaticTemplate {
    name: string;
    type: string;
    status: 'unmanaged' | 'planned';
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
    'Surat Beasiswa':      { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    'Surat Magang':        { bg: 'bg-blue-50',    text: 'text-blue-700' },
    'Surat Keaktifan':     { bg: 'bg-amber-50',   text: 'text-amber-700' },
    'Surat Luar Negeri':   { bg: 'bg-cyan-50',    text: 'text-cyan-700' },
    'Peminjaman Ruangan':  { bg: 'bg-purple-50',  text: 'text-purple-700' },
};

function categoryColor(category: string): { bg: string; text: string } {
    return CATEGORY_COLORS[category] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
}

export const renderTemplateDokumen = async () => {
    renderDashboardLayout(
        'Template Dokumen',
        '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div></div>',
        'super_admin',
        'template'
    );

    let managed: ManagedTemplate[] = [];
    try {
        const res = await apiFetch('/api/super-admin/templates');
        if (res.ok) {
            const json = await res.json();
            managed = (json.data as ManagedTemplate[]) ?? [];
        }
    } catch (err) {
        console.error(err);
    }

    renderContent(managed);
};

function renderContent(managed: ManagedTemplate[]) {
    // Only future/planned templates that the backend does not manage yet.
    // SKA/PLN/Magang are now backend-managed and must not appear as duplicate
    // unmanaged rows.
    const plannedRows: StaticTemplate[] = [
        { name: 'Peminjaman Ruang Kelas',         type: 'Peminjaman Ruangan',  status: 'planned' },
        { name: 'Peminjaman Ruang Laboratorium',  type: 'Peminjaman Ruangan',  status: 'planned' },
    ];

    const managedRowsHtml = managed.map((tpl, i) => renderManagedRow(tpl, i + 1)).join('');
    const staticRowsHtml  = plannedRows.map((tpl, i) => renderStaticRow(tpl, managed.length + i + 1)).join('');
    const totalCount = managed.length + plannedRows.length;

    const content = `
        <div class="space-y-6 animate-fade-in pb-12">
            <div>
                <h2 class="text-xl font-bold text-gray-800">Daftar Template Dokumen</h2>
                <p class="text-sm text-gray-500 mt-1">Kelola template dokumen yang digunakan dalam proses persuratan</p>
            </div>
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div class="p-5 border-b border-gray-100">
                    <div class="text-xs text-gray-400 font-medium">${totalCount} template</div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-12">No</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Nama Surat</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Jenis</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status Cache</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Terakhir Diperbarui</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50" id="template-table-body">
                            ${managedRowsHtml}
                            ${staticRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    renderDashboardLayout('Template Dokumen', content, 'super_admin', 'template');

    managed.forEach(tpl => {
        document.getElementById(`refresh-btn-${tpl.key}`)?.addEventListener('click', () => {
            void handleRefresh(tpl.key, managed);
        });
    });
}

async function handleRefresh(key: string, managed: ManagedTemplate[]) {
    const btn = document.getElementById(`refresh-btn-${key}`) as HTMLButtonElement | null;
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Memuat...';
    }

    try {
        const res = await apiFetch(`/api/super-admin/templates/${key}/refresh`, { method: 'POST' });
        const json = await res.json();
        if (res.ok) {
            showSuccess(json.message || 'Cache berhasil diperbarui');
            const updated = managed.map(tpl =>
                tpl.key === key
                    ? { ...tpl, cache_exists: true, cached_at: (json.cached_at as string) ?? tpl.cached_at, size_bytes: (json.size_bytes as number) ?? tpl.size_bytes }
                    : tpl
            );
            renderContent(updated);
        } else {
            showError((json.message as string) || 'Gagal memperbarui cache');
            if (btn) { btn.disabled = false; btn.textContent = 'Refresh Cache'; }
        }
    } catch (err) {
        console.error(err);
        showError('Terjadi kesalahan jaringan');
        if (btn) { btn.disabled = false; btn.textContent = 'Refresh Cache'; }
    }
}

function renderManagedRow(tpl: ManagedTemplate, idx: number): string {
    const cacheBadge = tpl.cache_exists
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100"><span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>Tersedia</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>Belum ada cache</span>`;

    const sizeText     = tpl.size_bytes ? ` (${Math.round(tpl.size_bytes / 1024)} KB)` : '';
    const cachedAtText = tpl.cached_at  ? `${tpl.cached_at}${sizeText}` : '—';

    return `
        <tr class="hover:bg-gray-50/50 transition-colors">
            <td class="px-6 py-4 text-xs text-gray-400 font-medium">${idx}</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div>
                        <span class="text-sm font-semibold text-gray-800">${tpl.name}</span>
                        ${tpl.template_id_masked ? `<p class="text-[10px] text-gray-400 mt-0.5">Google Docs ${tpl.template_id_masked}</p>` : ''}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-lg ${categoryColor(tpl.category).bg} ${categoryColor(tpl.category).text} text-[10px] font-bold uppercase tracking-wider">${tpl.category}</span></td>
            <td class="px-6 py-4">${cacheBadge}</td>
            <td class="px-6 py-4 text-xs text-gray-500 font-medium">${cachedAtText}</td>
            <td class="px-6 py-4 text-right">
                <button id="refresh-btn-${tpl.key}" class="px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 border border-teal-200 rounded-lg transition-all inline-flex items-center gap-1.5 ml-auto">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    Refresh Cache
                </button>
            </td>
        </tr>
    `;
}

function renderStaticRow(tpl: StaticTemplate, idx: number): string {
    const color = categoryColor(tpl.type);

    const statusLabel = tpl.status === 'planned'
        ? 'Direncanakan'
        : 'Belum dikelola sistem';

    return `
        <tr class="hover:bg-gray-50/50 transition-colors opacity-60">
            <td class="px-6 py-4 text-xs text-gray-400 font-medium">${idx}</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <span class="text-sm font-semibold text-gray-600">${tpl.name}</span>
                </div>
            </td>
            <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-lg ${color.bg} ${color.text} text-[10px] font-bold uppercase tracking-wider">${tpl.type}</span></td>
            <td class="px-6 py-4"><span class="text-xs text-gray-400 italic">${statusLabel}</span></td>
            <td class="px-6 py-4 text-xs text-gray-400">—</td>
            <td class="px-6 py-4 text-right text-xs text-gray-400">—</td>
        </tr>
    `;
}
