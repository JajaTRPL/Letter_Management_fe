import { describe, expect, it } from 'vitest';
import designSystemSource from '../design-system.ts?raw';
import letterPresentationSource from '../letter-presentation.ts?raw';
import {
    accentBadgeClass,
    accentIconSurfaceClass,
    accentStroke,
    galleryTabClass,
    type AccentTone,
} from '../design-system';
import { ADMINISTRASI_LETTER_CARDS, renderLetterCard } from '../letter-presentation';

const ACCENTS: AccentTone[] = ['teal', 'blue', 'amber', 'emerald', 'indigo', 'slate'];

describe('CP7B page-surface design-system helpers', () => {
    it('galleryTabClass resolves both active and inactive states with no undefined', () => {
        expect(galleryTabClass(true)).toContain('border-primary-teal');
        expect(galleryTabClass(false)).toContain('hover:border-teal-200');
        expect(galleryTabClass(true)).not.toContain('undefined');
    });

    it('every accent tone resolves icon surface, badge, and stroke', () => {
        for (const tone of ACCENTS) {
            expect(accentIconSurfaceClass(tone)).toContain('group-hover:');
            expect(accentIconSurfaceClass(tone)).not.toContain('undefined');
            expect(accentBadgeClass(tone)).toContain('rounded-full');
            expect(accentStroke(tone)).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });

    // ── Architecture boundary ──────────────────────────────────────────────--
    it('design-system has no letter, role, or workflow identifiers', () => {
        const src = designSystemSource.toLowerCase();
        for (const token of ['beasiswa', 'magang', 'surat-tugas', 'tendik', 'akademik', 'mahasiswa', 'approved_', 'submitted', 'rejected', 'completed', '/api/']) {
            expect(src).not.toContain(token);
        }
    });

    it('letter-presentation is presentation-only (no renderer/adapter imports, no fetch)', () => {
        const src = letterPresentationSource;
        // No page-renderer or domain-adapter imports, no fetching, no routes.
        expect(src).not.toMatch(/import[^;]*Form['"]/);
        expect(src).not.toMatch(/import[^;]*Review[^;]*['"]/);
        expect(src).not.toMatch(/import[^;]*Dashboard['"]/);
        expect(src).not.toContain('apiFetch');
        expect(src).not.toContain('/api/');
        expect(src).not.toContain('window.open');
    });
});

describe('CP7B Administrasi Surat letter cards', () => {
    it('exposes exactly five cards in order with distinct ids and accents', () => {
        expect(ADMINISTRASI_LETTER_CARDS).toHaveLength(5);
        const ids = ADMINISTRASI_LETTER_CARDS.map((c) => c.cardId);
        expect(new Set(ids).size).toBe(5);
        const accents = ADMINISTRASI_LETTER_CARDS.map((c) => c.accent);
        expect(new Set(accents).size).toBe(5);
    });

    it('preserves the exact card/duration ids the page binds', () => {
        const byTitle = (t: string) => ADMINISTRASI_LETTER_CARDS.find((c) => c.title === t)!;
        expect(byTitle('Surat Keterangan Aktif').cardId).toBe('card-aktif');
        expect(byTitle('Surat Keterangan Aktif').durationId).toBe('duration-aktif');
        expect(byTitle('Surat Pengantar Magang').cardId).toBe('card-magang');
        expect(byTitle('Surat Permohonan Beasiswa').cardId).toBe('card-beasiswa');
        expect(byTitle('Proses Luar Negeri').durationId).toBe('duration-luar_negeri');
        expect(byTitle('Surat Tugas').cardId).toBe('card-surat-tugas');
    });

    it('keeps Surat Tugas visually distinct from Surat Pengantar Magang', () => {
        const st = ADMINISTRASI_LETTER_CARDS.find((c) => c.cardId === 'card-surat-tugas')!;
        const magang = ADMINISTRASI_LETTER_CARDS.find((c) => c.cardId === 'card-magang')!;
        expect(st.accent).not.toBe(magang.accent);
        expect(st.title).not.toBe(magang.title);
        expect(st.iconBody).not.toBe(magang.iconBody);
    });

    it('renders each card with the doc-card class, ids, escaped title, and accent', () => {
        for (const card of ADMINISTRASI_LETTER_CARDS) {
            const html = renderLetterCard(card);
            expect(html).toContain(`id="${card.cardId}"`);
            expect(html).toContain('doc-card');
            expect(html).toContain(`id="${card.durationId}"`);
            expect(html).toContain(card.title);
            expect(html).toContain(accentStroke(card.accent));
            expect(html).toContain(card.durationLabel);
        }
    });

    it('escapes presentation strings and emits no unsafe markup', () => {
        const html = ADMINISTRASI_LETTER_CARDS.map(renderLetterCard).join('');
        for (const token of ['/api/storage', '/storage/', 'attachment://', '<iframe', '<object', '<embed', 'window.open']) {
            expect(html).not.toContain(token);
        }
    });
});
