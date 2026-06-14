import type { SupportingDocumentDescriptor } from './supporting-document-gallery';
import {
    resolveSupportingDocumentState,
    type SupportingDocumentMetadataMap,
} from './supporting-document-metadata';

export type BeasiswaSupportingField = 'transkrip_nilai' | 'slip_gaji_ayah' | 'slip_gaji_ibu';

export interface BeasiswaSupportingSource {
    id: number;
    supporting_documents?: SupportingDocumentMetadataMap | null;
}

export const buildBeasiswaSupportingPreviewUrl = (
    appId: number,
    field: BeasiswaSupportingField,
): string => `/api/scholarship/${appId}/supporting-documents/${field}/preview`;

export const beasiswaSupportingDescriptors = (
    app: BeasiswaSupportingSource,
): SupportingDocumentDescriptor[] => {
    const descriptor = (
        field: BeasiswaSupportingField,
        label: string,
    ): SupportingDocumentDescriptor => {
        const state = resolveSupportingDocumentState({
            metadata: app.supporting_documents,
            documentKey: field,
        });
        return {
            key: field,
            label,
            endpointUrl: buildBeasiswaSupportingPreviewUrl(app.id, field),
            fileName: state.originalFilename,
            available: state.exists && state.previewAvailable,
        };
    };

    return [
        descriptor('transkrip_nilai', 'Transkrip Nilai'),
        descriptor('slip_gaji_ayah', 'Slip Gaji / Penghasilan Ayah/Wali'),
        descriptor('slip_gaji_ibu', 'Slip Gaji / Penghasilan Ibu'),
    ];
};
