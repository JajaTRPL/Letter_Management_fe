/**
 * Centralized API fetch wrapper — single source of truth for auth headers.
 * Replaces 20+ inline `fetch()` calls with duplicated Authorization headers.
 *
 * USAGE:
 *   import { apiFetch } from '../shared/api-client';
 *   const res = await apiFetch('/api/profile');
 *   const data = await res.json();
 *
 * For POST/PUT with JSON body:
 *   await apiFetch('/api/profile', {
 *     method: 'POST',
 *     body: JSON.stringify({ nim: '24/...' }),
 *   });
 *
 * For FormData (file uploads):
 *   await apiFetch('/api/upload', {
 *     method: 'POST',
 *     body: formData,
 *     isFormData: true,  // skips Content-Type header
 *   });
 */

import { clearNormalAuthState } from './auth-state';
import { getPasswordRotationToken } from '../login/password-rotation-state';

interface ApiFetchOptions extends RequestInit {
    /** Set true for FormData uploads — skips Content-Type so browser sets boundary */
    isFormData?: boolean;
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
    const token = localStorage.getItem('auth_token');
    const { isFormData, headers: customHeaders, ...rest } = options;

    const defaultHeaders: Record<string, string> = {
        'Accept': 'application/json',
    };

    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    // Only set Content-Type for non-FormData requests with a body
    if (!isFormData && rest.body && typeof rest.body === 'string') {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        ...rest,
        headers: {
            ...defaultHeaders,
            ...(customHeaders as Record<string, string>),
        },
    });

    // A relogin between when this request started and when its response
    // arrives replaces `auth_token` in localStorage. Guard both branches below
    // with this check so a stale error from the OLD token never logs out the
    // session the user just started with the NEW token.
    const isResponseForCurrentToken = (): boolean => localStorage.getItem('auth_token') === token;

    if (response.status === 423 && isResponseForCurrentToken()) {
        let code: unknown;
        try {
            const payload: unknown = await response.clone().json();
            if (payload && typeof payload === 'object') {
                code = (payload as { code?: unknown }).code;
            }
        } catch {
            // Preserve the original response when a non-JSON 423 is returned.
        }

        if (code === 'PASSWORD_ROTATION_REQUIRED') {
            clearNormalAuthState();
            const rotationToken = getPasswordRotationToken();

            if (rotationToken) {
                const { renderPasswordRotation } = await import('../login/PasswordRotation');
                await renderPasswordRotation();
            } else {
                const { renderLogin } = await import('../login/Login');
                renderLogin('Akses akun memerlukan penggantian kata sandi. Silakan login kembali.');
            }
        }
    }

    // Handle 401 Unauthorized: token expired, revoked, or invalid.
    // Skip the logout endpoint itself to prevent an infinite redirect loop.
    if (response.status === 401 && !url.includes('/api/logout') && isResponseForCurrentToken()) {
        clearNormalAuthState();
        const { renderLogin } = await import('../login/Login');
        renderLogin('Sesi Anda telah berakhir. Silakan login kembali.');
    }

    return response;
}

/**
 * Normalize any backend-supplied storage path to the auth-protected
 * `/api/storage/<folder>/<filename>` route. Accepts `Storage::url()` output
 * (`/storage/...`), the already-prefixed route, or a bare relative path.
 * Returns null for empty/invalid input. The path is never returned with a
 * token in the query string — auth is carried by the Bearer header.
 */
export function normalizeProtectedStoragePath(path?: string | null): string | null {
    if (!path || typeof path !== 'string') return null;
    let pathname: string;
    try {
        pathname = new URL(path, window.location.origin).pathname || '';
    } catch {
        pathname = path;
    }
    if (!pathname) return null;
    if (pathname.startsWith('/api/storage/')) return pathname;
    if (pathname.startsWith('/storage/')) return `/api${pathname}`;
    const trimmed = pathname.replace(/^\/+/, '');
    if (!trimmed) return null;
    return `/api/storage/${trimmed}`;
}

/**
 * Fetch a protected image via apiFetch and return an object URL the browser
 * can render in <img src>. Use this everywhere a profile pas foto / signature
 * needs to be previewed. Caller is responsible for revoking the URL on cleanup
 * via revokeProtectedImageObjectUrl().
 *
 * Returns null when:
 * - path is missing/empty
 * - backend responds with non-2xx (403/404 etc.)
 * - network fails
 */
export async function loadProtectedImageObjectUrl(path?: string | null): Promise<string | null> {
    const normalized = normalizeProtectedStoragePath(path);
    if (!normalized) return null;
    try {
        const res = await apiFetch(normalized, {
            cache: 'no-store',
            headers: { Accept: 'image/*,*/*' },
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.type.startsWith('image/') && blob.size === 0) return null;
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

export function revokeProtectedImageObjectUrl(url?: string | null): void {
    if (typeof url === 'string' && url.startsWith('blob:')) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
}
