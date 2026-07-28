import {
    formatIndonesianDate,
    formatIsoDateKeyInJakarta,
    formatTimeRange,
    getRoomTypeLabel,
    parseDateKey,
} from '../../shared/peminjaman-calendar';
import type {
    BookingFormErrors,
    BookingFormValues,
} from './workflow';
import {
    bookingLifecycleStatus,
    buildLifecycleTimeline,
    canCancelBooking,
    canEditBooking,
    canReplaceSuratPdf,
    canResubmitBooking,
    formatFileSize,
    getCancellationRequestLabel,
    getLifecycleStatusLabel,
    getLifecycleStatusTone,
    hasSuratPeminjamanPdf,
    isActiveLifecycleBooking,
    MAX_CANCELLATION_REASON_LENGTH,
    type LifecycleTimelineEntry,
} from './workflow';
import type {
    MahasiswaBooking,
    BookingOccurrence,
    Room,
    RoomType,
} from './types';
import { buttonClass, cx, surfaceClass, textClass } from '../../shared/design-system';
import { buildTrackingStages, renderTrackingCard } from '../../shared/ui-primitives';

export const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export interface RoomSummaryPresentation {
    coverUrl: string | null;
    facilities: string[];
    facilityCount: number;
    remainingFacilityCount: number;
    hasActiveTemplate: boolean;
}

/** Shared catalog/application projection for compact room summaries. */
export const roomSummaryPresentation = (
    room: Room,
    facilityLimit: number,
): RoomSummaryPresentation => {
    const facilities = (room.facilities_summary?.items ?? []).slice(0, facilityLimit);
    const facilityCount = room.facilities_summary?.count ?? facilities.length;

    return {
        coverUrl: room.cover_photo?.thumb_url ?? room.cover_photo?.display_url ?? null,
        facilities,
        facilityCount,
        remainingFacilityCount: Math.max(0, facilityCount - facilities.length),
        hasActiveTemplate: room.has_active_template === true,
    };
};

const inputClass = (hasError: boolean): string =>
    `w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors ${
        hasError
            ? 'border-red-300 bg-red-50/40 focus:border-red-500'
            : 'border-gray-200 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-50'
    }`;

const fieldError = (message?: string): string =>
    message ? `<p class="mt-1 text-xs font-medium text-red-600">${escapeHtml(message)}</p>` : '';

export interface SuratUploadState {
    fileName: string | null;
    sizeLabel?: string | null;
    error?: string;
}

export const renderBookingFormDialog = (
    rooms: readonly Room[],
    values: BookingFormValues,
    errors: BookingFormErrors,
    mode: 'create' | 'edit',
    submitting: boolean,
    surat: SuratUploadState = { fileName: null },
): string => {
    const selectedRoom = rooms.find((room) => String(room.id) === values.roomId);
    const title = mode === 'create'
        ? 'Ajukan Peminjaman Ruangan'
        : 'Perbaiki Pengajuan Peminjaman';

    return `
        <div data-workflow-overlay class="fixed inset-0 z-[210] bg-black/40"></div>
        <section role="dialog" aria-modal="true" aria-labelledby="peminjaman-form-title" class="fixed inset-y-0 right-0 z-[211] flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
            <header class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-teal-700">${mode === 'create' ? 'Pengajuan Baru' : 'Revisi Pengajuan'}</p>
                    <h2 id="peminjaman-form-title" class="mt-1 text-lg font-bold text-gray-900">${title}</h2>
                    <p class="mt-1 text-xs text-gray-500">Validasi frontend membantu pengisian; keputusan akhir tetap dilakukan backend.</p>
                </div>
                <button id="close-peminjaman-workflow" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Tutup formulir">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </header>
            <form id="peminjaman-booking-form" class="flex min-h-0 flex-1 flex-col">
                <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    ${errors.form ? `<div role="alert" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">${escapeHtml(errors.form)}</div>` : ''}
                    <div>
                        <label for="peminjaman-room-id" class="text-sm font-bold text-gray-700">Ruangan</label>
                        <select id="peminjaman-room-id" name="roomId" class="${inputClass(Boolean(errors.roomId))}">
                            <option value="">Pilih ruangan aktif</option>
                            ${rooms.map((room) => `
                                <option value="${room.id}" ${values.roomId === String(room.id) ? 'selected' : ''}>
                                    ${escapeHtml(room.code)} · ${escapeHtml(room.name)} (${getRoomTypeLabel(room.type)})
                                </option>
                            `).join('')}
                        </select>
                        ${fieldError(errors.roomId)}
                        <p id="peminjaman-room-capacity" class="mt-1 text-xs text-gray-500">${selectedRoom ? `Kapasitas maksimal ${selectedRoom.capacity} orang · ${escapeHtml(selectedRoom.location)}` : 'Pilih ruangan untuk melihat kapasitas.'}</p>
                    </div>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label for="peminjaman-date" class="text-sm font-bold text-gray-700">Tanggal</label>
                            <input id="peminjaman-date" name="date" type="date" value="${escapeHtml(values.date)}" class="${inputClass(Boolean(errors.date))}">
                            ${fieldError(errors.date)}
                        </div>
                        <div>
                            <label for="peminjaman-start-time" class="text-sm font-bold text-gray-700">Mulai</label>
                            <input id="peminjaman-start-time" name="startTime" type="time" value="${escapeHtml(values.startTime)}" class="${inputClass(Boolean(errors.startTime))}">
                            ${fieldError(errors.startTime)}
                        </div>
                        <div>
                            <label for="peminjaman-end-time" class="text-sm font-bold text-gray-700">Selesai</label>
                            <input id="peminjaman-end-time" name="endTime" type="time" value="${escapeHtml(values.endTime)}" class="${inputClass(Boolean(errors.endTime))}">
                            ${fieldError(errors.endTime)}
                        </div>
                    </div>
                    <div>
                        <label for="peminjaman-activity-name" class="text-sm font-bold text-gray-700">Nama Kegiatan</label>
                        <input id="peminjaman-activity-name" name="activityName" type="text" maxlength="255" value="${escapeHtml(values.activityName)}" class="${inputClass(Boolean(errors.activityName))}" placeholder="Contoh: Rapat koordinasi organisasi">
                        ${fieldError(errors.activityName)}
                    </div>
                    <div>
                        <label for="peminjaman-purpose" class="text-sm font-bold text-gray-700">Tujuan Peminjaman</label>
                        <textarea id="peminjaman-purpose" name="purpose" rows="4" maxlength="5000" class="${inputClass(Boolean(errors.purpose))}" placeholder="Jelaskan tujuan penggunaan ruangan.">${escapeHtml(values.purpose)}</textarea>
                        ${fieldError(errors.purpose)}
                    </div>
                    <div>
                        <label for="peminjaman-participant-count" class="text-sm font-bold text-gray-700">Jumlah Peserta</label>
                        <input id="peminjaman-participant-count" name="participantCount" type="number" min="1" value="${escapeHtml(values.participantCount)}" class="${inputClass(Boolean(errors.participantCount))}">
                        ${fieldError(errors.participantCount)}
                    </div>
                    ${mode === 'create' ? `
                    <div>
                        <label for="peminjaman-surat-pdf" class="text-sm font-bold text-gray-700">Surat Peminjaman Ruangan (PDF)</label>
                        <p id="peminjaman-surat-pdf-help" class="mt-1 text-xs leading-relaxed text-gray-500">Unggah surat peminjaman final dalam format PDF. Maksimal 5 MB. Pastikan surat sudah ditandatangani/disahkan sesuai kebutuhan.</p>
                        <div class="mt-2 flex flex-wrap items-center gap-3">
                            <input id="peminjaman-surat-pdf" name="surat_peminjaman_pdf" type="file" accept="application/pdf,.pdf" aria-describedby="peminjaman-surat-pdf-help" class="peer sr-only">
                            <label for="peminjaman-surat-pdf" class="cursor-pointer rounded-xl border border-primary-teal bg-white px-4 py-2 text-sm font-bold text-primary-teal transition-colors hover:bg-teal-50 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-50 peer-focus-visible:border-primary-teal">Pilih PDF</label>
                            ${surat.fileName ? '' : '<span class="text-xs text-gray-500">Belum ada file dipilih.</span>'}
                        </div>
                        ${surat.fileName ? `
                            <div class="mt-2 flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2">
                                <span class="min-w-0 truncate text-xs font-semibold text-gray-700">${escapeHtml(surat.fileName)}${surat.sizeLabel ? ` <span class="font-normal text-gray-500">· ${escapeHtml(surat.sizeLabel)}</span>` : ''}</span>
                                <button id="peminjaman-surat-clear" type="button" class="shrink-0 text-xs font-bold text-red-600 hover:underline">Hapus</button>
                            </div>
                        ` : ''}
                        ${fieldError(surat.error)}
                    </div>
                    ` : ''}
                    <div class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                        <p class="font-semibold">Jam selesai harus lebih dari jam mulai dan masih di hari yang sama.</p>
                        <p class="mt-1 text-amber-700">Untuk kegiatan yang melewati tengah malam, ajukan jadwal terpisah atau hubungi pengelola ruangan.</p>
                    </div>
                </div>
                <footer class="flex flex-col-reverse gap-2 border-t border-gray-100 px-6 py-4 sm:flex-row sm:justify-end">
                    <button id="cancel-peminjaman-workflow" type="button" class="${buttonClass('outline', 'sm')}">Batal</button>
                    <button id="submit-peminjaman-booking" type="submit" ${submitting ? 'disabled' : ''} class="${buttonClass('primary', 'sm')}">
                        ${submitting ? 'Menyimpan...' : mode === 'create' ? 'Kirim Pengajuan' : 'Simpan Perbaikan'}
                    </button>
                </footer>
            </form>
        </section>
    `;
};

const formatUpdatedDate = (value: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatSchedule = (start: string, end: string): string => {
    const dateKey = formatIsoDateKeyInJakarta(start);
    const date = dateKey ? formatIndonesianDate(parseDateKey(dateKey)) : '-';
    return `${date} · ${formatTimeRange(start, end)}`;
};

/**
 * Active = the requester still has something in-flight: waiting review, under
 * review, needs revision, or an approved booking that has not finished yet.
 * Terminal rejected/cancelled/expired/completed bookings are history-only.
 * Derived from the authoritative lifecycle status, never the stored one.
 */
export const isActivePeminjamanBooking = (
    booking: MahasiswaBooking,
    now = new Date(),
): boolean => isActiveLifecycleBooking(booking, now);

/**
 * Per-usage operational state → applicant-facing label + pill tone. Shared by
 * the dashboard tracking card and the booking detail dialog so one usage state
 * never reads two different ways.
 */
const occurrenceStatusPresentation = (occurrence: BookingOccurrence): { label: string; tone: string } => {
    const deadline = new Date(occurrence.return_due_at).toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    switch (occurrence.operational_status) {
        case 'scheduled': return { label: 'Akan digunakan', tone: 'border-gray-200 bg-gray-50 text-gray-700' };
        case 'key_issued': return { label: 'Kunci telah diserahkan', tone: 'border-blue-200 bg-blue-50 text-blue-700' };
        case 'in_use': return { label: 'Sedang digunakan', tone: 'border-blue-200 bg-blue-50 text-blue-700' };
        case 'return_due': return { label: `Kembalikan sebelum ${deadline} WIB`, tone: 'border-amber-200 bg-amber-50 text-amber-800' };
        case 'awaiting_verification': return { label: 'Menunggu verifikasi', tone: 'border-indigo-200 bg-indigo-50 text-indigo-700' };
        case 'revision_required': return { label: 'Perlu memperbaiki bukti', tone: 'border-amber-200 bg-amber-50 text-amber-800' };
        case 'returned_on_time': return { label: 'Selesai tepat waktu', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
        case 'returned_late': return { label: 'Selesai terlambat', tone: 'border-orange-200 bg-orange-50 text-orange-800' };
        case 'overdue': return { label: 'Pengembalian melewati tenggat', tone: 'border-red-200 bg-red-50 text-red-700' };
        case 'cancelled': return { label: 'Penggunaan dibatalkan', tone: 'border-gray-200 bg-gray-100 text-gray-600' };
        // A booking that is not approved owns occurrence rows for compatibility
        // only — never promise a key handover that cannot happen.
        case 'not_actionable': return { label: 'Belum berlaku', tone: 'border-gray-200 bg-gray-50 text-gray-600' };
        default: return { label: 'Status Tidak Dikenal', tone: 'border-gray-200 bg-gray-50 text-gray-600' };
    }
};

/**
 * Peminjaman stage rail. Every node label comes from the Peminjaman status
 * vocabulary itself (`getLifecycleStatusLabel`) — no invented stage names, and
 * never the Administrasi Surat reviewer chain. Only the rail's visual grammar
 * is shared with the letter cards.
 *   Diajukan → Sedang Ditinjau → Disetujui → Selesai
 */
const PEMINJAMAN_STAGE_LABELS = [
    getLifecycleStatusLabel('submitted'),
    getLifecycleStatusLabel('under_review'),
    getLifecycleStatusLabel('approved'),
    getLifecycleStatusLabel('completed'),
];

const buildPeminjamanStages = (lifecycle: string) => {
    // `completedThrough` = highest index rendered as done, `activeIndex` = the
    // in-progress node, `interrupt` = the attention marker replacing it.
    let completedThrough = 0; // "Diajukan" is always done for a tracked booking
    let activeIndex = 1;
    let interrupt: { label: string } | null = null;

    switch (lifecycle) {
        case 'submitted':
        case 'under_review': completedThrough = 0; activeIndex = 1; break;
        case 'approved':     completedThrough = 2; activeIndex = 3; break;
        case 'completed':    completedThrough = 3; activeIndex = -1; break;
        case 'revision_requested':
        case 'rejected':
        case 'cancelled':
        case 'expired':
            completedThrough = 0;
            activeIndex = 1;
            interrupt = { label: getLifecycleStatusLabel(lifecycle) };
            break;
        default:             completedThrough = 0; activeIndex = 1; break;
    }

    return buildTrackingStages(PEMINJAMAN_STAGE_LABELS, { completedThrough, activeIndex, interrupt });
};

/**
 * Dashboard active tracking cards. Renders through the SHARED tracking card in
 * ui-primitives, so a booking tile is the Administrasi Surat card exactly —
 * while keeping the Peminjaman status vocabulary (getLifecycleStatusLabel/Tone),
 * never the letter workflow's.
 */
export const renderPeminjamanTrackingCards = (
    bookings: readonly MahasiswaBooking[],
): string => {
    if (bookings.length === 0) {
        return `
            <div class="${surfaceClass('card', 'col-span-full px-6 py-10 text-center')}">
                <p class="text-base font-bold text-gray-900">Tidak ada pengajuan aktif</p>
                <p class="${cx(textClass.helper, 'mx-auto mt-2 max-w-xl')}">Semua pengajuan aktif sudah masuk riwayat atau belum ada peminjaman ruangan yang berjalan.</p>
            </div>
        `;
    }

    return bookings.map((booking) => {
        const lifecycle = bookingLifecycleStatus(booking);
        const nextStep = lifecycle === 'revision_requested'
            ? 'Perlu perbaikan sebelum pengajuan dikirim ulang.'
            : lifecycle === 'under_review'
                ? 'Sedang ditinjau oleh pengelola ruangan.'
                : lifecycle === 'approved'
                    ? 'Peminjaman ruangan sudah disetujui.'
                    : 'Menunggu pemeriksaan ketersediaan dan persetujuan ruangan.';

        const bodyHtml = `
            <p class="text-xs text-gray-500">${getRoomTypeLabel(booking.room.type)} · ${escapeHtml(formatSchedule(booking.start_at, booking.end_at))}</p>
            ${lifecycle === 'revision_requested' && booking.revision_note ? `
                <div class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <p class="text-xs font-semibold text-amber-800">Catatan Revisi: <span class="font-medium text-amber-700">${escapeHtml(booking.revision_note)}</span></p>
                </div>
            ` : ''}
            <div class="${surfaceClass('muted', 'rounded-xl px-4 py-3')}">
                <p class="text-sm font-semibold text-gray-800">${nextStep}</p>
                <p class="${cx(textClass.helper, 'mt-1')}">${lifecycle === 'revision_requested' ? 'Buka detail untuk memperbaiki dan mengirim ulang.' : 'Buka detail untuk melihat jadwal dan tindakan yang tersedia.'}</p>
            </div>
        `;

        return renderTrackingCard({
            badgeLabel: 'Peminjaman Ruangan',
            badgeTone: 'info',
            title: `${booking.room.code} · ${booking.room.name}`,
            subtitle: booking.activity_name,
            statusLabel: getLifecycleStatusLabel(lifecycle),
            statusToneClass: getLifecycleStatusTone(lifecycle),
            stages: buildPeminjamanStages(lifecycle),
            bodyHtml,
            actionsHtml: `
                <button type="button" data-action="open-peminjaman-detail" data-booking-id="${booking.id}" class="${buttonClass('secondary', 'sm', 'w-full')}">
                    Lihat Detail
                </button>
            `,
        });
    }).join('');
};

/**
 * Riwayat Pengajuan "Peminjaman Ruangan" section (all statuses, newest
 * first is the caller's responsibility). Separate from the letter list so
 * Peminjaman never inherits the Administrasi Surat workflow labels.
 */
export const renderPeminjamanRiwayatSection = (
    bookings: readonly MahasiswaBooking[],
    error: string | null,
): string => {
    let body: string;
    if (error) {
        body = `<p role="alert" class="px-8 py-10 text-center text-sm font-semibold text-red-700">${escapeHtml(error)}</p>`;
    } else if (bookings.length === 0) {
        body = '<p class="px-8 py-10 text-center text-sm text-gray-500">Belum ada riwayat peminjaman ruangan.</p>';
    } else {
        body = `
            <table class="w-full text-left font-['Inter']">
                <thead>
                    <tr class="bg-white border-b border-gray-50">
                        <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Tanggal Pengajuan</th>
                        <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Ruangan & Kegiatan</th>
                        <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Jadwal</th>
                        <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Status</th>
                        <th class="px-8 py-5 text-[13px] font-bold text-gray-700 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                    ${bookings.map((booking) => `
                        <tr class="transition-colors hover:bg-gray-50/50">
                            <td class="px-8 py-5 text-sm text-gray-500">${escapeHtml(formatUpdatedDate(booking.created_at))}</td>
                            <td class="px-8 py-5">
                                <p class="break-words text-sm font-semibold text-gray-800">${escapeHtml(booking.room.code)} · ${escapeHtml(booking.room.name)}</p>
                                <p class="mt-1 break-words text-xs text-gray-500">${escapeHtml(booking.activity_name)}</p>
                            </td>
                            <td class="px-8 py-5 text-xs text-gray-600">${escapeHtml(formatSchedule(booking.start_at, booking.end_at))}</td>
                            <td class="px-8 py-5"><span data-lifecycle-status class="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${getLifecycleStatusTone(bookingLifecycleStatus(booking))}">${escapeHtml(getLifecycleStatusLabel(bookingLifecycleStatus(booking)))}</span></td>
                            <td class="px-8 py-5 text-right">
                                <button type="button" data-action="open-peminjaman-detail" data-booking-id="${booking.id}" class="text-xs font-bold text-primary-teal hover:underline">Lihat Detail</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    return `
        <section class="space-y-4">
            <h3 class="text-xl font-bold text-gray-800">Peminjaman Ruangan</h3>
            <div class="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
                <div class="overflow-x-auto">${body}</div>
            </div>
        </section>
    `;
};

const detailRow = (label: string, value: string): string => `
    <div class="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 sm:grid-cols-[150px_1fr]">
        <dt class="text-xs font-bold uppercase tracking-wider text-gray-400">${label}</dt>
        <dd class="text-sm font-medium text-gray-700 break-words">${escapeHtml(value || '-')}</dd>
    </div>
`;

const primaryOccurrenceAction = (occurrence: BookingOccurrence): string => {
    if (occurrence.capabilities.can_submit_return || occurrence.capabilities.can_resubmit_return) {
        return `<button type="button" data-return-submit="${escapeHtml(occurrence.occurrence_ref)}" class="${buttonClass('primary', 'sm')}">${occurrence.capabilities.can_resubmit_return ? 'Perbaiki Bukti Pengembalian' : 'Kirim Bukti Pengembalian'}</button>`;
    }
    if (occurrence.capabilities.can_withdraw_return) {
        return `<button type="button" data-return-withdraw="${escapeHtml(occurrence.occurrence_ref)}" class="${buttonClass('outline', 'sm')}">Tarik Pengajuan Pengembalian</button>`;
    }
    return '';
};

const renderOccurrenceJourney = (booking: MahasiswaBooking): string => {
    const occurrences = booking.occurrences ?? [];
    if (occurrences.length === 0) return '';
    const nextActionOccurrence = occurrences.find((occurrence) =>
        occurrence.capabilities.can_submit_return
        || occurrence.capabilities.can_resubmit_return
        || occurrence.capabilities.can_withdraw_return);
    const nearest = booking.occurrence_summary?.nearest_deadline;

    return `
        <section class="rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
            <h3 class="text-sm font-bold text-gray-900">Tindakan berikutnya</h3>
            <p class="mt-1 text-xs text-gray-600">${escapeHtml(booking.occurrence_summary?.progress_label ?? `${occurrences.length} penggunaan`)}</p>
            ${nearest ? `<p class="mt-1 text-xs font-semibold text-gray-700">Tenggat terdekat: ${escapeHtml(formatSchedule(nearest, nearest))}</p>` : ''}
            ${nextActionOccurrence ? `<div class="mt-3">${primaryOccurrenceAction(nextActionOccurrence)}</div>` : '<p class="mt-2 text-xs font-semibold text-gray-700">Belum ada tindakan yang perlu dilakukan saat ini.</p>'}
        </section>
        <section>
            <h3 class="mb-3 text-sm font-bold text-gray-800">Ringkasan Ruangan dan Jadwal</h3>
            <dl>
                ${detailRow('Ruangan', `${booking.room.code} · ${booking.room.name}`)}
                ${detailRow('Rentang', formatSchedule(occurrences[0].start_at, occurrences[occurrences.length - 1].end_at))}
                ${detailRow('Pola', booking.booking_mode === 'consecutive_days' ? `${occurrences.length} hari berturut-turut` : 'Satu penggunaan')}
                ${detailRow('Kegiatan', booking.activity_name)}
            </dl>
        </section>
        <section>
            <h3 class="mb-3 text-sm font-bold text-gray-800">Daftar Tugas per Penggunaan</h3>
            <ol class="space-y-3">
                ${occurrences.map((occurrence) => {
                    const status = occurrenceStatusPresentation(occurrence);
                    return `<li data-occurrence-row="${escapeHtml(occurrence.occurrence_ref)}" class="rounded-xl border border-gray-100 p-3">
                        <div class="flex flex-wrap items-start justify-between gap-2">
                            <div><p class="text-sm font-bold text-gray-800">Penggunaan ${occurrence.sequence} · ${escapeHtml(formatIndonesianDate(parseDateKey(occurrence.date)))}</p><p class="mt-1 text-xs text-gray-500">${escapeHtml(formatTimeRange(occurrence.start_at, occurrence.end_at))} · Tenggat ${escapeHtml(formatTimeRange(occurrence.end_at, occurrence.return_due_at))}</p></div>
                            <span class="rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.tone}">${escapeHtml(status.label)}</span>
                        </div>
                        ${occurrence.key_issuance.issued ? `<p class="mt-2 text-xs text-gray-600">Kunci diserahkan ${escapeHtml(formatUpdatedDate(occurrence.key_issuance.issued_at))}${occurrence.key_issuance.issued_by?.name ? ` oleh ${escapeHtml(occurrence.key_issuance.issued_by.name)}` : ''}.</p>` : ''}
                    </li>`;
                }).join('')}
            </ol>
        </section>
        <section>
            <h3 class="mb-3 text-sm font-bold text-gray-800">Bukti dan Keputusan Pengembalian</h3>
            <div class="space-y-2">
                ${occurrences.map((occurrence) => occurrence.return ? `<div class="rounded-xl border border-gray-100 p-3 text-xs text-gray-600"><p class="font-bold text-gray-800">Penggunaan ${occurrence.sequence} · ${escapeHtml(occurrence.return.evidence.original_name)}</p><p class="mt-1">Dikirim ${escapeHtml(formatUpdatedDate(occurrence.return.submitted_at))} · ${escapeHtml(occurrence.return.status)}</p>${occurrence.return.decision_note ? `<p class="mt-1 text-amber-800">Catatan: ${escapeHtml(occurrence.return.decision_note)}</p>` : ''}<button type="button" data-return-preview="${escapeHtml(occurrence.occurrence_ref)}" class="mt-2 text-xs font-bold text-teal-700 hover:underline">Lihat bukti</button></div>` : `<p class="rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-500">Penggunaan ${occurrence.sequence}: bukti belum dikirim.</p>`).join('')}
            </div>
        </section>
    `;
};

const renderUsageTimeline = (booking: MahasiswaBooking): string => {
    const events = booking.usage_timeline ?? [];
    return `<section><h3 class="mb-3 text-sm font-bold text-gray-800">Linimasa Penggunaan dan Kunci</h3>${events.length === 0 ? '<p class="text-xs text-gray-500">Belum ada aktivitas penggunaan.</p>' : `<ol class="space-y-2">${events.map((event) => `<li class="rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-600"><span class="font-bold text-gray-800">${escapeHtml(event.label ?? event.type)}</span>${event.occurred_at ? ` · ${escapeHtml(formatUpdatedDate(event.occurred_at))}` : ''}</li>`).join('')}</ol>`}</section>`;
};

const renderTimeline = (entries: readonly LifecycleTimelineEntry[]): string => entries.length === 0
    ? '<p class="text-sm text-gray-500">Riwayat status belum tersedia.</p>'
    : `
        <ol class="space-y-4">
            ${entries.map((entry) => `
                <li class="relative border-l-2 border-teal-100 pl-4">
                    <span class="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-teal-600" aria-hidden="true"></span>
                    <p class="text-sm font-bold text-gray-800">${escapeHtml(entry.label)}</p>
                    <p class="mt-1 text-xs text-gray-500">${escapeHtml(formatUpdatedDate(entry.at))}</p>
                    ${entry.note ? `<p class="mt-2 text-sm text-gray-600 break-words">${escapeHtml(entry.note)}</p>` : ''}
                </li>
            `).join('')}
        </ol>
    `;

/**
 * Applicant-facing cancellation-request panel: rendered only when the API
 * returns a summary. Informational in C7C1 — creating/withdrawing the
 * request is C7C2 scope, so no interactive control appears here.
 */
const renderCancellationRequestPanel = (booking: MahasiswaBooking): string => {
    const request = booking.cancellation_request;
    if (!request) return '';

    const pending = request.status === 'pending';
    const tone = pending
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-gray-200 bg-gray-50 text-gray-700';

    return `
        <section data-cancellation-request-panel class="rounded-xl border px-4 py-3 ${tone}">
            <p class="text-sm font-bold">${escapeHtml(getCancellationRequestLabel(request.status))}</p>
            ${request.reason ? `<p class="mt-1 break-words text-xs">Alasan: ${escapeHtml(request.reason)}</p>` : ''}
            ${pending ? `<p class="mt-1 text-xs">Menunggu keputusan ${request.responsible_role === 'sarpras' ? 'Sarpras' : 'Kepala Lab'}. Status peminjaman belum berubah sampai permohonan diputuskan.</p>` : ''}
            ${request.decided_at && request.decision_note ? `<p class="mt-1 break-words text-xs">Catatan keputusan: ${escapeHtml(request.decision_note)}</p>` : ''}
        </section>
    `;
};

/**
 * Surat peminjaman panel for the booking detail: safe metadata + protected
 * preview/download actions, plus a revision-only replacement upload. Renders no
 * disk/path/storage URL — action buttons carry only the booking id and the
 * controller resolves the protected endpoint.
 */
export const renderSuratPeminjamanPanel = (
    booking: MahasiswaBooking,
    options: { allowReplace?: boolean } = {},
): string => {
    const meta = booking.surat_peminjaman_pdf ?? null;
    const exists = hasSuratPeminjamanPdf(booking);
    // Replacement is requester-only (backend enforces owner + revision).
    // Reviewer surfaces render the same panel with allowReplace:false so
    // preview access never implies upload/approval authority.
    const canReplace = (options.allowReplace ?? true) && canReplaceSuratPdf(booking);

    const metaBlock = exists ? `
        <div class="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="break-words text-sm font-bold text-gray-800">${escapeHtml(meta?.original_name || 'Surat Peminjaman.pdf')}</p>
                    <p class="mt-1 text-xs text-gray-500">${escapeHtml(formatFileSize(meta?.size_bytes))}${meta?.uploaded_at ? ` · Diunggah ${escapeHtml(formatUpdatedDate(meta.uploaded_at))}` : ''}</p>
                </div>
                <span class="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">PDF</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
                <button id="peminjaman-surat-preview" type="button" class="${buttonClass('secondary', 'sm')}">Pratinjau</button>
                <button id="peminjaman-surat-download" type="button" class="${buttonClass('outline', 'sm')}">Unduh</button>
            </div>
        </div>
    ` : `
        <div class="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">Surat peminjaman belum tersedia.</div>
    `;

    const replaceBlock = canReplace ? `
        <div class="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <label for="peminjaman-surat-replace-input" class="text-sm font-bold text-amber-900">${exists ? 'Ganti Surat Peminjaman PDF' : 'Unggah Surat Peminjaman PDF'}</label>
            <p class="mt-1 text-xs text-amber-700">Format PDF, maksimal 5 MB. Berlaku saat pengajuan berstatus perlu revisi.</p>
            <div class="mt-2 flex flex-wrap items-center gap-3">
                <input id="peminjaman-surat-replace-input" name="surat_peminjaman_pdf" type="file" accept="application/pdf,.pdf" class="peer sr-only">
                <label for="peminjaman-surat-replace-input" class="cursor-pointer rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-100 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-100">Pilih PDF</label>
            </div>
            <p id="peminjaman-surat-replace-feedback" class="mt-2 hidden text-xs font-medium" role="status"></p>
            <button id="peminjaman-surat-replace-submit" type="button" class="${buttonClass('primary', 'sm', 'mt-3')}">${exists ? 'Ganti Surat' : 'Unggah Surat'}</button>
        </div>
    ` : '';

    return `
        <section>
            <h3 class="mb-3 text-sm font-bold text-gray-800">Surat Peminjaman</h3>
            ${metaBlock}
            ${replaceBlock}
        </section>
    `;
};

export const renderBookingDetailDialog = (
    booking: MahasiswaBooking | null,
    loading: boolean,
    error: string | null,
    actionLoading: boolean,
): string => `
    <div data-workflow-overlay class="fixed inset-0 z-[210] bg-black/40"></div>
    <section role="dialog" aria-modal="true" aria-labelledby="peminjaman-detail-title" class="fixed inset-y-0 right-0 z-[211] flex h-full w-full max-w-[580px] flex-col bg-white shadow-2xl">
        <header class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
            <div>
                <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Pengajuan Saya</p>
                <h2 id="peminjaman-detail-title" class="mt-1 text-lg font-bold text-gray-900">Detail Peminjaman Ruangan</h2>
            </div>
            <button id="close-peminjaman-workflow" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Tutup detail">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </header>
        <div class="flex-1 overflow-y-auto px-6 py-5">
            ${loading ? '<p data-detail-state="loading" class="py-12 text-center text-sm font-bold text-gray-700">Memuat detail pengajuan...</p>' : ''}
            ${error ? `<div data-detail-state="error" class="rounded-xl border border-red-100 bg-red-50 px-4 py-4 text-sm font-medium text-red-700">${escapeHtml(error)}</div>` : ''}
            ${booking ? `
                <div data-detail-state="success" class="space-y-6">
                    ${renderOccurrenceJourney(booking)}
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h3 class="text-lg font-bold text-gray-900 break-words">${escapeHtml(booking.room.code)} · ${escapeHtml(booking.room.name)}</h3>
                            <p class="mt-1 text-xs text-gray-500">${getRoomTypeLabel(booking.room.type)} · Kapasitas ${booking.room.capacity} orang</p>
                        </div>
                        <div class="flex flex-col items-end gap-1">
                            <span data-lifecycle-status class="rounded-full border px-3 py-1 text-xs font-bold ${getLifecycleStatusTone(bookingLifecycleStatus(booking))}">${escapeHtml(getLifecycleStatusLabel(bookingLifecycleStatus(booking)))}</span>
                            ${(booking.submission_iteration ?? 1) > 1 ? `<span class="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">Pengajuan ke-${booking.submission_iteration}</span>` : ''}
                        </div>
                    </div>
                    ${renderCancellationRequestPanel(booking)}
                    <dl>
                        ${detailRow('Nomor Pengajuan', `#${booking.id}`)}
                        ${detailRow('Kegiatan', booking.activity_name)}
                        ${detailRow('Tujuan', booking.purpose)}
                        ${detailRow('Peserta', `${booking.participant_count} orang`)}
                        ${detailRow('Lokasi', booking.room.location)}
                        ${booking.review_started_at ? detailRow('Mulai Ditinjau', formatUpdatedDate(booking.review_started_at)) : ''}
                        ${booking.revision_note ? detailRow('Catatan Revisi', booking.revision_note) : ''}
                        ${booking.rejection_reason ? detailRow('Alasan Penolakan', booking.rejection_reason) : ''}
                        ${booking.cancellation_reason ? detailRow('Alasan Pembatalan', booking.cancellation_reason) : ''}
                    </dl>
                    ${renderSuratPeminjamanPanel(booking)}
                    <section>
                        <h3 class="mb-4 text-sm font-bold text-gray-800">Linimasa Persetujuan</h3>
                        ${renderTimeline(buildLifecycleTimeline(booking))}
                    </section>
                    ${renderUsageTimeline(booking)}
                </div>
            ` : ''}
        </div>
        ${booking ? `
            <footer class="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-4">
                ${canEditBooking(booking) ? '<button id="edit-peminjaman-booking" type="button" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700">Edit Revisi</button>' : ''}
                ${canResubmitBooking(booking) ? `<button id="resubmit-peminjaman-booking" type="button" ${actionLoading ? 'disabled' : ''} class="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">${actionLoading ? 'Mengirim...' : 'Kirim Ulang'}</button>` : ''}
                ${canCancelBooking(booking) ? '<button id="cancel-peminjaman-booking" type="button" class="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">Batalkan</button>' : ''}
            </footer>
        ` : ''}
    </section>
`;

export const renderCancelDialog = (
    booking: MahasiswaBooking,
    error: string | null,
    submitting: boolean,
): string => `
    <div data-workflow-overlay class="fixed inset-0 z-[220] bg-black/50"></div>
    <section role="dialog" aria-modal="true" aria-labelledby="peminjaman-cancel-title" class="fixed left-1/2 top-1/2 z-[221] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl">
        <header class="border-b border-gray-100 px-6 py-5">
            <h2 id="peminjaman-cancel-title" class="text-lg font-bold text-gray-900">Konfirmasi Pembatalan</h2>
            <p class="mt-1 text-sm text-gray-500">Pengajuan ${escapeHtml(booking.activity_name)} akan dibatalkan. Tindakan ini tidak menghapus riwayat.</p>
        </header>
        <form id="peminjaman-cancel-form" class="px-6 py-5">
            ${error ? `<div id="peminjaman-cancel-error" role="alert" class="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">${escapeHtml(error)}</div>` : ''}
            <label for="peminjaman-cancel-reason" class="text-sm font-bold text-gray-700">Alasan Pembatalan</label>
            <textarea id="peminjaman-cancel-reason" rows="4" maxlength="${MAX_CANCELLATION_REASON_LENGTH}"${error ? ' aria-invalid="true" aria-describedby="peminjaman-cancel-error peminjaman-cancel-reason-help"' : ' aria-describedby="peminjaman-cancel-reason-help"'} class="mt-2 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-400" placeholder="Tuliskan alasan pembatalan."></textarea>
            <p id="peminjaman-cancel-reason-help" class="mt-1 text-xs text-gray-500">Maksimal ${MAX_CANCELLATION_REASON_LENGTH} karakter.</p>
            <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button id="close-peminjaman-cancel" type="button" class="${buttonClass('outline', 'sm')}">Kembali</button>
                <button type="submit" ${submitting ? 'disabled' : ''} class="${buttonClass('danger', 'sm')}">${submitting ? 'Membatalkan...' : 'Ya, Batalkan'}</button>
            </div>
        </form>
    </section>
`;

export const roomTypeFromFilter = (
    filter: 'all' | RoomType,
): RoomType | undefined => filter === 'all' ? undefined : filter;

export const dateLabel = (dateKey: string): string =>
    formatIndonesianDate(parseDateKey(dateKey));
