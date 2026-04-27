/**
 * Reusable tab state manager — Single Source of Truth for active tab.
 *
 * Encapsulates tab state with controlled access, eliminating scattered
 * mutable variables and ensuring deterministic default on page load.
 *
 * USAGE:
 *   const tabs = new TabManager('super_admin');
 *   tabs.getActive();        // 'super_admin'
 *   tabs.setActive('tendik');
 *   tabs.reset();            // back to 'super_admin'
 *
 * Reusable for any tabbed page (Mahasiswa, Akademik, Tendik, etc.)
 */
export class TabManager<T extends string = string> {
    private activeTab: T;
    private readonly defaultTab: T;
    private readonly onChange?: (tab: T) => void;

    /**
     * @param defaultTab  The tab that is active on initial load / reset.
     * @param onChange     Optional callback fired on every setActive/reset.
     */
    constructor(defaultTab: T, onChange?: (tab: T) => void) {
        this.defaultTab = defaultTab;
        this.activeTab = defaultTab;
        this.onChange = onChange;
    }

    /** Get current active tab. */
    getActive(): T {
        return this.activeTab;
    }

    /** Set active tab and notify listener. */
    setActive(tab: T): void {
        this.activeTab = tab;
        this.onChange?.(tab);
    }

    /** Reset to default tab (used on page enter / reload). */
    reset(): void {
        this.activeTab = this.defaultTab;
        this.onChange?.(this.activeTab);
    }

    /** Check if a given tab is the active one. */
    isActive(tab: T): boolean {
        return this.activeTab === tab;
    }

    /** Get the default tab value. */
    getDefault(): T {
        return this.defaultTab;
    }
}
