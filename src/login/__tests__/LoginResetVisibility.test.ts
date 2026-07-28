// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../PasswordRotation', () => ({ renderPasswordRotation: vi.fn() }))
vi.mock('../ResetPassword', () => ({ renderForgotPassword: vi.fn() }))
vi.mock('../../shared/api-client', () => ({ apiFetch: vi.fn() }))
vi.mock('../../mahasiswa/ProfileCompletion', () => ({ renderProfileCompletion: vi.fn() }))
vi.mock('../../dashboard/AdminDashboard', () => ({ renderAdminDashboard: vi.fn() }))
vi.mock('../../dashboard/MahasiswaDashboard', () => ({ renderMahasiswaDashboard: vi.fn() }))
vi.mock('../../dashboard/TendikDashboard', () => ({ renderTendikDashboard: vi.fn() }))
vi.mock('../../dashboard/AkademikDashboard', () => ({ renderAkademikDashboard: vi.fn() }))
vi.mock('toastify-js', () => ({ default: vi.fn(() => ({ showToast: vi.fn() })) }))

import { renderLogin } from '../Login'

const configResponse = (enabled: boolean): Response => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => ({ password_reset_enabled: enabled }),
} as unknown as Response)

const resetLink = () => document.getElementById('trigger-forgot-password')

describe('password-reset link visibility follows server availability', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('hides the reset link by default (before any config resolves)', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})) // never resolves
    renderLogin()
    expect(resetLink()?.classList.contains('hidden')).toBe(true)
  })

  it('shows Google-login guidance that matches the real auth policy', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))
    renderLogin()
    const hint = document.getElementById('login-google-hint')?.textContent ?? ''
    expect(hint).toContain('Google UGM')
    expect(hint).toContain('Mahasiswa baru') // students self-onboard
    expect(hint).toContain('Super Admin') // staff are pre-provisioned
  })

  it('reveals the reset link only when the server says reset is available', async () => {
    vi.mocked(fetch).mockImplementation(async (url: RequestInfo | URL) =>
      String(url).includes('/api/auth/config') ? configResponse(true) : configResponse(false))
    renderLogin()
    await vi.waitFor(() => {
      expect(resetLink()?.classList.contains('hidden')).toBe(false)
    })
  })

  it('keeps the reset link hidden when reset is unavailable — no dead-end link', async () => {
    vi.mocked(fetch).mockImplementation(async () => configResponse(false))
    renderLogin()
    // Give the async probe a chance to run.
    await Promise.resolve()
    await Promise.resolve()
    expect(resetLink()?.classList.contains('hidden')).toBe(true)
  })

  it('fails safe — the link stays hidden if the config probe errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    renderLogin()
    await Promise.resolve()
    await Promise.resolve()
    expect(resetLink()?.classList.contains('hidden')).toBe(true)
  })
})
