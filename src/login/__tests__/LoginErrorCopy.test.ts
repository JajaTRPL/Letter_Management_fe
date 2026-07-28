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

const jsonResponse = (status: number, body: Record<string, unknown>): Response => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
} as unknown as Response)

async function submitLoginExpectingError(status: number, body: Record<string, unknown>): Promise<string> {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(status, body))
  renderLogin()
  const email = document.getElementById('email') as HTMLInputElement
  const password = document.getElementById('password') as HTMLInputElement
  email.value = 'user@mail.ugm.ac.id'
  password.value = 'whatever'
  email.dispatchEvent(new Event('input'))
  password.dispatchEvent(new Event('input'))
  document.getElementById('login-form')?.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  )
  await vi.waitFor(() => {
    expect(document.getElementById('login-error')?.classList.contains('hidden')).toBe(false)
  })
  return document.getElementById('login-error')?.textContent ?? ''
}

describe('login failure copy is clear and never mislabels the cause', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    localStorage.clear()
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows the throttle message on 429 — never "wrong password"', async () => {
    const text = await submitLoginExpectingError(429, {
      message: 'Terlalu banyak percobaan masuk untuk akun ini. Silakan coba lagi dalam 60 detik.',
      seconds_left: 60,
    })
    expect(text).toContain('Terlalu banyak percobaan masuk')
    expect(text).not.toContain('tidak sesuai')
  })

  it('shows the suspension message on 403 — never "wrong password"', async () => {
    const text = await submitLoginExpectingError(403, {
      message: 'Akun Anda telah disuspend. Silakan hubungi admin.',
    })
    expect(text).toContain('disuspend')
    expect(text).not.toContain('tidak sesuai')
  })

  it('surfaces the retired-initial-password guidance on a coded 401', async () => {
    const text = await submitLoginExpectingError(401, {
      code: 'INITIAL_PASSWORD_RETIRED',
      message: 'Password awal tidak lagi berlaku. Gunakan Google UGM atau Lupa Kata Sandi.',
    })
    expect(text).toContain('Gunakan Google UGM atau Lupa Kata Sandi')
  })

  it('keeps the friendly generic copy for an ordinary wrong-password 401', async () => {
    const text = await submitLoginExpectingError(401, { message: 'Email atau password salah' })
    expect(text).toBe('Email atau kata sandi yang Anda masukkan tidak sesuai. Silakan coba lagi.')
  })
})
