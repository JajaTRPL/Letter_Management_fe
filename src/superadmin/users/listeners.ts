import { apiFetch } from '../../shared/api-client';
import { showSuccess, showError } from '../../shared/toast';
import { isSuspended } from '../../shared/user-status';
import { state, tabConfig, tabManager, type TabType } from './types';
import { refreshUsers } from './api';
import { renderFilteredRows, renderPaginationControls, renderUserDetailModal } from './ui-utils';
import { renderUserModal } from './modals';
import { renderExportDrawer } from './export-drawer';
import { renderImportDrawer } from './import-drawer';

export const setupListeners = (renderContent: () => void) => {
    // --- Helper: update toolbar berdasarkan jumlah yang dipilih ---
    const updateSelectionToolbar = () => {
        const checked = document.querySelectorAll('.user-checkbox:checked');
        const count = checked.length;
        const toolbarNormal = document.getElementById('toolbar-normal');
        const toolbarSelection = document.getElementById('toolbar-selection');
        const countLabel = document.getElementById('selection-count');

        if (count > 0) {
            toolbarNormal?.classList.add('hidden');
            toolbarSelection?.classList.remove('hidden');
            if (countLabel) countLabel.textContent = `${count} akun dipilih`;
        } else {
            toolbarNormal?.classList.remove('hidden');
            toolbarSelection?.classList.add('hidden');
            const selectAll = document.getElementById('select-all') as HTMLInputElement;
            if (selectAll) selectAll.checked = false;
        }
    };

    // --- Partial refresh: updates only table body + pagination bar (preserves input focus) ---
    const doPartialRefresh = () => {
        refreshUsers(() => {
            const activeTab = tabManager.getActive();
            const activeCfg = tabConfig[activeTab];
            const tableBody = document.getElementById('user-table-body');
            if (tableBody) {
                tableBody.innerHTML = renderFilteredRows(state.allUsers, activeCfg.roles);
            }
            const paginationBar = document.getElementById('pagination-bar');
            if (paginationBar) {
                paginationBar.innerHTML = renderPaginationControls();
            }
            attachActionListeners(renderContent, updateSelectionToolbar);
            attachPaginationListeners();
            updateSelectionToolbar();
        });
    };

    // --- Pagination listeners ---
    const attachPaginationListeners = () => {
        document.getElementById('pagination-prev')?.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                doPartialRefresh();
            }
        });
        document.getElementById('pagination-next')?.addEventListener('click', () => {
            if (state.meta && state.currentPage < state.meta.last_page) {
                state.currentPage++;
                doPartialRefresh();
            }
        });
    };

    // --- Mutation refresh: resets to page 1, then full re-render ---
    const mutationRefresh = () => {
        state.currentPage = 1;
        refreshUsers(renderContent);
    };

    // --- Tab switching ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            tabManager.setActive((btn as HTMLElement).dataset.tab as TabType);
            state.currentPage = 1;
            state.currentSearch = '';
            state.currentStatus = '';
            refreshUsers(renderContent);
        });
    });

    // --- Search & Status filter (backend-driven) ---
    const searchInput = document.getElementById('user-search') as HTMLInputElement;
    const statusFilter = document.getElementById('status-filter') as HTMLSelectElement;

    let searchDebounce: ReturnType<typeof setTimeout> | null = null;
    searchInput?.addEventListener('input', () => {
        state.currentSearch = searchInput.value;
        state.currentPage = 1;
        if (searchDebounce) clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => doPartialRefresh(), 400);
    });

    statusFilter?.addEventListener('change', () => {
        state.currentStatus = statusFilter.value;
        state.currentPage = 1;
        doPartialRefresh();
    });

    // --- Add user ---
    document.getElementById('add-user-btn')?.addEventListener('click', () => {
        renderUserModal(null, () => mutationRefresh());
    });

    // --- Dropdown Impor/Ekspor toggle ---
    document.getElementById('io-dropdown-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('io-dropdown-menu')?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('io-dropdown-wrapper');
        if (wrapper && !wrapper.contains(e.target as Node)) {
            document.getElementById('io-dropdown-menu')?.classList.add('hidden');
        }
        // Close all kebab menus on outside click
        const target = e.target as HTMLElement;
        if (!target.closest('.kebab-btn') && !target.closest('.kebab-menu')) {
            document.querySelectorAll('.kebab-menu').forEach(m => m.classList.add('hidden'));
        }
    });

    document.getElementById('export-btn')?.addEventListener('click', () => {
        document.getElementById('io-dropdown-menu')?.classList.add('hidden');
        renderExportDrawer();
    });

    document.getElementById('import-btn')?.addEventListener('click', () => {
        document.getElementById('io-dropdown-menu')?.classList.add('hidden');
        renderImportDrawer(() => mutationRefresh());
    });

    // --- Select all checkbox ---
    document.getElementById('select-all')?.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        document.querySelectorAll('.user-checkbox').forEach(cb => {
            (cb as HTMLInputElement).checked = checked;
        });
        updateSelectionToolbar();
    });

    // --- Batal selection ---
    document.getElementById('cancel-selection-btn')?.addEventListener('click', () => {
        document.querySelectorAll('.user-checkbox').forEach(cb => {
            (cb as HTMLInputElement).checked = false;
        });
        const selectAll = document.getElementById('select-all') as HTMLInputElement;
        if (selectAll) selectAll.checked = false;
        updateSelectionToolbar();
    });

    // --- Bulk delete ---
    document.getElementById('bulk-delete-btn')?.addEventListener('click', async () => {
        const selectedIds = Array.from(document.querySelectorAll('.user-checkbox:checked'))
            .map(cb => (cb as HTMLElement).dataset.id);
        if (selectedIds.length === 0) return;
        if (!confirm(`Hapus ${selectedIds.length} akun secara permanen?`)) return;

        try {
            await Promise.all(selectedIds.map(id =>
                apiFetch(`/api/super-admin/users/${id}`, {
                    method: 'DELETE',
                })
            ));
            showSuccess(`${selectedIds.length} akun berhasil dihapus`);
            mutationRefresh();
        } catch (err) {
            console.error(err);
            showError('Gagal menghapus beberapa akun');
        }
    });

    attachActionListeners(renderContent, updateSelectionToolbar);
    attachPaginationListeners();
};

export const attachActionListeners = (renderContent: () => void, onSelectionChange?: () => void) => {
    // Checkbox changes
    document.querySelectorAll('.user-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            onSelectionChange?.();
        });
    });

    // Kebab toggle
    document.querySelectorAll('.kebab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).dataset.id;
            
            // Close other menus
            document.querySelectorAll('.kebab-menu').forEach(m => {
                if ((m as HTMLElement).dataset.id !== id) m.classList.add('hidden');
            });
            
            const menu = document.querySelector(`.kebab-menu[data-id="${id}"]`) as HTMLElement;
            if (menu) {
                const isHidden = menu.classList.contains('hidden');
                menu.classList.toggle('hidden');
                
                if (isHidden) {
                    // Smart fixed repositioning to avoid table overflow clipping
                    const rect = btn.getBoundingClientRect();
                    const menuHeight = 150; // approximate height
                    const spaceBelow = window.innerHeight - rect.bottom;
                    
                    menu.style.position = 'fixed';
                    menu.style.right = (window.innerWidth - rect.right) + 'px';
                    
                    if (spaceBelow < menuHeight && rect.top > menuHeight) {
                        // Show above
                        menu.style.top = 'auto';
                        menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
                    } else {
                        // Show below
                        menu.style.bottom = 'auto';
                        menu.style.top = (rect.bottom + 8) + 'px';
                    }
                }
            }
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.kebab-btn') && !target.closest('.kebab-menu')) {
            document.querySelectorAll('.kebab-menu').forEach(m => m.classList.add('hidden'));
        }
    });

    // Close menu on scroll to prevent floating fixed menus from staying in place
    const closeAllMenus = () => {
        document.querySelectorAll('.kebab-menu').forEach(m => m.classList.add('hidden'));
    };
    window.addEventListener('scroll', closeAllMenus, { passive: true });
    document.querySelector('.overflow-x-auto')?.addEventListener('scroll', closeAllMenus, { passive: true });

    // Edit
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = (btn as HTMLElement).dataset.id;
            const user = state.allUsers.find(u => u.id == id);
            if (user) {
                document.querySelectorAll('.kebab-menu').forEach(m => m.classList.add('hidden'));
                renderUserModal(user, () => { state.currentPage = 1; refreshUsers(renderContent); });
            }
        });
    });

    // Block / Unblock
    document.querySelectorAll('.block-user-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = (btn as HTMLElement).dataset.id;
            const status = (btn as HTMLElement).dataset.status;
            const endpoint = isSuspended(status ?? '')
                ? `/api/super-admin/users/${id}/unblock`
                : `/api/super-admin/users/${id}/block`;
            try {
                const response = await apiFetch(endpoint, {
                    method: 'PATCH',
                });
                const result = await response.json();
                showSuccess(result.message);
                state.currentPage = 1;
                await refreshUsers(renderContent);
            } catch (err) { console.error(err); }
        });
    });

    // Delete
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Apakah Anda yakin ingin menghapus akun ini secara permanen?')) return;
            const id = (btn as HTMLElement).dataset.id;
            try {
                const response = await apiFetch(`/api/super-admin/users/${id}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    const result = await response.json();
                    showSuccess(result.message || 'Akun berhasil dihapus');
                    state.currentPage = 1;
                    await refreshUsers(renderContent);
                }
            } catch (err) { console.error(err); }
        });
    });

    // Row click (all roles) → open role-aware detail modal
    document.querySelectorAll('.user-row-clickable').forEach(row => {
        row.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.no-row-click')) return;
            const id = (row as HTMLElement).dataset.id;
            const user = state.allUsers.find(u => String(u.id) === String(id));
            if (user) {
                renderUserDetailModal(user);
                attachDetailModalListeners(renderContent);
            }
        });
    });
};

const attachDetailModalListeners = (renderContent: () => void) => {
    // Edit from detail modal
    document.querySelector('.user-detail-edit-btn')?.addEventListener('click', () => {
        const id = (document.querySelector('.user-detail-edit-btn') as HTMLElement)?.dataset.id;
        const user = state.allUsers.find(u => String(u.id) === String(id));
        const modalContainer = document.getElementById('modal-container')!;
        modalContainer.innerHTML = '';
        if (user) renderUserModal(user, () => { state.currentPage = 1; refreshUsers(renderContent); });
    });

    // Block/Unblock from detail modal
    document.querySelector('.user-detail-block-btn')?.addEventListener('click', async () => {
        const btn = document.querySelector('.user-detail-block-btn') as HTMLElement;
        const id = btn?.dataset.id;
        const status = btn?.dataset.status;
        const endpoint = isSuspended(status ?? '')
            ? `/api/super-admin/users/${id}/unblock`
            : `/api/super-admin/users/${id}/block`;
        try {
            const response = await apiFetch(endpoint, {
                method: 'PATCH',
            });
            const result = await response.json();
            const modalContainer = document.getElementById('modal-container')!;
            modalContainer.innerHTML = '';
            showSuccess(result.message);
            state.currentPage = 1;
            await refreshUsers(renderContent);
        } catch (err) { console.error(err); }
    });

    // Delete from detail modal
    document.querySelector('.user-detail-delete-btn')?.addEventListener('click', async () => {
        if (!confirm('Apakah Anda yakin ingin menghapus akun ini secara permanen?')) return;
        const id = (document.querySelector('.user-detail-delete-btn') as HTMLElement)?.dataset.id;
        try {
            const response = await apiFetch(`/api/super-admin/users/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                const result = await response.json();
                const modalContainer = document.getElementById('modal-container')!;
                modalContainer.innerHTML = '';
                showSuccess(result.message || 'Akun berhasil dihapus');
                state.currentPage = 1;
                await refreshUsers(renderContent);
            }
        } catch (err) { console.error(err); }
    });
};
