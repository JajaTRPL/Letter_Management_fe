import { renderDashboardLayout } from '../dashboard/DashboardLayout';
import { renderProfilMahasiswaUI } from './profil-mahasiswa/ProfilMahasiswaUI';
import { initProfilMahasiswaLogic } from './profil-mahasiswa/ProfilMahasiswaLogic';

export const renderProfilMahasiswa = () => {
    const content = renderProfilMahasiswaUI();
    
    renderDashboardLayout('Detail & Update Profil', content, 'mahasiswa');

    setTimeout(() => {
        initProfilMahasiswaLogic();
    }, 100);
};
