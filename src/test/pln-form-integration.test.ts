// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clickFormElement,
    findFormApiCall,
    flushFormEvents,
    plnDraftApplication,
    plnDraftResponse,
    resetFormDom,
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
    apiFetch: vi.fn(async (url: string, options: { method?: string; body?: unknown } = {}) => {
        m.apiCalls.push({ url, method: options.method, body: options.body });

        if (url === '/api/mahasiswa/proses-luar-negeri/draft' && !options.method) return response(m.draftJson);
        if (url === '/api/mahasiswa/proses-luar-negeri/applications') return response({ applications: [] });
        if (url === '/api/mahasiswa/proses-luar-negeri/draft' && options.method === 'POST') return response({ application: m.savedApplication });
        if (url === '/api/mahasiswa/proses-luar-negeri/submit' && options.method === 'POST') return response({ application: { ...m.savedApplication, status: 'Submitted' } });
        if (url === '/api/mahasiswa/proses-luar-negeri/11') return response({ application: { ...m.savedApplication, status: 'Submitted' }, profile_summary: {} });

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

vi.mock('../shared/toast', () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showWarning: vi.fn((message: string) => m.warnings.push(message)),
}));

import { renderProsesLuarNegeriForm } from '../mahasiswa/ProsesLuarNegeriForm';
import { PLN_SUPPORTING_DOCUMENT_UPLOADS } from '../shared/pln-form';

const response = (payload: unknown): Response => ({
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    blob: async () => new Blob(),
} as unknown as Response);

const mount = async (application: Record<string, unknown> | null = null): Promise<void> => {
    m.draftJson = plnDraftResponse(application);
    m.savedApplication = plnDraftApplication();
    await renderProsesLuarNegeriForm();
    await flushFormEvents();
};

const goToDetailStep = (): void => clickFormElement('btn-next-step');

const fillRequiredFields = (): void => {
    setFormInputValue('semester', '4');
    setFormInputValue('nomor_paspor', 'A1234567');
    setFormInputValue('keperluan', 'Surat rekomendasi student exchange');
};

beforeEach(() => {
    resetFormDom();
    m.apiCalls = [];
    m.warnings = [];
});

describe('Proses Luar Negeri Mahasiswa form integration (CP5C)', () => {
    it('mounts the three-step flow and consumes an EMPTY supporting-document definition list', async () => {
        await mount();
        expect(m.apiCalls.map((c) => c.url)).toContain('/api/mahasiswa/proses-luar-negeri/draft');
        expect(m.apiCalls.map((c) => c.url)).toContain('/api/mahasiswa/proses-luar-negeri/applications');

        for (const label of ['Nama Lengkap', 'NIM', 'Fakultas', 'Program Studi', 'Email Aktif']) {
            expect(document.body.innerHTML).toContain(label);
        }

        goToDetailStep();
        for (const id of ['semester', 'nomor_paspor', 'keperluan']) {
            expect(document.getElementById(id)).not.toBeNull();
        }

        // Zero-document contract.
        expect(PLN_SUPPORTING_DOCUMENT_UPLOADS).toEqual([]);
        expect(document.querySelector('input[type="file"]')).toBeNull();
        expect(document.body.innerHTML).not.toContain('Dokumen Pendukung');
    });

    it('renders passport, semester, purpose fields and the review step', async () => {
        await mount();
        goToDetailStep();
        expect(document.getElementById('nomor_paspor')).not.toBeNull();
        expect((document.getElementById('semester') as HTMLInputElement | null)?.type).toBe('number');

        fillRequiredFields();
        clickFormElement('btn-next-step');
        await flushFormEvents();

        expect(document.body.innerHTML).toContain('Tinjau Pengajuan');
        expect(document.body.innerHTML).toContain('Nomor Paspor');
        expect(document.getElementById('agreement-checkbox')).not.toBeNull();
    });

    it('saves a draft to the exact PLN endpoint with preserved JSON payload keys and numeric semester', async () => {
        await mount();
        goToDetailStep();
        fillRequiredFields();
        clickFormElement('btn-next-step');
        await flushFormEvents();

        const call = findFormApiCall(m.apiCalls, '/api/mahasiswa/proses-luar-negeri/draft', 'POST');
        expect(call).toBeDefined();
        expect(call?.isFormData).toBeUndefined();
        const payload = JSON.parse(call?.body as string);
        expect(Object.keys(payload).sort()).toEqual([
            'jenis_kelamin',
            'keperluan',
            'nomor_paspor',
            'semester',
            'tanggal_lahir',
            'tempat_lahir',
        ]);
        expect(payload.semester).toBe(4);
        expect(typeof payload.semester).toBe('number');
        expect(payload.nomor_paspor).toBe('A1234567');
    });

    it('submits through the exact PLN submit endpoint after the review step', async () => {
        await mount();
        goToDetailStep();
        fillRequiredFields();
        clickFormElement('btn-next-step');
        await flushFormEvents();

        clickFormElement('agreement-checkbox');
        clickFormElement('btn-next-step');
        await flushFormEvents();

        expect(findFormApiCall(m.apiCalls, '/api/mahasiswa/proses-luar-negeri/submit', 'POST')).toBeDefined();
    });

    it('never mounts a file input, upload section, raw storage URL, marker, or unsafe PDF embed', async () => {
        await mount(plnDraftApplication());
        goToDetailStep();

        const html = document.body.innerHTML;
        expect(html).not.toContain('type="file"');
        expect(html).not.toContain('Dokumen Pendukung');
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', '<object', '<embed', 'window.open']) {
            expect(html).not.toContain(token);
        }
    });

    it('safely cleans listeners across remounts (no throw, no leaked file input)', async () => {
        await mount();
        goToDetailStep();
        await mount();
        goToDetailStep();
        expect(document.querySelector('input[type="file"]')).toBeNull();
    });
});
