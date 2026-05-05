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
    position: 'center' as const,
    stopOnFocus: true,
};

type ToastType = 'success' | 'error' | 'warning' | 'info';

const getToastContainer = (): HTMLElement => {
    let container = document.querySelector<HTMLElement>('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'false');
        document.body.appendChild(container);
    }
    return container;
};

const getToastTitle = (type: ToastType): string => {
    switch (type) {
        case 'success':
            return 'Berhasil';
        case 'error':
            return 'Gagal';
        case 'warning':
            return 'Peringatan';
        case 'info':
        default:
            return 'Informasi';
    }
};

const getToastIcon = (type: ToastType): string => {
    if (type === 'success') {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.2"></circle><path d="M7.8 12.2l2.8 2.8 5.8-6.3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    }

    if (type === 'error') {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.2"></circle><path d="M12 6.8v7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path><path d="M12 17.2h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg>';
    }

    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.2"></circle><path d="M12 10.5v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path><path d="M12 7.2h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg>';
};

const createToastNode = (type: ToastType, message: string): HTMLElement => {
    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.innerHTML = getToastIcon(type);

    const content = document.createElement('div');
    content.className = 'toast-content';

    const title = document.createElement('div');
    title.className = 'toast-title';
    title.textContent = getToastTitle(type);

    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = message;

    content.append(title, messageEl);

    const node = document.createElement('div');
    node.className = 'toast-layout';
    node.append(icon, content);
    return node;
};

const showToast = (type: ToastType, text: string, duration: number): void => {
    const container = getToastContainer();
    const toast = Toastify({
        ...DEFAULTS,
        selector: container,
        node: createToastNode(type, text),
        duration,
        className: `toast toast-${type}`,
        style: { background: 'transparent' },
    }).showToast();

    const toastElement = (toast as any).toastElement as HTMLElement | undefined;
    if (toastElement) {
        container.appendChild(toastElement);
    }
};

export function showSuccess(text: string, duration = DEFAULTS.duration): void {
    showToast('success', text, duration);
}

export function showError(text: string, duration = DEFAULTS.duration): void {
    showToast('error', text, duration);
}

export function showWarning(text: string, duration = DEFAULTS.duration): void {
    showToast('warning', text, duration);
}

export function showInfo(text: string, duration = DEFAULTS.duration): void {
    showToast('info', text, duration);
}
