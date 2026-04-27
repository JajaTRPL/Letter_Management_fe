import { apiFetch } from '../../shared/api-client';
import { showSuccess, showError } from '../../shared/toast';

export const initProfilMahasiswaLogic = () => {
    const form = document.getElementById('form-update-profil');
    const btnEditProfil = document.getElementById('btn-edit-profil');
    const btnBatalEdit = document.getElementById('btn-batal-edit');
    const btnSimpanProfil = document.getElementById('btn-simpan-profil');
    const btnTambahSaudara = document.getElementById('btn-tambah-saudara');
    const tbody = document.getElementById('saudara-tbody');
    const btnTambahBeasiswa = document.getElementById('btn-tambah-beasiswa');
    const beasiswaTbody = document.getElementById('beasiswa-tbody');

    document.getElementById('btn-back-dashboard')?.addEventListener('click', () => {
        import('../../dashboard/MahasiswaDashboard').then(({ renderMahasiswaDashboard }) => {
            renderMahasiswaDashboard();
        });
    });

    const hapusSaudara = (e: Event) => {
        const btn = e.currentTarget as HTMLElement;
        const tr = btn.closest('tr');
        if (tr) {
            tr.remove();
        }
    };

    const bindHapusButtons = () => {
        document.querySelectorAll('.btn-hapus-saudara').forEach(btn => {
            btn.removeEventListener('click', hapusSaudara);
            btn.addEventListener('click', hapusSaudara);
        });
    };

    const updateBeasiswaCounter = () => {
        const counter = document.getElementById('beasiswa-counter');
        const count = beasiswaTbody?.children.length || 0;
        if (counter) counter.textContent = `${count} / 5`;
        if (btnTambahBeasiswa) {
            if (count >= 5) {
                btnTambahBeasiswa.classList.add('opacity-40', 'pointer-events-none');
            } else {
                btnTambahBeasiswa.classList.remove('opacity-40', 'pointer-events-none');
            }
        }
    };

    const hapusBeasiswa = (e: Event) => {
        const btn = e.currentTarget as HTMLElement;
        const tr = btn.closest('tr');
        if (tr) {
            tr.remove();
            updateBeasiswaCounter();
        }
    };

    const bindHapusBeasiswaButtons = () => {
        document.querySelectorAll('.btn-hapus-beasiswa').forEach(btn => {
            btn.removeEventListener('click', hapusBeasiswa);
            btn.addEventListener('click', hapusBeasiswa);
        });
    };

    const addBeasiswaRow = (nama = '', periode = '', jumlah = '', status = 'Selesai') => {
        if (!beasiswaTbody) return;
        if (beasiswaTbody.children.length >= 5) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-800"><input type="text" value="${nama}" placeholder="Nama beasiswa" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
            <td class="px-6 py-4"><input type="text" value="${periode}" placeholder="cth: 2024/2025" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
            <td class="px-6 py-4"><input type="text" value="${jumlah}" placeholder="cth: 5000000" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
            <td class="px-6 py-4">
                <select class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold">
                    <option ${status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                    <option ${status === 'Aktif' ? 'selected' : ''}>Aktif</option>
                </select>
            </td>
            <td class="px-6 py-4 text-center">
                <button type="button" class="btn-hapus-beasiswa text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </td>
        `;
        beasiswaTbody.appendChild(tr);
        bindHapusBeasiswaButtons();
        updateBeasiswaCounter();
    };

    const toggleEditMode = (isEditing: boolean) => {
        if (btnEditProfil) btnEditProfil.classList.toggle('hidden', isEditing);
        if (btnBatalEdit) btnBatalEdit.classList.toggle('hidden', !isEditing);
        if (btnSimpanProfil) btnSimpanProfil.classList.toggle('hidden', !isEditing);
        if (btnTambahSaudara) btnTambahSaudara.classList.toggle('hidden', !isEditing);
        if (btnTambahBeasiswa) btnTambahBeasiswa.classList.toggle('hidden', !isEditing);

        if (form) {
            const inputs = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:not([readonly]), select, textarea');
            inputs.forEach(input => {
                if (!isEditing) {
                    input.classList.add('bg-gray-50', 'text-gray-500', 'pointer-events-none');
                    input.classList.remove('bg-white');
                } else {
                    input.classList.remove('bg-gray-50', 'text-gray-500', 'pointer-events-none');
                    input.classList.add('bg-white');
                }
            });

            const deleteBtns = form.querySelectorAll('.btn-hapus-saudara, .btn-hapus-beasiswa');
            deleteBtns.forEach(btn => {
                if (isEditing) {
                    btn.classList.remove('hidden');
                } else {
                    btn.classList.add('hidden');
                }
            });

            const fileLabels = form.querySelectorAll('input[type="file"]');
            fileLabels.forEach(fileInput => {
                const label = fileInput.closest('label');
                if (label) {
                    if (isEditing) {
                        label.classList.remove('pointer-events-none', 'opacity-60');
                    } else {
                        label.classList.add('pointer-events-none', 'opacity-60');
                    }
                }
            });
        }
    };

    if (btnEditProfil) {
        btnEditProfil.addEventListener('click', () => toggleEditMode(true));
    }

    if (btnBatalEdit) {
        btnBatalEdit.addEventListener('click', () => toggleEditMode(false));
    }

    async function loadProfile() {
        try {
            const res = await apiFetch('/api/profile', {
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                const profile = data.profile;
                const user = data.user;

                if (user) {
                    if (document.getElementById('sso_nama')) (document.getElementById('sso_nama') as HTMLInputElement).value = user.name || '';
                    if (document.getElementById('sso_email')) (document.getElementById('sso_email') as HTMLInputElement).value = user.email || '';
                }

                if (profile) {
                    if (document.getElementById('sso_nim')) (document.getElementById('sso_nim') as HTMLInputElement).value = profile.nim || '';

                    // Use relational chain from user (not legacy string fields)
                    const sp = user?.study_program;
                    if (document.getElementById('sso_program_studi')) (document.getElementById('sso_program_studi') as HTMLInputElement).value = sp ? `${sp.code} — ${sp.name}` : '';
                    if (document.getElementById('sso_departemen')) (document.getElementById('sso_departemen') as HTMLInputElement).value = sp?.department ? `${sp.department.code} — ${sp.department.name}` : '';
                    if (document.getElementById('sso_fakultas')) (document.getElementById('sso_fakultas') as HTMLInputElement).value = sp?.department?.faculty?.name || '';

                    if (document.getElementById('tempat_lahir')) (document.getElementById('tempat_lahir') as HTMLInputElement).value = profile.tempat_lahir || '';
                    if (document.getElementById('tanggal_lahir')) (document.getElementById('tanggal_lahir') as HTMLInputElement).value = profile.tanggal_lahir?.split('T')[0] || '';
                    if (document.getElementById('jenis_kelamin')) (document.getElementById('jenis_kelamin') as HTMLSelectElement).value = profile.jenis_kelamin || '';
                    if (document.getElementById('no_hp')) (document.getElementById('no_hp') as HTMLInputElement).value = profile.no_hp || '';
                    if (document.getElementById('alamat_asal')) (document.getElementById('alamat_asal') as HTMLTextAreaElement).value = profile.alamat_asal || '';
                    if (document.getElementById('alamat_domisili')) (document.getElementById('alamat_domisili') as HTMLTextAreaElement).value = profile.alamat_domisili || '';

                    if (profile.keluarga && Array.isArray(profile.keluarga)) {
                        const tbody = document.getElementById('saudara-tbody');
                        if (tbody) tbody.innerHTML = '';

                        profile.keluarga.forEach((k: any) => {
                            if (k.jenis_relasi === 'ayah') {
                                if (document.getElementById('ayah_nama')) (document.getElementById('ayah_nama') as HTMLInputElement).value = k.nama_lengkap || '';
                                if (document.getElementById('ayah_pekerjaan')) (document.getElementById('ayah_pekerjaan') as HTMLInputElement).value = k.pekerjaan || '';
                                if (document.getElementById('ayah_penghasilan')) (document.getElementById('ayah_penghasilan') as HTMLInputElement).value = k.penghasilan || '';
                                if (document.getElementById('ayah_status')) (document.getElementById('ayah_status') as HTMLSelectElement).value = k.status_hidup || 'hidup';
                                if (document.getElementById('ayah_tgl_meninggal')) (document.getElementById('ayah_tgl_meninggal') as HTMLInputElement).value = k.tanggal_meninggal?.split('T')[0] || '';
                            } else if (k.jenis_relasi === 'ibu') {
                                if (document.getElementById('ibu_nama')) (document.getElementById('ibu_nama') as HTMLInputElement).value = k.nama_lengkap || '';
                                if (document.getElementById('ibu_pekerjaan')) (document.getElementById('ibu_pekerjaan') as HTMLInputElement).value = k.pekerjaan || '';
                                if (document.getElementById('ibu_penghasilan')) (document.getElementById('ibu_penghasilan') as HTMLInputElement).value = k.penghasilan || '';
                                if (document.getElementById('ibu_status')) (document.getElementById('ibu_status') as HTMLSelectElement).value = k.status_hidup || 'hidup';
                                if (document.getElementById('ibu_tgl_meninggal')) (document.getElementById('ibu_tgl_meninggal') as HTMLInputElement).value = k.tanggal_meninggal?.split('T')[0] || '';
                            } else if (k.jenis_relasi === 'wali') {
                                if (document.getElementById('wali_nama')) (document.getElementById('wali_nama') as HTMLInputElement).value = k.nama_lengkap || '';
                                if (document.getElementById('wali_pekerjaan')) (document.getElementById('wali_pekerjaan') as HTMLInputElement).value = k.pekerjaan || '';
                                if (document.getElementById('wali_penghasilan')) (document.getElementById('wali_penghasilan') as HTMLInputElement).value = k.penghasilan || '';
                                if (document.getElementById('wali_status')) (document.getElementById('wali_status') as HTMLSelectElement).value = k.status_hidup || 'hidup';
                            } else if (k.jenis_relasi === 'saudara' && tbody) {
                                const rowIndex = tbody.children.length;
                                const tr = document.createElement('tr');
                                tr.innerHTML = `
                                    <td class="px-6 py-4 font-medium text-gray-800"><input type="text" value="${k.nama_lengkap || ''}" placeholder="Nama saudara" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                                    <td class="px-6 py-4"><input type="text" value="${k.pekerjaan || ''}" placeholder="Pekerjaan/Sekolah" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold"></td>
                                    <td class="px-6 py-4">
                                        <select class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none text-sm bg-white text-gray-700 font-bold">
                                            <option ${k.status_kawin === 'Belum Kawin' ? 'selected' : ''}>Belum Kawin</option>
                                            <option ${k.status_kawin === 'Sudah Kawin' ? 'selected' : ''}>Sudah Kawin</option>
                                        </select>
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-4">
                                            <label class="flex items-center gap-1.5 cursor-pointer">
                                                <input type="radio" name="ket_saudara_load_${rowIndex}" value="Kakak" ${k.keterangan === 'Kakak' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                                                <span class="text-sm text-gray-700 font-bold">Kakak</span>
                                            </label>
                                            <label class="flex items-center gap-1.5 cursor-pointer">
                                                <input type="radio" name="ket_saudara_load_${rowIndex}" value="Adik" ${k.keterangan === 'Adik' ? 'checked' : ''} class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                                                <span class="text-sm text-gray-700 font-bold">Adik</span>
                                            </label>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-center">
                                        <button type="button" class="btn-hapus-saudara text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </td>
                                `;
                                tbody.appendChild(tr);
                            }
                        });
                    }

                    if (profile.scholarship_histories && Array.isArray(profile.scholarship_histories)) {
                        if (beasiswaTbody) beasiswaTbody.innerHTML = '';
                        profile.scholarship_histories.forEach((sh: any) => {
                            addBeasiswaRow(sh.nama_beasiswa || '', sh.periode || '', sh.jumlah || '', sh.status || 'Selesai');
                        });
                    }
                    updateBeasiswaCounter();

                    if (profile.pas_foto_path) {
                        const container = document.getElementById('preview-foto-container');
                        if (container) container.innerHTML = `<img src="${profile.pas_foto_path}?t=${new Date().getTime()}" class="h-10 w-10 object-cover rounded-lg border border-gray-200"> <span class="text-xs text-teal-600 font-bold italic">Tersimpan</span>`;
                        localStorage.setItem('auth_photo', profile.pas_foto_path);
                        const headerAvatar = document.getElementById('header-user-avatar') as HTMLImageElement;
                        if (headerAvatar) {
                            headerAvatar.src = `${profile.pas_foto_path}?t=${new Date().getTime()}`;
                            headerAvatar.className = 'w-full h-full object-cover';
                        }
                    }
                    if (profile.tanda_tangan_path) {
                        const container = document.getElementById('preview-ttd-container');
                        if (container) container.innerHTML = `<img src="${profile.tanda_tangan_path}?t=${new Date().getTime()}" class="h-10 w-20 object-contain rounded-lg border border-gray-200 bg-gray-50"> <span class="text-xs text-teal-600 font-bold italic">Tersimpan</span>`;
                    }
                    updateVisibility();
                }
            }
        } catch (e) { console.error('Fetch profile error:', e); }
        toggleEditMode(false);
        bindHapusButtons();
    }

    const updateVisibility = () => {
        const ayahStatus = (document.getElementById('ayah_status') as HTMLSelectElement)?.value;
        const ibuStatus = (document.getElementById('ibu_status') as HTMLSelectElement)?.value;
        const sectionWali = document.getElementById('section-wali');
        const ayahTglContainer = document.getElementById('ayah_tgl_meninggal_container');
        const ibuTglContainer = document.getElementById('ibu_tgl_meninggal_container');

        if (ayahTglContainer) {
            if (ayahStatus === 'meninggal') {
                ayahTglContainer.classList.remove('hidden');
            } else {
                ayahTglContainer.classList.add('hidden');
            }
        }

        if (ibuTglContainer) {
            if (ibuStatus === 'meninggal') {
                ibuTglContainer.classList.remove('hidden');
            } else {
                ibuTglContainer.classList.add('hidden');
            }
        }

        if (sectionWali) {
            if (ayahStatus === 'meninggal' && ibuStatus === 'meninggal') {
                sectionWali.classList.remove('hidden', 'opacity-50', 'pointer-events-none');
            } else {
                sectionWali.classList.add('hidden');
            }
        }
    };

    document.getElementById('ayah_status')?.addEventListener('change', updateVisibility);
    document.getElementById('ibu_status')?.addEventListener('change', updateVisibility);

    // Image Previews
    const handleImagePreview = (inputId: string, containerId: string) => {
        const input = document.getElementById(inputId) as HTMLInputElement;
        const container = document.getElementById(containerId);
        if (input && container) {
            input.addEventListener('change', () => {
                if (input.files && input.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        container.innerHTML = `<img src="${e.target?.result}" class="${inputId === 'input-foto' ? 'h-10 w-10 object-cover' : 'h-10 w-20 object-contain'} rounded-lg border border-gray-200"> <span class="text-xs text-teal-600 font-bold italic">Terpilih</span>`;
                    };
                    reader.readAsDataURL(input.files[0]);
                }
            });
        }
    };
    handleImagePreview('input-foto', 'preview-foto-container');
    handleImagePreview('input-ttd', 'preview-ttd-container');

    const saveProfile = async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const btnSimpanProfil = document.getElementById('btn-simpan-profil') as HTMLButtonElement;
        const originalText = btnSimpanProfil.innerHTML;
        btnSimpanProfil.innerHTML = '<span class="animate-spin mr-2">⏳</span> Menyimpan...';
        btnSimpanProfil.disabled = true;

        try {
            const formData = new FormData();
            
            const appendIfExist = (id: string, key: string) => {
                const el = document.getElementById(id) as HTMLInputElement;
                if (el) formData.append(key, el.value);
            };

            appendIfExist('tempat_lahir', 'tempat_lahir');
            appendIfExist('tanggal_lahir', 'tanggal_lahir');
            appendIfExist('jenis_kelamin', 'jenis_kelamin');
            appendIfExist('no_hp', 'no_hp');
            appendIfExist('alamat_asal', 'alamat_asal');
            appendIfExist('alamat_domisili', 'alamat_domisili');

            const keluarga = [];
            if ((document.getElementById('ayah_nama') as HTMLInputElement)?.value) {
                keluarga.push({
                    jenis_relasi: 'ayah',
                    nama_lengkap: (document.getElementById('ayah_nama') as HTMLInputElement).value,
                    pekerjaan: (document.getElementById('ayah_pekerjaan') as HTMLInputElement).value,
                    penghasilan: (document.getElementById('ayah_penghasilan') as HTMLInputElement).value,
                    status_hidup: (document.getElementById('ayah_status') as HTMLSelectElement).value,
                    tanggal_meninggal: (document.getElementById('ayah_tgl_meninggal') as HTMLInputElement).value
                });
            }
            if ((document.getElementById('ibu_nama') as HTMLInputElement)?.value) {
                keluarga.push({
                    jenis_relasi: 'ibu',
                    nama_lengkap: (document.getElementById('ibu_nama') as HTMLInputElement).value,
                    pekerjaan: (document.getElementById('ibu_pekerjaan') as HTMLInputElement).value,
                    penghasilan: (document.getElementById('ibu_penghasilan') as HTMLInputElement).value,
                    status_hidup: (document.getElementById('ibu_status') as HTMLSelectElement).value,
                    tanggal_meninggal: (document.getElementById('ibu_tgl_meninggal') as HTMLInputElement).value
                });
            }
            if ((document.getElementById('wali_nama') as HTMLInputElement)?.value) {
                keluarga.push({
                    jenis_relasi: 'wali',
                    nama_lengkap: (document.getElementById('wali_nama') as HTMLInputElement).value,
                    pekerjaan: (document.getElementById('wali_pekerjaan') as HTMLInputElement).value,
                    penghasilan: (document.getElementById('wali_penghasilan') as HTMLInputElement).value,
                    status_hidup: (document.getElementById('wali_status') as HTMLSelectElement).value
                });
            }

            if (tbody) {
                Array.from(tbody.children).forEach((tr) => {
                    const inputs = tr.querySelectorAll('input[type="text"]');
                    const select = tr.querySelector('select');
                    const radio = tr.querySelector(`input[type="radio"]:checked`) as HTMLInputElement;
                    
                    if (inputs.length >= 2 && (inputs[0] as HTMLInputElement).value) {
                        keluarga.push({
                            jenis_relasi: 'saudara',
                            nama_lengkap: (inputs[0] as HTMLInputElement).value,
                            pekerjaan: (inputs[1] as HTMLInputElement).value,
                            status_kawin: select?.value,
                            keterangan: radio?.value || 'Kakak'
                        });
                    }
                });
            }

            formData.append('keluarga', JSON.stringify(keluarga));

            const beasiswas: any[] = [];
            if (beasiswaTbody) {
                Array.from(beasiswaTbody.children).forEach(tr => {
                    const inputs = tr.querySelectorAll('input[type="text"]');
                    const select = tr.querySelector('select');
                    if (inputs.length >= 3 && (inputs[0] as HTMLInputElement).value) {
                        beasiswas.push({
                            nama_beasiswa: (inputs[0] as HTMLInputElement).value,
                            periode: (inputs[1] as HTMLInputElement).value,
                            jumlah: (inputs[2] as HTMLInputElement).value,
                            status: select?.value
                        });
                    }
                });
            }
            formData.append('scholarship_histories', JSON.stringify(beasiswas));

            const fileFoto = (document.getElementById('input-foto') as HTMLInputElement)?.files?.[0];
            const fileTtd = (document.getElementById('input-ttd') as HTMLInputElement)?.files?.[0];
            
            if (fileFoto) formData.append('pas_foto', fileFoto);
            if (fileTtd) formData.append('tanda_tangan', fileTtd);

            const res = await apiFetch('/api/profile', {
                method: 'POST',
                body: formData,
                isFormData: true,
            });

            if (res.ok) {
                showSuccess('Profil berhasil diperbarui');
                loadProfile(); 
                toggleEditMode(false);
            } else {
                let errorMsg = "Gagal memperbarui profil";
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    try {
                        const err = await res.json();
                        errorMsg = err.message || errorMsg;
                    } catch (e) { }
                }
                showError(errorMsg);
            }
        } catch (e) {
            console.error(e);
            showError('Terjadi kesalahan sistem');
        } finally {
            btnSimpanProfil.innerHTML = originalText;
            btnSimpanProfil.disabled = false;
        }
    };

    if (btnTambahSaudara) {
        btnTambahSaudara.addEventListener('click', () => {
            if (!tbody) return;
            const rowIndex = tbody.children.length;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-800"><input type="text" placeholder="Nama saudara" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none"></td>
                <td class="px-6 py-4"><input type="text" placeholder="Pekerjaan/Sekolah" class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none"></td>
                <td class="px-6 py-4">
                    <select class="w-full p-2 border border-gray-200 rounded focus:border-teal-500 outline-none">
                        <option>Belum Kawin</option>
                        <option>Sudah Kawin</option>
                    </select>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="ket_saudara_${rowIndex}" value="Kakak" checked class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                            <span class="text-sm text-gray-700">Kakak</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="ket_saudara_${rowIndex}" value="Adik" class="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300">
                            <span class="text-sm text-gray-700">Adik</span>
                        </label>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <button type="button" class="btn-hapus-saudara text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
            bindHapusButtons();
        });
    }

    if (btnTambahBeasiswa && beasiswaTbody) {
        btnTambahBeasiswa.addEventListener('click', () => {
            addBeasiswaRow();
        });
    }

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProfile();
    });

    loadProfile();
};
