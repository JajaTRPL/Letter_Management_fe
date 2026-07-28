import { apiFetch } from '../shared/api-client';
import { buttonClass, inputClass, surfaceClass } from '../shared/design-system';
import { escapeFormHtml } from '../shared/form-primitives';
import { showError, showSuccess } from '../shared/toast';

/**
 * SuperAdmin review-SLA governance — a self-contained, clearly-labelled section
 * embedded in the Retensi & Arsip area. It manages the review DEADLINE policy
 * (distinct from document retention) for BOTH workflow domains, each in its own
 * explicitly-named card so a SuperAdmin never has to guess which workflow a
 * value affects:
 *   • Peminjaman Ruangan
 *   • Surat Administrasi
 *
 * Reads the one governance backbone (`/api/super-admin/review-sla/{scope}`),
 * which returns render-ready human language. Self-hydrating and failure-isolated
 * so it never blocks the host page; thresholds are edited in DAYS (the product's
 * 7-day baseline unit) and validated warning ≤ overdue ≤ escalation before save.
 */

const SCOPES = ['room_booking', 'letter'] as const;
type SlaScope = (typeof SCOPES)[number];

interface SlaPolicy {
    scope: string;
    scope_label: string;
    enabled: boolean;
    thresholds: { warning_minutes: number; overdue_minutes: number; escalation_minutes: number };
    explanation: {
        subject: string; reviewer: string; escalates_to: string;
        warning: string; overdue: string; escalation: string; effect: string;
    };
    bounds: { min_minutes: number; max_minutes: number };
    audit: {
        updated_by: string | null; updated_at: string | null;
        enabled_updated_by: string | null; enabled_at: string | null; disabled_at: string | null;
    };
}

const MINUTES_PER_DAY = 24 * 60;
const MIN_DAYS = 1;
const MAX_DAYS = 30;

const state = new Map<SlaScope, SlaPolicy>();
const draftEnabled = new Map<SlaScope, boolean>();

const toDays = (minutes: number): number => Math.max(MIN_DAYS, Math.round(minutes / MINUTES_PER_DAY));

// ── data ─────────────────────────────────────────────────────────────────────

async function fetchSlaPolicy(scope: SlaScope): Promise<SlaPolicy> {
    const response = await apiFetch(`/api/super-admin/review-sla/${scope}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.data) {
        throw new Error(payload?.message ?? 'Pengaturan gagal dimuat.');
    }
    return payload.data as SlaPolicy;
}

async function saveSlaPolicy(scope: SlaScope, body: {
    enabled: boolean; warning_minutes: number; overdue_minutes: number; escalation_minutes: number;
}): Promise<SlaPolicy> {
    const response = await apiFetch(`/api/super-admin/review-sla/${scope}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.data) {
        throw new Error(payload?.message ?? 'Pengaturan gagal disimpan.');
    }
    return payload.data as SlaPolicy;
}

// ── shell + hydrate ────────────────────────────────────────────────────────────

/** The static section the host page embeds; hydrate fills #sla-governance-body. */
export function slaGovernanceShell(): string {
    return `
        <section class="${surfaceClass('card', 'p-5 sm:p-6 space-y-5')}" aria-labelledby="sla-governance-title">
            <div>
                <p class="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Pengaturan</p>
                <h2 id="sla-governance-title" class="mt-1 text-2xl font-bold text-gray-900">Batas Waktu Pemeriksaan</h2>
                <p class="mt-2 max-w-3xl text-sm text-gray-500">Atur berapa lama sebuah permohonan boleh menunggu sebelum pemeriksa diingatkan. Ini <span class="font-semibold text-gray-600">berbeda dari Retensi &amp; Arsip Surat</span> di atas: bagian itu mengatur masa simpan berkas, sedangkan di sini Anda mengatur <span class="font-semibold text-gray-600">kecepatan pemeriksaan</span>. Setiap jenis permohonan diatur sendiri di bawah.</p>
            </div>
            <p id="sla-governance-status" role="status" aria-live="polite" class="sr-only"></p>
            <div id="sla-governance-body">${cardsSkeleton()}</div>
        </section>
    `;
}

function cardsSkeleton(): string {
    return `<div class="rounded-xl border border-gray-100 bg-white px-6 py-10 text-center text-sm font-semibold text-gray-400">Memuat pengaturan…</div>`;
}

/** Fetch both domains' policies and render their cards. Best-effort. */
export async function hydrateSlaGovernance(): Promise<void> {
    const body = document.getElementById('sla-governance-body');
    if (!body) return;
    announce('Memuat pengaturan.');

    try {
        const policies = await Promise.all(SCOPES.map(fetchSlaPolicy));
        SCOPES.forEach((scope, i) => {
            state.set(scope, policies[i]);
            if (!draftEnabled.has(scope)) draftEnabled.set(scope, policies[i].enabled);
        });
    } catch (error) {
        body.innerHTML = `
            <div role="alert" class="rounded-xl border border-red-100 bg-red-50 px-6 py-8 text-center">
                <p class="text-sm font-bold text-red-700">Pengaturan gagal dimuat</p>
                <p class="mt-1 text-xs text-red-600">${escapeFormHtml(error instanceof Error ? error.message : 'Terjadi kesalahan.')}</p>
                <button id="sla-retry" type="button" class="${buttonClass('primary', 'sm', 'mt-4')}">Coba Lagi</button>
            </div>`;
        document.getElementById('sla-retry')?.addEventListener('click', () => void hydrateSlaGovernance());
        announce('Pengaturan gagal dimuat.');
        return;
    }

    body.innerHTML = `<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">${SCOPES.map(renderCard).join('')}</div>`;
    SCOPES.forEach(bindCard);
    announce('Pengaturan siap diubah.');
}

// ── render ─────────────────────────────────────────────────────────────────────

function renderCard(scope: SlaScope): string {
    const policy = state.get(scope);
    if (!policy) return '';
    const enabled = draftEnabled.get(scope) ?? policy.enabled;
    const t = policy.thresholds;
    const audit = policy.audit;
    const track = enabled ? 'bg-teal-600' : 'bg-gray-300';
    const knob = enabled ? 'translate-x-5' : 'translate-x-1';

    return `
        <div class="${surfaceClass('muted', 'rounded-2xl p-5 space-y-4')}" data-sla-card="${scope}">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-xs font-bold uppercase tracking-wide text-teal-700">Jenis Permohonan</p>
                    <h3 class="mt-0.5 text-lg font-bold text-gray-900">${escapeFormHtml(policy.scope_label)}</h3>
                    <p class="mt-1 text-xs text-gray-500">${escapeFormHtml(policy.explanation.subject)} — diperiksa oleh ${escapeFormHtml(policy.explanation.reviewer)}.</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span id="sla-state-${scope}" class="text-xs font-semibold ${enabled ? 'text-teal-700' : 'text-gray-500'}">${enabled ? 'Aktif' : 'Nonaktif'}</span>
                    <button type="button" role="switch" data-sla-toggle="${scope}" aria-checked="${enabled ? 'true' : 'false'}"
                        aria-label="Aktifkan pengingat pemeriksaan untuk ${escapeFormHtml(policy.scope_label)}"
                        class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${track}">
                        <span class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${knob}"></span>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                ${dayField(scope, 'warning', 'Mulai diingatkan', toDays(t.warning_minutes), 'Kapan pemeriksa mulai diingatkan.')}
                ${dayField(scope, 'overdue', 'Dianggap terlambat', toDays(t.overdue_minutes), 'Kapan permohonan dianggap terlambat.')}
                ${dayField(scope, 'escalation', 'Naik ke '+escapeFormHtml(policy.explanation.escalates_to), toDays(t.escalation_minutes), 'Kapan permohonan naik ke '+escapeFormHtml(policy.explanation.escalates_to)+'.')}
            </div>
            <p id="sla-error-${scope}" role="alert" class="hidden text-xs font-semibold text-red-600"></p>
            <p class="text-[11px] leading-relaxed text-gray-400">${escapeFormHtml(policy.explanation.effect)}</p>

            <div class="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <p class="text-[11px] text-gray-400">${audit.updated_by
                    ? 'Terakhir diubah oleh '+escapeFormHtml(audit.updated_by)
                    : 'Belum pernah diubah'}</p>
                <button type="button" data-sla-save="${scope}" class="${buttonClass('primary', 'sm')}">Simpan</button>
            </div>
        </div>
    `;
}

function dayField(scope: SlaScope, key: string, label: string, days: number, help: string): string {
    const id = `sla-${scope}-${key}`;
    return `
        <label class="block text-xs font-bold text-gray-600" for="${id}">
            ${escapeFormHtml(label)}
            <span class="mt-1 flex items-center gap-2">
                <input id="${id}" data-sla-input="${key}" type="number" min="${MIN_DAYS}" max="${MAX_DAYS}" step="1" value="${days}"
                    aria-describedby="${id}-help"
                    class="${inputClass('default', 'w-16 text-center')}" />
                <span class="text-xs font-medium text-gray-500">hari</span>
            </span>
            <span id="${id}-help" class="mt-1 block text-[11px] font-medium text-gray-400">${escapeFormHtml(help)}</span>
        </label>
    `;
}

// ── behaviour ────────────────────────────────────────────────────────────────

function bindCard(scope: SlaScope): void {
    const toggle = document.querySelector<HTMLButtonElement>(`[data-sla-toggle="${scope}"]`);
    toggle?.addEventListener('click', () => {
        const next = !(draftEnabled.get(scope) ?? false);
        draftEnabled.set(scope, next);
        toggle.setAttribute('aria-checked', next ? 'true' : 'false');
        toggle.classList.toggle('bg-teal-600', next);
        toggle.classList.toggle('bg-gray-300', !next);
        const knob = toggle.querySelector('span');
        knob?.classList.toggle('translate-x-5', next);
        knob?.classList.toggle('translate-x-1', !next);
        const stateLabel = document.getElementById(`sla-state-${scope}`);
        if (stateLabel) {
            stateLabel.textContent = next ? 'Aktif' : 'Nonaktif';
            stateLabel.classList.toggle('text-teal-700', next);
            stateLabel.classList.toggle('text-gray-500', !next);
        }
    });

    document.querySelector<HTMLButtonElement>(`[data-sla-save="${scope}"]`)
        ?.addEventListener('click', () => void save(scope));
}

function readDays(scope: SlaScope, key: string): number {
    const input = document.querySelector<HTMLInputElement>(`[data-sla-card="${scope}"] [data-sla-input="${key}"]`);
    return Math.trunc(Number(input?.value ?? '0'));
}

function showCardError(scope: SlaScope, message: string | null): void {
    const el = document.getElementById(`sla-error-${scope}`);
    if (!el) return;
    el.textContent = message ?? '';
    el.classList.toggle('hidden', !message);
}

async function save(scope: SlaScope): Promise<void> {
    const warning = readDays(scope, 'warning');
    const overdue = readDays(scope, 'overdue');
    const escalation = readDays(scope, 'escalation');

    for (const [label, value] of [['Mulai diingatkan', warning], ['Dianggap terlambat', overdue], ['Naik ke SuperAdmin', escalation]] as const) {
        if (!Number.isInteger(value) || value < MIN_DAYS || value > MAX_DAYS) {
            showCardError(scope, `"${label}" harus antara ${MIN_DAYS}–${MAX_DAYS} hari.`);
            return;
        }
    }
    if (!(warning <= overdue && overdue <= escalation)) {
        showCardError(scope, 'Urutan waktu belum tepat: "Mulai diingatkan" harus paling awal, lalu "Dianggap terlambat", lalu "Naik ke SuperAdmin".');
        return;
    }
    showCardError(scope, null);

    const button = document.querySelector<HTMLButtonElement>(`[data-sla-save="${scope}"]`);
    if (button) button.disabled = true;
    try {
        const updated = await saveSlaPolicy(scope, {
            enabled: draftEnabled.get(scope) ?? false,
            warning_minutes: warning * MINUTES_PER_DAY,
            overdue_minutes: overdue * MINUTES_PER_DAY,
            escalation_minutes: escalation * MINUTES_PER_DAY,
        });
        state.set(scope, updated);
        draftEnabled.set(scope, updated.enabled);
        showSuccess(`Pengaturan ${updated.scope_label} tersimpan.`);
        announce(`Pengaturan ${updated.scope_label} tersimpan.`);
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Pengaturan gagal disimpan.');
    } finally {
        if (button) button.disabled = false;
    }
}

function announce(message: string): void {
    const status = document.getElementById('sla-governance-status');
    if (status) status.textContent = message;
}
