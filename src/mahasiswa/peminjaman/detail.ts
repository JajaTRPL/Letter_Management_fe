import { showSuccess, showError } from '../../shared/toast';
import {
    withdrawMahasiswaBooking,
    downloadSuratPeminjamanPdf,
    getMahasiswaBooking,
    getPeminjamanRooms,
    generateRoomBookingIdempotencyKey,
    submitRoomReturnEvidence,
    withdrawRoomReturn,
    fetchReturnEvidenceObjectUrl,
    PeminjamanApiError,
    replaceSuratPeminjamanPdf,
    resubmitMahasiswaBooking,
    suratPeminjamanPreviewUrl,
} from './api';
import { isMahasiswaBooking } from './booking-schema';
import { closeBookingWorkflow, openBookingWorkflowForm } from './booking-form';
import { renderBookingDetailDialog, renderCancelDialog } from './views';
import { validateCancellationReason, validateSuratPdfFile } from './workflow';
import {
    attachProtectedPdfViewer,
    renderProtectedPdfViewer,
} from '../../shared/protected-pdf-viewer';
import type { BookingOccurrence, MahasiswaBooking } from './types';
import { buttonClass } from '../../shared/design-system';

/**
 * Self-contained booking detail controller: detail dialog + edit (via the
 * shared booking form) + resubmit + cancel. Extracted from the landing page
 * so Dashboard and Riwayat Pengajuan can open the exact same workflows after
 * the landing "Pengajuan Peminjaman Saya" panel was removed. Callers pass
 * `onMutated` to refresh their own list/calendar after any state change.
 */

export interface PeminjamanDetailOptions {
    onMutated?: () => void;
}

let detailEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
let cancelEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
// Replacement file is held here (not the input) so it survives feedback
// updates; reset whenever a fresh detail is opened.
let pendingReplaceFile: File | null = null;
let pdfViewerEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
let pdfViewerCleanup: (() => void) | null = null;
let returnEvidenceObjectUrl: string | null = null;

const showToast = (text: string, success: boolean): void => {
    if (success) {
        showSuccess(text);
    } else {
        showError(text);
    }
};

/**
 * A 409 means our copy of the booking is stale: the workflow moved on (a
 * reviewer acted, a cancellation request landed, the version bumped). The
 * actions we are showing were computed from that stale copy, so before we
 * re-render anything we replace it with fresh state — the safe `booking`
 * the backend attached to the error when present, otherwise a refetch.
 * Returns null when the booking cannot be refreshed (the caller then keeps
 * showing the error against what it already has).
 */
const refreshBookingAfterConflict = async (
    error: unknown,
    bookingId: number,
): Promise<MahasiswaBooking | null> => {
    if (!(error instanceof PeminjamanApiError) || error.status !== 409) return null;

    const embedded = error.data?.booking;
    if (isMahasiswaBooking(embedded)) return embedded;

    try {
        return await getMahasiswaBooking(bookingId);
    } catch {
        return null;
    }
};

const errorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error ? error.message : fallback;

export const closePeminjamanDetail = (): void => {
    closeSuratPreview();
    pendingReplaceFile = null;
    document.getElementById('peminjaman-detail-root')?.remove();
    document.getElementById('peminjaman-cancel-root')?.remove();
    document.getElementById('peminjaman-return-root')?.remove();
    document.getElementById('peminjaman-return-preview-root')?.remove();
    if (returnEvidenceObjectUrl) URL.revokeObjectURL(returnEvidenceObjectUrl);
    returnEvidenceObjectUrl = null;
    if (detailEscapeHandler) {
        document.removeEventListener('keydown', detailEscapeHandler);
        detailEscapeHandler = null;
    }
    if (cancelEscapeHandler) {
        document.removeEventListener('keydown', cancelEscapeHandler);
        cancelEscapeHandler = null;
    }
};

const detailRoot = (): HTMLElement => {
    document.getElementById('peminjaman-detail-root')?.remove();
    const root = document.createElement('div');
    root.id = 'peminjaman-detail-root';
    document.body.appendChild(root);
    return root;
};

const renderDetailState = (
    booking: MahasiswaBooking | null,
    loading: boolean,
    error: string | null,
    actionLoading: boolean,
    options: PeminjamanDetailOptions,
): void => {
    const root = detailRoot();
    root.innerHTML = renderBookingDetailDialog(booking, loading, error, actionLoading);

    const close = (): void => closePeminjamanDetail();
    root.querySelector('[data-workflow-overlay]')?.addEventListener('click', close);
    root.querySelector('#close-peminjaman-workflow')?.addEventListener('click', close);

    if (booking) {
        root.querySelector('#edit-peminjaman-booking')?.addEventListener('click', () => {
            void openEditForm(booking, options);
        });
        root.querySelector('#resubmit-peminjaman-booking')?.addEventListener('click', async () => {
            renderDetailState(booking, false, null, true, options);
            try {
                const updated = await resubmitMahasiswaBooking(booking.id);
                showToast('Pengajuan berhasil dikirim ulang.', true);
                options.onMutated?.();
                renderDetailState(updated, false, null, false, options);
            } catch (resubmitError) {
                const fresh = await refreshBookingAfterConflict(resubmitError, booking.id);
                if (fresh) options.onMutated?.();
                renderDetailState(
                    fresh ?? booking,
                    false,
                    errorMessage(resubmitError, 'Pengajuan gagal dikirim ulang.'),
                    false,
                    options,
                );
            }
        });
        root.querySelector('#cancel-peminjaman-booking')?.addEventListener('click', () => {
            openCancelDialog(booking, options);
        });
        bindSuratControls(root, booking, options);
        bindOccurrenceControls(root, booking, options);
    }

    if (detailEscapeHandler) {
        document.removeEventListener('keydown', detailEscapeHandler);
    }
    detailEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', detailEscapeHandler);
    root.querySelector<HTMLButtonElement>('#close-peminjaman-workflow')?.focus();
};

const occurrenceByRef = (booking: MahasiswaBooking, ref: string): BookingOccurrence | null =>
    booking.occurrences?.find((occurrence) => occurrence.occurrence_ref === ref) ?? null;

const validateReturnImage = (file: File | null): string | null => {
    if (!file) return 'Pilih foto bukti pengembalian.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        return 'Bukti harus berupa JPG, PNG, atau WebP.';
    }
    if (file.size > 5 * 1024 * 1024) return 'Ukuran bukti melebihi 5 MiB.';
    return null;
};

const bindOccurrenceControls = (
    root: HTMLElement,
    booking: MahasiswaBooking,
    options: PeminjamanDetailOptions,
): void => {
    root.querySelectorAll<HTMLElement>('[data-return-submit]').forEach((button) => {
        button.addEventListener('click', () => {
            const occurrence = occurrenceByRef(booking, button.dataset.returnSubmit ?? '');
            if (occurrence) openReturnDialog(occurrence, options);
        });
    });
    root.querySelectorAll<HTMLElement>('[data-return-withdraw]').forEach((button) => {
        button.addEventListener('click', async () => {
            const occurrence = occurrenceByRef(booking, button.dataset.returnWithdraw ?? '');
            if (!occurrence || !window.confirm('Tarik pengajuan bukti pengembalian ini?')) return;
            try {
                const updated = await withdrawRoomReturn(
                    occurrence,
                    generateRoomBookingIdempotencyKey(),
                );
                options.onMutated?.();
                renderDetailState(updated, false, null, false, options);
            } catch (error) {
                renderDetailState(booking, false, errorMessage(error, 'Pengajuan pengembalian gagal ditarik.'), false, options);
            }
        });
    });
    root.querySelectorAll<HTMLElement>('[data-return-preview]').forEach((button) => {
        button.addEventListener('click', () => {
            const occurrence = occurrenceByRef(booking, button.dataset.returnPreview ?? '');
            if (occurrence?.return) void openReturnEvidencePreview(occurrence);
        });
    });
};

const openReturnDialog = (
    occurrence: BookingOccurrence,
    options: PeminjamanDetailOptions,
): void => {
    document.getElementById('peminjaman-return-root')?.remove();
    const root = document.createElement('div');
    root.id = 'peminjaman-return-root';
    document.body.appendChild(root);
    let selectedFile: File | null = null;
    let error: string | null = null;
    let submitting = false;
    const idempotencyKey = generateRoomBookingIdempotencyKey();
    const render = (): void => {
        root.innerHTML = `
            <div data-return-overlay class="fixed inset-0 z-[240] bg-black/50"></div>
            <section role="dialog" aria-modal="true" aria-labelledby="return-dialog-title" class="fixed left-1/2 top-1/2 z-[241] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
                <h2 id="return-dialog-title" class="text-lg font-bold text-gray-900">${occurrence.capabilities.can_resubmit_return ? 'Perbaiki Bukti Pengembalian' : 'Kirim Bukti Pengembalian'}</h2>
                <p class="mt-1 text-xs text-gray-500">Penggunaan ${occurrence.sequence} · tenggat absolut ${new Date(occurrence.return_due_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
                ${error ? `<p role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${error}</p>` : ''}
                <form id="return-evidence-form" class="mt-4 space-y-4">
                    <div><label for="return-evidence-file" class="text-sm font-bold text-gray-700">Foto bukti (JPG, PNG, atau WebP; maks. 5 MiB)</label><input id="return-evidence-file" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" class="mt-2 block w-full text-sm" ${submitting ? 'disabled' : ''}><p class="mt-1 text-xs text-gray-500">${selectedFile ? selectedFile.name : 'Belum ada foto dipilih.'}</p></div>
                    <div class="flex justify-end gap-2"><button id="return-evidence-cancel" type="button" class="${buttonClass('outline', 'sm')}" ${submitting ? 'disabled' : ''}>Batal</button><button type="submit" class="${buttonClass('primary', 'sm')}" ${submitting ? 'disabled' : ''}>${submitting ? 'Mengirim...' : 'Kirim Bukti'}</button></div>
                </form>
            </section>`;
        const close = (): void => { if (!submitting) root.remove(); };
        root.querySelector('[data-return-overlay]')?.addEventListener('click', close);
        root.querySelector('#return-evidence-cancel')?.addEventListener('click', close);
        root.querySelector('#return-evidence-file')?.addEventListener('change', (event) => {
            selectedFile = (event.target as HTMLInputElement).files?.[0] ?? null;
            error = validateReturnImage(selectedFile);
            render();
        });
        root.querySelector('#return-evidence-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            error = validateReturnImage(selectedFile);
            if (error || !selectedFile) { render(); return; }
            submitting = true; render();
            try {
                const updated = await submitRoomReturnEvidence(occurrence, selectedFile, idempotencyKey);
                root.remove();
                options.onMutated?.();
                renderDetailState(updated, false, null, false, options);
            } catch (submitError) {
                error = errorMessage(submitError, 'Bukti pengembalian gagal dikirim. Coba lagi dengan berkas yang sama.');
                submitting = false; render();
            }
        });
        root.querySelector<HTMLInputElement>('#return-evidence-file')?.focus();
    };
    render();
};

const openReturnEvidencePreview = async (occurrence: BookingOccurrence): Promise<void> => {
    if (!occurrence.return) return;
    document.getElementById('peminjaman-return-preview-root')?.remove();
    if (returnEvidenceObjectUrl) URL.revokeObjectURL(returnEvidenceObjectUrl);
    returnEvidenceObjectUrl = null;
    const root = document.createElement('div');
    root.id = 'peminjaman-return-preview-root';
    root.className = 'fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4';
    root.innerHTML = '<div class="rounded-xl bg-white p-6 text-sm font-semibold text-gray-700">Memuat bukti pengembalian...</div>';
    document.body.appendChild(root);
    try {
        returnEvidenceObjectUrl = await fetchReturnEvidenceObjectUrl(occurrence.return.evidence.preview_url);
        root.innerHTML = `<div class="flex max-h-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white"><div class="flex items-center justify-between border-b px-4 py-3"><p class="text-sm font-bold">Bukti Pengembalian</p><button id="close-return-preview" type="button" aria-label="Tutup bukti" class="p-2">×</button></div><img src="${returnEvidenceObjectUrl}" alt="Bukti pengembalian kunci penggunaan ${occurrence.sequence}" class="max-h-[80vh] w-auto object-contain"></div>`;
        root.querySelector('#close-return-preview')?.addEventListener('click', () => root.remove());
    } catch (error) {
        root.innerHTML = `<div role="alert" class="rounded-xl bg-white p-6 text-sm text-red-700">${errorMessage(error, 'Bukti tidak dapat dimuat.')}</div>`;
    }
};

export const closeSuratPreview = (): void => {
    if (pdfViewerCleanup) {
        pdfViewerCleanup();
        pdfViewerCleanup = null;
    }
    if (pdfViewerEscapeHandler) {
        document.removeEventListener('keydown', pdfViewerEscapeHandler);
        pdfViewerEscapeHandler = null;
    }
    document.getElementById('peminjaman-surat-preview-root')?.remove();
};

// Full-screen protected preview overlay (above the detail drawer). Reuses the
// shared authenticated PDF.js viewer — bytes are fetched via apiFetch, never a
// raw storage URL. Exported so the Tendik reviewer drawer opens the exact same
// overlay (role authorization happens in the backend preview endpoint).
export const openSuratPreview = (booking: MahasiswaBooking): void => {
    closeSuratPreview();
    const root = document.createElement('div');
    root.id = 'peminjaman-surat-preview-root';
    root.className = 'fixed inset-0 z-[300] flex flex-col bg-black/60 p-4 sm:p-8';
    root.innerHTML = `
        <div class="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div class="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
                <p class="min-w-0 truncate text-sm font-bold text-gray-800">Pratinjau Surat Peminjaman</p>
                <button id="peminjaman-surat-preview-close" type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Tutup pratinjau">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="min-h-0 flex-1 overflow-auto p-3">
                ${renderProtectedPdfViewer('peminjaman-surat-pdf-viewer', {
                    title: 'Surat Peminjaman Ruangan',
                    subtitle: `${booking.room.code} · ${booking.room.name}`,
                    loading: 'Memuat surat peminjaman...',
                })}
            </div>
        </div>
    `;
    document.body.appendChild(root);

    root.addEventListener('click', (event) => {
        if (event.target === root) closeSuratPreview();
    });
    root.querySelector('#peminjaman-surat-preview-close')?.addEventListener('click', closeSuratPreview);
    pdfViewerEscapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeSuratPreview();
    };
    document.addEventListener('keydown', pdfViewerEscapeHandler);
    pdfViewerCleanup = attachProtectedPdfViewer({
        rootId: 'peminjaman-surat-pdf-viewer',
        endpointUrl: suratPeminjamanPreviewUrl(booking.id),
    });
};

const bindSuratControls = (
    root: HTMLElement,
    booking: MahasiswaBooking,
    options: PeminjamanDetailOptions,
): void => {
    root.querySelector('#peminjaman-surat-preview')?.addEventListener('click', () => {
        openSuratPreview(booking);
    });
    root.querySelector('#peminjaman-surat-download')?.addEventListener('click', async () => {
        try {
            await downloadSuratPeminjamanPdf(
                booking.id,
                booking.surat_peminjaman_pdf?.original_name ?? 'surat-peminjaman.pdf',
            );
        } catch (downloadError) {
            showToast(
                downloadError instanceof Error
                    ? downloadError.message
                    : 'Surat peminjaman gagal diunduh.',
                false,
            );
        }
    });

    const replaceInput = root.querySelector<HTMLInputElement>('#peminjaman-surat-replace-input');
    const replaceSubmit = root.querySelector<HTMLButtonElement>('#peminjaman-surat-replace-submit');
    const feedback = root.querySelector<HTMLElement>('#peminjaman-surat-replace-feedback');
    if (!replaceInput || !replaceSubmit) return;

    const showFeedback = (message: string, ok: boolean): void => {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.remove('hidden', 'text-red-600', 'text-emerald-600');
        feedback.classList.add(ok ? 'text-emerald-600' : 'text-red-600');
    };

    replaceInput.addEventListener('change', () => {
        const file = replaceInput.files?.[0] ?? null;
        const error = file ? validateSuratPdfFile(file) : null;
        pendingReplaceFile = error ? null : file;
        if (error) showFeedback(error, false);
        else if (file) showFeedback(file.name, true);
        else if (feedback) feedback.classList.add('hidden');
    });

    replaceSubmit.addEventListener('click', async () => {
        const error = validateSuratPdfFile(pendingReplaceFile);
        if (error) {
            showFeedback(error, false);
            return;
        }
        replaceSubmit.disabled = true;
        showFeedback('Mengunggah surat...', true);
        try {
            const updated = await replaceSuratPeminjamanPdf(booking.id, pendingReplaceFile!);
            pendingReplaceFile = null;
            showToast('Surat peminjaman berhasil diperbarui.', true);
            options.onMutated?.();
            renderDetailState(updated, false, null, false, options);
        } catch (replaceError) {
            const message = errorMessage(replaceError, 'Surat peminjaman gagal diganti.');
            const fresh = await refreshBookingAfterConflict(replaceError, booking.id);
            if (fresh) {
                // Stale state: re-render the whole detail from the fresh booking
                // so the upload control disappears if it is no longer allowed.
                pendingReplaceFile = null;
                options.onMutated?.();
                renderDetailState(fresh, false, message, false, options);
                return;
            }
            replaceSubmit.disabled = false;
            showFeedback(message, false);
        }
    });
};

const openEditForm = async (
    booking: MahasiswaBooking,
    options: PeminjamanDetailOptions,
): Promise<void> => {
    closePeminjamanDetail();
    try {
        const rooms = (await getPeminjamanRooms()).filter((room) => room.is_active);
        openBookingWorkflowForm({
            rooms,
            mode: 'edit',
            booking,
            onSaved: (saved) => {
                showToast('Perbaikan pengajuan berhasil disimpan.', true);
                options.onMutated?.();
                void openPeminjamanBookingDetail(saved.id, options);
            },
            onStale: (fresh, message) => {
                // Never re-offer actions computed from the stale copy.
                options.onMutated?.();
                renderDetailState(fresh, false, message, false, options);
            },
        });
    } catch (roomsError) {
        showToast(
            roomsError instanceof Error
                ? roomsError.message
                : 'Daftar ruangan gagal dimuat untuk perbaikan.',
            false,
        );
        renderDetailState(booking, false, null, false, options);
    }
};

const openCancelDialog = (
    booking: MahasiswaBooking,
    options: PeminjamanDetailOptions,
): void => {
    document.getElementById('peminjaman-cancel-root')?.remove();
    const root = document.createElement('div');
    root.id = 'peminjaman-cancel-root';
    document.body.appendChild(root);

    // One idempotency key per dialog session: a retry after an ambiguous
    // network failure reuses it so the server replays the first withdrawal
    // instead of acting twice.
    const idempotencyKey = generateRoomBookingIdempotencyKey();

    const closeCancel = (): void => {
        root.remove();
        if (cancelEscapeHandler) {
            document.removeEventListener('keydown', cancelEscapeHandler);
            cancelEscapeHandler = null;
        }
    };

    const render = (error: string | null, submitting: boolean): void => {
        root.innerHTML = renderCancelDialog(booking, error, submitting);
        root.querySelector('[data-workflow-overlay]')?.addEventListener('click', closeCancel);
        root.querySelector('#close-peminjaman-cancel')?.addEventListener('click', closeCancel);
        root.querySelector('#peminjaman-cancel-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const reason = (root.querySelector('#peminjaman-cancel-reason') as HTMLTextAreaElement | null)?.value ?? '';
            const reasonError = validateCancellationReason(reason);
            if (reasonError) {
                render(reasonError, false);
                root.querySelector<HTMLTextAreaElement>('#peminjaman-cancel-reason')?.focus();
                return;
            }
            render(null, true);
            try {
                const updated = await withdrawMahasiswaBooking(booking, reason.trim(), idempotencyKey);
                closeCancel();
                showToast('Pengajuan peminjaman berhasil ditarik.', true);
                options.onMutated?.();
                renderDetailState(updated, false, null, false, options);
            } catch (cancelError) {
                const message = errorMessage(cancelError, 'Pembatalan pengajuan gagal.');
                const fresh = await refreshBookingAfterConflict(cancelError, booking.id);
                if (fresh) {
                    // The booking moved on under us — close the now-invalid
                    // dialog and show the refreshed detail with the reason why.
                    closeCancel();
                    options.onMutated?.();
                    renderDetailState(fresh, false, message, false, options);
                    return;
                }
                render(message, false);
            }
        });
        if (cancelEscapeHandler) {
            document.removeEventListener('keydown', cancelEscapeHandler);
        }
        cancelEscapeHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeCancel();
        };
        document.addEventListener('keydown', cancelEscapeHandler);
        root.querySelector<HTMLTextAreaElement>('#peminjaman-cancel-reason')?.focus();
    };
    render(null, false);
};

export const openPeminjamanBookingDetail = async (
    bookingId: number,
    options: PeminjamanDetailOptions = {},
): Promise<void> => {
    closeBookingWorkflow();
    closePeminjamanDetail();
    renderDetailState(null, true, null, false, options);
    try {
        const booking = await getMahasiswaBooking(bookingId);
        renderDetailState(booking, false, null, false, options);
    } catch (error) {
        renderDetailState(
            null,
            false,
            error instanceof Error ? error.message : 'Detail pengajuan gagal dimuat.',
            false,
            options,
        );
    }
};
