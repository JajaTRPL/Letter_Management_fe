import { attachProtectedPdfViewer, renderProtectedPdfViewer } from './protected-pdf-viewer';

// Shared connector for previewing an uploaded *supporting document* (e.g. the
// Magang proposal PDF) inside the canonical protected PDF.js viewer.
//
// This mirrors the working Beasiswa supporting-document flow: the FE never
// opens a window, never uses a raw /storage href, and never downloads — it
// fetches an auth-protected, preview-compatible endpoint (Content-Type
// application/octet-stream, no Content-Disposition attachment) as an
// authenticated blob and renders it with PDF.js.
//
// `endpointUrl` MUST be a dedicated supporting-document preview endpoint
// (e.g. `/api/<letter>/{id}/supporting-documents/<field>/preview`), NOT the
// generic download-oriented /api/storage attachment route.
//
// Future letters that gain supporting documents should reuse these two
// functions rather than re-implementing per-letter preview logic.

export type SupportingDocumentPreviewCopy = {
    title: string;
    subtitle: string;
    loading?: string;
};

export function renderSupportingDocumentPreview(
    rootId: string,
    copy: SupportingDocumentPreviewCopy,
): string {
    return renderProtectedPdfViewer(rootId, {
        title: copy.title,
        subtitle: copy.subtitle,
        loading: copy.loading ?? 'Memuat dokumen pendukung...',
    });
}

// Attaches the viewer and returns a cleanup function (revokes the PDF worker
// and aborts in-flight renders). Caller owns the lifecycle and must invoke the
// returned cleanup on navigation / re-render / error.
export function attachSupportingDocumentPreview(
    rootId: string,
    endpointUrl: string,
): () => void {
    return attachProtectedPdfViewer({ rootId, endpointUrl });
}
