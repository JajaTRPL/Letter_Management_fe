// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
}));

vi.mock('../../shared/api-client', () => ({ apiFetch: m.apiFetch }));
vi.mock('../../shared/toast', () => ({ showSuccess: m.showSuccess, showError: m.showError }));

const jsonResponse = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

const policy = (scope: string, label: string, enabled = false, warn = 5, over = 7, esc = 9) => ({
    scope,
    scope_label: label,
    enabled,
    thresholds: {
        warning_minutes: warn * 1440,
        overdue_minutes: over * 1440,
        escalation_minutes: esc * 1440,
    },
    explanation: {
        subject: 'Permohonan yang belum diperiksa',
        reviewer: 'Tim Reviewer',
        escalates_to: 'SuperAdmin',
        warning: 'Pemeriksa mulai diingatkan…',
        overdue: 'Dianggap terlambat…',
        escalation: 'Naik ke SuperAdmin…',
        effect: 'Berlaku untuk permohonan baru dan yang masih menunggu.',
    },
    bounds: { min_minutes: 5, max_minutes: 43200 },
    audit: { updated_by: null, updated_at: null, enabled_updated_by: null, enabled_at: null, disabled_at: null },
});

const labelFor = (scope: string) => (scope === 'room_booking' ? 'Peminjaman Ruangan' : 'Surat Administrasi');
const scopeOf = (url: string) => (url.includes('room_booking') ? 'room_booking' : 'letter');

let mod: typeof import('../sla-governance');

beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '';
    Object.values(m).forEach((fn) => fn.mockReset());
    m.apiFetch.mockImplementation(async (url: string, opts?: { method?: string; body?: string }) => {
        const scope = scopeOf(url);
        if (opts?.method === 'PUT') {
            const body = JSON.parse(opts.body ?? '{}');
            return jsonResponse({ data: policy(scope, labelFor(scope), Boolean(body.enabled)) });
        }
        return jsonResponse({ data: policy(scope, labelFor(scope)) });
    });
    mod = await import('../sla-governance');
});

async function mount(): Promise<void> {
    document.body.innerHTML = mod.slaGovernanceShell();
    await mod.hydrateSlaGovernance();
}

describe('SLA governance section', () => {
    it('renders one clearly-labelled card per workflow domain', async () => {
        await mount();

        expect(document.querySelector('[data-sla-card="room_booking"]')).not.toBeNull();
        expect(document.querySelector('[data-sla-card="letter"]')).not.toBeNull();
        expect(document.body.textContent).toContain('Peminjaman Ruangan');
        expect(document.body.textContent).toContain('Surat Administrasi');
        expect(document.body.textContent).toContain('Batas Waktu Pemeriksaan');
        // Human copy only — no "SLA"/"eskalasi" jargon reaches the awam user.
        expect(document.body.textContent).not.toMatch(/SLA|[Ee]skalasi/);
        // Baseline shows as 7 days for the overdue threshold.
        expect((document.getElementById('sla-room_booking-overdue') as HTMLInputElement).value).toBe('7');
    });

    it('saves in days but sends minutes to the API', async () => {
        await mount();
        m.apiFetch.mockClear();

        document.querySelector<HTMLElement>('[data-sla-save="letter"]')!.click();
        await vi.waitFor(() => expect(m.showSuccess).toHaveBeenCalled());

        const [url, opts] = m.apiFetch.mock.calls[0];
        expect(url).toBe('/api/super-admin/review-sla/letter');
        expect(opts.method).toBe('PUT');
        expect(JSON.parse(opts.body)).toEqual({
            enabled: false,
            warning_minutes: 5 * 1440,
            overdue_minutes: 7 * 1440,
            escalation_minutes: 9 * 1440,
        });
    });

    it('blocks an invalid threshold order with a clear message and no API write', async () => {
        await mount();
        m.apiFetch.mockClear();

        // Warning after overdue is nonsensical — must be rejected client-side.
        (document.getElementById('sla-room_booking-warning') as HTMLInputElement).value = '9';
        (document.getElementById('sla-room_booking-overdue') as HTMLInputElement).value = '7';
        document.querySelector<HTMLElement>('[data-sla-save="room_booking"]')!.click();

        expect(document.getElementById('sla-error-room_booking')?.classList.contains('hidden')).toBe(false);
        expect(document.getElementById('sla-error-room_booking')?.textContent).toContain('Urutan waktu belum tepat');
        expect(m.apiFetch).not.toHaveBeenCalled();
    });

    it('toggles the enabled switch accessibly', async () => {
        await mount();
        const toggle = document.querySelector<HTMLButtonElement>('[data-sla-toggle="room_booking"]')!;
        expect(toggle.getAttribute('aria-checked')).toBe('false');

        toggle.click();
        expect(toggle.getAttribute('aria-checked')).toBe('true');
        expect(document.getElementById('sla-state-room_booking')?.textContent).toBe('Aktif');
    });

    it('shows an isolated error state (never throws to the host) when loading fails', async () => {
        m.apiFetch.mockImplementation(async () => jsonResponse({ message: 'Sesi berakhir.' }, 500));
        await expect(mount()).resolves.toBeUndefined();
        expect(document.body.textContent).toContain('Pengaturan gagal dimuat');
        expect(document.getElementById('sla-retry')).not.toBeNull();
    });
});
