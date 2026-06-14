import { apiFetch } from './api-client';
import { surfaceClass } from './design-system';
import { attachProtectedPdfViewer, renderProtectedPdfViewer } from './protected-pdf-viewer';
import {
    attachSupportingDocumentGallery,
    renderSupportingDocumentGallery,
    type SupportingDocumentDescriptor,
} from './supporting-document-gallery';
import {
    canPreviewGeneratedDocumentForRetention,
    resolveLetterRetentionState,
    retentionAwareSupportingDescriptors,
    type LetterRetentionSummary,
    type LetterRetentionUiState,
} from './retention-state';
import { showError, showSuccess, showWarning } from './toast';

export type ReviewerShellRow = {
    label: string;
    value: string;
};

export type ReviewerShellTextBlock = ReviewerShellRow;

export type ReviewerShellNotice = {
    title: string;
    message: string;
    classes: string;
};

export type ReviewerShellSection = {
    title: string;
    content: string;
};

export type ReviewerShellGeneratedPreview = {
    rootId: string;
    endpointUrl: string;
    title: string;
    subtitle: string;
    loading?: string;
};

export type ReviewerShellModalField = {
    id: string;
    payloadKey: string;
    label: string;
    type: 'text' | 'textarea';
    placeholder: string;
    helper?: string;
    requiredMessage: string;
};

export type ReviewerShellModalNotice = {
    title: string;
    message: string;
    classes: string;
};

export type ReviewerShellModal = {
    id: string;
    title: string;
    headerClass: string;
    cancelId: string;
    confirmId: string;
    confirmText: string;
    confirmClass: string;
    notices?: readonly ReviewerShellModalNotice[];
    summaryRows?: readonly ReviewerShellRow[];
    fields?: readonly ReviewerShellModalField[];
};

export type ReviewerShellAction = {
    buttonId: string;
    buttonText: string;
    buttonClass: string;
    endpointUrl: string;
    successFallback: string;
    modal: ReviewerShellModal;
};

export type ReviewerShellView = {
    title: string;
    subtitle: string;
    backButtonId: string;
    backButtonLabel: string;
    status: {
        label: string;
        tone: string;
    };
    workflowStatus?: string | null;
    retentionSummary?: LetterRetentionSummary | null;
    profileRows: readonly ReviewerShellRow[];
    profileSupplement?: string;
    detailRows: readonly ReviewerShellRow[];
    detailTextBlocks?: readonly ReviewerShellTextBlock[];
    detailSections?: readonly string[];
    submittedAt?: string | null;
    supportingDocuments?: readonly SupportingDocumentDescriptor[];
    supportingGalleryRootId?: string;
    supportingEmptyLabel?: string;
    notices?: readonly ReviewerShellNotice[];
    sections?: readonly ReviewerShellSection[];
    generatedPreview?: ReviewerShellGeneratedPreview;
    actionTitle: string;
    unavailableMessage?: string;
    actions?: readonly ReviewerShellAction[];
    actionNote?: string;
    attachAfterRender?: () => void | (() => void);
};

export type ReviewerShellAdapter<Application> = {
    role: string;
    activePage: string;
    loadApplication: () => Promise<Application>;
    buildView: (application: Application) => ReviewerShellView;
    goBack: () => void | Promise<void>;
};

export type ReviewerShellTimelineStep = {
    label: string;
    date?: string | null;
    done: boolean;
    current?: boolean;
};

let activeDispose: (() => void) | null = null;
let activeRenderId = 0;

export async function renderReviewerShell<Application>(
    adapter: ReviewerShellAdapter<Application>,
): Promise<void> {
    disposeActiveReviewerShell();
    const renderId = ++activeRenderId;
    const { renderDashboardLayout } = await import('../dashboard/DashboardLayout');

    renderDashboardLayout(
        'Review Dokumen',
        '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-800"></div></div>',
        adapter.role,
        adapter.activePage,
    );

    try {
        const application = await adapter.loadApplication();
        if (renderId !== activeRenderId) return;

        const view = adapter.buildView(application);
        const retentionState = resolveLetterRetentionState(view.retentionSummary);
        const supportingDocuments = retentionAwareSupportingDescriptors(
            view.retentionSummary,
            availableSupportingDocuments(view.supportingDocuments),
        );
        const generatedPreview = canPreviewGeneratedDocumentForRetention(view.workflowStatus, view.retentionSummary)
            ? view.generatedPreview
            : undefined;
        const content = renderReviewerShellContent(view, supportingDocuments, retentionState, generatedPreview);

        renderDashboardLayout('Review Dokumen', content, adapter.role, adapter.activePage);

        const cleanupCallbacks: Array<() => void> = [];
        const backButton = document.getElementById(view.backButtonId);
        const onBack = (): void => {
            disposeActiveReviewerShell();
            void adapter.goBack();
        };
        backButton?.addEventListener('click', onBack);
        cleanupCallbacks.push(() => backButton?.removeEventListener('click', onBack));

        if (supportingDocuments.length > 0 && view.supportingGalleryRootId) {
            cleanupCallbacks.push(attachSupportingDocumentGallery(
                view.supportingGalleryRootId,
                supportingDocuments,
            ));
        }

        if (generatedPreview) {
            cleanupCallbacks.push(attachProtectedPdfViewer({
                rootId: generatedPreview.rootId,
                endpointUrl: generatedPreview.endpointUrl,
            }));
        }

        cleanupCallbacks.push(...bindReviewerShellActions(view.actions, adapter.goBack));
        const cleanupAttachment = view.attachAfterRender?.();
        if (cleanupAttachment) cleanupCallbacks.push(cleanupAttachment);

        const dispose = (): void => {
            cleanupCallbacks.splice(0).reverse().forEach((cleanup) => cleanup());
            if (activeDispose === dispose) {
                activeDispose = null;
            }
        };
        activeDispose = dispose;
    } catch (error) {
        if (renderId !== activeRenderId) return;
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data';
        renderDashboardLayout(
            'Error',
            `<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-red-600 font-bold">${escapeReviewerShellHtml(message)}</div>`,
            adapter.role,
            adapter.activePage,
        );
    }
}

export function disposeActiveReviewerShell(): void {
    if (!activeDispose) return;
    const dispose = activeDispose;
    activeDispose = null;
    dispose();
}

export function renderReviewerShellTimeline(steps: readonly ReviewerShellTimelineStep[]): string {
    return `
        <div class="relative pl-6 border-l-2 border-[#115E59] space-y-6 pb-2">
            ${steps.map((step) => `
                <div class="relative">
                    <div class="absolute -left-[31px] ${timelineDotClass(step.done, step.current)}">
                        ${step.done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    <p class="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">${formatReviewerShellDate(step.date)}</p>
                    <p class="text-sm font-bold ${step.current ? 'text-[#A16207]' : step.done ? 'text-gray-800' : 'text-gray-400'}">${escapeReviewerShellHtml(step.label)}</p>
                </div>
            `).join('')}
        </div>
    `;
}

export function formatReviewerShellDateOnly(value?: string | null): string {
    if (!value) return '-';
    const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0] || value;
    const [year, month, day] = iso.split('-');
    if (!year || !month || !day) return value;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatReviewerShellDate(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function reviewerShellValueOrDash(value?: string | null): string {
    const trimmed = value?.trim();
    return trimmed || '-';
}

export function escapeReviewerShellHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderReviewerShellContent(
    view: ReviewerShellView,
    supportingDocuments: readonly SupportingDocumentDescriptor[],
    retentionState: LetterRetentionUiState,
    generatedPreview?: ReviewerShellGeneratedPreview,
): string {
    return `
        <div class="w-full max-w-5xl mx-auto pb-20 animate-fade-in space-y-6" data-reviewer-shell>
            ${renderHeader(view)}
            ${renderRowsCard('Data Mahasiswa', view.profileRows, view.profileSupplement)}
            ${renderDetailCard(view)}
            ${renderRetentionStateCard(retentionState)}
            ${renderSupportingDocumentsCard(view, supportingDocuments, retentionState)}
            ${renderNoticesCard(view.notices)}
            ${(view.sections || []).map(renderSectionCard).join('')}
            ${renderGeneratedPreviewCard(generatedPreview)}
            ${renderActionCard(view)}
        </div>
        ${(view.actions || []).map((action) => renderActionModal(action.modal)).join('')}
    `;
}

function renderHeader(view: ReviewerShellView): string {
    return `
        <div class="flex items-center gap-4 mb-2">
            <button id="${escapeReviewerShellHtml(view.backButtonId)}" class="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" aria-label="${escapeReviewerShellHtml(view.backButtonLabel)}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <div>
                <h1 class="text-2xl font-bold text-gray-800">${escapeReviewerShellHtml(view.title)}</h1>
                <p class="text-xs text-gray-500 mt-1">${escapeReviewerShellHtml(view.subtitle)}</p>
            </div>
        </div>
    `;
}

function renderRowsCard(title: string, rows: readonly ReviewerShellRow[], supplement?: string): string {
    return `
        <div class="${surfaceClass('section', 'overflow-hidden text-sm')}">
            ${renderCardHeader(title)}
            <div class="p-6 md:p-8 space-y-6">
                ${supplement || ''}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${rows.map(renderInfoBox).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderDetailCard(view: ReviewerShellView): string {
    return `
        <div class="${surfaceClass('section', 'overflow-hidden text-sm')}">
            ${renderCardHeader('Detail Pengajuan')}
            <div class="p-6 md:p-8 space-y-5">
                <div class="flex flex-wrap items-center gap-3">
                    <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</span>
                    <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold border ${escapeReviewerShellHtml(view.status.tone)}">${escapeReviewerShellHtml(view.status.label)}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${view.detailRows.map(renderInfoBox).join('')}
                </div>
                ${(view.detailTextBlocks || []).map(renderTextBlock).join('')}
                ${(view.detailSections || []).join('')}
                <div class="pt-2 border-t border-gray-100 border-dashed text-xs text-gray-500 font-medium">
                    Tanggal Pengajuan: ${formatReviewerShellDate(view.submittedAt)}
                </div>
            </div>
        </div>
    `;
}

function renderSupportingDocumentsCard(
    view: ReviewerShellView,
    supportingDocuments: readonly SupportingDocumentDescriptor[],
    retentionState: LetterRetentionUiState,
): string {
    if (!view.supportingGalleryRootId) return '';
    if (supportingDocuments.length === 0 && !retentionState.supportingDocumentsDeleted) return '';

    const emptyLabel = retentionState.supportingDocumentsDeleted
        ? retentionState.supportingDocumentsEmptyLabel
        : view.supportingEmptyLabel;

    return `
        <div class="${surfaceClass('section', 'overflow-hidden text-sm')}">
            ${renderCardHeader('Dokumen Pendukung')}
            <div class="p-6 md:p-8">
                ${renderSupportingDocumentGallery(
                    view.supportingGalleryRootId,
                    supportingDocuments,
                    { emptyLabel },
                )}
            </div>
        </div>
    `;
}

function renderRetentionStateCard(retentionState: LetterRetentionUiState): string {
    if (!retentionState.noticeHtml) return '';

    return `
        <div class="${surfaceClass('section', 'p-6 md:p-8 text-sm')}" data-reviewer-retention-state>
            ${retentionState.noticeHtml}
        </div>
    `;
}

function renderNoticesCard(notices?: readonly ReviewerShellNotice[]): string {
    if (!notices?.length) return '';
    return `
        <div class="${surfaceClass('section', 'overflow-hidden text-sm')}">
            ${renderCardHeader('Catatan Pengajuan')}
            <div class="p-6 md:p-8 space-y-4">
                ${notices.map((notice) => renderNotice(notice)).join('')}
            </div>
        </div>
    `;
}

function renderSectionCard(section: ReviewerShellSection): string {
    return `
        <div class="${surfaceClass('section', 'overflow-hidden text-sm')}">
            ${renderCardHeader(section.title)}
            <div class="p-6 md:p-8">
                ${section.content}
            </div>
        </div>
    `;
}

function renderGeneratedPreviewCard(preview?: ReviewerShellGeneratedPreview): string {
    if (!preview) return '';
    return `
        <div class="${surfaceClass('section', 'overflow-hidden text-sm')}">
            ${renderCardHeader('Pratinjau Dokumen')}
            <div class="p-6 md:p-8">
                ${renderProtectedPdfViewer(preview.rootId, {
                    title: preview.title,
                    subtitle: preview.subtitle,
                    loading: preview.loading ?? 'Memuat pratinjau surat...',
                })}
            </div>
        </div>
    `;
}

function renderActionCard(view: ReviewerShellView): string {
    const actions = view.actions || [];
    return `
        <div class="${surfaceClass('section', 'p-6 md:p-8')}">
            <p class="text-sm font-bold text-gray-800 mb-2">${escapeReviewerShellHtml(view.actionTitle)}</p>
            ${actions.length > 0 ? `
                <div class="space-y-4">
                    ${actions.map((action) => `
                        <button id="${escapeReviewerShellHtml(action.buttonId)}" type="button" class="w-full py-3.5 font-bold rounded-xl transition-colors shadow-sm active:scale-[0.98] ${escapeReviewerShellHtml(action.buttonClass)}">
                            ${escapeReviewerShellHtml(action.buttonText)}
                        </button>
                    `).join('')}
                    ${view.actionNote ? `
                        <div class="mt-4 bg-[#FEF9C3]/50 border border-[#FEF08A] rounded-xl p-4 text-xs font-medium text-amber-900 shadow-inner">
                            <p><span class="font-bold">Catatan:</span> ${escapeReviewerShellHtml(view.actionNote)}</p>
                        </div>
                    ` : ''}
                </div>
            ` : `
                <p class="text-xs text-gray-500 leading-relaxed">${escapeReviewerShellHtml(view.unavailableMessage || 'Tindakan tidak tersedia untuk pengajuan ini.')}</p>
            `}
        </div>
    `;
}

function renderActionModal(modal: ReviewerShellModal): string {
    return `
        <div id="${escapeReviewerShellHtml(modal.id)}" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="${escapeReviewerShellHtml(modal.id)}-title">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-x-hidden overflow-y-auto">
                <div class="${escapeReviewerShellHtml(modal.headerClass)} px-6 py-5 sm:px-8">
                    <h3 id="${escapeReviewerShellHtml(modal.id)}-title" class="text-lg font-bold">${escapeReviewerShellHtml(modal.title)}</h3>
                </div>
                <div class="p-6 space-y-6 sm:p-8">
                    ${(modal.notices || []).map(renderModalNotice).join('')}
                    ${modal.summaryRows?.length ? `
                        <div class="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                            ${modal.summaryRows.map(renderModalRow).join('')}
                        </div>
                    ` : ''}
                    ${(modal.fields || []).map(renderModalField).join('')}
                </div>
                <div class="px-6 pb-6 flex gap-3 sm:px-8 sm:pb-8">
                    <button id="${escapeReviewerShellHtml(modal.cancelId)}" type="button" class="flex-1 px-6 py-3.5 border-2 border-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-colors text-sm">
                        Batal
                    </button>
                    <button id="${escapeReviewerShellHtml(modal.confirmId)}" type="button" class="flex-[1.2] px-6 py-3.5 font-bold rounded-2xl transition-all active:scale-[0.98] text-sm ${escapeReviewerShellHtml(modal.confirmClass)}">
                        ${escapeReviewerShellHtml(modal.confirmText)}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderModalNotice(notice: ReviewerShellModalNotice): string {
    return `
        <div class="${escapeReviewerShellHtml(notice.classes)} rounded-2xl p-4">
            <p class="font-bold text-sm">${escapeReviewerShellHtml(notice.title)}</p>
            <p class="text-xs leading-relaxed mt-1">${escapeReviewerShellHtml(notice.message)}</p>
        </div>
    `;
}

function renderModalField(field: ReviewerShellModalField): string {
    const commonClass = 'w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm';
    const input = field.type === 'textarea'
        ? `<textarea id="${escapeReviewerShellHtml(field.id)}" rows="4" placeholder="${escapeReviewerShellHtml(field.placeholder)}" class="${commonClass} resize-none"></textarea>`
        : `<input id="${escapeReviewerShellHtml(field.id)}" type="text" placeholder="${escapeReviewerShellHtml(field.placeholder)}" class="${commonClass} font-medium">`;
    return `
        <div class="space-y-2">
            <label for="${escapeReviewerShellHtml(field.id)}" class="block text-sm font-bold text-gray-700">${escapeReviewerShellHtml(field.label)} *</label>
            ${input}
            ${field.helper ? `<p class="text-xs font-medium text-gray-600">${escapeReviewerShellHtml(field.helper)}</p>` : ''}
        </div>
    `;
}

function renderModalRow(row: ReviewerShellRow): string {
    return `
        <div class="flex justify-between gap-4 text-[11px]">
            <span class="text-gray-400 font-bold uppercase tracking-wider">${escapeReviewerShellHtml(row.label)}</span>
            <span class="text-gray-700 font-bold text-right">${escapeReviewerShellHtml(row.value)}</span>
        </div>
    `;
}

function renderInfoBox(row: ReviewerShellRow): string {
    return `
        <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
            <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">${escapeReviewerShellHtml(row.label)}</label>
            <p class="text-sm font-semibold text-gray-800">${escapeReviewerShellHtml(row.value)}</p>
        </div>
    `;
}

function renderTextBlock(block: ReviewerShellTextBlock): string {
    return `
        <div class="border border-gray-200 rounded-xl px-4 py-3 bg-white">
            <label class="block text-[10px] font-medium text-gray-400 capitalize mb-1">${escapeReviewerShellHtml(block.label)}</label>
            <p class="text-sm font-semibold text-gray-800 whitespace-pre-line">${escapeReviewerShellHtml(block.value)}</p>
        </div>
    `;
}

function renderNotice(notice: ReviewerShellNotice): string {
    return `
        <div class="rounded-xl border p-4 ${escapeReviewerShellHtml(notice.classes)}">
            <p class="text-xs font-black uppercase tracking-wider mb-1">${escapeReviewerShellHtml(notice.title)}</p>
            <p class="text-sm font-semibold whitespace-pre-line">${escapeReviewerShellHtml(notice.message)}</p>
        </div>
    `;
}

function renderCardHeader(title: string): string {
    return `
        <div class="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 bg-[#F8FAFC]/50">
            ${escapeReviewerShellHtml(title)}
        </div>
    `;
}

function bindReviewerShellActions(
    actions: readonly ReviewerShellAction[] | undefined,
    goBack: () => void | Promise<void>,
): Array<() => void> {
    if (!actions?.length) return [];

    const cleanupCallbacks: Array<() => void> = [];
    const closeAllModals = (): void => {
        actions.forEach((action) => {
            document.getElementById(action.modal.id)?.classList.add('hidden');
        });
    };

    actions.forEach((action) => {
        const openButton = document.getElementById(action.buttonId);
        const cancelButton = document.getElementById(action.modal.cancelId);
        const confirmButton = document.getElementById(action.modal.confirmId);
        const open = (): void => document.getElementById(action.modal.id)?.classList.remove('hidden');
        const close = (): void => document.getElementById(action.modal.id)?.classList.add('hidden');
        const submit = (): void => {
            void submitReviewerShellAction(action, closeAllModals, goBack);
        };

        openButton?.addEventListener('click', open);
        cancelButton?.addEventListener('click', close);
        confirmButton?.addEventListener('click', submit);
        cleanupCallbacks.push(() => openButton?.removeEventListener('click', open));
        cleanupCallbacks.push(() => cancelButton?.removeEventListener('click', close));
        cleanupCallbacks.push(() => confirmButton?.removeEventListener('click', submit));
    });

    const closeOnEscape = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') closeAllModals();
    };
    document.addEventListener('keydown', closeOnEscape);
    cleanupCallbacks.push(() => document.removeEventListener('keydown', closeOnEscape));

    return cleanupCallbacks;
}

async function submitReviewerShellAction(
    action: ReviewerShellAction,
    closeAllModals: () => void,
    goBack: () => void | Promise<void>,
): Promise<void> {
    const payload: Record<string, string> = {};
    for (const field of action.modal.fields || []) {
        const input = document.getElementById(field.id) as HTMLInputElement | HTMLTextAreaElement | null;
        const value = input?.value.trim() || '';
        if (!value) {
            showWarning(field.requiredMessage);
            return;
        }
        payload[field.payloadKey] = value;
    }

    const button = document.getElementById(action.modal.confirmId) as HTMLButtonElement | null;
    const originalText = button?.innerHTML || '';
    if (button) {
        button.disabled = true;
        button.innerHTML = 'Memproses...';
    }

    try {
        const response = await apiFetch(action.endpointUrl, {
            method: 'PATCH',
            body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
        });
        const result = await response.json() as { message?: string; errors?: Record<string, string[]> };
        if (!response.ok) {
            throw new Error(errorMessageFromResponse(result));
        }

        showSuccess(result.message || action.successFallback);
        closeAllModals();
        disposeActiveReviewerShell();
        void goBack();
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal memproses pengajuan';
        showError(message);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

function availableSupportingDocuments(
    documents?: readonly SupportingDocumentDescriptor[],
): SupportingDocumentDescriptor[] {
    return (documents || []).filter((document) => document.available !== false);
}

function errorMessageFromResponse(result: { message?: string; errors?: Record<string, string[]> }): string {
    if (result.message) return result.message;
    const firstError = Object.values(result.errors || {})[0]?.[0];
    return firstError || 'Gagal memproses pengajuan';
}

function timelineDotClass(done: boolean, current?: boolean): string {
    if (done) return 'bg-[#115E59] rounded-full p-0.5 border-4 border-white';
    if (current) return 'bg-white border-2 border-yellow-400 w-5 h-5 rounded-full z-10 flex items-center justify-center';
    return 'bg-gray-300 rounded-full w-5 h-5 border-4 border-white';
}
