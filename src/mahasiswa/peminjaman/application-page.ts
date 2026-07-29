import { renderDashboardLayout } from '../../dashboard/DashboardLayout';
import {
    buttonClass,
    inputClass as controlClass,
    SPINNER_CLASS,
    surfaceClass,
} from '../../shared/design-system';
import {
    formatIndonesianDate,
    formatIsoDateKeyInJakarta,
    formatTimeRange,
    getRoomTypeLabel,
    parseDateKey,
} from '../../shared/peminjaman-calendar';
import {
    createMahasiswaBooking,
    fetchRoomPhotoObjectUrl,
    generateRoomBookingIdempotencyKey,
    getPeminjamanAvailability,
    getPeminjamanRooms,
    isUncertainOutcome,
    PeminjamanApiError,
} from './api';
import { openPeminjamanBookingDetail } from './detail';
import { navigateLazily } from './navigation';
import { openRoomCatalogDetail } from './room-detail';
import { escapeHtml, roomSummaryPresentation } from './views';
import {
    bookingFormToPayload,
    buildOccurrenceDrafts,
    emptyBookingFormValues,
    formatFileSize,
    getLifecycleStatusLabel,
    validateBookingForm,
    validateSuratPdfFile,
    type BookingFormErrors,
    type BookingFormValues,
} from './workflow';
import type {
    AvailabilityItem,
    BookingPayload,
    MahasiswaBooking,
    Room,
    RoomType,
} from './types';

/**
 * Dedicated Mahasiswa booking application page (C7C1): three sections plus a
 * final review step. Replaces the previous create-modal entry; the modal
 * remains only for the C7C2 revision-edit flow. Field IDs intentionally match
 * the previous form so shared validation and muscle memory carry over.
 *
 * The page is render-function based like every other page in this app (no
 * history router exists); back/forward integration is limited to the existing
 * app convention.
 */

export interface ApplicationPageOptions {
    date?: string;
    preferredType?: RoomType;
    roomId?: number;
}

type SectionNumber = 1 | 2 | 3;

interface AvailabilityState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    items: AvailabilityItem[];
    key: string;
}

/**
 * `submission_outcome_unknown`: the create request failed in a way that does
 * NOT tell us whether the booking was persisted (network fault, 5xx, or a 2xx
 * body we cannot trust). The exact payload, PDF object, and idempotency key stay
 * frozen so an explicit retry can safely retrieve the original outcome.
 */
type SubmissionOutcome = 'idle' | 'submission_outcome_unknown';

interface SubmissionIntent {
    idempotencyKey: string;
    payload: BookingPayload;
    suratFile: File;
}

interface ApplicationState {
    section: SectionNumber;
    typeFilter: 'all' | RoomType;
    values: BookingFormValues;
    errors: BookingFormErrors;
    summaryErrors: string[];
    suratFile: File | null;
    suratFileName: string | null;
    suratSizeLabel: string | null;
    suratError?: string;
    submitting: boolean;
    submitted: MahasiswaBooking | null;
    conflictError: string | null;
    idempotencyConflict: string | null;
    outcome: SubmissionOutcome;
    submissionIntent: SubmissionIntent | null;
    reusableValidationKey: string | null;
    dirty: boolean;
    availability: AvailabilityState;
}

const SECTION_TITLES: Record<SectionNumber, string> = {
    1: 'Ruangan dan Jadwal',
    2: 'Kegiatan dan Dokumen',
    3: 'Periksa dan Konfirmasi',
};

const SECTION_ONE_FIELDS: Array<keyof BookingFormValues> = [
    'roomId', 'bookingMode', 'date', 'endDate', 'startTime', 'endTime',
];
const SECTION_TWO_FIELDS: Array<keyof BookingFormValues> = [
    'activityName', 'purpose', 'participantCount',
];

const FIELD_SECTION: Record<keyof BookingFormValues, SectionNumber> = {
    roomId: 1,
    bookingMode: 1,
    date: 1,
    endDate: 1,
    startTime: 1,
    endTime: 1,
    activityName: 2,
    purpose: 2,
    participantCount: 2,
};

const FIELD_INPUT_ID: Record<keyof BookingFormValues, string> = {
    roomId: 'peminjaman-room-id',
    bookingMode: 'peminjaman-booking-mode-single',
    date: 'peminjaman-date',
    endDate: 'peminjaman-end-date',
    startTime: 'peminjaman-start-time',
    endTime: 'peminjaman-end-time',
    activityName: 'peminjaman-activity-name',
    purpose: 'peminjaman-purpose',
    participantCount: 'peminjaman-participant-count',
};

let rooms: Room[] = [];
let state: ApplicationState = createInitialState();
// Generation counter for availability lookups. Bumped the instant ANY input
// that defines the query changes, so an in-flight response from a previous
// selection can never be applied (A → B → A must not accept the first A).
let availabilityGeneration = 0;
let availabilityTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFocusId: string | null = null;
let beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null = null;
let roomContextMediaUrl: string | null = null;
let roomContextObjectUrl: string | null = null;
let roomContextGeneration = 0;

function createInitialState(options: ApplicationPageOptions = {}): ApplicationState {
    return {
        section: 1,
        typeFilter: options.preferredType ?? 'all',
        values: emptyBookingFormValues(
            options.roomId !== undefined ? String(options.roomId) : '',
            options.date ?? '',
        ),
        errors: {},
        summaryErrors: [],
        suratFile: null,
        suratFileName: null,
        suratSizeLabel: null,
        submitting: false,
        submitted: null,
        conflictError: null,
        idempotencyConflict: null,
        outcome: 'idle',
        submissionIntent: null,
        reusableValidationKey: null,
        dirty: false,
        availability: { status: 'idle', items: [], key: '' },
    };
}

const detachUnloadGuard = (): void => {
    if (beforeUnloadHandler) {
        window.removeEventListener('beforeunload', beforeUnloadHandler);
        beforeUnloadHandler = null;
    }
};

const syncUnloadGuard = (): void => {
    const shouldGuard = state.dirty && !state.submitted;
    if (shouldGuard && !beforeUnloadHandler) {
        beforeUnloadHandler = (event: BeforeUnloadEvent): void => {
            // Self-heal: if the page's DOM is gone (sidebar navigation wiped
            // it), stop guarding instead of warning on an unrelated page.
            if (!document.getElementById('peminjaman-application-root')) {
                detachUnloadGuard();
                return;
            }
            event.preventDefault();
        };
        window.addEventListener('beforeunload', beforeUnloadHandler);
    } else if (!shouldGuard) {
        detachUnloadGuard();
    }
};

const confirmLeaveWithUnsavedChanges = (): boolean =>
    !state.dirty
    || state.submitted !== null
    || window.confirm('Perubahan yang belum dikirim akan hilang. Tinggalkan halaman ini?');

/**
 * Invalidate any availability lookup that is scheduled or in flight. Called
 * BEFORE the debounce timer is (re)armed, so the generation moves the moment
 * the user changes room/date/time — not 250 ms later.
 */
const invalidateAvailability = (): void => {
    availabilityGeneration += 1;
    if (availabilityTimer !== null) {
        clearTimeout(availabilityTimer);
        availabilityTimer = null;
    }
};

export const closePeminjamanApplicationPage = (): void => {
    detachUnloadGuard();
    invalidateAvailability();
    roomContextGeneration += 1;
    if (roomContextObjectUrl) URL.revokeObjectURL(roomContextObjectUrl);
    roomContextMediaUrl = null;
    roomContextObjectUrl = null;
};

// Delegates to the canonical control styling (shared/design-system) so every
// state — including invalid — carries the same focus ring. The local version
// this replaced only put a ring on the valid state; an invalid field lost focus
// visibility right when a keyboard user is most likely to land on it (post
// validation).
const inputClass = (hasError: boolean): string =>
    controlClass(hasError ? 'invalid' : 'default', hasError ? 'bg-red-50/40' : undefined);

const errorId = (field: keyof BookingFormValues): string =>
    `${FIELD_INPUT_ID[field]}-error`;

const fieldError = (id: string, message?: string): string =>
    message
        ? `<p id="${id}" class="mt-1 text-xs font-medium text-red-600">${escapeHtml(message)}</p>`
        : '';

/**
 * Assistive-tech wiring for one control: mark it invalid and point it at the
 * message that explains why, keeping any static helper text in the chain.
 */
const fieldAria = (
    field: keyof BookingFormValues,
    helperId?: string,
): string => {
    const invalid = Boolean(state.errors[field]);
    const describedBy = [
        ...(helperId ? [helperId] : []),
        ...(invalid ? [errorId(field)] : []),
    ];
    return `${invalid ? ' aria-invalid="true"' : ''}${
        describedBy.length > 0 ? ` aria-describedby="${describedBy.join(' ')}"` : ''
    }`;
};

const filteredRooms = (): Room[] =>
    state.typeFilter === 'all'
        ? rooms
        : rooms.filter((room) => room.type === state.typeFilter);

const selectedRoom = (): Room | undefined =>
    rooms.find((room) => String(room.id) === state.values.roomId);

const readFormValues = (): BookingFormValues => ({
    roomId: (document.getElementById('peminjaman-room-id') as HTMLSelectElement | null)?.value
        ?? state.values.roomId,
    bookingMode: (document.querySelector<HTMLInputElement>('input[name="peminjaman-booking-mode"]:checked'))?.value === 'consecutive_days'
        ? 'consecutive_days'
        : 'single_day',
    date: (document.getElementById('peminjaman-date') as HTMLInputElement | null)?.value
        ?? state.values.date,
    endDate: (document.getElementById('peminjaman-end-date') as HTMLInputElement | null)?.value
        ?? state.values.endDate,
    startTime: (document.getElementById('peminjaman-start-time') as HTMLInputElement | null)?.value
        ?? state.values.startTime,
    endTime: (document.getElementById('peminjaman-end-time') as HTMLInputElement | null)?.value
        ?? state.values.endTime,
    activityName: (document.getElementById('peminjaman-activity-name') as HTMLInputElement | null)?.value
        ?? state.values.activityName,
    purpose: (document.getElementById('peminjaman-purpose') as HTMLTextAreaElement | null)?.value
        ?? state.values.purpose,
    participantCount: (document.getElementById('peminjaman-participant-count') as HTMLInputElement | null)?.value
        ?? state.values.participantCount,
});

const pickErrors = (
    errors: BookingFormErrors,
    fields: readonly (keyof BookingFormValues)[],
): BookingFormErrors => {
    const subset: BookingFormErrors = {};
    fields.forEach((field) => {
        if (errors[field]) subset[field] = errors[field];
    });
    return subset;
};

const todayKey = (): string => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
};

// ── Availability (Phase 6) ─────────────────────────────────────────────────

const availabilityKey = (): string =>
    state.values.roomId && state.values.date
        && (state.values.bookingMode === 'single_day' || state.values.endDate)
        ? `${state.values.roomId}|${state.values.date}|${state.values.bookingMode === 'consecutive_days' ? state.values.endDate : state.values.date}`
        : '';

const scheduleAvailabilityCheck = (): void => {
    // Any pending/in-flight lookup belongs to the previous selection: kill it
    // first, then decide what the new selection needs.
    invalidateAvailability();

    const key = availabilityKey();
    if (!key) {
        state.availability = { status: 'idle', items: [], key: '' };
        renderAvailabilityBox();
        return;
    }
    if (state.availability.key === key && state.availability.status === 'ready') {
        // Already resolved for exactly this room+date — reuse, no request.
        renderAvailabilityBox();
        return;
    }

    const generation = availabilityGeneration;
    state.availability = { status: 'loading', items: [], key };
    renderAvailabilityBox();
    availabilityTimer = setTimeout(() => {
        void runAvailabilityCheck(key, generation);
    }, 250);
};

const runAvailabilityCheck = async (
    key: string,
    generation: number,
): Promise<void> => {
    const [roomId, date, endDate] = key.split('|');
    try {
        const items = await getPeminjamanAvailability({
            from: date,
            to: endDate || date,
            roomId: Number(roomId),
        });
        // Stale-response protection: only the current generation may land, so a
        // response from a selection the user has already moved away from — even
        // one whose key happens to match again (A → B → A) — is discarded.
        if (generation !== availabilityGeneration) return;
        state.availability = { status: 'ready', items, key };
    } catch {
        if (generation !== availabilityGeneration) return;
        state.availability = { status: 'error', items: [], key };
    }
    renderAvailabilityBox();
};

const overlappingAvailability = (
    category: AvailabilityItem['lifecycle_category'],
): AvailabilityItem[] => {
    const ranges = buildOccurrenceDrafts(state.values);
    if (ranges.length === 0 || state.availability.status !== 'ready') return [];
    return state.availability.items.filter((item) => {
        const itemStart = new Date(item.start_at).getTime();
        const itemEnd = new Date(item.end_at).getTime();
        return item.lifecycle_category === category
            && ranges.some((range) => itemStart < new Date(range.endAt).getTime()
                && itemEnd > new Date(range.startAt).getTime());
    });
};

const conflictingApproved = (): AvailabilityItem[] =>
    overlappingAvailability('approved');

const renderAvailabilitySlots = (
    items: AvailabilityItem[],
    category: AvailabilityItem['lifecycle_category'],
): string => {
    if (items.length === 0) return '';
    const heading = category === 'approved'
        ? 'Jadwal disetujui'
        : 'Pengajuan lain yang masih diproses';
    const tone = category === 'approved' ? 'text-emerald-800' : 'text-amber-800';

    return `
        <section class="rounded-lg border border-gray-100 bg-white px-3 py-2.5" aria-label="${heading}">
            <p class="text-xs font-bold ${tone}">${heading} (${items.reduce((sum, item) => sum + item.request_count, 0)})</p>
            <ul class="mt-1.5 space-y-1.5">
                ${items.map((item) => {
                    const visibleTitles = category === 'pending'
                        ? item.activity_titles.slice(0, 2)
                        : item.activity_titles;
                    const hiddenCount = Math.max(0, item.request_count - visibleTitles.length);
                    return `
                    <li class="text-xs leading-relaxed text-gray-600">
                        <span class="font-semibold text-gray-800">${escapeHtml(formatTimeRange(item.start_at, item.end_at))}</span>
                        <ul class="mt-1 list-disc space-y-0.5 pl-5">
                            ${visibleTitles.map((title) => `<li>${escapeHtml(title)}</li>`).join('')}
                            ${hiddenCount > 0 ? `<li class="font-semibold text-amber-700">+${hiddenCount} pengajuan lainnya</li>` : ''}
                        </ul>
                    </li>
                `; }).join('')}
            </ul>
        </section>
    `;
};

const availabilityPanelDates = (): string[] => {
    if (!state.values.date) return [];
    const end = state.values.bookingMode === 'consecutive_days' && state.values.endDate
        ? state.values.endDate
        : state.values.date;
    const startMs = new Date(`${state.values.date}T00:00:00Z`).getTime();
    const endMs = new Date(`${end}T00:00:00Z`).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return [];
    return Array.from(
        { length: Math.floor((endMs - startMs) / 86_400_000) + 1 },
        (_, index) => new Date(startMs + index * 86_400_000).toISOString().slice(0, 10),
    );
};

const renderAvailabilityContent = (): string => {
    const { status, items } = state.availability;
    if (!availabilityKey()) {
        return '<p class="text-xs text-gray-500">Pilih ruangan dan tanggal untuk melihat jadwal disetujui serta permintaan lain yang masih diproses.</p>';
    }
    if (status === 'loading') {
        return `<p data-availability-state="loading" class="flex items-center gap-2 text-xs font-semibold text-gray-600"><span class="h-4 w-4 ${SPINNER_CLASS}" aria-hidden="true"></span>Memeriksa ketersediaan...</p>`;
    }
    if (status === 'error') {
        return `
            <div data-availability-state="error">
                <p role="alert" class="text-xs font-semibold text-amber-800">Ketersediaan belum dapat diperiksa. Status jadwal belum terkonfirmasi; pemeriksaan konflik final tetap dilakukan saat pengajuan dikirim.</p>
                <button id="peminjaman-availability-retry" type="button" class="mt-2 text-xs font-bold text-teal-700 hover:underline">Periksa Ulang</button>
            </div>
        `;
    }

    const drafts = buildOccurrenceDrafts(state.values);
    const panels = availabilityPanelDates().map((date) => {
        const draft = drafts.find((candidate) => candidate.date === date);
        const dayItems = items.filter((item) => formatIsoDateKeyInJakarta(item.start_at) === date);
        const approved = dayItems.filter((item) => item.lifecycle_category === 'approved');
        const pending = dayItems.filter((item) => item.lifecycle_category === 'pending');
        const rangeStart = draft ? new Date(draft.startAt).getTime() : null;
        const rangeEnd = draft ? new Date(draft.endAt).getTime() : null;
        const overlaps = (candidate: AvailabilityItem): boolean =>
            rangeStart !== null && rangeEnd !== null
            && new Date(candidate.start_at).getTime() < rangeEnd
            && new Date(candidate.end_at).getTime() > rangeStart;
        const conflicts = approved.filter(overlaps);
        const pendingOverlap = pending.filter(overlaps);
        const dateLabel = formatIndonesianDate(parseDateKey(date));

        return `
            <section data-occurrence-availability="${date}" class="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                <p class="text-xs font-bold text-gray-800">${escapeHtml(dateLabel)} · ${approved.reduce((sum, item) => sum + item.request_count, 0)} disetujui · ${pending.reduce((sum, item) => sum + item.request_count, 0)} masih diproses</p>
                ${dayItems.length === 0
                    ? '<p data-availability-state="empty" class="mt-2 text-xs font-semibold text-emerald-700">Belum ada jadwal disetujui atau pengajuan aktif.</p>'
                    : `<div class="mt-2 space-y-2">${renderAvailabilitySlots(approved, 'approved')}${renderAvailabilitySlots(pending, 'pending')}</div>`}
                ${conflicts.length > 0
                    ? `<p data-availability-state="hard-conflict" role="alert" class="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Bentrok pada ${escapeHtml(dateLabel)}: ${conflicts.map((item) => escapeHtml(formatTimeRange(item.start_at, item.end_at))).join(', ')}. Ubah rentang atau waktu sebelum melanjutkan.</p>`
                    : ''}
                ${conflicts.length === 0 && pendingOverlap.length > 0
                    ? `<p data-availability-state="soft-warning" class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Ada ${pendingOverlap.reduce((sum, item) => sum + item.request_count, 0)} pengajuan lain pada waktu ini. Anda tetap boleh melanjutkan, tetapi persetujuan ruang belum pasti.</p>`
                    : ''}
            </section>
        `;
    }).join('');

    return `<div data-availability-state="ready" class="space-y-2">${panels || '<p class="text-xs text-gray-500">Lengkapi pola tanggal dan waktu untuk melihat ketersediaan.</p>'}</div>`;
};

const renderAvailabilityBox = (): void => {
    const box = document.getElementById('peminjaman-availability');
    if (!box) return;
    box.innerHTML = renderAvailabilityContent();
    document.getElementById('peminjaman-availability-retry')?.addEventListener('click', () => {
        invalidateAvailability();
        const key = availabilityKey();
        const generation = availabilityGeneration;
        state.availability = { status: 'loading', items: [], key };
        renderAvailabilityBox();
        void runAvailabilityCheck(key, generation);
    });
};

// ── Section markup ─────────────────────────────────────────────────────────

const renderStepper = (): string => `
    <ol class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0" aria-label="Tahapan pengajuan">
        ${([1, 2, 3] as const).map((step, index) => `
            <li class="flex items-center gap-2 ${index < 2 ? 'sm:flex-1' : ''}" ${state.section === step ? 'aria-current="step"' : ''}>
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${state.section === step ? 'bg-teal-700 text-white' : state.section > step ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-500'}">${state.section > step ? '✓' : step}</span>
                <span class="text-xs font-bold ${state.section === step ? 'text-teal-800' : 'text-gray-500'}">${SECTION_TITLES[step]}</span>
                ${index < 2 ? '<span class="mx-3 hidden h-px flex-1 bg-gray-200 sm:block" aria-hidden="true"></span>' : ''}
            </li>
        `).join('')}
    </ol>
`;

const renderErrorSummary = (): string => {
    if (state.summaryErrors.length === 0) return '';
    return `
        <div id="peminjaman-error-summary" role="alert" tabindex="-1" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p class="text-sm font-bold text-red-800">Pengajuan belum dapat dikirim:</p>
            <ul class="mt-1.5 list-disc space-y-1 pl-5">
                ${state.summaryErrors.map((message) => `<li class="text-xs font-medium text-red-700">${escapeHtml(message)}</li>`).join('')}
            </ul>
        </div>
    `;
};

const renderSelectedRoomContext = (room?: Room): string => {
    if (!room) {
        return `
            <div id="peminjaman-room-context" class="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                <p class="text-sm font-semibold text-gray-700">Pilih ruangan untuk melihat konteks lengkapnya.</p>
                <p class="mt-1 text-xs text-gray-500">Foto, kapasitas, laboratorium, fasilitas, dan template akan tampil di sini.</p>
            </div>
        `;
    }

    const summary = roomSummaryPresentation(room, 5);

    return `
        <article id="peminjaman-room-context" class="grid min-w-0 overflow-hidden rounded-2xl border border-teal-100 bg-teal-50/40 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div class="relative min-h-36 overflow-hidden bg-gray-100 sm:min-h-full" data-room-context-media${summary.coverUrl ? ` data-media-url="${escapeHtml(summary.coverUrl)}"` : ''}>
                <div data-room-context-placeholder class="flex h-full min-h-36 flex-col items-center justify-center gap-2 px-4 text-center text-gray-400">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>
                    <span class="text-xs font-semibold">Foto ruangan belum tersedia</span>
                </div>
            </div>
            <div class="min-w-0 p-4 sm:p-5">
                <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Ruangan terpilih</p>
                <h4 class="mt-1 break-words text-base font-bold text-gray-900">${escapeHtml(room.code)} · ${escapeHtml(room.name)}</h4>
                <p class="mt-1 text-xs leading-relaxed text-gray-600">${escapeHtml(getRoomTypeLabel(room.type))} · ${escapeHtml(room.location)} · Kapasitas ${room.capacity} orang</p>
                <p class="mt-1 text-xs text-gray-600">${room.owning_laboratory ? `Laboratorium ${escapeHtml(room.owning_laboratory.name)}` : 'Tidak terikat laboratorium tertentu'}</p>
                <div class="mt-3 flex flex-wrap gap-1.5" aria-label="Ringkasan fasilitas">
                    ${summary.facilities.map((facility) => `<span class="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600">${escapeHtml(facility)}</span>`).join('')}
                    ${summary.remainingFacilityCount > 0 ? `<span class="px-1 py-1 text-[10px] font-semibold text-gray-500">+${summary.remainingFacilityCount} lainnya</span>` : ''}
                    ${summary.facilityCount === 0 ? '<span class="text-xs text-gray-500">Fasilitas belum dicatat.</span>' : ''}
                </div>
                <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span class="text-xs font-semibold ${summary.hasActiveTemplate ? 'text-teal-700' : 'text-gray-500'}">${summary.hasActiveTemplate ? 'Template surat tersedia' : 'Template surat belum tersedia'}</span>
                    <button id="peminjaman-room-detail" type="button" class="rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50">Lihat detail ruangan</button>
                </div>
            </div>
        </article>
    `;
};

const hydrateSelectedRoomContext = (): void => {
    const room = selectedRoom();
    const mediaUrl = room ? roomSummaryPresentation(room, 5).coverUrl : null;
    const container = document.querySelector<HTMLElement>('[data-room-context-media]');
    if (!container || !room || !mediaUrl) {
        if (roomContextMediaUrl !== mediaUrl) {
            roomContextGeneration += 1;
            if (roomContextObjectUrl) URL.revokeObjectURL(roomContextObjectUrl);
            roomContextMediaUrl = mediaUrl;
            roomContextObjectUrl = null;
        }
        return;
    }

    const applyImage = (objectUrl: string): void => {
        if (!container.isConnected || selectedRoom()?.id !== room.id) return;
        const image = document.createElement('img');
        image.src = objectUrl;
        image.alt = `Foto ${room.code} · ${room.name}`;
        image.className = 'h-full min-h-36 w-full object-cover';
        container.querySelector('[data-room-context-placeholder]')?.replaceWith(image);
    };

    if (roomContextMediaUrl === mediaUrl && roomContextObjectUrl) {
        applyImage(roomContextObjectUrl);
        return;
    }
    if (roomContextMediaUrl === mediaUrl) return;

    roomContextGeneration += 1;
    const generation = roomContextGeneration;
    if (roomContextObjectUrl) URL.revokeObjectURL(roomContextObjectUrl);
    roomContextObjectUrl = null;
    roomContextMediaUrl = mediaUrl;

    void fetchRoomPhotoObjectUrl(mediaUrl)
        .then((objectUrl) => {
            if (generation !== roomContextGeneration || selectedRoom()?.id !== room.id) {
                URL.revokeObjectURL(objectUrl);
                return;
            }
            roomContextObjectUrl = objectUrl;
            applyImage(objectUrl);
        })
        .catch(() => {
            // The labelled fallback remains visible when protected media fails.
        });
};

const renderOccurrencePreview = (): string => {
    const drafts = buildOccurrenceDrafts(state.values);
    if (drafts.length === 0) {
        return '<p class="text-xs text-gray-500">Lengkapi tanggal dan waktu untuk membuat pratinjau penggunaan.</p>';
    }
    const totalHours = drafts.reduce((sum, draft) => sum + draft.durationHours, 0);
    return `
        <div data-occurrence-preview class="rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs font-bold text-teal-900">Pratinjau penggunaan harian</p>
                <p class="text-xs font-semibold text-teal-800">${drafts.length} hari · ${totalHours.toFixed(totalHours % 1 === 0 ? 0 : 1)} jam total</p>
            </div>
            <ol class="mt-2 space-y-1.5">
                ${drafts.map((draft) => `<li class="text-xs text-gray-700"><span class="font-bold">${draft.sequence}.</span> ${escapeHtml(formatIndonesianDate(parseDateKey(draft.date)))} · ${escapeHtml(formatTimeRange(draft.startAt, draft.endAt))}</li>`).join('')}
            </ol>
        </div>
    `;
};

const renderSectionOne = (): string => {
    const room = selectedRoom();
    const options = filteredRooms();
    return `
        <section data-app-section="1" ${state.section === 1 ? '' : 'hidden'} aria-labelledby="peminjaman-section-1-title">
            <h3 id="peminjaman-section-1-title" tabindex="-1" class="text-base font-bold text-gray-800">1. ${SECTION_TITLES[1]}</h3>
            <div class="mt-4 space-y-4">
                <div>
                    <label for="peminjaman-room-type" class="text-sm font-bold text-gray-700">Jenis Ruangan</label>
                    <select id="peminjaman-room-type" class="${inputClass(false)}">
                        <option value="all" ${state.typeFilter === 'all' ? 'selected' : ''}>Semua jenis</option>
                        <option value="classroom" ${state.typeFilter === 'classroom' ? 'selected' : ''}>Ruang Kelas</option>
                        <option value="laboratory" ${state.typeFilter === 'laboratory' ? 'selected' : ''}>Ruang Laboratorium</option>
                    </select>
                </div>
                <div>
                    <label for="peminjaman-room-id" class="text-sm font-bold text-gray-700">Ruangan</label>
                    <select id="peminjaman-room-id"${fieldAria('roomId', 'peminjaman-room-capacity')} class="${inputClass(Boolean(state.errors.roomId))}">
                        <option value="">Pilih ruangan aktif</option>
                        ${options.map((option) => `
                            <option value="${option.id}" ${state.values.roomId === String(option.id) ? 'selected' : ''}>
                                ${escapeHtml(option.code)} · ${escapeHtml(option.name)} (${getRoomTypeLabel(option.type)})
                            </option>
                        `).join('')}
                    </select>
                    ${fieldError(errorId('roomId'), state.errors.roomId)}
                    <p id="peminjaman-room-capacity" class="mt-1 text-xs text-gray-500">${room
                        ? `Kapasitas maksimal ${room.capacity} orang · ${escapeHtml(room.location)}${room.owning_laboratory ? ` · Laboratorium ${escapeHtml(room.owning_laboratory.name)}` : ''}`
                        : 'Pilih ruangan untuk melihat kapasitas.'}</p>
                </div>
                <fieldset>
                    <legend class="text-sm font-bold text-gray-700">Pola Penggunaan</legend>
                    <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
                            <input id="peminjaman-booking-mode-single" name="peminjaman-booking-mode" type="radio" value="single_day" ${state.values.bookingMode === 'single_day' ? 'checked' : ''}>
                            Satu hari
                        </label>
                        <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
                            <input id="peminjaman-booking-mode-multi" name="peminjaman-booking-mode" type="radio" value="consecutive_days" ${state.values.bookingMode === 'consecutive_days' ? 'checked' : ''}>
                            Beberapa hari berturut-turut
                        </label>
                    </div>
                </fieldset>
                <div class="grid grid-cols-1 gap-4 ${state.values.bookingMode === 'consecutive_days' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}">
                    <div>
                        <label for="peminjaman-date" class="text-sm font-bold text-gray-700">${state.values.bookingMode === 'consecutive_days' ? 'Tanggal Mulai' : 'Tanggal'}</label>
                        <input id="peminjaman-date" type="date" value="${escapeHtml(state.values.date)}"${fieldAria('date')} class="${inputClass(Boolean(state.errors.date))}">
                        ${fieldError(errorId('date'), state.errors.date)}
                    </div>
                    ${state.values.bookingMode === 'consecutive_days' ? `
                        <div>
                            <label for="peminjaman-end-date" class="text-sm font-bold text-gray-700">Tanggal Selesai</label>
                            <input id="peminjaman-end-date" type="date" value="${escapeHtml(state.values.endDate)}"${fieldAria('endDate')} class="${inputClass(Boolean(state.errors.endDate))}">
                            ${fieldError(errorId('endDate'), state.errors.endDate)}
                        </div>
                    ` : ''}
                    <div>
                        <label for="peminjaman-start-time" class="text-sm font-bold text-gray-700">Mulai</label>
                        <input id="peminjaman-start-time" type="time" value="${escapeHtml(state.values.startTime)}"${fieldAria('startTime')} class="${inputClass(Boolean(state.errors.startTime))}">
                        ${fieldError(errorId('startTime'), state.errors.startTime)}
                    </div>
                    <div>
                        <label for="peminjaman-end-time" class="text-sm font-bold text-gray-700">Selesai</label>
                        <input id="peminjaman-end-time" type="time" value="${escapeHtml(state.values.endTime)}"${fieldAria('endTime')} class="${inputClass(Boolean(state.errors.endTime))}">
                        ${fieldError(errorId('endTime'), state.errors.endTime)}
                    </div>
                </div>
                ${renderSelectedRoomContext(room)}
                <div data-occurrence-preview-container>${renderOccurrencePreview()}</div>
                <div id="peminjaman-availability" role="status" aria-live="polite" tabindex="-1" class="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                    ${renderAvailabilityContent()}
                </div>
                <div class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                    <p class="font-semibold">Jam selesai yang lebih awal dari jam mulai diperlakukan sebagai penggunaan semalam.</p>
                    <p class="mt-1 text-amber-700">Untuk beberapa hari, jam yang sama diterapkan pada setiap tanggal penggunaan.</p>
                </div>
            </div>
            <div class="mt-6 flex justify-end">
                <button id="peminjaman-next-1" type="button" class="${buttonClass('primary', 'sm')}">Lanjut: ${SECTION_TITLES[2]}</button>
            </div>
        </section>
    `;
};

const renderSectionTwo = (): string => `
    <section data-app-section="2" ${state.section === 2 ? '' : 'hidden'} aria-labelledby="peminjaman-section-2-title">
        <h3 id="peminjaman-section-2-title" tabindex="-1" class="text-base font-bold text-gray-800">2. ${SECTION_TITLES[2]}</h3>
        <div class="mt-4 space-y-4">
            <div>
                <label for="peminjaman-activity-name" class="text-sm font-bold text-gray-700">Nama Kegiatan (ditampilkan pada jadwal publik)</label>
                <p id="peminjaman-activity-name-help" class="mt-1 text-xs text-gray-500">Judul dapat dilihat pengguna DTEDI yang sudah masuk. Gunakan judul singkat; jangan cantumkan data pribadi atau sensitif.</p>
                <input id="peminjaman-activity-name" type="text" maxlength="255" value="${escapeHtml(state.values.activityName)}"${fieldAria('activityName', 'peminjaman-activity-name-help')} class="${inputClass(Boolean(state.errors.activityName))}" placeholder="Contoh: Rapat koordinasi organisasi">
                ${fieldError(errorId('activityName'), state.errors.activityName)}
            </div>
            <div>
                <label for="peminjaman-purpose" class="text-sm font-bold text-gray-700">Tujuan Peminjaman</label>
                <textarea id="peminjaman-purpose" rows="4" maxlength="5000"${fieldAria('purpose')} class="${inputClass(Boolean(state.errors.purpose))}" placeholder="Jelaskan tujuan penggunaan ruangan.">${escapeHtml(state.values.purpose)}</textarea>
                ${fieldError(errorId('purpose'), state.errors.purpose)}
            </div>
            <div>
                <label for="peminjaman-participant-count" class="text-sm font-bold text-gray-700">Jumlah Peserta</label>
                <input id="peminjaman-participant-count" type="number" min="1" value="${escapeHtml(state.values.participantCount)}"${fieldAria('participantCount')} class="${inputClass(Boolean(state.errors.participantCount))}">
                ${fieldError(errorId('participantCount'), state.errors.participantCount)}
            </div>
            <div>
                <label for="peminjaman-surat-pdf" class="text-sm font-bold text-gray-700">Surat Peminjaman Ruangan (PDF)</label>
                <p id="peminjaman-surat-pdf-help" class="mt-1 text-xs leading-relaxed text-gray-500">Unggah surat peminjaman final dalam format PDF, maksimal 5 MB. Pastikan surat sudah ditandatangani/disahkan sesuai kebutuhan.</p>
                <div class="mt-2 flex flex-wrap items-center gap-3">
                    <input id="peminjaman-surat-pdf" type="file" accept="application/pdf,.pdf"${state.suratError ? ' aria-invalid="true" aria-describedby="peminjaman-surat-pdf-help peminjaman-surat-error"' : ' aria-describedby="peminjaman-surat-pdf-help"'} class="peer sr-only">
                    <label for="peminjaman-surat-pdf" class="cursor-pointer rounded-xl border border-primary-teal bg-white px-4 py-2 text-sm font-bold text-primary-teal transition-colors hover:bg-teal-50 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-50 peer-focus-visible:border-primary-teal">Pilih PDF</label>
                    ${state.suratFileName ? '' : '<span class="text-xs text-gray-500">Belum ada file dipilih.</span>'}
                </div>
                ${state.suratFileName ? `
                    <div class="mt-2 flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2">
                        <span class="min-w-0 truncate text-xs font-semibold text-gray-700">${escapeHtml(state.suratFileName)}${state.suratSizeLabel ? ` <span class="font-normal text-gray-500">· ${escapeHtml(state.suratSizeLabel)}</span>` : ''}</span>
                        <button id="peminjaman-surat-clear" type="button" class="shrink-0 text-xs font-bold text-red-600 hover:underline">Hapus</button>
                    </div>
                ` : ''}
                <div role="status" aria-live="polite">${fieldError('peminjaman-surat-error', state.suratError)}</div>
            </div>
        </div>
        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button id="peminjaman-back-2" type="button" class="${buttonClass('outline', 'sm')}">Kembali</button>
            <button id="peminjaman-next-2" type="button" class="${buttonClass('primary', 'sm')}">Lanjut: ${SECTION_TITLES[3]}</button>
        </div>
    </section>
`;

const durationLabel = (): string => {
    const draft = buildOccurrenceDrafts(state.values)[0];
    if (!draft) return '-';
    const minutes = Math.round(draft.durationHours * 60);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${rest} menit`;
    return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
};

const reviewRow = (label: string, value: string, section: SectionNumber): string => `
    <div class="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 ${state.outcome === 'submission_outcome_unknown' ? 'sm:grid-cols-[170px_1fr]' : 'sm:grid-cols-[170px_1fr_auto]'}">
        <dt class="text-xs font-bold uppercase tracking-wider text-gray-400">${label}</dt>
        <dd class="break-words text-sm font-medium text-gray-700">${escapeHtml(value || '-')}</dd>
        ${state.outcome === 'submission_outcome_unknown' ? '' : `<button type="button" data-edit-section="${section}" class="justify-self-start text-xs font-bold text-teal-700 hover:underline sm:justify-self-end" aria-label="Ubah ${label}">Ubah</button>`}
    </div>
`;

/**
 * The submission_outcome_unknown panel. Normal submission and edit controls are
 * not rendered while this is up; only an explicit safe retry or list inspection
 * remains available.
 */
const renderOutcomeUnknownPanel = (): string => `
        <div data-submission-outcome="unknown" role="alert" class="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4">
            <h4 id="peminjaman-outcome-title" tabindex="-1" class="text-sm font-bold text-amber-900">Hasil pengajuan belum dapat dipastikan.</h4>
            <p class="mt-1 text-xs leading-relaxed text-amber-800">
                Data dan PDF dari upaya ini dikunci sementara. Anda dapat meminta hasilnya kembali dengan aman menggunakan kunci pengajuan yang sama.
            </p>
            <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button id="peminjaman-outcome-retry" type="button" ${state.submitting ? 'disabled' : ''} class="${buttonClass('primary', 'sm')}">
                    ${state.submitting ? 'Mencoba mendapatkan hasil...' : 'Coba Dapatkan Hasil dengan Aman'}
                </button>
                <button id="peminjaman-outcome-list" type="button" class="${buttonClass('secondary', 'sm')}">Periksa Pengajuan Saya</button>
            </div>
        </div>
    `;

const renderSectionThree = (): string => {
    const room = selectedRoom();
    const dateText = state.values.date
        ? state.values.bookingMode === 'consecutive_days' && state.values.endDate
            ? `${formatIndonesianDate(parseDateKey(state.values.date))} – ${formatIndonesianDate(parseDateKey(state.values.endDate))}`
            : formatIndonesianDate(parseDateKey(state.values.date))
        : '-';
    const outcomeUnknown = state.outcome === 'submission_outcome_unknown';
    return `
        <section data-app-section="3" ${state.section === 3 ? '' : 'hidden'} aria-labelledby="peminjaman-section-3-title">
            <h3 id="peminjaman-section-3-title" tabindex="-1" class="text-base font-bold text-gray-800">3. ${SECTION_TITLES[3]}</h3>
            <p class="mt-1 text-xs text-gray-500">Periksa kembali seluruh data. Pengajuan yang sudah dikirim tidak dapat diubah tanpa permintaan revisi.</p>
            ${state.conflictError ? `<div role="alert" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">${escapeHtml(state.conflictError)}</div>` : ''}
            ${state.idempotencyConflict ? `
                <div role="alert" class="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p class="font-bold">Kunci pengajuan ini sudah terikat pada data yang berbeda.</p>
                    <p class="mt-1 text-xs">Pengiriman ulang dihentikan. Mulai upaya baru sebelum mengirim data ini kembali.</p>
                    <button id="peminjaman-new-intent" type="button" class="${buttonClass('primary', 'sm', 'mt-3')}">Mulai Pengajuan Baru</button>
                </div>
            ` : ''}
            ${outcomeUnknown ? renderOutcomeUnknownPanel() : ''}
            <dl class="mt-4">
                ${reviewRow('Ruangan', room ? `${room.code} · ${room.name} (${getRoomTypeLabel(room.type)})` : '', 1)}
                ${room?.owning_laboratory ? reviewRow('Laboratorium', room.owning_laboratory.name, 1) : ''}
                ${reviewRow('Tanggal', dateText, 1)}
                ${reviewRow('Waktu', state.values.startTime && state.values.endTime ? `${state.values.startTime}–${state.values.endTime} WIB (${durationLabel()})` : '', 1)}
                ${reviewRow('Nama Kegiatan', state.values.activityName, 2)}
                ${reviewRow('Tujuan', state.values.purpose, 2)}
                ${reviewRow('Jumlah Peserta', state.values.participantCount ? `${state.values.participantCount} orang` : '', 2)}
                ${reviewRow('Surat Peminjaman', state.suratFileName ? `${state.suratFileName}${state.suratSizeLabel ? ` (${state.suratSizeLabel})` : ''}` : '', 2)}
            </dl>
            <div class="mt-4">${renderOccurrencePreview()}</div>
            <div class="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-xs leading-relaxed text-gray-600">
                Pengajuan akan masuk antrean peninjauan ${room?.type === 'laboratory' ? 'Kepala Laboratorium pengelola ruangan' : 'Sarpras'} sesuai jenis ruangan. Keputusan akhir mengikuti verifikasi backend terhadap jadwal dan kelengkapan dokumen.
            </div>
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                ${outcomeUnknown ? '<span></span>' : `<button id="peminjaman-back-3" type="button" class="${buttonClass('outline', 'sm')}">Kembali</button>`}
                ${outcomeUnknown || state.idempotencyConflict ? '' : `
                    <button id="submit-peminjaman-booking" type="submit" ${state.submitting ? 'disabled' : ''} class="${buttonClass('primary', 'sm')}">
                        ${state.submitting ? 'Mengirim pengajuan...' : 'Ajukan Peminjaman'}
                    </button>
                `}
            </div>
        </section>
    `;
};

const renderConfirmation = (booking: MahasiswaBooking): string => {
    const room = booking.room;
    const dateText = formatIndonesianDate(new Date(booking.start_at));
    const status = booking.effective_status ?? booking.status;
    return `
        <section data-app-confirmation class="${surfaceClass('card', 'mx-auto max-w-2xl p-8')}" aria-labelledby="peminjaman-confirmation-title">
            <div class="flex items-start gap-4">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
                <div>
                    <h3 id="peminjaman-confirmation-title" tabindex="-1" class="text-lg font-bold text-gray-900">Pengajuan peminjaman ruangan berhasil dikirim.</h3>
                    <p class="mt-1 text-sm text-gray-600">Pengajuan Anda akan ditinjau oleh ${room.type === 'laboratory' ? 'Kepala Laboratorium pengelola ruangan' : 'Sarpras'}. Pantau status dan tindak lanjut melalui halaman detail.</p>
                </div>
            </div>
            <dl class="mt-6 space-y-0 border-t border-gray-100">
                <div class="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 sm:grid-cols-[170px_1fr]">
                    <dt class="text-xs font-bold uppercase tracking-wider text-gray-400">Nomor Pengajuan</dt>
                    <dd class="text-sm font-bold text-gray-800">#${booking.id}</dd>
                </div>
                <div class="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 sm:grid-cols-[170px_1fr]">
                    <dt class="text-xs font-bold uppercase tracking-wider text-gray-400">Status</dt>
                    <dd class="text-sm font-medium text-gray-700">${escapeHtml(getLifecycleStatusLabel(status))}</dd>
                </div>
                <div class="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 sm:grid-cols-[170px_1fr]">
                    <dt class="text-xs font-bold uppercase tracking-wider text-gray-400">Ruangan</dt>
                    <dd class="break-words text-sm font-medium text-gray-700">${escapeHtml(room.code)} · ${escapeHtml(room.name)} (${getRoomTypeLabel(room.type)})</dd>
                </div>
                <div class="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 sm:grid-cols-[170px_1fr]">
                    <dt class="text-xs font-bold uppercase tracking-wider text-gray-400">Jadwal</dt>
                    <dd class="text-sm font-medium text-gray-700">${escapeHtml(dateText)} · ${escapeHtml(formatTimeRange(booking.start_at, booking.end_at))}</dd>
                </div>
                <div class="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 sm:grid-cols-[170px_1fr]">
                    <dt class="text-xs font-bold uppercase tracking-wider text-gray-400">Pengajuan Ke</dt>
                    <dd class="text-sm font-medium text-gray-700">${booking.submission_iteration ?? 1}</dd>
                </div>
                ${booking.surat_peminjaman_pdf?.original_name ? `
                    <div class="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 sm:grid-cols-[170px_1fr]">
                        <dt class="text-xs font-bold uppercase tracking-wider text-gray-400">Surat Peminjaman</dt>
                        <dd class="break-words text-sm font-medium text-gray-700">${escapeHtml(booking.surat_peminjaman_pdf.original_name)}</dd>
                    </div>
                ` : ''}
            </dl>
            <div class="mt-6 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-xs leading-relaxed text-teal-900">
                Langkah berikutnya: petugas meninjau kelengkapan dan jadwal. Bila diperlukan perbaikan, status berubah menjadi "Perlu Revisi" dan Anda dapat memperbaikinya dari halaman detail.
            </div>
            <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button id="peminjaman-confirmation-back" type="button" class="${buttonClass('outline', 'sm')}">Ke Peminjaman Ruangan</button>
                <button id="peminjaman-confirmation-list" type="button" class="${buttonClass('secondary', 'sm')}">Lihat Pengajuan Saya</button>
                <button id="peminjaman-confirmation-detail" type="button" class="${buttonClass('primary', 'sm')}">Lihat Detail Pengajuan</button>
            </div>
        </section>
    `;
};

const renderPageContent = (): string => {
    if (state.submitted) {
        return renderConfirmation(state.submitted);
    }

    return `
        <div class="${surfaceClass('card', 'p-6 md:p-8')}">
            ${renderStepper()}
            <div class="mt-6 space-y-4">
                ${renderErrorSummary()}
                <form id="peminjaman-booking-form" novalidate>
                    ${renderSectionOne()}
                    ${renderSectionTwo()}
                    ${renderSectionThree()}
                </form>
            </div>
        </div>
    `;
};

// ── Interaction wiring ─────────────────────────────────────────────────────

const focusPending = (): void => {
    if (!pendingFocusId) return;
    document.getElementById(pendingFocusId)?.focus();
    pendingFocusId = null;
};

// Page-to-page navigation stays lazy (import cycles) but never silent: a chunk
// that fails to load surfaces a retryable alert instead of a dead button.
const openListPage = (): Promise<void> => navigateLazily(
    () => import('./list-page').then(({ renderPeminjamanListPage }) => renderPeminjamanListPage()),
    'Pengajuan Saya',
);

const openLanding = (): Promise<void> => navigateLazily(
    () => import('../PeminjamanRuangan').then(({ renderPeminjamanRuangan }) => renderPeminjamanRuangan()),
    'Peminjaman Ruangan',
);

const goToSection = (section: SectionNumber, focusId?: string): void => {
    state.section = section;
    pendingFocusId = focusId ?? `peminjaman-section-${section}-title`;
    render();
};

const validateSections = (
    fields: readonly (keyof BookingFormValues)[],
): boolean => {
    const allErrors = validateBookingForm(state.values, rooms, todayKey());
    state.errors = pickErrors(allErrors, fields);
    const firstInvalid = fields.find((field) => state.errors[field]);
    if (firstInvalid) {
        pendingFocusId = FIELD_INPUT_ID[firstInvalid];
        render();
        return false;
    }
    return true;
};

const dedupe = (messages: readonly string[]): string[] => [...new Set(messages)];

const handleFinalSubmit = async (safeOutcomeRetry = false): Promise<void> => {
    if (state.submitting || state.submitted) return;
    if (state.idempotencyConflict) return;

    let intent: SubmissionIntent;
    if (safeOutcomeRetry) {
        if (state.outcome !== 'submission_outcome_unknown' || !state.submissionIntent) return;
        intent = state.submissionIntent;
    } else {
        if (state.outcome === 'submission_outcome_unknown') return;

        state.values = readFormValues();
        const errors = validateBookingForm(state.values, rooms, todayKey());
        const suratError = validateSuratPdfFile(state.suratFile) ?? undefined;
        if (Object.keys(errors).length > 0 || suratError || !state.suratFile) {
            state.errors = errors;
            state.suratError = suratError;
            state.summaryErrors = dedupe([
                ...Object.values(errors).filter((message): message is string => Boolean(message)),
                ...(suratError ? [suratError] : []),
            ]);
            const firstField = (Object.keys(errors) as Array<keyof BookingFormValues>)
                .find((field) => FIELD_SECTION[field]);
            state.section = firstField
                ? FIELD_SECTION[firstField]
                : suratError ? 2 : 3;
            pendingFocusId = 'peminjaman-error-summary';
            render();
            return;
        }

        intent = {
            idempotencyKey: state.reusableValidationKey
                ?? generateRoomBookingIdempotencyKey(),
            payload: bookingFormToPayload(state.values),
            suratFile: state.suratFile,
        };
        state.submissionIntent = intent;
        state.reusableValidationKey = null;
    }

    state.summaryErrors = [];
    state.conflictError = null;
    state.submitting = true;
    render();

    try {
        const booking = await createMahasiswaBooking(
            intent.payload,
            intent.suratFile,
            intent.idempotencyKey,
        );
        state.submitted = booking;
        state.submitting = false;
        state.outcome = 'idle';
        state.submissionIntent = null;
        state.reusableValidationKey = null;
        state.dirty = false;
        syncUnloadGuard();
        pendingFocusId = 'peminjaman-confirmation-title';
        render();
    } catch (error) {
        state.submitting = false;
        if (error instanceof PeminjamanApiError && error.status === 422) {
            const aliases: Record<string, keyof BookingFormValues> = {
                room_id: 'roomId',
                activity_name: 'activityName',
                purpose: 'purpose',
                participant_count: 'participantCount',
                start_at: 'startTime',
                end_at: 'endTime',
            };
            const mapped: BookingFormErrors = {};
            let surat: string | undefined;
            Object.entries(error.errors ?? {}).forEach(([key, messages]) => {
                if (key === 'surat_peminjaman_pdf') {
                    surat = messages[0];
                    return;
                }
                const target = aliases[key];
                if (target) mapped[target] = messages[0];
            });
            state.errors = mapped;
            state.suratError = surat;
            state.summaryErrors = dedupe([
                ...Object.values(mapped).filter((message): message is string => Boolean(message)),
                ...(surat ? [surat] : []),
            ]);
            if (state.summaryErrors.length === 0) {
                state.summaryErrors = [error.message];
            }
            const firstField = (Object.keys(mapped) as Array<keyof BookingFormValues>)[0];
            state.section = firstField ? FIELD_SECTION[firstField] : surat ? 2 : 3;
            state.outcome = 'idle';
            state.reusableValidationKey = intent.idempotencyKey;
            state.submissionIntent = null;
            pendingFocusId = 'peminjaman-error-summary';
        } else if (
            error instanceof PeminjamanApiError
            && error.status === 409
            && error.code === 'idempotency_key_reused'
        ) {
            state.outcome = 'idle';
            state.submissionIntent = null;
            state.reusableValidationKey = null;
            state.idempotencyConflict = error.message;
            state.section = 3;
            pendingFocusId = 'peminjaman-section-3-title';
        } else if (error instanceof PeminjamanApiError && error.status === 409) {
            state.submissionIntent = null;
            state.reusableValidationKey = null;
            state.conflictError = error.message
                || 'Jadwal bertabrakan dengan peminjaman yang telah disetujui. Pilih waktu lain.';
            invalidateAvailability();
            const key = availabilityKey();
            const generation = availabilityGeneration;
            state.availability = { status: 'loading', items: [], key };
            void runAvailabilityCheck(key, generation);
            pendingFocusId = 'peminjaman-section-3-title';
        } else if (isUncertainOutcome(error)) {
            // Keep the exact intent frozen. Only the explicit safe-retry button
            // can resend it; no automatic multipart retry is performed.
            state.outcome = 'submission_outcome_unknown';
            state.section = 3;
            pendingFocusId = 'peminjaman-outcome-title';
        } else {
            // A definitive rejection (401/403/404/...): nothing was created, so
            // ordinary retry is safe once the applicant fixes the cause.
            state.summaryErrors = [error instanceof Error
                ? error.message
                : 'Pengajuan gagal dikirim.'];
            state.submissionIntent = null;
            state.reusableValidationKey = null;
            state.section = 3;
            pendingFocusId = 'peminjaman-error-summary';
        }
        render();
    }
};

const attachListeners = (): void => {
    const root = document.getElementById('peminjaman-application-root');
    if (!root) return;

    if (state.submitted) {
        const submitted = state.submitted;
        document.getElementById('peminjaman-confirmation-detail')?.addEventListener('click', () => {
            void openPeminjamanBookingDetail(submitted.id);
        });
        document.getElementById('peminjaman-confirmation-list')?.addEventListener('click', () => {
            closePeminjamanApplicationPage();
            void openListPage();
        });
        document.getElementById('peminjaman-confirmation-back')?.addEventListener('click', () => {
            closePeminjamanApplicationPage();
            void openLanding();
        });
        focusPending();
        return;
    }

    if (state.outcome === 'submission_outcome_unknown') {
        root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
            'input, select, textarea',
        ).forEach((control) => {
            control.disabled = true;
        });
        document.getElementById('peminjaman-outcome-list')?.addEventListener('click', () => {
            void openListPage();
        });
        document.getElementById('peminjaman-outcome-retry')?.addEventListener('click', () => {
            void handleFinalSubmit(true);
        });
    }

    document.getElementById('peminjaman-new-intent')?.addEventListener('click', () => {
        state.idempotencyConflict = null;
        state.submissionIntent = null;
        state.reusableValidationKey = null;
        pendingFocusId = 'peminjaman-section-3-title';
        render();
    });

    root.addEventListener('input', () => {
        state.dirty = true;
        syncUnloadGuard();
    });

    document.getElementById('peminjaman-room-type')?.addEventListener('change', (event) => {
        state.values = readFormValues();
        state.typeFilter = (event.target as HTMLSelectElement).value as 'all' | RoomType;
        const current = selectedRoom();
        if (current && state.typeFilter !== 'all' && current.type !== state.typeFilter) {
            state.values.roomId = '';
        }
        render();
        scheduleAvailabilityCheck();
    });
    document.getElementById('peminjaman-room-id')?.addEventListener('change', () => {
        state.values = readFormValues();
        render();
        scheduleAvailabilityCheck();
    });
    document.querySelectorAll<HTMLInputElement>('input[name="peminjaman-booking-mode"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            state.values = readFormValues();
            if (state.values.bookingMode === 'consecutive_days' && !state.values.endDate) {
                state.values.endDate = state.values.date;
            }
            if (state.values.bookingMode === 'single_day') state.values.endDate = '';
            render();
            scheduleAvailabilityCheck();
        });
    });
    document.getElementById('peminjaman-room-detail')?.addEventListener('click', () => {
        const room = selectedRoom();
        if (room) void openRoomCatalogDetail(room.id, { onApply: () => {} });
    });
    ['peminjaman-date', 'peminjaman-end-date', 'peminjaman-start-time', 'peminjaman-end-time'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', () => {
            state.values = readFormValues();
            if (
                id === 'peminjaman-date'
                && state.values.bookingMode === 'consecutive_days'
                && (!state.values.endDate || state.values.endDate < state.values.date)
            ) {
                state.values.endDate = state.values.date;
                render();
            }
            const preview = document.querySelector<HTMLElement>('[data-occurrence-preview-container]');
            if (preview) preview.innerHTML = renderOccurrencePreview();
            // Every schedule input invalidates the current availability
            // generation; a same-key change (time only) reuses a ready result
            // without issuing a new request.
            scheduleAvailabilityCheck();
        });
    });

    document.getElementById('peminjaman-surat-pdf')?.addEventListener('change', (event) => {
        const file = (event.target as HTMLInputElement).files?.[0] ?? null;
        const error = file ? validateSuratPdfFile(file) : undefined;
        state.values = readFormValues();
        state.suratFile = error ? null : file;
        state.suratFileName = file?.name ?? null;
        state.suratSizeLabel = file && !error ? formatFileSize(file.size) : null;
        state.suratError = error ?? undefined;
        state.dirty = true;
        syncUnloadGuard();
        render();
    });
    document.getElementById('peminjaman-surat-clear')?.addEventListener('click', () => {
        state.values = readFormValues();
        state.suratFile = null;
        state.suratFileName = null;
        state.suratSizeLabel = null;
        state.suratError = undefined;
        render();
    });

    document.getElementById('peminjaman-next-1')?.addEventListener('click', () => {
        state.values = readFormValues();
        if (!validateSections(SECTION_ONE_FIELDS)) return;
        if (conflictingApproved().length > 0) {
            renderAvailabilityBox();
            document.getElementById('peminjaman-availability')?.focus();
            return;
        }
        state.errors = {};
        goToSection(2);
    });
    document.getElementById('peminjaman-back-2')?.addEventListener('click', () => {
        state.values = readFormValues();
        goToSection(1);
    });
    document.getElementById('peminjaman-next-2')?.addEventListener('click', () => {
        state.values = readFormValues();
        const fields = [...SECTION_ONE_FIELDS, ...SECTION_TWO_FIELDS];
        const suratError = validateSuratPdfFile(state.suratFile) ?? undefined;
        state.errors = pickErrors(
            validateBookingForm(state.values, rooms, todayKey()),
            fields,
        );
        state.suratError = suratError;

        const firstInvalid = fields.find((field) => state.errors[field]);
        if (firstInvalid || suratError) {
            // Exactly one render, then exactly one focus move: to the first
            // invalid control (the PDF input when only the document is wrong).
            pendingFocusId = firstInvalid
                ? FIELD_INPUT_ID[firstInvalid]
                : 'peminjaman-surat-pdf';
            render();
            return;
        }

        state.errors = {};
        goToSection(3);
    });
    document.getElementById('peminjaman-back-3')?.addEventListener('click', () => {
        goToSection(2);
    });
    document.querySelectorAll<HTMLElement>('[data-edit-section]').forEach((button) => {
        button.addEventListener('click', () => {
            const target = Number(button.dataset.editSection);
            if (target === 1 || target === 2) goToSection(target as SectionNumber);
        });
    });

    document.getElementById('peminjaman-booking-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        if (state.section === 1) {
            document.getElementById('peminjaman-next-1')?.click();
            return;
        }
        if (state.section === 2) {
            document.getElementById('peminjaman-next-2')?.click();
            return;
        }
        void handleFinalSubmit();
    });

    focusPending();
};

const render = (): void => {
    const root = document.getElementById('peminjaman-application-root');
    if (!root) return;
    root.innerHTML = renderPageContent();
    attachListeners();
    hydrateSelectedRoomContext();
};

const renderShell = (): string => `
    <div class="mx-auto max-w-4xl space-y-6 pb-12 animate-fade-in">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <h2 class="text-3xl font-bold text-gray-800 tracking-tight">Ajukan Peminjaman Ruangan</h2>
                <p class="mt-2 text-gray-500">Lengkapi tiga bagian berikut, lalu periksa ringkasan sebelum mengirim pengajuan.</p>
            </div>
            <button id="peminjaman-application-back" type="button" class="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition-all hover:border-teal-200 hover:bg-gray-50 hover:text-teal-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Kembali ke Peminjaman Ruangan
            </button>
        </div>
        <div id="peminjaman-application-root" aria-live="off"></div>
    </div>
`;

const renderLoadFailure = (message: string): void => {
    const root = document.getElementById('peminjaman-application-root');
    if (!root) return;
    root.innerHTML = `
        <div data-state="error" class="${surfaceClass('card', 'px-6 py-14 text-center')}">
            <h3 class="text-base font-bold text-gray-800">Formulir belum dapat dimuat</h3>
            <p class="mt-2 text-sm text-gray-500">${escapeHtml(message)}</p>
            <button id="peminjaman-application-retry" type="button" class="${buttonClass('primary', 'md', 'mt-5')}">Coba Lagi</button>
        </div>
    `;
    document.getElementById('peminjaman-application-retry')?.addEventListener('click', () => {
        void renderPeminjamanApplicationPage();
    });
};

export const renderPeminjamanApplicationPage = async (
    options: ApplicationPageOptions = {},
): Promise<void> => {
    closePeminjamanApplicationPage();
    state = createInitialState(options);
    rooms = [];

    renderDashboardLayout(
        'Peminjaman Ruangan',
        renderShell(),
        'mahasiswa',
        'peminjaman',
    );

    document.getElementById('peminjaman-application-back')?.addEventListener('click', () => {
        if (!confirmLeaveWithUnsavedChanges()) return;
        closePeminjamanApplicationPage();
        void openLanding();
    });

    const root = document.getElementById('peminjaman-application-root');
    if (root) {
        root.innerHTML = `
            <div data-state="loading" class="${surfaceClass('card', 'px-6 py-16 text-center')}">
                <div class="mx-auto h-10 w-10 ${SPINNER_CLASS}" aria-hidden="true"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat daftar ruangan...</p>
            </div>
        `;
    }

    try {
        const activeRooms = await getPeminjamanRooms();
        rooms = activeRooms.filter((room) => room.is_active);
        if (
            options.roomId !== undefined
            && !rooms.some((room) => room.id === options.roomId)
        ) {
            state.values.roomId = '';
        }
        // A preselected type with no chosen room preselects the first match,
        // mirroring the previous entry behavior.
        if (!state.values.roomId && options.preferredType) {
            const preferred = rooms.find((room) => room.type === options.preferredType);
            if (preferred) state.values.roomId = String(preferred.id);
        }
        render();
        scheduleAvailabilityCheck();
    } catch (error) {
        renderLoadFailure(
            error instanceof Error
                ? error.message
                : 'Daftar ruangan gagal dimuat.',
        );
    }
};
