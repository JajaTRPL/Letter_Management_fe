import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import {
    getLetterLabel,
    isMagangLetter,
    isAktifLetter,
    isProsesLuarNegeriLetter,
    isSuratTugasLetter,
    isLegacyBeasiswaFallback,
} from '../shared/letter-workflow';
import { renderScholarshipDetail } from './ScholarshipForm';
import { renderSuratPengantarMagangDetail } from './SuratPengantarMagangForm';
import { renderSuratKeteranganAktifDetail } from './SuratKeteranganAktifForm';
import { renderProsesLuarNegeriDetail } from './ProsesLuarNegeriForm';
import { renderSuratTugasDetail } from './SuratTugasForm';
import {
    attachListControls,
    createListQueryState,
    renderListBody,
    renderListLoading,
    renderListPagination,
    renderListToolbar,
    type ListPrimitiveConfig,
} from '../shared/list-primitives';
import {
    loadMahasiswaApplications,
    mahasiswaListFilters,
    mahasiswaListSearchText,
    type MahasiswaListItem,
} from '../shared/mahasiswa-application-list';
import { badgeClass, buttonClass, cx, surfaceClass, textClass } from '../shared/design-system';
import { escapeFormAttribute, escapeFormHtml } from '../shared/form-primitives';
import {
    formatIndonesianDate,
    formatIsoDateKeyInJakarta,
    formatTimeRange,
    getRoomTypeLabel,
    parseDateKey,
} from '../shared/peminjaman-calendar';
import { getMahasiswaBookings } from './peminjaman/api';
import {
    bookingLifecycleStatus,
    getLifecycleStatusLabel,
    getLifecycleStatusTone,
} from './peminjaman/workflow';
import type { MahasiswaBooking } from './peminjaman/types';

const LIST_ID_PREFIX = 'riwayat-list';
const LIST_ROWS_ID = `${LIST_ID_PREFIX}-rows`;

// Type-based detail dispatch. Kept in the page (not the adapter) so the static
// import graph and code-splitting are preserved — the adapter holds data only.
const openDetailForApplication = (id: string, type?: string): void => {
    if (!id) return;
    if (isMagangLetter(type)) {
        renderSuratPengantarMagangDetail(id, { origin: 'riwayat' });
    } else if (isAktifLetter(type)) {
        renderSuratKeteranganAktifDetail(id, { origin: 'riwayat' });
    } else if (isProsesLuarNegeriLetter(type)) {
        renderProsesLuarNegeriDetail(id, { origin: 'riwayat' });
    } else if (isSuratTugasLetter(type)) {
        renderSuratTugasDetail(id, { origin: 'riwayat' });
    } else if (isLegacyBeasiswaFallback(type)) {
        renderScholarshipDetail(id, { origin: 'riwayat' });
    }
};

const PEMINJAMAN_TYPE_VALUE = 'peminjaman-ruangan';

type RiwayatPengajuanSource = 'letter' | 'peminjaman';

interface RiwayatPengajuanItem {
    source: RiwayatPengajuanSource;
    id: string;
    letterType: string;
    typeFilter: string;
    statusFilter: string;
    searchText: string;
    sortDate: string | null;
    submittedAt: string | null;
    typeLabel: string;
    requestTypeLabel: string;
    title: string;
    subtitle: string;
    detail: string;
    statusLabel: string;
    statusTone: string;
}

const filterOptionsFor = (key: string) =>
    mahasiswaListFilters.find((filter) => filter.key === key)?.options ?? [];

const riwayatPengajuanFilters = [
    {
        key: 'type',
        label: 'Jenis Pengajuan',
        options: [
            ...filterOptionsFor('type'),
            { value: PEMINJAMAN_TYPE_VALUE, label: 'Peminjaman Ruangan' },
        ],
    },
    {
        key: 'status',
        label: 'Status',
        options: [
            ...filterOptionsFor('status'),
            { value: 'submitted', label: 'Diajukan' },
            { value: 'under_review', label: 'Sedang Ditinjau' },
            { value: 'revision_requested', label: 'Perlu Revisi' },
            { value: 'approved', label: 'Disetujui' },
            { value: 'rejected', label: 'Ditolak' },
            { value: 'cancelled', label: 'Dibatalkan' },
            { value: 'expired', label: 'Kedaluwarsa' },
            { value: 'completed', label: 'Selesai' },
        ],
    },
];

const formatDate = (value: string | null): string => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const formatBookingSchedule = (booking: MahasiswaBooking): string => {
    const dateKey = formatIsoDateKeyInJakarta(booking.start_at);
    const date = dateKey ? formatIndonesianDate(parseDateKey(dateKey)) : '-';
    return `${date} - ${formatTimeRange(booking.start_at, booking.end_at)}`;
};

const toLetterRiwayatItem = (item: MahasiswaListItem): RiwayatPengajuanItem => {
    const requestTypeLabel = getLetterLabel(item.letterType);
    const title = item.label || requestTypeLabel;
    const detail = item.displayDate ? `Diajukan ${formatDate(item.displayDate)}` : 'Tanggal pengajuan belum tersedia';
    return {
        source: 'letter',
        id: item.id,
        letterType: item.letterType,
        typeFilter: item.letterType,
        statusFilter: item.status,
        searchText: `${mahasiswaListSearchText(item)} ${requestTypeLabel} ${item.letterType}`,
        sortDate: item.sortDate ?? item.displayDate,
        submittedAt: item.displayDate,
        typeLabel: 'Administrasi Surat',
        requestTypeLabel,
        title,
        subtitle: title === requestTypeLabel ? 'Pengajuan surat administrasi' : requestTypeLabel,
        detail,
        statusLabel: item.statusLabel,
        statusTone: item.statusTone,
    };
};

const toPeminjamanRiwayatItem = (booking: MahasiswaBooking): RiwayatPengajuanItem => {
    const title = [booking.room.code, booking.room.name].filter(Boolean).join(' - ') || 'Peminjaman Ruangan';
    const schedule = formatBookingSchedule(booking);
    // Presentation and filtering both follow the backend's authoritative
    // lifecycle status (under_review/expired/completed refine the stored one).
    const lifecycleStatus = bookingLifecycleStatus(booking);
    const statusLabel = getLifecycleStatusLabel(lifecycleStatus);
    return {
        source: 'peminjaman',
        id: String(booking.id),
        letterType: '',
        typeFilter: PEMINJAMAN_TYPE_VALUE,
        statusFilter: lifecycleStatus,
        searchText: [
            'Peminjaman Ruangan',
            booking.room.code,
            booking.room.name,
            booking.activity_name,
            getRoomTypeLabel(booking.room.type),
            schedule,
            statusLabel,
        ].join(' '),
        sortDate: booking.created_at ?? booking.start_at,
        submittedAt: booking.created_at,
        typeLabel: 'Peminjaman Ruangan',
        requestTypeLabel: 'Peminjaman Ruangan',
        title,
        subtitle: booking.activity_name || 'Peminjaman Ruangan',
        detail: schedule,
        statusLabel,
        statusTone: getLifecycleStatusTone(lifecycleStatus),
    };
};

const sortRiwayatPengajuanItems = (items: readonly RiwayatPengajuanItem[]): RiwayatPengajuanItem[] =>
    [...items].sort((a, b) => {
        const ta = a.sortDate ? new Date(a.sortDate).getTime() : 0;
        const tb = b.sortDate ? new Date(b.sortDate).getTime() : 0;
        return tb - ta;
    });

const riwayatPengajuanSearchText = (item: RiwayatPengajuanItem): string => item.searchText;

const riwayatPengajuanFilterValue = (item: RiwayatPengajuanItem, filterKey: string): string => {
    if (filterKey === 'type') return item.typeFilter;
    if (filterKey === 'status') return item.statusFilter;
    return '';
};

const renderRiwayatPengajuanItem = (item: RiwayatPengajuanItem): string => `
    <article class="grid cursor-pointer gap-4 px-5 py-5 transition-colors hover:bg-gray-50/70 lg:grid-cols-[155px_minmax(170px,0.9fr)_minmax(240px,1.4fr)_150px_110px] lg:items-center"
        data-row-action="view-detail"
        data-source="${escapeFormAttribute(item.source)}"
        data-id="${escapeFormAttribute(item.id)}"
        data-type="${escapeFormAttribute(item.letterType)}">
        <div>
            <p class="lg:hidden text-[11px] font-bold uppercase tracking-wide text-gray-400">Tanggal Pengajuan</p>
            <p class="mt-1 text-sm font-medium text-gray-600 lg:mt-0">${escapeFormHtml(formatDate(item.submittedAt))}</p>
        </div>
        <div class="min-w-0">
            <p class="lg:hidden text-[11px] font-bold uppercase tracking-wide text-gray-400">Jenis Pengajuan</p>
            <span class="${badgeClass(item.source === 'peminjaman' ? 'info' : 'primary', 'mt-1 lg:mt-0')}">${escapeFormHtml(item.typeLabel)}</span>
            <p class="mt-2 break-words text-xs font-semibold text-gray-500">${escapeFormHtml(item.requestTypeLabel)}</p>
        </div>
        <div class="min-w-0">
            <p class="lg:hidden text-[11px] font-bold uppercase tracking-wide text-gray-400">Nama Pengajuan</p>
            <p class="mt-1 break-words text-sm font-bold text-gray-900 lg:mt-0">${escapeFormHtml(item.title)}</p>
            <p class="mt-1 break-words text-sm text-gray-600">${escapeFormHtml(item.subtitle)}</p>
            <p class="mt-1 break-words text-xs text-gray-500">${escapeFormHtml(item.detail)}</p>
        </div>
        <div>
            <p class="lg:hidden text-[11px] font-bold uppercase tracking-wide text-gray-400">Status</p>
            <span class="${escapeFormAttribute(cx(
                'mt-1 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-bold lg:mt-0',
                item.statusTone,
            ))}">${escapeFormHtml(item.statusLabel)}</span>
        </div>
        <div class="lg:text-right">
            <button type="button"
                data-action="view-detail"
                data-source="${escapeFormAttribute(item.source)}"
                data-id="${escapeFormAttribute(item.id)}"
                data-type="${escapeFormAttribute(item.letterType)}"
                class="${buttonClass('ghost', 'sm', 'px-0')}">
                Lihat Detail
            </button>
        </div>
    </article>
`;

const listConfig: ListPrimitiveConfig<RiwayatPengajuanItem> = {
    idPrefix: LIST_ID_PREFIX,
    searchPlaceholder: 'Cari surat, ruangan, kegiatan, atau status...',
    filters: riwayatPengajuanFilters,
    getSearchText: riwayatPengajuanSearchText,
    getFilterValue: riwayatPengajuanFilterValue,
    renderItem: renderRiwayatPengajuanItem,
    renderItemsContainer: (rowsHtml) => `
        <div class="hidden grid-cols-[155px_minmax(170px,0.9fr)_minmax(240px,1.4fr)_150px_110px] border-b border-gray-100 px-5 py-4 text-[12px] font-bold uppercase tracking-wide text-gray-500 lg:grid">
            <span>Tanggal Pengajuan</span>
            <span>Jenis Pengajuan</span>
            <span>Nama Pengajuan</span>
            <span>Status</span>
            <span class="text-right">Aksi</span>
        </div>
        <div class="divide-y divide-gray-50">${rowsHtml}</div>
    `,
    emptyMessage: 'Belum ada riwayat pengajuan.',
};

const renderRiwayatWarning = (message: string): string => `
    <div role="alert" class="${surfaceClass('section', 'border-amber-200 bg-amber-50 px-4 py-3')}">
        <p class="${cx(textClass.helper, 'font-semibold text-amber-800')}">${escapeFormHtml(message)}</p>
    </div>
`;

export const renderRiwayatPengajuan = async (): Promise<void> => {
    const queryState = createListQueryState({ pageSize: 10 });

    // Peminjaman Ruangan history is fetched in parallel and merged into the
    // same list model below. Its status labels stay Peminjaman-specific.
    const peminjamanRequest = getMahasiswaBookings()
        .then((bookings) => ({ bookings, error: null as string | null }))
        .catch(() => ({
            bookings: [] as MahasiswaBooking[],
            error: 'Riwayat peminjaman ruangan gagal dimuat. Silakan coba lagi.',
        }));

    // Initial shell with a loading state inside the rows container.
    const shell = (rowsInner: string): string => `
        <div class="space-y-6">
            ${renderListToolbar(listConfig, queryState)}
            <div id="riwayat-alerts" class="space-y-3"></div>
            <div class="${surfaceClass('card', 'overflow-hidden')}">
                <div id="${LIST_ROWS_ID}" class="overflow-x-auto">${rowsInner}</div>
            </div>
            ${renderListPagination(LIST_ID_PREFIX)}
        </div>
    `;

    renderDashboardLayout('Riwayat Pengajuan', shell(renderListLoading('Memuat riwayat pengajuan...')), 'mahasiswa', 'history');

    let letterItems: MahasiswaListItem[] = [];
    let failedEndpointCount = 0;
    let letterLoadError: string | null = null;
    try {
        const loaded = await loadMahasiswaApplications((url) => apiFetch(url, { cache: 'no-store' }));
        letterItems = loaded.items;
        failedEndpointCount = loaded.failedEndpointCount;
    } catch (e) {
        console.error('Failed to fetch applications', e);
        letterLoadError = 'Riwayat surat administrasi gagal dimuat. Data Peminjaman Ruangan tetap ditampilkan jika tersedia.';
    }

    const peminjamanResult = await peminjamanRequest;
    const items = sortRiwayatPengajuanItems([
        ...letterItems.map(toLetterRiwayatItem),
        ...peminjamanResult.bookings.map(toPeminjamanRiwayatItem),
    ]);

    const warnings = [
        letterLoadError,
        !letterLoadError && failedEndpointCount > 0
            ? 'Sebagian data surat administrasi gagal dimuat. Daftar di bawah mungkin belum lengkap.'
            : null,
        peminjamanResult.error,
    ].filter((message): message is string => Boolean(message));

    const alerts = document.getElementById('riwayat-alerts');
    if (alerts) alerts.innerHTML = warnings.map(renderRiwayatWarning).join('');

    // Re-render the body and (re)bind row-level detail dispatch after every
    // toolbar/pagination change.
    const refresh = (): void => {
        renderListBody(items, queryState, listConfig);
        bindRowActions();
    };

    const bindRowActions = (): void => {
        const root = document.getElementById(LIST_ROWS_ID);
        if (!root) return;

        root.querySelectorAll('[data-action="view-detail"]').forEach((button) => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const el = e.currentTarget as HTMLElement;
                openDetailFromDataset(el.dataset);
            });
        });

        root.querySelectorAll('[data-row-action="view-detail"]').forEach((row) => {
            row.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('button, a')) return;
                const el = e.currentTarget as HTMLElement;
                openDetailFromDataset(el.dataset);
            });
        });
    };

    const openDetailFromDataset = (dataset: DOMStringMap): void => {
        if (!dataset.id) return;
        if (dataset.source === 'peminjaman') {
            const id = Number(dataset.id);
            if (!Number.isInteger(id)) return;
            import('./peminjaman/detail').then(({ openPeminjamanBookingDetail }) => {
                void openPeminjamanBookingDetail(id, {
                    onMutated: () => {
                        void renderRiwayatPengajuan();
                    },
                });
            });
            return;
        }

        openDetailForApplication(dataset.id, dataset.type);
    };

    attachListControls(queryState, listConfig, refresh);
    refresh();
};
