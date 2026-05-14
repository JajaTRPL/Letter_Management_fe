export const findRelasi = (keluarga: any[], rel: string) =>
    keluarga.find((k: any) => k.jenis_relasi?.toLowerCase() === rel.toLowerCase()) || {};

/**
 * Pull current_semester from any of the backend payload shapes that expose it.
 * Order: explicit current_semester on the source itself, then the nested student/normalized/academic_context fallbacks.
 * Returns the first non-empty value, or null when nothing is available.
 */
export const resolveCurrentSemester = (sources: Array<any>): number | string | null => {
    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;
        const direct = source.current_semester;
        if (direct !== null && direct !== undefined && direct !== '') return direct;
        const nested = source.student?.current_semester
            ?? source.normalized_student?.current_semester
            ?? source.academic_context?.current_semester;
        if (nested !== null && nested !== undefined && nested !== '') return nested;
    }
    return null;
};

export const mapApplicationToFormData = (app: any, formData: any) => {
    const profile = app.mahasiswa_profile || app.mahasiswaProfile || {};
    const keluarga = profile.keluarga || [];

    const father = findRelasi(keluarga, 'ayah');
    const mother = findRelasi(keluarga, 'ibu');
    const guardian = findRelasi(keluarga, 'wali');
    const siblings = keluarga.filter((k: any) => k.jenis_relasi?.toLowerCase() === 'saudara').map((s: any) => ({
        name: s.nama_lengkap,
        job_or_school: s.pekerjaan,
        marital_status: s.status_kawin,
        relation: s.keterangan
    }));

    const scholarship_histories = profile.scholarship_histories || [];

    return {
        ...app,
        nim: profile.nim,
        faculty: app.user?.study_program?.department?.faculty?.name || '',
        study_program: app.user?.study_program?.name || '',
        pob: profile.tempat_lahir,
        dob: profile.tanggal_lahir,
        gender: profile.jenis_kelamin === 'L' ? 'Laki-laki' : (profile.jenis_kelamin === 'P' ? 'Perempuan' : ''),
        origin_address: profile.alamat_asal,
        jogja_address: profile.alamat_domisili,
        phone: profile.no_hp || profile.phone || profile.no_telp || '',
        father_name: father.nama_lengkap,
        father_job: father.pekerjaan,
        father_income: father.penghasilan,
        father_status: father.status_hidup ? father.status_hidup.charAt(0).toUpperCase() + father.status_hidup.slice(1) : 'Hidup',
        father_death_date: father.tanggal_meninggal ? father.tanggal_meninggal.split('T')[0] : '',
        mother_name: mother.nama_lengkap,
        mother_job: mother.pekerjaan,
        mother_income: mother.penghasilan,
        mother_status: mother.status_hidup ? mother.status_hidup.charAt(0).toUpperCase() + mother.status_hidup.slice(1) : 'Hidup',
        mother_death_date: mother.tanggal_meninggal ? mother.tanggal_meninggal.split('T')[0] : '',
        guardian_name: guardian.nama_lengkap,
        guardian_job: guardian.pekerjaan,
        guardian_income: guardian.penghasilan,
        guardian_status: guardian.status_hidup ? guardian.status_hidup.charAt(0).toUpperCase() + guardian.status_hidup.slice(1) : 'Hidup',
        guardian_death_date: guardian.tanggal_meninggal ? guardian.tanggal_meninggal.split('T')[0] : '',
        pas_foto_path: profile.pas_foto_path,
        tanda_tangan_path: profile.tanda_tangan_path,
        siblings: siblings.length > 0 ? siblings : formData.siblings,
        scholarship_histories: scholarship_histories.length > 0 ? scholarship_histories : formData.scholarship_histories,

        // Academic fields
        scholarship_name: app.scholarship_name,
        study_level: app.study_level || 'D4',
        current_semester: app.current_semester ?? resolveCurrentSemester([app]),
        family_dependents: app.family_dependents,
        gpa_last_2_semesters: app.gpa_last_2_semesters,
        ipk: app.ipk,
        sks_last_2_semesters: app.sks_last_2_semesters,
        total_sks_passed: app.total_sks_passed,
        total_sks_required: app.total_sks_required,
        on_leave: app.on_leave || 'Belum',
        leave_semester: app.leave_semester,
        thesis_status: app.thesis_status || 'Belum',
        exam_plan_date: app.exam_plan_date,
        has_scholarship_history: app.has_scholarship_history,
        ktm_path: app.ktm_path
    };
};

export const mapProfileToFormData = (
    profile: any,
    user: any = {},
    formData: any = { siblings: [], scholarship_histories: [] },
    extras: any = {}
) => {
    const keluarga = profile.keluarga || [];
    const father = findRelasi(keluarga, 'ayah');
    const mother = findRelasi(keluarga, 'ibu');
    const guardian = findRelasi(keluarga, 'wali');
    const siblings = keluarga.filter((k: any) => k.jenis_relasi?.toLowerCase() === 'saudara').map((s: any) => ({
        name: s.nama_lengkap,
        job_or_school: s.pekerjaan,
        marital_status: s.status_kawin,
        relation: s.keterangan
    }));

    const scholarship_histories = profile.scholarship_histories || [];

    return {
        full_name: user?.name || '',
        email: user?.email || '',
        nim: profile.nim,
        faculty: user?.study_program?.department?.faculty?.name || '',
        study_program: user?.study_program?.name || '',
        pob: profile.tempat_lahir,
        dob: profile.tanggal_lahir ? profile.tanggal_lahir.split('T')[0] : '',
        gender: profile.jenis_kelamin === 'L' ? 'Laki-laki' : (profile.jenis_kelamin === 'P' ? 'Perempuan' : ''),
        origin_address: profile.alamat_asal,
        jogja_address: profile.alamat_domisili,
        father_name: father.nama_lengkap,
        father_job: father.pekerjaan,
        father_income: father.penghasilan,
        father_status: father.status_hidup ? father.status_hidup.charAt(0).toUpperCase() + father.status_hidup.slice(1) : 'Hidup',
        father_death_date: father.tanggal_meninggal ? father.tanggal_meninggal.split('T')[0] : '',
        mother_name: mother.nama_lengkap,
        mother_job: mother.pekerjaan,
        mother_income: mother.penghasilan,
        mother_status: mother.status_hidup ? mother.status_hidup.charAt(0).toUpperCase() + mother.status_hidup.slice(1) : 'Hidup',
        mother_death_date: mother.tanggal_meninggal ? mother.tanggal_meninggal.split('T')[0] : '',
        guardian_name: guardian.nama_lengkap,
        guardian_job: guardian.pekerjaan,
        guardian_income: guardian.penghasilan,
        guardian_status: guardian.status_hidup ? guardian.status_hidup.charAt(0).toUpperCase() + guardian.status_hidup.slice(1) : 'Hidup',
        guardian_death_date: guardian.tanggal_meninggal ? guardian.tanggal_meninggal.split('T')[0] : '',
        phone: profile.no_hp || profile.phone || profile.no_telp || profile.phoneNumber || '',
        pas_foto_path: profile.pas_foto_path,
        tanda_tangan_path: profile.tanda_tangan_path,
        siblings: siblings.length > 0 ? siblings : formData.siblings,
        scholarship_histories: scholarship_histories.length > 0 ? scholarship_histories : formData.scholarship_histories,
        current_semester: resolveCurrentSemester([extras?.student, extras?.normalized, extras])
    };
};
