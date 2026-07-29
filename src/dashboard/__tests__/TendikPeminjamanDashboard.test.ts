// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    renderDashboardLayout: vi.fn((_t: string, content: string) => {
        document.body.innerHTML = `<div id="app">${content}</div>`;
    }),
    renderPeminjamanRuanganTendik: vi.fn(),
    attachDelegatedActivityDashboardCard: vi.fn(),
}));

vi.mock('../../shared/api-client', () => ({ apiFetch: m.apiFetch }));
vi.mock('../DashboardLayout', () => ({ renderDashboardLayout: m.renderDashboardLayout }));
vi.mock('../../tendik/PeminjamanRuanganTendik', () => ({
    renderPeminjamanRuanganTendik: m.renderPeminjamanRuanganTendik,
}));
vi.mock('../../tendik/DelegatedActivityAcknowledgements', () => ({
    renderDelegatedActivityDashboardCard: () => '<div id="delegated-card"></div>',
    attachDelegatedActivityDashboardCard: m.attachDelegatedActivityDashboardCard,
}));

import { renderTendikPeminjamanDashboard } from '../TendikPeminjamanDashboard';

const row = (overrides: Record<string, unknown> = {}) => ({
    kind: 'approval',
    kind_label: 'Persetujuan Pengajuan',
    booking_id: 12,
    occurrence_ref: null,
    title: 'Rapat Organisasi',
    requester_name: 'Andromedha Cynosura',
    room_label: 'CU101 · Lab RPL 9',
    schedule_label: '3 Agu 2026 · 08.00–16.30 WIB',
    status_label: 'Diajukan',
    status_tone: 'info',
    waiting_label: 'Menunggu 2 hari',
    is_overdue: false,
    can_act: true,
    action_label: 'Tinjau Pengajuan',
    responsible_label: null,
    ...overrides,
});

const payload = (overrides: Record<string, unknown> = {}) => ({
    data: {
        role: 'kepala_lab',
        role_label: 'Kepala Laboratorium',
        scope_label: 'LAB-01 · Lab RPL 9',
        stats: { actionable: 1, overdue: 0, finished_this_month: 2 },
        actionable: [row()],
        awareness: [],
        today: [],
        history: [],
        ...overrides,
    },
});

const respond = (body: unknown, ok = true) => {
    m.apiFetch.mockResolvedValue({ ok, json: async () => body });
};

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    Object.values(m).forEach((fn) => (fn as any).mockClear?.());
    m.renderDashboardLayout.mockImplementation((_t: string, content: string) => {
        document.body.innerHTML = `<div id="app">${content}</div>`;
    });
});

describe('Tendik peminjaman dashboard', () => {
    it('shows the booking the letter dashboard could never show', async () => {
        localStorage.setItem('auth_tendik_role', 'kepala_lab');
        respond(payload());

        await renderTendikPeminjamanDashboard('tendik');

        const text = document.body.textContent ?? '';
        expect(text).toContain('Rapat Organisasi');
        expect(text).toContain('CU101 · Lab RPL 9');
        expect(text).toContain('Perlu Dikerjakan');
        // The letter vocabulary must be gone for these roles.
        expect(text).not.toContain('Total Surat Masuk');
        expect(text).not.toContain('Jenis Surat');
    });

    it('renders the awareness panel without a single button', async () => {
        localStorage.setItem('auth_tendik_role', 'kepala_lab');
        respond(payload({
            actionable: [],
            stats: { actionable: 0, overdue: 0, finished_this_month: 0 },
            awareness: [row({
                kind: 'key_handover',
                kind_label: 'Serah Terima Kunci',
                can_act: false,
                action_label: null,
                responsible_label: 'Menunggu Laboran',
                status_label: 'Menunggu serah kunci',
                status_tone: 'neutral',
            })],
        }));

        await renderTendikPeminjamanDashboard('tendik');

        // Innermost div containing the title — textContent bubbles, so the
        // shortest match is the panel itself rather than a page wrapper.
        const panel = Array.from(document.querySelectorAll('div'))
            .filter((el) => el.textContent?.includes('Kondisi Operasional Lab'))
            .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];
        expect(panel).toBeTruthy();
        // The whole point: a Kepala Lab cannot issue keys, so no control is offered.
        expect(panel!.querySelectorAll('button').length).toBe(0);
        expect(document.body.textContent).toContain('Menunggu Laboran');
        expect(document.body.textContent).toContain('Tindakan dilakukan oleh Laboran.');
    });

    it('marks the awareness panel as a different category from the work queue', async () => {
        localStorage.setItem('auth_tendik_role', 'kepala_lab');
        respond(payload({ awareness: [row({ can_act: false, responsible_label: 'Menunggu Laboran' })] }));

        await renderTendikPeminjamanDashboard('tendik');

        // "Information, not your task" has to be carried by something a reader
        // can name. It used to be a grey surface, which just read as unfinished
        // next to the rest of the page; it is now the `info` tone. Either way
        // the requirement is the same: this panel must NOT be dressed like the
        // queue above it.
        const sectionOf = (title: string): Element => {
            const el = Array.from(document.querySelectorAll('div'))
                .filter((node) => node.textContent?.includes(title))
                .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0]
                ?.closest('.rounded-2xl');
            expect(el, `no section found for "${title}"`).toBeTruthy();

            return el!;
        };

        const awareness = sectionOf('Kondisi Operasional Lab');
        const queue = sectionOf('Antrean Perlu Dikerjakan');

        expect(awareness.className).toContain('border-blue-100');
        expect(queue.className).not.toContain('border-blue-100');
        expect(awareness.className).not.toBe(queue.className);
    });

    it('gives Sarpras a live button on an operational row', async () => {
        localStorage.setItem('auth_tendik_role', 'sarpras');
        respond(payload({
            role: 'sarpras',
            scope_label: 'Ruang kelas',
            actionable: [row({ kind: 'key_handover', kind_label: 'Serah Terima Kunci', action_label: 'Serahkan Kunci' })],
            awareness: [],
        }));

        await renderTendikPeminjamanDashboard('tendik');

        expect(document.querySelector('.peminjaman-row-action')?.textContent?.trim()).toBe('Serahkan Kunci');
    });

    it('routes row actions and see-more into Peminjaman Ruangan, never the letter pages', async () => {
        localStorage.setItem('auth_tendik_role', 'sarpras');
        respond(payload({ role: 'sarpras', actionable: [row()] }));

        await renderTendikPeminjamanDashboard('tendik');
        (document.querySelector('.peminjaman-row-action') as HTMLElement).click();

        await vi.waitFor(() => expect(m.renderPeminjamanRuanganTendik).toHaveBeenCalled());
        expect(m.renderPeminjamanRuanganTendik).toHaveBeenCalledWith('tendik', undefined);
    });

    it('sends an operational row to the operations tab', async () => {
        localStorage.setItem('auth_tendik_role', 'laboran');
        respond(payload({
            role: 'laboran',
            actionable: [row({ kind: 'return_verification', action_label: 'Verifikasi Pengembalian' })],
        }));

        await renderTendikPeminjamanDashboard('tendik');
        (document.querySelector('.peminjaman-row-action') as HTMLElement).click();

        await vi.waitFor(() => expect(m.renderPeminjamanRuanganTendik).toHaveBeenCalledWith('tendik', 'operations'));
    });

    it('states an empty queue honestly instead of blaming assignment', async () => {
        localStorage.setItem('auth_tendik_role', 'sarpras');
        respond(payload({
            role: 'sarpras',
            actionable: [],
            stats: { actionable: 0, overdue: 0, finished_this_month: 0 },
        }));

        await renderTendikPeminjamanDashboard('tendik');

        const text = document.body.textContent ?? '';
        expect(text).toContain('Tidak ada yang perlu dikerjakan saat ini.');
        // The old copy claimed nothing was "ditugaskan kepada Anda" — which was
        // false whenever bookings existed in their scope.
        expect(text).not.toContain('ditugaskan kepada Anda');
    });

    it('escapes hostile values coming from the API', async () => {
        localStorage.setItem('auth_tendik_role', 'kepala_lab');
        respond(payload({ actionable: [row({ title: '<img src=x onerror=alert(1)>' })] }));

        await renderTendikPeminjamanDashboard('tendik');

        expect(document.querySelector('img')).toBeNull();
        expect(document.body.innerHTML).toContain('&lt;img');
    });

    it('renders an error state rather than a blank screen when the feed fails', async () => {
        localStorage.setItem('auth_tendik_role', 'kepala_lab');
        m.apiFetch.mockRejectedValue(new Error('Sesi berakhir.'));

        await renderTendikPeminjamanDashboard('tendik');

        expect(document.body.textContent).toContain('Sesi berakhir.');
    });
});
