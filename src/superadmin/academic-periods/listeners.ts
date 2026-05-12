import type { AcademicPeriod } from './types';
import { showSuccess, showError } from '../../shared/toast';
import { deleteAcademicPeriod, toggleAcademicPeriod } from './api';
import { renderAcademicPeriodModal } from './modals';
import { renderAcademicPeriodTable } from './ui-utils';

const attachRowListeners = (periods: AcademicPeriod[], onRefresh: () => void): void => {
    document.querySelectorAll('.ap-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt((btn as HTMLElement).dataset.id ?? '');
            const period = periods.find(p => p.id === id);
            if (period) renderAcademicPeriodModal(period, onRefresh);
        });
    });

    document.querySelectorAll('.ap-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt((btn as HTMLElement).dataset.id ?? '');
            const isActive = (btn as HTMLElement).dataset.active === 'true';
            const label = isActive ? 'nonaktifkan' : 'aktifkan';
            if (!confirm(`Apakah Anda yakin ingin ${label} periode akademik ini?`)) return;
            try {
                const response = await toggleAcademicPeriod(id);
                const result = await response.json();
                if (response.ok) {
                    showSuccess(result.message);
                    onRefresh();
                } else {
                    const errors = result.errors as Record<string, string[]> | undefined;
                    if (errors) {
                        showError(Object.values(errors).flat().join(' '));
                    } else {
                        showError(result.message || 'Gagal mengubah status periode');
                    }
                }
            } catch (err) {
                console.error(err);
                showError('Terjadi kesalahan jaringan');
            }
        });
    });

    document.querySelectorAll('.ap-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Apakah Anda yakin ingin menghapus periode akademik ini secara permanen?')) return;
            const id = parseInt((btn as HTMLElement).dataset.id ?? '');
            try {
                const response = await deleteAcademicPeriod(id);
                const result = await response.json();
                if (response.ok) {
                    showSuccess(result.message);
                    onRefresh();
                } else {
                    showError(result.message || 'Gagal menghapus periode akademik');
                }
            } catch (err) {
                console.error(err);
                showError('Terjadi kesalahan jaringan');
            }
        });
    });
};

export const setupAcademicPeriodListeners = (
    periods: AcademicPeriod[],
    onRefresh: () => void
): void => {
    document.getElementById('ap-add-btn')?.addEventListener('click', () => {
        renderAcademicPeriodModal(null, onRefresh);
    });

    const searchInput = document.getElementById('ap-search') as HTMLInputElement | null;
    const typeFilter = document.getElementById('ap-type-filter') as HTMLSelectElement | null;
    const activeFilter = document.getElementById('ap-active-filter') as HTMLSelectElement | null;

    const applyFilters = (): void => {
        const query = (searchInput?.value ?? '').toLowerCase();
        const typeVal = typeFilter?.value ?? '';
        const activeVal = activeFilter?.value ?? '';

        const filtered = periods.filter(p => {
            const matchQuery = !query || p.academic_year.toLowerCase().includes(query);
            const matchType = !typeVal || p.semester_type === typeVal;
            const matchActive = activeVal === '' || String(p.is_active) === activeVal;
            return matchQuery && matchType && matchActive;
        });

        const tbody = document.getElementById('ap-table-body');
        if (tbody) tbody.innerHTML = renderAcademicPeriodTable(filtered);
        attachRowListeners(periods, onRefresh);
    };

    searchInput?.addEventListener('input', applyFilters);
    typeFilter?.addEventListener('change', applyFilters);
    activeFilter?.addEventListener('change', applyFilters);

    attachRowListeners(periods, onRefresh);
};
