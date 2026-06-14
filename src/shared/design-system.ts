/**
 * Semantic design-system foundation (CP7A).
 *
 * A small, typed, framework-agnostic token layer: it maps SEMANTIC intent
 * (tone, button variant, input state, surface) to the Tailwind class strings the
 * shared primitives already use, plus a `cx` composer. It is the single place a
 * future visual change for these primitives is made.
 *
 * Hard boundaries (enforced by tests):
 *  - NO business-domain knowledge: no letter types, role names, workflow
 *    statuses, routes, endpoints, or logic.
 *  - NO DOM / lifecycle / fetching.
 *  - NO external dependencies.
 *
 * Domain → tone mapping (e.g. workflow status → tone/label) stays in the domain
 * helpers (letter-workflow). This module only maps tone → classes.
 */

export type UiTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export type ButtonSize = 'sm' | 'md';

export type InputState = 'default' | 'invalid';

export type SurfaceVariant = 'page' | 'card' | 'section' | 'muted' | 'interactive';

/**
 * Compose class strings, ignoring falsey values. Keeps call sites readable and
 * lets callers append surface-specific overrides without string juggling.
 */
export function cx(...values: Array<string | false | null | undefined>): string {
    return values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

// Shared focus ring used by interactive controls (teal brand).
const FOCUS_RING = 'focus:outline-none focus:ring-2 focus:ring-teal-50 focus:border-primary-teal';

// ── Tone → badge classes ────────────────────────────────────────────────────
// Generic semantic tones. Domain code resolves a status to a tone; it never
// hard-codes these class strings.
const BADGE_TONE: Record<UiTone, string> = {
    neutral: 'bg-gray-100 text-gray-600 border border-gray-200',
    primary: 'bg-teal-50 text-teal-700 border border-teal-100',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-red-50 text-red-700 border border-red-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-100',
};

const BADGE_BASE = 'inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold';

export function badgeClass(tone: UiTone, extra?: string): string {
    return cx(BADGE_BASE, BADGE_TONE[tone], extra);
}

// ── Button variants ───────────────────────────────────────────────────────--
const BUTTON_BASE = 'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-colors disabled:cursor-not-allowed';

const BUTTON_SIZE: Record<ButtonSize, string> = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-2.5',
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
    primary: 'bg-primary-teal text-white hover:bg-teal-800 disabled:bg-gray-300',
    secondary: 'bg-white text-primary-teal border border-primary-teal hover:bg-teal-50 disabled:opacity-60',
    outline: 'border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40',
    ghost: 'text-primary-teal hover:underline',
    danger: 'bg-[#E53935] text-white hover:bg-red-700 disabled:opacity-60',
};

export function buttonClass(variant: ButtonVariant, size: ButtonSize = 'md', extra?: string): string {
    return cx(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], FOCUS_RING, extra);
}

// ── Inputs / selects ──────────────────────────────────────────────────────--
const CONTROL_BASE = 'w-full rounded-xl border text-sm bg-white';

const CONTROL_STATE: Record<InputState, string> = {
    default: 'border-gray-200',
    invalid: 'border-red-300',
};

export function inputClass(state: InputState = 'default', extra?: string): string {
    return cx(CONTROL_BASE, 'px-4 py-2.5', CONTROL_STATE[state], FOCUS_RING, 'disabled:cursor-not-allowed disabled:opacity-60', extra);
}

export function selectClass(state: InputState = 'default', extra?: string): string {
    return cx(CONTROL_BASE, 'px-4 py-2.5', CONTROL_STATE[state], FOCUS_RING, extra);
}

// ── Surfaces ──────────────────────────────────────────────────────────────--
const SURFACE_VARIANT: Record<SurfaceVariant, string> = {
    page: 'max-w-5xl mx-auto',
    card: 'bg-white rounded-[24px] border border-gray-100 shadow-sm',
    section: 'bg-white rounded-2xl border border-gray-100 shadow-sm',
    muted: 'bg-gray-50/60 border border-gray-100',
    interactive: 'bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow',
};

export function surfaceClass(variant: SurfaceVariant, extra?: string): string {
    return cx(SURFACE_VARIANT[variant], extra);
}

// ── Gallery tab (horizontal selector) ─────────────────────────────────────--
const GALLERY_TAB_BASE = 'shrink-0 px-4 py-2.5 rounded-xl border text-xs font-bold transition-colors';

export function galleryTabClass(active: boolean): string {
    return cx(
        GALLERY_TAB_BASE,
        active
            ? 'bg-teal-50 border-primary-teal text-primary-teal'
            : 'bg-white border-gray-200 text-gray-600 hover:border-teal-200 hover:text-primary-teal',
    );
}

// ── Accent surfaces ───────────────────────────────────────────────────────--
// Generic decorative accent palette. A presentation map (e.g. letter-presentation)
// assigns an AccentTone per item; this module never names the items themselves.
export type AccentTone = 'teal' | 'blue' | 'amber' | 'emerald' | 'indigo' | 'slate';

interface AccentClasses {
    /** Icon container background + hover (group-hover) classes. */
    iconSurface: string;
    /** Pill badge text + background classes. */
    badge: string;
    /** Raw hex used for inline SVG `stroke` (matches the existing icons). */
    stroke: string;
}

const ACCENT: Record<AccentTone, AccentClasses> = {
    teal: { iconSurface: 'bg-teal-50 group-hover:bg-teal-100', badge: 'text-teal-600 bg-teal-50', stroke: '#0d9488' },
    blue: { iconSurface: 'bg-blue-50 group-hover:bg-blue-100', badge: 'text-blue-600 bg-blue-50', stroke: '#3b82f6' },
    amber: { iconSurface: 'bg-amber-50 group-hover:bg-amber-100', badge: 'text-amber-600 bg-amber-50', stroke: '#f59e0b' },
    emerald: { iconSurface: 'bg-emerald-50 group-hover:bg-emerald-100', badge: 'text-emerald-600 bg-emerald-50', stroke: '#059669' },
    indigo: { iconSurface: 'bg-indigo-50 group-hover:bg-indigo-100', badge: 'text-indigo-600 bg-indigo-50', stroke: '#6366f1' },
    slate: { iconSurface: 'bg-slate-50 group-hover:bg-slate-100', badge: 'text-slate-600 bg-slate-50', stroke: '#64748b' },
};

export function accentIconSurfaceClass(tone: AccentTone, extra?: string): string {
    return cx('w-12 h-12 rounded-xl flex items-center justify-center transition-colors', ACCENT[tone].iconSurface, extra);
}

export function accentBadgeClass(tone: AccentTone, extra?: string): string {
    return cx('inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full', ACCENT[tone].badge, extra);
}

export function accentStroke(tone: AccentTone): string {
    return ACCENT[tone].stroke;
}

// ── Text helpers ──────────────────────────────────────────────────────────--
export const textClass = {
    helper: 'text-xs text-gray-500',
    error: 'text-xs font-semibold text-red-600',
    resultCount: 'text-sm font-semibold text-gray-600',
    sectionHeading: 'text-xl font-bold text-gray-800',
} as const;

// Brand spinner used by loading states.
export const SPINNER_CLASS = 'rounded-full border-4 border-teal-100 border-t-primary-teal animate-spin';
