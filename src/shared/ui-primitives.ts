import { escapeFormHtml } from './form-primitives';
import {
    badgeClass,
    cx,
    SPINNER_CLASS,
    surfaceClass,
    textClass,
    type UiTone,
} from './design-system';

/**
 * Tiny semantic rendering helpers (CP7A) built on the design-system tokens.
 * Stateless string builders only — no DOM lifecycle, no fetching, no domain
 * knowledge. All caller-supplied text is HTML-escaped.
 */

export function renderStatusBadge(tone: UiTone, label: string, extra?: string): string {
    return `<span class="${badgeClass(tone, extra)}">${escapeFormHtml(label)}</span>`;
}

export function renderLoadingState(message = 'Memuat data...'): string {
    return `
        <div class="${surfaceClass('card', 'p-10')} flex items-center gap-4">
            <div class="${SPINNER_CLASS} w-9 h-9"></div>
            <p class="text-sm font-semibold text-gray-600">${escapeFormHtml(message)}</p>
        </div>
    `;
}

export function renderErrorState(message = 'Gagal memuat data. Silakan coba lagi.'): string {
    return `
        <div role="alert" class="${cx(surfaceClass('card'), 'border-red-200 bg-red-50 text-red-800 px-5 py-4')} text-sm font-semibold">
            ${escapeFormHtml(message)}
        </div>
    `;
}

export function renderEmptyState(message: string, extra?: string): string {
    return `<div class="${cx('px-6 py-10 text-center text-sm font-medium text-gray-500', extra)}">${escapeFormHtml(message)}</div>`;
}

export function renderFieldMessage(id: string, error?: string): string {
    return `
        <p id="${escapeFormHtml(id)}" class="${textClass.error} mt-2 ${error ? '' : 'hidden'}" role="alert" aria-live="polite">
            ${escapeFormHtml(error ?? '')}
        </p>
    `;
}
