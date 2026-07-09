// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    renderLayout: vi.fn(),
}));

const fragment = (markup: string): DocumentFragment => document.createRange().createContextualFragment(markup);

vi.mock('../../shared/api-client', () => ({
    apiFetch: m.apiFetch,
}));

vi.mock('../../shared/toast', () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
}));

vi.mock('../DashboardLayout', () => ({
    renderDashboardLayout: (
        title: string,
        content: string,
        role: string,
        activePage?: string,
    ) => {
        m.renderLayout(title, content, role, activePage);
        document.body.replaceChildren(fragment(content));
    },
}));

import { renderAdminDashboard } from '../AdminDashboard';

const response = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const dashboardStats = () => ({
    user_counts: {
        mahasiswa: 8,
        tendik: 4,
        akademik: 2,
        super_admin: 1,
        total: 15,
    },
    status_distribution: {
        active: { count: 12 },
        suspended: { count: 1 },
        pending: { count: 2 },
    },
    activity_stats: {
        labels: ['8 Jul', '9 Jul'],
        data: [3, 4],
    },
    scholarship_stats: {
        labels: ['8 Jul', '9 Jul'],
        data: [1, 2],
    },
    approval_durations: {
        tendik: { days: 0, hours: 2, minutes: 10 },
        akademik: { days: 0, hours: 1, minutes: 20 },
    },
});

const delegatedList = (summary = {
    pending_count: 4,
    overdue_count: 2,
    oldest_due_at: '2026-07-10T08:00:00+07:00',
    acknowledged_count: 0,
    escalated_count: 1,
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

const configureApi = (delegatedStatus = 200): void => {
    m.apiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/super-admin/dashboard/stats') {
            return response(dashboardStats());
        }
        if (url.startsWith('/api/super-admin/delegated-activity-acknowledgements')) {
            if (delegatedStatus === 403) {
                return response({ message: 'Monitoring aktivitas delegasi belum tersedia.' }, 403);
            }

            return delegatedList();
        }

        return response({});
    });
};

beforeEach(() => {
    document.body.replaceChildren();
    m.apiFetch.mockReset();
    m.renderLayout.mockReset();
    configureApi();
});

afterEach(() => {
    (window as unknown as { clearDashboardInterval?: () => void }).clearDashboardInterval?.();
});

describe('SuperAdmin dashboard delegated activity card', () => {
    it('renders the monitoring card, loading state, and hydrated counts', async () => {
        await renderAdminDashboard();

        expect(document.body.textContent).toContain('Aktivitas Lab Belum Ditinjau');
        expect(document.body.textContent).toContain('Memuat ringkasan aktivitas delegasi');

        await flush();

        expect(document.querySelector('[data-superadmin-delegated-activity-card-state="ready"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Perlu Atensi SuperAdmin');
        expect(document.body.textContent).toContain('Pantau Aktivitas');
        expect(document.body.textContent).toContain('4');
        expect(document.body.textContent).toContain('2');
        expect(document.body.textContent).toContain('1');
    });

    it('opens the monitoring drawer from the dashboard card', async () => {
        configureApi(200);
        await renderAdminDashboard();
        await flush();

        document.getElementById('superadmin-delegated-activity-open')?.click();
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Monitoring Aktivitas Lab Belum Ditinjau');
        await flush();
        expect(document.querySelector('[data-superadmin-delegated-activity-list-state="empty"]')).not.toBeNull();
    });

    it('renders a calm dashboard card error when monitoring access is denied', async () => {
        configureApi(403);

        await renderAdminDashboard();
        await flush();

        expect(document.body.textContent).toContain('Monitoring aktivitas delegasi belum tersedia.');
        expect(document.body.textContent).not.toContain('Gagal memuat statistik dashboard');
    });
});
