import { describe, expect, it } from 'vitest';
// Raw module source imported as a string (Vite `?raw`) so the architecture
// boundary can be asserted without Node fs typings.
import designSystemSource from '../design-system.ts?raw';
import {
    badgeClass,
    buttonClass,
    cx,
    inputClass,
    selectClass,
    surfaceClass,
    textClass,
    type ButtonVariant,
    type SurfaceVariant,
    type UiTone,
} from '../design-system';

const TONES: UiTone[] = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'];
const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'outline', 'ghost', 'danger'];
const SURFACES: SurfaceVariant[] = ['page', 'card', 'section', 'muted', 'interactive'];

describe('design-system foundation (CP7A)', () => {
    it('cx ignores falsey values and joins truthy strings', () => {
        expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
        expect(cx()).toBe('');
    });

    it('every UiTone resolves to a non-empty badge class with no undefined', () => {
        for (const tone of TONES) {
            const cls = badgeClass(tone);
            expect(cls.length).toBeGreaterThan(0);
            expect(cls).not.toContain('undefined');
        }
    });

    it('every button variant resolves, includes a focus ring and a disabled rule', () => {
        for (const variant of BUTTON_VARIANTS) {
            const cls = buttonClass(variant);
            expect(cls).not.toContain('undefined');
            expect(cls).toContain('focus:ring-2');
            expect(cls).toContain('disabled:');
        }
        expect(buttonClass('primary', 'sm')).toContain('px-4 py-2');
    });

    it('input/select resolve for default and invalid states', () => {
        expect(inputClass('default')).toContain('border-gray-200');
        expect(inputClass('invalid')).toContain('border-red-300');
        expect(selectClass('default')).toContain('focus:ring-2');
        expect(inputClass()).toContain('disabled:');
    });

    it('every surface variant resolves with no undefined', () => {
        for (const surface of SURFACES) {
            expect(surfaceClass(surface)).not.toContain('undefined');
        }
        expect(surfaceClass('section', 'overflow-hidden')).toContain('overflow-hidden');
    });

    it('text helpers are defined', () => {
        expect(textClass.error).toContain('text-red-600');
        expect(textClass.helper).toContain('text-gray-500');
    });

    // ── Architecture boundary: NO business-domain knowledge in the token layer ──
    it('contains no letter, role, or workflow-status identifiers', () => {
        const source = designSystemSource.toLowerCase();
        const forbidden = [
            'beasiswa', 'magang', 'surat-tugas', 'ska', 'pln', 'luar-negeri', 'keterangan-aktif',
            'tendik', 'akademik', 'mahasiswa', 'kaprodi', 'kadep', 'prodi', 'departemen',
            'approved_', 'submitted', 'revision', 'rejected', 'completed', 'ready_for',
            '/api/', 'apifetch', 'window.open',
        ];
        for (const token of forbidden) {
            expect(source).not.toContain(token);
        }
    });
});
