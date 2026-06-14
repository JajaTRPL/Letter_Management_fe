// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clickFormElement,
    findFormApiCall,
    flushFormEvents,
    resetFormDom,
    setFormInputValue,
    skaDraftApplication,
    skaDraftResponse,
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

        if (url === '/api/mahasiswa/surat-keterangan-aktif/draft' && !options.method) return response(m.draftJson);
        if (url === '/api/mahasiswa/surat-keterangan-aktif/applications') return response({ applications: [] });
        if (url === '/api/profile') return response(m.draftJson);
        if (url === '/api/mahasiswa/surat-keterangan-aktif/draft' && options.method === 'POST') return response({ application: m.savedApplication });
        if (url === '/api/mahasiswa/surat-keterangan-aktif/submit' && options.method === 'POST') return response({ application: { ...m.savedApplication, status: 'Submitted' } });
        if (url === '/api/mahasiswa/surat-keterangan-aktif/9') return response({ application: { ...m.savedApplication, status: 'Submitted' }, profile_summary: {} });

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

import { renderSuratKeteranganAktifForm } from '../mahasiswa/SuratKeteranganAktifForm';
import { SKA_SUPPORTING_DOCUMENT_UPLOADS } from '../shared/ska-form';

const response = (payload: unknown): Response => ({
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    blob: async () => new Blob(),
} as unknown as Response);

const mount = async (application: Record<string, unknown> | null = null): Promise<void> => {
    m.draftJson = skaDraftResponse(application);
    m.savedApplication = skaDraftApplication();
    await renderSuratKeteranganAktifForm();
    await flushFormEvents();
};

const goToDetailStep = (): void => clickFormElement('btn-next-step');

const fillRequiredFields = (): void => {
    setFormInputValue('keperluan', 'Syarat administrasi beasiswa');
    setFormInputValue('nama_orang_tua_wali', 'Bapak Santoso');
    setFormInputValue('pekerjaan_orang_tua_wali', 'Pegawai Swasta');
};

beforeEach(() => {
    resetFormDom();
    m.apiCalls = [];
    m.warnings = [];
});

describe('Surat Keterangan Aktif Mahasiswa form integration (CP5C)', () => {
    it('mounts the three-step flow and consumes an EMPTY supporting-document definition list', async () => {
        await mount();
        // Draft load + applications check + the single /api/profile bundle.
        expect(m.apiCalls.map((c) => c.url)).toContain('/api/mahasiswa/surat-keterangan-aktif/draft');
        expect(m.apiCalls.map((c) => c.url)).toContain('/api/mahasiswa/surat-keterangan-aktif/applications');

        // Step 1 profile fields.
        for (const label of ['Nama Lengkap', 'NIM', 'Fakultas', 'Program Studi', 'Email Aktif']) {
            expect(document.body.innerHTML).toContain(label);
        }

        goToDetailStep();
        for (const id of [
            'keperluan',
            'nama_orang_tua_wali',
            'pekerjaan_orang_tua_wali',
            'nip_orang_tua_wali',
            'pangkat_gol_orang_tua_wali',
            'instansi_orang_tua_wali',
        ]) {
            expect(document.getElementById(id)).not.toBeNull();
        }

        // Zero-document contract: empty definitions, no file input, no upload card.
        expect(SKA_SUPPORTING_DOCUMENT_UPLOADS).toEqual([]);
        expect(document.querySelector('input[type="file"]')).toBeNull();
        expect(document.body.innerHTML).not.toContain('Dokumen Pendukung');
    });

    it('renders the parent/wali section and the review step', async () => {
        await mount();
        goToDetailStep();
        expect(document.body.innerHTML).toContain('Data Orang Tua/Wali');

        fillRequiredFields();
        clickFormElement('btn-next-step');
        await flushFormEvents();

        expect(document.body.innerHTML).toContain('Tinjau Pengajuan');
        expect(document.getElementById('agreement-checkbox')).not.toBeNull();
    });

    it('saves a draft to the exact SKA endpoint with the preserved JSON payload keys', async () => {
        await mount();
        goToDetailStep();
        fillRequiredFields();
        clickFormElement('btn-next-step');
        await flushFormEvents();

        const call = findFormApiCall(m.apiCalls, '/api/mahasiswa/surat-keterangan-aktif/draft', 'POST');
        expect(call).toBeDefined();
        expect(call?.isFormData).toBeUndefined();
        const payload = JSON.parse(call?.body as string);
        expect(Object.keys(payload).sort()).toEqual([
            'instansi_orang_tua_wali',
            'jenis_kelamin',
            'keperluan',
            'nama_orang_tua_wali',
            'nip_orang_tua_wali',
            'pangkat_gol_orang_tua_wali',
            'pekerjaan_orang_tua_wali',
            'tanggal_lahir',
            'tempat_lahir',
        ]);
        expect(payload.keperluan).toBe('Syarat administrasi beasiswa');
    });

    it('submits through the exact SKA submit endpoint after the review step', async () => {
        await mount();
        goToDetailStep();
        fillRequiredFields();
        clickFormElement('btn-next-step');
        await flushFormEvents();

        clickFormElement('agreement-checkbox');
        clickFormElement('btn-next-step');
        await flushFormEvents();

        expect(findFormApiCall(m.apiCalls, '/api/mahasiswa/surat-keterangan-aktif/submit', 'POST')).toBeDefined();
    });

    it('never mounts a file input, upload section, raw storage URL, marker, or unsafe PDF embed', async () => {
        await mount(skaDraftApplication());
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
