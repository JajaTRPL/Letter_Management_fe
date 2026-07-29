/**
 * Centralized Role & Subrole Display Name Helper.
 *
 * Converts system roles/sub-roles into clean, humanized, UI/UX friendly Indonesian labels.
 * Prevents raw string representations (e.g., 'kadep', 'super_admin', 'sarpras') from leaking into the UI.
 */

const ROLE_DISPLAY_NAMES: Record<string, string> = {
    super_admin: 'Super Admin / Pengelola Sistem',
    mahasiswa: 'Mahasiswa',
    tendik: 'Tenaga Kependidikan',
    akademik: 'Akademik',
    kadep: 'Ketua Departemen (Kadep)',
    kaprodi: 'Ketua Program Studi (Kaprodi)',
    sekdep: 'Sekretaris Departemen (Sekdep)',
    sekprodi: 'Sekretaris Program Studi (Sekprodi)',
};

const TENDIK_SUBROLE_LABELS: Record<string, string> = {
    persuratan: 'Staf Administrasi Persuratan',
    sarpras: 'Pengelola Sarana & Prasarana',
    kepala_lab: 'Kepala Laboratorium',
    laboran: 'Laboran / Teknisi Lab',
};

const AKADEMIK_SUBROLE_LABELS: Record<string, string> = {
    kaprodi: 'Ketua Program Studi (Kaprodi)',
    sekprodi: 'Sekretaris Program Studi (Sekprodi)',
    kadep: 'Ketua Departemen (Kadep)',
    sekdep: 'Sekretaris Departemen (Sekdep)',
};

/**
 * Get humanized display label for a user's role and subrole, with optional department/prodi code.
 *
 * Examples:
 *   getRoleDisplayName('akademik', 'kaprodi', 'TRPL') -> 'Ketua Program Studi (Kaprodi) TRPL'
 *   getRoleDisplayName('akademik', 'kadep', 'TRI')   -> 'Ketua Departemen (Kadep) TRI'
 *   getRoleDisplayName('tendik', 'sarpras')           -> 'Pengelola Sarana & Prasarana'
 */
export function getRoleDisplayName(
    role?: string | null,
    subRoleOrTendikRole?: string | null,
    scopeCode?: string | null,
): string {
    const rawRole = (role ?? '').trim().toLowerCase();
    const rawSubRole = (subRoleOrTendikRole ?? '').trim().toLowerCase();
    const scope = (scopeCode ?? '').trim();

    if (rawRole === 'super_admin') {
        return 'Super Admin';
    }

    if (rawRole === 'mahasiswa') {
        return 'Mahasiswa';
    }

    if (rawRole === 'tendik') {
        if (rawSubRole && TENDIK_SUBROLE_LABELS[rawSubRole]) {
            return scope ? `${TENDIK_SUBROLE_LABELS[rawSubRole]} (${scope})` : TENDIK_SUBROLE_LABELS[rawSubRole];
        }
        return 'Staf Tendik';
    }

    if (rawRole === 'akademik' || ['kadep', 'kaprodi', 'sekdep', 'sekprodi'].includes(rawRole)) {
        const key = AKADEMIK_SUBROLE_LABELS[rawSubRole] ? rawSubRole : rawRole;
        if (AKADEMIK_SUBROLE_LABELS[key]) {
            const title = AKADEMIK_SUBROLE_LABELS[key];
            return scope ? `${title} ${scope}` : title;
        }
        return 'Pejabat Akademik';
    }

    if (rawSubRole && AKADEMIK_SUBROLE_LABELS[rawSubRole]) {
        const title = AKADEMIK_SUBROLE_LABELS[rawSubRole];
        return scope ? `${title} ${scope}` : title;
    }

    if (ROLE_DISPLAY_NAMES[rawRole]) {
        const title = ROLE_DISPLAY_NAMES[rawRole];
        return scope ? `${title} ${scope}` : title;
    }

    if (rawSubRole && TENDIK_SUBROLE_LABELS[rawSubRole]) {
        return scope ? `${TENDIK_SUBROLE_LABELS[rawSubRole]} (${scope})` : TENDIK_SUBROLE_LABELS[rawSubRole];
    }

    if (!rawRole) return '-';
    const fallback = rawRole.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return scope ? `${fallback} (${scope})` : fallback;
}
