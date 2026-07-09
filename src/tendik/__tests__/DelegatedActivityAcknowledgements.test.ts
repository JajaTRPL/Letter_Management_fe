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
    openDelegatedActivityAcknowledgements,
    renderDelegatedActivityDashboardCard,
} from '../DelegatedActivityAcknowledgements';
import type {
    DelegatedActivityAcknowledgement,
    DelegatedActivitySummary,
} from '../delegated-activity-types';
import apiSource from '../delegated-activity-api.ts?raw';
import uiSource from '../DelegatedActivityAcknowledgements.ts?raw';

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
    activity_summary: 'Laboran menyetujui kesiapan ruang praktikum.',
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
    escalated_at: null,
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
        can_acknowledge: true,
        can_mark_escalation_seen: false,
    },
    ...overrides,
});

const envelope = (
    items: DelegatedActivityAcknowledgement[],
    summary: DelegatedActivitySummary = {
        pending_count: 1,
        overdue_count: 1,
        oldest_due_at: '2026-07-10T08:00:00+07:00',
        acknowledged_count: 0,
        escalated_count: 0,
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
let acknowledgePayload = task({
    status: 'acknowledged',
    effective_status: 'acknowledged',
    is_overdue: false,
    acknowledged_at: '2026-07-10T09:00:00+07:00',
    acknowledged_by: {
        id: 12,
        name: 'Kepala Lab RPL',
        email: 'kalab@example.test',
        role: 'tendik',
        tendik_role: 'kepala_lab',
    },
    acknowledgement_note: 'Sudah saya tinjau.',
    labels: {
        status: 'Sudah Ditinjau',
        urgency: 'Mendesak',
        overdue: null,
    },
    permissions: {
        can_acknowledge: false,
        can_mark_escalation_seen: false,
    },
});
let acknowledgeStatus = 200;

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

const openAndLoad = async (): Promise<void> => {
    openDelegatedActivityAcknowledgements();
    await flush();
};

const openDetail = async (): Promise<void> => {
    document.querySelector<HTMLButtonElement>('[data-delegated-activity-detail="7"]')?.click();
    await flush();
};

beforeEach(() => {
    mount();
    m.apiFetch.mockReset();
    m.success.mockReset();
    m.error.mockReset();
    listPayload = envelope([task()]);
    detailPayload = task();
    acknowledgePayload = task({
        status: 'acknowledged',
        effective_status: 'acknowledged',
        is_overdue: false,
        acknowledged_at: '2026-07-10T09:00:00+07:00',
        acknowledged_by: {
            id: 12,
            name: 'Kepala Lab RPL',
            email: 'kalab@example.test',
            role: 'tendik',
            tendik_role: 'kepala_lab',
        },
        acknowledgement_note: 'Sudah saya tinjau.',
        labels: {
            status: 'Sudah Ditinjau',
            urgency: 'Mendesak',
            overdue: null,
        },
        permissions: {
            can_acknowledge: false,
            can_mark_escalation_seen: false,
        },
    });
    acknowledgeStatus = 200;
    m.apiFetch.mockImplementation(async (url: string, options: RequestInit = {}) => {
        const method = options.method ?? 'GET';
        if (method === 'POST') {
            return response(
                acknowledgeStatus === 200
                    ? { message: 'ok', data: acknowledgePayload }
                    : { message: 'Akun ini tidak dapat mengonfirmasi aktivitas delegasi.' },
                acknowledgeStatus,
            );
        }
        if (url === '/api/tendik/delegated-activity-acknowledgements/7') {
            return response({ message: 'ok', data: detailPayload });
        }

        return response(listPayload);
    });
});

describe('Delegated activity dashboard card rendering', () => {
    it('renders loading, ready counts, empty, and error card states', () => {
        mount(renderDelegatedActivityDashboardCard({ kind: 'loading' }));
        expect(document.body.textContent).toContain('Memuat ringkasan aktivitas delegasi');

        mount(renderDelegatedActivityDashboardCard({
            kind: 'ready',
            summary: {
                pending_count: 2,
                overdue_count: 1,
                oldest_due_at: '2026-07-10T08:00:00+07:00',
            },
        }));
        expect(document.body.textContent).toContain('Aktivitas Lab Perlu Ditinjau');
        expect(document.body.textContent).toContain('2');
        expect(document.body.textContent).toContain('1');

        mount(renderDelegatedActivityDashboardCard({ kind: 'empty' }));
        expect(document.body.textContent).toContain('Belum ada aktivitas delegasi yang perlu ditinjau.');

        mount(renderDelegatedActivityDashboardCard({ kind: 'error', message: 'Akses belum tersedia.' }));
        expect(document.body.textContent).toContain('Akses belum tersedia.');
    });
});

describe('Delegated activity acknowledgement drawer', () => {
    it('renders list, detail, overdue helper, escaped state summaries, and accessible controls', async () => {
        await openAndLoad();

        expect(document.querySelector('[data-delegated-activity-list-state="success"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Laboran menyetujui kesiapan ruang praktikum.');
        expect(document.body.textContent).toContain('Laboran Satu');
        expect(document.body.textContent).toContain('Melewati Batas Peninjauan');

        await openDetail();

        expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('delegated-activity-title');
        expect(document.getElementById('delegated-activity-close')?.getAttribute('aria-label')).toContain('Tutup');
        expect(document.body.textContent).toContain('Pastikan aktivitas operasional sudah sesuai');
        expect(document.body.textContent).toContain('Peninjauan ini melewati batas waktu yang disarankan.');
        expect(document.body.textContent).toContain('Kepala Lab RPL');
        expect(document.body.textContent).toContain('Room Booking Request #44');
        expect(document.body.textContent).toContain('"status": "submitted"');
        expect(document.body.textContent).toContain('"status": "ready"');
        expect(document.querySelector('label[for="delegated-activity-note"]')).not.toBeNull();
        expect(document.getElementById('delegated-activity-acknowledge')).not.toBeNull();
    });

    it('shows a calm empty state when no delegated activity exists', async () => {
        listPayload = envelope([], {
            pending_count: 0,
            overdue_count: 0,
            oldest_due_at: null,
            acknowledged_count: 0,
            escalated_count: 0,
        });

        await openAndLoad();

        expect(document.querySelector('[data-delegated-activity-list-state="empty"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Belum ada aktivitas delegasi');
    });

    it('posts acknowledgement, updates detail context, and shows success toast', async () => {
        mount(renderDelegatedActivityDashboardCard({
            kind: 'ready',
            summary: {
                pending_count: 1,
                overdue_count: 1,
                oldest_due_at: '2026-07-10T08:00:00+07:00',
            },
        }));
        await openAndLoad();
        await openDetail();

        const note = document.getElementById('delegated-activity-note') as HTMLTextAreaElement;
        note.value = 'Sudah saya tinjau.';
        document.getElementById('delegated-activity-acknowledge')?.click();
        expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
        document.getElementById('delegated-activity-confirm-submit')?.click();
        await flush();

        expect(m.apiFetch).toHaveBeenCalledWith(
            '/api/tendik/delegated-activity-acknowledgements/7/acknowledge',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ note: 'Sudah saya tinjau.' }),
            }),
        );
        expect(document.body.textContent).toContain('Sudah Ditinjau');
        expect(document.body.textContent).toContain('0');
        expect(m.success).toHaveBeenCalledWith('Aktivitas delegasi berhasil dikonfirmasi sudah ditinjau.');
    });

    it('does not allow acknowledgement when backend permissions deny it', async () => {
        detailPayload = task({
            permissions: {
                can_acknowledge: false,
                can_mark_escalation_seen: false,
            },
        });

        await openAndLoad();
        await openDetail();

        const button = document.getElementById('delegated-activity-acknowledge') as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        button.click();
        await flush();

        expect(m.apiFetch.mock.calls.some(([url, options]) =>
            String(url).endsWith('/acknowledge') && (options as RequestInit | undefined)?.method === 'POST',
        )).toBe(false);
        expect(document.body.textContent).toContain('Akun ini tidak memiliki izin konfirmasi');
    });

    it('renders a calm 403 acknowledgement error and keeps the drawer open', async () => {
        acknowledgeStatus = 403;

        await openAndLoad();
        await openDetail();
        document.getElementById('delegated-activity-acknowledge')?.click();
        document.getElementById('delegated-activity-confirm-submit')?.click();
        await flush();

        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Akun ini tidak dapat mengonfirmasi aktivitas delegasi.');
        expect(m.error).toHaveBeenCalledWith('Akun ini tidak dapat mengonfirmasi aktivitas delegasi.');
    });

    it('keeps the C6C surface away from unrelated integrations and unsafe display patterns', () => {
        expect(uiSource).not.toContain(`mark-${'escalation'}-seen`);
        expect(uiSource).not.toContain('Laboran operational');
        expect(uiSource).not.toContain(`/${'storage'}/`);
        expect(uiSource).not.toContain('room-' + 'booking-attachments');
        expect(uiSource).not.toContain('inner' + 'HTML');
        expect(uiSource).not.toContain('dangerouslySet' + 'InnerHTML');
        expect(uiSource).not.toContain('insertAdjacent' + 'HTML');
        expect(uiSource).not.toContain('eval' + '(');
        expect(uiSource).not.toContain('window' + '.open');
        expect(uiSource).not.toContain('if' + 'rame');
        expect(uiSource).not.toContain('src' + 'doc');
        expect(apiSource).not.toContain(`/${'storage'}/`);
        expect(apiSource).not.toContain('window' + '.open');
    });
});
