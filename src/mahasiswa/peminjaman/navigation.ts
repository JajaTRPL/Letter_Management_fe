/**
 * Lazy page-to-page navigation (dynamic import) with a recoverable failure
 * surface. A chunk can fail to load — offline, a stale deploy, a proxy hiccup —
 * and a silently rejected `import()` leaves the user staring at a button that
 * does nothing. Every Peminjaman navigation routes through here so the failure
 * is announced and retryable.
 */

const FAILURE_ID = 'peminjaman-nav-failure';

export const dismissNavigationFailure = (): void => {
    document.getElementById(FAILURE_ID)?.remove();
};

const showNavigationFailure = (label: string, retry: () => void): void => {
    dismissNavigationFailure();
    const banner = document.createElement('div');
    banner.id = FAILURE_ID;
    banner.setAttribute('role', 'alert');
    banner.className = 'fixed inset-x-4 bottom-4 z-[320] mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 shadow-lg';
    banner.innerHTML = `
        <p class="text-sm font-semibold text-red-700">Halaman ${label} gagal dibuka. Periksa koneksi Anda, lalu coba lagi.</p>
        <div class="flex gap-2">
            <button id="peminjaman-nav-dismiss" type="button" class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">Tutup</button>
            <button id="peminjaman-nav-retry" type="button" class="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800">Coba Lagi</button>
        </div>
    `;
    document.body.appendChild(banner);
    banner.querySelector('#peminjaman-nav-dismiss')?.addEventListener('click', dismissNavigationFailure);
    banner.querySelector('#peminjaman-nav-retry')?.addEventListener('click', () => {
        dismissNavigationFailure();
        retry();
    });
    banner.querySelector<HTMLButtonElement>('#peminjaman-nav-retry')?.focus();
};

export const navigateLazily = async (
    load: () => Promise<unknown>,
    label: string,
): Promise<void> => {
    dismissNavigationFailure();
    try {
        await load();
    } catch {
        showNavigationFailure(label, () => {
            void navigateLazily(load, label);
        });
    }
};
