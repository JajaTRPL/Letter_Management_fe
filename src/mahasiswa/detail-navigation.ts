export type MahasiswaDetailOrigin = 'administrasi' | 'riwayat';

export type MahasiswaDetailNavigationOptions = {
    origin?: MahasiswaDetailOrigin;
};

export const resolveDetailOrigin = (options?: MahasiswaDetailNavigationOptions): MahasiswaDetailOrigin =>
    options?.origin === 'riwayat' ? 'riwayat' : 'administrasi';

export const activePageForDetailOrigin = (origin: MahasiswaDetailOrigin): string =>
    origin === 'riwayat' ? 'history' : 'administrasi';

export const backLabelForDetailOrigin = (origin: MahasiswaDetailOrigin): string =>
    origin === 'riwayat' ? 'Kembali ke Riwayat Pengajuan' : 'Kembali ke Administrasi Surat';

export const goToMahasiswaDetailOrigin = (origin: MahasiswaDetailOrigin) => {
    if (origin === 'riwayat') {
        import('./RiwayatPengajuan').then(({ renderRiwayatPengajuan }) => {
            renderRiwayatPengajuan();
        });
        return;
    }

    import('./AdministrasiSurat').then(({ renderAdministrasiSurat }) => {
        renderAdministrasiSurat();
    });
};
