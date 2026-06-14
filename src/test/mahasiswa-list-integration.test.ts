// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    byType: {} as Record<string, any[]>,
    failUrls: new Set<string>(),
    detailCalls: [] as Array<{ renderer: string; id: string }>,
}));

const ENDPOINT_TYPE: Record<string, string> = {
    '/api/mahasiswa/scholarship/applications': 'surat-permohonan-beasiswa',
    '/api/mahasiswa/surat-pengantar-magang/applications': 'surat-pengantar-magang',
    '/api/mahasiswa/surat-keterangan-aktif/applications': 'surat-keterangan-aktif',
    '/api/mahasiswa/proses-luar-negeri/applications': 'proses-luar-negeri',
    '/api/mahasiswa/surat-tugas/applications': 'surat-tugas',
};

vi.mock('../shared/api-client', () => ({
    apiFetch: vi.fn(async (url: string) => {
        if (m.failUrls.has(url)) return { ok: false, status: 500 } as unknown as Response;
        const type = ENDPOINT_TYPE[url];
        const applications = type ? (m.byType[type] ?? []) : [];
        return { ok: true, status: 200, json: async () => ({ applications }) } as unknown as Response;
    }),
}));

vi.mock('../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: vi.fn((_title: string, content: string) => {
        document.body.innerHTML = `<div id="app-root">${content}</div>`;
    }),
}));

vi.mock('../mahasiswa/ScholarshipForm', () => ({
    renderScholarshipDetail: vi.fn((id: string) => m.detailCalls.push({ renderer: 'beasiswa', id })),
}));
vi.mock('../mahasiswa/SuratPengantarMagangForm', () => ({
    renderSuratPengantarMagangDetail: vi.fn((id: string) => m.detailCalls.push({ renderer: 'magang', id })),
}));
vi.mock('../mahasiswa/SuratKeteranganAktifForm', () => ({
    renderSuratKeteranganAktifDetail: vi.fn((id: string) => m.detailCalls.push({ renderer: 'ska', id })),
}));
vi.mock('../mahasiswa/ProsesLuarNegeriForm', () => ({
    renderProsesLuarNegeriDetail: vi.fn((id: string) => m.detailCalls.push({ renderer: 'pln', id })),
}));
vi.mock('../mahasiswa/SuratTugasForm', () => ({
    renderSuratTugasDetail: vi.fn((id: string) => m.detailCalls.push({ renderer: 'surat-tugas', id })),
}));

import { renderRiwayatPengajuan } from '../mahasiswa/RiwayatPengajuan';

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
};

const seedAllFive = (): void => {
    m.byType = {
        'surat-permohonan-beasiswa': [{ id: 1, status: 'Submitted', scholarship_name: 'Beasiswa Unggulan', created_at: '2026-06-01', submitted_at: '2026-06-01' }],
        'surat-keterangan-aktif': [{ id: 2, status: 'Completed', created_at: '2026-05-01', submitted_at: '2026-05-01' }],
        'surat-pengantar-magang': [{ id: 3, status: 'Submitted', created_at: '2026-05-20', submitted_at: '2026-05-20' }],
        'proses-luar-negeri': [{ id: 4, status: 'Revision', created_at: '2026-05-10', submitted_at: '2026-05-10' }],
        'surat-tugas': [{ id: 5, status: 'Completed', created_at: '2026-05-25', submitted_at: '2026-05-25' }],
    };
};

const rowsRoot = () => document.getElementById('riwayat-list-rows');
const ids = {
    search: 'riwayat-list-search',
    typeFilter: 'riwayat-list-filter-type',
    statusFilter: 'riwayat-list-filter-status',
    results: 'riwayat-list-results',
    prev: 'riwayat-list-prev',
    next: 'riwayat-list-next',
    pageInfo: 'riwayat-list-page-info',
};

beforeEach(() => {
    document.body.innerHTML = '';
    m.byType = {};
    m.failUrls = new Set();
    m.detailCalls = [];
});

describe('Mahasiswa Riwayat list integration (CP6A)', () => {
    it('mounts, renders all five letter types newest-first, with status badges', async () => {
        seedAllFive();
        await renderRiwayatPengajuan();
        await flush();

        const html = rowsRoot()?.innerHTML ?? '';
        expect(html).toContain('Beasiswa Unggulan');
        for (const label of ['Surat Keterangan Aktif', 'Surat Pengantar Magang', 'Proses Luar Negeri', 'Surat Tugas']) {
            expect(html).toContain(label);
        }
        // Newest-first: Beasiswa (2026-06-01) row appears before SKA (2026-05-01).
        expect(html.indexOf('Beasiswa Unggulan')).toBeLessThan(html.indexOf('Surat Keterangan Aktif'));
        // Five rows.
        expect(rowsRoot()?.querySelectorAll('tr[data-row-action="view-detail"]').length).toBe(5);
    });

    it('searches by visible label', async () => {
        seedAllFive();
        await renderRiwayatPengajuan();
        await flush();

        const search = document.getElementById(ids.search) as HTMLInputElement;
        search.value = 'magang';
        search.dispatchEvent(new Event('input'));

        const rows = rowsRoot()?.querySelectorAll('tr[data-row-action="view-detail"]');
        expect(rows?.length).toBe(1);
        expect(rowsRoot()?.innerHTML).toContain('Surat Pengantar Magang');
    });

    it('filters by status and by type', async () => {
        seedAllFive();
        await renderRiwayatPengajuan();
        await flush();

        const statusFilter = document.getElementById(ids.statusFilter) as HTMLSelectElement;
        statusFilter.value = 'Completed';
        statusFilter.dispatchEvent(new Event('change'));
        expect(rowsRoot()?.querySelectorAll('tr[data-row-action="view-detail"]').length).toBe(2);

        // Reset status, filter by type.
        statusFilter.value = '';
        statusFilter.dispatchEvent(new Event('change'));
        const typeFilter = document.getElementById(ids.typeFilter) as HTMLSelectElement;
        typeFilter.value = 'surat-tugas';
        typeFilter.dispatchEvent(new Event('change'));
        const rows = rowsRoot()?.querySelectorAll('tr[data-row-action="view-detail"]');
        expect(rows?.length).toBe(1);
        expect(rowsRoot()?.innerHTML).toContain('Surat Tugas');
    });

    it('paginates a large result set', async () => {
        m.byType = {
            'surat-keterangan-aktif': Array.from({ length: 23 }, (_, i) => ({
                id: 100 + i, status: 'Submitted', created_at: `2026-05-${String((i % 28) + 1).padStart(2, '0')}`,
            })),
        };
        await renderRiwayatPengajuan();
        await flush();

        // Default page size 10.
        expect(rowsRoot()?.querySelectorAll('tr[data-row-action="view-detail"]').length).toBe(10);
        expect(document.getElementById(ids.pageInfo)?.textContent).toBe('Halaman 1 dari 3');
        expect((document.getElementById(ids.prev) as HTMLButtonElement).disabled).toBe(true);

        (document.getElementById(ids.next) as HTMLButtonElement).click();
        (document.getElementById(ids.next) as HTMLButtonElement).click();
        expect(document.getElementById(ids.pageInfo)?.textContent).toBe('Halaman 3 dari 3');
        expect(rowsRoot()?.querySelectorAll('tr[data-row-action="view-detail"]').length).toBe(3);
        expect((document.getElementById(ids.next) as HTMLButtonElement).disabled).toBe(true);
    });

    it('renders the empty state when no applications exist', async () => {
        await renderRiwayatPengajuan();
        await flush();
        expect(rowsRoot()?.textContent).toContain('Belum ada riwayat pengajuan surat.');
    });

    it('dispatches the correct detail renderer per letter type', async () => {
        seedAllFive();
        await renderRiwayatPengajuan();
        await flush();

        // Click the Magang row's detail button.
        const magangBtn = Array.from(rowsRoot()?.querySelectorAll('button[data-action="view-detail"]') ?? [])
            .find((b) => (b as HTMLElement).dataset.type === 'surat-pengantar-magang') as HTMLElement;
        magangBtn.click();
        expect(m.detailCalls).toContainEqual({ renderer: 'magang', id: '3' });

        // Click the Surat Tugas row body.
        const stRow = Array.from(rowsRoot()?.querySelectorAll('tr[data-row-action="view-detail"]') ?? [])
            .find((r) => (r as HTMLElement).dataset.type === 'surat-tugas') as HTMLElement;
        stRow.click();
        expect(m.detailCalls).toContainEqual({ renderer: 'surat-tugas', id: '5' });
    });

    it('never exposes raw storage URLs, markers, complete action, or unsafe embeds', async () => {
        seedAllFive();
        await renderRiwayatPengajuan();
        await flush();

        const html = document.body.innerHTML;
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', '<object', '<embed', 'window.open', 'Selesaikan Pengajuan']) {
            expect(html).not.toContain(token);
        }
    });
});
