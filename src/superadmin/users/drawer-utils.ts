/**
 * Shared drawer utilities — used by Export and Import drawers.
 * Handles drawer root element management and close animation.
 */

const DRAWER_ID = 'global-drawer-root';

export const closeDrawer = () => {
    const container = document.getElementById(DRAWER_ID);
    if (!container) return;
    const overlay = container.querySelector('.drawer-overlay') as HTMLElement;
    const panel = container.querySelector('.drawer-panel') as HTMLElement;
    if (overlay) overlay.style.opacity = '0';
    if (panel) panel.style.transform = 'translateX(100%)';
    setTimeout(() => {
        container.remove();
    }, 300);
};

export const getOrCreateDrawerRoot = (): HTMLElement => {
    let root = document.getElementById(DRAWER_ID);
    if (!root) {
        root = document.createElement('div');
        root.id = DRAWER_ID;
        document.body.appendChild(root);
    }
    return root;
};
