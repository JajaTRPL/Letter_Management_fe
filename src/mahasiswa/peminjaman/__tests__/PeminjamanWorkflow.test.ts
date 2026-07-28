import { describe, expect, it } from 'vitest';
import {
    buildOccurrenceDrafts,
    bookingFormToPayload,
    canCancelBooking,
    canEditBooking,
    canResubmitBooking,
    emptyBookingFormValues,
    validateBookingForm,
} from '../workflow';
import type {
    MahasiswaBooking,
    Room,
} from '../types';

const room: Room = {
    id: 7,
    code: 'API-KLS-07',
    name: 'Ruang Validasi',
    type: 'classroom',
    capacity: 20,
    location: 'Gedung Uji',
    description: null,
    is_active: true,
    owning_laboratory: null,
};

const validValues = {
    roomId: String(room.id),
    date: '2026-06-20',
    bookingMode: 'single_day' as const,
    endDate: '',
    startTime: '10:00',
    endTime: '12:00',
    activityName: 'Rapat Organisasi',
    purpose: 'Koordinasi kegiatan.',
    participantCount: '10',
};

const booking = (
    status: MahasiswaBooking['status'],
    startAt = '2026-06-20T10:00:00+07:00',
): MahasiswaBooking => ({
    id: 11,
    room,
    activity_name: 'Rapat Organisasi',
    purpose: 'Koordinasi kegiatan.',
    participant_count: 10,
    start_at: startAt,
    end_at: '2026-06-20T12:00:00+07:00',
    status,
    reviewer: null,
    reviewed_at: null,
    revision_note: null,
    rejection_reason: null,
    cancellation_reason: null,
    created_at: '2026-06-18T09:00:00+07:00',
    updated_at: '2026-06-18T09:00:00+07:00',
});

describe('Peminjaman booking workflow rules', () => {
    it('builds the backend payload with an explicit Jakarta offset', () => {
        expect(bookingFormToPayload(validValues)).toEqual({
            room_id: room.id,
            activity_name: 'Rapat Organisasi',
            purpose: 'Koordinasi kegiatan.',
            participant_count: 10,
            start_at: '2026-06-20T10:00:00+07:00',
            end_at: '2026-06-20T12:00:00+07:00',
            booking_mode: 'single_day',
        });
    });

    it('blocks participant counts above selected room capacity', () => {
        const errors = validateBookingForm(
            { ...validValues, participantCount: '21' },
            [room],
            '2026-06-18',
        );

        expect(errors.participantCount).toContain('kapasitas 20');
    });

    it('blocks identical start and end time', () => {
        const errors = validateBookingForm(
            { ...validValues, startTime: '10:00', endTime: '10:00' },
            [room],
            '2026-06-18',
        );

        expect(errors.endTime).toContain('tidak boleh sama');
    });

    it('treats an earlier end clock as one overnight occurrence', () => {
        const values = { ...validValues, startTime: '23:00', endTime: '01:00' };
        expect(validateBookingForm(values, [room], '2026-06-18').endTime).toBeUndefined();
        expect(bookingFormToPayload(values).end_at).toBe('2026-06-21T01:00:00+07:00');
    });

    it('builds one occurrence per inclusive date with one shared daily clock', () => {
        const values = {
            ...validValues,
            bookingMode: 'consecutive_days' as const,
            endDate: '2026-06-22',
            startTime: '09:00',
            endTime: '12:00',
        };

        expect(buildOccurrenceDrafts(values)).toEqual([
            {
                sequence: 1,
                date: '2026-06-20',
                startAt: '2026-06-20T09:00:00+07:00',
                endAt: '2026-06-20T12:00:00+07:00',
                durationHours: 3,
            },
            {
                sequence: 2,
                date: '2026-06-21',
                startAt: '2026-06-21T09:00:00+07:00',
                endAt: '2026-06-21T12:00:00+07:00',
                durationHours: 3,
            },
            {
                sequence: 3,
                date: '2026-06-22',
                startAt: '2026-06-22T09:00:00+07:00',
                endAt: '2026-06-22T12:00:00+07:00',
                durationHours: 3,
            },
        ]);
        expect(bookingFormToPayload(values)).toMatchObject({
            booking_mode: 'consecutive_days',
            occurrence_end_date: '2026-06-22',
            start_at: '2026-06-20T09:00:00+07:00',
            end_at: '2026-06-22T12:00:00+07:00',
        });
    });

    it('applies the central fourteen-day client guard to consecutive ranges', () => {
        const errors = validateBookingForm({
            ...validValues,
            bookingMode: 'consecutive_days',
            endDate: '2026-07-04',
        }, [room], '2026-06-18');

        expect(errors.endDate).toContain('maksimal 14 hari');
    });

    it('allows edit and resubmit only for revision requests', () => {
        expect(canEditBooking(booking('revision_requested'))).toBe(true);
        expect(canResubmitBooking(booking('revision_requested'))).toBe(true);
        expect(canEditBooking(booking('submitted'))).toBe(false);
        expect(canResubmitBooking(booking('approved'))).toBe(false);
    });

    it('allows cancellation for submitted, revision, and future approved requests only', () => {
        const now = new Date('2026-06-18T02:00:00Z');
        expect(canCancelBooking(booking('submitted'), now)).toBe(true);
        expect(canCancelBooking(booking('revision_requested'), now)).toBe(true);
        expect(canCancelBooking(booking('approved'), now)).toBe(true);
        expect(canCancelBooking(
            booking('approved', '2026-06-18T09:00:00+07:00'),
            now,
        )).toBe(false);
        expect(canCancelBooking(booking('rejected'), now)).toBe(false);
        expect(canCancelBooking(booking('cancelled'), now)).toBe(false);
    });

    it('provides an empty form model for fresh requests', () => {
        expect(emptyBookingFormValues('7', '2026-06-20')).toMatchObject({
            roomId: '7',
            date: '2026-06-20',
            activityName: '',
            purpose: '',
        });
    });
});
