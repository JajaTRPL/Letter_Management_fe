export const renderSectionSSO = () => `
    <div class="bg-gray-50/80 rounded-[24px] p-8 border border-gray-200">
        <h3 class="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <svg class="text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Profil SSO (Read-only)
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">Nama Lengkap</label>
                <input type="text" id="sso_nama" readonly class="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed font-medium">
            </div>
            <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">NIM</label>
                <input type="text" id="sso_nim" readonly class="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed font-medium">
            </div>
            <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">Fakultas</label>
                <input type="text" id="sso_fakultas" readonly class="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed font-medium">
            </div>
            <div class="space-y-2">
                <label class="block text-sm font-semibold text-gray-700">Program Studi</label>
                <input type="text" id="sso_program_studi" readonly class="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed font-medium">
            </div>
            <div class="space-y-2 md:col-span-2">
                <label class="block text-sm font-semibold text-gray-700">Email UGM</label>
                <input type="text" id="sso_email" readonly class="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed font-medium">
            </div>
        </div>
    </div>
`;
