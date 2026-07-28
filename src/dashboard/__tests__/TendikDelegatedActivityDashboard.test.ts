// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    renderLayout: vi.fn(),
}));

const fragment = (markup: string): DocumentFragment => document.createRange().createContextualFragment(markup);

vi.mock('../../shared/api-client', () => ({
    apiFetch: m.apiFetch,
    loadProtectedImageObjectUrl: vi.fn(async () => null),
    revokeProtectedImageObjectUrl: vi.fn(),
}));

vi.mock('../../shared/toast', () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
}));

vi.mock('../../shared/protected-pdf-viewer', () => ({
    renderProtectedPdfViewer: () => '<div data-protected-pdf-viewer></div>',
    attachProtectedPdfViewer: () => () => undefined,
}));

vi.mock('../DashboardLayout', () => ({
    renderDashboardLayout: (
        title: string,
        content: string,
        role: string,
        activePage: string,
    ) => {
        m.renderLayout(title, content, role, activePage);
        document.body.replaceChildren(fragment(content));
    },
}));

import { renderTendikDashboard } from '../TendikDashboard';

const response = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const delegatedList = (summary = {
    pending_count: 3,
    overdue_count: 1,
    oldest_due_at: '2026-07-10T08:00:00+07:00',
    acknowledged_count: 0,
    escalated_count: 0,
}) => response({
    message: 'ok',
    data: [],
    meta: {
        current_page: 1,
        per_page: 10,
        total: 0,
        last_page: 1,
        summary,
    },
});

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

const configureBaseApi = (delegatedStatus = 200): void => {
    m.apiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/tendik/dashboard/tasks') {
            return response({
                stats: {
                    total_incoming: 0,
                    needs_verification: 0,
                    finished_this_month: 0,
                },
                tasks: [],
            });
        }
        if (url === '/api/profile') {
            return response({
                user: {
                    id: 5,
                    name: 'Kepala Lab',
                    assigned_tasks: [],
                    tendik_role: localStorage.getItem('auth_tendik_role'),
                },
            });
        }
        if (url === '/api/tendik/riwayat?scope=mine') {
            return response({ tasks: [] });
        }
        // Sarpras / Kepala Lab / Laboran now render the peminjaman dashboard,
        // which reads the booking feed instead of the letter one.
        if (url.startsWith('/api/tendik/peminjaman-ruangan/dashboard')) {
            return response({ data: {
                role: localStorage.getItem('auth_tendik_role'),
                role_label: 'Kepala Laboratorium',
                scope_label: 'LAB-01 · Lab Uji',
                stats: { actionable: 0, overdue: 0, finished_this_month: 0 },
                actionable: [],
                awareness: [],
                today: [],
                history: [],
            } });
        }
        if (url.startsWith('/api/tendik/review-performance/me')) {
            return response({ data: { eligible: false, reason_label: '-' } });
        }
        if (url.startsWith('/api/tendik/delegated-activity-acknowledgements')) {
            if (delegatedStatus === 403) {
                return response({
                    message: 'Hanya Kepala Lab yang dapat mengakses peninjauan aktivitas delegasi.',
                }, 403);
            }

            return delegatedList();
        }

        return response({});
    });
};

beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    localStorage.setItem('auth_name', 'Kepala Lab');
    localStorage.setItem('auth_tendik_role', 'kepala_lab');
    m.apiFetch.mockReset();
    m.renderLayout.mockReset();
    configureBaseApi();
});

describe('Tendik dashboard delegated activity card', () => {
    it('renders the Kepala Lab card, loading state, and hydrated counts', async () => {
        await renderTendikDashboard('tendik');

        expect(document.body.textContent).toContain('Aktivitas Lab Perlu Ditinjau');
        expect(document.body.textContent).toContain('Memuat ringkasan aktivitas delegasi');

        await flush();

        expect(document.querySelector('[data-delegated-activity-card-state="ready"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Menunggu Peninjauan Kepala Lab');
        expect(document.body.textContent).toContain('3');
        expect(document.body.textContent).toContain('1');
    });

    it('hides the card for non-Kepala Lab Tendik roles and avoids the delegated endpoint', async () => {
        localStorage.setItem('auth_tendik_role', 'sarpras');
        await renderTendikDashboard('tendik');
        await flush();

        expect(document.body.textContent).not.toContain('Aktivitas Lab Perlu Ditinjau');
        expect(m.apiFetch.mock.calls.some(([url]) =>
            String(url).startsWith('/api/tendik/delegated-activity-acknowledgements'),
        )).toBe(false);
    });

    it('renders a calm dashboard card error when the delegated endpoint returns 403', async () => {
        configureBaseApi(403);

        await renderTendikDashboard('tendik');
        await flush();

        expect(document.body.textContent).toContain('Hanya Kepala Lab yang dapat mengakses peninjauan aktivitas delegasi.');
        expect(document.body.textContent).not.toContain('Gagal Memuat Data');
    });

    it('opens the acknowledgement drawer from the dashboard card', async () => {
        await renderTendikDashboard('tendik');
        await flush();

        document.getElementById('delegated-activity-open')?.click();
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Aktivitas Lab Perlu Ditinjau');
        await flush();
        expect(document.querySelector('[data-delegated-activity-list-state="empty"]')).not.toBeNull();
    });
});
