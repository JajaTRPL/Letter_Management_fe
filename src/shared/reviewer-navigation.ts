// Origin context for Tendik / Akademik letter review screens.
// Lets a single review component preserve sidebar active state and back
// navigation back to whichever surface the user clicked through from
// (Dashboard, Dokumen / Tugas Saya, or Riwayat).

export type ReviewerOrigin = 'dashboard' | 'dokumen' | 'riwayat';

export type ReviewerNavigationOptions = {
    origin?: ReviewerOrigin;
};

export const resolveReviewerOrigin = (options?: ReviewerNavigationOptions): ReviewerOrigin => {
    const origin = options?.origin;
    if (origin === 'dashboard' || origin === 'riwayat') return origin;
    return 'dokumen';
};

// Sidebar active-page key that should be highlighted while the review screen
// is open. Mirrors the Sidebar.ts key namespace used by the role's layout.
export const activePageForReviewerOrigin = (origin: ReviewerOrigin): string => {
    if (origin === 'dashboard') return 'dashboard';
    if (origin === 'riwayat') return 'riwayat';
    return 'dokumen';
};

const TENDIK_DESTINATIONS = {
    dashboard: () => import('../dashboard/TendikDashboard').then((m) => m.renderTendikDashboard),
    dokumen: () => import('../tendik/DokumenTendik').then((m) => m.renderDokumenTendik),
    riwayat: () => import('../tendik/RiwayatTendik').then((m) => m.renderRiwayatTendik),
} as const;

const AKADEMIK_DESTINATIONS = {
    dashboard: () => import('../dashboard/AkademikDashboard').then((m) => m.renderAkademikDashboard),
    dokumen: () => import('../akademik/DokumenAkademik').then((m) => m.renderDokumenAkademik),
    riwayat: () => import('../akademik/RiwayatAkademik').then((m) => m.renderRiwayatAkademik),
} as const;

const ACADEMIC_ROLES = new Set(['akademik', 'kaprodi', 'sekprodi', 'kadep', 'sekdep']);

// Back-button handler for review screens. Picks the right module set
// (tendik vs akademik) based on the caller-supplied role, then opens the
// corresponding dashboard/dokumen/riwayat page.
export const goToReviewerOrigin = async (origin: ReviewerOrigin, role: string): Promise<void> => {
    const isAcademic = ACADEMIC_ROLES.has(role);
    const destinations = isAcademic ? AKADEMIK_DESTINATIONS : TENDIK_DESTINATIONS;
    const loader = destinations[origin];
    const render = await loader();
    render(role);
};
