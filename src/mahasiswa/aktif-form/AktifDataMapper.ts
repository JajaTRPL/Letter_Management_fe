/**
 * Map API response (MahasiswaProfile) to Frontend Form Data for Aktif Letter
 */
export const mapProfileToFormData = (profile: any, user: any, existingData: any = {}) => {
    return {
        ...existingData,
        full_name: user.name || existingData.full_name,
        nim: profile.nim || existingData.nim,
        email: user.email || existingData.email,
        faculty: user.study_program?.department?.faculty?.name || profile.fakultas || existingData.faculty,
        study_program: user.study_program?.name || profile.program_studi || existingData.study_program,
        pob: profile.tempat_lahir || existingData.pob,
        dob: profile.tanggal_lahir || existingData.dob,
        gender: profile.jenis_kelamin || existingData.gender,
    };
};

/**
 * Map API response (AktifApplication) to Frontend Form Data
 */
export const mapApplicationToFormData = (app: any, existingData: any = {}) => {
    if (!app) return existingData;
    
    return {
        ...existingData,
        id: app.id,
        keperluan: app.keperluan || existingData.keperluan,
        tujuan_surat: app.tujuan_surat || existingData.tujuan_surat,
        pob: app.pob || existingData.pob,
        dob: app.dob || existingData.dob,
        gender: app.gender || existingData.gender,
        parent_name: app.parent_name || existingData.parent_name,
        parent_job: app.parent_job || existingData.parent_job,
        parent_job_type: app.parent_job_type || existingData.parent_job_type,
        parent_nip: app.parent_nip || existingData.parent_nip,
        parent_rank: app.parent_rank || existingData.parent_rank,
        parent_group: app.parent_group || existingData.parent_group,
        parent_institution: app.parent_institution || existingData.parent_institution,
        parent_employee_id: app.parent_employee_id || existingData.parent_employee_id,
        parent_position: app.parent_position || existingData.parent_position,
        parent_npwp: app.parent_npwp || existingData.parent_npwp,
        parent_business_name: app.parent_business_name || existingData.parent_business_name,
    };
};
