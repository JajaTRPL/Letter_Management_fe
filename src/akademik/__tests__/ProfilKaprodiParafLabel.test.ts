// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: vi.fn((_title: string, content: string) => {
        document.body.innerHTML = content;
    }),
}));
vi.mock('../../login/Login', () => ({ renderLogin: vi.fn() }));
vi.mock('../../shared/toast', () => ({ showSuccess: vi.fn(), showError: vi.fn() }));
vi.mock('../../shared/api-client', () => ({
    apiFetch: m.apiFetch,
    loadProtectedImageObjectUrl: vi.fn(async () => null),
    revokeProtectedImageObjectUrl: vi.fn(),
}));

import { renderProfilKaprodi } from '../ProfilKaprodi';

const settle = async (): Promise<void> => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const renderAs = async (subRole: string): Promise<string> => {
    m.apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
            user: { name: 'Dosen', email: 'dosen@ugm.ac.id', role: 'akademik', sub_role: subRole, status: 'active' },
            profile: {},
        }),
    });
    await renderProfilKaprodi('akademik');
    await settle();
    return document.body.textContent ?? '';
};

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    m.apiFetch.mockReset();
});

describe('Profil akademik signature field wording', () => {
    it.each(['kaprodi', 'sekprodi'])('labels the upload field "Paraf" for %s', async (subRole) => {
        const text = await renderAs(subRole);
        expect(text).toContain('Paraf');
        expect(text).toContain('Belum ada Paraf');
        expect(text).not.toContain('Tanda Tangan (TTD)');
    });

    it('tells Kaprodi their paraf is printed on letters and Sekprodi that the Kaprodi paraf is used', async () => {
        const kaprodiText = await renderAs('kaprodi');
        expect(kaprodiText).toContain('Paraf ini dicetak sebagai paraf persetujuan Prodi');
        expect(kaprodiText).toContain('Wajib diunggah');
        const sekprodiText = await renderAs('sekprodi');
        expect(sekprodiText).toContain('memakai paraf Kaprodi program studi Anda');
        expect(sekprodiText).toContain('sebelum Kaprodi mengunggah paraf');
    });

    it.each(['kadep', 'sekdep'])('keeps "Tanda Tangan (TTD)" for %s', async (subRole) => {
        const text = await renderAs(subRole);
        expect(text).toContain('Tanda Tangan (TTD)');
        expect(text).toContain('Belum ada Tanda Tangan');
    });
});
