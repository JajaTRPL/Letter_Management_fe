export const renderStep3Submit = (formData: any) => {
    const formattedDate = formData.dob ? new Date(formData.dob).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) : '-';

    // Refined colors and spacing based on the reference image
    const cardClass = "bg-[#f1f5f9] p-6 md:p-7 rounded-[16px] space-y-4 shadow-sm/5 border border-gray-50";
    const rowClass = "grid grid-cols-[180px_10px_1fr] text-sm md:text-[15px] leading-relaxed";
    const labelClass = "text-gray-600 font-medium";
    const valueClass = "text-gray-900 font-medium ml-1";

    return `
    <div class="animate-enter-right space-y-8 pb-4">
        <!-- Header Section -->
        <div class="space-y-1">
            <h3 class="text-2xl font-bold text-gray-800 tracking-tight">Tinjau Pengajuan</h3>
            <p class="text-[14px] text-gray-500">Periksa kembali kebenaran data yang Anda masukkan</p>
        </div>

        <div class="space-y-5">
            <!-- Section 1: Profil SSO -->
            <div class="${cardClass}">
                <h4 class="text-[16px] font-bold text-gray-800 mb-4">Profil SSO</h4>
                <div class="space-y-2.5">
                    <div class="${rowClass}">
                        <span class="${labelClass}">Nama Lengkap</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.full_name || '-'}</span>
                    </div>
                    <div class="${rowClass}">
                        <span class="${labelClass}">NIM</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.nim || '-'}</span>
                    </div>
                    <div class="${rowClass}">
                        <span class="${labelClass}">Fakultas</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.faculty || '-'}</span>
                    </div>
                    <div class="${rowClass}">
                        <span class="${labelClass}">Program Studi</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.study_program || '-'}</span>
                    </div>
                    <div class="${rowClass}">
                        <span class="${labelClass}">Email Aktif</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.email || '-'}</span>
                    </div>
                </div>
            </div>

            <!-- Section 2: Detail Profil & Pengajuan -->
            <div class="${cardClass}">
                <h4 class="text-[16px] font-bold text-gray-800 mb-4">Detail Profil & Pengajuan</h4>
                <div class="space-y-2.5">
                    <div class="${rowClass}">
                        <span class="${labelClass}">Tempat, Tanggal Lahir</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.pob || ''}${formData.pob && formData.dob ? ', ' : ''}${formattedDate}</span>
                    </div>
                    <div class="${rowClass}">
                        <span class="${labelClass}">Jenis Kelamin</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.gender === 'L' ? 'Laki-laki' : (formData.gender === 'P' ? 'Perempuan' : '-')}</span>
                    </div>
                    <div class="${rowClass}">
                        <span class="${labelClass}">Keperluan</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.keperluan || '-'}</span>
                    </div>
                </div>
            </div>

            <!-- Section 3: Data Orang Tua/Wali -->
            <div class="${cardClass}">
                <h4 class="text-[16px] font-bold text-gray-800 mb-4">Data Orang Tua/Wali</h4>
                <div class="space-y-2.5">
                    <div class="${rowClass}">
                        <span class="${labelClass}">Nama</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.parent_name || '-'}</span>
                    </div>
                    <div class="${rowClass}">
                        <span class="${labelClass}">Pekerjaan</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.parent_job || '-'}</span>
                    </div>
                    <div class="${rowClass}">
                        <span class="${labelClass}">Jenis Pekerjaan</span>
                        <span class="text-gray-400">:</span>
                        <span class="${valueClass}">${formData.parent_job_type || '-'}</span>
                    </div>

                    ${formData.parent_job_type === 'ASN' ? `
                        <div class="${rowClass}">
                            <span class="${labelClass}">NIP</span>
                            <span class="text-gray-400">:</span>
                            <span class="${valueClass}">${formData.parent_nip || '-'}</span>
                        </div>
                        <div class="${rowClass}">
                            <span class="${labelClass}">Pangkat</span>
                            <span class="text-gray-400">:</span>
                            <span class="${valueClass}">${formData.parent_rank || '-'}</span>
                        </div>
                        <div class="${rowClass}">
                            <span class="${labelClass}">Golongan</span>
                            <span class="text-gray-400">:</span>
                            <span class="${valueClass}">${formData.parent_group || '-'}</span>
                        </div>
                        <div class="${rowClass}">
                            <span class="${labelClass}">Instansi</span>
                            <span class="text-gray-400">:</span>
                            <span class="${valueClass}">${formData.parent_institution || '-'}</span>
                        </div>
                    ` : ''}

                    ${formData.parent_job_type === 'Karyawan Swasta' ? `
                        <div class="${rowClass}">
                            <span class="${labelClass}">ID Karyawan</span>
                            <span class="text-gray-400">:</span>
                            <span class="${valueClass}">${formData.parent_employee_id || '-'}</span>
                        </div>
                        <div class="${rowClass}">
                            <span class="${labelClass}">Jabatan</span>
                            <span class="text-gray-400">:</span>
                            <span class="${valueClass}">${formData.parent_position || '-'}</span>
                        </div>
                        <div class="${rowClass}">
                            <span class="${labelClass}">Nama Perusahaan</span>
                            <span class="text-gray-400">:</span>
                            <span class="${valueClass}">${formData.parent_institution || '-'}</span>
                        </div>
                    ` : ''}

                    ${formData.parent_job_type === 'Wiraswasta' ? `
                        <div class="${rowClass}">
                            <span class="${labelClass}">NPWP</span>
                            <span class="text-gray-400">:</span>
                            <span class="${valueClass}">${formData.parent_npwp || '-'}</span>
                        </div>
                        <div class="${rowClass}">
                            <span class="${labelClass}">Nama Usaha</span>
                            <span class="text-gray-400">:</span>
                            <span class="${valueClass}">${formData.parent_business_name || '-'}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>

        <!-- Declaration Section -->
        <div class="pt-6">
            <label class="flex items-start gap-4 cursor-pointer group">
                <div class="relative flex items-center justify-center mt-1 shrink-0">
                    <input type="checkbox" id="agreement-checkbox" class="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-[6px] checked:bg-teal-700 checked:border-teal-700 transition-all cursor-pointer">
                    <svg class="absolute w-4 h-4 text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none" fill="none" stroke="currentColor" stroke-width="4" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <span class="text-[14px] text-gray-600 leading-[1.6] group-hover:text-gray-800 transition-colors font-medium">
                    Dengan ini saya menyatakan bahwa seluruh data yang saya kirimkan adalah benar dan dapat dipertanggungjawabkan
                </span>
            </label>
        </div>
    </div>
    `;
};
