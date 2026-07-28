// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../login/Login', () => ({ renderLogin: vi.fn() }));
vi.mock('toastify-js', () => ({ default: vi.fn(() => ({ showToast: vi.fn() })) }));
vi.mock('../../shared/api-client', () => ({
    apiFetch: vi.fn(async () => ({})),
    loadProtectedImageObjectUrl: vi.fn(async () => null),
    revokeProtectedImageObjectUrl: vi.fn(),
}));

import { apiFetch } from '../../shared/api-client';
import { cleanupDashboardLayout, renderDashboardLayout } from '../DashboardLayout';

const trigger = (): HTMLElement => document.getElementById('user-menu-trigger')!;
const menu = (): HTMLElement => document.getElementById('user-menu')!;
const logoutButton = (): HTMLElement => document.getElementById('logout-btn')!;
const menuIsOpen = (): boolean =>
    menu().classList.contains('visible') && !menu().classList.contains('invisible');

beforeEach(() => {
    cleanupDashboardLayout();
    document.body.className = '';
    const app = document.createElement('div');
    app.id = 'app';
    document.body.replaceChildren(app);
    localStorage.clear();
    renderDashboardLayout('Dashboard', '<p>Content</p>', 'mahasiswa');
});

afterEach(() => {
    cleanupDashboardLayout();
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

describe('DashboardLayout account menu keyboard accessibility', () => {
    it('renders the trigger as a focusable real button with menu aria wiring', () => {
        expect(trigger().tagName).toBe('BUTTON');
        expect(trigger().getAttribute('type')).toBe('button');
        expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
        expect(trigger().getAttribute('aria-expanded')).toBe('false');
        expect(trigger().getAttribute('aria-controls')).toBe('user-menu');
        expect(menu().getAttribute('role')).toBe('menu');

        trigger().focus();
        expect(document.activeElement).toBe(trigger());
    });

    it('opens on trigger activation (click / native Enter-Space) and closes on a second activation', () => {
        expect(menuIsOpen()).toBe(false);

        // A real <button> fires click for Enter/Space natively, so click()
        // covers both pointer and keyboard activation.
        trigger().click();
        expect(menuIsOpen()).toBe(true);
        expect(trigger().getAttribute('aria-expanded')).toBe('true');

        trigger().click();
        expect(menuIsOpen()).toBe(false);
        expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('closes on Escape and returns focus to the trigger', () => {
        trigger().click();
        expect(menuIsOpen()).toBe(true);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(menuIsOpen()).toBe(false);
        expect(trigger().getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(trigger());
    });

    it('closes when clicking outside the menu', () => {
        trigger().click();
        expect(menuIsOpen()).toBe(true);

        (document.getElementById('dashboard-content') as HTMLElement).dispatchEvent(
            new MouseEvent('click', { bubbles: true }),
        );
        expect(menuIsOpen()).toBe(false);
    });

    it('exposes a focusable real logout button inside the open menu', () => {
        trigger().click();

        expect(logoutButton().tagName).toBe('BUTTON');
        expect(logoutButton().getAttribute('type')).toBe('button');
        logoutButton().focus();
        expect(document.activeElement).toBe(logoutButton());
    });

    it('still runs the existing logout flow and closes the menu on logout', async () => {
        localStorage.setItem('auth_token', 'token-123');
        trigger().click();

        logoutButton().click();
        await vi.waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/logout', { method: 'POST' });
        });
        expect(menuIsOpen()).toBe(false);
    });

    it('detaches its document listeners on cleanup', () => {
        const removeListener = vi.spyOn(document, 'removeEventListener');

        cleanupDashboardLayout();

        expect(removeListener).toHaveBeenCalledWith('click', expect.any(Function));
        expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
});
