export const renderStep1Biodata = (formData: any) => {
    const labelClass = "text-sm font-bold text-gray-700 w-full md:w-48 shrink-0";
    const readonlyInputClass = "w-full px-4 py-2.5 bg-gray-100 border border-transparent rounded-lg text-gray-500 outline-none transition-all text-sm font-medium cursor-not-allowed";

    return `
    <div class="animate-enter-right space-y-10 pb-10">
        <!-- Section Header -->
        <div class="space-y-1">
            <h3 class="text-xl font-bold text-gray-800">Profil SSO</h3>
            <p class="text-sm text-gray-400">Data akademik Anda yang terdaftar pada sistem SSO</p>
        </div>

        <!-- Form Rows -->
        <div class="space-y-6">
            <!-- Nama Lengkap -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Nama Lengkap</label>
                <div class="flex-1">
                    <input type="text" name="full_name" value="${formData.full_name || ''}" readonly class="${readonlyInputClass}">
                </div>
            </div>

            <!-- NIM -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">NIM</label>
                <div class="flex-1">
                    <input type="text" name="nim" value="${formData.nim || ''}" readonly class="${readonlyInputClass}">
                </div>
            </div>

            <!-- Fakultas -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Fakultas</label>
                <div class="flex-1">
                    <input type="text" name="faculty" value="${formData.faculty || ''}" readonly class="${readonlyInputClass}">
                </div>
            </div>

            <!-- Program Studi -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Program Studi</label>
                <div class="flex-1">
                    <input type="text" name="study_program" value="${formData.study_program || ''}" readonly class="${readonlyInputClass}">
                </div>
            </div>

            <!-- Email Aktif -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <label class="${labelClass}">Email Aktif</label>
                <div class="flex-1">
                    <input type="email" name="email" value="${formData.email || ''}" readonly class="${readonlyInputClass}">
                </div>
            </div>
        </div>
    </div>
    `;
};
