import type { SupportingDocumentDescriptor } from './supporting-document-gallery';
import {
    resolveSupportingDocumentState,
    type SupportingDocumentMetadataMap,
} from './supporting-document-metadata';

// Config-only Surat Pengantar Magang supporting-document descriptors for the
// shared gallery. Currently a single document (proposal); the list is shaped so
// future documents are added here without touching any reviewer/detail surface.
// Role-agnostic; type-only import keeps it hermetically testable.

export interface MagangSupportingSource {
    id: number;
    supporting_documents?: SupportingDocumentMetadataMap | null;
}

export const magangSupportingDescriptors = (
    app: MagangSupportingSource,
): SupportingDocumentDescriptor[] => {
    const state = resolveSupportingDocumentState({
        metadata: app.supporting_documents,
        documentKey: 'proposal',
    });
    return [
        {
            key: 'proposal',
            label: 'Proposal Kegiatan Magang',
            endpointUrl: `/api/surat-pengantar-magang/${app.id}/supporting-documents/proposal/preview`,
            fileName: state.originalFilename,
            available: state.exists && state.previewAvailable,
        },
    ];
};
