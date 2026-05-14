import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { apiFetch } from '../shared/api-client';
import {
    canCompleteSubmission,
    canDownloadDocument,
    getLetterStatusLabel,
    getLetterStatusTone,
    isStudentReviewStage,
    getLetterLabel,
    isMagangLetter,
    isAktifLetter,
    isProsesLuarNegeriLetter,
    isLegacyBeasiswaFallback
} from '../shared/letter-workflow';
import { renderSuratPengantarMagangDetail } from './SuratPengantarMagangForm';
import { renderSuratKeteranganAktifDetail } from './SuratKeteranganAktifForm';
import { renderProsesLuarNegeriDetail } from './ProsesLuarNegeriForm';
import Toastify from 'toastify-js';

const ENDPOINTS = [
    { type: 'surat-permohonan-beasiswa', url: '/api/mahasiswa/scholarship/applications' },
    { type: 'surat-pengantar-magang', url: '/api/mahasiswa/surat-pengantar-magang/applications' },
    { type: 'surat-keterangan-aktif', url: '/api/mahasiswa/surat-keterangan-aktif/applications' },
    { type: 'proses-luar-negeri', url: '/api/mahasiswa/proses-luar-negeri/applications' }
];

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
                <tr class="hover:bg-gray-50/50 transition-colors group">
                    <td class="px-8 py-5 text-sm text-gray-500 font-medium">${dateStr}</td>
                    <td class="px-8 py-5 text-sm font-bold text-gray-800">${label}</td>
                    <td class="px-8 py-5">
                        <span class="${statusClass} px-4 py-1.5 rounded-full font-bold text-[11px] uppercase tracking-wider border">
                            ${statusText}
                        </span>
                    </td>
                    <td class="px-8 py-5 text-right">
                        ${isLegacyBeasiswaFallback(app.letter_type) ? `
                            ${isStudentReviewStage(app.status) ? `
                                <div class="flex justify-end gap-3">
                                    <button data-action="preview-document" data-id="${app.id}" data-type="${app.letter_type}" class="text-primary-teal font-bold text-sm hover:underline">Review Dokumen</button>
                                    ${canCompleteSubmission(app.status) ? `<button data-action="complete-review" data-id="${app.id}" data-type="${app.letter_type}" class="text-emerald-600 font-bold text-sm hover:underline">Selesaikan</button>` : ''}
                                </div>
                            ` : canDownloadDocument(app.status) ?
                                `<button data-action="download-document" data-id="${app.id}" data-type="${app.letter_type}" class="text-primary-teal font-bold text-sm hover:underline">Download Dokumen</button>`
                                : `<span class="text-gray-400 text-sm">Menunggu</span>`}
                        ` : `
                            <button data-action="view-detail" data-id="${app.id}" data-type="${app.letter_type}" class="text-primary-teal font-bold text-sm hover:underline">Lihat Detail</button>
                        `}
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
        document.querySelectorAll('[data-action="preview-document"]').forEach((button) => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const id = target.dataset.id;
                const type = target.dataset.type;
                if (id) previewDocument(id, type);
            });
        });

        document.querySelectorAll('[data-action="complete-review"]').forEach((button) => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const id = target.dataset.id;
                const type = target.dataset.type;
                if (id) completeReview(id, type);
            });
        });

        document.querySelectorAll('[data-action="download-document"]').forEach((button) => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const id = target.dataset.id;
                const type = target.dataset.type;
                if (id) downloadDocument(id, type);
            });
        });
        document.querySelectorAll('[data-action="view-detail"]').forEach((button) => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const id = target.dataset.id;
                const type = target.dataset.type;
                if (!id) return;

                if (isMagangLetter(type)) {
                    renderSuratPengantarMagangDetail(id);
                } else if (isAktifLetter(type)) {
                    renderSuratKeteranganAktifDetail(id);
                } else if (isProsesLuarNegeriLetter(type)) {
                    renderProsesLuarNegeriDetail(id);
                }
            });
        });
    }, 100);
};

const showToast = (text: string, success = true) => {
    Toastify({
        text,
        duration: 3500,
        style: { background: success ? '#10B981' : '#EF4444' }
    }).showToast();
};

const getApiPrefix = (letterType?: string) => {
    if (isMagangLetter(letterType)) return '/api/mahasiswa/surat-pengantar-magang';
    if (isAktifLetter(letterType)) return '/api/mahasiswa/surat-keterangan-aktif';
    if (isProsesLuarNegeriLetter(letterType)) return '/api/mahasiswa/proses-luar-negeri';
    return '/api/mahasiswa/scholarship';
};

const getFileName = (applicationId: string, letterType?: string) => {
    if (isMagangLetter(letterType)) return `Surat_Pengantar_Magang_${applicationId}.pdf`;
    if (isAktifLetter(letterType)) return `Surat_Keterangan_Aktif_${applicationId}.pdf`;
    if (isProsesLuarNegeriLetter(letterType)) return `Proses_Luar_Negeri_${applicationId}.pdf`;
    return `Surat_Permohonan_Beasiswa_${applicationId}.docx`;
};

const fetchDocument = async (applicationId: string, letterType?: string): Promise<Blob> => {
    const prefix = getApiPrefix(letterType);
    const res = await apiFetch(`${prefix}/${applicationId}/preview`, { cache: 'no-store' });

    if (!res.ok) {
        let message = 'Dokumen belum dapat diakses.';
        try {
            const data = await res.json();
            message = data.message || message;
        } catch {}
        throw new Error(message);
    }

    return res.blob();
};

const previewDocument = async (applicationId: string, letterType?: string) => {
    const previewWindow = window.open('', '_blank');
    try {
        const blob = await fetchDocument(applicationId, letterType);
        const url = URL.createObjectURL(blob);
        if (previewWindow) {
            previewWindow.location.href = url;
        } else {
            window.open(url, '_blank');
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error: any) {
        if (previewWindow) previewWindow.close();
        showToast(error?.message || 'Gagal membuka dokumen.', false);
    }
};

const downloadDocument = async (applicationId: string, letterType?: string) => {
    try {
        const blob = await fetchDocument(applicationId, letterType);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getFileName(applicationId, letterType);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error: any) {
        showToast(error?.message || 'Gagal mengunduh dokumen.', false);
    }
};

const completeReview = async (applicationId: string, letterType?: string) => {
    const prefix = getApiPrefix(letterType);
    try {
        const res = await apiFetch(`${prefix}/${applicationId}/complete`, { method: 'POST' });

        if (!res.ok) {
            let message = 'Pengajuan belum dapat diselesaikan.';
            try {
                const data = await res.json();
                message = data.message || message;
            } catch {}
            throw new Error(message);
        }

        showToast('Pengajuan berhasil diselesaikan.');
        renderRiwayatPengajuan();
    } catch (error: any) {
        showToast(error?.message || 'Gagal menyelesaikan pengajuan.', false);
    }
};
