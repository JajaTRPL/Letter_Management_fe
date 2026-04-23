export const renderStep1Biodata = (formData: any) => `
    <div class="animate-enter-right space-y-6">
        <div class="border-l-4 border-primary-teal pl-4 mb-8">
            <h3 class="text-xl font-bold text-gray-800">Biodata Mahasiswa</h3>
            <p class="text-sm text-gray-500">Pastikan data akademik Anda sudah benar.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2 space-y-2">
                <label class="text-sm font-bold text-gray-700">Nama Lengkap</label>
                <input type="text" name="full_name" value="${formData.full_name || ''}" readonly class="w-full px-5 py-3.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed outline-none transition-all font-medium">
            </div>
            <div class="space-y-2">
                <label class="text-sm font-bold text-gray-700">Nomor Induk Mahasiswa (NIM)</label>
                <input type="text" name="nim" value="${formData.nim || ''}" readonly class="w-full px-5 py-3.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed outline-none transition-all font-medium" placeholder="Contoh: 21/123456/TK/12345">
            </div>
            <div class="space-y-2">
                <label class="text-sm font-bold text-gray-700">Email Aktif</label>
                <input type="email" name="email" value="${formData.email || ''}" readonly class="w-full px-5 py-3.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed outline-none transition-all font-medium">
            </div>
            <div class="space-y-2">
                <label class="text-sm font-bold text-gray-700">Fakultas</label>
                <input type="text" name="faculty" value="${formData.faculty || ''}" readonly class="w-full px-5 py-3.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed outline-none transition-all font-medium">
            </div>
            <div class="space-y-2">
                <label class="text-sm font-bold text-gray-700">Program Studi</label>
                <input type="text" name="study_program" value="${formData.study_program || ''}" readonly class="w-full px-5 py-3.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed outline-none transition-all font-medium" placeholder="Contoh: Teknologi Informasi">
            </div>
        </div>
    </div>
`;
