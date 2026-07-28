import { describe, expect, it } from 'vitest';
import {
    isActivePeminjamanBooking,
    renderBookingDetailDialog,
    renderPeminjamanRiwayatSection,
    renderPeminjamanTrackingCards,
    renderSuratPeminjamanPanel,
} from '../views';
import type { MahasiswaBooking } from '../types';

const booking = (
    overrides: Partial<MahasiswaBooking> = {},
): MahasiswaBooking => ({
    id: 51,
    room: {
        id: 10,
        code: 'KLS-1',
        name: 'Ruang <script>unsafe()</script>',
        type: 'classroom',
        capacity: 40,
        location: 'Gedung A',
        description: null,
        is_active: true,
        owning_laboratory: null,
    },
    activity_name: 'Kegiatan "Uji" <b>tebal</b>',
    purpose: 'Tujuan milik mahasiswa.',
    participant_count: 10,
    start_at: '2026-06-20T10:00:00+07:00',
    end_at: '2026-06-20T12:00:00+07:00',
    status: 'submitted',
    reviewer: null,
    reviewed_at: null,
    revision_note: null,
    rejection_reason: null,
    cancellation_reason: null,
    created_at: '2026-06-18T09:00:00+07:00',
    updated_at: null,
    ...overrides,
});

const NOW = new Date('2026-06-19T00:00:00Z');

/** Text inside the tracking card's status pill (the shared card's status hook). */
const statusPillText = (html: string): string =>
    html.match(/data-tracking-status[^>]*>([^<]*)</)?.[1]?.trim() ?? '';

describe('Effective lifecycle status on the Mahasiswa dashboard/riwayat surfaces', () => {
    it('presents the backend effective status, not the stored one', () => {
        const underReview = booking({
            status: 'submitted',
            effective_status: 'under_review',
        });

        const cards = renderPeminjamanTrackingCards([underReview]);
        // The status pill is the claim about the booking's state; the stage rail
        // separately names every stage, so assert the pill itself.
        expect(statusPillText(cards)).toBe('Sedang Ditinjau');
        expect(statusPillText(cards)).not.toBe('Diajukan');
        expect(cards).toContain('Sedang ditinjau oleh pengelola ruangan.');

        const riwayat = renderPeminjamanRiwayatSection([underReview], null);
        expect(riwayat).toContain('Sedang Ditinjau');
    });

    it.each([
        ['expired', 'Kedaluwarsa'],
        ['completed', 'Selesai'],
    ])('labels an %s booking by its effective status', (effective, label) => {
        const html = renderPeminjamanRiwayatSection([booking({
            status: 'approved',
            effective_status: effective,
        })], null);
        expect(html).toContain(label);
        expect(html).not.toContain('Disetujui');
    });

    it('drops expired and completed bookings out of the active dashboard set', () => {
        expect(isActivePeminjamanBooking(
            booking({ status: 'submitted', effective_status: 'under_review' }),
            NOW,
        )).toBe(true);
        expect(isActivePeminjamanBooking(
            booking({ status: 'approved', effective_status: 'completed' }),
            NOW,
        )).toBe(false);
        expect(isActivePeminjamanBooking(
            booking({ status: 'approved', effective_status: 'expired' }),
            NOW,
        )).toBe(false);
    });
});

describe('isActivePeminjamanBooking', () => {
    it('treats submitted and revision_requested as active', () => {
        expect(isActivePeminjamanBooking(booking({ status: 'submitted' }), NOW)).toBe(true);
        expect(isActivePeminjamanBooking(booking({ status: 'revision_requested' }), NOW)).toBe(true);
    });

    it('keeps approved bookings active only until they end', () => {
        expect(isActivePeminjamanBooking(booking({ status: 'approved' }), NOW)).toBe(true);
        expect(isActivePeminjamanBooking(
            booking({
                status: 'approved',
                start_at: '2026-06-10T10:00:00+07:00',
                end_at: '2026-06-10T12:00:00+07:00',
            }),
            NOW,
        )).toBe(false);
    });

    it('treats rejected and cancelled as history-only', () => {
        expect(isActivePeminjamanBooking(booking({ status: 'rejected' }), NOW)).toBe(false);
        expect(isActivePeminjamanBooking(booking({ status: 'cancelled' }), NOW)).toBe(false);
    });
});

describe('renderPeminjamanTrackingCards', () => {
    it('renders an empty message without cards', () => {
        const html = renderPeminjamanTrackingCards([]);
        expect(html).toContain('Tidak ada pengajuan aktif');
        expect(html).not.toContain('data-action="open-peminjaman-detail"');
    });

    it('renders escaped booking data with the detail hook', () => {
        const html = renderPeminjamanTrackingCards([booking()]);
        expect(html).toContain('data-action="open-peminjaman-detail"');
        expect(html).toContain('data-booking-id="51"');
        expect(html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');
        expect(html).not.toContain('<script>unsafe()');
        expect(html).toContain('Peminjaman Ruangan');
        expect(html).toContain('Diajukan');
        expect(html).toContain('Menunggu pemeriksaan ketersediaan');
        expect(html).toContain('Lihat Detail');
    });

    it('uses the shared tracking-card shell with its own status vocabulary', () => {
        const html = renderPeminjamanTrackingCards([booking({ status: 'approved' })]);
        // The Administrasi Surat shell, reused verbatim.
        expect(html).toContain('data-tracking-status');
        expect(html).toContain('<article');
        // Stage labels come from the Peminjaman vocabulary, never the letter chain.
        expect(html).toContain('Disetujui');
        expect(html).not.toContain('Tendik');
        expect(html).not.toContain('Prodi');
        expect(html).not.toContain('Departemen');
        expect(html).not.toContain('Tinjau<br>Dokumen');
    });

    it('surfaces the revision note and next action for revision_requested', () => {
        const html = renderPeminjamanTrackingCards([
            booking({ status: 'revision_requested', revision_note: 'Perbaiki peserta.' }),
        ]);
        expect(html).toContain('Catatan Revisi');
        expect(html).toContain('Perbaiki peserta.');
        expect(html).toContain('Perlu perbaikan sebelum pengajuan dikirim ulang.');
        expect(html).toContain('Lihat Detail');
    });
});

describe('renderPeminjamanRiwayatSection', () => {
    it('renders history rows with Peminjaman status labels', () => {
        const html = renderPeminjamanRiwayatSection(
            [booking({ status: 'approved' }), booking({ id: 52, status: 'rejected' })],
            null,
        );
        expect(html).toContain('Peminjaman Ruangan');
        expect(html).toContain('Disetujui');
        expect(html).toContain('Ditolak');
        expect(html).toContain('data-booking-id="51"');
        expect(html).toContain('data-booking-id="52"');
        expect(html).not.toContain('<script>unsafe()');
        // Peminjaman must not inherit Administrasi Surat workflow wording.
        expect(html).not.toContain('Kaprodi');
        expect(html).not.toContain('Kadep');
    });

    it('renders empty and error states', () => {
        expect(renderPeminjamanRiwayatSection([], null))
            .toContain('Belum ada riwayat peminjaman ruangan.');
        expect(renderPeminjamanRiwayatSection([], 'Riwayat peminjaman gagal dimuat.'))
            .toContain('Riwayat peminjaman gagal dimuat.');
    });
});

describe('renderSuratPeminjamanPanel', () => {
    it('renders attachment metadata with preview and download actions', () => {
        const html = renderSuratPeminjamanPanel(booking({
            status: 'approved',
            surat_peminjaman_pdf: {
                exists: true,
                original_name: 'Surat Final <x>.pdf',
                size_bytes: 204800,
                uploaded_at: '2026-06-18T10:00:00+07:00',
            },
        }));
        expect(html).toContain('Surat Peminjaman');
        expect(html).toContain('Surat Final &lt;x&gt;.pdf');
        expect(html).toContain('200.0 KB');
        expect(html).toContain('id="peminjaman-surat-preview"');
        expect(html).toContain('id="peminjaman-surat-download"');
        // Approved (non-revision) → no replacement uploader, and never a raw URL.
        expect(html).not.toContain('peminjaman-surat-replace-input');
        expect(html).not.toContain('/storage');
        expect(html).not.toContain('http');
    });

    it('shows a safe empty state for legacy rows without attachment metadata', () => {
        const html = renderSuratPeminjamanPanel(booking({ status: 'approved' }));
        expect(html).toContain('Surat peminjaman belum tersedia.');
        expect(html).not.toContain('id="peminjaman-surat-preview"');
        expect(html).not.toContain('id="peminjaman-surat-download"');
    });

    it('shows the replacement uploader only for revision_requested', () => {
        expect(renderSuratPeminjamanPanel(booking({ status: 'revision_requested' })))
            .toContain('id="peminjaman-surat-replace-input"');
        expect(renderSuratPeminjamanPanel(booking({ status: 'submitted' })))
            .not.toContain('id="peminjaman-surat-replace-input"');
        expect(renderSuratPeminjamanPanel(booking({ status: 'rejected' })))
            .not.toContain('id="peminjaman-surat-replace-input"');
    });

    it('is embedded inside the booking detail dialog', () => {
        const html = renderBookingDetailDialog(
            booking({ status: 'revision_requested' }),
            false,
            null,
            false,
        );
        expect(html).toContain('Surat Peminjaman');
        expect(html).toContain('id="peminjaman-surat-replace-submit"');
    });
});
