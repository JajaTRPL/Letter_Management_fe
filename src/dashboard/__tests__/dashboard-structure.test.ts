import { describe, expect, it } from 'vitest';
import adminSource from '../AdminDashboard.ts?raw';
import akademikSource from '../AkademikDashboard.ts?raw';
import mahasiswaSource from '../MahasiswaDashboard.ts?raw';
import tendikSource from '../TendikDashboard.ts?raw';
import tendikPeminjamanSource from '../TendikPeminjamanDashboard.ts?raw';

/**
 * Structural guards for the role dashboards.
 *
 * These exist because a migration that swapped hand-rolled stat cards for the
 * shared primitive replaced only the grid's OPENING tag — leaving three orphaned
 * card blocks and their closing `</div>` behind. The Tendik dashboard shipped
 * rendering six stat cards instead of three, and the stray `</div>` closed the
 * page wrapper early so everything below it escaped the content column.
 *
 * Nothing caught it: no test asserted card count, and no test asserted that the
 * markup was balanced. Both checks live here now.
 */

const DASHBOARDS: ReadonlyArray<readonly [string, string]> = [
    ['AdminDashboard', adminSource],
    ['AkademikDashboard', akademikSource],
    ['MahasiswaDashboard', mahasiswaSource],
    ['TendikDashboard', tendikSource],
    ['TendikPeminjamanDashboard', tendikPeminjamanSource],
];

const count = (source: string, needle: string | RegExp): number =>
    (source.match(needle instanceof RegExp ? needle : new RegExp(needle, 'g')) ?? []).length;

describe('dashboard markup structure', () => {
    it.each(DASHBOARDS)('%s opens and closes the same number of divs', (_name, source) => {
        // An unbalanced template silently re-parents everything after it: the
        // browser auto-corrects, so the page still renders — just in the wrong
        // container, at the wrong width.
        expect(count(source, /<div/g)).toBe(count(source, /<\/div>/g));
    });

    it.each(DASHBOARDS)('%s builds every stat card from the shared primitive', (_name, source) => {
        // The literal signature of the old hand-rolled card. Any occurrence means
        // a card is bypassing renderDashboardStatCard and will drift from the rest.
        expect(source).not.toContain('rounded-[20px] flex justify-between items-center');
    });

    it.each(DASHBOARDS)('%s declares no inline background colour', (_name, source) => {
        // Inline hex cannot participate in the tone system, so it drifts the
        // moment a token changes.
        expect(source).not.toContain('style="background');
    });

    it('every dashboard section carries an icon', () => {
        // A section header with an empty icon slot sits next to ones that have a
        // coloured ring, which is exactly the "some cards look unfinished"
        // inconsistency this suite is meant to prevent.
        for (const [name, source] of DASHBOARDS) {
            const sections = count(source, /renderDashboardSection(Header)?\(/g);
            if (sections === 0) continue;
            expect(count(source, /iconHtml:/g), `${name} has ${sections} section(s) but fewer icons`)
                .toBeGreaterThanOrEqual(sections);
        }
    });
});
