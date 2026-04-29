import type { SectionController } from './SectionController';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const SectionDetailController: SectionController = {
    getPayload() {
        const payload: Record<string, any> = {};
        const fields = ['tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'no_hp', 'alamat_asal', 'alamat_domisili'];
        fields.forEach(id => {
            const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            if (el) {
                payload[id] = id === 'no_hp' ? onlyDigits(el.value) : el.value;
            }
        });
        return { detail: payload };
    },

    captureSnapshot() {
        const snapshot: Record<string, any> = {};
        const fields = ['tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'no_hp', 'alamat_asal', 'alamat_domisili'];
        fields.forEach(id => {
            const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            if (el) {
                snapshot[id] = el.value;
            }
        });
        return snapshot;
    },

    restoreSnapshot(snapshot: any) {
        if (!snapshot) return;
        const fields = ['tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'no_hp', 'alamat_asal', 'alamat_domisili'];
        fields.forEach(id => {
            const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            if (el && snapshot[id] !== undefined) {
                el.value = snapshot[id];
            }
        });
    }
};
