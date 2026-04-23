export const renderStep4Submit = (formData: any) => `
    <div class="animate-enter-right space-y-8 text-center py-8">
        <div class="w-20 h-20 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        </div>
        <div class="max-w-md mx-auto">
            <h3 class="text-2xl font-black text-gray-800 mb-2">Siap untuk Kirim?</h3>
            <p class="text-gray-500 text-sm leading-relaxed">
                Pastikan semua data yang Anda masukkan sudah benar. Setelah dikirim, Anda tidak dapat mengubah data sampai proses verifikasi selesai.
            </p>
        </div>
        
        <div class="bg-gray-50 rounded-2xl p-6 text-left space-y-4 max-w-lg mx-auto">
            <div class="flex justify-between items-center text-xs border-b border-gray-200 pb-2">
                <span class="text-gray-400 uppercase font-bold tracking-widest">Nama Beasiswa</span>
                <span class="text-gray-800 font-bold">${formData.scholarship_name || '-'}</span>
            </div>
            <div class="flex justify-between items-center text-xs border-b border-gray-200 pb-2">
                <span class="text-gray-400 uppercase font-bold tracking-widest">Semester / IPK</span>
                <span class="text-gray-800 font-bold">Sem ${formData.current_semester || '-'} / ${formData.ipk || '-'}</span>
            </div>
            <div class="flex justify-between items-center text-xs border-b border-gray-200 pb-2">
                <span class="text-gray-400 uppercase font-bold tracking-widest">Cuti / Skripsi</span>
                <span class="text-gray-800 font-bold">${formData.on_leave || 'Belum'} / ${formData.thesis_status || 'Belum'}</span>
            </div>
            <div class="flex justify-between items-center text-xs">
                <span class="text-gray-400 uppercase font-bold tracking-widest">NIM Anda</span>
                <span class="text-gray-800 font-bold">${formData.nim || '-'}</span>
            </div>
        </div>
        <div class="pt-4 max-w-lg mx-auto">
            <label class="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer group hover:bg-amber-100/50 transition-colors">
                <input type="checkbox" id="agree-terms" class="mt-1 w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500">
                <span class="text-sm text-amber-900 leading-relaxed font-medium">
                    Saya menyatakan bahwa seluruh data yang saya isikan adalah benar dan dapat dipertanggungjawabkan.
                </span>
            </label>
        </div>
    </div>
`;
