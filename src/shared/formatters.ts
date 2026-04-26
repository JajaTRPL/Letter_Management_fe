/**
 * Centralized formatting utilities to ensure string consistency across the UI.
 */

/**
 * Formats an academic entity string (e.g. Department or Study Program).
 * Enforces the standard hyphen (-) formatting globally.
 * 
 * @param code - The code of the entity (e.g. DTEDI)
 * @param name - The full name of the entity
 * @returns Formatted string (e.g. "DTEDI - Departemen Teknik Elektro dan Informatika")
 */
export const formatCodeName = (code: string, name: string): string => {
    return `${code} - ${name}`;
};
