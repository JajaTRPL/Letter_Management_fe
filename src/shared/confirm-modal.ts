/**
 * Shared styled confirm dialog — the promise-based replacement for native
 * `window.confirm()`. Visual/structural pattern matches the local confirm
 * dialogs already used by Master Fasilitas and Master Laboratorium
 * (overlay + centered card, flex-col-reverse actions), extracted here so
 * every "are you sure?" surface in the app looks and behaves the same way
 * instead of falling back to the browser's unstyled native dialog.
 *
 * USAGE:
 *   const ok = await confirmModal({
 *     title: 'Hapus Akun?',
 *     body: 'Akun ini akan dihapus permanen.',
 *     confirmLabel: 'Ya, Hapus',
 *     confirmTone: 'bg-red-600 hover:bg-red-700',
 *   });
 *   if (!ok) return;
 */

export interface ConfirmModalOptions {
    title: string;
    /** Rendered as innerHTML — caller is responsible for escaping any dynamic text. */
    body: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Tailwind classes for the confirm button (background + hover). */
    confirmTone?: string;
}

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const confirmModal = (options: ConfirmModalOptions): Promise<boolean> => new Promise((resolve) => {
    document.getElementById('shared-confirm-root')?.remove();

    const root = document.createElement('div');
    root.id = 'shared-confirm-root';
    root.innerHTML = `
        <div data-shared-confirm-overlay class="fixed inset-0 z-[230] bg-black/50"></div>
        <section role="alertdialog" aria-modal="true" aria-labelledby="shared-confirm-title" class="fixed left-1/2 top-1/2 z-[231] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="shared-confirm-title" class="text-lg font-bold text-gray-900">${escapeHtml(options.title)}</h2>
            <p class="mt-3 whitespace-pre-line text-sm text-gray-600">${options.body}</p>
            <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button id="shared-confirm-cancel" type="button" class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">${escapeHtml(options.cancelLabel ?? 'Batal')}</button>
                <button id="shared-confirm-ok" type="button" class="rounded-xl px-5 py-2.5 text-sm font-bold text-white ${options.confirmTone ?? 'bg-teal-700 hover:bg-teal-800'}">${escapeHtml(options.confirmLabel ?? 'Ya, Lanjutkan')}</button>
            </div>
        </section>
    `;
    document.body.appendChild(root);

    const cleanup = (): void => {
        document.removeEventListener('keydown', onKeydown);
        root.remove();
    };
    const settle = (result: boolean): void => {
        cleanup();
        resolve(result);
    };
    const onKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') settle(false);
    };

    root.querySelector('[data-shared-confirm-overlay]')?.addEventListener('click', () => settle(false));
    root.querySelector('#shared-confirm-cancel')?.addEventListener('click', () => settle(false));
    root.querySelector('#shared-confirm-ok')?.addEventListener('click', () => settle(true));
    document.addEventListener('keydown', onKeydown);

    root.querySelector<HTMLButtonElement>('#shared-confirm-ok')?.focus();
});
