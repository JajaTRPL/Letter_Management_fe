import Toastify from 'toastify-js';
import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import {
    downloadSuratPeminjamanPdf,
    getSuperAdminBooking,
    getSuperAdminBookings,
    getSuperAdminLaboratories,
    PeminjamanApiError,
} from '../mahasiswa/peminjaman/api';
import { renderSuratPeminjamanPanel } from '../mahasiswa/peminjaman/views';
import {
    closeSuratPreview,
    openSuratPreview,
} from '../mahasiswa/peminjaman/detail';
import type {
    BookingStatus,
    LaboratorySummary,
    PaginationMeta,
    RoomType,
    SuperAdminBooking,
    SuperAdminBookingFilters,
} from '../mahasiswa/peminjaman/types';
import {
    formatTimeRange,
    getBookingStatusLabel,
    getBookingStatusTone,
    getRoomTypeLabel,
} from '../shared/peminjaman-calendar';
import {
    listManagedRooms,
    type RoomListFilters,
} from '../shared/room-management/api';
import {
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
import { renderFacilityMaster } from '../shared/room-management/facility-master';
import type { ManagedRoom } from '../shared/room-management/types';

type ActiveTab = 'rooms' | 'facilities' | 'monitoring';

const PER_PAGE = 10;
const EMPTY_META: PaginationMeta = {
    current_page: 1,
    per_page: PER_PAGE,
    total: 0,
    last_page: 1,
};

let renderSequence = 0;
let activeTab: ActiveTab = 'rooms';
let laboratories: LaboratorySummary[] = [];
let laboratoriesError: string | null = null;
let roomCatalog: ManagedRoom[] = [];
let rooms: ManagedRoom[] = [];
let roomFilters: RoomListFilters = {};
let roomsLoading = true;
let roomsError: string | null = null;
// Cover thumbnails, cached for the page visit and revoked on teardown.
const roomCoverCache = new Map<string, string>();
let bookings: SuperAdminBooking[] = [];
let bookingFilters: SuperAdminBookingFilters = { page: 1, perPage: PER_PAGE };
let bookingMeta: PaginationMeta = { ...EMPTY_META };
let bookingsLoading = true;
let bookingsError: string | null = null;
let bookingFilterError: string | null = null;
let modalEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
let drawerEscapeHandler: ((event: KeyboardEvent) => void) | null = null;

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

const formatDateTime = (iso?: string | null): string => {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })} WIB`;
};

const errorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof PeminjamanApiError)) {
        return error instanceof Error ? error.message : fallback;
    }
    if (error.status === 403) {
        return 'Anda tidak memiliki akses ke pengelolaan Peminjaman Ruangan.';
    }
    if (error.status === 404) {
        return 'Data yang diminta tidak ditemukan.';
    }
    if (error.status === 409 && error.code === 'booking_conflict') {
        return 'Ruangan tidak dapat dinonaktifkan karena memiliki peminjaman disetujui yang akan datang.';
    }
    return error.message || fallback;
};

const isRoomFilterActive = (): boolean =>
    roomFilters.type !== undefined
    || roomFilters.laboratoryId !== undefined
    || roomFilters.active !== undefined
    || Boolean(roomFilters.search?.trim());

const selected = (actual: unknown, expected: unknown): string =>
    actual === expected ? 'selected' : '';

const pageContent = (): string => `
    <div class="mx-auto max-w-7xl space-y-6 pb-12">
        <section class="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Master & Monitoring</p>
                    <h2 class="mt-1 text-2xl font-bold text-gray-900">Peminjaman Ruangan</h2>
                    <p class="mt-2 max-w-3xl text-sm text-gray-500">Kelola data master ruangan dan pantau seluruh pengajuan. Persetujuan tetap dilakukan oleh reviewer Tendik sesuai lingkupnya.</p>
                </div>
                <div class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800">
                    Super Admin bersifat monitoring dan tidak menyetujui pengajuan.
                </div>
            </div>
            <div class="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Bagian Peminjaman Ruangan">
                <button id="admin-peminjaman-tab-rooms" type="button" role="tab" aria-selected="${activeTab === 'rooms'}" class="rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === 'rooms' ? 'bg-teal-700 text-white' : 'border border-gray-200 bg-white text-gray-600'}">Master Ruangan</button>
                <button id="admin-peminjaman-tab-facilities" type="button" role="tab" aria-selected="${activeTab === 'facilities'}" class="rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === 'facilities' ? 'bg-teal-700 text-white' : 'border border-gray-200 bg-white text-gray-600'}">Master Fasilitas</button>
                <button id="admin-peminjaman-tab-monitoring" type="button" role="tab" aria-selected="${activeTab === 'monitoring'}" class="rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === 'monitoring' ? 'bg-teal-700 text-white' : 'border border-gray-200 bg-white text-gray-600'}">Monitoring Pengajuan</button>
            </div>
        </section>
        <div id="admin-peminjaman-tab-content">
            ${activeTab === 'rooms'
                ? renderRoomManagement()
                : activeTab === 'facilities'
                    ? '<div id="admin-facility-master-root"></div>'
                    : renderMonitoring()}
        </div>
    </div>
`;

const renderRoomManagement = (): string => `
    <div class="space-y-5">
        ${laboratoriesError ? `
            <div role="alert" class="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
                <span>${escapeHtml(laboratoriesError)}</span>
                <button id="admin-peminjaman-retry-laboratories" type="button" class="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">Muat Ulang Laboratorium</button>
            </div>
        ` : ''}
        ${renderRoomFilters()}
        <section class="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm" aria-live="polite">
            <div class="flex flex-col gap-3 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 class="text-base font-bold text-gray-800">Daftar Ruangan</h3>
                    <p class="mt-1 text-xs text-gray-500">Status aktif dikelola terpisah. Ruangan tidak dihapus dari sistem.</p>
                </div>
                <button id="admin-peminjaman-add-room" type="button" class="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Tambah Ruangan</button>
            </div>
            ${renderRoomState()}
        </section>
    </div>
`;

const renderRoomFilters = (): string => `
    <form id="admin-peminjaman-room-filters" class="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label class="text-xs font-bold text-gray-600">
                Pencarian
                <input id="admin-peminjaman-room-search" type="search" maxlength="100" value="${escapeHtml(roomFilters.search ?? '')}" placeholder="Kode, nama, atau lokasi" class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700">
            </label>
            <label class="text-xs font-bold text-gray-600">
                Jenis Ruangan
                <select id="admin-peminjaman-room-type" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                    <option value="">Semua jenis</option>
                    <option value="classroom" ${selected(roomFilters.type, 'classroom')}>Ruang Kelas</option>
                    <option value="laboratory" ${selected(roomFilters.type, 'laboratory')}>Laboratorium</option>
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                Status
                <select id="admin-peminjaman-room-active" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                    <option value="">Semua status</option>
                    <option value="true" ${selected(roomFilters.active, true)}>Aktif</option>
                    <option value="false" ${selected(roomFilters.active, false)}>Nonaktif</option>
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                Laboratorium Pemilik
                <select id="admin-peminjaman-room-laboratory" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                    <option value="">Semua laboratorium</option>
                    ${laboratories.map((lab) => `
                        <option value="${lab.id}" ${selected(roomFilters.laboratoryId, lab.id)}>${escapeHtml(lab.code)} · ${escapeHtml(lab.name)}</option>
                    `).join('')}
                </select>
            </label>
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-3">
            <button id="admin-peminjaman-reset-room-filters" type="button" class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Reset</button>
            <button type="submit" class="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Terapkan Filter</button>
        </div>
    </form>
`;

const renderRoomState = (): string => {
    if (roomsLoading) {
        return `
            <div data-admin-room-state="loading" class="px-6 py-16 text-center">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat data ruangan...</p>
            </div>
        `;
    }
    if (roomsError) {
        return `
            <div data-admin-room-state="error" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Data ruangan gagal dimuat</h3>
                <p class="mt-2 text-sm text-gray-500">${escapeHtml(roomsError)}</p>
                <button id="admin-peminjaman-retry-rooms" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">Coba Lagi</button>
            </div>
        `;
    }
    if (rooms.length === 0) {
        return `
            <div data-admin-room-state="empty" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Belum ada ruangan</h3>
                <p class="mt-2 text-sm text-gray-500">Belum ada data yang sesuai dengan filter aktif.</p>
            </div>
        `;
    }
    return `<div data-admin-room-state="success">${renderRoomManagementTable(rooms)}</div>`;
};

const renderMonitoring = (): string => `
    <div class="space-y-5">
        ${renderBookingFilters()}
        <section class="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm" aria-live="polite">
            <div class="border-b border-gray-100 px-5 py-5">
                <h3 class="text-base font-bold text-gray-800">Seluruh Pengajuan Peminjaman</h3>
                <p class="mt-1 text-xs text-gray-500">Tampilan monitoring saja; tidak tersedia tindakan persetujuan, revisi, atau penolakan.</p>
            </div>
            ${renderBookingState()}
        </section>
    </div>
`;

const renderBookingFilters = (): string => `
    <form id="admin-peminjaman-booking-filters" class="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label class="text-xs font-bold text-gray-600">
                Status
                <select id="admin-peminjaman-booking-status" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                    <option value="">Semua status</option>
                    ${(['submitted', 'revision_requested', 'approved', 'rejected', 'cancelled'] as BookingStatus[]).map((status) => `
                        <option value="${status}" ${selected(bookingFilters.status, status)}>${escapeHtml(getBookingStatusLabel(status))}</option>
                    `).join('')}
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                Jenis Ruangan
                <select id="admin-peminjaman-booking-room-type" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                    <option value="">Semua jenis</option>
                    <option value="classroom" ${selected(bookingFilters.roomType, 'classroom')}>Ruang Kelas</option>
                    <option value="laboratory" ${selected(bookingFilters.roomType, 'laboratory')}>Laboratorium</option>
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                Ruangan
                <select id="admin-peminjaman-booking-room-id" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                    <option value="">Semua ruangan</option>
                    ${roomCatalog.map((room) => `
                        <option value="${room.id}" ${selected(bookingFilters.roomId, room.id)}>${escapeHtml(room.code)} · ${escapeHtml(room.name)}</option>
                    `).join('')}
                </select>
            </label>
            <label class="text-xs font-bold text-gray-600">
                Dari Tanggal
                <input id="admin-peminjaman-booking-date-from" type="date" value="${escapeHtml(bookingFilters.dateFrom ?? '')}" class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700">
            </label>
            <label class="text-xs font-bold text-gray-600">
                Sampai Tanggal
                <input id="admin-peminjaman-booking-date-to" type="date" value="${escapeHtml(bookingFilters.dateTo ?? '')}" class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700">
            </label>
        </div>
        ${bookingFilterError ? `<p role="alert" class="mt-3 text-sm font-semibold text-red-700">${escapeHtml(bookingFilterError)}</p>` : ''}
        <div class="mt-4 flex flex-wrap justify-end gap-3">
            <button id="admin-peminjaman-reset-booking-filters" type="button" class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Reset</button>
            <button type="submit" class="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800">Terapkan Filter</button>
        </div>
    </form>
`;

const renderBookingState = (): string => {
    if (bookingsLoading) {
        return `
            <div data-admin-booking-state="loading" class="px-6 py-16 text-center">
                <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                <p class="mt-4 text-sm font-bold text-gray-700">Memuat monitoring pengajuan...</p>
            </div>
        `;
    }
    if (bookingsError) {
        return `
            <div data-admin-booking-state="error" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Monitoring gagal dimuat</h3>
                <p class="mt-2 text-sm text-gray-500">${escapeHtml(bookingsError)}</p>
                <button id="admin-peminjaman-retry-bookings" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">Coba Lagi</button>
            </div>
        `;
    }
    if (bookings.length === 0) {
        return `
            <div data-admin-booking-state="empty" class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">Belum ada pengajuan</h3>
                <p class="mt-2 text-sm text-gray-500">Tidak ada pengajuan yang sesuai dengan filter aktif.</p>
            </div>
        `;
    }
    return `
        <div data-admin-booking-state="success" class="overflow-x-auto">
            <table class="min-w-[960px] w-full text-left">
                <thead class="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <tr>
                        <th class="px-5 py-4">Kegiatan / Pemohon</th>
                        <th class="px-5 py-4">Ruangan</th>
                        <th class="px-5 py-4">Jadwal</th>
                        <th class="px-5 py-4">Status</th>
                        <th class="px-5 py-4"></th>
                    </tr>
                </thead>
                <tbody>
                    ${bookings.map((booking) => `
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
                                <button type="button" data-admin-booking-detail="${booking.id}" class="rounded-xl border border-teal-700 px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50">Detail</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${renderBookingPagination()}
    `;
};

const renderBookingPagination = (): string => {
    if (bookingMeta.last_page <= 1) return '';
    return `
        <div class="flex items-center justify-between gap-4 border-t border-gray-100 px-5 py-4">
            <p class="text-xs font-medium text-gray-500">Halaman ${bookingMeta.current_page} dari ${bookingMeta.last_page} · ${bookingMeta.total} pengajuan</p>
            <div class="flex gap-2">
                <button id="admin-peminjaman-booking-prev" type="button" ${bookingMeta.current_page <= 1 ? 'disabled' : ''} class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 disabled:opacity-40">Sebelumnya</button>
                <button id="admin-peminjaman-booking-next" type="button" ${bookingMeta.current_page >= bookingMeta.last_page ? 'disabled' : ''} class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 disabled:opacity-40">Berikutnya</button>
            </div>
        </div>
    `;
};

const renderPage = (): void => {
    renderDashboardLayout(
        'Peminjaman Ruangan',
        pageContent(),
        'super_admin',
        'peminjaman-admin',
    );
    attachPageListeners();
};

const attachPageListeners = (): void => {
    document.getElementById('admin-peminjaman-tab-rooms')?.addEventListener('click', () => {
        activeTab = 'rooms';
        renderPage();
    });
    document.getElementById('admin-peminjaman-tab-facilities')?.addEventListener('click', () => {
        activeTab = 'facilities';
        renderPage();
    });
    document.getElementById('admin-peminjaman-tab-monitoring')?.addEventListener('click', () => {
        activeTab = 'monitoring';
        renderPage();
    });
    attachRoomListeners();
    attachBookingListeners();

    const facilityHost = document.getElementById('admin-facility-master-root');
    if (facilityHost) void renderFacilityMaster(facilityHost, { onOpenRoom: openRoomFromFacilityUsage });
};

/**
 * Jump from the Master Fasilitas usage drawer straight to a room's Kelola
 * Ruangan drawer: switch to the Master Ruangan tab and open the drawer on the
 * Fasilitas tab (the context the user came from). The drawer loads the room by
 * id, so it works even when the room is filtered out of the current list, and
 * surfaces its own error state if the room cannot be fetched.
 */
const openRoomFromFacilityUsage = (roomId: number): void => {
    if (activeTab !== 'rooms') {
        activeTab = 'rooms';
        renderPage();
    }
    void openRoomManagementDrawer(roomId, { ...roomDrawerOptions(), initialTab: 'fasilitas' });
};

const attachRoomListeners = (): void => {
    document.getElementById('admin-peminjaman-room-filters')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const type = (document.getElementById('admin-peminjaman-room-type') as HTMLSelectElement | null)?.value as RoomType | '';
        const lab = (document.getElementById('admin-peminjaman-room-laboratory') as HTMLSelectElement | null)?.value ?? '';
        const active = (document.getElementById('admin-peminjaman-room-active') as HTMLSelectElement | null)?.value ?? '';
        const search = (document.getElementById('admin-peminjaman-room-search') as HTMLInputElement | null)?.value.trim() ?? '';
        roomFilters = {
            ...(type ? { type } : {}),
            ...(lab ? { laboratoryId: Number(lab) } : {}),
            ...(active ? { active: active === 'true' } : {}),
            ...(search ? { search } : {}),
        };
        void loadRooms();
    });
    document.getElementById('admin-peminjaman-reset-room-filters')?.addEventListener('click', () => {
        roomFilters = {};
        void loadRooms();
    });
    document.getElementById('admin-peminjaman-add-room')?.addEventListener('click', () => {
        openRoomFormModal({
            mode: 'create',
            laboratories,
            allowedTypes: ['classroom', 'laboratory'],
            onSaved: (saved) => {
                showToast('Ruangan berhasil dibuat.', true);
                void loadRooms(false).then(() => {
                    void openRoomManagementDrawer(saved.id, roomDrawerOptions());
                });
            },
        });
    });
    document.getElementById('admin-peminjaman-retry-rooms')?.addEventListener('click', () => {
        void loadRooms();
    });
    document.getElementById('admin-peminjaman-retry-laboratories')?.addEventListener('click', () => {
        void loadLaboratories();
    });
    const tableRoot = document.querySelector('[data-admin-room-state="success"]');
    if (tableRoot) {
        attachRoomTableListeners(tableRoot, (id) => {
            void openRoomManagementDrawer(id, roomDrawerOptions());
        });
        hydrateRoomTableCovers(tableRoot, roomCoverCache, () => activeTab === 'rooms');
    }
};

const roomDrawerOptions = () => ({
    laboratories,
    onRoomMutated: () => { void loadRooms(false); },
});

const attachBookingListeners = (): void => {
    document.getElementById('admin-peminjaman-booking-filters')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const status = (document.getElementById('admin-peminjaman-booking-status') as HTMLSelectElement | null)?.value as BookingStatus | '';
        const roomType = (document.getElementById('admin-peminjaman-booking-room-type') as HTMLSelectElement | null)?.value as RoomType | '';
        const roomId = (document.getElementById('admin-peminjaman-booking-room-id') as HTMLSelectElement | null)?.value ?? '';
        const dateFrom = (document.getElementById('admin-peminjaman-booking-date-from') as HTMLInputElement | null)?.value ?? '';
        const dateTo = (document.getElementById('admin-peminjaman-booking-date-to') as HTMLInputElement | null)?.value ?? '';
        if (dateFrom && dateTo && dateTo < dateFrom) {
            bookingFilterError = 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.';
            renderPage();
            return;
        }
        bookingFilterError = null;
        bookingFilters = {
            ...(status ? { status } : {}),
            ...(roomType ? { roomType } : {}),
            ...(roomId ? { roomId: Number(roomId) } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
            page: 1,
            perPage: PER_PAGE,
        };
        void loadBookings();
    });
    document.getElementById('admin-peminjaman-reset-booking-filters')?.addEventListener('click', () => {
        bookingFilters = { page: 1, perPage: PER_PAGE };
        bookingFilterError = null;
        void loadBookings();
    });
    document.getElementById('admin-peminjaman-retry-bookings')?.addEventListener('click', () => {
        void loadBookings();
    });
    document.getElementById('admin-peminjaman-booking-prev')?.addEventListener('click', () => {
        bookingFilters = {
            ...bookingFilters,
            page: Math.max(1, bookingMeta.current_page - 1),
        };
        void loadBookings();
    });
    document.getElementById('admin-peminjaman-booking-next')?.addEventListener('click', () => {
        bookingFilters = {
            ...bookingFilters,
            page: Math.min(bookingMeta.last_page, bookingMeta.current_page + 1),
        };
        void loadBookings();
    });
    document.querySelectorAll<HTMLElement>('[data-admin-booking-detail]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.adminBookingDetail);
            if (Number.isInteger(id) && id > 0) void openBookingDetail(id);
        });
    });
};

const loadRooms = async (showLoading = true): Promise<void> => {
    if (showLoading) {
        roomsLoading = true;
        roomsError = null;
        renderPage();
    }
    try {
        if (isRoomFilterActive()) {
            const [filtered, catalog] = await Promise.all([
                listManagedRooms(roomFilters),
                listManagedRooms(),
            ]);
            rooms = filtered;
            roomCatalog = catalog;
        } else {
            rooms = await listManagedRooms();
            roomCatalog = rooms;
        }
        roomsError = null;
    } catch (error) {
        rooms = [];
        roomsError = errorMessage(error, 'Data ruangan gagal dimuat.');
    } finally {
        roomsLoading = false;
        renderPage();
    }
};

const loadLaboratories = async (): Promise<void> => {
    try {
        laboratories = await getSuperAdminLaboratories();
        laboratoriesError = null;
    } catch (error) {
        laboratories = [];
        laboratoriesError = errorMessage(error, 'Daftar laboratorium gagal dimuat.');
    }
    renderPage();
};

const loadBookings = async (showLoading = true): Promise<void> => {
    if (showLoading) {
        bookingsLoading = true;
        bookingsError = null;
        renderPage();
    }
    try {
        const result = await getSuperAdminBookings(bookingFilters);
        bookings = result.data;
        bookingMeta = result.meta;
        bookingsError = null;
    } catch (error) {
        bookings = [];
        bookingMeta = { ...EMPTY_META };
        bookingsError = errorMessage(error, 'Monitoring pengajuan gagal dimuat.');
    } finally {
        bookingsLoading = false;
        renderPage();
    }
};

const closeModal = (): void => {
    document.getElementById('admin-peminjaman-modal-root')?.remove();
    if (modalEscapeHandler) {
        document.removeEventListener('keydown', modalEscapeHandler);
        modalEscapeHandler = null;
    }
};

const closeDrawer = (): void => {
    closeSuratPreview();
    document.getElementById('admin-peminjaman-drawer-root')?.remove();
    if (drawerEscapeHandler) {
        document.removeEventListener('keydown', drawerEscapeHandler);
        drawerEscapeHandler = null;
    }
};

const installDrawerEscape = (): void => {
    if (drawerEscapeHandler) document.removeEventListener('keydown', drawerEscapeHandler);
    drawerEscapeHandler = (event: KeyboardEvent) => {
        // Topmost layer first: the PDF preview overlay owns its own Escape.
        if (
            event.key === 'Escape'
            && !document.getElementById('admin-peminjaman-modal-root')
            && !document.getElementById('peminjaman-surat-preview-root')
        ) {
            closeDrawer();
        }
    };
    document.addEventListener('keydown', drawerEscapeHandler);
};

const drawerRoot = (): HTMLElement => {
    closeDrawer();
    const root = document.createElement('div');
    root.id = 'admin-peminjaman-drawer-root';
    document.body.appendChild(root);
    return root;
};

const renderBookingDetail = (
    booking: SuperAdminBooking | null,
    loading: boolean,
    error: string | null,
): void => {
    const root = document.getElementById('admin-peminjaman-drawer-root') ?? drawerRoot();
    root.innerHTML = `
        <div data-admin-drawer-overlay class="fixed inset-0 z-[200] bg-black/40"></div>
        <aside role="dialog" aria-modal="true" aria-labelledby="admin-booking-detail-title" class="fixed inset-y-0 right-0 z-[201] flex h-full w-full max-w-[620px] flex-col bg-white shadow-2xl">
            <header class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Detail Monitoring</p>
                    <h2 id="admin-booking-detail-title" class="mt-1 text-xl font-bold text-gray-900">${booking ? escapeHtml(booking.activity_name) : 'Pengajuan Peminjaman'}</h2>
                </div>
                <button id="close-admin-peminjaman-drawer" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Tutup detail pengajuan">×</button>
            </header>
            <div class="flex-1 overflow-y-auto px-6 py-5">
                ${loading ? `
                    <div data-admin-booking-detail-state="loading" class="py-16 text-center">
                        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700"></div>
                        <p class="mt-4 text-sm font-bold text-gray-700">Memuat detail monitoring...</p>
                    </div>
                ` : error ? `
                    <div data-admin-booking-detail-state="error" class="py-16 text-center">
                        <h3 class="text-base font-bold text-gray-800">Detail pengajuan tidak tersedia</h3>
                        <p class="mt-2 text-sm text-gray-500">${escapeHtml(error)}</p>
                    </div>
                ` : booking ? `
                    <div data-admin-booking-detail-state="success" class="space-y-6">
                        <div class="flex flex-wrap items-center gap-3">
                            <span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getBookingStatusTone(booking.status)}">${escapeHtml(getBookingStatusLabel(booking.status))}</span>
                            <span class="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Monitoring saja</span>
                        </div>
                        <dl class="divide-y divide-gray-100">
                            ${[
                                ['Pemohon', booking.requester?.name ?? '-'],
                                ['Email Pemohon', booking.requester?.email ?? '-'],
                                ['Ruangan', `${booking.room.code} · ${booking.room.name}`],
                                ['Lokasi', booking.room.location],
                                ['Jenis', getRoomTypeLabel(booking.room.type)],
                                ['Jumlah Peserta', `${booking.participant_count} orang`],
                                ['Mulai', formatDateTime(booking.start_at)],
                                ['Selesai', formatDateTime(booking.end_at)],
                                ['Reviewer', booking.reviewer?.name ?? '-'],
                            ].map(([label, value]) => `
                                <div class="grid grid-cols-[140px_1fr] gap-3 py-3">
                                    <dt class="text-xs font-bold text-gray-500">${escapeHtml(label)}</dt>
                                    <dd class="break-words text-sm font-semibold text-gray-800">${escapeHtml(value)}</dd>
                                </div>
                            `).join('')}
                        </dl>
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
                            ${(booking.status_histories ?? []).length > 0 ? `
                                <ol class="space-y-3">
                                    ${(booking.status_histories ?? []).map((history) => `
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
                            ` : '<p class="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-500">Riwayat status belum tersedia.</p>'}
                        </section>
                    </div>
                ` : ''}
            </div>
        </aside>
    `;
    const close = (): void => closeDrawer();
    root.querySelector('[data-admin-drawer-overlay]')?.addEventListener('click', close);
    root.querySelector('#close-admin-peminjaman-drawer')?.addEventListener('click', close);
    if (booking) {
        // Read-only PDF evidence for monitoring — never an approval/upload path.
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
    installDrawerEscape();
    root.querySelector<HTMLButtonElement>('#close-admin-peminjaman-drawer')?.focus();
};

const openBookingDetail = async (bookingId: number): Promise<void> => {
    drawerRoot();
    renderBookingDetail(null, true, null);
    try {
        renderBookingDetail(await getSuperAdminBooking(bookingId), false, null);
    } catch (error) {
        renderBookingDetail(null, false, errorMessage(error, 'Detail monitoring gagal dimuat.'));
    }
};

export const renderPeminjamanRuanganAdmin = async (): Promise<void> => {
    const sequence = ++renderSequence;
    activeTab = 'rooms';
    laboratories = [];
    laboratoriesError = null;
    roomCatalog = [];
    rooms = [];
    roomFilters = {};
    roomsLoading = true;
    roomsError = null;
    bookings = [];
    bookingFilters = { page: 1, perPage: PER_PAGE };
    bookingMeta = { ...EMPTY_META };
    bookingsLoading = true;
    bookingsError = null;
    bookingFilterError = null;
    roomCoverCache.forEach((url) => URL.revokeObjectURL(url));
    roomCoverCache.clear();
    closeModal();
    closeDrawer();
    closeRoomManagementDrawer();
    closeRoomFormModal();
    renderPage();

    const [laboratoryResult, roomResult, bookingResult] = await Promise.allSettled([
        getSuperAdminLaboratories(),
        listManagedRooms(),
        getSuperAdminBookings(bookingFilters),
    ]);
    if (sequence !== renderSequence) return;

    laboratories = laboratoryResult.status === 'fulfilled'
        ? laboratoryResult.value
        : [];
    laboratoriesError = laboratoryResult.status === 'rejected'
        ? errorMessage(laboratoryResult.reason, 'Daftar laboratorium gagal dimuat.')
        : null;
    if (roomResult.status === 'fulfilled') {
        rooms = roomResult.value;
        roomCatalog = roomResult.value;
    } else {
        roomsError = errorMessage(roomResult.reason, 'Data ruangan gagal dimuat.');
    }
    if (bookingResult.status === 'fulfilled') {
        bookings = bookingResult.value.data;
        bookingMeta = bookingResult.value.meta;
    } else {
        bookingsError = errorMessage(bookingResult.reason, 'Monitoring pengajuan gagal dimuat.');
    }
    roomsLoading = false;
    bookingsLoading = false;
    renderPage();
};
