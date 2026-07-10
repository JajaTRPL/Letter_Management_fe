// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../../api-client', () => ({ apiFetch: mocks.apiFetch }));

import {
    downloadRoomTemplate,
    fetchRoomPhotoObjectUrl,
    listManagedRooms,
    reorderRoomPhotos,
    syncRoomFacilities,
    uploadRoomPhoto,
} from '../api';
import { PeminjamanApiError } from '../../../mahasiswa/peminjaman/api';
import {
    auditEntryLabel,
    facilityConditionLabel,
    formatFileSize,
    normalizeFlags,
    roomMissingFacilities,
    roomMissingPhoto,
    roomMissingTemplate,
} from '../utils';
import type { ManagedRoom } from '../types';

const jsonResponse = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

let createdUrls: string[];
let revokedUrls: string[];

beforeEach(() => {
    mocks.apiFetch.mockReset();
    createdUrls = [];
    revokedUrls = [];
    let counter = 0;
    URL.createObjectURL = vi.fn(() => { const u = `blob:rm-${++counter}`; createdUrls.push(u); return u; });
    URL.revokeObjectURL = vi.fn((u: string) => { revokedUrls.push(u); });
});

describe('room-management api helpers', () => {
    it('builds room list query params and normalizes flags', async () => {
        mocks.apiFetch.mockResolvedValue(jsonResponse({
            message: 'ok',
            data: [{ id: 1, code: 'A', name: 'A', type: 'classroom', capacity: 1, location: 'x', description: null, is_active: true, owning_laboratory: null }],
        }));
        const rooms = await listManagedRooms({ type: 'laboratory', active: false, laboratoryId: 3, search: 'lab a' });

        expect(mocks.apiFetch).toHaveBeenCalledWith('/api/room-management/rooms?type=laboratory&active=0&laboratory_id=3&search=lab+a');
        // Missing flags on the payload normalize to a fully-false set.
        expect(rooms[0].management_flags.can_edit_info).toBe(false);
        expect(rooms[0].management_flags.can_create).toBe(false);
    });

    it('uploads a photo as multipart FormData', async () => {
        mocks.apiFetch.mockResolvedValue(jsonResponse({ message: 'ok', data: { id: 5 } }));
        const file = new File([new Uint8Array([1, 2, 3])], 'foto.jpg', { type: 'image/jpeg' });
        await uploadRoomPhoto(9, file);

        const [, options] = mocks.apiFetch.mock.calls[0];
        expect(options.method).toBe('POST');
        expect(options.isFormData).toBe(true);
        expect((options.body as FormData).get('photo')).toBeInstanceOf(File);
    });

    it('reorders photos with a photo_ids payload', async () => {
        mocks.apiFetch.mockResolvedValue(jsonResponse({ message: 'ok', data: [] }));
        await reorderRoomPhotos(9, [3, 1, 2]);
        const [url, options] = mocks.apiFetch.mock.calls[0];
        expect(url).toBe('/api/room-management/rooms/9/photos/reorder');
        expect(JSON.parse(options.body as string)).toEqual({ photo_ids: [3, 1, 2] });
    });

    it('sends the facilities sync payload', async () => {
        mocks.apiFetch.mockResolvedValue(jsonResponse({
            message: 'ok',
            data: [{ facility_type_id: 2, name: 'Proyektor' }],
            delegated_activity_acknowledgement: {
                outcome: 'created',
                id: 15,
                status: 'pending_review',
                effective_status: 'pending_review',
                acknowledgement_due_at: '2026-07-11T09:00:00+07:00',
                accountable_role: 'kepala_lab',
                accountable_user: { id: 4, name: 'Kepala Lab' },
                message: 'Perubahan fasilitas tersimpan dan menunggu peninjauan Kepala Lab.',
                reason: null,
            },
        }));
        const result = await syncRoomFacilities(9, [{ facility_type_id: 2, quantity: 4, condition: 'baik', notes: null }]);
        const [, options] = mocks.apiFetch.mock.calls[0];
        expect(JSON.parse(options.body as string)).toEqual({
            facilities: [{ facility_type_id: 2, quantity: 4, condition: 'baik', notes: null }],
        });
        expect(result.data[0].facility_type_id).toBe(2);
        expect(result.delegated_activity_acknowledgement?.outcome).toBe('created');
        expect(JSON.stringify(result.delegated_activity_acknowledgement)).not.toContain('before_state');
        expect(JSON.stringify(result.delegated_activity_acknowledgement)).not.toContain('/storage/');
    });

    it('tolerates legacy facilities sync responses without delegation metadata', async () => {
        mocks.apiFetch.mockResolvedValue(jsonResponse({ message: 'ok', data: [] }));
        const result = await syncRoomFacilities(9, []);

        expect(result.data).toEqual([]);
        expect(result.delegated_activity_acknowledgement).toBeNull();
    });

    it('rejects photo URLs that are not relative /api endpoints, without fetching', async () => {
        await expect(fetchRoomPhotoObjectUrl('https://evil.example/storage/x.jpg')).rejects.toBeInstanceOf(PeminjamanApiError);
        await expect(fetchRoomPhotoObjectUrl('/storage/x.jpg')).rejects.toBeInstanceOf(PeminjamanApiError);
        expect(mocks.apiFetch).not.toHaveBeenCalled();
    });

    it('downloads a template via authenticated blob with a local safe filename and no window.open', async () => {
        mocks.apiFetch.mockResolvedValue(new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' })));
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const openSpy = vi.spyOn(window, 'open');

        await downloadRoomTemplate({ id: 9, code: 'HU 207/X' }, { id: 3, version: 2, mime: 'application/pdf' });

        expect(mocks.apiFetch).toHaveBeenCalledWith('/api/room-management/rooms/9/templates/3/download', { cache: 'no-store' });
        expect(openSpy).not.toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(revokedUrls).toEqual(createdUrls);
        clickSpy.mockRestore();
        openSpy.mockRestore();
    });

    it('maps a missing template to friendly Indonesian copy', async () => {
        mocks.apiFetch.mockResolvedValue(jsonResponse({ message: 'x' }, 404));
        await expect(downloadRoomTemplate({ id: 9, code: 'HU207' }, { id: 3, version: 1, mime: 'application/pdf' }))
            .rejects.toThrow('Template tidak ditemukan.');
    });
});

describe('room-management utils', () => {
    it('normalizes partial/absent flags to all-false', () => {
        expect(normalizeFlags(undefined)).toEqual({
            can_edit_info: false, can_manage_media: false, can_manage_facilities: false,
            can_manage_templates: false, can_create: false, can_deactivate: false, can_activate: false,
        });
        expect(normalizeFlags({ can_edit_info: true }).can_edit_info).toBe(true);
    });

    it('formats file sizes and facility conditions in Indonesian', () => {
        expect(formatFileSize(null)).toBe('-');
        expect(formatFileSize(2048)).toBe('2.0 KB');
        expect(facilityConditionLabel('perlu_perbaikan')).toBe('Perlu perbaikan');
        expect(facilityConditionLabel('unknown')).toBeNull();
    });

    it('labels audit entries with human subject/action', () => {
        expect(auditEntryLabel({ id: 1, subject_type: 'photo', action: 'uploaded' })).toBe('Foto · Diunggah');
        expect(auditEntryLabel({ id: 2, subject_type: 'room', action: 'weird' })).toBe('Ruangan · weird');
    });

    it('derives data-health flags from a room', () => {
        const room = {
            cover_photo: null,
            facilities_summary: { count: 0 },
            has_active_template: false,
        } as ManagedRoom;
        expect(roomMissingPhoto(room)).toBe(true);
        expect(roomMissingFacilities(room)).toBe(true);
        expect(roomMissingTemplate(room)).toBe(true);
    });
});
