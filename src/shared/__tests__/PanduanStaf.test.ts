// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ renderDashboardLayout: vi.fn() }));

vi.mock('../../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: mocks.renderDashboardLayout,
}));

import { PEJABAT_AKADEMIK_MANUAL_URL, SARPRAS_MANUAL_URL, TENDIK_PERSURATAN_MANUAL_URL, renderPanduanStaf } from '../PanduanStaf';
import { renderSidebar } from '../../components/Sidebar';

describe('PanduanStaf', () => {
    beforeEach(() => {
        mocks.renderDashboardLayout.mockReset();
        localStorage.clear();
    });

    it('shows the Pejabat Akademik chapter to academic roles', () => {
        renderPanduanStaf('kaprodi');
        const [title, content, role, activePage] = mocks.renderDashboardLayout.mock.calls[0];
        expect(title).toBe('Panduan');
        expect(role).toBe('kaprodi');
        expect(activePage).toBe('panduan');
        expect(content).toContain(`data="${PEJABAT_AKADEMIK_MANUAL_URL}#view=FitH"`);
        expect(content).not.toContain(TENDIK_PERSURATAN_MANUAL_URL);
    });

    it('shows the Tenaga Kependidikan chapter to Tendik', () => {
        renderPanduanStaf('tendik');
        const [, content] = mocks.renderDashboardLayout.mock.calls[0];
        expect(content).toContain(`data="${TENDIK_PERSURATAN_MANUAL_URL}#view=FitH"`);
        expect(content).not.toContain(PEJABAT_AKADEMIK_MANUAL_URL);
    });

    it('shows the Sarpras guide to Tendik Sarpras', () => {
        localStorage.setItem('auth_tendik_role', 'sarpras');
        renderPanduanStaf('tendik');
        const [, content] = mocks.renderDashboardLayout.mock.calls[0];
        expect(content).toContain(`data="${SARPRAS_MANUAL_URL}#view=FitH"`);
        expect(content).not.toContain(TENDIK_PERSURATAN_MANUAL_URL);
    });

    it('puts the Panduan menu right under Dashboard for Akademik and Tendik Persuratan only', () => {
        const akademik = renderSidebar('kadep');
        expect(akademik).toContain('id="sidebar-panduan-staf-link"');
        expect(akademik.indexOf('sidebar-dashboard-link')).toBeLessThan(akademik.indexOf('sidebar-panduan-staf-link'));
        expect(akademik.indexOf('sidebar-panduan-staf-link')).toBeLessThan(akademik.indexOf('sidebar-dokumen-akademik-link'));

        localStorage.setItem('auth_tendik_role', 'persuratan');
        expect(renderSidebar('tendik')).toContain('id="sidebar-panduan-staf-link"');

        localStorage.setItem('auth_tendik_role', 'sarpras');
        expect(renderSidebar('tendik')).toContain('id="sidebar-panduan-staf-link"');

        localStorage.setItem('auth_tendik_role', 'laboran');
        expect(renderSidebar('tendik')).not.toContain('sidebar-panduan-staf-link');
        localStorage.setItem('auth_tendik_role', 'kepala_lab');
        expect(renderSidebar('tendik')).not.toContain('sidebar-panduan-staf-link');

        expect(renderSidebar('mahasiswa')).not.toContain('sidebar-panduan-staf-link');
        expect(renderSidebar('super_admin')).not.toContain('sidebar-panduan-staf-link');
    });
});
