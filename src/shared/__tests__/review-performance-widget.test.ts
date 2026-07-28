// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../api-client', () => ({ apiFetch: m.apiFetch }));

import adminDashboardSource from '../../dashboard/AdminDashboard.ts?raw';
import {
    hydrateReviewPerformance,
    reviewPerformanceShell,
    type ReviewMetric,
    type ReviewPerformanceWidgetConfig,
} from '../review-performance-widget';

const SUMMARY_CONFIG: ReviewPerformanceWidgetConfig = {
    mountId: 'test-perf',
    endpoint: '/api/super-admin/review-performance',
    variant: 'summary',
    title: 'Monitoring Kinerja',
    subtitle: 'Waktu pemeriksaan per tahap.',
};

const SELF_CONFIG: ReviewPerformanceWidgetConfig = {
    ...SUMMARY_CONFIG,
    endpoint: '/api/akademik/review-performance/me',
    variant: 'self',
    title: 'Pemeriksaan Anda Bulan Ini',
};

const metric = (overrides: Partial<ReviewMetric> = {}): ReviewMetric => ({
    source: 'dynamic',
    count: 42,
    revision_count: 7,
    median_seconds: 154800,
    median_label: '1 hari 19 jam',
    average_label: '2 hari 8 jam',
    p90_label: '5 hari',
    estimate_label: null,
    sample_note: null,
    status: 'within',
    status_label: 'Dalam batas waktu',
    ...overrides,
});

const summary = (stageMetric: ReviewMetric, slaEnabled = true) => ({
    data: {
        period: { key: '3months', label: '3 Bulan' },
        basis: {
            measures: 'Dihitung dari pemeriksaan terakhir tiap pengajuan.',
            excludes: 'Waktu mahasiswa merevisi pengajuannya tidak ikut dihitung.',
            min_sample: 5,
        },
        scopes: [{
            scope: 'letter',
            scope_label: 'Surat Administrasi',
            sla: { enabled: slaEnabled, warning_label: '5 hari', overdue_label: '7 hari' },
            stages: [{
                stage: 'prodi',
                stage_label: 'Program Studi (Kaprodi/Sekprodi)',
                unit_dimension: 'study_program',
                metric: stageMetric,
                comparison: null,
                waiting_now: { count: 3, over_overdue_count: 1 },
            }],
        }],
    },
});

const respondWith = (payload: unknown) => {
    m.apiFetch.mockResolvedValue({ ok: true, json: async () => payload });
};

beforeEach(() => {
    document.body.innerHTML = '';
    m.apiFetch.mockReset();
});

describe('review performance widget', () => {
    it('renders a measured median with no estimate badge', async () => {
        document.body.innerHTML = reviewPerformanceShell(SUMMARY_CONFIG);
        respondWith(summary(metric()));

        await hydrateReviewPerformance(SUMMARY_CONFIG);

        expect(document.body.textContent).toContain('1 hari 19 jam');
        expect(document.body.textContent).toContain('Dalam batas waktu');
        expect(document.body.textContent).not.toContain('Estimasi');
    });

    it('badges an under-sampled stage as an estimate and shows no precise figure', async () => {
        document.body.innerHTML = reviewPerformanceShell(SUMMARY_CONFIG);
        respondWith(summary(metric({
            source: 'fallback',
            count: 2,
            median_seconds: null,
            median_label: null,
            average_label: null,
            estimate_label: '2–4 hari kerja',
            sample_note: 'Baru 2 dari 5 pengajuan — angka pasti muncul setelah cukup data.',
            status: 'unknown',
            status_label: 'Belum bisa dihitung',
        })));

        await hydrateReviewPerformance(SUMMARY_CONFIG);

        expect(document.body.textContent).toContain('Estimasi');
        expect(document.body.textContent).toContain('2–4 hari kerja');
        expect(document.body.textContent).toContain('Baru 2 dari 5');
    });

    it('says nothing rather than zero when a period had no activity', async () => {
        document.body.innerHTML = reviewPerformanceShell(SUMMARY_CONFIG);
        respondWith(summary(metric({
            source: 'none',
            count: 0,
            revision_count: 0,
            median_seconds: null,
            median_label: null,
            average_label: null,
            estimate_label: null,
            sample_note: 'Belum ada pengajuan yang selesai di periode ini.',
            status: 'unknown',
            status_label: 'Belum bisa dihitung',
        })));

        await hydrateReviewPerformance(SUMMARY_CONFIG);

        expect(document.body.textContent).toContain('Belum ada data');
        expect(document.body.textContent).toContain('Belum ada pengajuan yang selesai');
    });

    it('never renders the old zeroed clock, whatever the payload', async () => {
        document.body.innerHTML = reviewPerformanceShell(SUMMARY_CONFIG);
        respondWith(summary(metric({ source: 'none', count: 0, median_seconds: null, median_label: null, average_label: null })));

        await hydrateReviewPerformance(SUMMARY_CONFIG);

        // "00 Hari 00 Jam 00 Menit" reads as "approved instantly" — the single
        // most misleading thing this surface could say.
        expect(document.body.textContent).not.toContain('00 Hari');
        expect(document.body.textContent).not.toContain('00 Jam');
    });

    it('does not colour a stage against a deadline nobody switched on', async () => {
        document.body.innerHTML = reviewPerformanceShell(SUMMARY_CONFIG);
        respondWith(summary(metric({ status: 'unrated', status_label: 'Batas waktu belum diaktifkan' }), false));

        await hydrateReviewPerformance(SUMMARY_CONFIG);

        expect(document.body.textContent).toContain('Batas waktu belum diaktifkan');
        // No success/danger badge is emitted for an unrated stage.
        expect(document.querySelector('.bg-emerald-50, .bg-red-50')).toBeNull();
    });

    it('escapes hostile text from the API', async () => {
        document.body.innerHTML = reviewPerformanceShell(SUMMARY_CONFIG);
        const payload = summary(metric());
        payload.data.scopes[0].stages[0].stage_label = '<img src=x onerror=alert(1)>';
        respondWith(payload);

        await hydrateReviewPerformance(SUMMARY_CONFIG);

        expect(document.querySelector('img')).toBeNull();
        expect(document.body.innerHTML).toContain('&lt;img');
    });

    it('always carries the caveat that applicant revision time is excluded', async () => {
        document.body.innerHTML = reviewPerformanceShell(SUMMARY_CONFIG);
        respondWith(summary(metric()));

        await hydrateReviewPerformance(SUMMARY_CONFIG);

        expect(document.body.textContent).toContain('Waktu mahasiswa merevisi');
        expect(document.body.textContent).toContain('bukan penilaian individu');
    });

    it('renders an in-widget error with retry and never throws to the host', async () => {
        document.body.innerHTML = reviewPerformanceShell(SUMMARY_CONFIG);
        m.apiFetch.mockRejectedValue(new Error('Sesi berakhir.'));

        await expect(hydrateReviewPerformance(SUMMARY_CONFIG)).resolves.toBeUndefined();

        expect(document.body.textContent).toContain('Gagal memuat');
        expect(document.getElementById('test-perf-retry')).not.toBeNull();
    });

    // ── self view ───────────────────────────────────────────────────────────

    it('removes its own card entirely when the reviewer has no stage', async () => {
        document.body.innerHTML = reviewPerformanceShell(SELF_CONFIG);
        respondWith({ data: { eligible: false, reason_label: 'Ringkasan ini tersedia untuk pemeriksa pengajuan.' } });

        await hydrateReviewPerformance(SELF_CONFIG);

        // No empty shell and no error: a Laboran simply does not have this card.
        expect(document.getElementById('test-perf')).toBeNull();
        expect(document.body.textContent).not.toContain('Gagal');
    });

    it('gives a reviewer an action, not a ranking', async () => {
        document.body.innerHTML = reviewPerformanceShell(SELF_CONFIG);
        respondWith({
            data: {
                eligible: true,
                stage_label: 'Program Studi (Kaprodi/Sekprodi)',
                unit_label: 'TE — Teknik Elektro',
                period: { label: '1 Bulan' },
                metric: metric(),
                comparison: { direction: 'faster', label: '3 jam lebih cepat dari periode sebelumnya' },
                waiting_now: { count: 5, over_overdue_count: 3, action_label: 'Lihat Antrean' },
                note: 'Ringkasan tahap ini, bukan penilaian per orang.',
            },
        });

        await hydrateReviewPerformance(SELF_CONFIG);

        const text = document.body.textContent ?? '';
        expect(text).toContain('Ada 3 pengajuan yang menunggu melebihi batas waktu.');
        expect(text).toContain('bukan penilaian per orang');
        // Never framed as an accusation, and never comparative against peers.
        expect(text).not.toContain('Anda terlambat');
        expect(text).not.toContain('peringkat');
    });
});

describe('AdminDashboard card cutover', () => {
    it('no longer contains the hand-rolled duration box', () => {
        // The docblock still NAMES the old card to explain what replaced it, so
        // assert on what it consumed rather than on the prose.
        expect(adminDashboardSource).not.toContain('renderDurationBox');
        expect(adminDashboardSource).not.toContain('approval_durations');
    });

    it('mounts the shared widget instead', () => {
        expect(adminDashboardSource).toContain('reviewPerformanceShell');
        expect(adminDashboardSource).toContain('hydrateReviewPerformance');
    });
});

describe('AdminDashboard fabricated data', () => {
    it('no longer ships a hardcoded chart curve', () => {
        // The chart used to fall back to [30, 45, 28, 50, 42, 38, 48] with
        // February labels, so a quiet week — or a fresh install — showed a
        // confident line describing activity that never happened.
        expect(adminDashboardSource).not.toContain('30, 45, 28');
        expect(adminDashboardSource).not.toContain("'18 Feb'");
        expect(adminDashboardSource).toContain('Belum ada aktivitas pada periode ini.');
    });
});
