import type {
    BookingConflictLevel,
    BookingConflictStatus,
    BookingConflictSummary,
    BookingStatus,
    RoomType,
} from '../mahasiswa/peminjaman/types';
import {
    DENSITY_LEGEND,
    formatDateKey,
    formatIndonesianDate,
    formatTimeRange,
    getBookingStatusLabel,
    getBookingStatusTone,
    getCalendarDateAriaLabel,
    getDensityBucket,
    getDensityCellClass,
    getDensitySwatchClass,
    getMonthLabel,
    indexItemsByJakartaDate,
    parseDateKey,
} from './peminjaman-calendar';

export type BookingCalendarRoomTypeFilter = 'all' | RoomType;
export type BookingCalendarStatusFilter = 'all' | BookingStatus;
export type BookingCalendarItemCapabilities = Record<string, boolean | undefined>;
export type BookingCalendarDataAttributeName = `data-${string}`;

export interface BookingCalendarViewItem {
    id: number;
    roomCode: string;
    roomName: string;
    status: BookingStatus;
    startAt: string;
    endAt: string;
    activityName: string;
    purpose: string;
    requesterName?: string | null;
    laboratoryName?: string | null;
    conflictStatus?: BookingConflictStatus;
    hasConflict?: boolean;
    conflictLevel?: BookingConflictLevel;
    conflictMessage?: string | null;
    conflicts?: BookingConflictSummary[];
    capabilities?: BookingCalendarItemCapabilities;
}

export interface BookingCalendarFilterOption<T extends string> {
    value: T;
    label: string;
    selected: boolean;
}

export interface BookingCalendarStatusOption extends BookingCalendarFilterOption<BookingCalendarStatusFilter> {
    count: number;
    ariaLabel?: string;
}

export interface BookingCalendarSelectOption {
    value: string;
    label: string;
    selected: boolean;
}

export interface BookingCalendarItemAction {
    label: string;
    dataAttribute: BookingCalendarDataAttributeName;
    value: (item: BookingCalendarViewItem) => string | number;
    requiredCapability: string;
}

export interface BookingCalendarViewConfig {
    copy: {
        title: string;
        helper: string;
        densityHelper: string;
        totalText: string;
        roomTypeFilterLabel: string;
        roomTypeFilterAriaLabel: string;
        statusFilterLabel: string;
        statusFilterAriaLabel: string;
        laboratoryLabel: string;
        roomLabel: string;
        allLaboratoriesLabel: string;
        allRoomsLabel: string;
        resetLabel: string;
        loadingText: string;
        errorTitle: string;
        retryLabel: string;
        monthEmptyText: string;
    };
    ids: {
        previousMonthButton: string;
        nextMonthButton: string;
        todayButton: string;
        resetButton: string;
        monthHeading: string;
        grid: string;
        retryButton: string;
        laboratorySelect: string;
        roomSelect: string;
    };
    dataAttributes: {
        dateCell: BookingCalendarDataAttributeName;
        roomTypeFilter: BookingCalendarDataAttributeName;
        statusFilter: BookingCalendarDataAttributeName;
        calendarState: BookingCalendarDataAttributeName;
        upcomingState: BookingCalendarDataAttributeName;
    };
    navigation: {
        previousMonthAriaLabel: string;
        nextMonthAriaLabel: string;
        todayLabel: string;
        todayAriaLabel: string;
    };
    state: {
        cursor: Date;
        selectedDateKey: string | null;
        items: BookingCalendarViewItem[];
        loading: boolean;
        loaded: boolean;
        error: string | null;
    };
    filters: {
        roomTypeOptions: BookingCalendarFilterOption<BookingCalendarRoomTypeFilter>[];
        statusOptions: BookingCalendarStatusOption[];
        laboratoryOptions: BookingCalendarSelectOption[];
        roomOptions: BookingCalendarSelectOption[];
    };
    filterVisibility?: {
        roomType?: boolean;
        status?: boolean;
        laboratory?: boolean;
        room?: boolean;
    };
    upcoming: {
        title: string;
        subtitle: string;
        loading: boolean;
        error: string | null;
        loadingText: string;
        emptyText: string;
        items: BookingCalendarViewItem[];
    };
    actions?: BookingCalendarItemAction[];
}

export interface BookingCalendarSelectedDatePanelConfig {
    dateKey: string;
    items: BookingCalendarViewItem[];
    titleEyebrow: string;
    titleId: string;
    closeButtonId: string;
    closeButtonLabel: string;
    overlayDataAttribute: BookingCalendarDataAttributeName;
    countText: string;
    emptyText: string;
    actions?: BookingCalendarItemAction[];
}

const WEEKDAY_HEADERS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DATA_ATTRIBUTE_NAME_PATTERN = /^data-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const escapePeminjamanCalendarText = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const selectedAttr = (actual: boolean): string => (actual ? 'selected' : '');

const dataAttrName = (name: BookingCalendarDataAttributeName): string => {
    if (!DATA_ATTRIBUTE_NAME_PATTERN.test(name)) {
        throw new Error('Invalid booking calendar data attribute name.');
    }

    return name;
};

const dataAttr = (name: BookingCalendarDataAttributeName, value: string | number): string =>
    `${dataAttrName(name)}="${escapePeminjamanCalendarText(value)}"`;

const actionAllowed = (
    item: BookingCalendarViewItem,
    action: BookingCalendarItemAction,
): boolean => item.capabilities?.[action.requiredCapability] === true;

const renderItemActions = (
    item: BookingCalendarViewItem,
    actions: readonly BookingCalendarItemAction[] = [],
): string => {
    const allowedActions = actions.filter((action) => actionAllowed(item, action));

    if (allowedActions.length === 0) return '';

    return `
        <div class="mt-3 flex flex-wrap gap-2">
            ${allowedActions.map((action) => `
                <button type="button" ${dataAttr(action.dataAttribute, action.value(item))} class="rounded-xl border border-teal-700 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">${escapePeminjamanCalendarText(action.label)}</button>
            `).join('')}
        </div>
    `;
};

const renderConflictBadge = (item: BookingCalendarViewItem): string => {
    const status = item.conflictStatus ?? 'none';
    if (status === 'none' || item.hasConflict === false) return '';

    const count = item.conflicts?.length ?? 0;
    const countText = count > 0 ? `${count} jadwal bertabrakan.` : 'Ada jadwal bertabrakan.';
    const commonClasses = 'mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold';

    if (status === 'approved_overlap') {
        return `
            <span class="${commonClasses} border-red-200 bg-red-50 text-red-700" title="${escapePeminjamanCalendarText(item.conflictMessage ?? '')}" aria-label="${escapePeminjamanCalendarText(`Bentrok dengan jadwal disetujui. ${countText}`)}">Bentrok dengan jadwal disetujui</span>
        `;
    }

    if (status === 'pending_overlap') {
        return `
            <span class="${commonClasses} border-amber-200 bg-amber-50 text-amber-800" title="${escapePeminjamanCalendarText(item.conflictMessage ?? '')}" aria-label="${escapePeminjamanCalendarText(`Ada pengajuan lain di waktu yang sama. ${countText}`)}">Ada pengajuan lain di waktu yang sama</span>
        `;
    }

    return '';
};

export const renderBookingCalendarItemCard = (
    item: BookingCalendarViewItem,
    actions: readonly BookingCalendarItemAction[] = [],
): string => `
    <li class="rounded-xl border border-gray-100 p-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
                <p class="break-words text-sm font-bold text-gray-800">${escapePeminjamanCalendarText(item.roomCode)} - ${escapePeminjamanCalendarText(item.roomName)}</p>
                ${item.laboratoryName ? `<p class="mt-1 break-words text-xs font-semibold text-gray-500">${escapePeminjamanCalendarText(item.laboratoryName)}</p>` : ''}
                <p class="mt-1 text-xs font-semibold text-gray-600">${escapePeminjamanCalendarText(formatIndonesianDate(new Date(item.startAt)))}</p>
                <p class="mt-1 text-xs text-gray-500">${escapePeminjamanCalendarText(formatTimeRange(item.startAt, item.endAt))}</p>
            </div>
            <span class="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${getBookingStatusTone(item.status)}">${escapePeminjamanCalendarText(getBookingStatusLabel(item.status))}</span>
        </div>
        <p class="mt-2 break-words text-sm font-semibold text-gray-800">${escapePeminjamanCalendarText(item.activityName)}</p>
        ${renderConflictBadge(item)}
        <p class="mt-1 break-words text-xs text-gray-500">${escapePeminjamanCalendarText(item.requesterName ?? 'Pemohon tidak tersedia')}</p>
        <p class="mt-2 line-clamp-2 break-words text-xs text-gray-600">${escapePeminjamanCalendarText(item.purpose)}</p>
        ${renderItemActions(item, actions)}
    </li>
`;

const renderRoomTypeButton = (
    option: BookingCalendarFilterOption<BookingCalendarRoomTypeFilter>,
    dataAttribute: BookingCalendarDataAttributeName,
): string => `
    <button type="button" ${dataAttr(dataAttribute, option.value)} aria-pressed="${option.selected}" class="shrink-0 rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors ${option.selected ? 'border-primary-teal bg-teal-50 text-primary-teal' : 'border-gray-200 bg-white text-gray-600 hover:border-teal-200 hover:text-primary-teal'}">${escapePeminjamanCalendarText(option.label)}</button>
`;

const renderStatusButton = (
    option: BookingCalendarStatusOption,
    dataAttribute: BookingCalendarDataAttributeName,
): string => {
    const ariaLabel = option.ariaLabel ?? `Filter status ${option.label}, ${option.count} peminjaman.`;

    return `
        <button type="button" ${dataAttr(dataAttribute, option.value)} aria-pressed="${option.selected}" aria-label="${escapePeminjamanCalendarText(ariaLabel)}" class="shrink-0 rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors ${option.selected ? 'border-primary-teal bg-teal-50 text-primary-teal' : 'border-gray-200 bg-white text-gray-600 hover:border-teal-200 hover:text-primary-teal'}">${escapePeminjamanCalendarText(`${option.label} (${option.count})`)}</button>
    `;
};

const renderSelectOptions = (
    emptyLabel: string,
    options: readonly BookingCalendarSelectOption[],
): string => `
    <option value="">${escapePeminjamanCalendarText(emptyLabel)}</option>
    ${options.map((option) => `
        <option value="${escapePeminjamanCalendarText(option.value)}" ${selectedAttr(option.selected)}>${escapePeminjamanCalendarText(option.label)}</option>
    `).join('')}
`;

const filterIsVisible = (visibility: boolean | undefined): boolean => visibility !== false;

const renderBookingCalendarFilters = (config: BookingCalendarViewConfig): string => {
    const showRoomType = filterIsVisible(config.filterVisibility?.roomType);
    const showStatus = filterIsVisible(config.filterVisibility?.status);
    const showLaboratory = filterIsVisible(config.filterVisibility?.laboratory);
    const showRoom = filterIsVisible(config.filterVisibility?.room);
    const primaryFilters = [
        showRoomType ? `
            <div>
                <p class="mb-2 text-xs font-bold text-gray-600">${escapePeminjamanCalendarText(config.copy.roomTypeFilterLabel)}</p>
                <div class="flex flex-wrap items-center gap-2" role="group" aria-label="${escapePeminjamanCalendarText(config.copy.roomTypeFilterAriaLabel)}">
                    ${config.filters.roomTypeOptions.map((option) =>
                        renderRoomTypeButton(option, config.dataAttributes.roomTypeFilter)).join('')}
                </div>
            </div>
        ` : '',
        showStatus ? `
            <div>
                <p class="mb-2 text-xs font-bold text-gray-600">${escapePeminjamanCalendarText(config.copy.statusFilterLabel)}</p>
                <div class="flex flex-wrap items-center gap-2" role="group" aria-label="${escapePeminjamanCalendarText(config.copy.statusFilterAriaLabel)}">
                    ${config.filters.statusOptions.map((option) =>
                        renderStatusButton(option, config.dataAttributes.statusFilter)).join('')}
                </div>
            </div>
        ` : '',
    ].filter(Boolean).join('');
    const selectFilters = [
        showLaboratory ? `
            <label class="text-xs font-bold text-gray-600">
                ${escapePeminjamanCalendarText(config.copy.laboratoryLabel)}
                <select id="${escapePeminjamanCalendarText(config.ids.laboratorySelect)}" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                    ${renderSelectOptions(config.copy.allLaboratoriesLabel, config.filters.laboratoryOptions)}
                </select>
            </label>
        ` : '',
        showRoom ? `
            <label class="text-xs font-bold text-gray-600">
                ${escapePeminjamanCalendarText(config.copy.roomLabel)}
                <select id="${escapePeminjamanCalendarText(config.ids.roomSelect)}" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                    ${renderSelectOptions(config.copy.allRoomsLabel, config.filters.roomOptions)}
                </select>
            </label>
        ` : '',
    ].filter(Boolean);

    return `
        <div class="space-y-4">
            ${primaryFilters ? `<div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">${primaryFilters}</div>` : ''}
            ${selectFilters.length > 0 ? `<div class="grid grid-cols-1 gap-4 ${selectFilters.length > 1 ? 'md:grid-cols-2' : ''}">${selectFilters.join('')}</div>` : ''}
            <div class="flex justify-end">
                <button id="${escapePeminjamanCalendarText(config.ids.resetButton)}" type="button" class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">${escapePeminjamanCalendarText(config.copy.resetLabel)}</button>
            </div>
        </div>
    `;
};

const renderDensityLegend = (helper: string): string => `
    <div class="space-y-1.5">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-600">
            <span class="font-bold uppercase tracking-wider text-gray-500">Kepadatan</span>
            ${DENSITY_LEGEND.map(({ bucket, label }) => `
                <span class="inline-flex items-center gap-1.5">
                    <span class="h-3 w-3 rounded ${getDensitySwatchClass(bucket)}" aria-hidden="true"></span>
                    ${escapePeminjamanCalendarText(label)}
                </span>
            `).join('')}
        </div>
        <p class="text-[11px] font-medium text-gray-500">${escapePeminjamanCalendarText(helper)}</p>
    </div>
`;

export const renderBookingCalendarGridCells = (
    cursor: Date,
    selectedDateKey: string | null,
    items: readonly BookingCalendarViewItem[],
    dateDataAttribute: BookingCalendarDataAttributeName = 'data-peminjaman-calendar-date',
): string => {
    const indexed = indexItemsByJakartaDate(items, (item) => item.startAt);
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
    const todayKey = formatDateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
        const cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + index);
        const dateKey = formatDateKey(cellDate);
        const inMonth = cellDate.getMonth() === month;
        const count = indexed.get(dateKey)?.length ?? 0;
        const isSelected = dateKey === selectedDateKey;
        const isToday = dateKey === todayKey;
        const selectedClass = isSelected
            ? 'ring-2 ring-teal-700 ring-offset-1'
            : isToday
                ? 'ring-1 ring-teal-500'
                : '';

        if (!inMonth) {
            return `<button type="button" disabled class="relative flex h-11 items-center justify-center rounded-lg bg-transparent text-sm font-semibold text-gray-300" aria-label="${escapePeminjamanCalendarText(formatIndonesianDate(cellDate))}, di luar bulan aktif">${cellDate.getDate()}</button>`;
        }

        return `
            <button type="button" ${dataAttr(dateDataAttribute, dateKey)} aria-pressed="${isSelected}" aria-label="${escapePeminjamanCalendarText(getCalendarDateAriaLabel(cellDate, count, isSelected, isToday))}" class="relative flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${getDensityCellClass(getDensityBucket(count))} ${selectedClass}">
                ${cellDate.getDate()}
                ${count > 0 ? `<span class="absolute right-0.5 top-0.5 h-4 min-w-4 rounded-full bg-white/90 px-1 text-[9px] leading-4 text-teal-800 shadow-sm">${count}</span>` : ''}
            </button>
        `;
    }).join('');
};

const renderUpcomingPanel = (
    upcoming: BookingCalendarViewConfig['upcoming'],
    stateDataAttribute: BookingCalendarDataAttributeName,
    actions: readonly BookingCalendarItemAction[] = [],
): string => `
    <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h4 class="text-sm font-bold text-gray-800">${escapePeminjamanCalendarText(upcoming.title)}</h4>
        <p class="mt-1 text-xs text-gray-500">${escapePeminjamanCalendarText(upcoming.subtitle)}</p>
        ${upcoming.loading ? `<p ${dataAttr(stateDataAttribute, 'loading')} class="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-5 text-center text-sm font-semibold text-teal-700">${escapePeminjamanCalendarText(upcoming.loadingText)}</p>` : upcoming.error ? `
            <p ${dataAttr(stateDataAttribute, 'error')} class="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-5 text-center text-sm font-semibold text-red-700">${escapePeminjamanCalendarText(upcoming.error)}</p>
        ` : upcoming.items.length > 0 ? `
            <ul class="mt-4 space-y-3">
                ${upcoming.items.map((item) => renderBookingCalendarItemCard(item, actions)).join('')}
            </ul>
        ` : `<p class="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">${escapePeminjamanCalendarText(upcoming.emptyText)}</p>`}
    </div>
`;

const renderCalendarBody = (config: BookingCalendarViewConfig): string => {
    if (config.state.error) {
        return `
            <div ${dataAttr(config.dataAttributes.calendarState, 'error')} class="px-6 py-16 text-center">
                <h3 class="text-base font-bold text-gray-800">${escapePeminjamanCalendarText(config.copy.errorTitle)}</h3>
                <p class="mt-2 text-sm text-gray-500">${escapePeminjamanCalendarText(config.state.error)}</p>
                <button id="${escapePeminjamanCalendarText(config.ids.retryButton)}" type="button" class="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">${escapePeminjamanCalendarText(config.copy.retryLabel)}</button>
            </div>
        `;
    }

    return `
        ${config.state.loading ? `<div ${dataAttr(config.dataAttributes.calendarState, 'loading')} class="bg-teal-50 px-6 py-3 text-xs font-semibold text-teal-700">${escapePeminjamanCalendarText(config.copy.loadingText)}</div>` : ''}
        <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div class="overflow-x-auto border-b border-gray-100 lg:border-b-0 lg:border-r">
                <div class="min-w-[420px] px-4 py-4 md:px-6">
                    <div class="grid grid-cols-7 gap-1.5">
                        ${WEEKDAY_HEADERS.map((day) => `<div class="text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">${day}</div>`).join('')}
                    </div>
                    <div id="${escapePeminjamanCalendarText(config.ids.grid)}" class="mt-2 grid grid-cols-7 gap-1.5">${renderBookingCalendarGridCells(config.state.cursor, config.state.selectedDateKey, config.state.items, config.dataAttributes.dateCell)}</div>
                    ${config.state.loaded && !config.state.loading && config.state.items.length === 0 ? `<div ${dataAttr(config.dataAttributes.calendarState, 'empty')} class="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm font-semibold text-gray-700">${escapePeminjamanCalendarText(config.copy.monthEmptyText)}</div>` : ''}
                </div>
            </div>
            <div class="p-4 md:p-5">
                ${renderUpcomingPanel(config.upcoming, config.dataAttributes.upcomingState, config.actions)}
            </div>
        </div>
    `;
};

export const renderBookingCalendarView = (config: BookingCalendarViewConfig): string => `
    <section class="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm" aria-live="polite">
        <div class="space-y-4 border-b border-gray-100 px-6 pb-4 pt-6">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h3 class="text-base font-bold text-gray-800">${escapePeminjamanCalendarText(config.copy.title)}</h3>
                    <p class="mt-1 text-xs text-gray-500">${escapePeminjamanCalendarText(config.copy.helper)}</p>
                </div>
                <div class="flex items-center gap-1 md:gap-2">
                    <button id="${escapePeminjamanCalendarText(config.ids.previousMonthButton)}" type="button" class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" aria-label="${escapePeminjamanCalendarText(config.navigation.previousMonthAriaLabel)}">&lsaquo;</button>
                    <div id="${escapePeminjamanCalendarText(config.ids.monthHeading)}" class="min-w-[128px] text-center text-sm font-bold text-gray-800 md:min-w-[150px]" aria-live="polite">${escapePeminjamanCalendarText(getMonthLabel(config.state.cursor))}</div>
                    <button id="${escapePeminjamanCalendarText(config.ids.nextMonthButton)}" type="button" class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" aria-label="${escapePeminjamanCalendarText(config.navigation.nextMonthAriaLabel)}">&rsaquo;</button>
                    <button id="${escapePeminjamanCalendarText(config.ids.todayButton)}" type="button" class="ml-1 inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" aria-label="${escapePeminjamanCalendarText(config.navigation.todayAriaLabel)}">${escapePeminjamanCalendarText(config.navigation.todayLabel)}</button>
                </div>
            </div>
            ${renderBookingCalendarFilters(config)}
        </div>
        <div class="flex flex-col gap-3 border-b border-gray-100 px-4 py-3.5 md:px-6 lg:flex-row lg:items-center lg:justify-between">
            ${renderDensityLegend(config.copy.densityHelper)}
            <p class="text-xs font-semibold text-gray-500">${escapePeminjamanCalendarText(config.copy.totalText)}</p>
        </div>
        ${renderCalendarBody(config)}
    </section>
`;

export const renderBookingCalendarSelectedDatePanel = (
    config: BookingCalendarSelectedDatePanelConfig,
): string => `
    <div ${dataAttrName(config.overlayDataAttribute)} class="fixed inset-0 z-[200] bg-black/40"></div>
    <aside role="dialog" aria-modal="true" aria-labelledby="${escapePeminjamanCalendarText(config.titleId)}" class="fixed inset-y-0 right-0 z-[201] flex h-full w-full max-w-[430px] flex-col bg-white shadow-2xl">
        <header class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-6">
            <div>
                <p class="text-xs font-bold uppercase tracking-wider text-teal-700">${escapePeminjamanCalendarText(config.titleEyebrow)}</p>
                <h2 id="${escapePeminjamanCalendarText(config.titleId)}" class="mt-1 text-base font-bold text-gray-900">${escapePeminjamanCalendarText(formatIndonesianDate(parseDateKey(config.dateKey)))}</h2>
                <p class="mt-1 text-xs text-gray-500">${escapePeminjamanCalendarText(config.countText)}</p>
            </div>
            <button id="${escapePeminjamanCalendarText(config.closeButtonId)}" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="${escapePeminjamanCalendarText(config.closeButtonLabel)}">x</button>
        </header>
        <div class="flex-1 overflow-y-auto px-6 py-5">
            ${config.items.length > 0 ? `<ul class="space-y-3">${config.items.map((item) => renderBookingCalendarItemCard(item, config.actions)).join('')}</ul>` : `<p class="py-12 text-center text-sm font-semibold text-gray-700">${escapePeminjamanCalendarText(config.emptyText)}</p>`}
        </div>
    </aside>
`;
