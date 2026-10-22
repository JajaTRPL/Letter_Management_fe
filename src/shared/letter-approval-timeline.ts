import { LETTER_WORKFLOW_STATUS } from './letter-workflow';

/**
 * "Tahap Persetujuan" card on the student detail page, shared by every letter
 * type so the stage names read the same everywhere (and match the reviewer
 * timelines: Verifikasi Tenaga Pendidik → Paraf Kaprodi/Sekprodi → Tanda Tangan
 * Kadep/Sekdep → Review Mahasiswa). Only timestamps present on the payload are
 * shown; step state comes from the canonical status plus *_approved_at.
 */
export interface LetterTimelineApplication {
    status?: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    tendik_approved_at?: string | null;
    kaprodi_approved_at?: string | null;
    kadep_approved_at?: string | null;
    completed_at?: string | null;
    rejected_at?: string | null;
    revised_at?: string | null;
}

export const LETTER_APPROVAL_STEP_LABELS = {
    submitted: 'Diajukan',
    tendik: 'Verifikasi Tenaga Pendidik',
    kaprodi: 'Paraf Kaprodi/Sekprodi',
    kadep: 'Tanda Tangan Kadep/Sekdep',
    studentReview: 'Review Mahasiswa',
    completed: 'Selesai',
    revision: 'Dikembalikan untuk Revisi',
    rejected: 'Pengajuan Ditolak',
} as const;

type StepState = 'done' | 'current' | 'pending';
type Step = { label: string; timestamp: string | null; state: StepState };

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// e.g. "Jumat, 20 Feb 2026 10:07"; "-" when missing.
const formatDateTime = (value?: string | null): string => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    const date = parsed.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    });
    const time = parsed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
};

export function buildLetterApprovalSteps(application: LetterTimelineApplication): Step[] {
    const L = LETTER_APPROVAL_STEP_LABELS;
    const status = application?.status ?? '';
    const submittedAt = application?.submitted_at ?? application?.created_at ?? null;
    const tendikAt = application?.tendik_approved_at ?? null;
    const kaprodiAt = application?.kaprodi_approved_at ?? null;
    const kadepAt = application?.kadep_approved_at ?? null;
    const completedAt = application?.completed_at ?? null;

    if (status === LETTER_WORKFLOW_STATUS.REJECTED) {
        const steps: Step[] = [{ label: L.submitted, timestamp: submittedAt, state: 'done' }];
        if (tendikAt) steps.push({ label: L.tendik, timestamp: tendikAt, state: 'done' });
        if (kaprodiAt) steps.push({ label: L.kaprodi, timestamp: kaprodiAt, state: 'done' });
        steps.push({ label: L.rejected, timestamp: application?.rejected_at ?? null, state: 'done' });
        return steps;
    }

    if (status === LETTER_WORKFLOW_STATUS.REVISION) {
        const steps: Step[] = [{ label: L.submitted, timestamp: submittedAt, state: 'done' }];
        if (tendikAt) steps.push({ label: L.tendik, timestamp: tendikAt, state: 'done' });
        steps.push({ label: L.revision, timestamp: application?.revised_at ?? null, state: 'done' });
        return steps;
    }

    const isCompleted = status === LETTER_WORKFLOW_STATUS.COMPLETED;
    return [
        { label: L.submitted, timestamp: submittedAt, state: 'done' },
        {
            label: L.tendik,
            timestamp: tendikAt,
            state: tendikAt ? 'done' : (status === LETTER_WORKFLOW_STATUS.SUBMITTED ? 'current' : 'pending'),
        },
        {
            label: L.kaprodi,
            timestamp: kaprodiAt,
            state: kaprodiAt ? 'done' : (status === LETTER_WORKFLOW_STATUS.APPROVED_TENDIK ? 'current' : 'pending'),
        },
        {
            label: L.kadep,
            timestamp: kadepAt,
            state: kadepAt ? 'done' : (status === LETTER_WORKFLOW_STATUS.APPROVED_KAPRODI ? 'current' : 'pending'),
        },
        {
            label: L.studentReview,
            timestamp: isCompleted ? completedAt : null,
            state: isCompleted ? 'done' : (status === LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW ? 'current' : 'pending'),
        },
        { label: L.completed, timestamp: completedAt, state: isCompleted ? 'done' : 'pending' },
    ];
}

const renderStepIcon = (state: StepState): string => {
    if (state === 'done') {
        return `
            <span class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 z-10 relative">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>`;
    }
    if (state === 'current') {
        return `
            <span class="w-7 h-7 rounded-full border-2 border-amber-400 bg-white flex items-center justify-center shrink-0 z-10 relative">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            </span>`;
    }
    return `
        <span class="w-7 h-7 rounded-full border-2 border-gray-200 bg-white shrink-0 z-10 relative"></span>`;
};

export function renderLetterApprovalTimeline(application: LetterTimelineApplication): string {
    const steps = buildLetterApprovalSteps(application);
    const rendered = steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const nextIsDone = !isLast && steps[idx + 1].state === 'done';
        const connectorClass = step.state === 'done' && nextIsDone ? 'bg-emerald-200' : 'bg-gray-200';
        const labelClass = step.state === 'pending' ? 'text-gray-400' : 'text-gray-800';
        const tsLabelClass = step.state === 'pending' ? 'text-gray-300' : 'text-gray-500';
        return `
            <li class="relative flex gap-4 pb-6 last:pb-0">
                ${isLast ? '' : `<span class="absolute left-3 top-7 bottom-0 w-0.5 ${connectorClass}"></span>`}
                ${renderStepIcon(step.state)}
                <div class="flex-1 -mt-0.5">
                    <p class="text-[11px] ${tsLabelClass} font-medium">${escapeHtml(formatDateTime(step.timestamp))}</p>
                    <p class="text-sm font-bold ${labelClass} mt-0.5">${escapeHtml(step.label)}</p>
                </div>
            </li>
        `;
    }).join('');

    return `
        <div class="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-7 py-5 border-b border-gray-50">
                <h3 class="text-base font-bold text-gray-800">Tahap Persetujuan</h3>
            </div>
            <ol class="px-7 py-6 list-none">${rendered}</ol>
        </div>
    `;
}
