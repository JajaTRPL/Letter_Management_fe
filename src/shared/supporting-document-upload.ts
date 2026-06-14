import {
    escapeFormAttribute,
    escapeFormHtml,
    renderFormField,
    renderFormSectionCard,
} from './form-primitives';
import { textClass } from './design-system';

const PDF_MIME_TYPE = 'application/pdf';

export interface SupportingDocumentUploadDefinition {
    key: string;
    inputName: string;
    inputId?: string;
    label: string;
    description?: string;
    requiredOnSubmit: boolean;
    accept: typeof PDF_MIME_TYPE;
    maxSizeBytes: number;
}

export interface SupportingDocumentUploadState {
    existingValues: Record<string, string | null | undefined>;
    selectedFiles: Record<string, File | null | undefined>;
    errors: Record<string, string | undefined>;
}

export interface SupportingDocumentUploadSectionOptions {
    title?: string;
    disabled?: boolean;
    className?: string;
    headingClassName?: string;
}

export interface AttachSupportingDocumentUploadOptions {
    disabled?: boolean;
    onValidationError?: (message: string) => void;
}

export interface SupportingDocumentUploadValidationResult {
    valid: boolean;
    firstError?: string;
}

interface SupportingDocumentUploadIds {
    input: string;
    status: string;
    error: string;
}

export function createSupportingDocumentUploadState(
    existingValues: SupportingDocumentUploadState['existingValues'] = {},
): SupportingDocumentUploadState {
    return {
        existingValues: { ...existingValues },
        selectedFiles: {},
        errors: {},
    };
}

export function displaySupportingDocumentFilename(value?: string | null): string | null {
    if (!value) return null;

    const withoutQuery = value.split('?')[0] || value;
    const basename = withoutQuery.replace(/\\/g, '/').split('/').pop() || withoutQuery;
    try {
        return decodeURIComponent(basename);
    } catch {
        return basename;
    }
}

export function renderSupportingDocumentUploadSection(
    definitions: readonly SupportingDocumentUploadDefinition[],
    state: SupportingDocumentUploadState,
    options: SupportingDocumentUploadSectionOptions = {},
): string {
    if (definitions.length === 0) return '';

    return renderFormSectionCard({
        title: options.title ?? 'Dokumen Pendukung',
        className: options.className ?? 'border-t border-gray-200 pt-8 space-y-5',
        headingClassName: options.headingClassName,
        body: definitions.map((definition) => renderUploadField(definition, state, Boolean(options.disabled))).join(''),
    });
}

export function attachSupportingDocumentUploadSection(
    definitions: readonly SupportingDocumentUploadDefinition[],
    state: SupportingDocumentUploadState,
    options: AttachSupportingDocumentUploadOptions = {},
): () => void {
    if (options.disabled) return () => undefined;

    const cleanup: Array<() => void> = [];
    for (const definition of definitions) {
        const ids = uploadIds(definition);
        const input = document.getElementById(ids.input) as HTMLInputElement | null;
        if (!input) continue;

        const onChange = (): void => {
            const file = input.files?.[0] ?? null;
            if (!file) {
                state.selectedFiles[definition.key] = null;
                updateUploadField(definition, state);
                return;
            }

            const error = validateSelectedFile(definition, file);
            if (error) {
                state.selectedFiles[definition.key] = null;
                state.errors[definition.key] = error;
                input.value = '';
                updateUploadField(definition, state);
                options.onValidationError?.(error);
                return;
            }

            state.selectedFiles[definition.key] = file;
            delete state.errors[definition.key];
            updateUploadField(definition, state);
        };

        input.addEventListener('change', onChange);
        cleanup.push(() => input.removeEventListener('change', onChange));
    }

    return () => cleanup.forEach((dispose) => dispose());
}

export function validateSupportingDocumentUploads(
    definitions: readonly SupportingDocumentUploadDefinition[],
    state: SupportingDocumentUploadState,
): SupportingDocumentUploadValidationResult {
    let firstError: string | undefined;

    for (const definition of definitions) {
        const selectedFile = state.selectedFiles[definition.key];
        const selectedError = selectedFile ? validateSelectedFile(definition, selectedFile) : state.errors[definition.key];
        const requiredError = definition.requiredOnSubmit
            && !selectedFile
            && !state.existingValues[definition.key]
            ? `${definition.label} wajib diunggah.`
            : undefined;
        const error = selectedError ?? requiredError;

        if (error) {
            state.errors[definition.key] = error;
            firstError ??= error;
        } else {
            delete state.errors[definition.key];
        }
        updateUploadField(definition, state);
    }

    return { valid: !firstError, firstError };
}

export function getSelectedSupportingDocumentFile(
    state: SupportingDocumentUploadState,
    key: string,
): File | null {
    return state.selectedFiles[key] ?? null;
}

function renderUploadField(
    definition: SupportingDocumentUploadDefinition,
    state: SupportingDocumentUploadState,
    disabled: boolean,
): string {
    const ids = uploadIds(definition);
    const status = uploadStatus(definition, state);
    const error = state.errors[definition.key];

    return renderFormField({
        id: ids.input,
        label: definition.label,
        required: definition.requiredOnSubmit,
        align: 'start',
        error,
        errorId: ids.error,
        controlHtml: `
            <input id="${escapeFormAttribute(ids.input)}" name="${escapeFormAttribute(definition.inputName)}" type="file" accept="${escapeFormAttribute(`${definition.accept},.pdf`)}" ${disabled ? 'disabled' : ''} aria-describedby="${escapeFormAttribute(`${ids.status} ${ids.error}`)}" aria-invalid="${error ? 'true' : 'false'}" class="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:bg-gray-200 file:text-gray-600 hover:file:bg-gray-300 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-primary-teal disabled:cursor-not-allowed disabled:opacity-60">
            <p id="${escapeFormAttribute(ids.status)}" class="${textClass.helper} mt-2 break-words">${escapeFormHtml(status)}</p>
        `,
    });
}

function validateSelectedFile(definition: SupportingDocumentUploadDefinition, file: File): string | undefined {
    const isPdf = file.type === definition.accept || (file.type === '' && file.name.toLowerCase().endsWith('.pdf'));
    if (!isPdf) {
        return `${definition.label} harus berupa file PDF.`;
    }
    if (file.size > definition.maxSizeBytes) {
        return `Ukuran ${definition.label} maksimal ${formatFileSize(definition.maxSizeBytes)}.`;
    }
    return undefined;
}

function uploadStatus(
    definition: SupportingDocumentUploadDefinition,
    state: SupportingDocumentUploadState,
): string {
    const selectedFile = state.selectedFiles[definition.key];
    if (selectedFile) return `File dipilih: ${selectedFile.name}`;

    const existingFilename = displaySupportingDocumentFilename(state.existingValues[definition.key]);
    if (existingFilename) return `File tersimpan: ${existingFilename}`;

    return definition.description ?? `Format: PDF, maks ${formatFileSize(definition.maxSizeBytes)}.`;
}

function updateUploadField(
    definition: SupportingDocumentUploadDefinition,
    state: SupportingDocumentUploadState,
): void {
    const ids = uploadIds(definition);
    const input = document.getElementById(ids.input) as HTMLInputElement | null;
    const status = document.getElementById(ids.status);
    const error = document.getElementById(ids.error);
    const message = state.errors[definition.key];

    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (status) status.textContent = uploadStatus(definition, state);
    if (error) {
        error.textContent = message ?? '';
        error.classList.toggle('hidden', !message);
    }
}

function uploadIds(definition: SupportingDocumentUploadDefinition): SupportingDocumentUploadIds {
    const input = definition.inputId ?? definition.inputName;
    const safeInput = input.replace(/[^a-zA-Z0-9_-]/g, '-');
    return {
        input: safeInput,
        status: `${safeInput}-status`,
        error: `${safeInput}-error`,
    };
}

function formatFileSize(bytes: number): string {
    const megabytes = bytes / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}
