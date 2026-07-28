// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    loadMahasiswaApplications: vi.fn(
        async (): Promise<{
            items: Array<{ raw: Record<string, unknown> }>;
            failedEndpointCount: number;
        }> => ({ items: [], failedEndpointCount: 0 }),
    ),
    renderProfilMahasiswa: vi.fn(),
}));

vi.mock('../dashboard/DashboardLayout', () => ({
    renderDashboardLayout: vi.fn((_title: string, content: string) => {
        document.body.innerHTML = content;
    }),
}));
vi.mock('../mahasiswa/ProfilMahasiswa', () => ({ renderProfilMahasiswa: m.renderProfilMahasiswa }));
vi.mock('../mahasiswa/ScholarshipForm', () => ({ renderScholarshipDetail: vi.fn(), renderScholarshipForm: vi.fn() }));
vi.mock('../mahasiswa/SuratPengantarMagangForm', () => ({ renderSuratPengantarMagangDetail: vi.fn() }));
vi.mock('../mahasiswa/SuratKeteranganAktifForm', () => ({ renderSuratKeteranganAktifDetail: vi.fn() }));
vi.mock('../mahasiswa/ProsesLuarNegeriForm', () => ({ renderProsesLuarNegeriDetail: vi.fn() }));
vi.mock('../mahasiswa/SuratTugasForm', () => ({ renderSuratTugasDetail: vi.fn() }));
vi.mock('../shared/api-client', () => ({
    apiFetch: m.apiFetch,
    loadProtectedImageObjectUrl: vi.fn(async () => null),
    revokeProtectedImageObjectUrl: vi.fn(),
}));
vi.mock('../shared/mahasiswa-application-list', () => ({
    loadMahasiswaApplications: m.loadMahasiswaApplications,
}));
vi.mock('toastify-js', () => ({ default: vi.fn(() => ({ showToast: vi.fn() })) }));

import { renderMahasiswaDashboard } from '../dashboard/MahasiswaDashboard';

const BOOKING_ERROR_COPY = 'Data peminjaman ruangan gagal dimuat. Coba refresh halaman.';
const BOOKINGS_URL = '/api/mahasiswa/peminjaman-ruangan/requests';

const response = (body: unknown, ok = true, status = 200): Response => ({
    ok,
    status,
    json: async () => body,
} as Response);

const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    await Promise.resolve();
};

const letterItem = {
    raw: {
        id: 1,
        letter_type: 'surat-keterangan-aktif',
        status: 'Submitted',
        created_at: '2026-07-10T09:00:00+07:00',
        submitted_at: '2026-07-10T09:00:00+07:00',
    },
};

const mockApi = (bookingsBody: unknown, bookingsOk = true, bookingsStatus = 200): void => {
    m.apiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/profile') {
            return response({ completeness: { is_complete: true, percentage: 100 }, profile: {} });
        }
        if (url === BOOKINGS_URL) {
            return response(bookingsBody, bookingsOk, bookingsStatus);
        }
        return response({ message: 'ok', data: [] });
    });
};

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    m.apiFetch.mockReset();
    m.loadMahasiswaApplications.mockClear();
    m.loadMahasiswaApplications.mockResolvedValue({ items: [], failedEndpointCount: 0 });
});

describe('Mahasiswa dashboard booking-failure resilience', () => {
    it('a 500 booking response shows the accessible error banner, not a fake empty list', async () => {
        mockApi({ message: 'Server error' }, false, 500);
        m.loadMahasiswaApplications.mockResolvedValue({
            items: [letterItem],
            failedEndpointCount: 0,
        });

        await renderMahasiswaDashboard();
        await settle();

        const banner = Array.from(document.querySelectorAll('[role="alert"]'))
            .find((node) => node.textContent?.includes(BOOKING_ERROR_COPY));
        expect(banner).toBeTruthy();
        // Failure is not presented as the booking empty state.
        expect(document.body.textContent).not.toContain('Tidak ada pengajuan aktif');
        // Letter data stays fully usable next to the failed booking section.
        expect(document.body.textContent).toContain('Surat Keterangan Aktif');
    });

    it('a malformed 200 booking body is treated as failure, never crashes, letters stay usable', async () => {
        // Envelope without `data`: previously crashed .filter() on undefined.
        mockApi({});
        m.loadMahasiswaApplications.mockResolvedValue({
            items: [letterItem],
            failedEndpointCount: 0,
        });

        await renderMahasiswaDashboard();
        await settle();

        expect(document.body.textContent).toContain(BOOKING_ERROR_COPY);
        expect(document.body.textContent).toContain('Surat Keterangan Aktif');
        expect(document.body.textContent).not.toContain('Tidak ada pengajuan aktif');
    });

    it('an empty booking array is empty — not an error', async () => {
        mockApi({ message: 'ok', data: [] });

        await renderMahasiswaDashboard();
        await settle();

        expect(document.body.textContent).not.toContain(BOOKING_ERROR_COPY);
    });

    it('a successful booking payload renders the tracking card after a prior failure (refresh path)', async () => {
        // First render: failure.
        mockApi({ message: 'Server error' }, false, 500);
        await renderMahasiswaDashboard();
        await settle();
        expect(document.body.textContent).toContain(BOOKING_ERROR_COPY);

        // Re-render (the banner's documented recovery: refresh) now succeeds.
        mockApi({
            message: 'ok',
            data: [{
                id: 9,
                room: {
                    id: 2,
                    code: 'KLS-2',
                    name: 'Ruang 2',
                    type: 'classroom',
                    capacity: 30,
                    location: 'Gedung A',
                    description: null,
                    is_active: true,
                    owning_laboratory: null,
                },
                activity_name: 'Rapat',
                purpose: 'Koordinasi',
                participant_count: 5,
                start_at: '2099-06-20T10:00:00+07:00',
                end_at: '2099-06-20T12:00:00+07:00',
                status: 'submitted',
                reviewer: null,
                reviewed_at: null,
                revision_note: null,
                rejection_reason: null,
                cancellation_reason: null,
                created_at: '2026-07-10T09:00:00+07:00',
                updated_at: '2026-07-10T09:00:00+07:00',
            }],
        });
        await renderMahasiswaDashboard();
        await settle();

        expect(document.body.textContent).not.toContain(BOOKING_ERROR_COPY);
        expect(document.body.textContent).toContain('KLS-2');
    });
});
