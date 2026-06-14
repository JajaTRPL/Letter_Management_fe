// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clickFormElement,
    createFormFile,
    findFormApiCall,
    flushFormEvents,
    formDataKeys,
    resetFormDom,
    selectFormFile,
    setFormInputValue,
    suratTugasDraftApplication,
    suratTugasDraftResponse,
    type FormApiCall,
} from './form-test-harness';

const m = vi.hoisted(() => ({
    apiCalls: [] as FormApiCall[],
    draftJson: {} as Record<string, unknown>,
    savedApplication: {} as Record<string, unknown>,
    warnings: [] as string[],
}));

vi.mock('../shared/api-client', () => ({
    apiFetch: vi.fn(async (url: string, options: { method?: string; body?: unknown; isFormData?: boolean } = {}) => {
        m.apiCalls.push({ url, method: options.method, body: options.body, isFormData: options.isFormData });

        if (url === '/api/mahasiswa/surat-tugas/draft' && !options.method) {
            return response(m.draftJson);
        }
        if (url === '/api/mahasiswa/surat-tugas/applications') {
            return response({ applications: [] });
        }
        if (url === '/api/mahasiswa/surat-tugas/draft' && options.method === 'POST') {
            return response({ application: m.savedApplication });
        }
        if (url === '/api/mahasiswa/surat-tugas/submit' && options.method === 'POST') {
            return response({ application: { ...m.savedApplication, status: 'Submitted' } });
        }
        if (url === '/api/mahasiswa/surat-tugas/7') {
            return response({
                application: { ...m.savedApplication, status: 'Submitted' },
                profile_summary: {},
            });
        }

        return response({});
    }),
}));

vi.mock('../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: vi.fn((_title: string, content: string) => {
        document.body.innerHTML = `<div id="app-root">${content}</div>`;
    }),
}));

vi.mock('../shared/protected-pdf-viewer', () => ({
    renderProtectedPdfViewer: (id: string) => `<div id="${id}" data-protected-pdf-viewer></div>`,
    attachProtectedPdfViewer: vi.fn(() => () => undefined),
}));

vi.mock('../shared/supporting-document-gallery', () => ({
    renderSupportingDocumentGallery: (id: string) => `<div id="${id}" data-supporting-document-gallery></div>`,
    attachSupportingDocumentGallery: vi.fn(() => () => undefined),
}));

vi.mock('../shared/toast', () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showWarning: vi.fn((message: string) => m.warnings.push(message)),
}));

import { renderSuratTugasForm } from '../mahasiswa/SuratTugasForm';
import { SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS } from '../shared/surat-tugas-form';

const response = (payload: unknown): Response => ({
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    blob: async () => new Blob(),
} as unknown as Response);

const mount = async (application: Record<string, unknown> | null = null): Promise<void> => {
    m.draftJson = suratTugasDraftResponse(application);
    m.savedApplication = suratTugasDraftApplication();
    await renderSuratTugasForm();
};

const goToDetailStep = (): void => clickFormElement('btn-next-step');

const fillRequiredFields = (): void => {
    setFormInputValue('nama_perusahaan', 'PT Contoh');
    setFormInputValue('kegiatan', 'Magang');
    setFormInputValue('posisi', 'Intern');
    setFormInputValue('dosen_pembimbing_dpa', 'Dr. Test');
    setFormInputValue('tgl_mulai', '2026-06-01');
    setFormInputValue('tgl_selesai', '2026-08-31');
};

const selectRequiredPdfs = (): void => {
    selectFormFile('proposal_kegiatan_magang', createFormFile('proposal.pdf'));
    selectFormFile('surat_pengantar_magang', createFormFile('pengantar.pdf'));
};

const saveDraft = async (): Promise<FormApiCall | undefined> => {
    fillRequiredFields();
    selectRequiredPdfs();
    clickFormElement('btn-next-step');
    await flushFormEvents();
    return findFormApiCall(m.apiCalls, '/api/mahasiswa/surat-tugas/draft', 'POST');
};

beforeEach(() => {
    resetFormDom();
    m.apiCalls = [];
    m.draftJson = suratTugasDraftResponse();
    m.savedApplication = suratTugasDraftApplication();
    m.warnings = [];
});

describe('Surat Tugas Mahasiswa form integration', () => {
    it('mounts its existing fields and consumes exactly two typed supporting-document definitions', async () => {
        await mount();
        expect(m.apiCalls.map((call) => call.url)).toEqual([
            '/api/mahasiswa/surat-tugas/draft',
            '/api/mahasiswa/surat-tugas/applications',
        ]);

        goToDetailStep();
        for (const id of [
            'nama_perusahaan',
            'kegiatan',
            'posisi',
            'dosen_pembimbing_dpa',
            'tgl_mulai',
            'tgl_selesai',
            'proposal_kegiatan_magang',
            'surat_pengantar_magang',
        ]) {
            expect(document.getElementById(id)).not.toBeNull();
        }
        expect(SURAT_TUGAS_SUPPORTING_DOCUMENT_UPLOADS.map(({ key, inputName }) => ({ key, inputName }))).toEqual([
            { key: 'proposal', inputName: 'proposal_kegiatan_magang' },
            { key: 'surat_pengantar_magang', inputName: 'surat_pengantar_magang' },
        ]);
    });

    it('accepts PDFs, rejects non-PDF files, rejects files over 2 MB, and displays selected filenames', async () => {
        await mount();
        goToDetailStep();

        selectFormFile('proposal_kegiatan_magang', createFormFile('proposal.pdf'));
        expect(document.getElementById('proposal_kegiatan_magang-status')?.textContent).toContain('proposal.pdf');

        selectFormFile('surat_pengantar_magang', createFormFile('notes.txt', 'text/plain'));
        expect(m.warnings).toContain('Surat Pengantar Magang harus berupa file PDF.');

        selectFormFile(
            'surat_pengantar_magang',
            createFormFile('too-large.pdf', 'application/pdf', 2 * 1024 * 1024 + 1),
        );
        expect(m.warnings).toContain('Ukuran Surat Pengantar Magang maksimal 2 MB.');
    });

    it('reopens draft metadata as safe filenames only', async () => {
        await mount(suratTugasDraftApplication({
            supporting_documents: {
                proposal: {
                    exists: true,
                    original_filename: 'proposal aman.pdf',
                    mime_type: 'application/pdf',
                    size_bytes: 1024,
                    preview_available: true,
                },
                surat_pengantar_magang: {
                    exists: true,
                    original_filename: 'pengantar.pdf',
                    mime_type: 'application/pdf',
                    size_bytes: 1024,
                    preview_available: true,
                },
            },
            proposal_kegiatan_magang_path: 'attachment://proposal/proposal%20aman.pdf',
            surat_pengantar_magang_path: 'attachment://surat_pengantar_magang/pengantar.pdf',
        }));
        goToDetailStep();

        const html = document.body.innerHTML;
        expect(html).toContain('File tersimpan: proposal aman.pdf');
        expect(html).toContain('File tersimpan: pengantar.pdf');
        expect(html).not.toContain('attachment://');
        expect(html).not.toContain('/api/storage');
        expect(html).not.toContain('/storage/');
    });

    it('blocks save until required supporting documents exist', async () => {
        await mount();
        goToDetailStep();
        fillRequiredFields();
        clickFormElement('btn-next-step');
        await flushFormEvents();

        expect(findFormApiCall(m.apiCalls, '/api/mahasiswa/surat-tugas/draft', 'POST')).toBeUndefined();
        expect(m.warnings).toContain('Proposal Kegiatan Magang wajib diunggah.');
    });

    it('saves a draft to the existing endpoint with the exact business and file FormData keys', async () => {
        await mount();
        goToDetailStep();
        const call = await saveDraft();

        expect(call?.isFormData).toBe(true);
        expect(formDataKeys(call?.body)).toEqual([
            'dosen_pembimbing_dpa',
            'kegiatan',
            'nama_perusahaan',
            'posisi',
            'proposal_kegiatan_magang',
            'surat_pengantar_magang',
            'tgl_mulai',
            'tgl_selesai',
        ]);
    });

    it('submits through the existing submit endpoint after the draft-save review step', async () => {
        await mount();
        goToDetailStep();
        await saveDraft();

        clickFormElement('agreement-checkbox');
        clickFormElement('btn-next-step');
        await flushFormEvents();

        expect(findFormApiCall(m.apiCalls, '/api/mahasiswa/surat-tugas/submit', 'POST')).toBeDefined();
    });

    it('cleans old upload listeners when the form remounts', async () => {
        await mount();
        goToDetailStep();
        await mount();
        goToDetailStep();

        selectFormFile('proposal_kegiatan_magang', createFormFile('after-remount.pdf'));
        expect(document.getElementById('proposal_kegiatan_magang-status')?.textContent).toContain('after-remount.pdf');
    });

    it('never mounts raw storage URLs, marker prefixes, or unsafe PDF embedding markup', async () => {
        await mount(suratTugasDraftApplication());
        goToDetailStep();

        const html = document.body.innerHTML;
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', '<object', '<embed', 'window.open']) {
            expect(html).not.toContain(token);
        }
    });
});
