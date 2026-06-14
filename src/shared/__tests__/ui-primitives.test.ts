import { describe, expect, it } from 'vitest';
import {
    renderEmptyState,
    renderErrorState,
    renderFieldMessage,
    renderLoadingState,
    renderStatusBadge,
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
