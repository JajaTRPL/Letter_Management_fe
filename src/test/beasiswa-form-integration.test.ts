// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    beasiswaDraftApplication,
    beasiswaProfileResponse,
    clickFormElement,
    createFormFile,
    findFormApiCall,
    flushFormEvents,
    resetFormDom,
    selectFormFile,
    type FormApiCall,
} from './form-test-harness';

const m = vi.hoisted(() => ({
    apiCalls: [] as FormApiCall[],
    application: null as Record<string, unknown> | null,
    saved: {} as Record<string, unknown>,
    toasts: [] as string[],
}));

const PREFIX = '/api/mahasiswa/surat-permohonan-beasiswa';

vi.mock('../shared/api-client', () => ({
    apiFetch: vi.fn(async (url: string, options: { method?: string; body?: unknown; isFormData?: boolean } = {}) => {
        m.apiCalls.push({ url, method: options.method, body: options.body, isFormData: options.isFormData });

        if (url === `${PREFIX}/applications`) return response({ applications: m.application ? [m.application] : [] });
        if (url === '/api/profile') return response(beasiswaProfileResponse());
        if (url === `${PREFIX}/step-1` && !options.method) return response({ application: m.saved });
        if (/\/step-\d$/.test(url) && options.method === 'POST') return response({ application: m.saved });
        if (url === `${PREFIX}/submit`) return response({ application: { ...m.saved, status: 'Submitted' }, assigned_to: 'staf beasiswa' });

        return response({});
    }),
    // Step2Keluarga's pas-foto preview helpers; harmless no-ops in jsdom.
    normalizeProtectedStoragePath: (path?: string | null) => path ?? null,
    loadProtectedImageObjectUrl: vi.fn(async () => null),
    revokeProtectedImageObjectUrl: vi.fn(),
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

vi.mock('./AdministrasiSurat', () => ({ renderAdministrasiSurat: vi.fn() }));

vi.mock('toastify-js', () => ({
    default: vi.fn((opts: { text: string }) => ({ showToast: () => m.toasts.push(opts.text) })),
}));

import { renderScholarshipForm } from '../mahasiswa/ScholarshipForm';
import { mapApplicationToFormData } from '../mahasiswa/scholarship-form/ScholarshipDataMapper';
import { BEASISWA_SUPPORTING_DOCUMENT_UPLOADS } from '../shared/beasiswa-form';

const response = (payload: unknown): Response => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    blob: async () => new Blob(),
} as unknown as Response);

const mount = async (application: Record<string, unknown> | null = null): Promise<void> => {
    m.application = application;
    m.saved = beasiswaDraftApplication({ status: 'Draft' });
    await renderScholarshipForm();
    await flushFormEvents();
};

// Advance from the current step to the next via the primary action button.
const advance = async (): Promise<void> => {
    clickFormElement('btn-next');
    await flushFormEvents();
};

const goToStep3 = async (): Promise<void> => {
    await advance(); // 1 -> 2
    await advance(); // 2 -> 3
};

beforeEach(() => {
    resetFormDom();
    m.apiCalls = [];
    m.toasts = [];
});

describe('Surat Permohonan Beasiswa Mahasiswa form integration (CP5D)', () => {
    it('consumes exactly three typed supporting-document definitions with the canonical multipart keys', () => {
        expect(BEASISWA_SUPPORTING_DOCUMENT_UPLOADS.map((d) => ({ key: d.key, inputName: d.inputName, requiredOnSubmit: d.requiredOnSubmit }))).toEqual([
            { key: 'transkrip_nilai', inputName: 'transkrip_nilai', requiredOnSubmit: true },
            { key: 'slip_gaji_ayah', inputName: 'slip_gaji_ayah', requiredOnSubmit: true },
            { key: 'slip_gaji_ibu', inputName: 'slip_gaji_ibu', requiredOnSubmit: true },
        ]);
        expect(BEASISWA_SUPPORTING_DOCUMENT_UPLOADS.every((d) => d.requiredOnSubmit)).toBe(true);
        expect(BEASISWA_SUPPORTING_DOCUMENT_UPLOADS.map((d) => d.key)).not.toContain('ktm');
    });

    it('mounts the 4-step flow and renders the three shared upload inputs on step 3', async () => {
        await mount();
        // Loads applications + profile + step-1 draft.
        expect(m.apiCalls.map((c) => c.url)).toContain(`${PREFIX}/applications`);
        expect(m.apiCalls.map((c) => c.url)).toContain('/api/profile');

        await goToStep3();

        for (const id of ['transkrip_nilai', 'slip_gaji_ayah', 'slip_gaji_ibu']) {
            const input = document.getElementById(id) as HTMLInputElement | null;
            expect(input).not.toBeNull();
            expect(input?.type).toBe('file');
        }
        // Shared section heading present; KTM absent.
        expect(document.body.innerHTML).toContain('Dokumen Pendukung');
        expect(document.getElementById('ktm')).toBeNull();
        expect(document.body.innerHTML).not.toContain('ktm_path');
    });

    it('does not carry dormant ktm_path values from draft payloads into form state', () => {
        const mapped = mapApplicationToFormData({
            id: 7,
            status: 'Draft',
            ktm_path: 'attachment://ktm/legacy.pdf',
            mahasiswa_profile: { keluarga: [], scholarship_histories: [] },
        }, { siblings: [], scholarship_histories: [] });

        expect(mapped).not.toHaveProperty('ktm_path');
    });

    it('validates PDF type and 2MB size via the shared module (previously unvalidated)', async () => {
        await mount();
        await goToStep3();

        selectFormFile('transkrip_nilai', createFormFile('notes.txt', 'text/plain'));
        expect(m.toasts).toContain('Transkrip Nilai harus berupa file PDF.');

        selectFormFile('transkrip_nilai', createFormFile('big.pdf', 'application/pdf', 2 * 1024 * 1024 + 1));
        expect(m.toasts).toContain('Ukuran Transkrip Nilai maksimal 2 MB.');

        selectFormFile('transkrip_nilai', createFormFile('transkrip.pdf'));
        expect(document.getElementById('transkrip_nilai-status')?.textContent).toContain('transkrip.pdf');
    });

    it('reopens saved metadata as a safe filename only', async () => {
        await mount();
        await goToStep3();

        const html = document.body.innerHTML;
        expect(html).toContain('File tersimpan: transkrip aman.pdf');
        expect(html).not.toContain('attachment://');
        expect(html).not.toContain('/api/storage');
        expect(html).not.toContain('/storage/');
    });

    it('saves step 3 to the exact endpoint with multipart and appends only selected files under canonical keys', async () => {
        await mount();
        await goToStep3();

        selectFormFile('transkrip_nilai', createFormFile('transkrip.pdf'));
        // slip ayah / ibu intentionally left empty: draft save remains partial.
        await advance(); // 3 -> 4 triggers step-3 save

        const call = findFormApiCall(m.apiCalls, `${PREFIX}/step-3`, 'POST');
        expect(call).toBeDefined();
        expect(call?.isFormData).toBe(true);
        const body = call?.body as FormData;
        expect(body.getAll('transkrip_nilai').length).toBe(1);
        expect((body.get('transkrip_nilai') as File).name).toBe('transkrip.pdf');
        // Unselected optional docs are omitted, and the old UI alias keys never leak.
        expect(body.get('slip_gaji_ayah')).toBeNull();
        expect(body.get('slip-ayah')).toBeNull();
        expect(body.get('transkrip-nilai')).toBeNull();
    });

    it('blocks final submit when required Beasiswa supporting documents are still missing', async () => {
        await mount();
        await goToStep3();
        selectFormFile('transkrip_nilai', createFormFile('transkrip.pdf'));
        await advance(); // 3 -> 4, partial draft save is allowed

        clickFormElement('agree-terms');
        await advance(); // submit attempt

        expect(findFormApiCall(m.apiCalls, `${PREFIX}/submit`, 'POST')).toBeUndefined();
        expect(m.toasts).toContain('Slip Gaji / Penghasilan Ayah/Wali wajib diunggah.');
    });

    it('submits through the exact submit endpoint after the declaration checkbox', async () => {
        await mount();
        await goToStep3();
        selectFormFile('transkrip_nilai', createFormFile('transkrip.pdf'));
        selectFormFile('slip_gaji_ayah', createFormFile('slip-ayah.pdf'));
        selectFormFile('slip_gaji_ibu', createFormFile('slip-ibu.pdf'));
        await advance(); // 3 -> 4

        clickFormElement('agree-terms');
        await advance(); // submit

        expect(findFormApiCall(m.apiCalls, `${PREFIX}/submit`, 'POST')).toBeDefined();
    });

    it('never mounts raw storage URLs, markers, or unsafe PDF embedding on step 3', async () => {
        await mount(); // no in-flight app
        await goToStep3();

        const html = document.body.innerHTML;
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', '<object', '<embed', 'window.open']) {
            expect(html).not.toContain(token);
        }
    });
});
