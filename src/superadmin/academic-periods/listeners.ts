import type { AcademicPeriod } from './types';
import { showSuccess, showError } from '../../shared/toast';
import { deleteAcademicPeriod, toggleAcademicPeriod } from './api';
import { renderAcademicPeriodModal } from './modals';
import { renderAcademicPeriodTable } from './ui-utils';
import {
    formatLocalDateLong,
    isCurrentToday,
    isExpired,
    isFuture,
} from './state';

/**
 * Build a confirm() message that explains the consequence of toggling this
 * specific period at the time of the click. Returns the user's confirm choice.
 */
const confirmToggleAction = (period: AcademicPeriod): boolean => {
    if (period.is_active) {
        // Toggling OFF
        if (isCurrentToday(period)) {
            return confirm(
                'Periode ini sedang berjalan hari ini.\n\n'
                + 'Setelah dinonaktifkan, tidak ada periode berjalan hari ini sampai Anda mengaktifkan periode lain yang tanggalnya mencakup hari ini.\n\n'
                + 'Lanjutkan menonaktifkan?'
            );
        }
        return confirm('Apakah Anda yakin ingin menonaktifkan periode akademik ini?');
    }

    // Toggling ON
    if (isFuture(period)) {
        return confirm(
            `Periode ini baru mulai pada ${formatLocalDateLong(period.start_date)}.\n\n`
            + 'Jika diaktifkan sekarang, periode ini TETAP BELUM menjadi periode berjalan sampai tanggal tersebut. Sistem akan menganggap tidak ada periode berjalan hari ini.\n\n'
            + 'Lanjutkan mengaktifkan?'
        );
    }
    if (isExpired(period)) {
        return confirm(
            `Periode ini sudah berakhir pada ${formatLocalDateLong(period.end_date)}.\n\n`
            + 'Jika diaktifkan sekarang, periode ini TETAP TIDAK menjadi periode berjalan hari ini. Rendering surat yang membutuhkan periode akademik akan mengisi nilai kosong.\n\n'
            + 'Lanjutkan mengaktifkan?'
        );
    }
    // Date range covers today → activating makes it the current period.
    return confirm(
        'Periode ini akan menjadi periode berjalan hari ini. Periode aktif lainnya akan otomatis dinonaktifkan.\n\n'
        + 'Lanjutkan mengaktifkan?'
    );
};

/** Confirm copy for delete; adds an extra warning when the row is current today. */
const confirmDeleteAction = (period: AcademicPeriod): boolean => {
    if (isCurrentToday(period)) {
        return confirm(
            'Periode ini SEDANG BERJALAN hari ini.\n\n'
            + 'Menghapusnya akan membuat sistem tidak memiliki periode berjalan sampai Anda mengaktifkan periode lain yang valid.\n\n'
            + 'Apakah Anda yakin ingin menghapus periode akademik ini secara permanen?'
        );
    }
    return confirm('Apakah Anda yakin ingin menghapus periode akademik ini secara permanen?');
};

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
            const period = periods.find(p => p.id === id);
            if (!period) return;
            if (!confirmToggleAction(period)) return;
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
            const id = parseInt((btn as HTMLElement).dataset.id ?? '');
            const period = periods.find(p => p.id === id);
            if (!period) return;
            if (!confirmDeleteAction(period)) return;
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
