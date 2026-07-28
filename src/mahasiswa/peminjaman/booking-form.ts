import { formatDateKey } from '../../shared/peminjaman-calendar';
import {
    createMahasiswaBooking,
    generateRoomBookingIdempotencyKey,
    PeminjamanApiError,
    updateMahasiswaBooking,
} from './api';
import { isMahasiswaBooking } from './booking-schema';
import {
    bookingFormToPayload,
    bookingToFormValues,
    emptyBookingFormValues,
    formatFileSize,
    validateBookingForm,
    validateSuratPdfFile,
    type BookingFormErrors,
    type BookingFormValues,
} from './workflow';
import { renderBookingFormDialog } from './views';
import type { MahasiswaBooking, Room, RoomType } from './types';

/**
 * Shared booking form controller (create + edit/revision), extracted from the
 * landing page so any surface — landing category cards, calendar day dialog,
 * room browser, or the booking detail dialog opened from Dashboard/Riwayat —
 * can start the same workflow. Owns the dialog root, escape handling,
 * validation, and the create/update API calls; success is reported through
 * `onSaved` so each caller refreshes its own surface.
 */

export interface BookingWorkflowFormOptions {
    rooms: readonly Room[];
    mode: 'create' | 'edit';
    date?: string;
    preferredType?: RoomType;
    preferredRoomId?: number;
    booking?: MahasiswaBooking;
    onSaved: (booking: MahasiswaBooking) => void;
    /**
     * The booking we are editing moved on server-side (409 carrying fresh safe
     * state): the form we are showing is built from stale data, so the caller
     * takes over with the fresh booking instead of letting the user resubmit it.
     */
    onStale?: (booking: MahasiswaBooking, message: string) => void;
}

interface BookingFormState {
    mode: 'create' | 'edit';
    values: BookingFormValues;
    errors: BookingFormErrors;
    submitting: boolean;
    bookingId?: number;
    // The selected File is held in state (not the input) so it survives the
    // dialog re-render on validation error — a file input cannot be
    // repopulated programmatically. `suratFileName` drives the chip display.
    suratFile: File | null;
    suratFileName: string | null;
    suratSizeLabel: string | null;
    suratError?: string;
    idempotencyKey: string | null;
}

let workflowEscapeHandler: ((event: KeyboardEvent) => void) | null = null;

export const closeBookingWorkflow = (): void => {
    document.getElementById('peminjaman-workflow-root')?.remove();
    if (workflowEscapeHandler) {
        document.removeEventListener('keydown', workflowEscapeHandler);
        workflowEscapeHandler = null;
    }
};

const installWorkflowEscape = (close: () => void): void => {
    if (workflowEscapeHandler) {
        document.removeEventListener('keydown', workflowEscapeHandler);
    }
    workflowEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', workflowEscapeHandler);
};

const workflowRoot = (): HTMLElement => {
    document.getElementById('peminjaman-workflow-root')?.remove();
    const root = document.createElement('div');
    root.id = 'peminjaman-workflow-root';
    document.body.appendChild(root);
    return root;
};

const readBookingFormValues = (previous: BookingFormValues): BookingFormValues => ({
    roomId: (document.getElementById('peminjaman-room-id') as HTMLSelectElement | null)?.value ?? '',
    date: (document.getElementById('peminjaman-date') as HTMLInputElement | null)?.value ?? '',
    bookingMode: previous.bookingMode,
    endDate: previous.endDate,
    startTime: (document.getElementById('peminjaman-start-time') as HTMLInputElement | null)?.value ?? '',
    endTime: (document.getElementById('peminjaman-end-time') as HTMLInputElement | null)?.value ?? '',
    activityName: (document.getElementById('peminjaman-activity-name') as HTMLInputElement | null)?.value ?? '',
    purpose: (document.getElementById('peminjaman-purpose') as HTMLTextAreaElement | null)?.value ?? '',
    participantCount: (document.getElementById('peminjaman-participant-count') as HTMLInputElement | null)?.value ?? '',
});

const todayKey = (): string => formatDateKey(new Date());

const backendFormErrors = (error: PeminjamanApiError): BookingFormErrors => {
    const mapped: BookingFormErrors = {};
    const aliases: Record<string, keyof BookingFormValues> = {
        room_id: 'roomId',
        activity_name: 'activityName',
        purpose: 'purpose',
        participant_count: 'participantCount',
        start_at: 'startTime',
        end_at: 'endTime',
    };
    Object.entries(error.errors ?? {}).forEach(([key, messages]) => {
        const target = aliases[key];
        if (target) mapped[target] = messages[0];
    });
    if (Object.keys(mapped).length === 0) {
        mapped.form = error.status === 409
            ? 'Jadwal bertabrakan dengan peminjaman yang telah disetujui. Pilih waktu lain.'
            : error.message;
    }
    return mapped;
};

export const openBookingWorkflowForm = (options: BookingWorkflowFormOptions): void => {
    closeBookingWorkflow();
    const preferredRoom = options.booking?.room
        ?? (options.preferredRoomId !== undefined
            ? options.rooms.find((room) => room.id === options.preferredRoomId)
            : options.rooms.find((room) => !options.preferredType || room.type === options.preferredType));
    const values = options.booking
        ? bookingToFormValues(options.booking)
        : emptyBookingFormValues(
            preferredRoom ? String(preferredRoom.id) : '',
            options.date ?? '',
        );
    const state: BookingFormState = {
        mode: options.mode,
        values,
        errors: {},
        submitting: false,
        bookingId: options.booking?.id,
        suratFile: null,
        suratFileName: null,
        suratSizeLabel: null,
        idempotencyKey: null,
    };

    const render = (): void => {
        const root = workflowRoot();
        root.innerHTML = renderBookingFormDialog(
            options.rooms,
            state.values,
            state.errors,
            state.mode,
            state.submitting,
            {
                fileName: state.suratFileName,
                sizeLabel: state.suratSizeLabel,
                error: state.suratError,
            },
        );

        const close = (): void => closeBookingWorkflow();
        root.querySelector('[data-workflow-overlay]')?.addEventListener('click', close);
        root.querySelector('#close-peminjaman-workflow')?.addEventListener('click', close);
        root.querySelector('#cancel-peminjaman-workflow')?.addEventListener('click', close);
        root.querySelector('#peminjaman-room-id')?.addEventListener('change', () => {
            state.values = readBookingFormValues(state.values);
            const room = options.rooms.find((item) => String(item.id) === state.values.roomId);
            const capacity = document.getElementById('peminjaman-room-capacity');
            if (capacity) {
                capacity.textContent = room
                    ? `Kapasitas maksimal ${room.capacity} orang · ${room.location}`
                    : 'Pilih ruangan untuk melihat kapasitas.';
            }
        });
        root.querySelector('#peminjaman-surat-pdf')?.addEventListener('change', (event) => {
            const file = (event.target as HTMLInputElement).files?.[0] ?? null;
            const error = file ? validateSuratPdfFile(file) : undefined;
            // Preserve the fields the user already typed before re-rendering the
            // dialog (only room-id has its own change handler otherwise).
            state.values = readBookingFormValues(state.values);
            state.suratFile = error ? null : file;
            state.suratFileName = file?.name ?? null;
            state.suratSizeLabel = file && !error ? formatFileSize(file.size) : null;
            state.suratError = error ?? undefined;
            render();
        });
        root.querySelector('#peminjaman-surat-clear')?.addEventListener('click', () => {
            state.values = readBookingFormValues(state.values);
            state.suratFile = null;
            state.suratFileName = null;
            state.suratSizeLabel = null;
            state.suratError = undefined;
            render();
        });
        root.querySelector('#peminjaman-booking-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            state.values = readBookingFormValues(state.values);
            state.errors = validateBookingForm(state.values, options.rooms, todayKey());
            // The uploaded PDF is required on create only; the normal PUT edit
            // stays file-free (replacement uses the dedicated route in detail).
            state.suratError = state.mode === 'create'
                ? validateSuratPdfFile(state.suratFile) ?? undefined
                : undefined;
            if (Object.keys(state.errors).length > 0 || state.suratError) {
                render();
                return;
            }

            state.submitting = true;
            if (state.mode === 'create' && state.idempotencyKey === null) {
                state.idempotencyKey = generateRoomBookingIdempotencyKey();
            }
            render();
            try {
                const saved = state.mode === 'create'
                    ? await createMahasiswaBooking(
                        bookingFormToPayload(state.values),
                        state.suratFile!,
                        state.idempotencyKey ?? generateRoomBookingIdempotencyKey(),
                    )
                    : await updateMahasiswaBooking(
                        state.bookingId!,
                        bookingFormToPayload(state.values),
                    );
                closeBookingWorkflow();
                options.onSaved(saved);
            } catch (error) {
                state.submitting = false;
                if (!(error instanceof PeminjamanApiError && error.status === 422)) {
                    state.idempotencyKey = null;
                }
                if (error instanceof PeminjamanApiError && error.status === 409 && options.onStale) {
                    const fresh = error.data?.booking;
                    // Only a 409 that hands back the real booking is a stale-state
                    // conflict; a plain schedule clash keeps the form open so the
                    // user can pick another time.
                    if (isMahasiswaBooking(fresh)) {
                        closeBookingWorkflow();
                        options.onStale(fresh, error.message);
                        return;
                    }
                }
                state.errors = error instanceof PeminjamanApiError
                    ? backendFormErrors(error)
                    : { form: error instanceof Error ? error.message : 'Pengajuan gagal disimpan.' };
                render();
            }
        });
        installWorkflowEscape(close);
        root.querySelector<HTMLElement>('#peminjaman-room-id')?.focus();
    };

    render();
};
