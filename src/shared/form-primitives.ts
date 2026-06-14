import { cx, textClass } from './design-system';

export const escapeFormHtml = (value: string | number | null | undefined): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const escapeFormAttribute = escapeFormHtml;

export interface FormSectionCardOptions {
    title?: string;
    body: string;
    className?: string;
    headingClassName?: string;
    omitWhenEmpty?: boolean;
}

export interface FormFieldOptions {
    id?: string;
    label: string;
    controlHtml: string;
    helperText?: string;
    error?: string;
    errorId?: string;
    required?: boolean;
    align?: 'center' | 'start';
    columnsClassName?: string;
}

export interface FormActionFooterOptions {
    previous: {
        id: string;
        label: string;
        invisible?: boolean;
        disabled?: boolean;
    };
    next: {
        id: string;
        label: string;
        disabled?: boolean;
        loading?: boolean;
        loadingLabel?: string;
    };
    className?: string;
}

export function renderFormSectionCard(options: FormSectionCardOptions): string {
    if (options.omitWhenEmpty && !options.body.trim()) return '';

    const title = options.title
        ? `<h3 class="${escapeFormAttribute(options.headingClassName ?? 'text-xl font-bold text-gray-800')}">${escapeFormHtml(options.title)}</h3>`
        : '';

    return `
        <section class="${escapeFormAttribute(options.className ?? 'bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 md:p-7 space-y-5')}">
            ${title}
            ${options.body}
        </section>
    `;
}

export function renderValidationMessage(id: string, error?: string): string {
    return `
        <p id="${escapeFormAttribute(id)}" class="${cx(textClass.error, 'mt-2', error ? '' : 'hidden')}" role="alert" aria-live="polite">
            ${escapeFormHtml(error ?? '')}
        </p>
    `;
}

export function renderFormField(options: FormFieldOptions): string {
    const labelFor = options.id ? ` for="${escapeFormAttribute(options.id)}"` : '';
    const required = options.required
        ? '<span class="text-red-600" aria-hidden="true">*</span><span class="sr-only"> wajib</span>'
        : '';
    const helper = options.helperText
        ? `<p class="${cx(textClass.helper, 'mt-2')}">${escapeFormHtml(options.helperText)}</p>`
        : '';
    const error = options.errorId ? renderValidationMessage(options.errorId, options.error) : '';
    const alignClass = options.align === 'start' ? 'md:items-start' : 'md:items-center';

    return `
        <div class="${escapeFormAttribute(options.columnsClassName ?? `grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 md:gap-6 ${alignClass}`)}">
            <label${labelFor} class="text-sm font-bold text-gray-800 ${options.align === 'start' ? 'pt-2' : ''}">
                ${escapeFormHtml(options.label)} ${required}
            </label>
            <div>
                ${options.controlHtml}
                ${helper}
                ${error}
            </div>
        </div>
    `;
}

export function renderFormActionFooter(options: FormActionFooterOptions): string {
    const previousDisabled = options.previous.disabled ? 'disabled' : '';
    const nextDisabled = options.next.disabled || options.next.loading ? 'disabled' : '';
    const nextMuted = options.next.disabled || options.next.loading;

    return `
        <div class="${escapeFormAttribute(options.className ?? 'pt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between')}">
            <button id="${escapeFormAttribute(options.previous.id)}" type="button" ${previousDisabled} class="px-6 py-2.5 border border-primary-teal text-primary-teal font-bold rounded-xl hover:bg-teal-50 transition-colors ${options.previous.invisible ? 'sm:invisible' : ''} ${options.previous.disabled ? 'cursor-not-allowed opacity-60' : ''}">
                ${escapeFormHtml(options.previous.label)}
            </button>
            <button id="${escapeFormAttribute(options.next.id)}" type="button" ${nextDisabled} class="px-7 py-2.5 rounded-xl font-bold transition-colors ${nextMuted ? 'bg-gray-300 text-white cursor-not-allowed' : 'bg-primary-teal text-white hover:bg-teal-800'}">
                ${escapeFormHtml(options.next.loading ? options.next.loadingLabel ?? 'Memproses...' : options.next.label)}
            </button>
        </div>
    `;
}
