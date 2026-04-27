/**
 * Centralized toast notification wrapper.
 * Replaces 17+ inline Toastify blocks with duplicated config.
 *
 * USAGE:
 *   import { showSuccess, showError, showWarning } from '../shared/toast';
 *   showSuccess('Berhasil menyimpan!');
 *   showError('Gagal menghubungi server.');
 */
import Toastify from 'toastify-js';

const DEFAULTS = {
    duration: 3000,
    gravity: 'top' as const,
    position: 'right' as const,
    stopOnFocus: true,
};

export function showSuccess(text: string, duration = DEFAULTS.duration): void {
    Toastify({
        ...DEFAULTS,
        text,
        duration,
        style: { background: '#10B981' },
    }).showToast();
}

export function showError(text: string, duration = DEFAULTS.duration): void {
    Toastify({
        ...DEFAULTS,
        text,
        duration,
        style: { background: '#EF4444' },
    }).showToast();
}

export function showWarning(text: string, duration = DEFAULTS.duration): void {
    Toastify({
        ...DEFAULTS,
        text,
        duration,
        style: { background: '#F59E0B' },
    }).showToast();
}

export function showInfo(text: string, duration = DEFAULTS.duration): void {
    Toastify({
        ...DEFAULTS,
        text,
        duration,
        style: { background: '#3B82F6' },
    }).showToast();
}
