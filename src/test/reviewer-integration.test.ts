// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    flush, setAuthRole, clickById, setInputValue, isHidden, hasElement, bodyHtml, resetDom,
    suratTugasDetail, magangDetail, plainLetterDetail, scholarshipDetail, type ApiCall,
} from './reviewer-test-harness';
import beasiswaReviewerSource from '../shared/beasiswa-reviewer.ts?raw';
import magangReviewerSource from '../shared/magang-reviewer.ts?raw';
import plnReviewerSource from '../shared/pln-reviewer.ts?raw';
import reviewerShellSource from '../shared/reviewer-shell.ts?raw';
import skaReviewerSource from '../shared/ska-reviewer.ts?raw';
import suratTugasReviewerSource from '../shared/surat-tugas-reviewer.ts?raw';

// Shared mock-capture state (hoisted so the vi.mock factories can reference it).
const m = vi.hoisted(() => ({
    apiCalls: [] as ApiCall[],
    viewerUrls: [] as string[],
    gallery: [] as Array<Array<{ key: string }>>,
    protectedImagePaths: [] as string[],
    detailJson: {} as unknown,
    detailOk: true,
}));

vi.mock('../shared/api-client', () => ({
    apiFetch: vi.fn(async (url: string, options: { method?: string; body?: unknown } = {}) => {
        m.apiCalls.push({ url, method: options.method, body: options.body });
        const isGet = !options.method || options.method === 'GET';
        const payload = isGet ? m.detailJson : { message: 'ok' };
        return {
            ok: m.detailOk,
            status: m.detailOk ? 200 : 422,
            headers: { get: () => 'application/json' },
            json: async () => payload,
            text: async () => JSON.stringify(payload),
            blob: async () => new Blob(),
        } as unknown as Response;
    }),
    loadProtectedImageObjectUrl: vi.fn(async (path?: string | null) => {
        if (path) m.protectedImagePaths.push(path);
        return path ? 'blob:scholarship-photo' : null;
    }),
    revokeProtectedImageObjectUrl: vi.fn(),
}));
vi.mock('../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: vi.fn((_t: string, content: string) => { document.body.innerHTML = `<div id="app-root">${content}</div>`; }),
}));
vi.mock('../shared/protected-pdf-viewer', () => ({
    renderProtectedPdfViewer: (id: string) => `<div id="${id}" data-protected-pdf-viewer></div>`,
    attachProtectedPdfViewer: vi.fn((opts: { endpointUrl: string }) => { m.viewerUrls.push(opts.endpointUrl); return () => undefined; }),
}));
vi.mock('../shared/supporting-document-gallery', () => ({
    renderSupportingDocumentGallery: (
        rootId: string,
        descriptors: Array<{ key: string }> = [],
        options: { emptyLabel?: string } = {},
    ) => `<div id="${rootId}" data-supporting-gallery>${descriptors.length === 0 ? options.emptyLabel || '' : ''}</div>`,
    attachSupportingDocumentGallery: vi.fn((_rootId: string, descriptors: Array<{ key: string }>) => { m.gallery.push(descriptors); return () => undefined; }),
}));
vi.mock('../shared/reviewer-navigation', () => ({
    resolveReviewerOrigin: () => 'dokumen',
    activePageForReviewerOrigin: () => 'dokumen',
    goToReviewerOrigin: vi.fn(async () => undefined),
}));
vi.mock('../shared/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn(), showWarning: vi.fn() }));

import { renderReviewSuratTugas } from '../tendik/ReviewSuratTugas';
import { renderReviewSuratTugasAkademik } from '../akademik/ReviewSuratTugasAkademik';
import { renderReviewSuratPengantarMagang } from '../tendik/ReviewSuratPengantarMagang';
import { renderReviewSuratPengantarMagangAkademik } from '../akademik/ReviewSuratPengantarMagangAkademik';
import { renderReviewScholarship } from '../tendik/ReviewScholarship';
import { renderReviewScholarshipAkademik } from '../akademik/ReviewScholarshipAkademik';
import { renderReviewSuratKeteranganAktif } from '../tendik/ReviewSuratKeteranganAktif';
import { renderReviewSuratKeteranganAktifAkademik } from '../akademik/ReviewSuratKeteranganAktifAkademik';
import { renderReviewProsesLuarNegeri } from '../tendik/ReviewProsesLuarNegeri';
import { renderReviewProsesLuarNegeriAkademik } from '../akademik/ReviewProsesLuarNegeriAkademik';

const getCalls = () => m.apiCalls;
const patch = (action: string): ApiCall | undefined =>
    m.apiCalls.find((c) => c.method === 'PATCH' && c.url.includes(`/${action}`));
const payloadOf = (call?: ApiCall): Record<string, unknown> =>
    call?.body ? JSON.parse(String(call.body)) : {};
const lastGallery = (): Array<{ key: string }> => m.gallery[m.gallery.length - 1] ?? [];
const activeRetentionSummary = (overrides: Record<string, unknown> = {}) => ({
    completed_at: '2026-06-01T00:00:00.000Z',
    final_download_available: true,
    final_download_expires_at: '2026-07-01T00:00:00.000Z',
    final_download_state: 'active',
    supporting_documents_state: 'retained',
    intermediate_artifacts_state: 'retained',
    ...overrides,
});
const assertNoRawPreviewLeak = () => {
    const html = bodyHtml();
    for (const t of ['<iframe', '<object', '<embed', '/api/storage', 'window.open']) {
        expect(html).not.toContain(t);
    }
};

beforeEach(() => {
    resetDom();
    m.apiCalls = [];
    m.viewerUrls = [];
    m.gallery = [];
    m.protectedImagePaths = [];
    m.detailOk = true;
});

// ── Surat Tugas ────────────────────────────────────────────────────────────

describe('Surat Tugas reviewer (Tendik)', () => {
    beforeEach(() => { setAuthRole('tendik'); m.detailJson = suratTugasDetail(); });

    it('mounts, fetches its own endpoint, shows 2 docs + Tendik number input + generated preview', async () => {
        await renderReviewSuratTugas(7);
        expect(getCalls()[0].url).toBe('/api/tendik/surat-tugas/7');
        expect(bodyHtml()).toContain('Review Surat Tugas');
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(lastGallery()).toHaveLength(2);
        expect(hasElement('surat-tugas-nomor-surat')).toBe(true);
        expect(m.viewerUrls.some((u) => u.includes('/api/tendik/surat-tugas/7/generated-preview'))).toBe(true);
        assertNoRawPreviewLeak();
    });

    it('approve sends nomor_surat_tugas to the surat-tugas endpoint (never Magang)', async () => {
        await renderReviewSuratTugas(7);
        clickById('surat-tugas-approve-btn');
        expect(isHidden('surat-tugas-approval-modal')).toBe(false);
        setInputValue('surat-tugas-nomor-surat', 'ST/1');
        clickById('surat-tugas-confirm-approve');
        await flush();
        const call = patch('approve');
        expect(call?.url).toBe('/api/tendik/surat-tugas/7/approve');
        expect(call?.url).not.toContain('surat-pengantar-magang');
        expect(payloadOf(call)).toEqual({ nomor_surat_tugas: 'ST/1' });
    });

    it('omits the gallery mount when the Surat Tugas descriptor list is empty', async () => {
        m.detailJson = suratTugasDetail({
            supporting_documents: {},
        });
        await renderReviewSuratTugas(7);
        expect(m.gallery).toHaveLength(0);
        expect(hasElement('surat-tugas-tendik-supporting-gallery')).toBe(false);
    });

    it('revise modal opens, cancels, then submits its note through the Tendik endpoint', async () => {
        await renderReviewSuratTugas(7);
        clickById('surat-tugas-revise-btn');
        expect(isHidden('surat-tugas-revision-modal')).toBe(false);
        clickById('surat-tugas-cancel-revise');
        expect(isHidden('surat-tugas-revision-modal')).toBe(true);
        clickById('surat-tugas-revise-btn');
        setInputValue('surat-tugas-revision-note', 'Lengkapi dokumen.');
        clickById('surat-tugas-confirm-revise');
        await flush();
        expect(patch('revise')?.url).toBe('/api/tendik/surat-tugas/7/revise');
        expect(payloadOf(patch('revise'))).toEqual({ note: 'Lengkapi dokumen.' });
    });

    it('revise and reject dialogs share the viewport-scroll surface and keep close behavior', async () => {
        await renderReviewSuratTugas(7);
        for (const modalId of ['surat-tugas-revision-modal', 'surat-tugas-rejection-modal']) {
            const surface = document.getElementById(modalId)?.firstElementChild as HTMLElement | null;
            expect(surface?.classList.contains('max-h-[calc(100vh-2rem)]')).toBe(true);
            expect(surface?.classList.contains('overflow-y-auto')).toBe(true);
        }

        clickById('surat-tugas-reject-btn');
        expect(isHidden('surat-tugas-rejection-modal')).toBe(false);
        clickById('surat-tugas-cancel-reject');
        expect(isHidden('surat-tugas-rejection-modal')).toBe(true);

        clickById('surat-tugas-revise-btn');
        expect(isHidden('surat-tugas-revision-modal')).toBe(false);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(isHidden('surat-tugas-revision-modal')).toBe(true);
    });
});

describe('Surat Tugas reviewer (Akademik)', () => {
    it('Prodi: no Tendik number input, routes to akademik approve endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = suratTugasDetail({ status: 'Approved_Tendik' });
        await renderReviewSuratTugasAkademik(7);
        expect(getCalls()[0].url).toBe('/api/akademik/surat-tugas/7');
        expect(hasElement('surat-tugas-nomor-surat')).toBe(false);
        expect(lastGallery()).toHaveLength(2);
        clickById('surat-tugas-akademik-approve-btn');
        clickById('surat-tugas-akademik-confirm-approve');
        await flush();
        expect(patch('approve')?.url).toBe('/api/akademik/surat-tugas/7/approve');
        assertNoRawPreviewLeak();
    });

    it('Departemen mode renders for Kadep on Approved_Kaprodi', async () => {
        setAuthRole('akademik', 'kadep');
        m.detailJson = suratTugasDetail({ status: 'Approved_Kaprodi' });
        await renderReviewSuratTugasAkademik(7);
        expect(hasElement('surat-tugas-akademik-approve-btn')).toBe(true);
        expect(hasElement('surat-tugas-nomor-surat')).toBe(false);
    });

    it('keeps Akademik read-only outside the reviewer stage gate', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = suratTugasDetail({ status: 'Submitted' });
        await renderReviewSuratTugasAkademik(7);
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(hasElement('surat-tugas-akademik-approve-btn')).toBe(false);
        expect(hasElement('surat-tugas-akademik-revision-modal')).toBe(false);
    });

    it('reject submits its reason through the Akademik endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = suratTugasDetail({ status: 'Approved_Tendik' });
        await renderReviewSuratTugasAkademik(7);
        clickById('surat-tugas-akademik-reject-btn');
        setInputValue('surat-tugas-akademik-rejection-reason', 'Data tidak valid.');
        clickById('surat-tugas-akademik-confirm-reject');
        await flush();
        expect(patch('reject')?.url).toBe('/api/akademik/surat-tugas/7/reject');
        expect(payloadOf(patch('reject'))).toEqual({ reason: 'Data tidak valid.' });
    });
});

// ── Surat Pengantar Magang ───────────────────────────────────────────────────

describe('Magang reviewer', () => {
    it('Tendik: 1 doc, nomor_surat_pengantar input, approve payload + endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = magangDetail();
        await renderReviewSuratPengantarMagang(5);
        expect(getCalls()[0].url).toBe('/api/tendik/surat-pengantar-magang/5');
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(bodyHtml()).toContain('Review Surat Pengantar Magang');
        expect(bodyHtml()).toContain('Budi Santoso');
        expect(bodyHtml()).toContain('PT Contoh');
        expect(lastGallery()).toHaveLength(1);
        expect(hasElement('magang-nomor-surat-pengantar')).toBe(true);
        expect(hasElement('magang-nomor-surat-tugas')).toBe(false);
        expect(m.viewerUrls.some((u) => u.includes('/api/tendik/surat-pengantar-magang/5/generated-preview'))).toBe(true);
        clickById('magang-approve-btn');
        setInputValue('magang-nomor-surat-pengantar', 'MAG/1');
        clickById('magang-confirm-approve');
        await flush();
        const call = patch('approve');
        expect(call?.url).toBe('/api/tendik/surat-pengantar-magang/5/approve');
        expect(payloadOf(call).nomor_surat_pengantar).toBe('MAG/1');
        expect(call?.url).not.toContain('surat-tugas');
        expect(bodyHtml()).not.toContain('Surat Tugas');
        assertNoRawPreviewLeak();
    });

    it('Tendik: revise modal opens, cancels, then submits its note through the Magang endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = magangDetail();
        await renderReviewSuratPengantarMagang(5);
        clickById('magang-revise-btn');
        expect(isHidden('magang-revision-modal')).toBe(false);
        clickById('magang-cancel-revise');
        expect(isHidden('magang-revision-modal')).toBe(true);
        clickById('magang-revise-btn');
        setInputValue('magang-revision-note', 'Lengkapi proposal.');
        clickById('magang-confirm-revise');
        await flush();
        expect(patch('revise')?.url).toBe('/api/tendik/surat-pengantar-magang/5/revise');
        expect(payloadOf(patch('revise'))).toEqual({ note: 'Lengkapi proposal.' });
    });

    it('Tendik: reject submits its reason through the Magang endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = magangDetail();
        await renderReviewSuratPengantarMagang(5);
        clickById('magang-reject-btn');
        setInputValue('magang-rejection-reason', 'Data tidak valid.');
        clickById('magang-confirm-reject');
        await flush();
        expect(patch('reject')?.url).toBe('/api/tendik/surat-pengantar-magang/5/reject');
        expect(payloadOf(patch('reject'))).toEqual({ reason: 'Data tidak valid.' });
    });

    it('Akademik Prodi: no Tendik number input, akademik endpoint, 1 doc', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = magangDetail({ status: 'Approved_Tendik' });
        await renderReviewSuratPengantarMagangAkademik(5);
        expect(getCalls()[0].url).toBe('/api/akademik/surat-pengantar-magang/5');
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(hasElement('magang-nomor-surat-pengantar')).toBe(false);
        expect(hasElement('magang-nomor-surat-tugas')).toBe(false);
        expect(lastGallery()).toHaveLength(1);
        expect(m.viewerUrls.some((u) => u.includes('/api/akademik/surat-pengantar-magang/5/generated-preview'))).toBe(true);
        clickById('magang-akademik-approve-btn');
        clickById('magang-akademik-confirm-approve');
        await flush();
        expect(patch('approve')?.url).toBe('/api/akademik/surat-pengantar-magang/5/approve');
        expect(payloadOf(patch('approve'))).toEqual({});
        expect(bodyHtml()).not.toContain('Surat Tugas');
        assertNoRawPreviewLeak();
    });

    it('Akademik Departemen: mounts approval action for Kadep on Approved_Kaprodi', async () => {
        setAuthRole('akademik', 'kadep');
        m.detailJson = magangDetail({ status: 'Approved_Kaprodi' });
        await renderReviewSuratPengantarMagangAkademik(5);
        expect(hasElement('magang-akademik-approve-btn')).toBe(true);
        expect(bodyHtml()).toContain('Tandatangani dan Selesaikan di Akademik');
        expect(hasElement('magang-nomor-surat-pengantar')).toBe(false);
    });

    it('Akademik: stays read-only outside the explicit reviewer stage gate', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = magangDetail({ status: 'Submitted' });
        await renderReviewSuratPengantarMagangAkademik(5);
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(hasElement('magang-akademik-approve-btn')).toBe(false);
        expect(hasElement('magang-akademik-revision-modal')).toBe(false);
    });

    it('Akademik: revise submits its note through the Magang endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = magangDetail({ status: 'Approved_Tendik' });
        await renderReviewSuratPengantarMagangAkademik(5);
        clickById('magang-akademik-revise-btn');
        setInputValue('magang-akademik-revision-note', 'Perbaiki data perusahaan.');
        clickById('magang-akademik-confirm-revise');
        await flush();
        expect(patch('revise')?.url).toBe('/api/akademik/surat-pengantar-magang/5/revise');
        expect(payloadOf(patch('revise'))).toEqual({ note: 'Perbaiki data perusahaan.' });
    });

    it('Akademik: reject submits its reason through the Magang endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = magangDetail({ status: 'Approved_Tendik' });
        await renderReviewSuratPengantarMagangAkademik(5);
        clickById('magang-akademik-reject-btn');
        setInputValue('magang-akademik-rejection-reason', 'Data tidak valid.');
        clickById('magang-akademik-confirm-reject');
        await flush();
        expect(patch('reject')?.url).toBe('/api/akademik/surat-pengantar-magang/5/reject');
        expect(payloadOf(patch('reject'))).toEqual({ reason: 'Data tidak valid.' });
    });
});

// -- Beasiswa (explicit Tendik and Akademik adapters) --

describe('Beasiswa reviewer', () => {
    it('Tendik: shell, profile photo, rich details, timeline, notices, 3 docs, and preview', async () => {
        setAuthRole('tendik');
        m.detailJson = scholarshipDetail(
            { revision_note: 'Lengkapi berkas.' },
            {
                photo: '/api/storage/profile/budi.jpg',
                departemen: 'DTEDI',
                ipk: '3.90',
                phone: '0812000111',
                angkatan: 2024,
                current_semester: 4,
            },
        );
        await renderReviewScholarship(42);
        expect(getCalls()[0].url).toBe('/api/tendik/scholarship/42');
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(bodyHtml()).toContain('Review Surat Permohonan Beasiswa');
        expect(bodyHtml()).toContain('scholarship-student-photo');
        expect(bodyHtml()).toContain('Beasiswa Test');
        expect(bodyHtml()).toContain('Angkatan 2024');
        expect(bodyHtml()).toContain('Semester 4');
        expect(bodyHtml()).toContain('Tahap Persetujuan');
        expect(bodyHtml()).toContain('Lengkapi berkas.');
        expect(m.protectedImagePaths).toEqual(['/api/storage/profile/budi.jpg']);
        expect(lastGallery()).toHaveLength(3);
        expect(hasElement('scholarship-nomor-surat')).toBe(true);
        expect(m.viewerUrls).toContain('/api/tendik/surat-permohonan-beasiswa/42/generated-preview');
        assertNoRawPreviewLeak();
    });

    it('Tendik: approve sends nomor_surat through the scholarship endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = scholarshipDetail();
        await renderReviewScholarship(42);
        clickById('scholarship-approve-btn');
        setInputValue('scholarship-nomor-surat', 'BEA/1');
        clickById('scholarship-confirm-approve');
        await flush();
        const call = patch('approve');
        expect(call?.url).toBe('/api/tendik/scholarship/42/approve');
        expect(payloadOf(call)).toEqual({ nomor_surat: 'BEA/1' });
    });

    it('Tendik: revise and reject use Tendik scholarship endpoints', async () => {
        setAuthRole('tendik');
        m.detailJson = scholarshipDetail();
        await renderReviewScholarship(42);
        clickById('scholarship-revise-btn');
        setInputValue('scholarship-revision-note', 'Unggah ulang transkrip.');
        clickById('scholarship-confirm-revise');
        await flush();
        expect(patch('revise')?.url).toBe('/api/tendik/scholarship/42/revise');
        expect(payloadOf(patch('revise'))).toEqual({ note: 'Unggah ulang transkrip.' });

        m.apiCalls = [];
        m.detailJson = scholarshipDetail();
        await renderReviewScholarship(42);
        clickById('scholarship-reject-btn');
        setInputValue('scholarship-rejection-reason', 'Data tidak valid.');
        clickById('scholarship-confirm-reject');
        await flush();
        expect(patch('reject')?.url).toBe('/api/tendik/scholarship/42/reject');
        expect(payloadOf(patch('reject'))).toEqual({ reason: 'Data tidak valid.' });
    });

    it('Akademik Prodi: explicit adapter has 3 docs, protected preview, and no Tendik number input', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = scholarshipDetail({ status: 'Approved_Tendik' });
        await renderReviewScholarshipAkademik(42);
        expect(getCalls()[0].url).toBe('/api/akademik/scholarship/42');
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(hasElement('scholarship-nomor-surat')).toBe(false);
        expect(lastGallery()).toHaveLength(3);
        expect(m.viewerUrls).toContain('/api/akademik/surat-permohonan-beasiswa/42/generated-preview');
        clickById('scholarship-akademik-approve-btn');
        clickById('scholarship-akademik-confirm-approve');
        await flush();
        expect(patch('approve')?.url).toBe('/api/akademik/scholarship/42/approve');
        expect(payloadOf(patch('approve'))).toEqual({});
        assertNoRawPreviewLeak();
    });

    it('Akademik Departemen: mounts approval for Kadep on Approved_Kaprodi', async () => {
        setAuthRole('akademik', 'kadep');
        m.detailJson = scholarshipDetail({ status: 'Approved_Kaprodi' });
        await renderReviewScholarshipAkademik(42);
        expect(hasElement('scholarship-akademik-approve-btn')).toBe(true);
        expect(bodyHtml()).toContain('Tandatangani dan Selesaikan di Akademik');
        expect(hasElement('scholarship-nomor-surat')).toBe(false);
    });

    it('Akademik: stays read-only outside the explicit reviewer stage gate', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = scholarshipDetail({ status: 'Submitted' });
        await renderReviewScholarshipAkademik(42);
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(hasElement('scholarship-akademik-approve-btn')).toBe(false);
        expect(hasElement('scholarship-akademik-revision-modal')).toBe(false);
    });

    it('Akademik: revise and reject use Akademik scholarship endpoints', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = scholarshipDetail({ status: 'Approved_Tendik' });
        await renderReviewScholarshipAkademik(42);
        clickById('scholarship-akademik-revise-btn');
        setInputValue('scholarship-akademik-revision-note', 'Perbarui dokumen.');
        clickById('scholarship-akademik-confirm-revise');
        await flush();
        expect(patch('revise')?.url).toBe('/api/akademik/scholarship/42/revise');
        expect(payloadOf(patch('revise'))).toEqual({ note: 'Perbarui dokumen.' });

        m.apiCalls = [];
        m.detailJson = scholarshipDetail({ status: 'Approved_Tendik' });
        await renderReviewScholarshipAkademik(42);
        clickById('scholarship-akademik-reject-btn');
        setInputValue('scholarship-akademik-rejection-reason', 'Tidak memenuhi syarat.');
        clickById('scholarship-akademik-confirm-reject');
        await flush();
        expect(patch('reject')?.url).toBe('/api/akademik/scholarship/42/reject');
        expect(payloadOf(patch('reject'))).toEqual({ reason: 'Tidak memenuhi syarat.' });
    });
});

// ── SKA (0 supporting docs — valid no-op) ────────────────────────────────────

describe('SKA reviewer', () => {
    it('Tendik: shell, no gallery, SKA rows, nomor_surat input, generated preview', async () => {
        setAuthRole('tendik');
        m.detailJson = plainLetterDetail({
            tempat_lahir: 'Yogyakarta',
            tanggal_lahir: '2004-01-02',
            jenis_kelamin: 'Laki-laki',
            keperluan: 'Pengajuan beasiswa',
            nama_orang_tua_wali: 'Siti',
            pekerjaan_orang_tua_wali: 'PNS',
            nip_orang_tua_wali: '19800101',
            pangkat_gol_orang_tua_wali: 'III/a',
            instansi_orang_tua_wali: 'Instansi Contoh',
        });
        await renderReviewSuratKeteranganAktif(11);
        expect(getCalls()[0].url).toBe('/api/tendik/surat-keterangan-aktif/11');
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(bodyHtml()).toContain('Review Surat Keterangan Aktif');
        expect(bodyHtml()).toContain('Pengajuan beasiswa');
        expect(bodyHtml()).toContain('Data Orang Tua/Wali');
        expect(bodyHtml()).toContain('Instansi Contoh');
        expect(m.gallery).toHaveLength(0); // 0 supporting docs → no gallery mount
        expect(hasElement('aktif-nomor-surat')).toBe(true);
        expect(m.viewerUrls).toContain('/api/tendik/surat-keterangan-aktif/11/generated-preview');
        expect(bodyHtml()).not.toContain('Proses Luar Negeri');
        assertNoRawPreviewLeak();
    });

    it('Tendik: approve sends nomor_surat through the SKA endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = plainLetterDetail();
        await renderReviewSuratKeteranganAktif(11);
        clickById('aktif-approve-btn');
        setInputValue('aktif-nomor-surat', 'SKA/1');
        clickById('aktif-confirm-approve');
        await flush();
        expect(patch('approve')?.url).toBe('/api/tendik/surat-keterangan-aktif/11/approve');
        expect(payloadOf(patch('approve'))).toEqual({ nomor_surat: 'SKA/1' });
    });

    it('Tendik: revise submits its note through the SKA endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = plainLetterDetail();
        await renderReviewSuratKeteranganAktif(11);
        clickById('aktif-revise-btn');
        setInputValue('aktif-revision-note', 'Perbaiki data wali.');
        clickById('aktif-confirm-revise');
        await flush();
        expect(patch('revise')?.url).toBe('/api/tendik/surat-keterangan-aktif/11/revise');
        expect(payloadOf(patch('revise'))).toEqual({ note: 'Perbaiki data wali.' });
    });

    it('Tendik: reject submits its reason through the SKA endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = plainLetterDetail();
        await renderReviewSuratKeteranganAktif(11);
        clickById('aktif-reject-btn');
        setInputValue('aktif-rejection-reason', 'Data tidak valid.');
        clickById('aktif-confirm-reject');
        await flush();
        expect(patch('reject')?.url).toBe('/api/tendik/surat-keterangan-aktif/11/reject');
        expect(payloadOf(patch('reject'))).toEqual({ reason: 'Data tidak valid.' });
    });

    it('Akademik Prodi: no gallery, no Tendik number input, akademik approve endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = plainLetterDetail({ status: 'Approved_Tendik' });
        await renderReviewSuratKeteranganAktifAkademik(11);
        expect(getCalls()[0].url).toBe('/api/akademik/surat-keterangan-aktif/11');
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(m.gallery).toHaveLength(0);
        expect(hasElement('aktif-nomor-surat')).toBe(false);
        expect(m.viewerUrls).toContain('/api/akademik/surat-keterangan-aktif/11/generated-preview');
        clickById('aktif-akademik-approve-btn');
        clickById('aktif-akademik-confirm-approve');
        await flush();
        expect(patch('approve')?.url).toBe('/api/akademik/surat-keterangan-aktif/11/approve');
        expect(payloadOf(patch('approve'))).toEqual({});
        assertNoRawPreviewLeak();
    });

    it('Akademik Departemen: mounts approval for Kadep on Approved_Kaprodi', async () => {
        setAuthRole('akademik', 'kadep');
        m.detailJson = plainLetterDetail({ status: 'Approved_Kaprodi' });
        await renderReviewSuratKeteranganAktifAkademik(11);
        expect(hasElement('aktif-akademik-approve-btn')).toBe(true);
        expect(bodyHtml()).toContain('Tandatangani dan Selesaikan di Akademik');
        expect(hasElement('aktif-nomor-surat')).toBe(false);
    });

    it('Akademik: stays read-only outside the explicit reviewer stage gate', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = plainLetterDetail({ status: 'Submitted' });
        await renderReviewSuratKeteranganAktifAkademik(11);
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(hasElement('aktif-akademik-approve-btn')).toBe(false);
        expect(hasElement('aktif-akademik-revision-modal')).toBe(false);
    });

    it('Akademik: reject submits its reason through the SKA endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = plainLetterDetail({ status: 'Approved_Tendik' });
        await renderReviewSuratKeteranganAktifAkademik(11);
        clickById('aktif-akademik-reject-btn');
        setInputValue('aktif-akademik-rejection-reason', 'Data tidak valid.');
        clickById('aktif-akademik-confirm-reject');
        await flush();
        expect(patch('reject')?.url).toBe('/api/akademik/surat-keterangan-aktif/11/reject');
        expect(payloadOf(patch('reject'))).toEqual({ reason: 'Data tidak valid.' });
    });

    it('Akademik: revise submits its note through the SKA endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = plainLetterDetail({ status: 'Approved_Tendik' });
        await renderReviewSuratKeteranganAktifAkademik(11);
        clickById('aktif-akademik-revise-btn');
        setInputValue('aktif-akademik-revision-note', 'Perbaiki data wali.');
        clickById('aktif-akademik-confirm-revise');
        await flush();
        expect(patch('revise')?.url).toBe('/api/akademik/surat-keterangan-aktif/11/revise');
        expect(payloadOf(patch('revise'))).toEqual({ note: 'Perbaiki data wali.' });
    });
});

// ── PLN (0 supporting docs — valid no-op) ────────────────────────────────────

describe('PLN reviewer', () => {
    it('Tendik: shell, no gallery, PLN rows, nomor_surat input, generated preview', async () => {
        setAuthRole('tendik');
        m.detailJson = plainLetterDetail({
            tempat_lahir: 'Yogyakarta',
            tanggal_lahir: '2004-01-02',
            jenis_kelamin: 'Laki-laki',
            semester: 4,
            nomor_paspor: 'A1234567',
            keperluan: 'Student exchange',
        });
        await renderReviewProsesLuarNegeri(11);
        expect(getCalls()[0].url).toBe('/api/tendik/proses-luar-negeri/11');
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(bodyHtml()).toContain('Review Proses Luar Negeri');
        expect(bodyHtml()).toContain('A1234567');
        expect(bodyHtml()).toContain('Student exchange');
        expect(m.gallery).toHaveLength(0);
        expect(hasElement('pln-nomor-surat')).toBe(true);
        expect(m.viewerUrls).toContain('/api/tendik/proses-luar-negeri/11/generated-preview');
        expect(bodyHtml()).not.toContain('Surat Keterangan Aktif');
        assertNoRawPreviewLeak();
    });

    it('Tendik: approve sends nomor_surat through the PLN endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = plainLetterDetail();
        await renderReviewProsesLuarNegeri(11);
        clickById('pln-approve-btn');
        setInputValue('pln-nomor-surat', 'PLN/1');
        clickById('pln-confirm-approve');
        await flush();
        expect(patch('approve')?.url).toBe('/api/tendik/proses-luar-negeri/11/approve');
        expect(payloadOf(patch('approve'))).toEqual({ nomor_surat: 'PLN/1' });
    });

    it('Tendik: revise submits its note through the PLN endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = plainLetterDetail();
        await renderReviewProsesLuarNegeri(11);
        clickById('pln-revise-btn');
        setInputValue('pln-revision-note', 'Perbaiki nomor paspor.');
        clickById('pln-confirm-revise');
        await flush();
        expect(patch('revise')?.url).toBe('/api/tendik/proses-luar-negeri/11/revise');
        expect(payloadOf(patch('revise'))).toEqual({ note: 'Perbaiki nomor paspor.' });
    });

    it('Tendik: reject submits its reason through the PLN endpoint', async () => {
        setAuthRole('tendik');
        m.detailJson = plainLetterDetail();
        await renderReviewProsesLuarNegeri(11);
        clickById('pln-reject-btn');
        setInputValue('pln-rejection-reason', 'Data tidak valid.');
        clickById('pln-confirm-reject');
        await flush();
        expect(patch('reject')?.url).toBe('/api/tendik/proses-luar-negeri/11/reject');
        expect(payloadOf(patch('reject'))).toEqual({ reason: 'Data tidak valid.' });
    });

    it('Akademik Prodi: no gallery, no Tendik number input, akademik approve endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = plainLetterDetail({ status: 'Approved_Tendik' });
        await renderReviewProsesLuarNegeriAkademik(11);
        expect(getCalls()[0].url).toBe('/api/akademik/proses-luar-negeri/11');
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(m.gallery).toHaveLength(0);
        expect(hasElement('pln-nomor-surat')).toBe(false);
        expect(m.viewerUrls).toContain('/api/akademik/proses-luar-negeri/11/generated-preview');
        clickById('pln-akademik-approve-btn');
        clickById('pln-akademik-confirm-approve');
        await flush();
        expect(patch('approve')?.url).toBe('/api/akademik/proses-luar-negeri/11/approve');
        expect(payloadOf(patch('approve'))).toEqual({});
        assertNoRawPreviewLeak();
    });

    it('Akademik Departemen: mounts approval for Kadep on Approved_Kaprodi', async () => {
        setAuthRole('akademik', 'kadep');
        m.detailJson = plainLetterDetail({ status: 'Approved_Kaprodi' });
        await renderReviewProsesLuarNegeriAkademik(11);
        expect(hasElement('pln-akademik-approve-btn')).toBe(true);
        expect(bodyHtml()).toContain('Tandatangani dan Selesaikan di Akademik');
        expect(hasElement('pln-nomor-surat')).toBe(false);
    });

    it('Akademik: stays read-only outside the explicit reviewer stage gate', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = plainLetterDetail({ status: 'Submitted' });
        await renderReviewProsesLuarNegeriAkademik(11);
        expect(bodyHtml()).toContain('data-reviewer-shell');
        expect(hasElement('pln-akademik-approve-btn')).toBe(false);
        expect(hasElement('pln-akademik-revision-modal')).toBe(false);
    });

    it('Akademik: reject submits its reason through the PLN endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = plainLetterDetail({ status: 'Approved_Tendik' });
        await renderReviewProsesLuarNegeriAkademik(11);
        clickById('pln-akademik-reject-btn');
        setInputValue('pln-akademik-rejection-reason', 'Data tidak valid.');
        clickById('pln-akademik-confirm-reject');
        await flush();
        expect(patch('reject')?.url).toBe('/api/akademik/proses-luar-negeri/11/reject');
        expect(payloadOf(patch('reject'))).toEqual({ reason: 'Data tidak valid.' });
    });

    it('Akademik: revise submits its note through the PLN endpoint', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = plainLetterDetail({ status: 'Approved_Tendik' });
        await renderReviewProsesLuarNegeriAkademik(11);
        clickById('pln-akademik-revise-btn');
        setInputValue('pln-akademik-revision-note', 'Perbaiki nomor paspor.');
        clickById('pln-akademik-confirm-revise');
        await flush();
        expect(patch('revise')?.url).toBe('/api/akademik/proses-luar-negeri/11/revise');
        expect(payloadOf(patch('revise'))).toEqual({ note: 'Perbaiki nomor paspor.' });
    });
});

// ── Future-proof supporting-document contract (reviewer level) ────────────────

describe('supporting-document descriptor contract (current reviewer behavior)', () => {
    it('descriptor counts per letter: Beasiswa 3, Magang 1, Surat Tugas 2, SKA/PLN 0', async () => {
        setAuthRole('tendik');

        m.gallery = []; m.detailJson = scholarshipDetail();
        await renderReviewScholarship(42);
        expect(lastGallery()).toHaveLength(3);

        m.gallery = []; m.detailJson = magangDetail();
        await renderReviewSuratPengantarMagang(5);
        expect(lastGallery()).toHaveLength(1);

        m.gallery = []; m.detailJson = suratTugasDetail();
        await renderReviewSuratTugas(7);
        expect(lastGallery()).toHaveLength(2);

        m.gallery = []; m.detailJson = plainLetterDetail();
        await renderReviewSuratKeteranganAktif(11);
        expect(m.gallery).toHaveLength(0);

        m.gallery = []; m.detailJson = plainLetterDetail();
        await renderReviewProsesLuarNegeri(11);
        expect(m.gallery).toHaveLength(0);
    });
});

describe('reviewer retention lifecycle state', () => {
    it('Tendik renders read-only active lifecycle state and keeps available previews', async () => {
        setAuthRole('tendik');
        m.detailJson = magangDetail({
            status: 'Completed',
            retention_summary: activeRetentionSummary(),
        });

        await renderReviewSuratPengantarMagang(5);

        expect(bodyHtml()).toContain('data-reviewer-retention-state');
        expect(bodyHtml()).toContain('Surat resmi dapat diunduh sampai');
        expect(lastGallery()).toHaveLength(1);
        expect(m.viewerUrls).toContain('/api/tendik/surat-pengantar-magang/5/generated-preview');
        expect(bodyHtml()).not.toContain('/api/storage');
        expect(bodyHtml()).not.toContain('checksum');
    });

    it('Akademik Prodi renders the same active lifecycle state through the shared shell', async () => {
        setAuthRole('akademik', 'kaprodi');
        m.detailJson = plainLetterDetail({
            status: 'Completed',
            retention_summary: activeRetentionSummary(),
        });

        await renderReviewSuratKeteranganAktifAkademik(11);

        expect(bodyHtml()).toContain('data-reviewer-retention-state');
        expect(bodyHtml()).toContain('Surat resmi dapat diunduh sampai');
        expect(m.viewerUrls).toContain('/api/akademik/surat-keterangan-aktif/11/generated-preview');
        expect(hasElement('aktif-akademik-approve-btn')).toBe(false);
    });

    it('Akademik Departemen renders expired final state without archive fallback or controls', async () => {
        setAuthRole('akademik', 'kadep');
        m.detailJson = suratTugasDetail({
            status: 'Completed',
            retention_summary: activeRetentionSummary({
                final_download_available: false,
                final_download_state: 'archived',
            }),
        });

        await renderReviewSuratTugasAkademik(7);

        const html = bodyHtml();
        expect(html).toContain('data-reviewer-retention-state');
        expect(html).toContain('Masa unduh surat resmi telah berakhir.');
        expect(m.viewerUrls).not.toContain('/api/akademik/surat-tugas/7/generated-preview');
        expect(html.toLowerCase()).not.toContain('archive');
        expect(html.toLowerCase()).not.toContain('arsip');
        expect(html).not.toContain('/api/super-admin/retention');
        expect(html).not.toContain('restore');
        expect(html).not.toContain('purge');
        expect(html).not.toContain('policy');
    });

    it('retention-deleted supporting documents render a safe empty state with no preview mount', async () => {
        setAuthRole('tendik');
        m.detailJson = magangDetail({
            status: 'Completed',
            retention_summary: activeRetentionSummary({
                supporting_documents_state: 'deleted',
            }),
        });

        await renderReviewSuratPengantarMagang(5);

        expect(hasElement('magang-tendik-supporting-gallery')).toBe(true);
        expect(bodyHtml()).toContain('Dokumen pendukung telah dibersihkan sesuai kebijakan retensi.');
        expect(m.gallery).toHaveLength(0);
    });

    it('all five reviewer adapters use one shared retention state path without date math', () => {
        const sources = [
            beasiswaReviewerSource,
            magangReviewerSource,
            skaReviewerSource,
            plnReviewerSource,
            suratTugasReviewerSource,
        ];

        sources.forEach((source) => {
            expect(source).toContain("from './retention-state'");
            expect(source).toContain('retention_summary?: LetterRetentionSummary | null');
            expect(source).toContain('retentionSummary: app.retention_summary');
            expect(source).not.toMatch(/final_download_expires_at[^;]*new Date/);
            expect(source).not.toMatch(/\b(14|30|365)\b/);
        });
        expect(reviewerShellSource).toContain('resolveLetterRetentionState');
        expect(reviewerShellSource).toContain('retentionAwareSupportingDescriptors');
    });
});
