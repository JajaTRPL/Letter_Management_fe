import { describe, expect, it } from 'vitest';
import type { BookingOccurrence, MahasiswaBooking, Room } from '../types';
import { renderBookingDetailDialog } from '../views';

const room: Room = {
    id: 10,
    code: 'KLS-10',
    name: 'Ruang Kelas 10',
    type: 'classroom',
    capacity: 40,
    location: 'Gedung A',
    description: null,
    is_active: true,
    owning_laboratory: null,
};

const occurrence = (
    sequence: number,
    status: BookingOccurrence['operational_status'],
    overrides: Partial<BookingOccurrence> = {},
): BookingOccurrence => ({
    occurrence_ref: `occurrence-${sequence}`,
    sequence,
    date: `2026-07-${19 + sequence}`,
    start_at: `2026-07-${19 + sequence}T09:00:00+07:00`,
    end_at: `2026-07-${19 + sequence}T12:00:00+07:00`,
    return_due_at: `2026-07-${19 + sequence}T12:30:00+07:00`,
    version: 1,
    operational_status: status,
    key_issuance: { issued: false, issued_at: null, issued_by: null },
    return: null,
    capabilities: {
        can_submit_return: false,
        can_withdraw_return: false,
        can_resubmit_return: false,
    },
    event_hooks: [],
    ...overrides,
});

const booking: MahasiswaBooking = {
    id: 88,
    room,
    activity_name: 'Lokakarya Tiga Hari',
    purpose: 'Pelatihan organisasi.',
    participant_count: 20,
    start_at: '2026-07-20T09:00:00+07:00',
    end_at: '2026-07-22T12:00:00+07:00',
    booking_mode: 'consecutive_days',
    occurrence_end_date: '2026-07-22',
    occurrences: [
        occurrence(1, 'returned_on_time'),
        occurrence(2, 'awaiting_verification', {
            key_issuance: {
                issued: true,
                issued_at: '2026-07-21T08:50:00+07:00',
                issued_by: { name: 'Petugas Sarpras', role: 'sarpras' },
            },
            return: {
                return_ref: 'return-public-2',
                status: 'pending',
                version: 1,
                submitted_at: '2026-07-21T12:10:00+07:00',
                decision_note: null,
                key_received_at: null,
                verified_at: null,
                evidence: {
                    original_name: 'bukti-kunci.webp',
                    mime: 'image/webp',
                    size_bytes: 2048,
                    preview_url: '/api/peminjaman-ruangan/returns/return-public-2/evidence/preview',
                    download_url: '/api/peminjaman-ruangan/returns/return-public-2/evidence/download',
                },
            },
            capabilities: {
                can_submit_return: false,
                can_withdraw_return: true,
                can_resubmit_return: false,
            },
        }),
        occurrence(3, 'returned_late'),
    ],
    occurrence_summary: {
        total: 3,
        completed: 2,
        progress_label: '2 dari 3 penggunaan selesai',
        next_action: 'awaiting_verification',
        nearest_deadline: '2026-07-21T12:30:00+07:00',
    },
    usage_timeline: [{
        type: 'return_submitted',
        occurred_at: '2026-07-21T12:10:00+07:00',
        label: 'Bukti pengembalian telah dikirim.',
        actor: { name: 'Mahasiswa', role: 'mahasiswa' },
        occurrence_ref: 'occurrence-2',
    }],
    status: 'approved',
    effective_status: 'approved',
    reviewer: null,
    reviewed_at: null,
    revision_note: null,
    rejection_reason: null,
    cancellation_reason: null,
    created_at: '2026-07-18T09:00:00+07:00',
    updated_at: '2026-07-18T09:00:00+07:00',
};

describe('C7R applicant occurrence journey', () => {
    it('keeps one booking journey with ordered daily tasks, progress, evidence, and timeline', () => {
        const html = renderBookingDetailDialog(booking, false, null, false);

        expect(html.match(/data-occurrence-row=/g)).toHaveLength(3);
        expect(html).toContain('2 dari 3 penggunaan selesai');
        expect(html).toContain('Selesai tepat waktu');
        expect(html).toContain('Menunggu verifikasi');
        expect(html).toContain('Selesai terlambat');
        expect(html).toContain('bukti-kunci.webp');
        expect(html).toContain('Tarik Pengajuan Pengembalian');
        expect(html).toContain('Tenggat');
        expect(html).toContain('Bukti pengembalian telah dikirim.');

        const next = html.indexOf('Tindakan berikutnya');
        const summary = html.indexOf('Ringkasan Ruangan dan Jadwal');
        const tasks = html.indexOf('Daftar Tugas per Penggunaan');
        const evidence = html.indexOf('Bukti dan Keputusan Pengembalian');
        const documents = html.indexOf('Surat Peminjaman');
        const approval = html.indexOf('Linimasa Persetujuan');
        const usage = html.indexOf('Linimasa Penggunaan dan Kunci');
        expect(next).toBeLessThan(summary);
        expect(summary).toBeLessThan(tasks);
        expect(tasks).toBeLessThan(evidence);
        expect(evidence).toBeLessThan(documents);
        expect(documents).toBeLessThan(approval);
        expect(approval).toBeLessThan(usage);
    });

    it('renders a non-approved booking occurrence as read-only, with no action and no misleading copy', () => {
        // C7R: occurrences exist for every booking (submission + legacy backfill).
        // A rejected booking's occurrence must render as inert history — the
        // backend reports `not_actionable` and every capability false.
        const rejected: MahasiswaBooking = {
            ...booking,
            status: 'rejected',
            effective_status: 'rejected',
            occurrences: [occurrence(1, 'not_actionable')],
            occurrence_summary: {
                total: 1,
                completed: 0,
                progress_label: '0 dari 1 penggunaan selesai',
                next_action: null,
                nearest_deadline: null,
            },
            usage_timeline: [],
        };

        const html = renderBookingDetailDialog(rejected, false, null, false);

        expect(html).toContain('Belum berlaku');
        expect(html).not.toContain('Akan digunakan');
        expect(html).not.toContain('Status Tidak Dikenal');
        // No return/key action is offered — the UI follows the capabilities.
        expect(html).not.toContain('data-return-submit=');
        expect(html).not.toContain('data-return-withdraw=');
    });

    it('uses a full-width responsive dialog and real labelled controls at mobile width', () => {
        const html = renderBookingDetailDialog(booking, false, null, false);

        expect(html).toContain('w-full max-w-[580px]');
        expect(html).toContain('flex flex-wrap');
        expect(html).not.toContain('min-w-[');
        expect(html).toContain('aria-label="Tutup detail"');
        expect(html).not.toContain('evidence_path');
        expect(html).not.toContain('checksum');
    });
});
