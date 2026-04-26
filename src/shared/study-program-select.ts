/**
 * Reusable Study Program dropdown — single source of truth.
 * Fetches from /api/study-programs-grouped (once, cached), renders <optgroup> by department.
 */

import { apiFetch } from './api-client';
import { formatCodeName } from './formatters';

let cache: any[] | null = null;

/**
 * Populate a <select> element with study programs grouped by department.
 * Uses module-level cache to avoid redundant API calls.
 *
 * @param select - The <select> element to populate.
 * @param selectedId - The currently selected study_program_id (if any).
 */
export async function populateStudyProgramSelect(
    select: HTMLSelectElement,
    selectedId?: number | string | null,
    filters?: Record<string, string>
): Promise<void> {
    const render = (grouped: any[]) => {
        let html = '<option value="">Pilih Program Studi...</option>';
        grouped.forEach((group: any) => {
            html += `<optgroup label="${formatCodeName(group.department.code, group.department.name)}">`;
            group.programs.forEach((p: any) => {
                const sel = selectedId != null && String(p.id) === String(selectedId) ? 'selected' : '';
                html += `<option value="${p.id}" ${sel}>${formatCodeName(p.code, p.name)}</option>`;
            });
            html += '</optgroup>';
        });
        select.innerHTML = html;
    };

    if (cache !== null && (!filters || Object.keys(filters).length === 0)) {
        render(cache);
        return;
    }

    try {
        let url = '/api/study-programs-grouped';
        if (filters && Object.keys(filters).length > 0) {
            const params = new URLSearchParams(filters);
            url += `?${params.toString()}`;
        }

        const res = await apiFetch(url);
        if (!res.ok) {
            select.innerHTML = '<option value="">Gagal memuat data</option>';
            return;
        }
        const grouped: any[] = await res.json();
        
        if (!filters || Object.keys(filters).length === 0) {
            cache = grouped;
        }
        
        render(grouped);
    } catch {
        select.innerHTML = '<option value="">Gagal memuat data</option>';
    }
}

/**
 * Clear the cached data (useful for testing or forced refresh).
 */
export function clearStudyProgramCache(): void {
    cache = null;
}
