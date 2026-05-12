export const renderSidebar = (currentRole: string, activePage: string = 'dashboard') => {
    let menuItems = '';

    if (currentRole === 'mahasiswa') {
        const activeClass = 'bg-white/20 text-white font-semibold shadow-sm';
        const inactiveClass = 'text-white/70 hover:bg-white/5 hover:text-white';
        menuItems = `
            <a href="#" id="sidebar-dashboard-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'dashboard' ? activeClass : inactiveClass}">
                <img src="dashboard-logo.png" class="w-5 h-5 object-contain" />
                <span class="font-medium text-sm">Dashboard</span>
            </a>
            <a href="#" id="sidebar-panduan-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'panduan' ? activeClass : inactiveClass}">
                <img src="panduan-logo.png" class="w-5 h-5 object-contain" />
                <span class="font-medium text-sm">Panduan</span>
            </a>
            <a href="#" id="sidebar-administrasi-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'administrasi' ? activeClass : inactiveClass}">
                <img src="pengajuan-logo.png" class="w-5 h-5 object-contain" />
                <span class="font-medium text-sm">Administrasi Surat</span>
            </a>
            <a href="#" id="sidebar-peminjaman-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'peminjaman' ? activeClass : inactiveClass}">
                <img src="pengajuan-logo.png" class="w-5 h-5 object-contain" />
                <span class="font-medium text-sm">Peminjaman Ruangan</span>
            </a>
            <a href="#" id="sidebar-history-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'history' ? activeClass : inactiveClass}">
                <img src="history.png" class="w-5 h-5 object-contain" />
                <span class="font-medium text-sm truncate">Riwayat Pengajuan</span>
            </a>
        `;
    } else if (currentRole === 'super_admin') {
        const activeClass = 'bg-white/20 text-white font-semibold';
        const inactiveClass = 'text-white/70 hover:bg-white/10 hover:text-white';
        menuItems = `
            <a href="#" id="sidebar-dashboard-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'dashboard' ? activeClass : inactiveClass}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                <span class="font-medium">Dashboard</span>
            </a>
            <a href="#" id="sidebar-users-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'users' ? activeClass : inactiveClass}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span class="font-medium">Manajemen Akun</span>
            </a>
            <a href="#" id="sidebar-monitoring-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'monitoring' ? activeClass : inactiveClass}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                <span class="font-medium">Monitoring Surat</span>
            </a>
            <a href="#" id="sidebar-template-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'template' ? activeClass : inactiveClass}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <span class="font-medium">Template Dokumen</span>
            </a>
            <a href="#" id="sidebar-logs-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'logs' ? activeClass : inactiveClass}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span class="font-medium">Riwayat Aktivitas</span>
            </a>
            <a href="#" id="sidebar-academic-periods-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'academic-periods' ? activeClass : inactiveClass}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span class="font-medium">Periode Akademik</span>
            </a>
        `;
    } else if (currentRole.startsWith('tendik') || ['kadep', 'kaprodi', 'sekdep', 'sekprodi', 'akademik'].includes(currentRole)) {
        const activeClass2 = 'bg-white/10 text-white font-semibold';
        const inactiveClass2 = 'text-white/70 hover:bg-white/5 hover:text-white';
        menuItems = `
            <a href="#" id="sidebar-dashboard-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'dashboard' ? activeClass2 : inactiveClass2}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                <span class="font-medium">Dashboard</span>
            </a>
            <a href="#" id="sidebar-dokumen-tendik-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'dokumen' ? activeClass2 : inactiveClass2}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <span class="font-medium">Dokumen</span>
            </a>
            <a href="#" id="sidebar-riwayat-tendik-link" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'riwayat' ? activeClass2 : inactiveClass2}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span class="font-medium">Riwayat</span>
            </a>
        `;
    }

    return `
        <aside class="w-64 bg-primary-teal text-white min-h-screen flex flex-col sticky top-0 h-screen overflow-y-auto" 
            style="
                background-image: url('sidebar.png');
                background-size: cover;
                background-position: center;
            "
        >
            <div class="p-5 border-b border-white/10">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                        <img src="/ugm-logo.png" alt="UGM Logo" class="w-15 h-15 object-contain brightness-0 invert">
                    </div>
                    <div>
                        <p class="text-white text-sm font-bold leading-tight">Sistem Persuratan</p>
                        <p class="text-white/60 text-[9px] leading-tight mt-0.5">Departemen Teknik<br>Elektro dan Informatika</p>
                    </div>
                </div>
            </div>

            <nav class="flex-1 mt-4 px-3 space-y-1">
                ${menuItems}
            </nav>
        </aside>
    `;
};