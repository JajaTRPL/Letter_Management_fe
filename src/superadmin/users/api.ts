import { state, tabManager } from './types';
import { apiFetch } from '../../shared/api-client';
import { showSuccess, showError } from '../../shared/toast';

export const refreshUsers = async (onSuccess: () => void) => {
    try {
        const role = tabManager.getActive();
        const params = new URLSearchParams({ role, page: String(state.currentPage), per_page: '25' });
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

export const bulkDeleteUsers = async (userIds: number[], onSuccess: () => void) => {
    try {
        const response = await apiFetch('/api/super-admin/users/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ ids: userIds })
        });

        if (response.ok) {
            showSuccess(`${userIds.length} user berhasil dihapus`);
            onSuccess();
        }
    } catch (err) {
        console.error(err);
    }
};
