import { renderDashboardLayout } from './DashboardLayout';
import { renderProfilMahasiswa } from '../mahasiswa/ProfilMahasiswa';
import { renderScholarshipDetail, renderScholarshipForm } from '../mahasiswa/ScholarshipForm';
import { renderSuratPengantarMagangDetail } from '../mahasiswa/SuratPengantarMagangForm';
import { renderSuratKeteranganAktifDetail } from '../mahasiswa/SuratKeteranganAktifForm';
import { renderProsesLuarNegeriDetail } from '../mahasiswa/ProsesLuarNegeriForm';
import { renderSuratTugasDetail } from '../mahasiswa/SuratTugasForm';
import { getGreetingName } from '../utils/nameHelper';
import {
    canCompleteSubmission,
    getLetterLabel,
    getLetterStatusLabel,
    getLetterStatusTone,
    isAktifLetter,
    isLegacyBeasiswaFallback,
    isMagangLetter,
    isProsesLuarNegeriLetter,
    isSuratTugasLetter,
    LETTER_WORKFLOW_STATUS,
} from '../shared/letter-workflow';
import Toastify from 'toastify-js';
import { apiFetch, loadProtectedImageObjectUrl, revokeProtectedImageObjectUrl } from '../shared/api-client';
import { MAHASISWA_LETTER_ENDPOINTS, mahasiswaEndpointPrefixFor } from '../shared/letter-registry';
import { loadMahasiswaApplications } from '../shared/mahasiswa-application-list';

// Endpoint identity is centralized in the shared letter registry so the
// dashboard, Riwayat, and the /complete resolver stay in lockstep. There is no
// backend `/api/mahasiswa/dashboard` aggregate endpoint, so we Promise.allSettled
// the per-type list endpoints and tag each row with letter_type for downstream
// dispatch (detail navigation, label rendering).

const openLetterDetailForType = (id: string, letterType?: string): void => {
    if (!id) return;
    if (isMagangLetter(letterType)) {
        renderSuratPengantarMagangDetail(id, { origin: 'riwayat' });
    } else if (isAktifLetter(letterType)) {
        renderSuratKeteranganAktifDetail(id, { origin: 'riwayat' });
    } else if (isProsesLuarNegeriLetter(letterType)) {
        renderProsesLuarNegeriDetail(id, { origin: 'riwayat' });
    } else if (isSuratTugasLetter(letterType)) {
        renderSuratTugasDetail(id, { origin: 'riwayat' });
    } else if (isLegacyBeasiswaFallback(letterType)) {
        renderScholarshipDetail(id, { origin: 'riwayat' });
    }
};

let mahasiswaDashboardAvatarObjectUrl: string | null = null;

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// ──────────────────────────────────────────────────────────────────────────
// Global Pengajuan tracking adapter.
//
// The Mahasiswa dashboard aggregates submissions across multiple letter types
// (Beasiswa, SKA, PLN, Magang today; Peminjaman Kelas/Lab in a future phase
// once those backend endpoints exist). Count cards, Recent Riwayat, and
// Active Tracking must all read from the same normalized model so a row that
// is "active" in one section is "active" in every section.
//
// `toTrackingItem` is the normalization point. Adding a new request type
// later means: tag the row with `letter_type` at fetch time, ensure
// `openLetterDetailForType` knows how to route it, and (only if you want a
// Beasiswa-style rich timeline for it) extend the renderer dispatch below.
// The generic card already handles every non-Beasiswa type today.
//
// CTAs are kept type-safe: complete/fix-revision wire to Scholarship-specific
// endpoints and stay Beasiswa-only. Other types get "Lihat Detail" only; the
// detail page owns type-specific next actions.
// ──────────────────────────────────────────────────────────────────────────

interface TrackingItem {
    id: string;
    rawLetterType: string;
    label: string;
    status: string;
    statusLabel: string;
    statusTone: string;
    submittedAt: string | null;
    createdAt: string | null;
    revisionNote: string | null;
    raw: any;
    isBeasiswa: boolean;
    canComplete: boolean;
    canFixRevision: boolean;
}

const toTrackingItem = (app: any): TrackingItem => {
    const rawLetterType = app?.letter_type || '';
    const isBeasiswa = isLegacyBeasiswaFallback(rawLetterType);
    const status = String(app?.status ?? '');
    return {
        id: String(app?.id ?? ''),
        rawLetterType,
        label: app?.scholarship_name || getLetterLabel(rawLetterType),
        status,
        statusLabel: getLetterStatusLabel(status, 'student-list'),
        statusTone: getLetterStatusTone(status, 'student-dashboard'),
        submittedAt: app?.submitted_at ?? null,
        createdAt: app?.created_at ?? null,
        revisionNote: app?.revision_note ?? null,
        raw: app,
        isBeasiswa,
        // Ready_For_Student_Review → "Selesaikan Pengajuan" for EVERY letter
        // type (Beasiswa/SKA/PLN/Magang), each wired to its own /complete
        // endpoint via completeLetterReview(). Previously restricted to Beasiswa.
        canComplete: canCompleteSubmission(status),
        // Direct dashboard fix-revision shortcut stays Beasiswa-only (it opens
        // the Beasiswa form). Other types surface the revision note + "Lihat
        // Detail", and fix from the detail page's "Perbaiki Pengajuan".
        canFixRevision: isBeasiswa && status === LETTER_WORKFLOW_STATUS.REVISION,
    };
};

// Shared workflow progress timeline. Six nodes reflecting the actual
// administrative letter workflow, identical across all four letter types
// (Beasiswa/SKA/PLN/Magang):
//   Diajukan → Tendik → Prodi → Departemen → Tinjau Dokumen → Selesai
// Driven purely by `status`. `Ready_For_Student_Review` gets its own
// "Tinjau Dokumen" node (it's still actionable — the student must review and
// click "Selesaikan Pengajuan") and is NOT collapsed into "Selesai".
type TimelineNodeKind = 'completed' | 'active' | 'pending' | 'interrupt';

const renderTimelineNode = (kind: TimelineNodeKind, label: string): string => {
    const circle =
        kind === 'completed' ? `
            <div class="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>`
        : kind === 'active' ? `
            <div class="w-9 h-9 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm animate-pulse">
                <div class="w-3 h-3 bg-amber-500 rounded-full"></div>
            </div>`
        : kind === 'interrupt' ? `
            <div class="w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center border-4 border-white shadow-md">
                <div class="w-3 h-3 bg-white rounded-full"></div>
            </div>`
        : `
            <div class="w-9 h-9 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center border-4 border-white"></div>`;

    const labelColor =
        kind === 'active' ? 'text-amber-600'
        : kind === 'interrupt' ? 'text-red-600'
        : kind === 'pending' ? 'text-gray-400'
        : 'text-gray-600';

    const containerOpacity = kind === 'pending' ? ' opacity-30' : '';

    return `
        <div class="relative z-10 flex flex-col items-center gap-2${containerOpacity}">
            ${circle}
            <span class="text-[9px] font-bold ${labelColor} text-center leading-tight">${label}</span>
        </div>
    `;
};

const renderWorkflowTimeline = (status: string): string => {
    const {
        SUBMITTED, APPROVED_TENDIK, APPROVED_KAPRODI,
        READY_FOR_STUDENT_REVIEW, COMPLETED, REVISION, REJECTED,
    } = LETTER_WORKFLOW_STATUS;

    const STAGE_LABELS = ['Diajukan', 'Tendik', 'Prodi', 'Departemen', 'Tinjau<br>Dokumen', 'Selesai'];

    // `completedThrough` = highest index rendered as completed (emerald).
    // `activeIndex` = the in-progress node (amber), or -1 when none.
    // `interrupt` swaps the active node for a red Revisi/Ditolak marker.
    let completedThrough = 0; // "Diajukan" is always done for any active card
    let activeIndex = 1;
    let interrupt: 'revision' | 'rejected' | null = null;

    switch (status) {
        case SUBMITTED:                 completedThrough = 0; activeIndex = 1; break;
        case APPROVED_TENDIK:           completedThrough = 1; activeIndex = 2; break;
        case APPROVED_KAPRODI:          completedThrough = 2; activeIndex = 3; break;
        case READY_FOR_STUDENT_REVIEW:  completedThrough = 3; activeIndex = 4; break;
        case COMPLETED:                 completedThrough = 5; activeIndex = -1; break;
        case REVISION:                  completedThrough = 0; activeIndex = 1; interrupt = 'revision'; break;
        case REJECTED:                  completedThrough = 0; activeIndex = 1; interrupt = 'rejected'; break;
        default:                        completedThrough = 0; activeIndex = 1; break;
    }

    const nodes = STAGE_LABELS.map((label, i) => {
        if (interrupt && i === activeIndex) {
            return renderTimelineNode('interrupt', interrupt === 'revision' ? 'Revisi' : 'Ditolak');
        }
        if (i <= completedThrough) return renderTimelineNode('completed', label);
        if (i === activeIndex)      return renderTimelineNode('active', label);
        return renderTimelineNode('pending', label);
    }).join('');

    return `
        <div class="relative flex justify-between items-start mb-8 px-1">
            <div class="absolute top-[18px] left-[8%] right-[8%] h-0.5 border-t-2 border-dashed border-gray-200 -z-0"></div>
            ${nodes}
        </div>
    `;
};

// Short human description of the current active stage, aligned to the six-node
// timeline wording above. Used to add a sentence of context to the card.
// Returns '' for statuses with no safe description so the caller can hide it.
const getActiveStageDescription = (status: string): string => {
    const {
        SUBMITTED, APPROVED_TENDIK, APPROVED_KAPRODI,
        READY_FOR_STUDENT_REVIEW, COMPLETED, REVISION, REJECTED,
    } = LETTER_WORKFLOW_STATUS;
    switch (status) {
        case SUBMITTED:
            return 'Sedang diverifikasi oleh Tendik.';
        case APPROVED_TENDIK:
            return 'Menunggu persetujuan Prodi.';
        case APPROVED_KAPRODI:
            return 'Menunggu persetujuan Departemen.';
        case READY_FOR_STUDENT_REVIEW:
            return 'Dokumen siap ditinjau oleh mahasiswa.';
        case COMPLETED:
            return 'Pengajuan telah selesai.';
        case REVISION:
            return 'Terdapat catatan revisi yang perlu Anda perbaiki.';
        case REJECTED:
            return 'Pengajuan ditolak.';
        default:
            return '';
    }
};

// ── Shared visual contract for every active tracking card ──────────────────
// One shell + shared partials so Beasiswa / SKA / PLN / Magang are visually
// identical: same header, timeline, meta row, body spacing, and CTA styling.
// Only the *action set* legitimately differs — Beasiswa keeps its extra
// state-specific actions (Selesaikan Pengajuan / Perbaiki Revisi), but they
// render through the same button-style constants as everything else.

// Primary "Lihat Detail" CTA: white/outline teal (the Beasiswa style, now
// global). Filled-teal and red are reserved for the Beasiswa-only secondary
// actions that already existed.
const TRACKING_CTA_OUTLINE = "w-full py-3 bg-white text-primary-teal rounded-xl font-bold border border-primary-teal hover:bg-teal-50 transition-colors shadow-sm";
const TRACKING_CTA_PRIMARY = "w-full py-3 bg-primary-teal text-white rounded-xl font-bold hover:bg-teal-800 transition-colors shadow-sm";
const TRACKING_CTA_DANGER = "w-full py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center gap-2";

const renderTrackingMetaRow = (item: TrackingItem): string => {
    // Tanggal diajukan: prefer submitted_at, fall back to created_at. When
    // neither is present, hide the date chip rather than show a placeholder.
    const submittedSource = item.submittedAt || item.createdAt;
    const submittedDateStr = submittedSource
        ? new Date(submittedSource).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
        : '';
    const submittedChip = submittedDateStr
        ? `<span class="text-xs text-gray-500">Diajukan ${escapeHtml(submittedDateStr)}</span>`
        : '';
    return `
        <div class="flex flex-wrap items-center gap-3">
            <span class="${item.statusTone} px-3 py-1 rounded-full font-bold text-[11px] uppercase tracking-wider border">${escapeHtml(item.statusLabel)}</span>
            ${submittedChip}
        </div>
    `;
};

const renderRevisionNoteBox = (note: string | null): string => `
    <div class="bg-amber-50 rounded-xl p-4 flex items-start gap-3 border border-amber-100">
        <svg class="text-amber-500 mt-1 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <p class="text-xs font-semibold text-amber-800">Catatan Revisi: <span class="font-medium text-amber-700">${escapeHtml(note || 'Terdapat catatan revisi pada pengajuan Anda.')}</span></p>
    </div>
`;

interface TrackingCardParts {
    label: string;
    status: string;
    bodyHtml: string;
    actionsHtml: string;
}

const renderTrackingCardShell = (parts: TrackingCardParts): string => `
    <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div class="bg-primary-teal px-6 py-4 text-white">
            <h4 class="font-['Inter'] font-normal text-white text-xl">${escapeHtml(parts.label)}</h4>
        </div>
        <div class="p-8 flex-1 flex flex-col">
            ${renderWorkflowTimeline(parts.status)}
            <div class="flex-1 flex flex-col justify-between gap-6">
                <div class="space-y-4">
                    ${parts.bodyHtml}
                </div>
                <div>
                    ${parts.actionsHtml}
                </div>
            </div>
        </div>
    </div>
`;

const renderTrackingCard = (item: TrackingItem): string => {
    const metaRowHtml = renderTrackingMetaRow(item);

    // The detail button shares one style for every type; only the action name
    // and data attributes differ so the existing per-type dispatch still works.
    const detailButton = item.isBeasiswa
        ? `<button data-action="open-scholarship-detail" data-id="${item.id}" class="${TRACKING_CTA_OUTLINE}">Lihat Detail</button>`
        : `<button data-action="open-letter-detail" data-origin="dashboard" data-id="${item.id}" data-letter-type="${escapeHtml(item.rawLetterType)}" class="${TRACKING_CTA_OUTLINE}">Lihat Detail</button>`;

    let bodyHtml: string;
    let actionsHtml: string;

    if (item.canComplete) {
        // Beasiswa, Ready_For_Student_Review — ready to be completed.
        bodyHtml = `
            ${metaRowHtml}
            <div class="bg-teal-50 rounded-xl p-4 flex items-start gap-3 border border-teal-100">
                <svg class="text-primary-teal mt-1 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <p class="text-xs font-semibold text-teal-900">Pengajuan siap diselesaikan. <span class="font-medium text-teal-700">Buka detail untuk melihat informasi pengajuan sebelum menyelesaikan.</span></p>
            </div>
        `;
        actionsHtml = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${detailButton}
                <button data-action="complete-letter-review" data-id="${item.id}" data-letter-type="${escapeHtml(item.rawLetterType)}" class="${TRACKING_CTA_PRIMARY}">
                    Selesaikan Pengajuan
                </button>
            </div>
        `;
    } else if (item.canFixRevision) {
        // Beasiswa, Revision — student must fix and resubmit.
        bodyHtml = `
            ${metaRowHtml}
            ${renderRevisionNoteBox(item.revisionNote)}
        `;
        actionsHtml = `
            <button data-action="fix-scholarship-revision" class="${TRACKING_CTA_DANGER}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                LIHAT CATATAN & PERBAIKI
            </button>
        `;
    } else {
        // Every other case (all SKA/PLN/Magang states, plus Beasiswa states
        // without a special action): meta + optional revision note + a short
        // stage description, with the shared outline detail button.
        const stageDescription = getActiveStageDescription(item.status)
            || 'Pengajuan sedang berjalan. Buka detail untuk melihat tahapan dan tindakan yang tersedia.';
        const revisionBox = item.status === LETTER_WORKFLOW_STATUS.REVISION
            ? renderRevisionNoteBox(item.revisionNote)
            : '';
        bodyHtml = `
            ${metaRowHtml}
            ${revisionBox}
            <p class="text-sm text-gray-600 leading-relaxed">${escapeHtml(stageDescription)}</p>
        `;
        actionsHtml = detailButton;
    }

    return renderTrackingCardShell({ label: item.label, status: item.status, bodyHtml, actionsHtml });
};

export const renderMahasiswaDashboard = async () => {
    // Aggregate all five letter types so the count cards and Recent Riwayat
    // table reflect the same total set the dedicated Riwayat page shows. The
    // fetch + normalize + newest-first sort are now owned by the shared
    // Mahasiswa application-list adapter (same source the Riwayat list uses), so
    // both surfaces stay in lockstep. The dashboard keeps its own stats, capped
    // "recent 4" preview, and rich tracking cards — those semantics are
    // unchanged; only the data acquisition is shared.
    let applications: any[] = [];
    // Track endpoints that didn't return a usable payload so we can surface a
    // visible partial-failure banner — silent undercounts must not happen.
    let failedEndpointCount = 0;

    try {
        const loaded = await loadMahasiswaApplications((url) => apiFetch(url, { cache: 'no-store' }));
        // Unwrap to the raw rows the existing stats/tracking/history code expects;
        // the adapter already tagged letter_type and sorted newest-first.
        applications = loaded.items.map((item) => item.raw);
        failedEndpointCount = loaded.failedEndpointCount;
    } catch (e) {
        console.error("Failed to fetch applications", e);
        // A throw here means the aggregate load hard-failed. Mark all endpoints
        // as failed so the warning banner appears.
        failedEndpointCount = MAHASISWA_LETTER_ENDPOINTS.length;
    }

    const partialFailureBanner = failedEndpointCount > 0
        ? `
            <div role="alert" class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs font-semibold flex items-start gap-2">
                <svg class="shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <span>Sebagian data surat gagal dimuat. Total dan riwayat di bawah mungkin tidak lengkap. Coba refresh halaman.</span>
            </div>
        `
        : '';

    const { COMPLETED, REJECTED, REVISION } = LETTER_WORKFLOW_STATUS;
    const diproses = applications.filter((app: any) => ![COMPLETED, REJECTED, REVISION].includes(app.status)).length;
    const direvisi = applications.filter((app: any) => app.status === REVISION).length;
    const selesai = applications.filter((app: any) => app.status === COMPLETED).length;

    // Build History Rows — type-aware label and navigation so non-Beasiswa
    // entries open the right detail page when "Lihat Detail" is clicked.
    const recentApps = applications.slice(0, 4);
    let historyHtml = '';
    if (recentApps.length === 0) {
        historyHtml = `<tr><td colspan="4" class="px-8 py-5 text-center text-sm text-gray-500">Belum ada riwayat pengajuan.</td></tr>`;
    } else {
        historyHtml = recentApps.map((app: any) => {
            const dateStr = new Date(app.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
            const statusText = getLetterStatusLabel(app.status, 'student-list');
            const statusClass = getLetterStatusTone(app.status, 'student-dashboard');
            const label = app.scholarship_name || getLetterLabel(app.letter_type);

            return `
                <tr class="hover:bg-gray-50/50 transition-colors group">
                    <td class="px-8 py-5 text-sm text-gray-400 font-['Inter'] font-normal text-center">${dateStr}</td>
                    <td class="px-8 py-5 text-sm text-gray-900 font-['Inter'] font-normal text-center">${label}</td>
                    <td class="px-8 py-5 text-sm text-center">
                        <span class="${statusClass} px-4 py-1.5 rounded-full font-bold text-[11px] uppercase tracking-wider border">
                            ${statusText}
                        </span>
                    </td>
                    <td class="px-8 py-5">
                        <div class="flex items-center justify-center gap-3 group-hover:opacity-100 transition-opacity">
                            <button data-action="open-letter-detail" data-origin="riwayat" data-id="${app.id}" data-letter-type="${app.letter_type || ''}" class="text-primary-teal font-bold text-xs hover:underline">Lihat Detail</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Active Tracking — global across every aggregated letter type. An "active"
    // submission is anything not in a terminal state (COMPLETED, REJECTED);
    // REVISION is kept because the student still has work to do. The list is
    // normalized into TrackingItem and dispatched per type: Beasiswa keeps its
    // rich timeline + complete/revision CTAs (Scholarship-endpoint-specific);
    // SKA/PLN/Magang (and any future request type, e.g. Peminjaman) get a
    // neutral card whose only action is "Lihat Detail" — type-specific next
    // actions live on the dedicated detail page.
    // Active = anything not terminal. The cap (slice 0..4) keeps the dashboard
    // tidy; if the full count exceeds the cap we MUST surface that or the UI
    // implies the list is complete. Total is computed before the slice so the
    // honesty note can compare shown vs total.
    const allActive = applications.filter((app: any) => ![COMPLETED, REJECTED].includes(app.status));
    const ACTIVE_TRACKING_CAP = 4;
    const activeItems = allActive.slice(0, ACTIVE_TRACKING_CAP).map(toTrackingItem);

    let trackingHtml = '';
    if (activeItems.length === 0) {
        trackingHtml = `<div class="col-span-full text-center text-gray-500 py-8 bg-white rounded-2xl border border-gray-100">Tidak ada pengajuan aktif yang sedang diproses.</div>`;
    } else {
        trackingHtml = activeItems.map(renderTrackingCard).join('');
    }

    const activeCapNote = allActive.length > activeItems.length
        ? `
            <p class="text-xs text-gray-500 mt-4 text-center">
                Menampilkan ${activeItems.length} dari ${allActive.length} pengajuan aktif.
                <button id="btn-active-cap-riwayat" type="button" class="text-primary-teal font-semibold hover:underline">Lihat Riwayat Pengajuan untuk lainnya.</button>
            </p>
        `
        : '';

    const content = `
        <div class="space-y-8">
            <!-- Greeting Banner -->
            <div class="bg-white rounded-[24px] p-8 text-white relative overflow-hidden shadow-lg border border-teal-800/30">
                <div class="relative z-10 flex flex-col gap-4">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div class="flex-1">
                            <h2 class="text-[32px] font-semibold text-gray-900 font-['Inter']">Halo, ${getGreetingName(localStorage.getItem('auth_name'))}! </h2>
                        </div>
                        <div>
                            <button id="btn-lengkapi-profil" class="font-['Inter'] hidden px-6 py-2.5 bg-primary-teal text-white font-semibold rounded-xl hover:bg-black hover:text-white transition-all duration-200 shadow-sm whitespace-nowrap">
                                Lengkapi Profil
                            </button>
                        </div>
                    </div>
                    <div id="profile-reminder-section" class="hidden transition-all duration-300">
                        <p id="profile-progress-text" class="font-['Inter'] font-normal text-sm text-gray-900 mb-3">Profil kamu baru terisi 0%. Lengkapi profil untuk mempercepat proses pengajuan surat.</p>
                        <div class="w-full">
                            <div class="h-2.5 w-full bg-gray-300 rounded-full overflow-hidden">
                                <div id="profile-progress-bar" class="h-full bg-primary-teal rounded-full w-[0%] shadow-[0_0_10px_rgba(255,255,255,0.4)] transition-all duration-500"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Decorative Elements -->
                <div class="absolute right-[-50px] top-[-50px] w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl"></div>
                <div class="absolute left-[-20px] bottom-[-20px] w-[150px] h-[150px] bg-white/5 rounded-full blur-2xl"></div>
            </div>

            ${partialFailureBanner}

            <!-- Summary Status Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Diproses -->
                <div class="bg-[#F0F7F6] p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-md transition-shadow">
                    <div class="w-14 h-14 bg-[#3D4E4E]/5 rounded-xl flex items-center justify-center text-[#3D4E4E]">
                        <img src="proses-logo.png" class="w-14 h-14" />
                    </div>
                    <div>
                        <p class="text-3xl font-black text-green-800 leading-tight">${diproses}</p>
                        <p class="text-sm font-['Inter'] text-gray-500 font-normal">Sedang Diproses</p>
                    </div>
                </div>

                <!-- Butuh Revisi -->
                <div class="bg-[#FFF7ED] p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-md transition-shadow">
                    <div class="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                        <img src="revisi-logo.png" class="w-14 h-14" />
                    </div>
                    <div>
                        <p class="text-3xl font-black text-[#F59E0B] leading-tight">${direvisi}</p>
                        <p class="text-sm font-['Inter'] text-gray-500 font-normal">Surat Butuh Revisi</p>
                    </div>
                </div>

                <!-- Selesai -->
                <div class="bg-[#ECFDF5] p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-md transition-shadow">
                    <div class="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                        <img src="selesai-logo.png" class="w-14 h-14" />
                    </div>
                    <div>
                        <p class="text-3xl font-black text-[#10B981] leading-tight">${selesai}</p>
                        <p class="text-sm font-['Inter'] text-gray-500 font-normal">Surat Selesai</p>
                    </div>
                </div>
            </div>

            <!-- Ajukan Surat Button -->
            <button id="btn-ajukan-surat" class="w-full py-4 bg-primary-teal text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-teal-800 transition-all duration-200 shadow-sm border border-teal-700/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Ajukan Surat Baru
            </button>

            <!-- Active Tracking Section -->
            <div>
                <h3 class="text-2xl font-normal text-gray-800 mb-6 flex items-center gap-2">
                    Pelacakan Pengajuan Aktif
                </h3>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    ${trackingHtml}
                </div>
                ${activeCapNote}
            </div>

            <!-- Recent History Section -->
            <div class="mt-8">
                <h3 class="text-2xl font-normal text-gray-800 mb-6 flex items-center gap-2">Riwayat Pengajuan</h3>
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left ">
                            <thead>
                                <tr class="text-[13px] font-['Inter'] font-medium text-gray-900 border-b border-gray-500">
                                    <th class="px-8 py-5 text-center">Tanggal Unggah</th>
                                    <th class="px-8 py-5 text-center">Nama Dokumen</th>
                                    <th class="px-8 py-5 text-center">Status</th>
                                    <th class="px-8 py-5 text-center">Detail</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                ${historyHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    renderDashboardLayout('Dashboard', content, 'mahasiswa', 'dashboard');

    setTimeout(() => {
        const btnLengkapi = document.getElementById('btn-lengkapi-profil');
        if (btnLengkapi) {
            btnLengkapi.addEventListener('click', () => {
                renderProfilMahasiswa();
            });
        }

        const btnAjukan = document.getElementById('btn-ajukan-surat');
        if (btnAjukan) {
            btnAjukan.addEventListener('click', () => {
                import('../mahasiswa/AdministrasiSurat').then(({ renderAdministrasiSurat }) => {
                    renderAdministrasiSurat();
                });
            });
        }

        document.querySelectorAll('[data-action="fix-scholarship-revision"]').forEach((button) => {
            button.addEventListener('click', () => {
                renderScholarshipForm();
            });
        });

        document.querySelectorAll('[data-action="open-scholarship-detail"]').forEach((button) => {
            button.addEventListener('click', () => {
                const id = (button as HTMLElement).dataset.id;
                const origin = (button as HTMLElement).dataset.origin;
                if (!id) return;
                if (origin === 'riwayat') {
                    renderScholarshipDetail(id, { origin: 'riwayat' });
                    return;
                }
                renderScholarshipDetail(id);
            });
        });

        // Recent Riwayat row buttons — dispatch to the right detail page per letter type.
        document.querySelectorAll('[data-action="open-letter-detail"]').forEach((button) => {
            button.addEventListener('click', () => {
                const el = button as HTMLElement;
                const id = el.dataset.id;
                const letterType = el.dataset.letterType || '';
                if (id) openLetterDetailForType(id, letterType);
            });
        });

        // Active Tracking cap note → open Riwayat Pengajuan via the same lazy
        // import pattern the "Ajukan Surat Baru" button uses.
        document.getElementById('btn-active-cap-riwayat')?.addEventListener('click', () => {
            import('../mahasiswa/RiwayatPengajuan').then(({ renderRiwayatPengajuan }) => {
                renderRiwayatPengajuan();
            });
        });

        document.querySelectorAll('[data-action="complete-letter-review"]').forEach((button) => {
            button.addEventListener('click', () => {
                const el = button as HTMLElement;
                const id = el.dataset.id;
                const letterType = el.dataset.letterType || '';
                if (id) completeLetterReview(id, letterType);
            });
        });

        async function fetchProfileProgress() {
            try {
                const res = await apiFetch('/api/profile', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    const profile = data.profile;
                    const completeness = data.completeness;
                    const canonicalPercentage = completeness?.percentage;
                    const hasCanonicalPercentage = typeof canonicalPercentage === 'number'
                        && Number.isFinite(canonicalPercentage);
                    const percent = hasCanonicalPercentage
                        ? Math.min(100, Math.max(0, canonicalPercentage))
                        : completeness?.is_complete === true ? 100 : 0;
                    const isComplete = completeness?.is_complete === true;

                    if (!hasCanonicalPercentage) {
                        console.warn('Profile completeness percentage missing; using boolean fallback.');
                    }

                    const txt = document.getElementById('profile-progress-text');
                    const bar = document.getElementById('profile-progress-bar');
                    const section = document.getElementById('profile-reminder-section');

                    if (txt) txt.innerText = `Profil kamu baru terisi ${percent}%. Lengkapi profil untuk mempercepat proses pengajuan surat.`;
                    if (bar) bar.style.width = `${percent}%`;

                    if (profile?.pas_foto_path) {
                        localStorage.setItem('auth_photo', profile.pas_foto_path);
                        const headerAvatar = document.getElementById('header-user-avatar') as HTMLImageElement | null;
                        if (headerAvatar) {
                            void loadProtectedImageObjectUrl(profile.pas_foto_path).then((objectUrl) => {
                                if (!objectUrl) return;
                                revokeProtectedImageObjectUrl(mahasiswaDashboardAvatarObjectUrl);
                                mahasiswaDashboardAvatarObjectUrl = objectUrl;
                                headerAvatar.src = objectUrl;
                                headerAvatar.className = 'w-full h-full object-cover';
                            });
                        }
                    }

                    if (!isComplete) {
                        if (section) section.classList.remove('hidden');
                        if (btnLengkapi) btnLengkapi.classList.remove('hidden');
                    } else {
                        if (section) section.classList.add('hidden');
                        if (btnLengkapi) btnLengkapi.classList.add('hidden');
                    }
                }
            } catch (e) { console.error(e); }
        }
        fetchProfileProgress();
    }, 100);
};

const showToast = (text: string, success = true) => {
    Toastify({
        text,
        duration: 3500,
        style: { background: success ? '#10B981' : '#EF4444' }
    }).showToast();
};

// Resolve the per-letter /complete endpoint prefix from the row's letter type.
// Each letter completes against its OWN endpoint — never the Beasiswa endpoint
// for a non-Beasiswa letter. Mirrors the prefixes the detail pages POST to.
const completeEndpointPrefixFor = (letterType: string): string | null =>
    mahasiswaEndpointPrefixFor(letterType);

const completeLetterReview = async (applicationId: string, letterType: string) => {
    const prefix = completeEndpointPrefixFor(letterType);
    if (!prefix || !applicationId) {
        showToast('Jenis surat tidak dikenali untuk diselesaikan.', false);
        return;
    }

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
        renderMahasiswaDashboard();
    } catch (error: any) {
        showToast(error?.message || 'Gagal menyelesaikan pengajuan.', false);
    }
};
