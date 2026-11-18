// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
}));

vi.mock('../../shared/api-client', () => ({
    apiFetch: m.apiFetch,
    loadProtectedImageObjectUrl: vi.fn(async () => null),
    revokeProtectedImageObjectUrl: vi.fn(),
}));

// The reviewer page transitively imports the shared PDF.js viewer; pdfjs-dist
// cannot load under jsdom (no DOMMatrix), so stub the viewer module.
vi.mock('../../shared/protected-pdf-viewer', () => ({
    renderProtectedPdfViewer: () => '<div data-protected-pdf-viewer></div>',
    attachProtectedPdfViewer: () => () => {},
}));

import { renderSidebar } from '../../components/Sidebar';
import { renderDashboardLayout } from '../../dashboard/DashboardLayout';

const response = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
    localStorage.setItem('auth_role', 'tendik');
    localStorage.setItem('auth_name', 'Reviewer');
    m.apiFetch.mockReset();
    m.apiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/profile') {
            return response({
                user: { id: 1, role: 'tendik', tendik_role: 'sarpras' },
            });
        }
        return response({
            message: 'ok',
            data: [],
            meta: {
                current_page: 1,
                per_page: 10,
                total: 0,
                last_page: 1,
            },
        });
    });
});

describe('Tendik Peminjaman navigation', () => {
    it('keeps Persuratan on surat menus without a dead Peminjaman entry', () => {
        // The backend denies the Peminjaman reviewer queue for Persuratan —
        // showing the menu would only lead to a 403 page.
        localStorage.setItem('auth_tendik_role', 'persuratan');
        const tendik = renderSidebar('tendik');
        expect(tendik).not.toContain('sidebar-peminjaman-tendik-link');
        expect(tendik).toContain('sidebar-dokumen-tendik-link');
        expect(tendik).toContain('sidebar-riwayat-tendik-link');

        expect(renderSidebar('akademik')).not.toContain('sidebar-peminjaman-tendik-link');
        // Mahasiswa Peminjaman is hidden while under development (feature-flags.ts).
        expect(renderSidebar('mahasiswa')).not.toContain('sidebar-peminjaman-link');
    });

    it.each(['sarpras', 'kepala_lab', 'laboran'])(
        'hides the surat-oriented Dokumen/Riwayat menus for %s while keeping Peminjaman',
        (tendikRole) => {
            localStorage.setItem('auth_tendik_role', tendikRole);
            const sidebar = renderSidebar('tendik');

            expect(sidebar).toContain('sidebar-dashboard-link');
            expect(sidebar).toContain('sidebar-peminjaman-tendik-link');
            expect(sidebar).not.toContain('sidebar-dokumen-tendik-link');
            expect(sidebar).not.toContain('sidebar-riwayat-tendik-link');
            expect(sidebar).not.toContain('>Dokumen<');
        },
    );

    it('keeps Dokumen/Riwayat but not Peminjaman when the tendik sub-role is unknown', () => {
        localStorage.removeItem('auth_tendik_role');
        const sidebar = renderSidebar('tendik');
        expect(sidebar).toContain('sidebar-dokumen-tendik-link');
        expect(sidebar).toContain('sidebar-riwayat-tendik-link');
        expect(sidebar).not.toContain('sidebar-peminjaman-tendik-link');
    });

    it('shows a safe helper note instead of menus for an unknown role', () => {
        const sidebar = renderSidebar('unknown-role');
        expect(sidebar).toContain('Peran akun belum lengkap. Silakan lengkapi profil atau hubungi admin.');
        expect(sidebar).not.toContain('sidebar-dokumen-tendik-link');
        expect(sidebar).not.toContain('sidebar-peminjaman-tendik-link');
        expect(sidebar).not.toContain('sidebar-users-link');
        expect(sidebar).not.toContain('sidebar-administrasi-link');
    });

    it('dispatches the existing Tendik sidebar link to the reviewer page', async () => {
        localStorage.setItem('auth_tendik_role', 'sarpras');
        renderDashboardLayout('Dashboard', '<p>Awal</p>', 'tendik');
        document.getElementById('sidebar-peminjaman-tendik-link')?.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
        await flush();
        await vi.waitFor(() => {
            expect(document.body.textContent).toContain('Antrean Review Peminjaman');
            expect(document.body.textContent).toContain('Belum ada pengajuan dalam antrean');
        });
        expect(document.querySelector('#sidebar-peminjaman-tendik-link')?.className)
            .toContain('bg-white/10');
    });
});
