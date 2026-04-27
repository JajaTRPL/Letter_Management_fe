/**
 * Centralized User Status constants.
 *
 * Single source of truth for all status values used across the frontend.
 * These MUST match the backend App\Enums\UserStatus PHP enum values exactly.
 *
 * Status represents ONLY account lifecycle — NOT session state.
 * Login/logout do NOT modify status.
 */
export const UserStatus = {
    ACTIVE: 'Active',
    SUSPENDED: 'Suspended',
    PENDING_PROFILE: 'Pending_Profile',
} as const;

export type UserStatusValue = typeof UserStatus[keyof typeof UserStatus];

/** Display labels (Indonesian) for each status. */
export const STATUS_LABELS: Record<UserStatusValue, string> = {
    [UserStatus.ACTIVE]: 'Aktif',
    [UserStatus.SUSPENDED]: 'Suspended',
    [UserStatus.PENDING_PROFILE]: 'Menunggu Profil',
};

/** Badge CSS classes for table/list rendering. */
export const STATUS_BADGE_STYLES: Record<UserStatusValue, { color: string; label: string }> = {
    [UserStatus.ACTIVE]: { color: 'bg-green-100 text-green-700', label: 'Aktif' },
    [UserStatus.SUSPENDED]: { color: 'bg-red-100 text-red-700', label: 'Suspended' },
    [UserStatus.PENDING_PROFILE]: { color: 'bg-yellow-100 text-yellow-700', label: 'Menunggu Profil' },
};

/** Detail modal status styling (header section). */
export const STATUS_DETAIL_STYLES: Record<UserStatusValue, { bg: string; text: string; dot: string }> = {
    [UserStatus.ACTIVE]: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    [UserStatus.SUSPENDED]: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    [UserStatus.PENDING_PROFILE]: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
};

/** Get the suspend/unsuspend button label for a given status. */
export const getSuspendLabel = (status: string): string =>
    status === UserStatus.SUSPENDED ? 'Buka Suspend' : 'Suspend';

/** Check if a user with the given status is currently suspended. */
export const isSuspended = (status: string): boolean =>
    status === UserStatus.SUSPENDED;
