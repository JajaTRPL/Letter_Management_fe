import Toastify from 'toastify-js';
import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import {
    approveTendikBooking,
    downloadSuratPeminjamanPdf,
    getTendikBooking,
    getTendikBookingCalendar,
    getTendikBookings,
    getTendikReviewerProfile,
    PeminjamanApiError,
    rejectTendikBooking,
    reviseTendikBooking,
} from '../mahasiswa/peminjaman/api';
import { renderSuratPeminjamanPanel } from '../mahasiswa/peminjaman/views';
import {
    closeSuratPreview,
    openSuratPreview,
} from '../mahasiswa/peminjaman/detail';
import type {
    BookingStatus,
    PaginationMeta,
    Room,
    RoomType,
    TendikBooking,
    TendikBookingFilters,
    TendikCalendarFilters,
    TendikCalendarItem,
    TendikReviewerProfile,
    TendikReviewerRole,
} from '../mahasiswa/peminjaman/types';
import {
    formatDateKey,
    formatIsoDateKeyInJakarta,
    formatTimeRange,
    getCalendarKeyboardTargetDateKey,
    getBookingStatusLabel,
    getBookingStatusTone,
    getRoomTypeLabel,
} from '../shared/peminjaman-calendar';
import {
    renderBookingCalendarGridCells,
    renderBookingCalendarSelectedDatePanel,
    renderBookingCalendarView,
    type BookingCalendarItemAction,
    type BookingCalendarViewItem,
} from '../shared/peminjaman-calendar-view';
import { bulkDeleteRooms, listManagedRooms } from '../shared/room-management/api';
import {
    attachRoomSelectionListeners,
    attachRoomTableListeners,
    hydrateRoomTableCovers,
    renderRoomManagementTable,
} from '../shared/room-management/list';
import {
    closeRoomManagementDrawer,
    openRoomManagementDrawer,
} from '../shared/room-management/detail-drawer';
import {
    closeRoomFormModal,
    openRoomFormModal,
} from '../shared/room-management/room-form';
import type {
    ManagedLaboratory,
    ManagedRoom,
    ManagedRoomType,
} from '../shared/room-management/types';

const PER_PAGE = 10;

type TendikTab = 'queue' | 'calendar' | 'rooms';
type CalendarStatusFilter = 'all' | BookingStatus;
type CalendarRole = 'sarpras' | 'kepala_lab' | 'laboran';

interface SarprasCalendarState {
    cursor: Date;
    status: CalendarStatusFilter;
    laboratoryId: number | null;
    roomId: number | null;
    selectedDateKey: string | null;
}

interface CalendarRoomOption {
    id: number;
    code: string;
    name: string;
    type: RoomType;
    laboratoryId: number | null;
}

interface CalendarLaboratoryOption {
    id: number;
    name: string;
}

interface TendikCalendarCopy {
    title: string;
    helper: string;
    densityHelper: string;
    totalNoun: string;
    statusAriaNoun: string;
    roomTypeFilterAriaLabel: string;
    loadingText: string;
    monthEmptyText: string;
    upcomingTitle: string;
    upcomingLoadingText: string;
    upcomingEmptyText: string;
    dayEyebrow: string;
    dayCountNoun: string;
    dayEmptyText: string;
    calendarErrorFallback: string;
    upcomingErrorFallback: string;
}

const BOOKING_STATUSES: BookingStatus[] = [
    'submitted',
    'revision_requested',
    'approved',
    'rejected',
    'cancelled',
];
const SARPRAS_CALENDAR_DATE_ATTRIBUTE = 'data-sarpras-calendar-date';
const SARPRAS_CALENDAR_DETAIL_ACTION: BookingCalendarItemAction = {
    label: 'Lihat Detail',
    dataAttribute: 'data-sarpras-calendar-detail',
    value: (item) => item.id,
    requiredCapability: 'view',
};

const defaultCalendarStatus = (role: CalendarRole | null): CalendarStatusFilter =>
    role === 'laboran' ? 'approved' : 'all';

const createInitialSarprasCalendarState = (
    role: CalendarRole | null = null,
): SarprasCalendarState => {
    const now = new Date();

    return {
        cursor: new Date(now.getFullYear(), now.getMonth(), 1),
        status: defaultCalendarStatus(role),
        laboratoryId: null,
        roomId: null,
        selectedDateKey: null,
    };
};

const createResetSarprasCalendarState = (
    role: CalendarRole | null = null,
): SarprasCalendarState => {
    const now = new Date();

    return {
        ...createInitialSarprasCalendarState(role),
        selectedDateKey: formatDateKey(now),
    };
};

let renderSequence = 0;
let reviewerProfile: TendikReviewerProfile | null = null;
let queue: TendikBooking[] = [];
let pagination: PaginationMeta = {
    current_page: 1,
    per_page: PER_PAGE,
    total: 0,
    last_page: 1,
};
let filters: TendikBookingFilters = { page: 1, perPage: PER_PAGE };
let queueLoading = true;
let queueError: string | null = null;
let queueErrorStatus: number | null = null;
let filterError: string | null = null;
let knownRooms = new Map<number, Room>();
let actionDeniedBookingIds = new Set<number>();
let drawerEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
let actionEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
// "Kelola Ruangan" tab state (management roles only).
let activeTab: TendikTab = 'queue';
let sarprasCalendarState: SarprasCalendarState = createInitialSarprasCalendarState();
let sarprasCalendarItems: TendikCalendarItem[] = [];
let sarprasCalendarStatusCounts: Partial<Record<BookingStatus, number>> = {};
let sarprasCalendarUpcomingItemsState: TendikCalendarItem[] = [];
let sarprasCalendarRoomMap = new Map<number, CalendarRoomOption>();
let sarprasCalendarLaboratoryMap = new Map<number, CalendarLaboratoryOption>();
let sarprasCalendarLoading = false;
let sarprasCalendarLoaded = false;
let sarprasCalendarError: string | null = null;
let sarprasCalendarUpcomingLoading = false;
let sarprasCalendarUpcomingError: string | null = null;
let sarprasCalendarRequestSequence = 0;
let calendarDayEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
let managedRooms: ManagedRoom[] = [];
let managedRoomsLoaded = false;
let managedRoomsLoading = false;
let managedRoomsError: string | null = null;
const roomCoverCache = new Map<string, string>();
// Bulk room selection — only rooms the backend says this reviewer may remove
// (management_flags.can_deactivate) are selectable. For Sarpras that is every
// classroom in scope; Kepala Lab / Laboran get no selectable rows at all.
const roomSelection = new Set<number>();
let bulkConfirmEscape: ((event: KeyboardEvent) => void) | null = null;

const canBulkDelete = (room: ManagedRoom): boolean => room.management_flags?.can_deactivate === true;
const bulkSelectableRooms = (): ManagedRoom[] => managedRooms.filter(canBulkDelete);
const roomsAreBulkSelectable = (): boolean => bulkSelectableRooms().length > 0;
const clearRoomSelection = (): void => { roomSelection.clear(); };

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const showToast = (text: string, success: boolean): void => {
    Toastify({
        text,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: { background: success ? '#0f766e' : '#b91c1c' },
    }).showToast();
};

const formatDateTime = (iso: string | null | undefined): string => {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }) + ' WIB';
};

const reviewerRole = (): TendikReviewerRole | null =>
    reviewerProfile?.tendik_role ?? null;

const canAct = (): boolean =>
    reviewerRole() === 'sarpras' || reviewerRole() === 'kepala_lab';

// Room master-data management surface is available to sarpras (classrooms),
// kepala_lab (own lab), and laboran (all labs). Persuratan/unknown roles keep
// the review-only page. Every mutation is still gated by backend flags.
const canManageRooms = (): boolean =>
    reviewerRole() === 'sarpras'
    || reviewerRole() === 'kepala_lab'
    || reviewerRole() === 'laboran';

const canUseCalendar = (): boolean =>
    reviewerRole() === 'sarpras'
    || reviewerRole() === 'kepala_lab'
    || reviewerRole() === 'laboran';

const calendarRole = (): CalendarRole | null => {
    const role = reviewerRole();

    return role === 'sarpras' || role === 'kepala_lab' || role === 'laboran' ? role : null;
};

const calendarRoomType = (): RoomType =>
    calendarRole() === 'sarpras' ? 'classroom' : 'laboratory';

/** Room types this reviewer may create (create stays with sarpras/classroom). */
const allowedCreateTypes = (): ManagedRoomType[] =>
    reviewerRole() === 'sarpras' ? ['classroom'] : [];

/** Laboratories referenced by the loaded rooms — enough for the edit form. */
const managedLaboratories = (): ManagedLaboratory[] => {
    const map = new Map<number, ManagedLaboratory>();
    managedRooms.forEach((room) => {
        if (room.owning_laboratory) map.set(room.owning_laboratory.id, room.owning_laboratory);
    });
    return Array.from(map.values());
};

const roomDrawerOptions = () => ({
    laboratories: managedLaboratories(),
    onRoomMutated: () => { void loadManagedRooms(); },
});

const roleLabel = (role: TendikReviewerRole | null): string => {
    switch (role) {
        case 'sarpras': return 'Sarana & Prasarana';
        case 'kepala_lab': return 'Kepala Laboratorium';
        case 'laboran': return 'Laboran';
        case 'persuratan': return 'Persuratan';
        default: return 'Tendik';
    }
};

const errorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof PeminjamanApiError)) {
        return error instanceof Error ? error.message : fallback;
    }
    if (error.status === 409 && error.code === 'booking_conflict') {
        return 'Jadwal bertabrakan dengan peminjaman yang sudah disetujui.';
    }
    const validationMessage = Object.values(error.errors ?? {})[0]?.[0];
    if (validationMessage) return validationMessage;
    if (error.status === 403) {
        return 'Anda tidak memiliki akses ke antrean review peminjaman ruangan.';
    }
    if (error.status === 404) {
        return 'Pengajuan peminjaman tidak ditemukan atau tidak termasuk dalam lingkup Anda.';
    }
    return error.message || fallback;
};

const rememberRooms = (items: TendikBooking[]): void => {
    items.forEach((booking) => {
        knownRooms.set(booking.room.id, booking.room);
        if (booking.room.type === 'laboratory' && booking.room.owning_laboratory) {
            sarprasCalendarLaboratoryMap.set(booking.room.owning_laboratory.id, {
                id: booking.room.owning_laboratory.id,
                name: booking.room.owning_laboratory.name,
            });
        }
        if (booking.room.type === calendarRoomType()) {
            sarprasCalendarRoomMap.set(booking.room.id, {
                id: booking.room.id,
                code: booking.room.code,
                name: booking.room.name,
                type: booking.room.type,
                laboratoryId: booking.room.owning_laboratory?.id ?? null,
            });
        }
    });
};

const rememberSarprasCalendarRooms = (items: TendikCalendarItem[]): void => {
    items.forEach((item) => {
        if (item.room_type === 'laboratory' && item.laboratory_id !== null && item.laboratory_name) {
            sarprasCalendarLaboratoryMap.set(item.laboratory_id, {
                id: item.laboratory_id,
                name: item.laboratory_name,
            });
        }
        if (item.room_type !== calendarRoomType()) return;
        sarprasCalendarRoomMap.set(item.room_id, {
            id: item.room_id,
            code: item.room_code,
            name: item.room_name,
            type: item.room_type,
            laboratoryId: item.laboratory_id,
        });
    });
};

const tendikCalendarCopy = (): TendikCalendarCopy => {
    if (calendarRole() === 'laboran') {
        return {
            title: 'Jadwal Laboratorium',
            helper: 'Pantau jadwal peminjaman laboratorium untuk membantu kesiapan ruang dan fasilitas.',
            densityHelper: 'Kepadatan dihitung dari jumlah jadwal laboratorium sesuai filter aktif.',
            totalNoun: 'jadwal laboratorium',
            statusAriaNoun: 'jadwal laboratorium',
            roomTypeFilterAriaLabel: 'Filter jenis ruangan kalender Laboran',
            loadingText: 'Memuat jadwal laboratorium...',
            monthEmptyText: 'Belum ada jadwal laboratorium untuk bulan dan filter ini.',
            upcomingTitle: 'Jadwal Lab Terdekat',
            upcomingLoadingText: 'Memuat jadwal lab terdekat...',
            upcomingEmptyText: 'Belum ada jadwal lab terdekat untuk filter aktif.',
            dayEyebrow: 'Jadwal Laboratorium',
            dayCountNoun: 'jadwal laboratorium',
            dayEmptyText: 'Belum ada jadwal laboratorium pada tanggal ini untuk filter aktif.',
            calendarErrorFallback: 'Jadwal laboratorium gagal dimuat.',
            upcomingErrorFallback: 'Jadwal lab terdekat gagal dimuat.',
        };
    }
    if (calendarRole() === 'kepala_lab') {
        return {
            title: 'Kalender Peminjaman Laboratorium Saya',
            helper: 'Pantau pengajuan laboratorium yang menjadi tanggung jawab Anda berdasarkan tanggal, status, dan ruangan.',
            densityHelper: 'Kepadatan dihitung dari jumlah pengajuan laboratorium sesuai filter aktif.',
            totalNoun: 'pengajuan laboratorium',
            statusAriaNoun: 'pengajuan laboratorium',
            roomTypeFilterAriaLabel: 'Filter jenis ruangan kalender Kepala Lab',
            loadingText: 'Memuat kalender peminjaman laboratorium...',
            monthEmptyText: 'Belum ada pengajuan laboratorium untuk bulan dan filter ini.',
            upcomingTitle: 'Pengajuan Lab Terdekat',
            upcomingLoadingText: 'Memuat pengajuan lab terdekat...',
            upcomingEmptyText: 'Belum ada pengajuan lab terdekat untuk filter aktif.',
            dayEyebrow: 'Peminjaman Laboratorium',
            dayCountNoun: 'pengajuan laboratorium',
            dayEmptyText: 'Belum ada pengajuan laboratorium pada tanggal ini untuk filter aktif.',
            calendarErrorFallback: 'Kalender peminjaman laboratorium gagal dimuat.',
            upcomingErrorFallback: 'Pengajuan lab terdekat gagal dimuat.',
        };
    }

    return {
        title: 'Kalender Review Ruang Kelas',
        helper: 'Pantau pengajuan ruang kelas berdasarkan tanggal, status, dan ruangan untuk membantu proses review.',
        densityHelper: 'Kepadatan dihitung dari jumlah pengajuan ruang kelas sesuai filter aktif.',
        totalNoun: 'pengajuan ruang kelas',
        statusAriaNoun: 'pengajuan ruang kelas',
        roomTypeFilterAriaLabel: 'Filter jenis ruangan kalender Sarpras',
        loadingText: 'Memuat kalender review ruang kelas...',
        monthEmptyText: 'Belum ada pengajuan ruang kelas untuk bulan dan filter ini.',
        upcomingTitle: 'Pengajuan Ruang Kelas Terdekat',
        upcomingLoadingText: 'Memuat pengajuan ruang kelas terdekat...',
        upcomingEmptyText: 'Belum ada pengajuan ruang kelas terdekat untuk filter aktif.',
        dayEyebrow: 'Peminjaman Ruang Kelas',
        dayCountNoun: 'pengajuan ruang kelas',
        dayEmptyText: 'Belum ada pengajuan ruang kelas pada tanggal ini untuk filter aktif.',
        calendarErrorFallback: 'Kalender review ruang kelas gagal dimuat.',
        upcomingErrorFallback: 'Pengajuan ruang kelas terdekat gagal dimuat.',
    };
};

const sarprasCalendarMonthKey = (): string => {
    const year = sarprasCalendarState.cursor.getFullYear();
    const month = String(sarprasCalendarState.cursor.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
};

const sarprasCalendarScopedApiFilters = (
    dateFilters: Pick<TendikCalendarFilters, 'month' | 'from' | 'to'>,
): TendikCalendarFilters => ({
    ...dateFilters,
    ...(sarprasCalendarState.status !== 'all' ? { status: sarprasCalendarState.status } : {}),
    ...(calendarRole() === 'laboran' && sarprasCalendarState.laboratoryId !== null
        ? { laboratoryId: sarprasCalendarState.laboratoryId }
        : {}),
    ...(sarprasCalendarState.roomId !== null ? { roomId: sarprasCalendarState.roomId } : {}),
});

const sarprasCalendarApiFilters = (): TendikCalendarFilters => sarprasCalendarScopedApiFilters({
    month: sarprasCalendarMonthKey(),
});

const sarprasCalendarUpcomingApiFilters = (): TendikCalendarFilters => {
    const from = new Date();
    const to = new Date(from);
    to.setDate(from.getDate() + 89);

    return sarprasCalendarScopedApiFilters({
        from: formatDateKey(from),
        to: formatDateKey(to),
    });
};

const toSarprasCalendarViewItem = (item: TendikCalendarItem): BookingCalendarViewItem => ({
    id: item.id,
    roomCode: item.room_code,
    roomName: item.room_name,
    status: item.status,
    startAt: item.start_at,
    endAt: item.end_at,
    activityName: item.activity_name,
    purpose: item.purpose,
    requesterName: item.requester_name,
    laboratoryName: item.laboratory_name,
    capabilities: {
        view: item.can_view,
    },
});

const sarprasCalendarViewItems = (): BookingCalendarViewItem[] =>
    sarprasCalendarItems.map(toSarprasCalendarViewItem);

const sarprasCalendarItemsForDate = (dateKey: string): BookingCalendarViewItem[] =>
    sarprasCalendarViewItems()
        .filter((item) => formatIsoDateKeyInJakarta(item.startAt) === dateKey)
        .sort((left, right) =>
            new Date(left.startAt).getTime() - new Date(right.startAt).getTime());

const sarprasCalendarUpcomingItems = (): TendikCalendarItem[] =>
    [...sarprasCalendarUpcomingItemsState]
        .filter((item) => new Date(item.end_at).getTime() >= Date.now())
        .sort((left, right) =>
            new Date(left.start_at).getTime() - new Date(right.start_at).getTime())
        .slice(0, 5);

const sarprasCalendarUpcomingViewItems = (): BookingCalendarViewItem[] =>
    sarprasCalendarUpcomingItems().map(toSarprasCalendarViewItem);

const sarprasCalendarStatusCount = (status: BookingStatus): number =>
    Number(sarprasCalendarStatusCounts[status] ?? 0);

const sarprasCalendarAllStatusCount = (): number =>
    BOOKING_STATUSES.reduce((total, status) => total + sarprasCalendarStatusCount(status), 0);

const sarprasCalendarStatusOptions = () =>
    (['all', ...BOOKING_STATUSES] as CalendarStatusFilter[]).map((value) => {
        const copy = tendikCalendarCopy();
        const label = value === 'all' ? 'Semua' : getBookingStatusLabel(value);
        const count = value === 'all' ? sarprasCalendarAllStatusCount() : sarprasCalendarStatusCount(value);

        return {
            value,
            label,
            count,
            selected: sarprasCalendarState.status === value,
            ariaLabel: `Filter status ${label}, ${count} ${copy.statusAriaNoun}.`,
        };
    });

const sarprasCalendarRoomOptions = (): CalendarRoomOption[] =>
    Array.from(sarprasCalendarRoomMap.values())
        .filter((room) => room.type === calendarRoomType())
        .filter((room) =>
            calendarRole() !== 'laboran'
            || sarprasCalendarState.laboratoryId === null
            || room.laboratoryId === sarprasCalendarState.laboratoryId)
        .sort((left, right) =>
            `${left.code} ${left.name}`.localeCompare(`${right.code} ${right.name}`, 'id'));

const sarprasCalendarManagedRoomOptions = () =>
    sarprasCalendarRoomOptions().map((room) => ({
        value: String(room.id),
        label: `${room.code} - ${room.name}`,
        selected: sarprasCalendarState.roomId === room.id,
    }));

const sarprasCalendarLaboratoryOptions = () =>
    Array.from(sarprasCalendarLaboratoryMap.values())
        .sort((left, right) => left.name.localeCompare(right.name, 'id'))
        .map((laboratory) => ({
            value: String(laboratory.id),
            label: laboratory.name,
            selected: sarprasCalendarState.laboratoryId === laboratory.id,
        }));

const renderSarprasCalendarGrid = (): string =>
    renderBookingCalendarGridCells(
        sarprasCalendarState.cursor,
        sarprasCalendarState.selectedDateKey,
        sarprasCalendarViewItems(),
        SARPRAS_CALENDAR_DATE_ATTRIBUTE,
    );

const renderRoleNotice = (): string => {
    switch (reviewerRole()) {
        case 'sarpras':
            return `
                <div data-reviewer-role="sarpras" class="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
                    Anda meninjau peminjaman <strong>ruang kelas</strong>. Otorisasi akhir tetap divalidasi oleh server.
                </div>
            `;
        case 'kepala_lab':
            return `
                <div data-reviewer-role="kepala_lab" class="rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4 text-sm text-teal-800">
                    Anda meninjau peminjaman laboratorium yang berada dalam lingkup laboratorium Anda.
                </div>
            `;
        case 'laboran':
            return `
                <div data-reviewer-role="laboran" class="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                    <strong>Akses baca saja.</strong> Laboran dapat melihat antrean dan detail, tetapi tidak dapat menyetujui, meminta revisi, atau menolak pengajuan.
                </div>
            `;
        case 'persuratan':
            return `
                <div data-reviewer-role="persuratan" class="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-700">
                    Peminjaman Ruangan terpisah dari alur Persuratan. Akun Persuratan tidak memiliki akses reviewer Peminjaman.
                </div>
            `;
        default:
            return `
                <div class="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-700">
                    Hak akses tindakan akan mengikuti profil aktif dan validasi backend.
                </div>
            `;
    }
};

const optionSelected = (actual: unknown, expected: unknown): string =>
    actual === expected ? 'selected' : '';

const renderFilters = (): string => {
    const rooms = Array.from(knownRooms.values()).sort((left, right) =>
        `${left.code} ${left.name}`.localeCompare(`${right.code} ${right.name}`, 'id'));

    return `
        <form id="tendik-peminjaman-filters" class="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <label class="text-xs font-bold text-gray-600">
                    Status
                    <select id="tendik-peminjaman-status" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                        <option value="">Semua status</option>
                        ${(['submitted', 'revision_requested', 'approved', 'rejected', 'cancelled'] as BookingStatus[]).map((status) => `
                            <option value="${status}" ${optionSelected(filters.status, status)}>${getBookingStatusLabel(status)}</option>
                        `).join('')}
                    </select>
                </label>
                <label class="text-xs font-bold text-gray-600">
                    Jenis Ruangan
                    <select id="tendik-peminjaman-room-type" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                        <option value="">Semua jenis</option>
                        <option value="classroom" ${optionSelected(filters.roomType, 'classroom')}>Ruang Kelas</option>
                        <option value="laboratory" ${optionSelected(filters.roomType, 'laboratory')}>Laboratorium</option>
                    </select>
                </label>
                <label class="text-xs font-bold text-gray-600">
                    Ruangan
                    <select id="tendik-peminjaman-room-id" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                        <option value="">Semua ruangan</option>
                        ${rooms.map((room) => `
                            <option value="${room.id}" ${optionSelected(filters.roomId, room.id)}>${escapeHtml(room.code)} · ${escapeHtml(room.name)}</option>
                        `).join('')}
                    </select>
                </label>
                <label class="text-xs font-bold text-gray-600">
                    Dari Tanggal
                    <input id="tendik-peminjaman-date-from" type="date" value="${escapeHtml(filters.dateFrom ?? '')}" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                </label>
                <label class="text-xs font-bold text-gray-600">
                    Sampai Tanggal
                    <input id="tendik-peminjaman-date-to" type="date" value="${escapeHtml(filters.dateTo ?? '')}" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                </label>
            </div>
            ${filterError ? `<p role="alert" class="mt-3 text-sm font-semibold text-red-700">${escapeHtml(filterError)}</p>` : ''}
            <div class="mt-4 flex flex-wrap justify-end gap-3">
                <button id="reset-tendik-peminjaman-filters" type="button" class="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Reset</button>
                <button type="submit" class="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Terapkan Filter</button>
            </div>
        </form>
    `;
};

const renderQueueRows = (): string => queue.map((booking) => `
    <tr class="border-b border-gray-100 last:border-0">
        <td class="px-5 py-4 align-top">
            <p class="break-words text-sm font-bold text-gray-800">${escapeHtml(booking.activity_name)}</p>
            <p class="mt-1 text-xs text-gray-500">${escapeHtml(booking.requester?.name ?? 'Pemohon tidak tersedia')}</p>
        </td>
        <td class="px-5 py-4 align-top">
            <p class="break-words text-sm font-semibold text-gray-700">${escapeHtml(booking.room.code)} · ${escapeHtml(booking.room.name)}</p>
            <p class="mt-1 text-xs text-gray-500">${escapeHtml(getRoomTypeLabel(booking.room.type))}</p>
        </td>
        <td class="px-5 py-4 align-top text-sm text-gray-600">
            <p>${escapeHtml(formatDateTime(booking.start_at))}</p>
            <p class="mt-1 text-xs">${escapeHtml(formatTimeRange(booking.start_at, booking.end_at))}</p>
        </td>
        <td class="px-5 py-4 align-top">
            <span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getBookingStatusTone(booking.status)}">${escapeHtml(getBookingStatusLabel(booking.status))}</span>
        </td>
        <td class="px-5 py-4 text-right align-top">
            <button type="button" data-tendik-booking-detail="${booking.id}" class="rounded-xl border border-teal-700 px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50">Lihat Detail</button>
        </td>
    </tr>
`).join('');

const renderPagination = (): string => {
    if (pagination.last_page <= 1) return '';
    return `
        <div class="flex items-center justify-between gap-4 border-t border-gray-100 px-5 py-4">
            <p class="text-xs font-medium text-gray-500">Halaman ${pagination.current_page} dari ${pagination.last_page} · ${pagination.total} pengajuan</p>
            <div class="flex gap-2">
                <button id="tendik-peminjaman-prev" type="button" ${pagination.current_page <= 1 ? 'disabled' : ''} class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button>
                <button id="tendik-peminjaman-next" type="button" ${pagination.current_page >= pagination.last_page ? 'disabled' : ''} class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button>
            </div>
        </div>
    `;
};

const renderQueueState = (): string => {
    if (queueLoading) {
        return `
            <div data-reviewer-queue-state="loading" class="px-6 py-16 text-center">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" aria-hidden="true"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat antrean review peminjaman...</p>
            </div>
        `;
    }
    if (queueErrorStatus === 403) {
        return `
            <div data-reviewer-queue-state="unauthorized" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Akses reviewer tidak tersedia</h3>
                <p class="mx-auto mt-2 max-w-xl text-sm text-gray-500">${escapeHtml(queueError)}</p>
                <button id="retry-tendik-peminjaman" type="button" class="mt-5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">Coba Lagi</button>
            </div>
        `;
    }
    if (queueError) {
        return `
            <div data-reviewer-queue-state="error" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Antrean gagal dimuat</h3>
                <p class="mx-auto mt-2 max-w-xl text-sm text-gray-500">${escapeHtml(queueError)}</p>
                <button id="retry-tendik-peminjaman" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">Coba Lagi</button>
            </div>
        `;
    }
    if (queue.length === 0) {
        return `
            <div data-reviewer-queue-state="empty" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Belum ada pengajuan dalam antrean</h3>
                <p class="mt-2 text-sm text-gray-500">Tidak ada peminjaman yang sesuai dengan lingkup dan filter aktif.</p>
            </div>
        `;
    }
    return `
        <div data-reviewer-queue-state="success" class="overflow-x-auto">
            <table class="min-w-[920px] w-full text-left">
                <thead class="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <tr>
                        <th class="px-5 py-4">Kegiatan / Pemohon</th>
                        <th class="px-5 py-4">Ruangan</th>
                        <th class="px-5 py-4">Jadwal</th>
                        <th class="px-5 py-4">Status</th>
                        <th class="px-5 py-4"></th>
                    </tr>
                </thead>
                <tbody>${renderQueueRows()}</tbody>
            </table>
        </div>
        ${renderPagination()}
    `;
};

const renderTabBar = (): string => {
    if (!canManageRooms() && !canUseCalendar()) return '';
    const tab = (id: TendikTab, label: string): string => `
        <button type="button" role="tab" data-tendik-tab="${id}" aria-selected="${activeTab === id}" class="rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === id ? 'bg-teal-700 text-white' : 'border border-gray-200 bg-white text-gray-600'}">${label}</button>
    `;
    const tabs: Array<[TendikTab, string]> = [['queue', 'Pengajuan']];
    if (canUseCalendar()) tabs.push(['calendar', 'Kalender Peminjaman']);
    if (canManageRooms()) tabs.push(['rooms', 'Kelola Ruangan']);

    return `
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Bagian Peminjaman Ruangan">
            ${tabs.map(([id, label]) => tab(id, label)).join('')}
        </div>
    `;
};

const renderQueueTab = (): string => `
    <div class="space-y-5">
        ${renderRoleNotice()}
        ${renderFilters()}
        <section class="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm" aria-live="polite">
            <div class="border-b border-gray-100 px-5 py-5">
                <h3 class="text-base font-bold text-gray-800">Antrean Review Peminjaman</h3>
                <p class="mt-1 text-xs text-gray-500">Daftar ini mengikuti lingkup reviewer yang ditentukan backend.</p>
            </div>
            ${renderQueueState()}
        </section>
    </div>
`;

const renderSarprasCalendarTab = (): string => {
    const copy = tendikCalendarCopy();

    return renderBookingCalendarView({
        copy: {
            title: copy.title,
            helper: copy.helper,
            densityHelper: copy.densityHelper,
            totalText: `${sarprasCalendarItems.length} ${copy.totalNoun} mengikuti filter aktif.`,
            roomTypeFilterLabel: 'Jenis Ruangan',
            roomTypeFilterAriaLabel: copy.roomTypeFilterAriaLabel,
            statusFilterLabel: 'Status',
            statusFilterAriaLabel: 'Filter status kalender Tendik',
            laboratoryLabel: 'Laboratorium',
            roomLabel: 'Ruangan',
            allLaboratoriesLabel: 'Semua laboratorium',
            allRoomsLabel: 'Semua ruangan',
            resetLabel: 'Reset Kalender',
            loadingText: copy.loadingText,
            errorTitle: 'Kalender gagal dimuat',
            retryLabel: 'Coba Lagi',
            monthEmptyText: copy.monthEmptyText,
        },
        ids: {
            previousMonthButton: 'sarpras-calendar-prev-month',
            nextMonthButton: 'sarpras-calendar-next-month',
            todayButton: 'sarpras-calendar-today',
            resetButton: 'sarpras-calendar-reset',
            monthHeading: 'sarpras-calendar-month-heading',
            grid: 'sarpras-peminjaman-calendar-grid',
            retryButton: 'sarpras-calendar-retry',
            laboratorySelect: 'sarpras-calendar-laboratory',
            roomSelect: 'sarpras-calendar-room',
        },
        dataAttributes: {
            dateCell: SARPRAS_CALENDAR_DATE_ATTRIBUTE,
            roomTypeFilter: 'data-sarpras-calendar-room-type',
            statusFilter: 'data-sarpras-calendar-status',
            calendarState: 'data-sarpras-calendar-state',
            upcomingState: 'data-sarpras-calendar-upcoming-state',
        },
        navigation: {
            previousMonthAriaLabel: 'Bulan sebelumnya',
            nextMonthAriaLabel: 'Bulan berikutnya',
            todayLabel: 'Hari Ini',
            todayAriaLabel: 'Kembali ke bulan dan tanggal hari ini',
        },
        state: {
            cursor: sarprasCalendarState.cursor,
            selectedDateKey: sarprasCalendarState.selectedDateKey,
            items: sarprasCalendarViewItems(),
            loading: sarprasCalendarLoading,
            loaded: sarprasCalendarLoaded,
            error: sarprasCalendarError,
        },
        filters: {
            roomTypeOptions: [],
            statusOptions: sarprasCalendarStatusOptions(),
            laboratoryOptions: sarprasCalendarLaboratoryOptions(),
            roomOptions: sarprasCalendarManagedRoomOptions(),
        },
        filterVisibility: {
            roomType: false,
            laboratory: calendarRole() === 'laboran',
            status: true,
            room: true,
        },
        upcoming: {
            title: copy.upcomingTitle,
            subtitle: 'Mengikuti filter aktif, mulai hari ini.',
            loading: sarprasCalendarUpcomingLoading,
            error: sarprasCalendarUpcomingError,
            loadingText: copy.upcomingLoadingText,
            emptyText: copy.upcomingEmptyText,
            items: sarprasCalendarUpcomingViewItems(),
        },
        actions: [SARPRAS_CALENDAR_DETAIL_ACTION],
    });
};

const renderRoomsTabState = (): string => {
    if (managedRoomsLoading) {
        return `
            <div data-tendik-rooms-state="loading" class="px-6 py-16 text-center">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat data ruangan...</p>
            </div>
        `;
    }
    if (managedRoomsError) {
        return `
            <div data-tendik-rooms-state="error" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Data ruangan gagal dimuat</h3>
                <p class="mt-2 text-sm text-gray-500">${escapeHtml(managedRoomsError)}</p>
                <button id="tendik-rooms-retry" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">Coba Lagi</button>
            </div>
        `;
    }
    if (managedRooms.length === 0) {
        return `
            <div data-tendik-rooms-state="empty" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Belum ada ruangan dalam lingkup Anda</h3>
                <p class="mt-2 text-sm text-gray-500">Ruangan yang dapat Anda kelola akan muncul di sini.</p>
            </div>
        `;
    }
    return `<div data-tendik-rooms-state="success">${renderRoomManagementTable(managedRooms, {
        selectable: roomsAreBulkSelectable(),
        selectedIds: roomSelection,
        canSelect: canBulkDelete,
    })}</div>`;
};

// Bulk-selection toolbar (mirrors the SuperAdmin master pattern). Only rendered
// when at least one visible room is removable; hidden until a row is selected.
const renderRoomBulkBar = (): string => `
    <div id="room-bulk-bar" class="hidden flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-teal-50/40 px-5 py-3">
        <span id="room-bulk-count" class="text-sm font-semibold text-teal-800">0 ruangan dipilih</span>
        <div class="flex items-center gap-2">
            <button id="room-bulk-cancel" type="button" class="rounded-xl border border-gray-200 bg-white px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Batal</button>
            <button id="room-bulk-delete" type="button" class="rounded-xl bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600">Hapus</button>
        </div>
    </div>
`;

const renderRoomsTab = (): string => {
    const canCreate = allowedCreateTypes().length > 0;
    const scopeCopy = reviewerRole() === 'sarpras'
        ? 'Kelola data ruang kelas: informasi, foto, fasilitas, dan template.'
        : reviewerRole() === 'kepala_lab'
            ? 'Kelola data laboratorium dalam lingkup Anda.'
            : 'Kelola data seluruh laboratorium. Persetujuan pengajuan tetap oleh Kepala Lab.';
    return `
        <div class="space-y-5">
            <section class="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm" aria-live="polite">
                <div class="flex flex-col gap-3 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 class="text-base font-bold text-gray-800">Kelola Ruangan</h3>
                        <p class="mt-1 text-xs text-gray-500">${scopeCopy}</p>
                    </div>
                    ${canCreate ? '<button id="tendik-rooms-add" type="button" class="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Tambah Ruang Kelas</button>' : ''}
                </div>
                ${roomsAreBulkSelectable() ? renderRoomBulkBar() : ''}
                ${renderRoomsTabState()}
            </section>
        </div>
    `;
};

const renderMainState = (): void => {
    const root = document.getElementById('tendik-peminjaman-page-state');
    if (!root) return;
    if (activeTab === 'calendar' && !canUseCalendar()) activeTab = 'queue';
    if (activeTab === 'rooms' && !canManageRooms()) activeTab = 'queue';
    const showCalendar = canUseCalendar() && activeTab === 'calendar';
    const showRooms = canManageRooms() && activeTab === 'rooms';
    root.innerHTML = `
        <div class="space-y-5">
            ${renderTabBar()}
            ${showCalendar ? renderSarprasCalendarTab() : showRooms ? renderRoomsTab() : renderQueueTab()}
        </div>
    `;
    attachTabListeners();
    if (showCalendar) attachSarprasCalendarListeners();
    else if (showRooms) attachRoomsListeners();
    else attachMainListeners();
};

const attachTabListeners = (): void => {
    document.querySelectorAll<HTMLElement>('[data-tendik-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tendikTab as TendikTab;
            if (tab === activeTab) return;
            activeTab = tab;
            clearRoomSelection();
            renderMainState();
            if (tab === 'calendar' && !sarprasCalendarLoaded) void loadSarprasCalendar();
            if (tab === 'rooms' && !managedRoomsLoaded) void loadManagedRooms();
        });
    });
};

const reloadSarprasCalendarForFilterChange = (): void => {
    sarprasCalendarState.selectedDateKey = null;
    closeSarprasCalendarDayDrawer();
    void loadSarprasCalendar();
};

const focusSarprasCalendarDateButton = (dateKey: string): void => {
    document.querySelector<HTMLElement>(`[${SARPRAS_CALENDAR_DATE_ATTRIBUTE}="${dateKey}"]`)?.focus();
};

const moveSarprasCalendarFocus = (dateKey: string, key: string): void => {
    const targetDateKey = getCalendarKeyboardTargetDateKey(dateKey, key);
    if (!targetDateKey) return;

    const [targetYear, targetMonth] = targetDateKey.split('-').map(Number);
    if (!targetYear || !targetMonth) return;

    const monthChanged = targetYear !== sarprasCalendarState.cursor.getFullYear()
        || targetMonth - 1 !== sarprasCalendarState.cursor.getMonth();

    if (!monthChanged) {
        focusSarprasCalendarDateButton(targetDateKey);
        return;
    }

    sarprasCalendarState.cursor = new Date(targetYear, targetMonth - 1, 1);
    sarprasCalendarState.selectedDateKey = null;
    closeSarprasCalendarDayDrawer();
    void loadSarprasCalendar().then(() => focusSarprasCalendarDateButton(targetDateKey));
};

const selectSarprasCalendarDate = (dateKey: string): void => {
    sarprasCalendarState.selectedDateKey = dateKey;
    const grid = document.getElementById('sarpras-peminjaman-calendar-grid');
    if (grid) grid.innerHTML = renderSarprasCalendarGrid();
    openSarprasCalendarDayDrawer(dateKey);
};

const closeSarprasCalendarDayDrawer = (refreshGrid = false): void => {
    document.getElementById('sarpras-calendar-day-drawer-root')?.remove();
    if (calendarDayEscapeHandler) {
        document.removeEventListener('keydown', calendarDayEscapeHandler);
        calendarDayEscapeHandler = null;
    }
    if (refreshGrid) {
        sarprasCalendarState.selectedDateKey = null;
        const grid = document.getElementById('sarpras-peminjaman-calendar-grid');
        if (grid) grid.innerHTML = renderSarprasCalendarGrid();
    }
};

const attachSarprasCalendarDetailButtons = (root: ParentNode = document): void => {
    root.querySelectorAll<HTMLElement>('[data-sarpras-calendar-detail]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.sarprasCalendarDetail);
            if (!Number.isInteger(id) || id <= 0) return;
            closeSarprasCalendarDayDrawer();
            void openDetail(id);
        });
    });
};

const openSarprasCalendarDayDrawer = (dateKey: string): void => {
    closeSarprasCalendarDayDrawer();
    const items = sarprasCalendarItemsForDate(dateKey);
    const copy = tendikCalendarCopy();
    const root = document.createElement('div');
    root.id = 'sarpras-calendar-day-drawer-root';
    root.innerHTML = renderBookingCalendarSelectedDatePanel({
        dateKey,
        items,
        titleEyebrow: copy.dayEyebrow,
        titleId: 'sarpras-calendar-day-title',
        closeButtonId: 'close-sarpras-calendar-day',
        closeButtonLabel: 'Tutup detail tanggal',
        overlayDataAttribute: 'data-sarpras-calendar-day-overlay',
        countText: `${items.length} ${copy.dayCountNoun} pada tanggal ini mengikuti filter aktif.`,
        emptyText: copy.dayEmptyText,
        actions: [SARPRAS_CALENDAR_DETAIL_ACTION],
    });
    document.body.appendChild(root);

    const close = (): void => closeSarprasCalendarDayDrawer(true);
    root.querySelector('[data-sarpras-calendar-day-overlay]')?.addEventListener('click', close);
    root.querySelector('#close-sarpras-calendar-day')?.addEventListener('click', close);
    attachSarprasCalendarDetailButtons(root);
    calendarDayEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', calendarDayEscapeHandler);
    root.querySelector<HTMLButtonElement>('#close-sarpras-calendar-day')?.focus();
};

const attachSarprasCalendarListeners = (): void => {
    document.querySelectorAll<HTMLElement>('[data-sarpras-calendar-status]').forEach((button) => {
        button.addEventListener('click', () => {
            const value = button.dataset.sarprasCalendarStatus as CalendarStatusFilter | undefined;
            if (!value || sarprasCalendarState.status === value) return;
            sarprasCalendarState.status = value;
            reloadSarprasCalendarForFilterChange();
        });
    });
    document.getElementById('sarpras-calendar-room')?.addEventListener('change', () => {
        const value = (document.getElementById('sarpras-calendar-room') as HTMLSelectElement | null)?.value ?? '';
        sarprasCalendarState.roomId = value ? Number(value) : null;
        reloadSarprasCalendarForFilterChange();
    });
    document.getElementById('sarpras-calendar-laboratory')?.addEventListener('change', () => {
        const value = (document.getElementById('sarpras-calendar-laboratory') as HTMLSelectElement | null)?.value ?? '';
        sarprasCalendarState.laboratoryId = value ? Number(value) : null;
        if (
            sarprasCalendarState.roomId !== null
            && !sarprasCalendarRoomOptions().some((room) => room.id === sarprasCalendarState.roomId)
        ) {
            sarprasCalendarState.roomId = null;
        }
        reloadSarprasCalendarForFilterChange();
    });
    document.getElementById('sarpras-calendar-reset')?.addEventListener('click', () => {
        sarprasCalendarState = createResetSarprasCalendarState(calendarRole());
        closeSarprasCalendarDayDrawer();
        void loadSarprasCalendar();
    });
    document.getElementById('sarpras-calendar-prev-month')?.addEventListener('click', () => {
        sarprasCalendarState.cursor = new Date(
            sarprasCalendarState.cursor.getFullYear(),
            sarprasCalendarState.cursor.getMonth() - 1,
            1,
        );
        reloadSarprasCalendarForFilterChange();
    });
    document.getElementById('sarpras-calendar-next-month')?.addEventListener('click', () => {
        sarprasCalendarState.cursor = new Date(
            sarprasCalendarState.cursor.getFullYear(),
            sarprasCalendarState.cursor.getMonth() + 1,
            1,
        );
        reloadSarprasCalendarForFilterChange();
    });
    document.getElementById('sarpras-calendar-today')?.addEventListener('click', () => {
        const now = new Date();
        sarprasCalendarState.cursor = new Date(now.getFullYear(), now.getMonth(), 1);
        sarprasCalendarState.selectedDateKey = formatDateKey(now);
        closeSarprasCalendarDayDrawer();
        void loadSarprasCalendar();
    });
    document.getElementById('sarpras-peminjaman-calendar-grid')?.addEventListener('click', (event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>(`[${SARPRAS_CALENDAR_DATE_ATTRIBUTE}]`);
        const dateKey = target?.getAttribute(SARPRAS_CALENDAR_DATE_ATTRIBUTE);
        if (!dateKey) return;
        selectSarprasCalendarDate(dateKey);
    });
    document.getElementById('sarpras-peminjaman-calendar-grid')?.addEventListener('keydown', (event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>(`[${SARPRAS_CALENDAR_DATE_ATTRIBUTE}]`);
        const dateKey = target?.getAttribute(SARPRAS_CALENDAR_DATE_ATTRIBUTE);
        if (!dateKey) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectSarprasCalendarDate(dateKey);
            return;
        }
        if (!getCalendarKeyboardTargetDateKey(dateKey, event.key)) return;
        event.preventDefault();
        moveSarprasCalendarFocus(dateKey, event.key);
    });
    document.getElementById('sarpras-calendar-retry')?.addEventListener('click', () => {
        void loadSarprasCalendar();
    });
    attachSarprasCalendarDetailButtons();
};

const loadSarprasCalendar = async (): Promise<void> => {
    const sequence = ++sarprasCalendarRequestSequence;
    const copy = tendikCalendarCopy();
    sarprasCalendarLoading = true;
    sarprasCalendarUpcomingLoading = true;
    sarprasCalendarError = null;
    sarprasCalendarUpcomingError = null;
    renderMainState();

    const [monthResult, upcomingResult] = await Promise.allSettled([
        getTendikBookingCalendar(sarprasCalendarApiFilters()),
        getTendikBookingCalendar(sarprasCalendarUpcomingApiFilters()),
    ]);

    if (sequence !== sarprasCalendarRequestSequence) return;

    if (monthResult.status === 'fulfilled') {
        sarprasCalendarItems = monthResult.value.items;
        sarprasCalendarStatusCounts = monthResult.value.summary.counts_by_status ?? {};
        rememberSarprasCalendarRooms(monthResult.value.items);
        sarprasCalendarError = null;
    } else {
        sarprasCalendarItems = [];
        sarprasCalendarStatusCounts = {};
        sarprasCalendarError = errorMessage(monthResult.reason, copy.calendarErrorFallback);
    }

    if (upcomingResult.status === 'fulfilled') {
        sarprasCalendarUpcomingItemsState = upcomingResult.value.items;
        rememberSarprasCalendarRooms(upcomingResult.value.items);
        sarprasCalendarUpcomingError = null;
    } else {
        sarprasCalendarUpcomingItemsState = [];
        sarprasCalendarUpcomingError = errorMessage(upcomingResult.reason, copy.upcomingErrorFallback);
    }

    if (
        sarprasCalendarState.roomId !== null
        && !sarprasCalendarRoomOptions().some((room) => room.id === sarprasCalendarState.roomId)
    ) {
        sarprasCalendarState.roomId = null;
    }

    sarprasCalendarLoaded = true;
    sarprasCalendarLoading = false;
    sarprasCalendarUpcomingLoading = false;
    renderMainState();
};

const attachRoomsListeners = (): void => {
    document.getElementById('tendik-rooms-retry')?.addEventListener('click', () => {
        void loadManagedRooms();
    });
    document.getElementById('tendik-rooms-add')?.addEventListener('click', () => {
        openRoomFormModal({
            mode: 'create',
            laboratories: managedLaboratories(),
            allowedTypes: allowedCreateTypes(),
            onSaved: (saved) => {
                showToast('Ruangan berhasil dibuat.', true);
                void loadManagedRooms().then(() => {
                    void openRoomManagementDrawer(saved.id, roomDrawerOptions());
                });
            },
        });
    });
    const tableRoot = document.querySelector('[data-tendik-rooms-state="success"]');
    if (tableRoot) {
        attachRoomTableListeners(tableRoot, (id) => {
            void openRoomManagementDrawer(id, roomDrawerOptions());
        });
        attachRoomSelectionListeners(tableRoot, {
            onToggleRow: (id, checked) => {
                if (checked) roomSelection.add(id);
                else roomSelection.delete(id);
                updateRoomBulkBar();
            },
            onToggleAll: (checked) => {
                bulkSelectableRooms().forEach((room) => {
                    if (checked) roomSelection.add(room.id);
                    else roomSelection.delete(room.id);
                });
                document.querySelectorAll<HTMLInputElement>('.room-checkbox')
                    .forEach((checkbox) => { checkbox.checked = checked; });
                updateRoomBulkBar();
            },
        });
        hydrateRoomTableCovers(tableRoot, roomCoverCache, () => activeTab === 'rooms');
    }

    document.getElementById('room-bulk-cancel')?.addEventListener('click', () => {
        roomSelection.clear();
        document.querySelectorAll<HTMLInputElement>('.room-checkbox').forEach((checkbox) => { checkbox.checked = false; });
        updateRoomBulkBar();
    });
    document.getElementById('room-bulk-delete')?.addEventListener('click', () => openRoomBulkConfirm());
    updateRoomBulkBar();
};

/** Show/hide the bulk bar and sync the select-all header from roomSelection. */
const updateRoomBulkBar = (): void => {
    const bar = document.getElementById('room-bulk-bar');
    if (!bar) return;
    const count = roomSelection.size;
    if (count > 0) {
        bar.classList.remove('hidden');
        const label = document.getElementById('room-bulk-count');
        if (label) label.textContent = `${count} ruangan dipilih`;
    } else {
        bar.classList.add('hidden');
    }
    const selectAll = document.querySelector<HTMLInputElement>('[data-room-select-all]');
    if (selectAll) {
        const ids = bulkSelectableRooms().map((room) => room.id);
        selectAll.checked = ids.length > 0 && ids.every((id) => roomSelection.has(id));
    }
};

const openRoomBulkConfirm = (): void => {
    const count = roomSelection.size;
    if (count === 0) return;
    document.getElementById('room-bulk-confirm-root')?.remove();

    const root = document.createElement('div');
    root.id = 'room-bulk-confirm-root';
    root.innerHTML = `
        <div data-room-bulk-overlay class="fixed inset-0 z-[240] bg-black/50"></div>
        <section role="alertdialog" aria-modal="true" aria-labelledby="room-bulk-confirm-title" class="fixed left-1/2 top-1/2 z-[241] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="room-bulk-confirm-title" class="text-lg font-bold text-gray-900">Hapus Ruangan Terpilih?</h2>
            <p class="mt-3 text-sm text-gray-600">Anda akan menghapus <strong>${count}</strong> ruangan terpilih. Foto dan data fasilitas ruangan akan ikut terhapus. Ruangan yang memiliki riwayat peminjaman <strong>tidak dihapus permanen</strong> — ruangan tersebut diarsipkan (dinonaktifkan) agar tidak muncul di katalog, sementara data peminjaman tetap tersimpan. Tindakan ini tidak dapat dibatalkan.</p>
            <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button id="room-bulk-confirm-cancel" type="button" class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                <button id="room-bulk-confirm-ok" type="button" class="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">Hapus</button>
            </div>
        </section>
    `;
    document.body.appendChild(root);

    const close = (): void => {
        root.remove();
        if (bulkConfirmEscape) { document.removeEventListener('keydown', bulkConfirmEscape); bulkConfirmEscape = null; }
    };
    bulkConfirmEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', bulkConfirmEscape);
    root.querySelector('[data-room-bulk-overlay]')?.addEventListener('click', close);
    root.querySelector('#room-bulk-confirm-cancel')?.addEventListener('click', close);
    root.querySelector('#room-bulk-confirm-ok')?.addEventListener('click', () => { close(); void performBulkDelete(); });
    root.querySelector<HTMLButtonElement>('#room-bulk-confirm-ok')?.focus();
};

const performBulkDelete = async (): Promise<void> => {
    const ids = [...roomSelection];
    if (ids.length === 0) return;
    try {
        const result = await bulkDeleteRooms(ids);
        const { deleted, archived } = result.summary;
        const message = deleted > 0 && archived > 0
            ? `${deleted} ruangan dihapus, ${archived} diarsipkan (memiliki riwayat peminjaman).`
            : archived > 0
                ? `${archived} ruangan diarsipkan karena memiliki riwayat peminjaman.`
                : `${deleted} ruangan berhasil dihapus.`;
        showToast(message, true);
        roomSelection.clear();
        // A deleted/archived room's detail drawer must not linger.
        closeRoomManagementDrawer();
        await loadManagedRooms();
    } catch (error) {
        // Keep the selection so the user can see the failed rows and retry.
        showToast(errorMessage(error, 'Gagal menghapus ruangan.'), false);
    }
};

const loadManagedRooms = async (): Promise<void> => {
    // A reload (retry / post-create / post-delete) drops the selection so we
    // never act on rows that are no longer visible.
    clearRoomSelection();
    managedRoomsLoading = true;
    managedRoomsError = null;
    if (activeTab === 'rooms') renderMainState();
    try {
        managedRooms = await listManagedRooms();
        managedRoomsLoaded = true;
        managedRoomsError = null;
    } catch (error) {
        managedRooms = [];
        managedRoomsError = errorMessage(error, 'Data ruangan gagal dimuat.');
    } finally {
        managedRoomsLoading = false;
        if (activeTab === 'rooms') renderMainState();
    }
};

const pageShell = (): string => `
    <div class="mx-auto max-w-7xl space-y-6 pb-12">
        <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">${escapeHtml(roleLabel(reviewerRole()))}</p>
            <h2 class="mt-1 text-3xl font-bold tracking-tight text-gray-800">Peminjaman Ruangan</h2>
            <p class="mt-2 text-sm text-gray-500">Tinjau pengajuan sesuai lingkup Sarpras atau laboratorium tanpa mencampurkannya dengan workflow Persuratan.</p>
        </div>
        <div id="tendik-peminjaman-page-state" aria-live="polite"></div>
    </div>
`;

const closeDrawer = (): void => {
    closeSuratPreview();
    document.getElementById('tendik-peminjaman-detail-root')?.remove();
    if (drawerEscapeHandler) {
        document.removeEventListener('keydown', drawerEscapeHandler);
        drawerEscapeHandler = null;
    }
};

const closeActionDialog = (): void => {
    document.getElementById('tendik-peminjaman-action-root')?.remove();
    if (actionEscapeHandler) {
        document.removeEventListener('keydown', actionEscapeHandler);
        actionEscapeHandler = null;
    }
};

const detailRoot = (): HTMLElement => {
    let root = document.getElementById('tendik-peminjaman-detail-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'tendik-peminjaman-detail-root';
        document.body.appendChild(root);
    }
    return root;
};

const renderDetailRows = (booking: TendikBooking): string => [
    ['Pemohon', booking.requester?.name ?? '-'],
    ['Email Pemohon', booking.requester?.email ?? '-'],
    ['Ruangan', `${booking.room.code} · ${booking.room.name}`],
    ['Lokasi', booking.room.location],
    ['Jenis', getRoomTypeLabel(booking.room.type)],
    ['Kapasitas', `${booking.room.capacity} orang`],
    ['Jumlah Peserta', `${booking.participant_count} orang`],
    ['Mulai', formatDateTime(booking.start_at)],
    ['Selesai', formatDateTime(booking.end_at)],
].map(([label, value]) => `
    <div class="grid grid-cols-[120px_1fr] gap-3 border-b border-gray-100 py-3 last:border-0">
        <dt class="text-xs font-bold text-gray-500">${escapeHtml(label)}</dt>
        <dd class="break-words text-sm font-semibold text-gray-800">${escapeHtml(value)}</dd>
    </div>
`).join('');

const renderHistory = (booking: TendikBooking): string => {
    const histories = booking.status_histories ?? [];
    if (histories.length === 0) {
        return '<p class="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-500">Riwayat status belum tersedia.</p>';
    }
    return `
        <ol class="space-y-3">
            ${histories.map((history) => `
                <li class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="text-xs font-bold text-gray-800">${escapeHtml(getBookingStatusLabel(history.to_status))}</span>
                        <time class="text-[11px] text-gray-500">${escapeHtml(formatDateTime(history.created_at))}</time>
                    </div>
                    <p class="mt-1 text-xs text-gray-500">${escapeHtml(history.actor?.name ?? 'Sistem')}</p>
                    ${history.note ? `<p class="mt-2 break-words text-sm text-gray-700">${escapeHtml(history.note)}</p>` : ''}
                </li>
            `).join('')}
        </ol>
    `;
};

const renderActionButtons = (booking: TendikBooking): string => {
    if (reviewerRole() === 'laboran') {
        return '<p class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Mode baca saja: tindakan reviewer tidak tersedia untuk Laboran.</p>';
    }
    if (
        !canAct()
        || booking.status !== 'submitted'
        || actionDeniedBookingIds.has(booking.id)
    ) return '';
    return `
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button id="approve-tendik-peminjaman" type="button" class="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Setujui</button>
            <button id="revise-tendik-peminjaman" type="button" class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100">Minta Revisi</button>
            <button id="reject-tendik-peminjaman" type="button" class="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100">Tolak</button>
        </div>
    `;
};

const renderDetailDrawer = (
    booking: TendikBooking | null,
    loading: boolean,
    error: string | null,
    actionError: string | null = null,
): void => {
    const root = detailRoot();
    root.innerHTML = `
        <div data-detail-overlay class="fixed inset-0 z-[200] bg-black/40"></div>
        <aside role="dialog" aria-modal="true" aria-labelledby="tendik-peminjaman-detail-title" class="fixed inset-y-0 right-0 z-[201] flex h-full w-full max-w-[620px] flex-col bg-white shadow-2xl">
            <header class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Detail Review</p>
                    <h2 id="tendik-peminjaman-detail-title" class="mt-1 text-xl font-bold text-gray-900">${booking ? escapeHtml(booking.activity_name) : 'Peminjaman Ruangan'}</h2>
                </div>
                <button id="close-tendik-peminjaman-detail" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Tutup detail">×</button>
            </header>
            <div class="flex-1 overflow-y-auto px-6 py-5">
                ${loading ? `
                    <div data-reviewer-detail-state="loading" class="py-16 text-center">
                        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                        <p class="mt-4 text-sm font-bold text-gray-700">Memuat detail pengajuan...</p>
                    </div>
                ` : error ? `
                    <div data-reviewer-detail-state="error" class="py-16 text-center">
                        <h3 class="text-base font-bold text-gray-800">Detail tidak dapat dimuat</h3>
                        <p class="mt-2 text-sm text-gray-500">${escapeHtml(error)}</p>
                    </div>
                ` : booking ? `
                    <div data-reviewer-detail-state="success" class="space-y-6">
                        ${actionError ? `<p role="alert" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${escapeHtml(actionError)}</p>` : ''}
                        <div class="flex flex-wrap items-center gap-3">
                            <span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getBookingStatusTone(booking.status)}">${escapeHtml(getBookingStatusLabel(booking.status))}</span>
                            <span class="text-xs font-semibold text-gray-500">${escapeHtml(getRoomTypeLabel(booking.room.type))}</span>
                        </div>
                        <section>
                            <h3 class="text-sm font-bold text-gray-800">Informasi Pengajuan</h3>
                            <dl class="mt-2">${renderDetailRows(booking)}</dl>
                        </section>
                        <section>
                            <h3 class="text-sm font-bold text-gray-800">Kegiatan</h3>
                            <p class="mt-2 break-words rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">${escapeHtml(booking.activity_name)}</p>
                        </section>
                        <section>
                            <h3 class="text-sm font-bold text-gray-800">Tujuan</h3>
                            <p class="mt-2 whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">${escapeHtml(booking.purpose)}</p>
                        </section>
                        ${booking.revision_note ? `<p class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Catatan revisi:</strong> ${escapeHtml(booking.revision_note)}</p>` : ''}
                        ${booking.rejection_reason ? `<p class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><strong>Alasan penolakan:</strong> ${escapeHtml(booking.rejection_reason)}</p>` : ''}
                        ${renderSuratPeminjamanPanel(booking, { allowReplace: false })}
                        <section>
                            <h3 class="mb-3 text-sm font-bold text-gray-800">Riwayat Status</h3>
                            ${renderHistory(booking)}
                        </section>
                        ${renderActionButtons(booking)}
                    </div>
                ` : ''}
            </div>
        </aside>
    `;

    const close = (): void => {
        closeActionDialog();
        closeDrawer();
    };
    root.querySelector('[data-detail-overlay]')?.addEventListener('click', close);
    root.querySelector('#close-tendik-peminjaman-detail')?.addEventListener('click', close);
    if (booking) {
        root.querySelector('#approve-tendik-peminjaman')?.addEventListener('click', () =>
            openActionDialog(booking, 'approve'));
        root.querySelector('#revise-tendik-peminjaman')?.addEventListener('click', () =>
            openActionDialog(booking, 'revise'));
        root.querySelector('#reject-tendik-peminjaman')?.addEventListener('click', () =>
            openActionDialog(booking, 'reject'));
        // Surat peminjaman PDF: protected preview overlay + authenticated blob
        // download. Read-only evidence for the reviewer — grants no authority.
        root.querySelector('#peminjaman-surat-preview')?.addEventListener('click', () => {
            openSuratPreview(booking);
        });
        root.querySelector('#peminjaman-surat-download')?.addEventListener('click', async () => {
            try {
                await downloadSuratPeminjamanPdf(
                    booking.id,
                    booking.surat_peminjaman_pdf?.original_name ?? 'surat-peminjaman.pdf',
                );
            } catch (downloadError) {
                showToast(
                    downloadError instanceof Error
                        ? downloadError.message
                        : 'Surat peminjaman gagal diunduh.',
                    false,
                );
            }
        });
    }
    if (drawerEscapeHandler) document.removeEventListener('keydown', drawerEscapeHandler);
    drawerEscapeHandler = (event: KeyboardEvent) => {
        // Escape closes the topmost layer first: action dialog and PDF preview
        // handle their own Escape; only close the drawer when neither is open.
        if (
            event.key === 'Escape'
            && !document.getElementById('tendik-peminjaman-action-root')
            && !document.getElementById('peminjaman-surat-preview-root')
        ) close();
    };
    document.addEventListener('keydown', drawerEscapeHandler);
    root.querySelector<HTMLButtonElement>('#close-tendik-peminjaman-detail')?.focus();
};

type ReviewerAction = 'approve' | 'revise' | 'reject';

const actionConfig = (action: ReviewerAction) => {
    switch (action) {
        case 'approve':
            return {
                title: 'Konfirmasi Persetujuan',
                description: 'Pengajuan akan disetujui setelah backend memastikan jadwal tidak bertabrakan.',
                label: 'Setujui Pengajuan',
                fieldLabel: '',
                required: '',
            };
        case 'revise':
            return {
                title: 'Minta Revisi Pengajuan',
                description: 'Tuliskan perubahan yang harus dilakukan oleh mahasiswa.',
                label: 'Kirim Permintaan Revisi',
                fieldLabel: 'Catatan revisi',
                required: 'Catatan revisi wajib diisi.',
            };
        case 'reject':
            return {
                title: 'Tolak Pengajuan',
                description: 'Berikan alasan yang jelas agar mahasiswa memahami keputusan reviewer.',
                label: 'Tolak Pengajuan',
                fieldLabel: 'Alasan penolakan',
                required: 'Alasan penolakan wajib diisi.',
            };
    }
};

const openActionDialog = (booking: TendikBooking, action: ReviewerAction): void => {
    closeActionDialog();
    const root = document.createElement('div');
    root.id = 'tendik-peminjaman-action-root';
    document.body.appendChild(root);
    const config = actionConfig(action);

    const render = (message: string | null, submitting: boolean, value = ''): void => {
        root.innerHTML = `
            <div data-action-overlay class="fixed inset-0 z-[210] bg-black/50"></div>
            <section role="dialog" aria-modal="true" aria-labelledby="tendik-peminjaman-action-title" class="fixed left-1/2 top-1/2 z-[211] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
                <h2 id="tendik-peminjaman-action-title" class="text-xl font-bold text-gray-900">${config.title}</h2>
                <p class="mt-2 text-sm text-gray-500">${config.description}</p>
                <p class="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800">${escapeHtml(booking.activity_name)} · ${escapeHtml(booking.room.code)}</p>
                <form id="tendik-peminjaman-action-form" class="mt-5 space-y-4">
                    ${action === 'approve' ? '' : `
                        <label class="block text-sm font-bold text-gray-700">
                            ${config.fieldLabel}
                            <textarea id="tendik-peminjaman-action-text" rows="5" maxlength="5000" class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700" ${submitting ? 'disabled' : ''}>${escapeHtml(value)}</textarea>
                        </label>
                    `}
                    ${message ? `<p role="alert" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${escapeHtml(message)}</p>` : ''}
                    <div class="flex justify-end gap-3">
                        <button id="cancel-tendik-peminjaman-action" type="button" ${submitting ? 'disabled' : ''} class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 disabled:opacity-50">Batal</button>
                        <button type="submit" ${submitting ? 'disabled' : ''} class="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">${submitting ? 'Memproses...' : config.label}</button>
                    </div>
                </form>
            </section>
        `;
        const close = (): void => closeActionDialog();
        root.querySelector('[data-action-overlay]')?.addEventListener('click', () => {
            if (!submitting) close();
        });
        root.querySelector('#cancel-tendik-peminjaman-action')?.addEventListener('click', close);
        root.querySelector('#tendik-peminjaman-action-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const text = (root.querySelector('#tendik-peminjaman-action-text') as HTMLTextAreaElement | null)?.value.trim() ?? '';
            if (action !== 'approve' && !text) {
                render(config.required, false, text);
                return;
            }
            render(null, true, text);
            try {
                if (action === 'approve') {
                    await approveTendikBooking(booking.id);
                } else if (action === 'revise') {
                    await reviseTendikBooking(booking.id, text);
                } else {
                    await rejectTendikBooking(booking.id, text);
                }
                closeActionDialog();
                showToast(
                    action === 'approve'
                        ? 'Pengajuan peminjaman berhasil disetujui.'
                        : action === 'revise'
                            ? 'Permintaan revisi berhasil dikirim.'
                            : 'Pengajuan peminjaman berhasil ditolak.',
                    true,
                );
                await refreshAfterAction(booking.id);
            } catch (error) {
                if (error instanceof PeminjamanApiError && error.status === 403) {
                    const message = errorMessage(error, 'Tindakan reviewer tidak diizinkan.');
                    actionDeniedBookingIds.add(booking.id);
                    closeActionDialog();
                    renderDetailDrawer(booking, false, null, message);
                    return;
                }
                render(errorMessage(error, 'Tindakan reviewer gagal diproses.'), false, text);
            }
        });
        root.querySelector<HTMLTextAreaElement>('#tendik-peminjaman-action-text')?.focus();
    };
    actionEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeActionDialog();
    };
    document.addEventListener('keydown', actionEscapeHandler);
    render(null, false);
};

const openDetail = async (bookingId: number): Promise<void> => {
    closeDrawer();
    renderDetailDrawer(null, true, null);
    try {
        renderDetailDrawer(await getTendikBooking(bookingId), false, null);
    } catch (error) {
        renderDetailDrawer(
            null,
            false,
            errorMessage(error, 'Detail pengajuan gagal dimuat.'),
        );
    }
};

const readFilters = (): TendikBookingFilters | null => {
    const status = (document.getElementById('tendik-peminjaman-status') as HTMLSelectElement | null)?.value as BookingStatus | '';
    const roomType = (document.getElementById('tendik-peminjaman-room-type') as HTMLSelectElement | null)?.value as RoomType | '';
    const roomIdValue = (document.getElementById('tendik-peminjaman-room-id') as HTMLSelectElement | null)?.value ?? '';
    const dateFrom = (document.getElementById('tendik-peminjaman-date-from') as HTMLInputElement | null)?.value ?? '';
    const dateTo = (document.getElementById('tendik-peminjaman-date-to') as HTMLInputElement | null)?.value ?? '';
    if (dateFrom && dateTo && dateTo < dateFrom) {
        filterError = 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.';
        renderMainState();
        return null;
    }
    filterError = null;
    return {
        ...(status ? { status } : {}),
        ...(roomType ? { roomType } : {}),
        ...(roomIdValue ? { roomId: Number(roomIdValue) } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page: 1,
        perPage: PER_PAGE,
    };
};

const fetchQueue = async (): Promise<void> => {
    const envelope = await getTendikBookings(filters);
    queue = envelope.data;
    pagination = envelope.meta;
    rememberRooms(queue);
    queueError = null;
    queueErrorStatus = null;
};

const loadQueue = async (showLoading = true): Promise<void> => {
    if (showLoading) {
        queueLoading = true;
        queueError = null;
        queueErrorStatus = null;
        renderMainState();
    }
    try {
        await fetchQueue();
    } catch (error) {
        queue = [];
        queueError = errorMessage(error, 'Antrean review peminjaman gagal dimuat.');
        queueErrorStatus = error instanceof PeminjamanApiError ? error.status : null;
    } finally {
        queueLoading = false;
        renderMainState();
    }
};

const refreshAfterAction = async (bookingId: number): Promise<void> => {
    const [queueResult, detailResult] = await Promise.allSettled([
        getTendikBookings(filters),
        getTendikBooking(bookingId),
    ]);
    if (queueResult.status === 'fulfilled') {
        queue = queueResult.value.data;
        pagination = queueResult.value.meta;
        rememberRooms(queue);
        queueError = null;
        queueErrorStatus = null;
    } else {
        queueError = errorMessage(queueResult.reason, 'Antrean terbaru gagal dimuat.');
        queueErrorStatus = queueResult.reason instanceof PeminjamanApiError
            ? queueResult.reason.status
            : null;
    }
    queueLoading = false;
    renderMainState();
    if (sarprasCalendarLoaded) void loadSarprasCalendar();
    if (detailResult.status === 'fulfilled') {
        renderDetailDrawer(detailResult.value, false, null);
    } else {
        renderDetailDrawer(
            null,
            false,
            errorMessage(detailResult.reason, 'Detail terbaru gagal dimuat.'),
        );
    }
};

const attachMainListeners = (): void => {
    document.getElementById('tendik-peminjaman-filters')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const nextFilters = readFilters();
        if (!nextFilters) return;
        filters = nextFilters;
        void loadQueue();
    });
    document.getElementById('reset-tendik-peminjaman-filters')?.addEventListener('click', () => {
        filters = { page: 1, perPage: PER_PAGE };
        filterError = null;
        void loadQueue();
    });
    document.getElementById('retry-tendik-peminjaman')?.addEventListener('click', () => {
        void loadQueue();
    });
    document.getElementById('tendik-peminjaman-prev')?.addEventListener('click', () => {
        filters = {
            ...filters,
            page: Math.max(1, pagination.current_page - 1),
        };
        void loadQueue();
    });
    document.getElementById('tendik-peminjaman-next')?.addEventListener('click', () => {
        filters = {
            ...filters,
            page: Math.min(pagination.last_page, pagination.current_page + 1),
        };
        void loadQueue();
    });
    document.querySelectorAll<HTMLElement>('[data-tendik-booking-detail]').forEach((button) => {
        button.addEventListener('click', () => {
            const bookingId = Number(button.dataset.tendikBookingDetail);
            if (Number.isInteger(bookingId) && bookingId > 0) void openDetail(bookingId);
        });
    });
};

export const renderPeminjamanRuanganTendik = async (role = 'tendik'): Promise<void> => {
    const sequence = ++renderSequence;
    reviewerProfile = null;
    queue = [];
    pagination = {
        current_page: 1,
        per_page: PER_PAGE,
        total: 0,
        last_page: 1,
    };
    filters = { page: 1, perPage: PER_PAGE };
    queueLoading = true;
    queueError = null;
    queueErrorStatus = null;
    filterError = null;
    knownRooms = new Map();
    actionDeniedBookingIds = new Set();
    activeTab = 'queue';
    sarprasCalendarState = createInitialSarprasCalendarState();
    sarprasCalendarItems = [];
    sarprasCalendarStatusCounts = {};
    sarprasCalendarUpcomingItemsState = [];
    sarprasCalendarRoomMap = new Map();
    sarprasCalendarLaboratoryMap = new Map();
    sarprasCalendarLoading = false;
    sarprasCalendarLoaded = false;
    sarprasCalendarError = null;
    sarprasCalendarUpcomingLoading = false;
    sarprasCalendarUpcomingError = null;
    sarprasCalendarRequestSequence = 0;
    managedRooms = [];
    managedRoomsLoaded = false;
    managedRoomsLoading = false;
    managedRoomsError = null;
    roomCoverCache.forEach((url) => URL.revokeObjectURL(url));
    roomCoverCache.clear();
    clearRoomSelection();
    document.getElementById('room-bulk-confirm-root')?.remove();
    closeSarprasCalendarDayDrawer();
    closeActionDialog();
    closeDrawer();
    closeRoomManagementDrawer();
    closeRoomFormModal();

    renderDashboardLayout(
        'Peminjaman Ruangan',
        pageShell(),
        role,
        'peminjaman',
    );
    renderMainState();

    const [profileResult, queueResult] = await Promise.allSettled([
        getTendikReviewerProfile(),
        getTendikBookings(filters),
    ]);
    if (sequence !== renderSequence) return;

    reviewerProfile = profileResult.status === 'fulfilled'
        ? profileResult.value
        : null;
    sarprasCalendarState = createInitialSarprasCalendarState(calendarRole());
    if (queueResult.status === 'fulfilled') {
        queue = queueResult.value.data;
        pagination = queueResult.value.meta;
        rememberRooms(queue);
    } else {
        queueError = errorMessage(queueResult.reason, 'Antrean review peminjaman gagal dimuat.');
        queueErrorStatus = queueResult.reason instanceof PeminjamanApiError
            ? queueResult.reason.status
            : null;
    }
    queueLoading = false;

    const pageTitle = document.querySelector('#tendik-peminjaman-page-state')?.previousElementSibling
        ?.querySelector('p');
    if (pageTitle) pageTitle.textContent = roleLabel(reviewerRole());
    renderMainState();
};
