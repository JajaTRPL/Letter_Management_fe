import { renderDashboardLayout } from '../../dashboard/DashboardLayout';
import { buttonClass, SPINNER_CLASS, surfaceClass } from '../../shared/design-system';
import {
    formatIndonesianDate,
    formatIsoDateKeyInJakarta,
    formatTimeRange,
    getRoomTypeLabel,
    parseDateKey,
} from '../../shared/peminjaman-calendar';
import { getMahasiswaBookings } from './api';
import { closePeminjamanDetail, openPeminjamanBookingDetail } from './detail';
import { navigateLazily } from './navigation';
import { escapeHtml } from './views';
import {
    bookingLifecycleStatus,
    getCancellationRequestLabel,
    getLifecycleStatusLabel,
    getLifecycleStatusTone,
} from './workflow';
import type { MahasiswaBooking } from './types';

/**
 * Mahasiswa booking list ("Pengajuan Saya") — the dedicated tracking surface
 * inside the Peminjaman Ruangan area (C7C1). Read-only: every mutation flows
 * through the shared detail controller so list/detail behavior stays single-
 * sourced.
 */

let listSequence = 0;

const scheduleText = (booking: MahasiswaBooking): string => {
    const occurrences = booking.occurrences ?? [];
    const first = occurrences[0];
    const last = occurrences[occurrences.length - 1];
    if (first && last) {
        const startLabel = formatIndonesianDate(parseDateKey(first.date));
        const endLabel = formatIndonesianDate(parseDateKey(last.date));
        return `${startLabel}${first.date === last.date ? '' : ` – ${endLabel}`} · ${formatTimeRange(first.start_at, first.end_at)}${occurrences.length > 1 ? ' setiap hari' : ''}`;
    }
    const dateKey = formatIsoDateKeyInJakarta(booking.start_at);
    const date = dateKey ? formatIndonesianDate(parseDateKey(dateKey)) : '-';
    return `${date} · ${formatTimeRange(booking.start_at, booking.end_at)}`;
};

const renderBookingCard = (booking: MahasiswaBooking): string => {
    const lifecycle = bookingLifecycleStatus(booking);
    const iteration = booking.submission_iteration ?? 1;
    const pendingCancellation = booking.cancellation_request?.status === 'pending';

    return `
        <article class="${surfaceClass('card', 'flex h-full flex-col gap-3 p-5')}">
            <div class="flex flex-wrap items-start justify-between gap-2">
                <p class="text-xs font-bold text-gray-400">Pengajuan #${booking.id}</p>
                <div class="flex flex-wrap items-center justify-end gap-1.5">
                    <span class="rounded-full border px-2.5 py-1 text-[11px] font-bold ${getLifecycleStatusTone(lifecycle)}">${escapeHtml(getLifecycleStatusLabel(lifecycle))}</span>
                    ${iteration > 1 ? `<span class="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Pengajuan ke-${iteration}</span>` : ''}
                </div>
            </div>
            <div class="min-w-0">
                <h3 class="break-words text-base font-bold text-gray-800">${escapeHtml(booking.room.code)} · ${escapeHtml(booking.room.name)}</h3>
                <p class="mt-0.5 text-xs text-gray-500">${getRoomTypeLabel(booking.room.type)}</p>
            </div>
            <p class="break-words text-sm font-semibold text-gray-700">${escapeHtml(booking.activity_name)}</p>
            <p class="text-xs text-gray-500">${escapeHtml(scheduleText(booking))}</p>
            ${booking.occurrence_summary ? `<div class="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2"><p class="text-xs font-bold text-teal-900">${escapeHtml(booking.occurrence_summary.progress_label)}</p>${booking.occurrence_summary.nearest_deadline ? `<p class="mt-1 text-[11px] text-teal-800">Tenggat terdekat ${escapeHtml(new Date(booking.occurrence_summary.nearest_deadline).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))}</p>` : ''}</div>` : ''}
            ${pendingCancellation ? `<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">${escapeHtml(getCancellationRequestLabel('pending'))}</p>` : ''}
            ${booking.status === 'revision_requested' && booking.revision_note ? `<p class="break-words rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-1.5 text-[11px] text-amber-800">Catatan revisi: ${escapeHtml(booking.revision_note)}</p>` : ''}
            <button type="button" data-action="open-peminjaman-detail" data-booking-id="${booking.id}" class="${buttonClass(booking.occurrences?.some((occurrence) => occurrence.capabilities.can_submit_return || occurrence.capabilities.can_resubmit_return) ? 'primary' : 'secondary', 'sm', 'mt-auto w-full')}">${booking.occurrences?.some((occurrence) => occurrence.capabilities.can_submit_return || occurrence.capabilities.can_resubmit_return) ? 'Tindak Lanjut Pengembalian' : 'Lihat Detail'}</button>
        </article>
    `;
};

const renderListState = (
    bookings: readonly MahasiswaBooking[] | null,
    loading: boolean,
    error: string | null,
): string => {
    if (loading) {
        return `
            <div data-state="loading" class="${surfaceClass('card', 'px-6 py-16 text-center')}">
                <div class="mx-auto h-10 w-10 ${SPINNER_CLASS}" aria-hidden="true"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat pengajuan peminjaman...</p>
            </div>
        `;
    }
    if (error) {
        return `
            <div data-state="error" role="alert" class="${surfaceClass('card', 'px-6 py-14 text-center')}">
                <h3 class="text-base font-bold text-gray-800">Daftar pengajuan belum dapat dimuat</h3>
                <p class="mt-2 text-sm text-gray-500">${escapeHtml(error)}</p>
                <button id="peminjaman-list-retry" type="button" class="${buttonClass('primary', 'md', 'mt-5')}">Coba Lagi</button>
            </div>
        `;
    }
    if (!bookings || bookings.length === 0) {
        return `
            <div data-state="empty" class="${surfaceClass('card', 'px-6 py-16 text-center')}">
                <h3 class="text-base font-bold text-gray-800">Belum ada pengajuan peminjaman</h3>
                <p class="mt-2 text-sm text-gray-500">Pengajuan baru akan tampil di sini setelah dikirim.</p>
                <button id="peminjaman-list-create-empty" type="button" class="${buttonClass('primary', 'md', 'mt-5')}">Ajukan Peminjaman</button>
            </div>
        `;
    }

    return `
        <div data-state="success" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            ${bookings.map((booking) => renderBookingCard(booking)).join('')}
        </div>
    `;
};

const renderShell = (): string => `
    <div class="mx-auto max-w-6xl space-y-6 pb-12 animate-fade-in">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <h2 class="text-3xl font-bold text-gray-800 tracking-tight">Pengajuan Saya</h2>
                <p class="mt-2 text-gray-500">Seluruh pengajuan peminjaman ruangan Anda beserta status terkininya.</p>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
                <button id="peminjaman-list-back" type="button" class="${buttonClass('outline', 'sm')}">Ke Peminjaman Ruangan</button>
                <button id="peminjaman-list-create" type="button" class="${buttonClass('primary', 'sm')}">Ajukan Peminjaman</button>
            </div>
        </div>
        <div id="peminjaman-list-root" aria-live="polite"></div>
    </div>
`;

const navigateToApplication = (): void => {
    closePeminjamanDetail();
    void navigateLazily(
        () => import('./application-page')
            .then(({ renderPeminjamanApplicationPage }) => renderPeminjamanApplicationPage()),
        'Ajukan Peminjaman',
    );
};

const navigateToLanding = (): void => {
    closePeminjamanDetail();
    void navigateLazily(
        () => import('../PeminjamanRuangan')
            .then(({ renderPeminjamanRuangan }) => renderPeminjamanRuangan()),
        'Peminjaman Ruangan',
    );
};

const loadList = async (): Promise<void> => {
    const sequence = ++listSequence;
    const root = document.getElementById('peminjaman-list-root');
    if (!root) return;
    root.innerHTML = renderListState(null, true, null);

    try {
        const bookings = await getMahasiswaBookings();
        if (sequence !== listSequence) return;
        const sorted = [...bookings].sort((left, right) =>
            new Date(right.created_at ?? right.start_at).getTime()
            - new Date(left.created_at ?? left.start_at).getTime());
        root.innerHTML = renderListState(sorted, false, null);
        attachListListeners();
    } catch (error) {
        if (sequence !== listSequence) return;
        root.innerHTML = renderListState(
            null,
            false,
            error instanceof Error ? error.message : 'Gagal memuat daftar pengajuan.',
        );
        document.getElementById('peminjaman-list-retry')?.addEventListener('click', () => {
            void loadList();
        });
    }
};

const attachListListeners = (): void => {
    document.querySelectorAll<HTMLElement>('[data-action="open-peminjaman-detail"]').forEach((button) => {
        button.addEventListener('click', () => {
            const bookingId = Number(button.dataset.bookingId);
            if (!Number.isInteger(bookingId)) return;
            void openPeminjamanBookingDetail(bookingId, {
                onMutated: () => {
                    void loadList();
                },
            });
        });
    });
    document.getElementById('peminjaman-list-create-empty')?.addEventListener('click', navigateToApplication);
};

export const renderPeminjamanListPage = async (): Promise<void> => {
    closePeminjamanDetail();
    renderDashboardLayout(
        'Peminjaman Ruangan',
        renderShell(),
        'mahasiswa',
        'peminjaman',
    );

    document.getElementById('peminjaman-list-back')?.addEventListener('click', navigateToLanding);
    document.getElementById('peminjaman-list-create')?.addEventListener('click', navigateToApplication);

    await loadList();
};
