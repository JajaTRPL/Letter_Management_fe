import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import {
    getLetterStatusLabel,
    getLetterStatusTone,
    getLetterLabel,
    isMagangLetter,
    isAktifLetter,
    isProsesLuarNegeriLetter,
    isLegacyBeasiswaFallback
} from '../shared/letter-workflow';
import { renderScholarshipDetail } from './ScholarshipForm';
import { renderSuratPengantarMagangDetail } from './SuratPengantarMagangForm';
import { renderSuratKeteranganAktifDetail } from './SuratKeteranganAktifForm';
import { renderProsesLuarNegeriDetail } from './ProsesLuarNegeriForm';

const ENDPOINTS = [
    { type: 'surat-permohonan-beasiswa', url: '/api/mahasiswa/scholarship/applications' },
    { type: 'surat-pengantar-magang', url: '/api/mahasiswa/surat-pengantar-magang/applications' },
    { type: 'surat-keterangan-aktif', url: '/api/mahasiswa/surat-keterangan-aktif/applications' },
    { type: 'proses-luar-negeri', url: '/api/mahasiswa/proses-luar-negeri/applications' }
];

const actionButtonClass = 'text-primary-teal font-bold text-sm hover:underline';

const renderApplicationAction = (app: any): string => `
    <button data-action="view-detail" data-id="${app.id}" data-type="${app.letter_type}" class="${actionButtonClass}">Lihat Detail</button>
`;

const openDetailForApplication = (id: string, type?: string) => {
    if (!id) return;
    if (isMagangLetter(type)) {
        renderSuratPengantarMagangDetail(id, { origin: 'riwayat' });
    } else if (isAktifLetter(type)) {
        renderSuratKeteranganAktifDetail(id, { origin: 'riwayat' });
    } else if (isProsesLuarNegeriLetter(type)) {
        renderProsesLuarNegeriDetail(id, { origin: 'riwayat' });
    } else if (isLegacyBeasiswaFallback(type)) {
        renderScholarshipDetail(id, { origin: 'riwayat' });
    }
};

export const renderRiwayatPengajuan = async () => {
    let applications: any[] = [];

    try {
        const results = await Promise.allSettled(
            ENDPOINTS.map(endpoint =>
                apiFetch(endpoint.url, { cache: 'no-store' })
                    .then(res => res.ok ? res.json() : Promise.reject(res))
            )
        );

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.applications) {
                const type = ENDPOINTS[index].type;
                const apps = result.value.applications.map((app: any) => ({
                    ...app,
                    letter_type: app.letter_type || type
                }));
                applications = applications.concat(apps);
            }
        });

        // Sort by submitted_at desc, fallback to created_at desc
        applications.sort((a, b) => {
            const dateA = new Date(a.submitted_at || a.created_at).getTime();
            const dateB = new Date(b.submitted_at || b.created_at).getTime();
            return dateB - dateA;
        });
    } catch (e) {
        console.error("Failed to fetch applications", e);
    }

    let tableHtml = '';
    if (applications.length === 0) {
        tableHtml = `<tr><td colspan="4" class="px-8 py-8 text-center text-gray-500 font-medium">Belum ada riwayat pengajuan surat.</td></tr>`;
    } else {
        tableHtml = applications.map((app: any) => {
            const dateStr = new Date(app.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
            const statusText = getLetterStatusLabel(app.status, 'student-list');
            const statusClass = getLetterStatusTone(app.status, 'student-history');
            const label = app.scholarship_name || getLetterLabel(app.letter_type);

            return `
                <tr class="hover:bg-gray-50/50 transition-colors group cursor-pointer" data-row-action="view-detail" data-id="${app.id}" data-type="${app.letter_type}">
                    <td class="px-8 py-5 text-sm text-gray-500 font-medium">${dateStr}</td>
                    <td class="px-8 py-5 text-sm font-bold text-gray-800">${label}</td>
                    <td class="px-8 py-5">
                        <span class="${statusClass} px-4 py-1.5 rounded-full font-bold text-[11px] uppercase tracking-wider border">
                            ${statusText}
                        </span>
                    </td>
                    <td class="px-8 py-5 text-right">
                        ${renderApplicationAction(app)}
                    </td>
                </tr>
            `;
        }).join('');
    }

    const content = `
        <div class="space-y-6">
            <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left font-['Inter']">
                        <thead>
                            <tr class="bg-white border-b border-gray-50">
                                <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Tanggal Unggah</th>
                                <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Nama Dokumen</th>
                                <th class="px-8 py-5 text-[13px] font-bold text-gray-700">Status</th>
                                <th class="px-8 py-5 text-[13px] font-bold text-gray-700 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${tableHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Pagination -->
            <div class="flex items-center justify-between px-2">
                <p class="text-sm font-bold text-gray-700">Showing <span class="text-black">${applications.length > 0 ? 1 : 0} to ${applications.length}</span> of <span class="text-black">${applications.length}</span> results</p>
            </div>
        </div>
    `;

    renderDashboardLayout('Riwayat Pengajuan', content, 'mahasiswa', 'history');

    setTimeout(() => {
        document.querySelectorAll('[data-action="view-detail"]').forEach((button) => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = e.currentTarget as HTMLElement;
                const id = target.dataset.id;
                const type = target.dataset.type;
                if (id) openDetailForApplication(id, type);
            });
        });

        document.querySelectorAll('tr[data-row-action="view-detail"]').forEach((row) => {
            row.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button, a')) return;
                const current = e.currentTarget as HTMLElement;
                const id = current.dataset.id;
                const type = current.dataset.type;
                if (id) openDetailForApplication(id, type);
            });
        });
    }, 100);
};
