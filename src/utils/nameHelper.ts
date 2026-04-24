/**
 * Get the display name based on the specific "middle name" logic:
 * - If 1 word: return the word.
 * - If odd number of words (3, 5, etc.): return the middle word.
 * - If even number of words (2, 4, etc.): return the word at (length - 1) / 2 index.
 *   - 2 words -> 1st word
 *   - 4 words -> 2nd word
 * 
 * Formula: words[Math.floor((words.length - 1) / 2)]
 */
export const getGreetingName = (fullName: string | null | undefined): string => {
    if (!fullName) return 'User';
    return fullName.trim();
};
