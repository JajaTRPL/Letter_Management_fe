// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    tasksByScope: {} as Record<string, any[]>,
    riwayatByScope: {} as Record<string, any[]>,
    failTasks: false,
    failRiwayat: false,
    reviewCalls: [] as Array<{ renderer: string; id: number; origin?: string }>,
}));

vi.mock('../shared/api-client', () => ({
    apiFetch: vi.fn(async (url: string) => {
        const tasksMatch = url.match(/\/api\/tendik\/dashboard\/tasks\?scope=(\w+)/);
        if (tasksMatch) {
            if (m.failTasks) return { ok: false, status: 500, json: async () => ({ message: 'boom' }) } as unknown as Response;
            return { ok: true, status: 200, json: async () => ({ tasks: m.tasksByScope[tasksMatch[1]] ?? [] }) } as unknown as Response;
        }
        const riwayatMatch = url.match(/\/api\/tendik\/riwayat\?scope=(\w+)/);
        if (riwayatMatch) {
            if (m.failRiwayat) return { ok: false, status: 500, json: async () => ({ message: 'boom' }) } as unknown as Response;
            return { ok: true, status: 200, json: async () => ({ tasks: m.riwayatByScope[riwayatMatch[1]] ?? [] }) } as unknown as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    }),
}));

vi.mock('../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: vi.fn((_title: string, content: string) => {
        document.body.innerHTML = `<div id="app-root">${content}</div>`;
    }),
}));

vi.mock('../tendik/ReviewScholarship', () => ({
    renderReviewScholarship: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'beasiswa', id, origin: o?.origin })),
}));
vi.mock('../tendik/ReviewSuratPengantarMagang', () => ({
    renderReviewSuratPengantarMagang: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'magang', id, origin: o?.origin })),
}));
vi.mock('../tendik/ReviewSuratKeteranganAktif', () => ({
    renderReviewSuratKeteranganAktif: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'ska', id, origin: o?.origin })),
}));
vi.mock('../tendik/ReviewProsesLuarNegeri', () => ({
    renderReviewProsesLuarNegeri: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'pln', id, origin: o?.origin })),
}));
vi.mock('../tendik/ReviewSuratTugas', () => ({
    renderReviewSuratTugas: vi.fn((id: number, o?: { origin?: string }) => m.reviewCalls.push({ renderer: 'surat-tugas', id, origin: o?.origin })),
}));

import { renderDokumenTendik } from '../tendik/DokumenTendik';
import { renderRiwayatTendik } from '../tendik/RiwayatTendik';

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
};

const task = (overrides: Record<string, unknown> = {}) => ({
    id: 1, letter_type: 'surat-tugas', type: 'Surat Tugas', status: 'Submitted',
    submitted_at: '01 Jun 2026', student_name: 'Budi', nim: '24123456', assigned_tendik_name: 'Tendik A',
    ...overrides,
});

beforeEach(() => {
    document.body.innerHTML = '';
    m.tasksByScope = {};
    m.riwayatByScope = {};
    m.failTasks = false;
    m.failRiwayat = false;
    m.reviewCalls = [];
});

describe('Dokumen Tendik list integration (CP6B actionable)', () => {
    const dokRows = () => document.getElementById('dokumen-list-rows');

    it('mounts, renders actionable rows with Review buttons and the scope tabs', async () => {
        m.tasksByScope = { mine: [task({ id: 1 }), task({ id: 2, letter_type: 'surat-pengantar-magang', student_name: 'Siti' })] };
        await renderDokumenTendik('tendik');
        await flush();

        expect(dokRows()?.querySelectorAll('tbody tr').length).toBe(2);
        expect(dokRows()?.querySelectorAll('.review-btn').length).toBe(2);
        expect(document.querySelectorAll('.dokumen-tab').length).toBe(2);
    });

    it('searches by student name within the actionable list', async () => {
        m.tasksByScope = { mine: [task({ id: 1, student_name: 'Budi' }), task({ id: 2, student_name: 'Siti' })] };
        await renderDokumenTendik('tendik');
        await flush();

        const search = document.getElementById('dokumen-list-search') as HTMLInputElement;
        search.value = 'siti';
        search.dispatchEvent(new Event('input'));
        expect(dokRows()?.querySelectorAll('.review-btn').length).toBe(1);
    });

    it('filters by letter type', async () => {
        m.tasksByScope = { mine: [task({ id: 1, letter_type: 'surat-tugas' }), task({ id: 2, letter_type: 'surat-pengantar-magang' })] };
        await renderDokumenTendik('tendik');
        await flush();

        const typeFilter = document.getElementById('dokumen-list-filter-type') as HTMLSelectElement;
        typeFilter.value = 'surat-pengantar-magang';
        typeFilter.dispatchEvent(new Event('change'));
        const rows = dokRows()?.querySelectorAll('.review-btn');
        expect(rows?.length).toBe(1);
        expect((rows?.[0] as HTMLElement).dataset.letterType).toBe('surat-pengantar-magang');
    });

    it('dispatches the correct reviewer (Surat Tugas not Magang)', async () => {
        m.tasksByScope = { mine: [task({ id: 5, letter_type: 'surat-tugas' })] };
        await renderDokumenTendik('tendik');
        await flush();
        (dokRows()?.querySelector('.review-btn') as HTMLElement).click();
        expect(m.reviewCalls).toContainEqual({ renderer: 'surat-tugas', id: 5, origin: undefined });
    });

    it('renders the empty state and an error state', async () => {
        m.tasksByScope = { mine: [] };
        await renderDokumenTendik('tendik');
        await flush();
        expect(dokRows()?.textContent).toContain('Belum ada tugas yang ditugaskan');

        m.failTasks = true;
        await renderDokumenTendik('tendik');
        await flush();
        // The controller surfaces the server-provided message when present.
        expect(document.body.textContent).toContain('boom');
    });

    it('paginates a large actionable list (page size 10)', async () => {
        m.tasksByScope = { mine: Array.from({ length: 14 }, (_, i) => task({ id: i + 1, student_name: `S${i}` })) };
        await renderDokumenTendik('tendik');
        await flush();
        expect(dokRows()?.querySelectorAll('.review-btn').length).toBe(10);
        (document.getElementById('dokumen-list-next') as HTMLButtonElement).click();
        expect(dokRows()?.querySelectorAll('.review-btn').length).toBe(4);
    });
});

describe('Riwayat Tendik list integration (CP6B history)', () => {
    const riwRows = () => document.getElementById('riwayat-tendik-list-rows');

    it('mounts, renders history rows, and dispatches detail with riwayat origin', async () => {
        m.riwayatByScope = { mine: [task({ id: 9, letter_type: 'proses-luar-negeri', status: 'Completed', tendik_approved_by_name: 'Verifier' })] };
        await renderRiwayatTendik('tendik');
        await flush();

        expect(riwRows()?.querySelectorAll('tbody tr').length).toBe(1);
        expect(riwRows()?.textContent).toContain('Verifier');
        const detailBtn = riwRows()?.querySelector('[data-riwayat-lihat-detail]') as HTMLElement;
        detailBtn.click();
        expect(m.reviewCalls).toContainEqual({ renderer: 'pln', id: 9, origin: 'riwayat' });
    });

    it('filters history by status and renders the empty state', async () => {
        m.riwayatByScope = { mine: [task({ id: 1, status: 'Completed' }), task({ id: 2, status: 'Rejected' })] };
        await renderRiwayatTendik('tendik');
        await flush();

        const statusFilter = document.getElementById('riwayat-tendik-list-filter-status') as HTMLSelectElement;
        statusFilter.value = 'Rejected';
        statusFilter.dispatchEvent(new Event('change'));
        expect(riwRows()?.querySelectorAll('tbody tr').length).toBe(1);

        m.riwayatByScope = { mine: [] };
        await renderRiwayatTendik('tendik');
        await flush();
        expect(riwRows()?.textContent).toContain('Belum ada riwayat');
    });

    it('never exposes raw storage URLs, markers, or unsafe embeds', async () => {
        m.riwayatByScope = { mine: [task({ id: 1 })] };
        await renderRiwayatTendik('tendik');
        await flush();
        const html = document.body.innerHTML;
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', '<object', '<embed', 'window.open']) {
            expect(html).not.toContain(token);
        }
    });
});
