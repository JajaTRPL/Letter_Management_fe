import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { state, tabConfig, tabManager, type TabType } from './users/types';
import { setupListeners } from './users/listeners';
import { refreshUsers } from './users/api';
import { renderFilteredRows } from './users/ui-utils';

export const renderUserManagement = async () => {
    // CRITICAL: Reset tab to default ('super_admin') on every page entry.
    // This ensures no stale state from previous navigation persists.
    tabManager.reset();

    // Show loading state
    renderDashboardLayout(
        'Manajemen Akun',
        '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div></div>',
        'super_admin',
        'users'
    );

    await refreshUsers(renderContent);
};

function renderContent() {
    const activeTab = tabManager.getActive();
    const cfg = tabConfig[activeTab];
    const content = `
        <div class="space-y-5 animate-fade-in pb-12">
            <!-- Tab Bar + Export -->
            <div class="flex items-end justify-between border-b border-gray-200 w-full">
                <div class="flex gap-1">
                    ${Object.entries(tabConfig).map(([key, val]) => `
                        <button
                            id="tab-${key}"
                            data-tab="${key}"
                            class="tab-btn px-5 py-3 text-sm font-semibold transition-all border-b-2 ${tabManager.isActive(key as TabType)
            ? 'border-teal-700 text-teal-700'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }"
                        >${val.label}</button>
                    `).join('')}
                </div>
                <div class="pb-3 flex items-center gap-2 ml-4">
                    <button id="export-btn" class="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-teal-700 transition-all flex items-center gap-1.5 shadow-sm">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Ekspor
                    </button>
                    <button id="import-btn" class="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-teal-700 transition-all flex items-center gap-1.5 shadow-sm">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Impor
                    </button>
                </div>
            </div>

            <!-- Table Card -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
                <div class="px-6 py-5 border-b border-gray-100">
                    <div class="flex items-center gap-3 mb-1">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2">${cfg.icon}</svg>
                        <h2 class="text-base font-bold text-gray-800">${cfg.title}</h2>
                    </div>
                    <p class="text-xs text-gray-400 ml-7">${cfg.subtitle}</p>
                </div>

                <div id="toolbar-normal" class="px-6 py-4 flex flex-wrap gap-3 items-center justify-between border-b border-gray-50">
                    <div class="relative flex-1 min-w-[220px] max-w-md">
                        <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <input type="text" id="user-search" placeholder="Cari berdasarkan Nama..." class="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                    </div>
                    <div class="flex items-center gap-3">
                        <select id="status-filter" class="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer bg-white text-gray-600">
                            <option value="">Semua Status</option>
                            <option value="Active">Aktif</option>
                            <option value="Suspended">Suspended</option>
                            <option value="Pending_Profile">Menunggu Profil</option>
                        </select>
                        <button type="button" id="add-user-btn" class="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
                            Tambah Akun
                        </button>
                    </div>
                </div>

                <div id="toolbar-selection" class="hidden px-6 py-4 flex items-center justify-between border-b border-gray-50 bg-teal-50/30">
                    <span id="selection-count" class="text-sm font-semibold text-teal-800">0 akun dipilih</span>
                    <div class="flex items-center gap-3">
                        <button id="cancel-selection-btn" class="px-4 py-1.5 text-sm font-semibold bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all">Batal</button>
                        <button id="bulk-delete-btn" class="px-4 py-1.5 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all">Hapus</button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b border-gray-100">
                                <th class="px-6 py-3 w-10">
                                    <input type="checkbox" id="select-all" class="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer">
                                </th>
                                ${activeTab === 'mahasiswa' ? `
                                    <th class="px-4 py-3 text-xs font-semibold text-gray-500">Nama</th>
                                    <th class="px-4 py-3 text-xs font-semibold text-gray-500">NIM</th>
                                    <th class="px-4 py-3 text-xs font-semibold text-gray-500">Prodi</th>
                                    <th class="px-4 py-3 text-xs font-semibold text-gray-500">Angkatan</th>
                                    <th class="px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                                    <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 sticky right-0 bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.03)] z-10">Aksi</th>
                                ` : `
                                    <th class="px-4 py-3 text-xs font-semibold text-gray-500">Nama</th>
                                    <th class="px-4 py-3 text-xs font-semibold text-gray-500">Email</th>
                                    <th class="px-4 py-3 text-xs font-semibold text-gray-500">${activeTab === 'super_admin' ? 'Role Level' : 'Peran'}</th>
                                    <th class="px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                                    <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 sticky right-0 bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.03)] z-10">Aksi</th>
                                `}
                            </tr>
                        </thead>
                        <tbody id="user-table-body" class="divide-y divide-gray-50 relative">
                            ${renderFilteredRows(state.allUsers, cfg.roles)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div id="modal-container"></div>
    `;

    renderDashboardLayout('Manajemen Akun', content, 'super_admin', 'users');
    setupListeners(renderContent);
}
