// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface ApiCall {
    url: string;
    method: string;
    body?: unknown;
}

const m = vi.hoisted(() => ({
    apiCalls: [] as ApiCall[],
    toasts: [] as string[],
}));

const policyValues = {
    supporting_document_retention_days: 14,
    intermediate_artifact_retention_days: 14,
    final_pdf_active_days: 30,
    archive_retention_days: 365,
};

const candidateRow = {
    letter_type: 'surat-tugas',
    application_id: 44,
    category: 'supporting_document',
    action: 'delete',
    subject_type: 'attachment',
    subject_id: 501,
    status: 'dry_run',
    eligible_at: '2026-06-10T02:00:00Z',
    error_code: null,
    verification_state: 'verified',
    checksum_sha256: 'a'.repeat(64),
    storage_path: '/storage/private/should-not-render.pdf',
    storage_disk: 'private-local',
};

const archiveRow = {
    id: 700,
    letter_type: 'surat-pengantar-magang',
    application_id: 45,
    phase: 'mahasiswa_review',
    version: 2,
    status: 'ready',
    retention_status: 'archived',
    archived_at: '2026-06-09T02:00:00Z',
    archive_purged_at: null,
    verification_state: 'verified',
    archive_checksum_sha256: 'b'.repeat(64),
    archive_path: '/storage/archive/should-not-render.pdf',
    archive_disk: 'archive-local',
};

const actionRow = {
    id: 900,
    letter_type: 'surat-permohonan-beasiswa',
    application_id: 46,
    category: 'final_official_pdf',
    action: 'archive',
    subject_type: 'artifact',
    subject_id: 800,
    status: 'failed',
    eligible_at: '2026-06-08T02:00:00Z',
    executed_at: '2026-06-08T03:00:00Z',
    created_at: '2026-06-08T03:00:00Z',
    error_code: 'checksum_mismatch',
    verification_state: 'verification_failed',
    checksum_sha256: 'c'.repeat(64),
    metadata: {
        trigger: 'manual',
        actor_id: 1,
        reason_present: true,
    },
    storage_path_hash: 'hidden-hash',
};

const jsonResponse = (payload: unknown, status = 200): Response => new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

const routePayload = (url: string, method: string): Response => {
    if (url.startsWith('/api/super-admin/retention/overview')) {
        return jsonResponse({
            data: {
                schema_ready: true,
                policy: {
                    schema_ready: true,
                    values: policyValues,
                    defaults: policyValues,
                    scope: 'global',
                    scheduler: { enabled: false, source: 'config', api_managed: false },
                },
                candidates: {
                    total: 7,
                    by_category: { supporting_document: 3, intermediate_artifact: 1, final_official_pdf: 2, archived_final_pdf: 1 },
                },
                archives: { available: 2, purged: 1 },
                actions: { total: 5, by_status: { failed: 1, completed: 4 } },
                scheduler: { enabled: false, source: 'config', api_managed: false },
            },
        });
    }
    if (url.startsWith('/api/super-admin/retention/policy') && method === 'GET') {
        return jsonResponse({
            data: {
                schema_ready: true,
                values: policyValues,
                defaults: policyValues,
                scope: 'global',
                scheduler: { enabled: false, source: 'config', api_managed: false },
            },
        });
    }
    if (url.startsWith('/api/super-admin/retention/policy') && method === 'PUT') {
        return jsonResponse({
            data: {
                schema_ready: true,
                values: { ...policyValues, supporting_document_retention_days: 21 },
                defaults: policyValues,
                scope: 'global',
                scheduler: { enabled: false, source: 'config', api_managed: false },
            },
        });
    }
    if (url.startsWith('/api/super-admin/retention/candidates')) {
        return jsonResponse({
            data: [candidateRow],
            meta: { current_page: 1, per_page: 10, total: 11, last_page: 2, truncated: false },
        });
    }
    if (url.startsWith('/api/super-admin/retention/archives')) {
        if (url.endsWith('/restore') || url.endsWith('/purge')) return jsonResponse({ data: candidateRow });
        return jsonResponse({
            data: [archiveRow],
            meta: { current_page: 1, per_page: 10, total: 1, last_page: 1 },
        });
    }
    if (url.startsWith('/api/super-admin/retention/actions')) {
        return jsonResponse({
            data: [actionRow],
            meta: { current_page: 1, per_page: 10, total: 1, last_page: 1 },
        });
    }
    if (url.startsWith('/api/super-admin/retention/dry-run')) {
        return jsonResponse({
            data: {
                schema_ready: true,
                total: 1,
                counts_by_status: { dry_run: 1 },
                actions: [candidateRow],
            },
        });
    }
    if (url.startsWith('/api/super-admin/retention/execute')) {
        return jsonResponse({ data: { ...candidateRow, status: 'completed' } });
    }

    return jsonResponse({ data: {} }, 404);
};

vi.mock('../../../shared/api-client', () => ({
    apiFetch: vi.fn(async (url: string, options: { method?: string; body?: unknown } = {}) => {
        const method = options.method ?? 'GET';
        m.apiCalls.push({ url, method, body: options.body });
        return routePayload(url, method);
    }),
    loadProtectedImageObjectUrl: vi.fn(async () => null),
    revokeProtectedImageObjectUrl: vi.fn(),
}));

vi.mock('toastify-js', () => ({
    default: vi.fn((options: { text?: string; node?: HTMLElement }) => ({
        showToast: () => {
            m.toasts.push(options.text ?? options.node?.textContent ?? '');
            return { toastElement: document.createElement('div') };
        },
    })),
}));

import sidebarSource from '../../../components/Sidebar.ts?raw';
import dashboardLayoutSource from '../../../dashboard/DashboardLayout.ts?raw';
import peminjamanSource from '../../../mahasiswa/PeminjamanRuangan.ts?raw';
import retentionApiSource from '../api.ts?raw';
import retentionPanelSource from '../../RetentionControlPanel.ts?raw';
import { renderSidebar } from '../../../components/Sidebar';
import { renderDashboardLayout } from '../../../dashboard/DashboardLayout';
import { renderRetentionControlPanel } from '../../RetentionControlPanel';

const resetDom = (): void => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('auth_name', 'Super Admin');
};

const waitFor = async (assertion: () => void): Promise<void> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
            assertion();
            return;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
    throw lastError;
};

const bodyOf = (call: ApiCall): Record<string, unknown> => JSON.parse(String(call.body ?? '{}')) as Record<string, unknown>;

beforeEach(() => {
    resetDom();
    m.apiCalls = [];
    m.toasts = [];
});

describe('Super Admin retention control panel', () => {
    it('shows the retention menu only for Super Admin and leaves Peminjaman untouched', () => {
        expect(renderSidebar('super_admin')).toContain('sidebar-retention-link');
        expect(renderSidebar('super_admin')).toContain('Retensi & Arsip Surat');
        expect(renderSidebar('mahasiswa')).not.toContain('sidebar-retention-link');
        expect(renderSidebar('tendik_persuratan')).not.toContain('sidebar-retention-link');
        expect(renderSidebar('akademik')).not.toContain('sidebar-retention-link');
        expect(renderSidebar('mahasiswa')).toContain('sidebar-peminjaman-link');
        expect(peminjamanSource).not.toContain('retention');
    });

    it('wires the sidebar route to the retention page through the existing dashboard dispatcher', async () => {
        renderDashboardLayout('Dashboard', '<p>awal</p>', 'super_admin');
        document.getElementById('sidebar-retention-link')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        await waitFor(() => {
            expect(document.body.textContent).toContain('Kebijakan Global');
            expect(document.body.textContent).toContain('Archive Pool');
        });

        expect(m.apiCalls.some((call) => call.url === '/api/super-admin/retention/overview')).toBe(true);
    });

    it('renders overview, policy, candidates, archives, and audit actions from safe metadata only', async () => {
        await renderRetentionControlPanel();

        const text = document.body.textContent ?? '';
        expect(text).toContain('Retensi & Arsip Surat');
        expect(text).toContain('Kandidat Retensi');
        expect(text).toContain('Archive Pool');
        expect(text).toContain('Audit Actions');
        expect(text).toContain('surat-tugas #44');
        expect(text).toContain('surat-pengantar-magang #45');
        expect(text).toContain('checksum_mismatch');
        expect(text).toContain('Terverifikasi');
        expect(text).toContain('Gagal verifikasi');
        expect((document.getElementById('retention-policy-supporting_document_retention_days') as HTMLInputElement).value).toBe('14');

        const html = document.body.innerHTML;
        for (const token of [
            '/storage/private',
            '/storage/archive',
            'attachment://',
            'private-local',
            'archive-local',
            'storage_path',
            'storage_disk',
            'archive_path',
            'archive_disk',
            'checksum_sha256',
            'archive_checksum_sha256',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            '/api/storage',
        ]) {
            expect(html).not.toContain(token);
        }
        expect(html).not.toContain('Checksum');
        expect(document.getElementById('retention-scheduler-toggle')).toBeNull();
        expect(html).not.toContain('pause');
        expect(html).not.toContain('resume');
    });

    it('updates the global policy through PUT with validated day values', async () => {
        await renderRetentionControlPanel();
        const input = document.getElementById('retention-policy-supporting_document_retention_days') as HTMLInputElement;
        input.value = '21';
        document.getElementById('retention-policy-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        await waitFor(() => {
            const call = m.apiCalls.find((entry) => entry.url === '/api/super-admin/retention/policy' && entry.method === 'PUT');
            expect(call).toBeDefined();
            expect(bodyOf(call!).supporting_document_retention_days).toBe(21);
        });
    });

    it('supports candidate filter pagination and manual dry-run wiring', async () => {
        await renderRetentionControlPanel();

        (document.getElementById('retention-candidate-category') as HTMLSelectElement).value = 'supporting_document';
        (document.getElementById('retention-candidate-letter-type') as HTMLInputElement).value = 'surat-tugas';
        (document.getElementById('retention-candidate-application-id') as HTMLInputElement).value = '44';
        document.getElementById('retention-candidate-filter')?.click();

        await waitFor(() => {
            expect(m.apiCalls.some((call) => call.url.includes('/candidates?letter_type=surat-tugas&application_id=44&category=supporting_document'))).toBe(true);
        });

        document.getElementById('retention-dry-run-button')?.click();
        await waitFor(() => {
            const call = m.apiCalls.find((entry) => entry.url === '/api/super-admin/retention/dry-run');
            expect(call).toBeDefined();
            expect(bodyOf(call!).category).toBe('supporting_document');
        });

        document.querySelector<HTMLButtonElement>('[data-retention-page="candidate"][data-page="2"]')?.click();
        await waitFor(() => {
            expect(m.apiCalls.some((call) => call.url.includes('/candidates?letter_type=surat-tugas&application_id=44&category=supporting_document&page=2'))).toBe(true);
        });
    });

    it('requires explicit reasons before execute, restore, and purge requests are sent', async () => {
        await renderRetentionControlPanel();

        document.querySelector<HTMLButtonElement>('[data-retention-action="execute"]')?.click();
        document.getElementById('retention-modal-confirm')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(m.apiCalls.some((call) => call.url === '/api/super-admin/retention/execute')).toBe(false);
        expect(m.toasts.some((toast) => toast.includes('Alasan aksi retensi minimal 10 karakter.'))).toBe(true);

        document.getElementById('retention-modal-cancel')?.click();
        document.querySelector<HTMLButtonElement>('[data-retention-action="restore"]')?.click();
        document.getElementById('retention-modal-confirm')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(m.apiCalls.some((call) => call.url.endsWith('/restore'))).toBe(false);

        document.getElementById('retention-modal-cancel')?.click();
        document.querySelector<HTMLButtonElement>('[data-retention-action="purge"]')?.click();
        document.getElementById('retention-modal-confirm')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(m.apiCalls.some((call) => call.url.endsWith('/purge'))).toBe(false);
    });

    it('keeps retention code bounded to existing routes and avoids duplicate backend or storage fallbacks', () => {
        expect(sidebarSource).toContain('sidebar-retention-link');
        expect(dashboardLayoutSource).toContain("../superadmin/RetentionControlPanel");
        expect(retentionApiSource).toContain('/api/super-admin/retention');
        expect(retentionApiSource).not.toContain('/api/storage');
        expect(retentionPanelSource).not.toContain('/api/storage');
        expect(retentionPanelSource).not.toContain('/storage/');
        expect(retentionPanelSource).not.toContain('checksum_sha256');
        expect(retentionPanelSource).not.toContain('archive_checksum_sha256');
        expect(retentionPanelSource).not.toContain('formatChecksum');
        expect(retentionPanelSource).not.toContain('scheduler-toggle');
        expect(retentionPanelSource).not.toContain('setInterval');
        expect(retentionPanelSource.match(/RetentionControlPanel/g)?.length ?? 0).toBeGreaterThan(0);
    });
});
