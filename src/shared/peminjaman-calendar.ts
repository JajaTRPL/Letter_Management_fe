import type {
    AvailabilityItem,
    BookingStatus,
    RoomType,
} from '../mahasiswa/peminjaman/types';

export type PeminjamanFilter = 'all' | RoomType;
export type DensityBucket = 'empty' | 'low' | 'medium' | 'high';
export type AvailabilityByDate = Map<string, AvailabilityItem[]>;

const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
const MONTH_NAMES_ID = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
];

const jakartaDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

export const getMonthLabel = (date: Date): string =>
    `${MONTH_NAMES_ID[date.getMonth()]} ${date.getFullYear()}`;

export const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const formatIsoDateKeyInJakarta = (isoDate: string): string => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '';

    return jakartaDateKeyFormatter.format(date);
};

export const getMonthDateRange = (
    cursor: Date,
): { from: string; to: string } => ({
    from: formatDateKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
    to: formatDateKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
});

export const parseDateKey = (dateKey: string): Date => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
};

export const formatIndonesianDate = (date: Date): string =>
    date.toLocaleDateString('id-ID', {
        timeZone: JAKARTA_TIME_ZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

export const formatTimeRange = (startISO: string, endISO: string): string => {
    const options: Intl.DateTimeFormatOptions = {
        timeZone: JAKARTA_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    };
    const start = new Date(startISO).toLocaleTimeString('id-ID', options);
    const end = new Date(endISO).toLocaleTimeString('id-ID', options);
    return `${start}–${end} WIB`;
};

export const normalizeAvailabilityByDate = (
    items: readonly AvailabilityItem[],
): AvailabilityByDate => {
    const indexed = indexItemsByJakartaDate(items, (item) => item.start_at);

    return indexed as AvailabilityByDate;
};

export const filterApprovedAvailability = (
    items: readonly AvailabilityItem[],
    filter: PeminjamanFilter,
): AvailabilityItem[] =>
    items.filter(
        (item) =>
            item.lifecycle_category === 'approved'
            && (filter === 'all' || item.room.type === filter),
    );

export const getDayAvailability = (
    indexed: AvailabilityByDate,
    dateKey: string,
    filter: PeminjamanFilter,
): AvailabilityItem[] =>
    filterApprovedAvailability(indexed.get(dateKey) ?? [], filter);

export const countApprovedByFilter = (
    items: readonly AvailabilityItem[],
    filter: PeminjamanFilter,
): number => filterApprovedAvailability(items, filter).length;

export const getDensityBucket = (total: number): DensityBucket => {
    if (total === 0) return 'empty';
    if (total === 1) return 'low';
    if (total <= 4) return 'medium';
    return 'high';
};

export const getDensityCellClass = (bucket: DensityBucket): string => {
    switch (bucket) {
        case 'low':
            return 'bg-teal-50 text-teal-700 hover:bg-teal-100';
        case 'medium':
            return 'bg-teal-100 text-teal-800 hover:bg-teal-200';
        case 'high':
            return 'bg-teal-500 text-white hover:bg-teal-600';
        case 'empty':
        default:
            return 'bg-white text-gray-700 hover:bg-gray-50';
    }
};

export const getBookingStatusLabel = (status: BookingStatus): string => {
    switch (status) {
        case 'submitted':
            return 'Diajukan';
        case 'revision_requested':
            return 'Perlu Revisi';
        case 'approved':
            return 'Disetujui';
        case 'rejected':
            return 'Ditolak';
        case 'cancelled':
            return 'Dibatalkan';
    }
};

export const getBookingStatusTone = (status: BookingStatus): string => {
    switch (status) {
        case 'submitted':
            return 'bg-blue-50 text-blue-700 border-blue-100';
        case 'revision_requested':
            return 'bg-amber-50 text-amber-700 border-amber-100';
        case 'approved':
            return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        case 'rejected':
            return 'bg-red-50 text-red-700 border-red-100';
        case 'cancelled':
            return 'bg-gray-100 text-gray-600 border-gray-200';
    }
};

export const getRoomTypeLabel = (type: RoomType): string =>
    type === 'classroom' ? 'Ruang Kelas' : 'Laboratorium';

/**
 * Solid swatch class for the density legend (presentation only). Mirrors the
 * bucket colours used by getDensityCellClass but without hover/text so it can
 * render as a small colour chip next to its label.
 */
export const getDensitySwatchClass = (bucket: DensityBucket): string => {
    switch (bucket) {
        case 'low':
            return 'bg-teal-50 border border-teal-100';
        case 'medium':
            return 'bg-teal-100';
        case 'high':
            return 'bg-teal-500';
        case 'empty':
        default:
            return 'bg-white border border-gray-200';
    }
};

/** Ordered legend entries (empty → padat) for the calendar density key. */
export const DENSITY_LEGEND: ReadonlyArray<{ bucket: DensityBucket; label: string }> = [
    { bucket: 'empty', label: 'Kosong' },
    { bucket: 'low', label: 'Rendah' },
    { bucket: 'medium', label: 'Sedang' },
    { bucket: 'high', label: 'Padat' },
];

export const indexItemsByJakartaDate = <T>(
    items: readonly T[],
    getStartAt: (item: T) => string,
): Map<string, T[]> => {
    const indexed = new Map<string, T[]>();

    items.forEach((item) => {
        const dateKey = formatIsoDateKeyInJakarta(getStartAt(item));
        if (!dateKey) return;

        const dayItems = indexed.get(dateKey) ?? [];
        dayItems.push(item);
        dayItems.sort(
            (left, right) =>
                new Date(getStartAt(left)).getTime() - new Date(getStartAt(right)).getTime(),
        );
        indexed.set(dateKey, dayItems);
    });

    return indexed;
};

export const getDensityLabelForCount = (count: number): string =>
    DENSITY_LEGEND.find(({ bucket }) => bucket === getDensityBucket(count))?.label.toLowerCase() ?? 'kosong';

export const getCalendarDateAriaLabel = (
    date: Date,
    count: number,
    isSelected: boolean,
    isToday: boolean,
): string => {
    const parts = [
        formatIndonesianDate(date),
        isSelected ? 'dipilih' : 'tidak dipilih',
    ];

    if (isToday) parts.push('hari ini');
    parts.push(`${count} peminjaman`);
    parts.push(`kepadatan ${getDensityLabelForCount(count)}`);

    return `${parts.join(', ')}.`;
};

export const getCalendarKeyboardTargetDateKey = (
    dateKey: string,
    key: string,
): string | null => {
    const date = parseDateKey(dateKey);

    switch (key) {
        case 'ArrowLeft':
            date.setDate(date.getDate() - 1);
            break;
        case 'ArrowRight':
            date.setDate(date.getDate() + 1);
            break;
        case 'ArrowUp':
            date.setDate(date.getDate() - 7);
            break;
        case 'ArrowDown':
            date.setDate(date.getDate() + 7);
            break;
        case 'Home':
            date.setDate(date.getDate() - date.getDay());
            break;
        case 'End':
            date.setDate(date.getDate() + (6 - date.getDay()));
            break;
        case 'PageUp':
            date.setMonth(date.getMonth() - 1);
            break;
        case 'PageDown':
            date.setMonth(date.getMonth() + 1);
            break;
        default:
            return null;
    }

    return formatDateKey(date);
};
