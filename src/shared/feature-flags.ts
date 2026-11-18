/**
 * Frontend feature switches.
 *
 * `mahasiswaPeminjaman` — Peminjaman Ruangan (lab & kelas) for Mahasiswa is
 * still under development, so it is hidden from the Mahasiswa sidebar,
 * dashboard tracking and Riwayat Pengajuan. The booking pages themselves are
 * left intact; flip this to `true` to bring the feature back. Staff-side
 * Peminjaman (Sarpras, Kepala Lab, Laboran, Super Admin) is NOT affected.
 *
 * Kept as a mutable object (not a bare const) so tests can toggle it.
 */
export const featureFlags = {
    mahasiswaPeminjaman: false,
};

export const isMahasiswaPeminjamanEnabled = (): boolean => featureFlags.mahasiswaPeminjaman;
