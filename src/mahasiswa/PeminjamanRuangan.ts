import Toastify from 'toastify-js';
import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderMahasiswaDashboard } from '../dashboard/MahasiswaDashboard';
import {
    countApprovedByFilter,
    DENSITY_LEGEND,
    filterApprovedAvailability,
    formatDateKey,
    formatIndonesianDate,
    formatTimeRange,
    getDayAvailability,
    getDensityBucket,
    getDensityCellClass,
    getDensitySwatchClass,
    getMonthDateRange,
    getMonthLabel,
    getRoomTypeLabel,
    normalizeAvailabilityByDate,
    parseDateKey,
    type AvailabilityByDate,
    type PeminjamanFilter,
} from '../shared/peminjaman-calendar';
import {
    accentIconSurfaceClass,
    accentBadgeClass,
    accentStroke,
    buttonClass,
    galleryTabClass,
    SPINNER_CLASS,
    surfaceClass,
} from '../shared/design-system';
import {
    fetchRoomPhotoObjectUrl,
    getPeminjamanAvailability,
    getPeminjamanRooms,
} from './peminjaman/api';
import { closeBookingWorkflow } from './peminjaman/booking-form';
import { closePeminjamanDetail } from './peminjaman/detail';
import { navigateLazily } from './peminjaman/navigation';
import {
    closeRoomCatalogDetail,
    openRoomCatalogDetail,
} from './peminjaman/room-detail';
import { escapeHtml, roomSummaryPresentation } from './peminjaman/views';
import type {
    AvailabilityItem,
    Room,
    RoomType,
} from './peminjaman/types';

interface CalendarViewState {
    cursor: Date;
    filter: PeminjamanFilter;
    selectedDateKey: string | null;
}

const WEEKDAY_HEADERS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

let viewState: CalendarViewState = createInitialViewState();
let rooms: Room[] = [];
let availabilityByDate: AvailabilityByDate = new Map();
let pageRequestSequence = 0;
let dayDialogEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
// Cover thumbnails per media URL, cached for the page visit so filter/month
// re-renders reuse the same object URL instead of refetching or leaking.
const roomCoverUrlCache = new Map<string, string>();

const revokeRoomCoverCache = (): void => {
    roomCoverUrlCache.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    roomCoverUrlCache.clear();
};

function createInitialViewState(): CalendarViewState {
    const now = new Date();
    return {
        cursor: new Date(now.getFullYear(), now.getMonth(), 1),
        filter: 'all',
        selectedDateKey: null,
    };
}

const showToast = (text: string, success: boolean): void => {
    Toastify({
        text,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: { background: success ? '#0f766e' : '#b91c1c' },
    }).showToast();
};

const renderPageShell = (): string => `
    <div class="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <h2 class="text-3xl font-bold text-gray-800 tracking-tight">Peminjaman Ruangan</h2>
                <p class="text-gray-500 mt-2">Pilih jenis ruangan untuk mengajukan peminjaman. Status pengajuan dapat dipantau melalui Dashboard dan Riwayat Pengajuan.</p>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
                <button id="btn-back-dashboard-peminjaman" type="button" class="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition-all hover:border-teal-200 hover:bg-gray-50 hover:text-teal-600">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Kembali ke Dashboard
                </button>
                <button id="btn-my-peminjaman-list" type="button" class="flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-800">
                    Pengajuan Saya
                </button>
            </div>
        </div>
        <div id="peminjaman-page-state" aria-live="polite">
            ${renderLoadingState()}
        </div>
    </div>
`;

const renderLoadingState = (): string => `
    <div data-state="loading" class="${surfaceClass('card', 'px-6 py-16 text-center')}">
        <div class="mx-auto h-10 w-10 ${SPINNER_CLASS}" aria-hidden="true"></div>
        <p class="mt-4 text-sm font-bold text-gray-700">Memuat layanan peminjaman ruangan...</p>
    </div>
`;

const renderEmptyState = (): string => `
    <div data-state="empty" class="${surfaceClass('card', 'px-6 py-16 text-center')}">
        <h3 class="text-base font-bold text-gray-800">Belum ada data peminjaman</h3>
        <p class="mt-1 text-sm text-gray-500">Ruangan aktif dan jadwal peminjaman belum tersedia.</p>
    </div>
`;

const renderErrorState = (message: string): string => `
    <div data-state="error" class="${surfaceClass('card', 'px-6 py-14 text-center')}">
        <h3 class="text-base font-bold text-gray-800">Layanan peminjaman belum dapat dimuat</h3>
        <p class="mt-2 text-sm text-gray-500">${escapeHtml(message)}</p>
        <button id="btn-retry-peminjaman" type="button" class="${buttonClass('primary', 'md', 'mt-5')}">Coba Lagi</button>
    </div>
`;

const CATEGORY_ICON: Record<RoomType, string> = {
    classroom: '<rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="M3 20h18"></path><path d="M8 4v14"></path>',
    laboratory: '<path d="M9 3h6"></path><path d="M10 3v6.6L4.9 17.4A2 2 0 0 0 6.6 20.5h10.8a2 2 0 0 0 1.7-3.1L14 9.6V3"></path><path d="M7.5 15h9"></path>',
};

const CLOCK_ICON =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';

// Whole-card CTA, matching the Administrasi Surat doc-card interaction: the
// card itself is the clickable/booking entry point (no inner button).
const renderCategoryCard = (type: RoomType): string => {
    const isClassroom = type === 'classroom';
    const filteredRooms = rooms.filter((room) => room.type === type);
    const disabled = filteredRooms.length === 0;
    const accent = isClassroom ? 'teal' : 'indigo';
    const title = isClassroom ? 'Peminjaman Ruang Kelas' : 'Peminjaman Ruang Laboratorium';
    const description = isClassroom
        ? 'Ajukan ruang kelas untuk kegiatan akademik, rapat, atau organisasi.'
        : 'Ajukan laboratorium untuk praktikum, riset, atau kegiatan teknis.';
    const countLabel = `${filteredRooms.length} ${isClassroom ? 'ruang aktif' : 'lab aktif'}`;
    const durationLabel = isClassroom ? '1–2 Hari Kerja' : '2–3 Hari Kerja';
    const interactionAttrs = disabled
        ? 'aria-disabled="true"'
        : `role="button" tabindex="0" data-booking-cta="${type}" aria-label="Ajukan ${title}"`;
    const interactionClass = disabled
        ? 'opacity-60'
        : 'cursor-pointer hover:border-teal-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-50 focus:border-primary-teal';

    return `
        <section ${interactionAttrs} class="${surfaceClass('card', `doc-card group flex flex-col p-6 transition-all duration-200 ${interactionClass}`)}">
            <div class="flex items-start justify-between gap-4">
                <div class="${accentIconSurfaceClass(accent)}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${accentStroke(accent)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CATEGORY_ICON[type]}</svg>
                </div>
                <span class="shrink-0 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">${countLabel}</span>
            </div>
            <h3 class="mt-4 text-base font-bold text-gray-800">${title}</h3>
            <p class="mt-1 flex-1 text-sm text-gray-500">${description}</p>
            ${disabled
                ? '<p class="mt-5 text-sm font-semibold text-gray-400">Belum ada ruangan aktif untuk kategori ini.</p>'
                : `
                    <span class="${accentBadgeClass(accent, 'mt-5')}">
                        ${CLOCK_ICON}
                        ${durationLabel}
                    </span>
                `}
        </section>
    `;
};

const PHOTO_PLACEHOLDER_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>';

const renderRoomCard = (room: Room): string => {
    const summary = roomSummaryPresentation(room, 3);

    return `
        <article role="button" tabindex="0" data-room-select="${room.id}" aria-label="Lihat detail ruangan ${escapeHtml(room.code)} ${escapeHtml(room.name)}" class="cursor-pointer overflow-hidden rounded-xl border border-gray-100 bg-gray-50/60 transition-all hover:border-teal-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-50 focus:border-primary-teal">
            <div class="relative h-28 w-full bg-gray-100" data-room-cover${summary.coverUrl ? ` data-cover-url="${escapeHtml(summary.coverUrl)}" data-cover-alt="Foto ${escapeHtml(room.code)} ${escapeHtml(room.name)}"` : ''}>
                <div data-cover-placeholder class="flex h-full items-center justify-center text-gray-300">${PHOTO_PLACEHOLDER_ICON}</div>
                <span class="absolute right-2 top-2 rounded-full border border-gray-200 bg-white/95 px-2 py-0.5 text-[10px] font-bold text-gray-600 shadow-sm">${getRoomTypeLabel(room.type)}</span>
            </div>
            <div class="p-4">
                <p class="min-w-0 break-words text-sm font-bold text-gray-800">${escapeHtml(room.code)} · ${escapeHtml(room.name)}</p>
                <p class="mt-1 truncate text-xs text-gray-500">${escapeHtml(room.location)}</p>
                <p class="mt-1.5 text-xs font-semibold text-gray-600">Kapasitas ${room.capacity} orang</p>
                <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
                    ${summary.facilities.map((item) => `<span class="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600">${escapeHtml(item)}</span>`).join('')}
                    ${summary.remainingFacilityCount > 0 ? `<span class="text-[10px] font-semibold text-gray-400">+${summary.remainingFacilityCount} lainnya</span>` : ''}
                    ${summary.facilityCount === 0 ? '<span class="text-[10px] text-gray-400">Fasilitas belum dicatat</span>' : ''}
                </div>
                ${summary.hasActiveTemplate ? `
                    <p class="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-teal-700">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Template tersedia
                    </p>
                ` : ''}
            </div>
        </article>
    `;
};

const renderRoomBrowser = (): string => {
    if (rooms.length === 0) {
        return `
            <section class="${surfaceClass('card', 'p-6')}">
                <h3 class="text-base font-bold text-gray-800">Daftar Ruangan Aktif</h3>
                <p class="mt-5 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Belum ada ruangan aktif.</p>
            </section>
        `;
    }

    return `
        <section class="${surfaceClass('card', 'p-6')}">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="text-base font-bold text-gray-800">Daftar Ruangan Aktif</h3>
                    <p class="mt-1 text-xs text-gray-500">Klik ruangan untuk melihat foto, fasilitas, dan template sebelum mengajukan.</p>
                </div>
                <span class="shrink-0 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">${rooms.length} ruang</span>
            </div>
            <div class="mt-5 grid max-h-[560px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                ${rooms.map((room) => renderRoomCard(room)).join('')}
            </div>
        </section>
    `;
};

/**
 * Async cover hydration: cards render instantly with a neutral placeholder,
 * then authenticated thumbnails stream in (cached per page visit). Failures
 * simply keep the placeholder — never an error card for a photo.
 */
const hydrateRoomCovers = (): void => {
    document.querySelectorAll<HTMLElement>('[data-room-cover][data-cover-url]').forEach((container) => {
        const mediaUrl = container.dataset.coverUrl;
        if (!mediaUrl) return;

        const applyImage = (objectUrl: string): void => {
            if (!container.isConnected) return;
            const image = document.createElement('img');
            image.src = objectUrl;
            image.alt = container.dataset.coverAlt ?? 'Foto ruangan';
            image.className = 'h-full w-full object-cover';
            container.querySelector('[data-cover-placeholder]')?.replaceWith(image);
        };

        const cached = roomCoverUrlCache.get(mediaUrl);
        if (cached) {
            applyImage(cached);
            return;
        }

        void fetchRoomPhotoObjectUrl(mediaUrl)
            .then((objectUrl) => {
                roomCoverUrlCache.set(mediaUrl, objectUrl);
                applyImage(objectUrl);
            })
            .catch(() => {
                // Placeholder stays — photos are progressive enhancement.
            });
    });
};

const buildCalendarGrid = (): string => {
    const year = viewState.cursor.getFullYear();
    const month = viewState.cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
    const todayKey = formatDateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
        const cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + index);
        const dateKey = formatDateKey(cellDate);
        const inMonth = cellDate.getMonth() === month;
        const count = countApprovedByFilter(
            availabilityByDate.get(dateKey) ?? [],
            viewState.filter,
        );
        const selectedClass = dateKey === viewState.selectedDateKey
            ? 'ring-2 ring-teal-700 ring-offset-1'
            : dateKey === todayKey
                ? 'ring-1 ring-teal-500'
                : '';

        if (!inMonth) {
            return `<button type="button" disabled class="relative flex h-11 items-center justify-center rounded-lg bg-transparent text-sm font-semibold text-gray-300" aria-label="${escapeHtml(formatIndonesianDate(cellDate))}, di luar bulan aktif">${cellDate.getDate()}</button>`;
        }

        return `
            <button type="button" data-date="${dateKey}" aria-label="${escapeHtml(formatIndonesianDate(cellDate))}, ${count} jadwal disetujui" class="relative flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition-all ${getDensityCellClass(getDensityBucket(count))} ${selectedClass}">
                ${cellDate.getDate()}
                ${count > 0 ? `<span class="absolute right-0.5 top-0.5 h-4 min-w-4 rounded-full bg-white/90 px-1 text-[9px] leading-4 text-teal-800 shadow-sm">${count}</span>` : ''}
            </button>
        `;
    }).join('');
};

const renderFilterButton = (filter: PeminjamanFilter, label: string): string => `
    <button type="button" data-calendar-filter="${filter}" aria-pressed="${viewState.filter === filter}" class="${galleryTabClass(viewState.filter === filter)}">${label}</button>
`;

const renderDensityLegend = (): string => `
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-600">
        <span class="font-bold uppercase tracking-wider text-gray-500">Kepadatan</span>
        ${DENSITY_LEGEND.map(({ bucket, label }) => `
            <span class="inline-flex items-center gap-1.5">
                <span class="h-3 w-3 rounded ${getDensitySwatchClass(bucket)}" aria-hidden="true"></span>
                ${label}
            </span>
        `).join('')}
    </div>
`;

const monthApprovedCount = (): number =>
    Array.from(availabilityByDate.values())
        .reduce((sum, items) => sum + countApprovedByFilter(items, viewState.filter), 0);

const busiestApprovedDay = (): { dateKey: string; count: number } | null => {
    let best: { dateKey: string; count: number } | null = null;
    availabilityByDate.forEach((items, dateKey) => {
        const count = countApprovedByFilter(items, viewState.filter);
        if (count > 0 && (best === null || count > best.count)) {
            best = { dateKey, count };
        }
    });
    return best;
};

const upcomingApproved = (): AvailabilityItem[] =>
    Array.from(availabilityByDate.values())
        .flatMap((items) => filterApprovedAvailability(items, viewState.filter))
        .filter((item) => new Date(item.start_at).getTime() >= Date.now())
        .sort((left, right) =>
            new Date(left.start_at).getTime() - new Date(right.start_at).getTime())
        .slice(0, 5);

const renderSummaryStrip = (): string => {
    const classroomCount = rooms.filter((room) => room.type === 'classroom').length;
    const labCount = rooms.filter((room) => room.type === 'laboratory').length;
    const approved = monthApprovedCount();
    const busiest = busiestApprovedDay();
    const filterLabel = viewState.filter === 'all' ? 'Semua' : getRoomTypeLabel(viewState.filter);

    const stat = (label: string, value: string, sub: string): string => `
        <div class="${surfaceClass('section', 'px-4 py-3.5')}">
            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">${label}</p>
            <p class="mt-1 text-xl font-bold text-gray-800">${escapeHtml(value)}</p>
            <p class="mt-0.5 text-[11px] text-gray-500">${escapeHtml(sub)}</p>
        </div>
    `;

    return `
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            ${stat('Ruangan Aktif', String(rooms.length), `${classroomCount} kelas · ${labCount} lab`)}
            ${stat('Disetujui Bulan Ini', String(approved), getMonthLabel(viewState.cursor))}
            ${stat(
                'Hari Tersibuk',
                busiest ? `${busiest.count} jadwal` : 'Belum ada',
                busiest
                    ? formatIndonesianDate(parseDateKey(busiest.dateKey))
                    : 'Belum ada jadwal disetujui',
            )}
            ${stat('Filter Aktif', filterLabel, 'Semua · Kelas · Lab')}
        </div>
    `;
};

const renderUpcomingPanel = (): string => {
    const upcoming = upcomingApproved();

    return `
        <div class="${surfaceClass('section', 'p-5')}">
            <h4 class="text-sm font-bold text-gray-800">Jadwal Disetujui Terdekat</h4>
            <p class="mt-1 text-xs text-gray-500">Mengikuti filter jenis ruangan aktif.</p>
            ${upcoming.length > 0 ? `
                <ul class="mt-4 space-y-3">
                    ${upcoming.map((item) => `
                        <li class="rounded-xl border border-gray-100 p-3">
                            <p class="break-words text-sm font-bold text-gray-800">${escapeHtml(item.room.code)} · ${escapeHtml(item.room.name)}</p>
                            <p class="mt-1 text-xs text-gray-500">${escapeHtml(formatIndonesianDate(new Date(item.start_at)))}</p>
                            <p class="text-xs text-gray-500">${escapeHtml(formatTimeRange(item.start_at, item.end_at))}</p>
                        </li>
                    `).join('')}
                </ul>
            ` : '<p class="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Belum ada jadwal disetujui yang akan datang untuk filter ini.</p>'}
        </div>
    `;
};

const renderCalendar = (loading: boolean): string => {
    const visibleApproved = Array.from(availabilityByDate.values())
        .flatMap((items) => filterApprovedAvailability(items, viewState.filter));

    return `
        <section class="${surfaceClass('card', 'overflow-hidden')}">
            <div class="flex flex-col gap-4 border-b border-gray-100 px-6 pb-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h3 class="text-base font-bold text-gray-800">Kalender Peminjaman Disetujui</h3>
                    <p class="mt-1 text-xs text-gray-500">Klik tanggal untuk melihat jadwal publik atau memulai pengajuan dengan tanggal tersebut.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filter jenis ruangan">
                    ${renderFilterButton('all', 'Semua')}
                    ${renderFilterButton('classroom', 'Kelas')}
                    ${renderFilterButton('laboratory', 'Lab')}
                </div>
            </div>
            <div class="flex flex-col gap-3 border-b border-gray-100 px-4 py-3.5 md:px-6 lg:flex-row lg:items-center lg:justify-between">
                ${renderDensityLegend()}
                <div class="flex items-center gap-1 md:gap-2">
                    <button id="btn-prev-month" type="button" class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100" aria-label="Bulan sebelumnya">‹</button>
                    <div class="min-w-[128px] text-center text-sm font-bold text-gray-800 md:min-w-[150px]">${getMonthLabel(viewState.cursor)}</div>
                    <button id="btn-next-month" type="button" class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100" aria-label="Bulan berikutnya">›</button>
                    <button id="btn-today" type="button" class="${buttonClass('outline', 'sm', 'ml-1')}">Hari Ini</button>
                </div>
            </div>
            ${loading ? '<div data-calendar-state="loading" class="bg-teal-50 px-6 py-3 text-xs font-semibold text-teal-700">Memuat kalender bulan ini...</div>' : ''}
            <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div class="overflow-x-auto border-b border-gray-100 lg:border-b-0 lg:border-r">
                    <div class="min-w-[420px] px-4 py-4 md:px-6">
                        <div class="grid grid-cols-7 gap-1.5">
                            ${WEEKDAY_HEADERS.map((day) => `<div class="text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">${day}</div>`).join('')}
                        </div>
                        <div id="peminjaman-calendar-grid" class="mt-2 grid grid-cols-7 gap-1.5">${buildCalendarGrid()}</div>
                        ${!loading && visibleApproved.length === 0 ? '<div data-calendar-state="empty" class="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm font-semibold text-gray-700">Belum ada jadwal disetujui untuk bulan dan filter ini.</div>' : ''}
                    </div>
                </div>
                <div class="p-4 md:p-5">
                    ${renderUpcomingPanel()}
                </div>
            </div>
        </section>
    `;
};

const renderSuccessState = (calendarLoading = false): void => {
    const root = document.getElementById('peminjaman-page-state');
    if (!root) return;

    root.innerHTML = `
        <div data-state="success" class="space-y-8">
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                ${renderCategoryCard('classroom')}
                ${renderCategoryCard('laboratory')}
            </div>
            ${renderSummaryStrip()}
            ${renderCalendar(calendarLoading)}
            ${renderRoomBrowser()}
        </div>
    `;
    attachSuccessListeners();
    hydrateRoomCovers();
};

const setPageState = (html: string): void => {
    const root = document.getElementById('peminjaman-page-state');
    if (root) root.innerHTML = html;
};

const closeDayDialog = (refreshGrid = false): void => {
    document.getElementById('peminjaman-day-dialog-root')?.remove();
    if (dayDialogEscapeHandler) {
        document.removeEventListener('keydown', dayDialogEscapeHandler);
        dayDialogEscapeHandler = null;
    }
    if (refreshGrid) {
        viewState.selectedDateKey = null;
        const grid = document.getElementById('peminjaman-calendar-grid');
        if (grid) grid.innerHTML = buildCalendarGrid();
    }
};

// Single booking entry point for every landing trigger (category card,
// calendar day, room browser). C7C1: creation moved from the old modal to a
// dedicated three-section application page; navigation stays lazy (dynamic
// import) per the app's page-to-page convention to avoid import cycles.
const startBooking = (options: {
    date?: string;
    preferredType?: RoomType;
    roomId?: number;
} = {}): void => {
    closeDayDialog();
    closePeminjamanDetail();
    closeRoomCatalogDetail();
    revokeRoomCoverCache();
    void navigateLazily(
        () => import('./peminjaman/application-page')
            .then(({ renderPeminjamanApplicationPage }) => renderPeminjamanApplicationPage({
                date: options.date,
                preferredType: options.preferredType,
                roomId: options.roomId,
            })),
        'Ajukan Peminjaman',
    );
};

const openMyBookingsList = (): void => {
    closeDayDialog();
    closePeminjamanDetail();
    closeRoomCatalogDetail();
    revokeRoomCoverCache();
    void navigateLazily(
        () => import('./peminjaman/list-page')
            .then(({ renderPeminjamanListPage }) => renderPeminjamanListPage()),
        'Pengajuan Saya',
    );
};

const renderDayItem = (item: AvailabilityItem): string => `
    <li class="rounded-xl border border-gray-100 p-3">
        <p class="break-words text-sm font-bold text-gray-800">${escapeHtml(item.room.code)} · ${escapeHtml(item.room.name)}</p>
        <p class="mt-1 text-xs text-gray-500">${escapeHtml(formatTimeRange(item.start_at, item.end_at))}</p>
        <span class="mt-2 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Disetujui</span>
    </li>
`;

const openDayDialog = (dateKey: string): void => {
    closeDayDialog();
    const items = getDayAvailability(availabilityByDate, dateKey, viewState.filter);
    const root = document.createElement('div');
    root.id = 'peminjaman-day-dialog-root';
    root.innerHTML = `
        <div data-dialog-overlay class="fixed inset-0 z-[200] bg-black/40"></div>
        <aside role="dialog" aria-modal="true" aria-labelledby="peminjaman-day-dialog-title" class="fixed inset-y-0 right-0 z-[201] flex h-full w-full max-w-[430px] flex-col bg-white shadow-2xl">
            <header class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-6">
                <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Jadwal Disetujui</p>
                    <h2 id="peminjaman-day-dialog-title" class="mt-1 text-base font-bold text-gray-900">${escapeHtml(formatIndonesianDate(parseDateKey(dateKey)))}</h2>
                    <p class="mt-1 text-xs text-gray-500">${items.length} jadwal sesuai filter</p>
                </div>
                <button id="close-peminjaman-day-dialog" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Tutup detail tanggal">×</button>
            </header>
            <div class="flex-1 overflow-y-auto px-6 py-5">
                ${items.length > 0 ? `<ul class="space-y-3">${items.map(renderDayItem).join('')}</ul>` : '<p class="py-12 text-center text-sm font-semibold text-gray-700">Belum ada jadwal disetujui pada tanggal ini.</p>'}
            </div>
            <footer class="border-t border-gray-100 px-6 py-5">
                <button id="create-from-calendar-day" type="button" class="${buttonClass('primary', 'sm', 'w-full')}">Ajukan untuk Tanggal Ini</button>
            </footer>
        </aside>
    `;
    document.body.appendChild(root);

    const close = (): void => closeDayDialog(true);
    root.querySelector('[data-dialog-overlay]')?.addEventListener('click', close);
    root.querySelector('#close-peminjaman-day-dialog')?.addEventListener('click', close);
    root.querySelector('#create-from-calendar-day')?.addEventListener('click', () => {
        const preferredType = viewState.filter === 'all' ? undefined : viewState.filter;
        closeDayDialog(true);
        startBooking({ date: dateKey, preferredType });
    });
    dayDialogEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', dayDialogEscapeHandler);
    root.querySelector<HTMLButtonElement>('#close-peminjaman-day-dialog')?.focus();
};

const loadCalendarForCurrentMonth = async (): Promise<void> => {
    const sequence = pageRequestSequence;
    viewState.selectedDateKey = null;
    closeDayDialog();
    renderSuccessState(true);
    try {
        const availability = await getPeminjamanAvailability(
            getMonthDateRange(viewState.cursor),
        );
        if (sequence !== pageRequestSequence) return;
        availabilityByDate = normalizeAvailabilityByDate(availability);
        renderSuccessState();
    } catch (error) {
        if (sequence !== pageRequestSequence) return;
        showToast(
            error instanceof Error ? error.message : 'Kalender gagal dimuat.',
            false,
        );
        renderSuccessState();
    }
};

const attachSuccessListeners = (): void => {
    const activateBookingTrigger = (element: HTMLElement): void => {
        const cta = element.dataset.bookingCta as RoomType | undefined;
        if (cta) {
            startBooking({ preferredType: cta });
            return;
        }
        // Room cards open the detail drawer first (photos, facilities,
        // template); booking starts from the drawer's CTA.
        const roomId = Number(element.dataset.roomSelect);
        if (Number.isInteger(roomId)) {
            void openRoomCatalogDetail(roomId, {
                onApply: (selectedRoomId) => startBooking({ roomId: selectedRoomId }),
            });
        }
    };
    document.querySelectorAll<HTMLElement>('[data-booking-cta], [data-room-select]').forEach((element) => {
        element.addEventListener('click', () => activateBookingTrigger(element));
        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activateBookingTrigger(element);
            }
        });
    });
    document.querySelectorAll<HTMLElement>('[data-calendar-filter]').forEach((button) => {
        button.addEventListener('click', () => {
            const filter = button.dataset.calendarFilter as PeminjamanFilter | undefined;
            if (!filter) return;
            viewState.filter = filter;
            viewState.selectedDateKey = null;
            closeDayDialog();
            renderSuccessState();
        });
    });
    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
        viewState.cursor = new Date(viewState.cursor.getFullYear(), viewState.cursor.getMonth() - 1, 1);
        void loadCalendarForCurrentMonth();
    });
    document.getElementById('btn-next-month')?.addEventListener('click', () => {
        viewState.cursor = new Date(viewState.cursor.getFullYear(), viewState.cursor.getMonth() + 1, 1);
        void loadCalendarForCurrentMonth();
    });
    document.getElementById('btn-today')?.addEventListener('click', () => {
        const now = new Date();
        viewState.cursor = new Date(now.getFullYear(), now.getMonth(), 1);
        void loadCalendarForCurrentMonth();
    });
    document.getElementById('peminjaman-calendar-grid')?.addEventListener('click', (event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-date]');
        const dateKey = target?.dataset.date;
        if (!dateKey) return;
        viewState.selectedDateKey = dateKey;
        const grid = document.getElementById('peminjaman-calendar-grid');
        if (grid) grid.innerHTML = buildCalendarGrid();
        openDayDialog(dateKey);
    });
};

const attachRetryListener = (): void => {
    document.getElementById('btn-retry-peminjaman')?.addEventListener('click', () => {
        void renderPeminjamanRuangan();
    });
};

export const renderPeminjamanRuangan = async (): Promise<void> => {
    const sequence = ++pageRequestSequence;
    viewState = createInitialViewState();
    rooms = [];
    availabilityByDate = new Map();
    closeDayDialog();
    closeBookingWorkflow();
    closePeminjamanDetail();
    closeRoomCatalogDetail();
    revokeRoomCoverCache();

    renderDashboardLayout(
        'Peminjaman Ruangan',
        renderPageShell(),
        'mahasiswa',
        'peminjaman',
    );
    document.getElementById('btn-back-dashboard-peminjaman')?.addEventListener('click', () => {
        closeDayDialog();
        closeBookingWorkflow();
        closePeminjamanDetail();
        closeRoomCatalogDetail();
        revokeRoomCoverCache();
        renderMahasiswaDashboard();
    });
    document.getElementById('btn-my-peminjaman-list')?.addEventListener('click', () => {
        openMyBookingsList();
    });

    try {
        const [activeRooms, availability] = await Promise.all([
            getPeminjamanRooms(),
            getPeminjamanAvailability(getMonthDateRange(viewState.cursor)),
        ]);
        if (sequence !== pageRequestSequence) return;
        rooms = activeRooms.filter((room) => room.is_active);
        availabilityByDate = normalizeAvailabilityByDate(availability);

        if (rooms.length === 0 && availability.length === 0) {
            setPageState(renderEmptyState());
            return;
        }
        renderSuccessState();
    } catch (error) {
        if (sequence !== pageRequestSequence) return;
        setPageState(renderErrorState(
            error instanceof Error
                ? error.message
                : 'Gagal memuat data peminjaman ruangan.',
        ));
        attachRetryListener();
    }
};
