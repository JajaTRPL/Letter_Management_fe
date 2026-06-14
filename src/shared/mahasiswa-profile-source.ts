import { apiFetch } from './api-client';

// Canonical shape for the "Profil SSO" grid shown across every Mahasiswa
// letter (Beasiswa, SKA, PLN, Magang). Each letter previously inlined its
// own `mapProfileData` and pulled directly from the response of its own
// /draft endpoint — but the per-letter detail endpoints (showForMahasiswa)
// only eager-load `mahasiswaProfile` + `assignedTendik` and therefore omit
// `user.studyProgram.department.faculty`. That made Fakultas / Program
// Studi / Email render as "-" on the detail page even when the canonical
// data was available elsewhere.
//
// As of Global Profile.1 the backend now emits an additive root-level
// `profile_summary` block on every Mahasiswa letter endpoint (draft / show /
// saveDraft / reviewer detail / dashboards), already pre-normalised (e.g.
// `tanggal_lahir` is a bare `YYYY-MM-DD`). The merger therefore takes
// `profile_summary.*` as the HIGHEST-precedence canonical source and keeps
// the older paths intact as defensive fallback for any response that
// pre-dates Global Profile.1 (or any future endpoint we haven't migrated).
//
// This module is the one shared source of truth. Each letter form passes
// in whatever response payloads it has (any combination of /draft, /api/profile,
// and the detail-page `application` payload) and the merger picks the first
// real value through a documented precedence chain.

export type MahasiswaProfileDisplay = {
    fullName: string;
    nim: string;
    email: string;
    phone: string;
    faculty: string;
    studyProgram: string;
    studyProgramCode: string;
    department: string;
    // Identity-detail fields (sourced from `profile_summary` when available,
    // otherwise legacy `mahasiswaProfile`). `tanggalLahir` is always emitted
    // as `YYYY-MM-DD` when present — Global Profile.1 backend already returns
    // it normalised, and the legacy regex fallback below extracts the
    // leading date portion to avoid the Jakarta-TZ off-by-one bug.
    tempatLahir: string;
    tanggalLahir: string;
    jenisKelamin: string;
    currentSemester: number | null;
};

// A single response payload, in any of the shapes the backend currently emits.
// All keys are optional; the merger tolerates missing layers without throwing.
export type MahasiswaProfileSource = {
    profile_summary?: any;
    user?: any;
    profile?: any;
    normalized?: any;
    student?: any;
    application?: any;
};

const toTrimmedString = (value: unknown): string => {
    if (value == null) return '';
    return String(value).trim();
};

const pickFirstString = (
    sources: readonly MahasiswaProfileSource[],
    paths: ReadonlyArray<(src: MahasiswaProfileSource) => unknown>,
): string => {
    for (const src of sources) {
        if (!src) continue;
        for (const path of paths) {
            try {
                const candidate = toTrimmedString(path(src));
                if (candidate) return candidate;
            } catch {
                // Defensive: if a nested access throws (e.g. a Proxy in
                // tests), skip to the next path rather than blowing up the
                // page render.
            }
        }
    }
    return '';
};

const pickFirstPositiveInteger = (
    sources: readonly MahasiswaProfileSource[],
    paths: ReadonlyArray<(src: MahasiswaProfileSource) => unknown>,
): number | null => {
    for (const src of sources) {
        if (!src) continue;
        for (const path of paths) {
            try {
                const raw = path(src);
                if (raw == null || raw === '') continue;
                const num = typeof raw === 'number' ? raw : Number(raw);
                if (Number.isFinite(num) && num > 0) return num;
            } catch {
                // ignore and try next path
            }
        }
    }
    return null;
};

// Extract the leading YYYY-MM-DD portion of any value. `profile_summary`
// already returns this shape, so it's a no-op in the happy path. The
// fallback paths protect against the legacy Carbon-Jakarta serialisation
// (e.g. "2004-03-15T17:00:00.000000Z" for a stored 2004-03-16) — but for
// the off-by-one case the per-letter `normalizeDateOnly` is still in
// charge; this helper deliberately only does a regex extract so it never
// "fixes" a date in a way that disagrees with the identity-lock flow.
const toDateOnly = (value: unknown): string => {
    const s = toTrimmedString(value);
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const match = s.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
};

const readAuthNameFallback = (): string => {
    try {
        if (typeof localStorage === 'undefined') return '';
        return toTrimmedString(localStorage.getItem('auth_name'));
    } catch {
        return '';
    }
};

// Merge any number of response shapes into one display object. Precedence
// inside each field tries the most canonical / freshest source first and
// falls back through progressively less authoritative ones; the localStorage
// `auth_name` is the last resort for the student name (existing behaviour
// preserved from the per-letter mappers).
export const mergeMahasiswaProfileDisplay = (
    ...sources: MahasiswaProfileSource[]
): MahasiswaProfileDisplay => {
    const fullName = pickFirstString(sources, [
        s => s.profile_summary?.full_name,
        s => s.user?.name,
        s => s.application?.user?.name,
        s => s.normalized?.name,
        s => s.student?.name,
        s => s.profile?.nama_lengkap,
    ]) || readAuthNameFallback();

    const tanggalLahir = (() => {
        for (const src of sources) {
            if (!src) continue;
            const summaryDate = toDateOnly(src.profile_summary?.tanggal_lahir);
            if (summaryDate) return summaryDate;
            const profileDate = toDateOnly(src.profile?.tanggal_lahir);
            if (profileDate) return profileDate;
            const appDate = toDateOnly(src.application?.mahasiswa_profile?.tanggal_lahir);
            if (appDate) return appDate;
        }
        return '';
    })();

    return {
        fullName,
        nim: pickFirstString(sources, [
            s => s.profile_summary?.nim,
            s => s.profile?.nim,
            s => s.application?.mahasiswa_profile?.nim,
            s => s.application?.mahasiswaProfile?.nim,
            s => s.normalized?.nim,
            s => s.student?.nim,
        ]),
        email: pickFirstString(sources, [
            s => s.profile_summary?.email,
            s => s.user?.email,
            s => s.application?.user?.email,
            s => s.normalized?.email,
            s => s.student?.email,
        ]),
        // No. Telepon — canonical source is MahasiswaProfile.no_hp. The detail
        // endpoints serialise the raw relation (column `no_hp`); `profile_summary`
        // does not carry phone today, so the legacy `no_telp` alias and the
        // scholarship `student.phone` are kept as defensive fallbacks. Never
        // localStorage, never invented.
        phone: pickFirstString(sources, [
            s => s.profile_summary?.no_hp,
            s => s.profile?.no_hp,
            s => s.profile?.no_telp,
            s => s.profile?.phone,
            s => s.profile?.phone_number,
            s => s.application?.mahasiswa_profile?.no_hp,
            s => s.application?.mahasiswa_profile?.no_telp,
            s => s.application?.mahasiswaProfile?.no_hp,
            s => s.application?.mahasiswaProfile?.noHp,
            s => s.student?.phone,
        ]),
        faculty: pickFirstString(sources, [
            s => s.profile_summary?.faculty,
            s => s.user?.study_program?.department?.faculty?.name,
            s => s.application?.user?.study_program?.department?.faculty?.name,
            s => s.normalized?.fakultas_display,
            s => s.student?.fakultas_display,
            s => s.student?.faculty?.name,
            s => s.profile?.fakultas,
        ]),
        studyProgram: pickFirstString(sources, [
            s => s.profile_summary?.study_program,
            s => s.user?.study_program?.name,
            s => s.application?.user?.study_program?.name,
            s => s.normalized?.program_studi_display,
            s => s.student?.program_studi_display,
            s => s.student?.study_program?.name,
            s => s.profile?.program_studi,
        ]),
        studyProgramCode: pickFirstString(sources, [
            s => s.profile_summary?.study_program_code,
            s => s.user?.study_program?.code,
            s => s.application?.user?.study_program?.code,
            s => s.normalized?.study_program_code,
            s => s.student?.study_program?.code,
        ]),
        department: pickFirstString(sources, [
            s => s.profile_summary?.department,
            s => s.user?.study_program?.department?.name,
            s => s.application?.user?.study_program?.department?.name,
            s => s.normalized?.department_display,
            s => s.student?.department_display,
            s => s.student?.department?.name,
        ]),
        tempatLahir: pickFirstString(sources, [
            s => s.profile_summary?.tempat_lahir,
            s => s.profile?.tempat_lahir,
            s => s.application?.mahasiswa_profile?.tempat_lahir,
        ]),
        tanggalLahir,
        jenisKelamin: pickFirstString(sources, [
            s => s.profile_summary?.jenis_kelamin,
            s => s.profile?.jenis_kelamin,
            s => s.application?.mahasiswa_profile?.jenis_kelamin,
        ]),
        currentSemester: pickFirstPositiveInteger(sources, [
            s => s.profile_summary?.current_semester,
            s => s.normalized?.current_semester,
            s => s.student?.current_semester,
            s => s.application?.current_semester,
        ]),
    };
};

// Best-effort canonical-profile fetch. Each letter calls this in parallel
// with its own /draft or detail endpoint so the merger has a complete user
// + study_program tree even when the letter response omits it. Network /
// auth failures silently return an empty source — the merger will then fall
// back to whatever the letter response carries.
//
// NOTE: with Global Profile.1 most letter endpoints now return their own
// `profile_summary` block, so callers do NOT need to fetch /api/profile
// just for the SSO grid. This helper is kept only for the SKA form (which
// still needs `profile.keluarga` for parent/wali prefill) and as a
// defensive escape hatch.
export const fetchMahasiswaProfileExtras = async (): Promise<MahasiswaProfileSource> => {
    try {
        const response = await apiFetch('/api/profile', { cache: 'no-store' });
        if (!response.ok) return {};
        const payload = await response.json();
        return {
            user: payload?.user,
            profile: payload?.profile,
            normalized: payload?.normalized,
            student: payload?.student,
        };
    } catch {
        return {};
    }
};
