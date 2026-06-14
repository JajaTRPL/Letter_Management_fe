import { describe, expect, it } from 'vitest';
import akademikDashboardSource from '../../dashboard/AkademikDashboard.ts?raw';
import dokumenAkademikSource from '../../akademik/DokumenAkademik.ts?raw';
import reviewScholarshipAkademikSource from '../../akademik/ReviewScholarshipAkademik.ts?raw';
import riwayatAkademikSource from '../../akademik/RiwayatAkademik.ts?raw';
import reviewScholarshipTendikSource from '../../tendik/ReviewScholarship.ts?raw';
import reviewerShellSource from '../reviewer-shell.ts?raw';

describe('Beasiswa reviewer architecture', () => {
    it('routes Akademik dispatchers through the explicit Akademik renderer', () => {
        const dispatcherSources = [
            dokumenAkademikSource,
            akademikDashboardSource,
            riwayatAkademikSource,
        ];

        dispatcherSources.forEach((source) => {
            expect(source).toContain('ReviewScholarshipAkademik');
            expect(source).not.toContain('../tendik/ReviewScholarship');
        });
    });

    it('keeps the role adapters as separate shared-shell consumers', () => {
        expect(reviewScholarshipTendikSource).toContain('renderReviewerShell<BeasiswaReviewResponse>');
        expect(reviewScholarshipAkademikSource).toContain('renderReviewerShell<BeasiswaReviewResponse>');
        expect(reviewScholarshipTendikSource).not.toContain('ReviewScholarshipAkademik');
        expect(reviewScholarshipAkademikSource).not.toContain('../tendik/ReviewScholarship');
    });

    it('keeps Beasiswa branching out of the generic shell', () => {
        expect(reviewerShellSource).not.toMatch(/scholarship|beasiswa/i);
    });
});
