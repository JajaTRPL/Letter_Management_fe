// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clickFormElement,
    createFormFile,
    findFormApiCall,
    flushFormEvents,
    formDataKeys,
    magangDraftApplication,
    magangDraftResponse,
    resetFormDom,
    selectFormFile,
    setFormInputValue,
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

        if (url === '/api/mahasiswa/surat-pengantar-magang/draft' && !options.method) {
            return response(m.draftJson);
        }
        if (url === '/api/mahasiswa/surat-pengantar-magang/applications') {
            return response({ applications: [] });
        }
        if (url === '/api/mahasiswa/surat-pengantar-magang/draft' && options.method === 'POST') {
            return response({ application: m.savedApplication });
        }
        if (url === '/api/mahasiswa/surat-pengantar-magang/submit' && options.method === 'POST') {
            return response({ application: { ...m.savedApplication, status: 'Submitted' } });
        }
        if (url === '/api/mahasiswa/surat-pengantar-magang/5') {
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

import { renderSuratPengantarMagangForm } from '../mahasiswa/SuratPengantarMagangForm';
import { MAGANG_SUPPORTING_DOCUMENT_UPLOADS } from '../shared/magang-form';

const response = (payload: unknown): Response => ({
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    blob: async () => new Blob(),
} as unknown as Response);

const mount = async (application: Record<string, unknown> | null = null): Promise<void> => {
    m.draftJson = magangDraftResponse(application);
    m.savedApplication = magangDraftApplication();
    await renderSuratPengantarMagangForm();
};

const goToDetailStep = (): void => clickFormElement('btn-next-step');

const fillRequiredFields = (): void => {
    setFormInputValue('jabatan_penerima', 'Direktur');
    setFormInputValue('nama_perusahaan', 'PT Contoh');
    setFormInputValue('alamat_jalan', 'Jl. Grafika No. 2');
    setFormInputValue('alamat_kelurahan', 'Sinduadi');
    setFormInputValue('alamat_kecamatan', 'Mlati');
    setFormInputValue('alamat_kota_kabupaten', 'Sleman');
    setFormInputValue('alamat_provinsi', 'D.I. Yogyakarta');
    setFormInputValue('kode_pos', '55281');
    setFormInputValue('peran', 'Intern');
    setFormInputValue('tgl_mulai', '2026-06-01');
    setFormInputValue('tgl_selesai', '2026-08-31');
    setFormInputValue('dosen_pembimbing_dpa', 'Dr. Test');
};

const selectRequiredPdf = (): void => {
    selectFormFile('proposal_kegiatan_magang', createFormFile('proposal.pdf'));
};

const saveDraft = async (): Promise<FormApiCall | undefined> => {
    fillRequiredFields();
    selectRequiredPdf();
    clickFormElement('btn-next-step');
    await flushFormEvents();
    return findFormApiCall(m.apiCalls, '/api/mahasiswa/surat-pengantar-magang/draft', 'POST');
};

beforeEach(() => {
    resetFormDom();
    m.apiCalls = [];
    m.draftJson = magangDraftResponse();
    m.savedApplication = magangDraftApplication();
    m.warnings = [];
});

describe('Surat Pengantar Magang Mahasiswa form integration', () => {
    it('mounts its existing fields and consumes exactly one typed supporting-document definition', async () => {
        await mount();
        expect(m.apiCalls.map((call) => call.url)).toEqual([
            '/api/mahasiswa/surat-pengantar-magang/draft',
            '/api/mahasiswa/surat-pengantar-magang/applications',
        ]);

        goToDetailStep();
        for (const id of [
            'jabatan_penerima',
            'nama_perusahaan',
            'alamat_jalan',
            'alamat_kelurahan',
            'alamat_kecamatan',
            'alamat_kota_kabupaten',
            'alamat_provinsi',
            'kode_pos',
            'peran',
            'tgl_mulai',
            'tgl_selesai',
            'dosen_pembimbing_dpa',
            'proposal_kegiatan_magang',
        ]) {
            expect(document.getElementById(id)).not.toBeNull();
        }
        expect(MAGANG_SUPPORTING_DOCUMENT_UPLOADS.map(({ key, inputName }) => ({ key, inputName }))).toEqual([
            { key: 'proposal', inputName: 'proposal_kegiatan_magang' },
        ]);
    });

    it('accepts PDFs, rejects non-PDF files, rejects files over 2 MB, and displays selected filenames', async () => {
        await mount();
        goToDetailStep();

        selectFormFile('proposal_kegiatan_magang', createFormFile('proposal.pdf'));
        expect(document.getElementById('proposal_kegiatan_magang-status')?.textContent).toContain('proposal.pdf');

        selectFormFile('proposal_kegiatan_magang', createFormFile('notes.txt', 'text/plain'));
        expect(m.warnings).toContain('Proposal Kegiatan Magang harus berupa file PDF.');

        selectFormFile(
            'proposal_kegiatan_magang',
            createFormFile('too-large.pdf', 'application/pdf', 2 * 1024 * 1024 + 1),
        );
        expect(m.warnings).toContain('Ukuran Proposal Kegiatan Magang maksimal 2 MB.');
    });

    it('reopens draft metadata as a safe filename only', async () => {
        await mount(magangDraftApplication({
            supporting_documents: {
                proposal: {
                    exists: true,
                    original_filename: 'proposal aman.pdf',
                    mime_type: 'application/pdf',
                    size_bytes: 1024,
                    preview_available: true,
                },
            },
            proposal_kegiatan_magang_path: 'attachment://proposal/proposal%20aman.pdf',
        }));
        goToDetailStep();

        const html = document.body.innerHTML;
        expect(html).toContain('File tersimpan: proposal aman.pdf');
        expect(html).not.toContain('attachment://');
        expect(html).not.toContain('/api/storage');
        expect(html).not.toContain('/storage/');
    });

    it('blocks save until the required supporting document exists', async () => {
        await mount();
        goToDetailStep();
        fillRequiredFields();
        clickFormElement('btn-next-step');
        await flushFormEvents();

        expect(findFormApiCall(m.apiCalls, '/api/mahasiswa/surat-pengantar-magang/draft', 'POST')).toBeUndefined();
        expect(m.warnings).toContain('Proposal Kegiatan Magang wajib diunggah.');
    });

    it('saves a draft to the existing endpoint with exact structured, compatibility-alias, and file FormData keys', async () => {
        await mount();
        goToDetailStep();
        const call = await saveDraft();

        expect(call?.isFormData).toBe(true);
        expect(formDataKeys(call?.body)).toEqual([
            'alamat_jalan',
            'alamat_kecamatan',
            'alamat_kelurahan',
            'alamat_kota_kabupaten',
            'alamat_perusahaan',
            'alamat_provinsi',
            'dosen_pembimbing_dpa',
            'jabatan_penerima',
            'kode_pos',
            'nama_penerima',
            'nama_perusahaan',
            'peran',
            'proposal_kegiatan_magang',
            'rentang_tanggal',
            'tgl_mulai',
            'tgl_selesai',
        ]);
        expect((call?.body as FormData).get('nama_penerima')).toBe('Direktur');
        expect((call?.body as FormData).get('alamat_perusahaan')).toBe(
            'Jl. Grafika No. 2, Kel. Sinduadi, Kec. Mlati, Sleman, D.I. Yogyakarta, 55281',
        );
        expect((call?.body as FormData).get('rentang_tanggal')).toBe('1 Juni 2026 s.d. 31 Agustus 2026');
    });

    it('submits through the existing submit endpoint after the draft-save review step', async () => {
        await mount();
        goToDetailStep();
        await saveDraft();

        clickFormElement('agreement-checkbox');
        clickFormElement('btn-next-step');
        await flushFormEvents();

        expect(findFormApiCall(m.apiCalls, '/api/mahasiswa/surat-pengantar-magang/submit', 'POST')).toBeDefined();
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
        await mount(magangDraftApplication());
        goToDetailStep();

        const html = document.body.innerHTML;
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', '<object', '<embed', 'window.open']) {
            expect(html).not.toContain(token);
        }
    });
});
