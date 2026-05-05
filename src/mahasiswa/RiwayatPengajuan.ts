import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import {
    canCompleteSubmission,
    canDownloadDocument,
    getLetterStatusLabel,
    getLetterStatusTone,
    isStudentReviewStage,
} from '../shared/letter-workflow';
import Toastify from 'toastify-js';

export const renderRiwayatPengajuan = async () => {
    // Show loading state or fetch before rendering
    const token = localStorage.getItem('auth_token');
    let applications: any[] = [];
    
    try {
        const res = await fetch('/api/mahasiswa/scholarship/applications', {
            headers: { 'Authorization': 'Bearer ' + token },
            cache: 'no-store'
        });
        if (res.ok) {
            const data = await res.json();
            applications = data.applications || [];
        }
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

            return `
                <tr class="hover:bg-gray-50/50 transition-colors group">
                    <td class="px-8 py-5 text-sm text-gray-500 font-medium">${dateStr}</td>
                    <td class="px-8 py-5 text-sm font-bold text-gray-800">${app.scholarship_name || 'Surat Permohonan Beasiswa'}</td>
                    <td class="px-8 py-5">
                        <span class="${statusClass} px-4 py-1.5 rounded-full font-bold text-[11px] uppercase tracking-wider border">
                            ${statusText}
                        </span>
                    </td>
                    <td class="px-8 py-5 text-right">
                        ${isStudentReviewStage(app.status) ? `
                            <div class="flex justify-end gap-3">
                                <button data-action="preview-scholarship-document" data-id="${app.id}" class="text-primary-teal font-bold text-sm hover:underline">Review Dokumen</button>
                                ${canCompleteSubmission(app.status) ? `<button data-action="complete-scholarship-review" data-id="${app.id}" class="text-emerald-600 font-bold text-sm hover:underline">Selesaikan</button>` : ''}
                            </div>
                        ` : canDownloadDocument(app.status) ?
                            `<button data-action="download-scholarship-document" data-id="${app.id}" class="text-primary-teal font-bold text-sm hover:underline">Download Dokumen</button>` 
                            : `<span class="text-gray-400 text-sm">Menunggu</span>`}
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
        document.querySelectorAll('[data-action="preview-scholarship-document"]').forEach((button) => {
            button.addEventListener('click', () => {
                const id = (button as HTMLElement).dataset.id;
                if (id) previewScholarshipDocument(id);
            });
        });

        document.querySelectorAll('[data-action="complete-scholarship-review"]').forEach((button) => {
            button.addEventListener('click', () => {
                const id = (button as HTMLElement).dataset.id;
                if (id) completeScholarshipReview(id);
            });
        });

        document.querySelectorAll('[data-action="download-scholarship-document"]').forEach((button) => {
            button.addEventListener('click', () => {
                const id = (button as HTMLElement).dataset.id;
                if (id) downloadScholarshipDocument(id);
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

const fetchScholarshipDocument = async (applicationId: string): Promise<Blob> => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`/api/mahasiswa/scholarship/${applicationId}/preview`, {
        headers: { 'Authorization': 'Bearer ' + token },
        cache: 'no-store'
    });

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

const previewScholarshipDocument = async (applicationId: string) => {
    const previewWindow = window.open('', '_blank');
    try {
        const blob = await fetchScholarshipDocument(applicationId);
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

const downloadScholarshipDocument = async (applicationId: string) => {
    try {
        const blob = await fetchScholarshipDocument(applicationId);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Surat_Permohonan_Beasiswa_${applicationId}.docx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error: any) {
        showToast(error?.message || 'Gagal mengunduh dokumen.', false);
    }
};

const completeScholarshipReview = async (applicationId: string) => {
    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch(`/api/mahasiswa/scholarship/${applicationId}/complete`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });

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
