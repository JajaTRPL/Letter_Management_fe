// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    tasks: [] as any[],
    riwayat: [] as any[],
    failTasks: false,
    failRiwayat: false,
    reviewCalls: [] as Array<{ renderer: string; id: number; origin?: string }>,
}));

vi.mock('../shared/api-client', () => ({
    apiFetch: vi.fn(async (url: string) => {
        if (url === '/api/akademik/dashboard/tasks') {
            if (m.failTasks) return { ok: false, status: 500 } as unknown as Response;
            return { ok: true, status: 200, json: async () => ({ tasks: m.tasks }) } as unknown as Response;
        }
        if (url === '/api/akademik/riwayat') {
            if (m.failRiwayat) return { ok: false, status: 500 } as unknown as Response;
            return { ok: true, status: 200, json: async () => ({ tasks: m.riwayat }) } as unknown as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    }),
}));

vi.mock('../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: vi.fn((_title: string, content: string) => {
        document.body.innerHTML = `<div id="app-root">${content}</div>`;
    }),
}));

// Explicit Akademik review renderers (NOT the Tendik ones).
vi.mock('../akademik/ReviewScholarshipAkademik', () => ({
    renderReviewScholarshipAkademik: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'beasiswa-akademik', id, origin: o?.origin })),
}));
vi.mock('../akademik/ReviewSuratPengantarMagangAkademik', () => ({
    renderReviewSuratPengantarMagangAkademik: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'magang-akademik', id, origin: o?.origin })),
}));
vi.mock('../akademik/ReviewSuratKeteranganAktifAkademik', () => ({
    renderReviewSuratKeteranganAktifAkademik: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'ska-akademik', id, origin: o?.origin })),
}));
vi.mock('../akademik/ReviewProsesLuarNegeriAkademik', () => ({
    renderReviewProsesLuarNegeriAkademik: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'pln-akademik', id, origin: o?.origin })),
}));
vi.mock('../akademik/ReviewSuratTugasAkademik', () => ({
    renderReviewSuratTugasAkademik: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'surat-tugas-akademik', id, origin: o?.origin })),
}));

import { renderDokumenAkademik } from '../akademik/DokumenAkademik';
import { renderRiwayatAkademik } from '../akademik/RiwayatAkademik';

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
};

const task = (overrides: Record<string, unknown> = {}) => ({
    id: 1, letter_type: 'surat-tugas', type: 'Surat Tugas', status: 'Approved_Tendik',
    submitted_at: '01 Jun 2026', student_name: 'Budi', nim: '24123456',
    nomor_surat: 'ST/001', action_at: '02 Jun 2026', ...overrides,
});

beforeEach(() => {
    document.body.innerHTML = '';
    m.tasks = [];
    m.riwayat = [];
    m.failTasks = false;
    m.failRiwayat = false;
    m.reviewCalls = [];
});

describe('Dokumen Akademik list integration (CP6C actionable)', () => {
    const rows = () => document.getElementById('dokumen-akademik-list-rows');

    it('mounts actionable rows with Review buttons (no scope tabs — scope is server-side)', async () => {
        m.tasks = [task({ id: 1 }), task({ id: 2, letter_type: 'surat-pengantar-magang', student_name: 'Siti' })];
        await renderDokumenAkademik('akademik');
        await flush();
        expect(rows()?.querySelectorAll('.akademik-review-btn').length).toBe(2);
        // No Tendik-style scope tabs.
        expect(document.querySelectorAll('.dokumen-tab').length).toBe(0);
    });

    it('searches and filters by type', async () => {
        m.tasks = [task({ id: 1, student_name: 'Budi', letter_type: 'surat-tugas' }), task({ id: 2, student_name: 'Siti', letter_type: 'surat-pengantar-magang' })];
        await renderDokumenAkademik('akademik');
        await flush();

        const search = document.getElementById('dokumen-akademik-list-search') as HTMLInputElement;
        search.value = 'siti';
        search.dispatchEvent(new Event('input'));
        expect(rows()?.querySelectorAll('.akademik-review-btn').length).toBe(1);

        search.value = '';
        search.dispatchEvent(new Event('input'));
        const typeFilter = document.getElementById('dokumen-akademik-list-filter-type') as HTMLSelectElement;
        typeFilter.value = 'surat-tugas';
        typeFilter.dispatchEvent(new Event('change'));
        const btns = rows()?.querySelectorAll('.akademik-review-btn');
        expect(btns?.length).toBe(1);
        expect((btns?.[0] as HTMLElement).dataset.letterType).toBe('surat-tugas');
    });

    it('dispatches Surat Tugas to the AKADEMIK reviewer (not Magang, not Tendik)', async () => {
        m.tasks = [task({ id: 5, letter_type: 'surat-tugas' })];
        await renderDokumenAkademik('akademik');
        await flush();
        (rows()?.querySelector('.akademik-review-btn') as HTMLElement).click();
        expect(m.reviewCalls).toContainEqual({ renderer: 'surat-tugas-akademik', id: 5, origin: undefined });
    });

    it('dispatches Beasiswa to renderReviewScholarshipAkademik (explicit Akademik adapter)', async () => {
        m.tasks = [task({ id: 8, letter_type: 'surat-permohonan-beasiswa', type: 'Surat Permohonan Beasiswa' })];
        await renderDokumenAkademik('akademik');
        await flush();
        (rows()?.querySelector('.akademik-review-btn') as HTMLElement).click();
        expect(m.reviewCalls).toContainEqual({ renderer: 'beasiswa-akademik', id: 8, origin: undefined });
    });

    it('renders empty and error states', async () => {
        m.tasks = [];
        await renderDokumenAkademik('akademik');
        await flush();
        expect(rows()?.textContent).toContain('Belum ada dokumen yang memerlukan tindakan');

        m.failTasks = true;
        await renderDokumenAkademik('akademik');
        await flush();
        expect(document.body.textContent).toContain('Gagal mengambil data dokumen akademik');
    });

    it('paginates a large list (page size 10)', async () => {
        m.tasks = Array.from({ length: 13 }, (_, i) => task({ id: i + 1, student_name: `S${i}` }));
        await renderDokumenAkademik('akademik');
        await flush();
        expect(rows()?.querySelectorAll('.akademik-review-btn').length).toBe(10);
        (document.getElementById('dokumen-akademik-list-next') as HTMLButtonElement).click();
        expect(rows()?.querySelectorAll('.akademik-review-btn').length).toBe(3);
    });
});

describe('Riwayat Akademik list integration (CP6C history)', () => {
    const rows = () => document.getElementById('riwayat-akademik-list-rows');

    it('mounts history rows and dispatches detail with riwayat origin to the Akademik reviewer', async () => {
        m.riwayat = [task({ id: 9, letter_type: 'proses-luar-negeri', status: 'Approved_Kaprodi', nomor_surat: 'PLN/009' })];
        await renderRiwayatAkademik('akademik');
        await flush();
        expect(rows()?.querySelectorAll('tbody tr').length).toBe(1);
        expect(rows()?.textContent).toContain('PLN/009');
        (rows()?.querySelector('[data-riwayat-lihat-detail]') as HTMLElement).click();
        expect(m.reviewCalls).toContainEqual({ renderer: 'pln-akademik', id: 9, origin: 'riwayat' });
    });

    it('filters history by status and renders empty state', async () => {
        m.riwayat = [task({ id: 1, status: 'Approved_Kaprodi' }), task({ id: 2, status: 'Rejected' })];
        await renderRiwayatAkademik('akademik');
        await flush();
        const statusFilter = document.getElementById('riwayat-akademik-list-filter-status') as HTMLSelectElement;
        statusFilter.value = 'Rejected';
        statusFilter.dispatchEvent(new Event('change'));
        expect(rows()?.querySelectorAll('tbody tr').length).toBe(1);

        m.riwayat = [];
        await renderRiwayatAkademik('akademik');
        await flush();
        expect(rows()?.textContent).toContain('Belum ada riwayat akademik');
    });

    it('never exposes raw storage URLs, markers, or unsafe embeds', async () => {
        m.riwayat = [task({ id: 1 })];
        await renderRiwayatAkademik('akademik');
        await flush();
        const html = document.body.innerHTML;
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', '<object', '<embed', 'window.open']) {
            expect(html).not.toContain(token);
        }
    });
});
