// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    getRoom: vi.fn(),
    updateRoom: vi.fn(),
    activateRoom: vi.fn(),
    deactivateRoom: vi.fn(),
    createRoom: vi.fn(),
    listPhotos: vi.fn(),
    uploadPhoto: vi.fn(),
    deletePhoto: vi.fn(),
    setCover: vi.fn(),
    reorder: vi.fn(),
    fetchPhoto: vi.fn(),
    listFacilityTypes: vi.fn(),
    getFacilities: vi.fn(),
    syncFacilities: vi.fn(),
    listTemplates: vi.fn(),
    uploadTemplate: vi.fn(),
    activateTemplate: vi.fn(),
    deactivateTemplate: vi.fn(),
    downloadTemplate: vi.fn(),
    listAudit: vi.fn(),
    toasts: [] as string[],
}));

vi.mock('../api', () => ({
    getManagedRoom: m.getRoom,
    updateManagedRoom: m.updateRoom,
    activateManagedRoom: m.activateRoom,
    deactivateManagedRoom: m.deactivateRoom,
    createManagedRoom: m.createRoom,
    listRoomPhotos: m.listPhotos,
    uploadRoomPhoto: m.uploadPhoto,
    deleteRoomPhoto: m.deletePhoto,
    setRoomCover: m.setCover,
    reorderRoomPhotos: m.reorder,
    fetchRoomPhotoObjectUrl: m.fetchPhoto,
    listFacilityTypes: m.listFacilityTypes,
    createFacilityType: vi.fn(),
    getRoomFacilities: m.getFacilities,
    syncRoomFacilities: m.syncFacilities,
    listRoomTemplates: m.listTemplates,
    uploadRoomTemplate: m.uploadTemplate,
    activateRoomTemplate: m.activateTemplate,
    deactivateRoomTemplate: m.deactivateTemplate,
    downloadRoomTemplate: m.downloadTemplate,
    listRoomAuditLogs: m.listAudit,
}));

vi.mock('toastify-js', () => ({
    default: vi.fn((options: { text: string }) => ({ showToast: () => m.toasts.push(options.text) })),
}));

import {
    closeRoomManagementDrawer,
    openRoomManagementDrawer,
} from '../detail-drawer';
import type { ManagedRoom, ManagedRoomDetail, RoomManagementFlags } from '../types';

const flags = (over: Partial<RoomManagementFlags> = {}): RoomManagementFlags => ({
    can_edit_info: true, can_manage_media: true, can_manage_facilities: true,
    can_manage_templates: true, can_create: true, can_deactivate: true, can_activate: true, ...over,
});

const detail = (over: Partial<ManagedRoomDetail> = {}): ManagedRoomDetail => ({
    id: 9, code: 'HU-207', name: 'Ruang <img src=x onerror=unsafe()>', type: 'classroom',
    capacity: 60, location: 'Gedung', description: 'Deskripsi', rules: 'Jaga kebersihan.',
    is_active: true, owning_laboratory: null, cover_photo: null,
    facilities_summary: { count: 0, items: [] }, has_active_template: false,
    management_flags: flags(), photos: [], facilities: [], active_template: null, ...over,
});

const flush = async (): Promise<void> => {
    await Promise.resolve(); await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

const openTab = async (tab: string): Promise<void> => {
    document.querySelector<HTMLElement>(`[data-room-mgmt-tab="${tab}"]`)?.click();
    await flush();
};

beforeEach(() => {
    document.body.innerHTML = '';
    Object.values(m).forEach((v) => { if (typeof v === 'function' && 'mockReset' in v) v.mockReset(); });
    m.toasts = [];
    m.getRoom.mockResolvedValue(detail());
    m.updateRoom.mockResolvedValue({} as ManagedRoom);
    m.deactivateRoom.mockResolvedValue({} as ManagedRoom);
    m.activateRoom.mockResolvedValue({} as ManagedRoom);
    m.listPhotos.mockResolvedValue([]);
    m.getFacilities.mockResolvedValue([]);
    m.listFacilityTypes.mockResolvedValue([{ id: 1, name: 'Proyektor', slug: 'proyektor', is_predefined: true }]);
    m.syncFacilities.mockResolvedValue({ data: [], delegated_activity_acknowledgement: null });
    m.listTemplates.mockResolvedValue([]);
    m.listAudit.mockResolvedValue([]);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
});

afterEach(() => closeRoomManagementDrawer());

describe('room management drawer — Info tab', () => {
    it('renders escaped room info and gated action buttons', async () => {
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();

        expect(document.getElementById('room-mgmt-title')?.textContent).toContain('HU-207');
        expect(document.querySelector('#room-mgmt-title img')).toBeNull();
        expect(document.body.textContent).toContain('Jaga kebersihan.');
        expect(document.getElementById('room-mgmt-edit')).not.toBeNull();
        expect(document.getElementById('room-mgmt-toggle')?.textContent).toContain('Nonaktifkan');
    });

    it('hides mutation actions when the backend flags forbid them', async () => {
        m.getRoom.mockResolvedValue(detail({ management_flags: flags({
            can_edit_info: false, can_deactivate: false, can_activate: false,
        }) }));
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();

        expect(document.getElementById('room-mgmt-edit')).toBeNull();
        expect(document.getElementById('room-mgmt-toggle')).toBeNull();
        expect(document.body.textContent).toContain('Anda memiliki akses baca');
    });

    it('deactivates through the confirm dialog and notifies the host', async () => {
        const onRoomMutated = vi.fn();
        await openRoomManagementDrawer(9, { laboratories: [], onRoomMutated });
        await flush();
        document.getElementById('room-mgmt-toggle')?.click();
        document.getElementById('room-mgmt-confirm-ok')?.click();
        await flush();

        expect(m.deactivateRoom).toHaveBeenCalledWith(9);
        expect(onRoomMutated).toHaveBeenCalled();
    });
});

describe('room management drawer — Foto tab', () => {
    const selectPhotos = (files: File[]): void => {
        const input = document.getElementById('room-photo-input') as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: files, configurable: true });
        input.dispatchEvent(new Event('change'));
    };

    it('uploads a photo, refreshes the list, and resets the upload control', async () => {
        m.uploadPhoto.mockResolvedValue({ id: 1 });
        m.listPhotos
            .mockResolvedValueOnce([])
            .mockResolvedValue([{ id: 1, thumb_url: '/api/rooms/9/photos/1/thumb', is_cover: true, sort_order: 1 }]);
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('foto');

        const file = new File([new Uint8Array([1])], 'f.jpg', { type: 'image/jpeg' });
        selectPhotos([file]);
        await flush();

        expect(m.uploadPhoto).toHaveBeenCalledWith(9, file);
        expect(m.toasts).toContain('1 foto berhasil diunggah.');
        // Regression: the button must reset (not stay "Mengunggah...") and re-enable.
        const label = document.querySelector('label[for="room-photo-input"]');
        expect(label?.textContent?.trim()).toBe('Unggah Foto');
        expect((document.getElementById('room-photo-input') as HTMLInputElement).disabled).toBe(false);
    });

    it('uploads multiple selected photos sequentially through the single endpoint', async () => {
        m.uploadPhoto.mockResolvedValue({ id: 1 });
        m.listPhotos.mockResolvedValue([]);
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('foto');

        const files = [
            new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
            new File([new Uint8Array([2])], 'b.png', { type: 'image/png' }),
            new File([new Uint8Array([3])], 'c.webp', { type: 'image/webp' }),
        ];
        selectPhotos(files);
        await flush();

        expect(m.uploadPhoto).toHaveBeenCalledTimes(3);
        expect(m.toasts).toContain('3 foto berhasil diunggah.');
    });

    it('rejects an invalid type before uploading and keeps the control usable', async () => {
        m.listPhotos.mockResolvedValue([]);
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('foto');

        selectPhotos([new File(['x'], 'notes.pdf', { type: 'application/pdf' })]);
        await flush();

        expect(m.uploadPhoto).not.toHaveBeenCalled();
        expect(m.toasts.some((t) => t.includes('format harus JPG, PNG, atau WebP'))).toBe(true);
        expect((document.getElementById('room-photo-input') as HTMLInputElement).disabled).toBe(false);
    });

    it('rejects a photo larger than 5 MB before uploading', async () => {
        m.listPhotos.mockResolvedValue([]);
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('foto');

        const big = new File(['x'], 'besar.jpg', { type: 'image/jpeg' });
        Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1, configurable: true });
        selectPhotos([big]);
        await flush();

        expect(m.uploadPhoto).not.toHaveBeenCalled();
        expect(m.toasts.some((t) => t.includes('melebihi 5 MB'))).toBe(true);
    });

    it('enforces the max photo cap and skips the overflow', async () => {
        // Seven existing photos → only one more slot; selecting two skips one.
        const existing = Array.from({ length: 7 }, (_, i) => ({
            id: i + 1, thumb_url: `/api/rooms/9/photos/${i + 1}/thumb`, is_cover: i === 0, sort_order: i + 1,
        }));
        m.uploadPhoto.mockResolvedValue({ id: 8 });
        m.listPhotos.mockResolvedValue(existing);
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('foto');

        selectPhotos([
            new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
            new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' }),
        ]);
        await flush();

        expect(m.uploadPhoto).toHaveBeenCalledTimes(1);
        expect(m.toasts.some((t) => t.includes('dilewati karena melebihi batas'))).toBe(true);
    });

    it('shows an empty state and hides upload when media management is denied', async () => {
        m.getRoom.mockResolvedValue(detail({ management_flags: flags({ can_manage_media: false }) }));
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('foto');

        expect(document.body.textContent).toContain('Foto ruangan belum tersedia.');
        expect(document.getElementById('room-photo-input')).toBeNull();
    });
});

describe('room management drawer — Fasilitas tab', () => {
    it('adds a facility row and saves the sync payload', async () => {
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('fasilitas');

        document.getElementById('room-facility-add')?.click();
        await flush();
        (document.querySelector('[data-facility-type="0"]') as HTMLSelectElement).value = '1';
        (document.querySelector('[data-facility-qty="0"]') as HTMLInputElement).value = '2';
        (document.querySelector('[data-facility-condition="0"]') as HTMLSelectElement).value = 'baik';
        document.getElementById('room-facility-save')?.click();
        await flush();

        expect(m.syncFacilities).toHaveBeenCalledWith(9, [
            { facility_type_id: 1, quantity: 2, condition: 'baik', notes: null },
        ]);
        expect(m.toasts).toContain('Fasilitas ruangan berhasil disimpan.');
    });

    it('shows accessible delegated review copy when facility save creates an acknowledgement', async () => {
        m.syncFacilities.mockResolvedValue({
            data: [{ facility_type_id: 1, name: 'Proyektor', slug: 'proyektor', quantity: 2, condition: 'baik', notes: null }],
            delegated_activity_acknowledgement: {
                outcome: 'created',
                id: 12,
                status: 'pending_review',
                effective_status: 'pending_review',
                acknowledgement_due_at: '2026-07-11T09:00:00+07:00',
                accountable_role: 'kepala_lab',
                accountable_user: { id: 4, name: 'Kepala Lab' },
                message: 'Perubahan fasilitas tersimpan dan menunggu peninjauan Kepala Lab.',
                reason: null,
            },
        });

        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('fasilitas');
        document.getElementById('room-facility-add')?.click();
        await flush();
        (document.querySelector('[data-facility-type="0"]') as HTMLSelectElement).value = '1';
        document.querySelector('[data-facility-type="0"]')?.dispatchEvent(new Event('change'));
        await flush();
        document.getElementById('room-facility-save')?.click();
        await flush();

        const panel = document.getElementById('room-facility-delegated-status');
        expect(panel?.getAttribute('role')).toBe('status');
        expect(panel?.getAttribute('aria-live')).toBe('polite');
        expect(panel?.textContent).toContain('Perubahan fasilitas tersimpan');
        expect(panel?.textContent).toContain('Aktivitas ini menunggu peninjauan Kepala Lab.');
        expect(document.getElementById('room-mgmt-confirm-root')).toBeNull();
        expect(document.getElementById('room-form-modal-root')).toBeNull();
    });

    it.each([
        ['existing', null, 'Aktivitas peninjauan sudah tercatat sebelumnya.'],
        ['skipped', 'no_active_kepala_lab', 'Belum ada Kepala Lab aktif untuk peninjauan otomatis.'],
        ['skipped', 'no_effective_change', 'Data fasilitas sudah sesuai, tidak ada aktivitas peninjauan baru.'],
    ] as const)('shows accurate delegated confirmation copy for %s %s', async (outcome, reason, bodyCopy) => {
        m.syncFacilities.mockResolvedValue({
            data: [{ facility_type_id: 1, name: 'Proyektor', slug: 'proyektor', quantity: 2, condition: 'baik', notes: null }],
            delegated_activity_acknowledgement: {
                outcome,
                id: outcome === 'existing' ? 12 : null,
                status: outcome === 'existing' ? 'pending_review' : null,
                effective_status: outcome === 'existing' ? 'pending_review' : null,
                acknowledgement_due_at: outcome === 'existing' ? '2026-07-11T09:00:00+07:00' : null,
                accountable_role: outcome === 'existing' ? 'kepala_lab' : null,
                accountable_user: outcome === 'existing' ? { id: 4, name: 'Kepala Lab' } : null,
                message: 'Perubahan fasilitas tersimpan.',
                reason,
            },
        });

        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('fasilitas');
        document.getElementById('room-facility-add')?.click();
        await flush();
        (document.querySelector('[data-facility-type="0"]') as HTMLSelectElement).value = '1';
        document.querySelector('[data-facility-type="0"]')?.dispatchEvent(new Event('change'));
        await flush();
        document.getElementById('room-facility-save')?.click();
        await flush();

        expect(document.getElementById('room-facility-delegated-status')?.textContent).toContain(bodyCopy);
    });

    it('does not show delegated review copy for not applicable or missing metadata responses', async () => {
        m.syncFacilities.mockResolvedValueOnce({
            data: [{ facility_type_id: 1, name: 'Proyektor', slug: 'proyektor', quantity: 2, condition: 'baik', notes: null }],
            delegated_activity_acknowledgement: {
                outcome: 'not_applicable',
                id: null,
                status: null,
                effective_status: null,
                acknowledgement_due_at: null,
                accountable_role: null,
                accountable_user: null,
                message: 'Perubahan fasilitas tersimpan.',
                reason: 'actor_not_laboran',
            },
        }).mockResolvedValueOnce({
            data: [{ facility_type_id: 1, name: 'Proyektor', slug: 'proyektor', quantity: 3, condition: 'baik', notes: null }],
        });

        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('fasilitas');
        document.getElementById('room-facility-add')?.click();
        await flush();
        (document.querySelector('[data-facility-type="0"]') as HTMLSelectElement).value = '1';
        document.querySelector('[data-facility-type="0"]')?.dispatchEvent(new Event('change'));
        await flush();
        document.getElementById('room-facility-save')?.click();
        await flush();

        const notApplicablePanel = document.getElementById('room-facility-delegated-status');
        expect(notApplicablePanel?.textContent).toContain('Perubahan fasilitas tersimpan');
        expect(notApplicablePanel?.textContent).not.toContain('menunggu peninjauan Kepala Lab');

        const qty = document.querySelector('[data-facility-qty="0"]') as HTMLInputElement;
        qty.value = '3';
        qty.dispatchEvent(new Event('change'));
        await flush();
        document.getElementById('room-facility-save')?.click();
        await flush();

        expect(document.getElementById('room-facility-delegated-status')).toBeNull();
        expect(m.toasts).toContain('Fasilitas ruangan berhasil disimpan.');
    });

    it('blocks saving a row without a facility type', async () => {
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('fasilitas');
        document.getElementById('room-facility-add')?.click();
        await flush();
        // Empty new row makes the tab dirty, so the save button is enabled.
        expect((document.getElementById('room-facility-save') as HTMLButtonElement).disabled).toBe(false);
        document.getElementById('room-facility-save')?.click();
        await flush();

        expect(m.syncFacilities).not.toHaveBeenCalled();
        expect(m.toasts).toContain('Lengkapi jenis fasilitas pada setiap baris.');
    });

    it('marks a persisted facility "Tersimpan" with the save button idle, and flips to unsaved on edit', async () => {
        m.getFacilities.mockResolvedValue([
            { facility_type_id: 1, name: 'Proyektor', slug: 'proyektor', quantity: 1, condition: 'baik', notes: null },
        ]);
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('fasilitas');

        // A persisted row shows "Tersimpan" and the save button is disabled (nothing dirty).
        expect(document.body.textContent).toContain('Tersimpan');
        expect(document.body.textContent).not.toContain('Belum disimpan');
        const save = document.getElementById('room-facility-save') as HTMLButtonElement;
        expect(save.disabled).toBe(true);
        expect(save.textContent?.trim()).toBe('Tersimpan');

        // Editing a field flips the row to "Belum disimpan" and enables save.
        const qty = document.querySelector('[data-facility-qty="0"]') as HTMLInputElement;
        qty.value = '5';
        qty.dispatchEvent(new Event('change'));
        await flush();

        expect(document.body.textContent).toContain('Belum disimpan');
        expect(document.body.textContent).toContain('Ada perubahan fasilitas yang belum disimpan.');
        const saveAfter = document.getElementById('room-facility-save') as HTMLButtonElement;
        expect(saveAfter.disabled).toBe(false);
        expect(saveAfter.textContent?.trim()).toBe('Simpan Perubahan');
    });

    it('disables an already-assigned facility type in other rows (no duplicate)', async () => {
        m.getFacilities.mockResolvedValue([
            { facility_type_id: 1, name: 'Proyektor', slug: 'proyektor', quantity: 1, condition: 'baik', notes: null },
        ]);
        m.listFacilityTypes.mockResolvedValue([
            { id: 1, name: 'Proyektor', slug: 'proyektor', is_predefined: true },
            { id: 2, name: 'Kursi', slug: 'kursi', is_predefined: true },
        ]);
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('fasilitas');
        document.getElementById('room-facility-add')?.click();
        await flush();

        // Row 1's dropdown must disable Proyektor (already used by row 0).
        const optionProyektorInRow1 = document.querySelector(
            '[data-facility-type="1"] option[value="1"]',
        ) as HTMLOptionElement;
        expect(optionProyektorInRow1.disabled).toBe(true);
        expect(optionProyektorInRow1.textContent).toContain('sudah dipilih');
    });
});

describe('room management drawer — Template tab', () => {
    it('uploads a template and lists versions with active badge', async () => {
        m.listTemplates
            .mockResolvedValueOnce([])
            .mockResolvedValue([{ id: 3, scope: 'classroom', version: 1, is_active: true, mime: 'application/pdf', original_name: 't.pdf' }]);
        m.uploadTemplate.mockResolvedValue({ id: 3 });
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('template');

        const input = document.getElementById('room-template-input') as HTMLInputElement;
        const file = new File(['%PDF'], 't.pdf', { type: 'application/pdf' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));
        document.getElementById('room-template-upload')?.click();
        await flush();

        expect(m.uploadTemplate).toHaveBeenCalledWith(9, file, '');
        expect(m.toasts).toContain('Template berhasil diunggah dan diaktifkan.');
        expect(document.body.textContent).toContain('Versi 1');
        expect(document.body.textContent).toContain('Aktif');
    });

    it('downloads a template version via the authenticated helper', async () => {
        m.listTemplates.mockResolvedValue([
            { id: 3, scope: 'classroom', version: 2, is_active: true, mime: 'application/pdf', original_name: 't.pdf' },
        ]);
        m.downloadTemplate.mockResolvedValue(undefined);
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('template');

        document.querySelector<HTMLButtonElement>('[data-template-download="3"]')?.click();
        await flush();
        expect(m.downloadTemplate).toHaveBeenCalledWith(
            { id: 9, code: 'HU-207' },
            expect.objectContaining({ id: 3, version: 2 }),
        );
    });

    it('shows a friendly empty state with no active template', async () => {
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('template');
        expect(document.body.textContent).toContain('Template belum tersedia untuk ruangan ini.');
    });
});

describe('room management drawer — Riwayat tab & lifecycle', () => {
    it('renders audit entries with human labels', async () => {
        m.listAudit.mockResolvedValue([
            { id: 1, subject_type: 'photo', action: 'uploaded', actor: 'Admin', details: 'Foto diunggah.', created_at: '2026-07-07T03:00:00+07:00' },
        ]);
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        await openTab('riwayat');

        expect(document.body.textContent).toContain('Foto · Diunggah');
        expect(document.body.textContent).toContain('Admin');
    });

    it('closes on Escape', async () => {
        await openRoomManagementDrawer(9, { laboratories: [] });
        await flush();
        expect(document.getElementById('room-management-drawer-root')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(document.getElementById('room-management-drawer-root')).toBeNull();
    });
});
