export const renderStep2Keperluan = (formData: any) => {
    const labelClass = "text-sm font-bold text-gray-700 w-full md:w-52 shrink-0";
    const inputClass = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 outline-none transition-all text-sm font-medium placeholder:text-gray-300 placeholder:font-normal text-gray-600";
    const readonlyInputClass = "w-full px-4 py-2.5 bg-gray-100 border border-transparent rounded-xl text-gray-500 outline-none transition-all text-sm font-medium cursor-not-allowed";

    // Formatting date for readable display
    const formattedDate = formData.dob ? new Date(formData.dob).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) : '-';

    return `
    <div class="animate-enter-right space-y-12 pb-10">
        <!-- Section 1: Detail Profil & Pengajuan -->
        <div class="space-y-8">
            <div>
                <h3 class="text-xl font-bold text-gray-800">Detail Profil & Pengajuan</h3>
                <p class="text-sm text-gray-400 mt-1">Lengkapi data berikut sesuai kebutuhan pengajuan surat</p>
            </div>

            <div class="space-y-6">
                <!-- Tempat, Tanggal Lahir -->
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <label class="${labelClass}">Tempat, Tanggal Lahir</label>
                    <div class="flex-1">
                        <input type="text" value="${formData.pob || ''}${formData.pob && formData.dob ? ', ' : ''}${formattedDate}" readonly class="${readonlyInputClass}">
                        <input type="hidden" name="pob" value="${formData.pob || ''}">
                        <input type="hidden" name="dob" value="${formData.dob || ''}">
                    </div>
                </div>

                <!-- Jenis Kelamin -->
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <label class="${labelClass}">Jenis Kelamin</label>
                    <div class="flex-1">
                        <input type="text" value="${formData.gender === 'L' ? 'Laki-laki' : (formData.gender === 'P' ? 'Perempuan' : '-')}" readonly class="${readonlyInputClass}">
                        <input type="hidden" name="gender" value="${formData.gender || ''}">
                    </div>
                </div>

                <!-- Keperluan -->
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <label class="${labelClass}">Keperluan</label>
                    <div class="flex-1">
                        <input type="text" name="keperluan" value="${formData.keperluan || ''}" class="${inputClass}" placeholder="Contoh: Syarat administrasi beasiswa atau keperluan lainnya">
                    </div>
                </div>
            </div>
        </div>

        <div class="h-px bg-gray-200"></div>

        <!-- Section 2: Data Orang Tua/Wali -->
        <div class="space-y-8">
            <h3 class="text-xl font-bold text-gray-800">Data Orang Tua/Wali</h3>

            <div class="space-y-5">
                <!-- Nama -->
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <label class="${labelClass}">Nama</label>
                    <div class="flex-1">
                        <input type="text" name="parent_name" value="${formData.parent_name || ''}" class="${inputClass}" placeholder="Masukkan nama lengkap">
                    </div>
                </div>

                <!-- Pekerjaan -->
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <label class="${labelClass}">Pekerjaan</label>
                    <div class="flex-1">
                        <input type="text" name="parent_job" value="${formData.parent_job || ''}" class="${inputClass}" placeholder="Contoh: Pegawai Swasta">
                    </div>
                </div>

                <!-- Jenis Pekerjaan -->
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <label class="${labelClass}">Jenis Pekerjaan</label>
                    <div class="flex-1 relative group">
                        <select name="parent_job_type" id="parent_job_type_select" class="${inputClass} appearance-none pr-10">
                            <option value="" ${!formData.parent_job_type ? 'selected' : ''} disabled>Pilih jenis pekerjaan</option>
                            <option value="ASN" ${formData.parent_job_type === 'ASN' ? 'selected' : ''}>ASN</option>
                            <option value="Karyawan Swasta" ${formData.parent_job_type === 'Karyawan Swasta' ? 'selected' : ''}>Karyawan Swasta</option>
                            <option value="Wiraswasta" ${formData.parent_job_type === 'Wiraswasta' ? 'selected' : ''}>Wiraswasta</option>
                        </select>
                        <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-teal-500 transition-colors">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Conditional Fields Container -->
                <div id="conditional-fields-container" class="space-y-5">
                    ${renderConditionalFields(formData, labelClass, inputClass)}
                </div>
            </div>
        </div>
    </div>
    `;
};

export const renderConditionalFields = (formData: any, labelClass: string, inputClass: string) => {
    const type = formData.parent_job_type;
    
    if (type === 'ASN') {
        return `
            <!-- NIP -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">NIP</label>
                <div class="flex-1">
                    <input type="text" name="parent_nip" value="${formData.parent_nip || ''}" class="${inputClass}" placeholder="Masukkan NIP">
                </div>
            </div>

            <!-- Pangkat -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Pangkat</label>
                <div class="flex-1">
                    <input type="text" name="parent_rank" value="${formData.parent_rank || ''}" class="${inputClass}" placeholder="Contoh: Penata Muda">
                </div>
            </div>

            <!-- Golongan -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Golongan</label>
                <div class="flex-1">
                    <input type="text" name="parent_group" value="${formData.parent_group || ''}" class="${inputClass}" placeholder="Contoh: III/a">
                </div>
            </div>

            <!-- Instansi -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Instansi</label>
                <div class="flex-1">
                    <input type="text" name="parent_institution" value="${formData.parent_institution || ''}" class="${inputClass}" placeholder="Contoh: Dinas Pendidikan DIY">
                </div>
            </div>
        `;
    } else if (type === 'Karyawan Swasta') {
        return `
            <!-- ID Karyawan -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">ID Karyawan</label>
                <div class="flex-1">
                    <input type="text" name="parent_employee_id" value="${formData.parent_employee_id || ''}" class="${inputClass}" placeholder="Masukkan ID Karyawan">
                </div>
            </div>

            <!-- Jabatan -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Jabatan</label>
                <div class="flex-1">
                    <input type="text" name="parent_position" value="${formData.parent_position || ''}" class="${inputClass}" placeholder="Contoh: Manager Operasional">
                </div>
            </div>

            <!-- Nama Perusahaan -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Nama Perusahaan</label>
                <div class="flex-1">
                    <input type="text" name="parent_institution" value="${formData.parent_institution || ''}" class="${inputClass}" placeholder="Contoh: PT Maju Bersama">
                </div>
            </div>
        `;
    } else if (type === 'Wiraswasta') {
        return `
            <!-- NPWP -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">NPWP</label>
                <div class="flex-1">
                    <input type="text" name="parent_npwp" value="${formData.parent_npwp || ''}" class="${inputClass}" placeholder="Masukkan NPWP Usaha">
                </div>
            </div>

            <!-- Nama Usaha -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Nama Usaha</label>
                <div class="flex-1">
                    <input type="text" name="parent_business_name" value="${formData.parent_business_name || ''}" class="${inputClass}" placeholder="Contoh: Toko Berkah Jaya">
                </div>
            </div>
        `;
    }

    return '';
};
