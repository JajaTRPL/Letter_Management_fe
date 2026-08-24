import type { AcademicPeriod } from './types';
import { showSuccess, showError } from '../../shared/toast';
import { deleteAcademicPeriod, toggleAcademicPeriod } from './api';
import { renderAcademicPeriodModal } from './modals';
import { renderAcademicPeriodTable } from './ui-utils';
import { confirmModal } from '../../shared/confirm-modal';
import {
    formatLocalDateLong,
    isCurrentToday,
    isExpired,
    isFuture,
} from './state';

const TONE_TEAL = 'bg-teal-700 hover:bg-teal-800';
const TONE_RED = 'bg-red-600 hover:bg-red-700';

/**
 * Build and show a styled confirm dialog explaining the consequence of
 * toggling this specific period at the time of the click. Resolves to the
 * user's choice.
 */
const confirmToggleAction = (period: AcademicPeriod): Promise<boolean> => {
    if (period.is_active) {
        // Toggling OFF
        if (isCurrentToday(period)) {
            return confirmModal({
                title: 'Nonaktifkan Periode yang Sedang Berjalan?',
                body: 'Periode ini sedang berjalan hari ini.\n\n'
                    + 'Setelah dinonaktifkan, tidak ada periode berjalan hari ini sampai Anda mengaktifkan periode lain yang tanggalnya mencakup hari ini.',
                confirmLabel: 'Ya, Nonaktifkan',
                confirmTone: TONE_TEAL,
            });
        }
        return confirmModal({
            title: 'Nonaktifkan Periode Akademik?',
            body: 'Apakah Anda yakin ingin menonaktifkan periode akademik ini?',
            confirmLabel: 'Ya, Nonaktifkan',
            confirmTone: TONE_TEAL,
        });
    }

    // Toggling ON
    if (isFuture(period)) {
        return confirmModal({
            title: 'Aktifkan Periode yang Belum Dimulai?',
            body: `Periode ini baru mulai pada ${formatLocalDateLong(period.start_date)}.\n\n`
                + 'Jika diaktifkan sekarang, periode ini TETAP BELUM menjadi periode berjalan sampai tanggal tersebut. Sistem akan menganggap tidak ada periode berjalan hari ini.',
            confirmLabel: 'Ya, Aktifkan',
            confirmTone: TONE_TEAL,
        });
    }
    if (isExpired(period)) {
        return confirmModal({
            title: 'Aktifkan Periode yang Sudah Berakhir?',
            body: `Periode ini sudah berakhir pada ${formatLocalDateLong(period.end_date)}.\n\n`
                + 'Jika diaktifkan sekarang, periode ini TETAP TIDAK menjadi periode berjalan hari ini. Rendering surat yang membutuhkan periode akademik akan mengisi nilai kosong.',
            confirmLabel: 'Ya, Aktifkan',
            confirmTone: TONE_TEAL,
        });
    }
    // Date range covers today → activating makes it the current period.
    return confirmModal({
        title: 'Aktifkan Periode Ini?',
        body: 'Periode ini akan menjadi periode berjalan hari ini. Periode aktif lainnya akan otomatis dinonaktifkan.',
        confirmLabel: 'Ya, Aktifkan',
        confirmTone: TONE_TEAL,
    });
};

/** Confirm copy for delete; adds an extra warning when the row is current today. */
const confirmDeleteAction = (period: AcademicPeriod): Promise<boolean> => {
    if (isCurrentToday(period)) {
        return confirmModal({
            title: 'Hapus Periode yang Sedang Berjalan?',
            body: 'Periode ini SEDANG BERJALAN hari ini.\n\n'
                + 'Menghapusnya akan membuat sistem tidak memiliki periode berjalan sampai Anda mengaktifkan periode lain yang valid. Tindakan ini tidak dapat dibatalkan.',
            confirmLabel: 'Ya, Hapus',
            confirmTone: TONE_RED,
        });
    }
    return confirmModal({
        title: 'Hapus Periode Akademik?',
        body: 'Periode akademik ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.',
        confirmLabel: 'Ya, Hapus',
        confirmTone: TONE_RED,
    });
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
            if (!(await confirmToggleAction(period))) return;
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
            if (!(await confirmDeleteAction(period))) return;
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
