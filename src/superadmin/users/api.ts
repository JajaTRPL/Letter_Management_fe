import { state, tabManager } from './types';
import { apiFetch } from '../../shared/api-client';
import { showSuccess, showError } from '../../shared/toast';

export const refreshUsers = async (onSuccess: () => void) => {
    try {
        const role = tabManager.getActive();
        const params = new URLSearchParams({
            role,
            page: String(state.currentPage),
            per_page: '25',
            sort_by: state.currentSortBy,
            sort_dir: state.currentSortDir,
        });
        if (state.currentSearch) params.set('search', state.currentSearch);
        if (state.currentStatus) params.set('status', state.currentStatus);
        const response = await apiFetch(`/api/super-admin/users?${params}`);
        const result = await response.json();
        state.allUsers = result.data ?? [];
        state.meta = result.meta ?? null;
        onSuccess();
    } catch (err) {
        console.error(err);
        showError('Gagal memuat data terbaru');
    }
};

export const deleteUser = async (userId: number, onSuccess: () => void) => {
    try {
        const response = await apiFetch(`/api/super-admin/users/${userId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            showSuccess('User berhasil dihapus');
            onSuccess();
        }
    } catch (err) {
        console.error(err);
    }
};
