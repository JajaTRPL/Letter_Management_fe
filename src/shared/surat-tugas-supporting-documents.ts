import type { SupportingDocumentDescriptor } from './supporting-document-gallery';
import {
    resolveSupportingDocumentState,
    type SupportingDocumentMetadataMap,
} from './supporting-document-metadata';

// Config-only Surat Tugas supporting-document descriptors for the shared
// gallery. Role-agnostic (the supporting-document preview route is not
// role-scoped), so Mahasiswa / Tendik / Akademik all reuse this single builder.
// Type-only import keeps the module free of the PDF.js/DOM chain → hermetically
// testable. Endpoint keys mirror the backend contract.

export interface SuratTugasSupportingSource {
    id: number;
    supporting_documents?: SupportingDocumentMetadataMap | null;
}

export const suratTugasSupportingDescriptors = (
    app: SuratTugasSupportingSource,
): SupportingDocumentDescriptor[] => {
    const descriptor = (
        key: 'proposal' | 'surat_pengantar_magang',
        label: string,
    ): SupportingDocumentDescriptor => {
        const state = resolveSupportingDocumentState({
            metadata: app.supporting_documents,
            documentKey: key,
        });
        return {
            key,
            label,
            endpointUrl: `/api/surat-tugas/${app.id}/supporting-documents/${key}/preview`,
            fileName: state.originalFilename,
            available: state.exists && state.previewAvailable,
        };
    };

    return [
        descriptor('proposal', 'Proposal Kegiatan Magang'),
        descriptor('surat_pengantar_magang', 'Surat Pengantar Magang'),
    ];
};
