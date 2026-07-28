import { describe, expect, it } from 'vitest';
import {
    buildTrackingStages,
    renderDashboardSection,
    renderDashboardStatCard,
    renderDashboardTable,
    renderEmptyState,
    renderErrorState,
    renderFieldMessage,
    renderLoadingState,
    renderStatusBadge,
    renderTrackingCard,
} from '../ui-primitives';
import type { UiTone } from '../design-system';

describe('ui-primitives (CP7A)', () => {
    it('renders a status badge for each tone with escaped content', () => {
        const tones: UiTone[] = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'];
        for (const tone of tones) {
            const html = renderStatusBadge(tone, 'Status');
            expect(html).toContain('<span');
            expect(html).toContain('Status');
        }
        const escaped = renderStatusBadge('danger', '<script>x</script>');
        expect(escaped).not.toContain('<script>x</script>');
        expect(escaped).toContain('&lt;script&gt;');
    });

    it('renders loading state with a spinner and escaped message', () => {
        const html = renderLoadingState('<b>Memuat</b>');
        expect(html).toContain('animate-spin');
        expect(html).not.toContain('<b>Memuat</b>');
        expect(html).toContain('&lt;b&gt;');
    });

    it('renders an alert error state with escaped message', () => {
        const html = renderErrorState('<i>gagal</i>');
        expect(html).toContain('role="alert"');
        expect(html).not.toContain('<i>gagal</i>');
        expect(html).toContain('&lt;i&gt;');
    });

    it('renders empty state with escaped message', () => {
        const html = renderEmptyState('<x>kosong</x>');
        expect(html).not.toContain('<x>kosong</x>');
        expect(html).toContain('&lt;x&gt;');
    });

    it('renders a field message that is hidden when no error and visible (escaped) with an error', () => {
        const hidden = renderFieldMessage('f-err');
        expect(hidden).toContain('hidden');
        expect(hidden).toContain('role="alert"');

        const shown = renderFieldMessage('f-err', '<e>wajib</e>');
        expect(shown).not.toContain('hidden"');
        expect(shown).not.toContain('<e>wajib</e>');
        expect(shown).toContain('&lt;e&gt;');
    });

    it('builds tracking stages: completed / active / pending, with an interrupt', () => {
        expect(buildTrackingStages(['A', 'B', 'C'], { completedThrough: 0, activeIndex: 1 })
            .map((stage) => stage.kind)).toEqual(['completed', 'active', 'pending']);

        expect(buildTrackingStages(['A', 'B', 'C'], {
            completedThrough: 0,
            activeIndex: 1,
            interrupt: { label: 'Revisi' },
        })[1]).toEqual({ kind: 'interrupt', label: 'Revisi' });
    });

    it('renders the tracking card shell with an escaped header, rail, body and actions', () => {
        const html = renderTrackingCard({
            badgeLabel: 'Administrasi Surat',
            badgeTone: 'primary',
            title: 'Ruang <script>unsafe()</script>',
            subtitle: 'Pengajuan surat administrasi',
            statusLabel: 'Diproses',
            statusToneClass: 'bg-blue-50 text-blue-700 border-blue-100',
            stages: buildTrackingStages(['Diajukan', 'Tendik'], { completedThrough: 0, activeIndex: 1 }),
            bodyHtml: '<p>body</p>',
            actionsHtml: '<button>Lihat Detail</button>',
        });
        expect(html).toContain('Administrasi Surat');
        expect(html).toContain('data-tracking-status');
        expect(html).toContain('Diproses');
        expect(html).toContain('border-dashed'); // the stage rail
        expect(html).toContain('<p>body</p>');
        expect(html).toContain('<button>Lihat Detail</button>');
        expect(html).not.toContain('undefined');
        // Caller-supplied text is escaped; caller-supplied HTML blocks are not.
        expect(html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');
        expect(html).not.toContain('<script>unsafe()');
    });

    // ── dashboard chrome ────────────────────────────────────────────────────

    it('renders a stat card per tone with an escaped label and value', () => {
        for (const tone of ['info', 'warning', 'success'] as const) {
            const html = renderDashboardStatCard({ label: 'Perlu Dikerjakan', value: 3, tone, iconSvg: '<svg/>' });
            expect(html).toContain('Perlu Dikerjakan');
            expect(html).toContain('>3<');
            expect(html).toContain('text-[38px] font-black');
            expect(html).not.toContain('undefined');
        }

        const injected = renderDashboardStatCard({
            label: '<img src=x onerror=alert(1)>', value: 0, tone: 'info', iconSvg: '<svg/>',
        });
        expect(injected).toContain('&lt;img');
        expect(injected).not.toContain('<img');
    });

    it('gives a muted section a different surface so read-only never looks actionable', () => {
        const actionable = renderDashboardSection({ title: 'Antrean', bodyHtml: '<p>x</p>' });
        const readOnly = renderDashboardSection({ title: 'Kondisi', bodyHtml: '<p>x</p>', tone: 'muted' });

        expect(actionable).toContain('bg-white');
        expect(readOnly).not.toContain('bg-white');
        expect(readOnly).toContain('bg-gray-50/70');
    });

    it('links a section heading to its wrapper for screen readers when asked', () => {
        expect(renderDashboardSection({ title: 'X', titleId: 'panel-title', bodyHtml: '' }))
            .toContain('id="panel-title"');
        expect(renderDashboardSection({ title: 'X', bodyHtml: '' })).not.toContain('id=');
    });

    it('renders an empty table that still spans every column', () => {
        const html = renderDashboardTable({
            columns: [{ label: 'Ruangan' }, { label: 'Jadwal' }, { label: 'Status' }],
            rowsHtml: '',
            emptyMessage: 'Tidak ada yang perlu dikerjakan saat ini.',
        });

        expect(html).toContain('colspan="3"');
        expect(html).toContain('Tidak ada yang perlu dikerjakan saat ini.');
        expect(html).toContain('Ruangan');
    });

    it('passes caller-built rows through untouched and escapes only the headers', () => {
        const html = renderDashboardTable({
            columns: [{ label: '<b>Kolom</b>' }],
            rowsHtml: '<tr><td>baris</td></tr>',
            emptyMessage: 'kosong',
        });

        expect(html).toContain('<tr><td>baris</td></tr>');
        expect(html).toContain('&lt;b&gt;Kolom');
        expect(html).not.toContain('kosong');
    });

    it('never emits raw storage paths, markers, or unsafe embeds', () => {
        const all = [
            renderStatusBadge('info', 'x'),
            renderLoadingState(),
            renderErrorState(),
            renderEmptyState('x'),
            renderFieldMessage('id', 'x'),
        ].join(' ');
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', '<object', '<embed', 'window.open']) {
            expect(all).not.toContain(token);
        }
    });
});
