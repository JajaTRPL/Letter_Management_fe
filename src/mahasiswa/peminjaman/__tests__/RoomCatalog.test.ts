// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
}));

vi.mock('../../../shared/api-client', () => ({
    apiFetch: m.apiFetch,
}));

import {
    downloadRoomTemplate,
    fetchRoomPhotoObjectUrl,
    getPeminjamanRoomDetail,
    PeminjamanApiError,
} from '../api';
import {
    closeRoomCatalogDetail,
    openRoomCatalogDetail,
} from '../room-detail';
import type { RoomDetail } from '../types';

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

const jsonResponse = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const blobResponse = (): Response =>
    new Response(new Blob([new Uint8Array([0xff, 0xd8, 0xff]).buffer], { type: 'image/jpeg' }), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
    });

const detail = (overrides: Partial<RoomDetail> = {}): RoomDetail => ({
    id: 7,
    code: 'HU-207',
    name: 'Ruang Kuliah <img src=x onerror=unsafe()>',
    type: 'classroom',
    capacity: 60,
    location: 'Gedung Herman Yohanes',
    description: 'Ruang kuliah utama.',
    is_active: true,
    owning_laboratory: null,
    rules: 'Dilarang makan di dalam ruangan.',
    photos: [
        { id: 1, thumb_url: '/api/rooms/7/photos/1/thumb', display_url: '/api/rooms/7/photos/1/display', is_cover: true },
        { id: 2, thumb_url: '/api/rooms/7/photos/2/thumb', display_url: '/api/rooms/7/photos/2/display' },
    ],
    facilities: [
        { facility_type_id: 1, name: 'Proyektor', slug: 'proyektor', quantity: 1, condition: 'baik' },
        { facility_type_id: 2, name: 'Kursi', slug: 'kursi', quantity: 60, condition: 'perlu_perbaikan', notes: 'Beberapa goyang.' },
    ],
    template: {
        original_name: 'template-kelas.pdf',
        mime: 'application/pdf',
        size_bytes: 24_000,
        version: 3,
        download_url: '/api/mahasiswa/peminjaman-ruangan/rooms/7/template',
    },
    ...overrides,
});

let createdUrls: string[];
let revokedUrls: string[];

beforeEach(() => {
    document.body.innerHTML = '';
    createdUrls = [];
    revokedUrls = [];
    let counter = 0;
    URL.createObjectURL = vi.fn(() => {
        const url = `blob:room-${++counter}`;
        createdUrls.push(url);
        return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
        revokedUrls.push(url);
    });
    m.apiFetch.mockReset();
});

afterEach(() => {
    closeRoomCatalogDetail();
});

describe('room catalog detail drawer', () => {
    const mockDetailAndPhotos = (payload: RoomDetail = detail()): void => {
        m.apiFetch.mockImplementation(async (url: string) => {
            if (url.includes('/photos/')) return blobResponse();
            return jsonResponse({ message: 'ok', data: payload });
        });
    };

    it('renders photos, facilities, rules, and the template block', async () => {
        mockDetailAndPhotos();
        await openRoomCatalogDetail(7);
        await flush();

        expect(document.getElementById('room-detail-title')?.textContent)
            .toContain('HU-207');
        // Untrusted room name is escaped, never parsed as markup.
        expect(document.querySelector('#room-detail-title img')).toBeNull();

        expect(document.body.textContent).toContain('Kapasitas 60 orang');
        expect(document.body.textContent).toContain('Tata Tertib Ruangan');
        expect(document.body.textContent).toContain('Dilarang makan di dalam ruangan.');
        expect(document.body.textContent).toContain('Proyektor');
        expect(document.body.textContent).toContain('Perlu perbaikan');
        expect(document.body.textContent).toContain('template-kelas.pdf');
        expect(document.body.textContent).toContain('Versi 3');

        // Gallery loads through authenticated blob fetches of /api endpoints.
        await vi.waitFor(() => {
            expect(document.querySelector('#room-gallery-main img')).not.toBeNull();
        });
        const photoCalls = m.apiFetch.mock.calls
            .map(([url]) => url as string)
            .filter((url) => url.includes('/photos/'));
        expect(photoCalls.length).toBeGreaterThan(0);
        photoCalls.forEach((url) => expect(url.startsWith('/api/rooms/')).toBe(true));
        expect(document.body.innerHTML).not.toContain('/storage');
    });

    it('navigates the gallery via next/prev arrows, counter, and keyboard (2 photos)', async () => {
        mockDetailAndPhotos();
        await openRoomCatalogDetail(7);
        await flush();
        await vi.waitFor(() => {
            expect(document.querySelector('#room-gallery-main img')).not.toBeNull();
        });

        // Multi-photo controls are present with a starting counter of 1/2.
        expect(document.querySelector('[data-gallery-prev]')).not.toBeNull();
        expect(document.querySelector('[data-gallery-next]')).not.toBeNull();
        expect(document.querySelector('[data-gallery-counter]')?.textContent).toBe('1/2');

        // Next advances to photo 2 and loads its display variant.
        document.querySelector<HTMLElement>('[data-gallery-next]')?.click();
        await vi.waitFor(() => {
            expect(document.querySelector('[data-gallery-counter]')?.textContent).toBe('2/2');
        });
        expect(m.apiFetch.mock.calls.some(([url]) => url === '/api/rooms/7/photos/2/display')).toBe(true);

        // Keyboard ArrowLeft on the viewport wraps back to photo 1.
        const viewport = document.querySelector<HTMLElement>('[data-gallery-viewport]');
        viewport?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        await vi.waitFor(() => {
            expect(document.querySelector('[data-gallery-counter]')?.textContent).toBe('1/2');
        });
    });

    it('shows friendly empty states without photos, facilities, or template', async () => {
        mockDetailAndPhotos(detail({ photos: [], facilities: [], template: null }));
        await openRoomCatalogDetail(7);
        await flush();

        expect(document.body.textContent).toContain('Foto ruangan belum tersedia');
        expect(document.body.textContent).toContain('Fasilitas belum dicatat untuk ruangan ini.');
        expect(document.body.textContent).toContain('Template belum tersedia untuk ruangan ini.');
    });

    it('hands the room to the booking flow via Ajukan Peminjaman and closes', async () => {
        mockDetailAndPhotos();
        const onApply = vi.fn();
        await openRoomCatalogDetail(7, { onApply });
        await flush();

        document.getElementById('room-detail-apply')?.click();

        expect(onApply).toHaveBeenCalledWith(7);
        expect(document.getElementById('peminjaman-room-detail-root')).toBeNull();
    });

    it('closes on Escape and revokes every created object URL', async () => {
        mockDetailAndPhotos();
        await openRoomCatalogDetail(7);
        await vi.waitFor(() => {
            expect(createdUrls.length).toBeGreaterThan(0);
        });

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(document.getElementById('peminjaman-room-detail-root')).toBeNull();
        expect(revokedUrls.sort()).toEqual([...createdUrls].sort());
    });

    it('renders a retryable error state when the detail fails to load', async () => {
        m.apiFetch.mockResolvedValue(jsonResponse({ message: 'Ruangan tidak ditemukan.' }, 404));
        await openRoomCatalogDetail(7);
        await flush();

        expect(document.body.textContent).toContain('Detail ruangan belum dapat dimuat');
        expect(document.body.textContent).toContain('Ruangan tidak ditemukan.');
        expect(document.getElementById('room-detail-retry')).not.toBeNull();
    });

    it('shows a human template download error inside the block', async () => {
        mockDetailAndPhotos();
        await openRoomCatalogDetail(7);
        await flush();

        m.apiFetch.mockResolvedValue(jsonResponse({ message: 'x' }, 500));
        document.getElementById('room-template-download')?.click();
        await flush();

        expect(document.body.textContent).toContain('Template peminjaman gagal diunduh.');
    });
});

describe('room catalog API helpers', () => {
    it('fetches room detail from the catalog endpoint', async () => {
        m.apiFetch.mockResolvedValue(jsonResponse({ message: 'ok', data: detail() }));
        await getPeminjamanRoomDetail(7);
        expect(m.apiFetch).toHaveBeenCalledWith('/api/mahasiswa/peminjaman-ruangan/rooms/7');
    });

    it('rejects photo URLs that are not relative /api endpoints', async () => {
        await expect(fetchRoomPhotoObjectUrl('https://evil.example/storage/foto.jpg'))
            .rejects.toBeInstanceOf(PeminjamanApiError);
        await expect(fetchRoomPhotoObjectUrl('/storage/room.jpg'))
            .rejects.toBeInstanceOf(PeminjamanApiError);
        expect(m.apiFetch).not.toHaveBeenCalled();
    });

    it('downloads the template as an authenticated blob with a local safe filename', async () => {
        m.apiFetch.mockResolvedValue(new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' })));
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const openSpy = vi.spyOn(window, 'open');

        await downloadRoomTemplate(
            { id: 7, code: 'HU 207/X' },
            { mime: 'application/pdf' },
        );

        expect(m.apiFetch).toHaveBeenCalledWith(
            '/api/mahasiswa/peminjaman-ruangan/rooms/7/template',
            { cache: 'no-store' },
        );
        expect(openSpy).not.toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        // Object URL is revoked right after the browser save is triggered.
        expect(revokedUrls).toEqual(createdUrls);
        clickSpy.mockRestore();
        openSpy.mockRestore();
    });

    it('maps a missing template to friendly Indonesian copy', async () => {
        m.apiFetch.mockResolvedValue(jsonResponse({ message: 'x' }, 404));
        await expect(downloadRoomTemplate({ id: 7, code: 'HU207' }, null))
            .rejects.toThrow('Template peminjaman belum tersedia untuk ruangan ini.');
    });
});
