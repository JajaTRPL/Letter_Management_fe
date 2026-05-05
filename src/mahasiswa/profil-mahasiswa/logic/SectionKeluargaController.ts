import type { SectionController } from './SectionController';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const createKeluargaController = (relasi: 'ayah' | 'ibu' | 'wali'): SectionController => {
    const fields = ['nama', 'pekerjaan', 'penghasilan', 'status', 'tgl_meninggal'].map(f => `${relasi}_${f}`);

    return {
        getPayload() {
            const payload: Record<string, any> = { jenis_relasi: relasi };
            fields.forEach(id => {
                const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
                if (el) {
                    // Map local ID suffix to API field names if needed, or let orchestrator do it.
                    // Wait, orchestrator currently does:
                    // nama_lengkap: el.value
                    // pekerjaan: el.value
                    // penghasilan: el.value
                    // status_hidup: el.value
                    // tanggal_meninggal: el.value
                    const key = id.replace(`${relasi}_`, '');
                    if (key === 'nama') payload['nama_lengkap'] = el.value;
                    else if (key === 'status') payload['status_hidup'] = el.value;
                    else if (key === 'tgl_meninggal') payload['tanggal_meninggal'] = el.value;
                    else if (key === 'penghasilan') payload[key] = onlyDigits(el.value);
                    else payload[key] = el.value;
                }
            });
            return { [relasi]: payload };
        },

        captureSnapshot() {
            const snapshot: Record<string, any> = {};
            fields.forEach(id => {
                const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
                if (el) {
                    snapshot[id] = el.value;
                }
            });
            return snapshot;
        },

        restoreSnapshot(snapshot: any) {
            if (!snapshot) return;
            fields.forEach(id => {
                const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
                if (el && snapshot[id] !== undefined) {
                    el.value = snapshot[id];
                }
            });
        }
    };
};
