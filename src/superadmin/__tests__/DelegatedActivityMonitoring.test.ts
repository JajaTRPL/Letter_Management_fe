// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
}));

vi.mock('../../shared/api-client', () => ({
    apiFetch: m.apiFetch,
}));

vi.mock('../../shared/toast', () => ({
    showSuccess: m.success,
    showError: m.error,
    showWarning: vi.fn(),
    showInfo: vi.fn(),
}));

import {
    openSuperAdminDelegatedActivityMonitoring,
    renderSuperAdminDelegatedActivityDashboardCard,
} from '../DelegatedActivityMonitoring';
import type {
    DelegatedActivityAcknowledgement,
    DelegatedActivitySummary,
} from '../../shared/delegated-activity-types';
import apiSource from '../../shared/delegated-activity-api.ts?raw';
import uiSource from '../DelegatedActivityMonitoring.ts?raw';

const fragment = (markup: string): DocumentFragment => document.createRange().createContextualFragment(markup);

const mount = (markup = ''): void => {
    document.body.replaceChildren(fragment(markup));
};

const response = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const task = (overrides: Partial<DelegatedActivityAcknowledgement> = {}): DelegatedActivityAcknowledgement => ({
    id: 7,
    domain_type: 'room_booking',
    subject_type: 'room_booking_request',
    subject_id: 44,
    delegated_actor: {
        id: 11,
        name: 'Laboran Satu',
        email: 'laboran@example.test',
        role: 'tendik',
        tendik_role: 'laboran',
    },
    accountable_user: {
        id: 12,
        name: 'Kepala Lab RPL',
        email: 'kalab@example.test',
        role: 'tendik',
        tendik_role: 'kepala_lab',
    },
    accountable_role: 'kepala_lab',
    represented_scope_type: 'laboratory',
    represented_scope_id: 2,
    activity_type: 'room_booking_review',
    activity_summary: 'Laboran menyelesaikan pengecekan kesiapan ruang praktikum.',
    internal_note: 'Catatan internal aman.',
    student_facing_note: 'Mahasiswa sudah menerima pembaruan.',
    before_state: { status: 'submitted', room: 'Lab RPL' },
    after_state: { status: 'ready', room: 'Lab RPL' },
    status: 'pending_review',
    effective_status: 'overdue',
    urgency: 'urgent',
    performed_at: '2026-07-09T08:00:00+07:00',
    acknowledgement_due_at: '2026-07-10T08:00:00+07:00',
    is_overdue: true,
    overdue_days: 1,
    overdue_hours: 26,
    acknowledged_at: null,
    acknowledged_by: null,
    acknowledgement_note: null,
    escalated_at: '2026-07-10T09:00:00+07:00',
    escalation_seen_by_superadmin_at: null,
    status_label: 'Menunggu Peninjauan Kepala Lab',
    urgency_label: 'Mendesak',
    overdue_label: 'Melewati Batas Peninjauan',
    labels: {
        status: 'Menunggu Peninjauan Kepala Lab',
        urgency: 'Mendesak',
        overdue: 'Melewati Batas Peninjauan',
    },
    permissions: {
        can_acknowledge: false,
        can_mark_escalation_seen: true,
    },
    ...overrides,
});

const envelope = (
    items: DelegatedActivityAcknowledgement[],
    summary: DelegatedActivitySummary = {
        pending_count: 2,
        overdue_count: 1,
        oldest_due_at: '2026-07-10T08:00:00+07:00',
        acknowledged_count: 0,
        escalated_count: 1,
    },
) => ({
    message: 'ok',
    data: items,
    meta: {
        current_page: 1,
        per_page: 10,
        total: items.length,
        last_page: 1,
        summary,
    },
});

let listPayload = envelope([task()]);
let detailPayload = task();
let markSeenPayload = task({
    escalation_seen_by_superadmin_at: '2026-07-10T10:30:00+07:00',
    permissions: {
        can_acknowledge: false,
        can_mark_escalation_seen: false,
    },
});
let markSeenStatus = 200;

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

const openAndLoad = async (): Promise<void> => {
    openSuperAdminDelegatedActivityMonitoring();
    await flush();
};

const openDetail = async (): Promise<void> => {
    document.querySelector<HTMLButtonElement>('[data-superadmin-delegated-activity-detail="7"]')?.click();
    await flush();
};

beforeEach(() => {
    mount();
    m.apiFetch.mockReset();
    m.success.mockReset();
    m.error.mockReset();
    listPayload = envelope([task()]);
    detailPayload = task();
    markSeenPayload = task({
        escalation_seen_by_superadmin_at: '2026-07-10T10:30:00+07:00',
        permissions: {
            can_acknowledge: false,
            can_mark_escalation_seen: false,
        },
    });
    markSeenStatus = 200;
    m.apiFetch.mockImplementation(async (url: string, options: RequestInit = {}) => {
        const method = options.method ?? 'GET';
        if (method === 'POST') {
            return response(
                markSeenStatus === 200
                    ? { message: 'ok', data: markSeenPayload }
                    : { message: 'Akun ini tidak dapat menandai atensi aktivitas delegasi.' },
                markSeenStatus,
            );
        }
        if (url === '/api/super-admin/delegated-activity-acknowledgements/7') {
            return response({ message: 'ok', data: detailPayload });
        }

        return response(listPayload);
    });
});

describe('SuperAdmin delegated activity dashboard card rendering', () => {
    it('renders loading, ready counts, empty, and error card states', () => {
        mount(renderSuperAdminDelegatedActivityDashboardCard({ kind: 'loading' }));
        expect(document.body.textContent).toContain('Memuat ringkasan aktivitas delegasi');

        mount(renderSuperAdminDelegatedActivityDashboardCard({
            kind: 'ready',
            summary: {
                pending_count: 4,
                overdue_count: 2,
                oldest_due_at: '2026-07-10T08:00:00+07:00',
                acknowledged_count: 0,
                escalated_count: 1,
            },
        }));
        expect(document.body.textContent).toContain('Aktivitas Lab Belum Ditinjau');
        expect(document.body.textContent).toContain('Perlu Atensi SuperAdmin');
        expect(document.body.textContent).toContain('4');
        expect(document.body.textContent).toContain('2');
        expect(document.body.textContent).toContain('1');

        mount(renderSuperAdminDelegatedActivityDashboardCard({ kind: 'empty' }));
        expect(document.body.textContent).toContain('Belum ada aktivitas delegasi yang melewati batas peninjauan');

        mount(renderSuperAdminDelegatedActivityDashboardCard({ kind: 'error', message: 'Akses monitoring belum tersedia.' }));
        expect(document.body.textContent).toContain('Akses monitoring belum tersedia.');
    });
});

describe('SuperAdmin delegated activity monitoring drawer', () => {
    it('renders list, detail, accountability context, overdue helper, and accessible controls', async () => {
        await openAndLoad();

        expect(document.querySelector('[data-superadmin-delegated-activity-list-state="success"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Laboran menyelesaikan pengecekan kesiapan ruang praktikum.');
        expect(document.body.textContent).toContain('Laboran Satu');
        expect(document.body.textContent).toContain('Kepala Lab RPL');
        expect(document.body.textContent).toContain('Melewati Batas Peninjauan');

        await openDetail();

        expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('superadmin-delegated-activity-title');
        expect(document.getElementById('superadmin-delegated-activity-close')?.getAttribute('aria-label')).toContain('Tutup');
        expect(document.body.textContent).toContain('SuperAdmin dapat memantau aktivitas ini');
        expect(document.body.textContent).toContain('Aktivitas ini melewati batas waktu peninjauan yang disarankan.');
        expect(document.body.textContent).toContain('Room Booking Request #44');
        expect(document.body.textContent).toContain('"status": "submitted"');
        expect(document.body.textContent).toContain('"status": "ready"');
        expect(document.body.textContent).toContain('Belum ditinjau Kepala Lab');
        expect(document.getElementById('superadmin-delegated-activity-mark-seen')).not.toBeNull();
        expect(document.getElementById('delegated-activity-acknowledge')).toBeNull();
        expect(document.body.textContent).not.toContain('Konfirmasi Sudah Ditinjau');
    });

    it('shows a calm empty state when there are no attention items', async () => {
        listPayload = envelope([], {
            pending_count: 0,
            overdue_count: 0,
            oldest_due_at: null,
            acknowledged_count: 0,
            escalated_count: 0,
        });

        await openAndLoad();

        expect(document.querySelector('[data-superadmin-delegated-activity-list-state="empty"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Belum ada aktivitas yang perlu atensi');
    });

    it('posts mark seen, updates detail context, and shows success toast', async () => {
        mount(renderSuperAdminDelegatedActivityDashboardCard({
            kind: 'ready',
            summary: {
                pending_count: 1,
                overdue_count: 1,
                oldest_due_at: '2026-07-10T08:00:00+07:00',
                acknowledged_count: 0,
                escalated_count: 1,
            },
        }));
        await openAndLoad();
        await openDetail();

        document.getElementById('superadmin-delegated-activity-mark-seen')?.click();
        expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
        document.getElementById('superadmin-delegated-activity-confirm-submit')?.click();
        await flush();

        expect(m.apiFetch).toHaveBeenCalledWith(
            '/api/super-admin/delegated-activity-acknowledgements/7/mark-escalation-seen',
            expect.objectContaining({ method: 'POST' }),
        );
        expect(document.body.textContent).toContain('Atensi sudah dilihat pada');
        expect(m.success).toHaveBeenCalledWith('Atensi SuperAdmin berhasil ditandai sudah dilihat.');
    });

    it('does not show mark seen when backend permissions deny it', async () => {
        detailPayload = task({
            permissions: {
                can_acknowledge: false,
                can_mark_escalation_seen: false,
            },
        });

        await openAndLoad();
        await openDetail();

        expect(document.getElementById('superadmin-delegated-activity-mark-seen')).toBeNull();
        expect(document.body.textContent).toContain('Akun ini tidak memiliki izin menandai atensi');
        expect(m.apiFetch.mock.calls.some(([url, options]) =>
            String(url).endsWith('/mark-escalation-seen') && (options as RequestInit | undefined)?.method === 'POST',
        )).toBe(false);
    });

    it('renders a calm 403 mark-seen error and keeps the drawer open', async () => {
        markSeenStatus = 403;

        await openAndLoad();
        await openDetail();
        document.getElementById('superadmin-delegated-activity-mark-seen')?.click();
        document.getElementById('superadmin-delegated-activity-confirm-submit')?.click();
        await flush();

        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Akun ini tidak dapat menandai atensi aktivitas delegasi.');
        expect(m.error).toHaveBeenCalledWith('Akun ini tidak dapat menandai atensi aktivitas delegasi.');
    });

    it('keeps the SuperAdmin surface away from unrelated integrations and unsafe display patterns', () => {
        expect(uiSource).not.toContain('Konfirmasi Sudah Ditinjau');
        expect(uiSource).not.toContain('Laboran operational');
        expect(uiSource).not.toContain('Sekprodi');
        expect(uiSource).not.toContain('Sekdep');
        expect(uiSource).not.toContain(`/${'storage'}/`);
        expect(uiSource).not.toContain('room-' + 'booking-attachments');
        expect(uiSource).not.toContain('inner' + 'HTML');
        expect(uiSource).not.toContain('dangerouslySet' + 'Inner' + 'HTML');
        expect(uiSource).not.toContain('insertAdjacent' + 'HTML');
        expect(uiSource).not.toContain('eval' + '(');
        expect(uiSource).not.toContain('window' + '.open');
        expect(uiSource).not.toContain('if' + 'rame');
        expect(uiSource).not.toContain('src' + 'doc');
        expect(apiSource).toContain('/api/super-admin/delegated-activity-acknowledgements');
        expect(apiSource).not.toContain(`/${'storage'}/`);
        expect(apiSource).not.toContain('window' + '.open');
    });
});
