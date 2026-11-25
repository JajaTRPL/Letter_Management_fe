/**
 * Turns a failed API response into a message a student can act on.
 *
 * Order: the backend's own validation error or message (already Indonesian
 * for most endpoints), then a status-specific explanation for responses that
 * carry no usable body — notably 413 from nginx when an upload is too large,
 * which arrives as an HTML page, not JSON.
 */

const STATUS_MESSAGES: Record<number, string> = {
    401: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
    403: 'Anda tidak memiliki akses untuk melakukan tindakan ini.',
    404: 'Data yang diminta tidak ditemukan. Muat ulang halaman lalu coba lagi.',
    408: 'Permintaan terlalu lama diproses. Periksa koneksi Anda lalu coba lagi.',
    409: 'Data pengajuan sudah berubah. Muat ulang halaman lalu coba lagi.',
    413: 'Ukuran file yang diunggah terlalu besar. Perkecil ukuran file (total maksimal 15 MB untuk semua dokumen) lalu coba lagi.',
    419: 'Sesi Anda telah berakhir. Muat ulang halaman lalu coba lagi.',
    422: 'Data yang dikirim belum valid. Periksa kembali isian Anda.',
    429: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
    500: 'Terjadi kesalahan pada server. Silakan coba lagi beberapa saat lagi.',
    502: 'Server sedang tidak dapat dihubungi. Silakan coba lagi beberapa saat lagi.',
    503: 'Layanan sedang sibuk atau dalam pemeliharaan. Silakan coba lagi beberapa saat lagi.',
    504: 'Server terlalu lama merespons. Silakan coba lagi beberapa saat lagi.',
};

/** Message for a fetch that threw before any response arrived. */
export const NETWORK_ERROR_MESSAGE =
    'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi. Jika sedang mengunggah file, pastikan ukurannya tidak melebihi batas.';

const firstValidationError = (errors: unknown): string | null => {
    if (!errors || typeof errors !== 'object') return null;
    for (const value of Object.values(errors as Record<string, unknown>)) {
        if (Array.isArray(value) && value.length > 0) return String(value[0]);
        if (typeof value === 'string' && value.trim()) return value;
    }
    return null;
};

export const statusErrorMessage = (status: number, fallback?: string): string =>
    STATUS_MESSAGES[status]
    ?? (status >= 500 ? STATUS_MESSAGES[500] : fallback ?? `Terjadi kesalahan (${status}). Silakan coba lagi.`);

export async function describeApiError(response: Response, fallback?: string): Promise<string> {
    // 413 never has a useful body (nginx HTML page), so skip parsing it.
    if (response.status !== 413) {
        try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const body = await response.clone().json();
                const validation = firstValidationError(body?.errors);
                if (validation) return validation;
                if (typeof body?.message === 'string' && body.message.trim() && !isGenericFrameworkMessage(body.message)) {
                    return body.message;
                }
            }
        } catch {
            // fall through to the status message
        }
    }

    return statusErrorMessage(response.status, fallback);
}

/** Message for an exception thrown by apiFetch/fetch (network failure, aborted request). */
export function describeFetchFailure(error: unknown, fallback = NETWORK_ERROR_MESSAGE): string {
    if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE;
    if (error instanceof Error && error.message.trim()) return error.message;
    return fallback;
}

// Laravel's production 500 body is {"message": "Server Error"} — not useful to a student.
const isGenericFrameworkMessage = (message: string): boolean =>
    /^(server error|internal server error|service unavailable|too many attempts\.?|unauthenticated\.?|forbidden|not found)$/i
        .test(message.trim());
