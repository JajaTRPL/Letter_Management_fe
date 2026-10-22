import { describe, expect, it } from 'vitest';
import { buildLetterApprovalSteps, renderLetterApprovalTimeline } from '../letter-approval-timeline';

const labels = (status: string, extra: Record<string, string> = {}) =>
    buildLetterApprovalSteps({ status, submitted_at: '2026-10-01T08:00:00+07:00', ...extra });

describe('shared letter approval timeline', () => {
    it('uses the same stage names for every letter', () => {
        expect(labels('Submitted').map((s) => s.label)).toEqual([
            'Diajukan',
            'Verifikasi Tenaga Pendidik',
            'Paraf Kaprodi/Sekprodi',
            'Tanda Tangan Kadep/Sekdep',
            'Review Mahasiswa',
            'Selesai',
        ]);
    });

    it('marks the stage being worked on as current', () => {
        const states = (status: string, extra: Record<string, string> = {}) => labels(status, extra).map((s) => s.state);
        expect(states('Submitted')).toEqual(['done', 'current', 'pending', 'pending', 'pending', 'pending']);
        expect(states('Approved_Kaprodi', { tendik_approved_at: 'x', kaprodi_approved_at: 'y' }))
            .toEqual(['done', 'done', 'done', 'current', 'pending', 'pending']);
        expect(states('Ready_For_Student_Review', { tendik_approved_at: 'x', kaprodi_approved_at: 'y', kadep_approved_at: 'z' }))
            .toEqual(['done', 'done', 'done', 'done', 'current', 'pending']);
        expect(states('Completed', { tendik_approved_at: 'x', kaprodi_approved_at: 'y', kadep_approved_at: 'z', completed_at: 'w' }))
            .toEqual(['done', 'done', 'done', 'done', 'done', 'done']);
    });

    it('shows revision and rejection as their own final step', () => {
        expect(labels('Revision', { tendik_approved_at: 'x' }).map((s) => s.label))
            .toEqual(['Diajukan', 'Verifikasi Tenaga Pendidik', 'Dikembalikan untuk Revisi']);
        expect(labels('Rejected').map((s) => s.label)).toEqual(['Diajukan', 'Pengajuan Ditolak']);
    });

    it('renders the card with its heading', () => {
        const html = renderLetterApprovalTimeline({ status: 'Submitted' });
        expect(html).toContain('Tahap Persetujuan');
        expect(html).toContain('Verifikasi Tenaga Pendidik');
    });
});
