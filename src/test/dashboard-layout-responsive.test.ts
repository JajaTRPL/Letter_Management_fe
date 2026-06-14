// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import layoutSource from '../dashboard/DashboardLayout.ts?raw';
import sidebarSource from '../components/Sidebar.ts?raw';

vi.mock('../login/Login', () => ({ renderLogin: vi.fn() }));
vi.mock('toastify-js', () => ({ default: vi.fn(() => ({ showToast: vi.fn() })) }));
vi.mock('../shared/api-client', () => ({
    apiFetch: vi.fn(),
    loadProtectedImageObjectUrl: vi.fn(async () => null),
    revokeProtectedImageObjectUrl: vi.fn(),
}));

import { cleanupDashboardLayout, renderDashboardLayout } from '../dashboard/DashboardLayout';

const setViewportWidth = (width: number): void => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
};

const click = (id: string): void => {
    (document.getElementById(id) as HTMLElement | null)?.click();
};

beforeEach(() => {
    cleanupDashboardLayout();
    document.body.className = '';
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
});

afterEach(() => {
    cleanupDashboardLayout();
    vi.restoreAllMocks();
});

describe('DashboardLayout responsive sidebar drawer', () => {
    it('preserves the desktop sticky sidebar and renders an accessible mobile toggle', () => {
        setViewportWidth(1280);
        renderDashboardLayout('Dashboard', '<p>Content</p>', 'mahasiswa');

        const sidebar = document.getElementById('dashboard-sidebar')!;
        const toggle = document.getElementById('dashboard-sidebar-toggle')!;
        expect(sidebar.className).toContain('lg:sticky');
        expect(sidebar.className).toContain('lg:translate-x-0');
        expect(sidebar.getAttribute('aria-hidden')).toBe('false');
        expect(sidebar.hasAttribute('inert')).toBe(false);
        expect(toggle.className).toContain('lg:hidden');
        expect(toggle.getAttribute('aria-controls')).toBe('dashboard-sidebar');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    it('opens the narrow drawer, locks body scroll, and closes from its close button', () => {
        setViewportWidth(375);
        renderDashboardLayout('Dashboard', '<p>Content</p>', 'mahasiswa');

        const sidebar = document.getElementById('dashboard-sidebar')!;
        const overlay = document.getElementById('dashboard-sidebar-overlay')!;
        const toggle = document.getElementById('dashboard-sidebar-toggle')!;
        const closeButton = document.getElementById('dashboard-sidebar-close')!;
        expect(sidebar.getAttribute('aria-hidden')).toBe('true');
        expect(sidebar.hasAttribute('inert')).toBe(true);

        click('dashboard-sidebar-toggle');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(sidebar.className).toContain('translate-x-0');
        expect(sidebar.getAttribute('aria-hidden')).toBe('false');
        expect(overlay.classList.contains('hidden')).toBe(false);
        expect(document.body.classList.contains('overflow-hidden')).toBe(true);
        expect(document.activeElement).toBe(closeButton);

        click('dashboard-sidebar-close');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(overlay.classList.contains('hidden')).toBe(true);
        expect(document.body.classList.contains('overflow-hidden')).toBe(false);
        expect(document.activeElement).toBe(toggle);
    });

    it('closes from overlay click, Escape, and a narrow navigation click', () => {
        setViewportWidth(375);
        renderDashboardLayout('Dashboard', '<p>Content</p>', 'mahasiswa');
        const toggle = document.getElementById('dashboard-sidebar-toggle')!;

        click('dashboard-sidebar-toggle');
        click('dashboard-sidebar-overlay');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        click('dashboard-sidebar-toggle');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        click('dashboard-sidebar-toggle');
        click('sidebar-panduan-link');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    it('detaches the document keydown listener and restores body scroll during cleanup', () => {
        setViewportWidth(375);
        const removeListener = vi.spyOn(document, 'removeEventListener');
        renderDashboardLayout('Dashboard', '<p>Content</p>', 'mahasiswa');
        click('dashboard-sidebar-toggle');

        cleanupDashboardLayout();

        expect(document.body.classList.contains('overflow-hidden')).toBe(false);
        expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it.each([
        ['mahasiswa', ['Dashboard', 'Administrasi Surat', 'Peminjaman Ruangan', 'Riwayat Pengajuan']],
        ['tendik', ['Dashboard', 'Dokumen', 'Riwayat']],
        ['akademik', ['Dashboard', 'Dokumen', 'Riwayat']],
        ['super_admin', ['Dashboard', 'Manajemen Akun', 'Monitoring Surat', 'Template Dokumen']],
    ])('preserves role-specific navigation labels for %s', (role, labels) => {
        setViewportWidth(1280);
        renderDashboardLayout('Dashboard', '<p>Content</p>', role);
        labels.forEach((label) => expect(document.body.textContent).toContain(label));
    });

    it('preserves existing route dispatch imports and adds no unsafe file-opening surface', () => {
        expect(layoutSource).toContain("import('../dashboard/MahasiswaDashboard')");
        expect(layoutSource).toContain("import('../dashboard/TendikDashboard')");
        expect(layoutSource).toContain("import('../dashboard/AkademikDashboard')");
        expect(layoutSource).toContain("import('../superadmin/UserManagement')");
        expect(sidebarSource).not.toContain('window.open');
        expect(layoutSource).not.toContain('/api/storage');
        expect(layoutSource).not.toContain('/storage/');
    });
});
