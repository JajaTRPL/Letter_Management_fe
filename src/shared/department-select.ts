/**
 * Reusable Department dropdown — single source of truth.
 * Fetches from /api/departments (once, cached), renders options.
 */

import { apiFetch } from './api-client';
import { formatCodeName } from './formatters';

let cache: any[] | null = null;

/**
 * Populate a <select> element with departments.
 * Uses module-level cache to avoid redundant API calls.
 *
 * @param select - The <select> element to populate.
 * @param selectedId - The currently selected department_id (if any).
 * @param filters - Optional query parameters for future filtering (e.g., { faculty_id: "1" })
 */
export async function populateDepartmentSelect(
    select: HTMLSelectElement,
    selectedId?: number | string | null,
    filters?: Record<string, string>
): Promise<void> {
    const render = (depts: any[]) => {
        let html = '<option value="">Pilih Departemen...</option>';
        depts.forEach((d: any) => {
            const sel = selectedId != null && String(d.id) === String(selectedId) ? 'selected' : '';
            html += `<option value="${d.id}" ${sel}>${formatCodeName(d.code, d.name)}</option>`;
        });
        select.innerHTML = html;
    };

    // Note: If filters are applied dynamically in the future, we will need to bypass or partition the cache.
    // For now, it caches the standard unrestricted list.
    if (cache !== null && (!filters || Object.keys(filters).length === 0)) {
        render(cache);
        return;
    }

    try {
        let url = '/api/departments';
        if (filters && Object.keys(filters).length > 0) {
            const params = new URLSearchParams(filters);
            url += `?${params.toString()}`;
        }

        const res = await apiFetch(url);
        if (!res.ok) {
            select.innerHTML = '<option value="">Gagal memuat data</option>';
            return;
        }
        
        const depts: any[] = await res.json();
        
        // Only cache if there are no filters to prevent caching a subset as the global list
        if (!filters || Object.keys(filters).length === 0) {
            cache = depts;
        }
        
        render(depts);
    } catch {
        select.innerHTML = '<option value="">Gagal memuat data</option>';
    }
}

/**
 * Clear the cached data (useful for testing or forced refresh).
 */
export function clearDepartmentCache(): void {
    cache = null;
}
