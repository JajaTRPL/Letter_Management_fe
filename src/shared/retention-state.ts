import { LETTER_WORKFLOW_STATUS } from './letter-workflow';
import type { SupportingDocumentDescriptor } from './supporting-document-gallery';

export type FinalDownloadState =
    | 'not_started'
    | 'active'
    | 'expired'
    | 'archived'
    | 'archive_purged'
    | 'unavailable';

export type RetainedArtifactState =
    | 'not_started'
    | 'retained'
    | 'deleted'
    | 'partially_deleted'
    | 'not_applicable'
    | 'unavailable'
    | 'unknown';

export interface LetterRetentionSummary {
    completed_at?: string | null;
    final_download_available?: boolean;
    final_download_expires_at?: string | null;
    final_download_state?: FinalDownloadState | string | null;
    supporting_documents_state?: RetainedArtifactState | string | null;
    intermediate_artifacts_state?: RetainedArtifactState | string | null;
}

export interface LetterRetentionUiState {
    hasSummary: boolean;
    completedAt: Date | null;
    finalExpiresAt: Date | null;
    finalDownloadAvailable: boolean;
    finalDownloadExpired: boolean;
    finalDownloadNearExpiry: boolean;
    finalDownloadState: string;
    supportingDocumentsDeleted: boolean;
    supportingDocumentsPartiallyDeleted: boolean;
    supportingDocumentsState: string;
    noticeHtml: string;
    supportingDocumentsEmptyLabel: string;
}

export type MahasiswaRetentionUiState = LetterRetentionUiState;

export const FINAL_DOWNLOAD_EXPIRED_MESSAGE = 'Masa unduh surat resmi telah berakhir.';
export const SUPPORTING_DOCUMENTS_DELETED_MESSAGE = 'Dokumen pendukung telah dibersihkan sesuai kebijakan retensi.';

const NEAR_EXPIRY_DAYS = 3;

const esc = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const parseDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value: Date | null): string => {
    if (!value) return '-';
    const date = value.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    const time = value.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
};

const daysUntil = (expiresAt: Date | null, now: Date): number | null => {
    if (!expiresAt) return null;
    const diffMs = expiresAt.getTime() - now.getTime();
    if (diffMs < 0) return 0;
    return Math.ceil(diffMs / 86_400_000);
};

const isExpiredFinalState = (state: string): boolean => (
    state === 'expired' || state === 'archived' || state === 'archive_purged'
);

const retentionNotice = (tone: 'info' | 'warning' | 'expired', title: string, messages: string[]): string => {
    if (messages.length === 0) return '';

    const toneClass = tone === 'warning'
        ? 'bg-amber-50 border-amber-200 text-amber-900'
        : tone === 'expired'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-teal-50 border-teal-100 text-teal-800';

    return `
        <div data-retention-state class="${toneClass} border rounded-xl px-4 py-3 space-y-1">
            <p class="text-sm font-bold">${esc(title)}</p>
            ${messages.map((message) => `<p class="text-xs leading-relaxed">${esc(message)}</p>`).join('')}
        </div>
    `;
};

export const resolveLetterRetentionState = (
    summary?: LetterRetentionSummary | null,
    now: Date = new Date(),
): LetterRetentionUiState => {
    const hasSummary = !!summary;
    const finalState = String(summary?.final_download_state ?? 'not_started');
    const supportingState = String(summary?.supporting_documents_state ?? 'not_started');
    const completedAt = parseDate(summary?.completed_at);
    const finalExpiresAt = parseDate(summary?.final_download_expires_at);
    const finalDownloadAvailable = summary?.final_download_available === true && finalState === 'active';
    const finalDownloadExpired = isExpiredFinalState(finalState);
    const remainingDays = daysUntil(finalExpiresAt, now);
    const finalDownloadNearExpiry = finalDownloadAvailable
        && remainingDays !== null
        && remainingDays <= NEAR_EXPIRY_DAYS;
    const supportingDocumentsDeleted = supportingState === 'deleted';
    const supportingDocumentsPartiallyDeleted = supportingState === 'partially_deleted';

    const messages: string[] = [];
    let title = 'Retensi surat';
    let tone: 'info' | 'warning' | 'expired' = 'info';

    if (finalDownloadExpired) {
        title = 'Masa unduh berakhir';
        tone = 'expired';
        messages.push(FINAL_DOWNLOAD_EXPIRED_MESSAGE);
    } else if (finalDownloadAvailable && finalExpiresAt) {
        title = finalDownloadNearExpiry ? 'Masa unduh hampir berakhir' : 'Masa unduh surat resmi';
        tone = finalDownloadNearExpiry ? 'warning' : 'info';
        messages.push(`Surat resmi dapat diunduh sampai ${formatDateTime(finalExpiresAt)}.`);
    }

    if (supportingDocumentsDeleted) {
        title = finalDownloadExpired ? title : 'Retensi dokumen pendukung';
        if (!finalDownloadExpired && tone !== 'warning') tone = 'info';
        messages.push(SUPPORTING_DOCUMENTS_DELETED_MESSAGE);
    } else if (supportingDocumentsPartiallyDeleted) {
        messages.push('Sebagian dokumen pendukung telah dibersihkan sesuai kebijakan retensi.');
    }

    return {
        hasSummary,
        completedAt,
        finalExpiresAt,
        finalDownloadAvailable,
        finalDownloadExpired,
        finalDownloadNearExpiry,
        finalDownloadState: finalState,
        supportingDocumentsDeleted,
        supportingDocumentsPartiallyDeleted,
        supportingDocumentsState: supportingState,
        noticeHtml: hasSummary ? retentionNotice(tone, title, messages) : '',
        supportingDocumentsEmptyLabel: supportingDocumentsDeleted
            ? SUPPORTING_DOCUMENTS_DELETED_MESSAGE
            : 'Dokumen pendukung belum tersedia.',
    };
};

export const resolveMahasiswaRetentionState = resolveLetterRetentionState;

export const canDownloadFinalForMahasiswa = (
    status?: string | null,
    summary?: LetterRetentionSummary | null,
): boolean => (
    status === LETTER_WORKFLOW_STATUS.COMPLETED
    && resolveLetterRetentionState(summary).finalDownloadAvailable
);

export const canPreviewFinalForMahasiswa = (
    status?: string | null,
    summary?: LetterRetentionSummary | null,
): boolean => (
    status === LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW
    || canDownloadFinalForMahasiswa(status, summary)
);

export const canPreviewGeneratedDocumentForRetention = (
    status?: string | null,
    summary?: LetterRetentionSummary | null,
): boolean => (
    status !== LETTER_WORKFLOW_STATUS.COMPLETED
    || resolveLetterRetentionState(summary).finalDownloadAvailable
);

export const retentionAwareSupportingDescriptors = (
    summary: LetterRetentionSummary | null | undefined,
    descriptors: readonly SupportingDocumentDescriptor[],
): SupportingDocumentDescriptor[] => {
    if (resolveLetterRetentionState(summary).supportingDocumentsDeleted) {
        return [];
    }

    return [...descriptors];
};
