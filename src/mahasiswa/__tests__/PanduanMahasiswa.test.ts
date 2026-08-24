import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ renderDashboardLayout: vi.fn() }));

vi.mock('../../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: mocks.renderDashboardLayout,
}));

import { MAHASISWA_MANUAL_URL, renderPanduanMahasiswa } from '../PanduanMahasiswa';

describe('PanduanMahasiswa', () => {
    beforeEach(() => mocks.renderDashboardLayout.mockReset());

    it('renders the PDF preview and full-view actions', () => {
        renderPanduanMahasiswa();

        const [title, content, role, activePage] = mocks.renderDashboardLayout.mock.calls[0];
        expect(title).toBe('Panduan');
        expect(role).toBe('mahasiswa');
        expect(activePage).toBe('panduan');
        expect(content).toContain(`data="${MAHASISWA_MANUAL_URL}#view=FitH"`);
        expect(content).toContain('id="panduan-open-full"');
        expect(content).toContain('id="panduan-download"');
    });
});
