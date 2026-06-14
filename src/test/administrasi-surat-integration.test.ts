// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ forms: [] as string[] }));

vi.mock('../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: vi.fn((_t: string, content: string) => {
        document.body.innerHTML = `<div id="app-root">${content}</div>`;
    }),
}));
vi.mock('../dashboard/MahasiswaDashboard', () => ({ renderMahasiswaDashboard: vi.fn() }));
vi.mock('../mahasiswa/ScholarshipForm', () => ({ renderScholarshipForm: vi.fn(() => m.forms.push('beasiswa')) }));
vi.mock('../mahasiswa/SuratPengantarMagangForm', () => ({ renderSuratPengantarMagangForm: vi.fn(() => m.forms.push('magang')) }));
vi.mock('../mahasiswa/SuratKeteranganAktifForm', () => ({ renderSuratKeteranganAktifForm: vi.fn(() => m.forms.push('aktif')) }));
vi.mock('../mahasiswa/ProsesLuarNegeriForm', () => ({ renderProsesLuarNegeriForm: vi.fn(() => m.forms.push('pln')) }));
vi.mock('../mahasiswa/SuratTugasForm', () => ({ renderSuratTugasForm: vi.fn(() => m.forms.push('surat-tugas')) }));
vi.mock('toastify-js', () => ({ default: vi.fn(() => ({ showToast: vi.fn() })) }));
vi.mock('../shared/api-client', () => ({
    // Profile complete so card clicks dispatch straight to the form renderer.
    apiFetch: vi.fn(async () => ({ ok: true, json: async () => ({ completeness: { is_complete: true } }) } as unknown as Response)),
}));

import { renderAdministrasiSurat } from '../mahasiswa/AdministrasiSurat';

const flush = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 120)); // page binds inside a setTimeout(…, 100)
    await Promise.resolve();
};

beforeEach(() => {
    document.body.innerHTML = '';
    m.forms = [];
});

describe('Administrasi Surat page (CP7B card cutover)', () => {
    it('renders all five letter cards with their bound ids and duration badges', async () => {
        renderAdministrasiSurat();
        await flush();

        for (const id of ['card-aktif', 'card-magang', 'card-beasiswa', 'card-luar-negeri', 'card-surat-tugas']) {
            expect(document.getElementById(id)).not.toBeNull();
        }
        for (const id of ['duration-aktif', 'duration-magang', 'duration-beasiswa', 'duration-luar_negeri', 'duration-surat-tugas']) {
            expect(document.getElementById(id)).not.toBeNull();
        }
        expect(document.querySelectorAll('.doc-card').length).toBe(5);
    });

    it('keeps each card clickable and dispatching to its own form (Surat Tugas ≠ Magang)', async () => {
        renderAdministrasiSurat();
        await flush();

        (document.getElementById('card-surat-tugas') as HTMLElement).click();
        await flush();
        expect(m.forms).toContain('surat-tugas');
        expect(m.forms).not.toContain('magang');

        (document.getElementById('card-magang') as HTMLElement).click();
        await flush();
        expect(m.forms).toContain('magang');
    });

    it('renders distinct accent strokes and no unsafe markup', async () => {
        renderAdministrasiSurat();
        await flush();
        const html = document.body.innerHTML;
        // Five distinct accent strokes present.
        for (const stroke of ['#0d9488', '#3b82f6', '#f59e0b', '#059669', '#6366f1']) {
            expect(html).toContain(stroke);
        }
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', 'window.open']) {
            expect(html).not.toContain(token);
        }
    });
});
