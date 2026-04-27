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

    return fetch(url, {
        ...rest,
        headers: {
            ...defaultHeaders,
            ...(customHeaders as Record<string, string>),
        },
    });
}
