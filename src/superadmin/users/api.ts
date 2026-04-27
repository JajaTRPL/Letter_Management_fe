import { state } from './types';
import { apiFetch } from '../../shared/api-client';
import { showSuccess, showError } from '../../shared/toast';

export const refreshUsers = async (onSuccess: () => void) => {
    try {
        const response = await apiFetch('/api/super-admin/users');
        const result = await response.json();
        state.allUsers = result.data;
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
