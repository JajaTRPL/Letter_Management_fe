// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    loadMahasiswaApplications: vi.fn(async () => ({ items: [], failedEndpointCount: 0 })),
    renderProfilMahasiswa: vi.fn(),
}));

vi.mock('../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: vi.fn((_title: string, content: string) => {
        document.body.innerHTML = content;
    }),
}));
vi.mock('../mahasiswa/ProfilMahasiswa', () => ({ renderProfilMahasiswa: m.renderProfilMahasiswa }));
vi.mock('../mahasiswa/ScholarshipForm', () => ({ renderScholarshipDetail: vi.fn(), renderScholarshipForm: vi.fn() }));
vi.mock('../mahasiswa/SuratPengantarMagangForm', () => ({ renderSuratPengantarMagangDetail: vi.fn() }));
vi.mock('../mahasiswa/SuratKeteranganAktifForm', () => ({ renderSuratKeteranganAktifDetail: vi.fn() }));
vi.mock('../mahasiswa/ProsesLuarNegeriForm', () => ({ renderProsesLuarNegeriDetail: vi.fn() }));
vi.mock('../mahasiswa/SuratTugasForm', () => ({ renderSuratTugasDetail: vi.fn() }));
vi.mock('../shared/api-client', () => ({
    apiFetch: m.apiFetch,
    loadProtectedImageObjectUrl: vi.fn(async () => null),
    revokeProtectedImageObjectUrl: vi.fn(),
}));
vi.mock('../shared/mahasiswa-application-list', () => ({
    loadMahasiswaApplications: m.loadMahasiswaApplications,
}));
vi.mock('toastify-js', () => ({ default: vi.fn(() => ({ showToast: vi.fn() })) }));

import { renderMahasiswaDashboard } from '../dashboard/MahasiswaDashboard';

const response = (body: unknown): Response => ({
    ok: true,
    json: async () => body,
} as Response);

const flushProgressFetch = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    await Promise.resolve();
};

const renderWithCompleteness = async (completeness: Record<string, unknown>, profile: Record<string, unknown> = {}) => {
    m.apiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/profile') return response({ completeness, profile });
        return response({});
    });

    await renderMahasiswaDashboard();
    await flushProgressFetch();
};

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    m.apiFetch.mockReset();
    m.loadMahasiswaApplications.mockClear();
    m.renderProfilMahasiswa.mockClear();
});

describe('Mahasiswa Dashboard canonical profile progress', () => {
    it('renders the backend percentage and hides the reminder when complete', async () => {
        await renderWithCompleteness({ is_complete: true, percentage: 100 });

        expect(document.getElementById('profile-progress-text')?.innerText).toContain('100%');
        expect(document.getElementById('profile-progress-bar')?.style.width).toBe('100%');
        expect(document.getElementById('profile-reminder-section')?.classList.contains('hidden')).toBe(true);
    });

    it('renders an incomplete backend percentage without inspecting optional parent fields', async () => {
        await renderWithCompleteness(
            { is_complete: false, percentage: 94 },
            { keluarga: [{ jenis_relasi: 'ayah' }, { jenis_relasi: 'ibu' }] },
        );

        expect(document.getElementById('profile-progress-text')?.innerText).toContain('94%');
        expect(document.getElementById('profile-reminder-section')?.classList.contains('hidden')).toBe(false);
    });

    it('renders 100 when backend says optional parent fields do not reduce completion', async () => {
        await renderWithCompleteness(
            { is_complete: true, percentage: 100 },
            { keluarga: [{ jenis_relasi: 'ayah' }, { jenis_relasi: 'ibu' }] },
        );

        expect(document.getElementById('profile-progress-text')?.innerText).toContain('100%');
        expect(document.getElementById('profile-reminder-section')?.classList.contains('hidden')).toBe(true);
    });

    it('uses the safe boolean fallback when an older backend omits percentage', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        await renderWithCompleteness({ is_complete: true });
        expect(document.getElementById('profile-progress-text')?.innerText).toContain('100%');

        await renderWithCompleteness({ is_complete: false });
        expect(document.getElementById('profile-progress-text')?.innerText).toContain('0%');
        expect(warn).toHaveBeenCalled();

        warn.mockRestore();
    });

    it('keeps the profile fetch no-store and profile navigation wired', async () => {
        await renderWithCompleteness({ is_complete: false, percentage: 93 });

        expect(m.apiFetch).toHaveBeenCalledWith('/api/profile', { cache: 'no-store' });
        document.getElementById('btn-lengkapi-profil')?.click();
        expect(m.renderProfilMahasiswa).toHaveBeenCalledOnce();
    });

    it('contains no dashboard-local profile denominator or parent-field inspection', () => {
        const source = renderMahasiswaDashboard.toString();

        expect(source).not.toContain('requiredDetail');
        expect(source).not.toContain('requiredAyah');
        expect(source).not.toContain('requiredIbu');
        expect(source).not.toContain('filledCount');
        expect(source).not.toContain("jenis_relasi === 'ayah'");
        expect(source).not.toContain("jenis_relasi === 'ibu'");
        expect(source).toContain('completeness?.percentage');
        expect(source).toContain('/api/profile');
        expect(source).toContain('no-store');
        expect(source).toContain('loadMahasiswaApplications');
    });
});
