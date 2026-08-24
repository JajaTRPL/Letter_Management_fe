// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  submit: vi.fn(),
  logout: vi.fn(),
  renderLogin: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../password-rotation-api', () => ({
  getPasswordRotationStatus: mocks.getStatus,
  submitPasswordRotation: mocks.submit,
  logoutPasswordRotation: mocks.logout,
}))
vi.mock('../Login', () => ({ renderLogin: mocks.renderLogin }))
vi.mock('../../shared/toast', () => ({
  showSuccess: mocks.showToast,
  showError: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn(),
}))

import { renderPasswordRotation } from '../PasswordRotation'
import { storePasswordRotationChallenge } from '../password-rotation-state'

const jsonResponse = (status: number, payload: object): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
} as Response)

describe('password rotation page', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    localStorage.clear()
    sessionStorage.clear()
    for (const mock of Object.values(mocks)) mock.mockReset()
  })

  it('validates strength before submitting', async () => {
    storePasswordRotationChallenge('rotation-token', 900)
    mocks.getStatus.mockResolvedValue(jsonResponse(200, {
      success: true,
      code: 'PASSWORD_ROTATION_REQUIRED',
      message: 'Gunakan kata sandi baru.',
    }))

    await renderPasswordRotation()
    const password = document.getElementById('rotation-password') as HTMLInputElement
    const confirmation = document.getElementById('rotation-password-confirmation') as HTMLInputElement
    password.value = 'weakpassword'
    confirmation.value = 'weakpassword'
    document.getElementById('password-rotation-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    expect(mocks.submit).not.toHaveBeenCalled()
    expect(document.getElementById('rotation-message')?.textContent).toContain('minimal 10 karakter')
  })

  it('clears every auth credential after success and returns to login without auto-login', async () => {
    localStorage.setItem('auth_token', 'stale-normal-token')
    localStorage.setItem('auth_role', 'mahasiswa')
    storePasswordRotationChallenge('rotation-token', 900)
    mocks.getStatus.mockResolvedValue(jsonResponse(200, {
      success: true,
      code: 'PASSWORD_ROTATION_REQUIRED',
    }))
    mocks.submit.mockResolvedValue(jsonResponse(200, {
      success: true,
      message: 'Kata sandi berhasil diperbarui.',
    }))

    await renderPasswordRotation()
    const password = document.getElementById('rotation-password') as HTMLInputElement
    const confirmation = document.getElementById('rotation-password-confirmation') as HTMLInputElement
    password.value = 'StrongPass1!'
    confirmation.value = 'StrongPass1!'
    document.getElementById('password-rotation-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    await vi.waitFor(() => {
      expect(mocks.renderLogin).toHaveBeenCalledWith(
        'Kata sandi berhasil diganti. Silakan login dengan kata sandi baru.',
      )
    })

    expect(mocks.submit).toHaveBeenCalledWith('rotation-token', {
      password: 'StrongPass1!',
      password_confirmation: 'StrongPass1!',
    })
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('auth_role')).toBeNull()
    expect(sessionStorage.getItem('password_rotation_token')).toBeNull()
  })

  it('clears an unauthorized challenge and returns to login', async () => {
    storePasswordRotationChallenge('expired-token', 900)
    mocks.getStatus.mockResolvedValue(jsonResponse(401, {
      success: false,
      message: 'Token expired.',
    }))

    await renderPasswordRotation()

    expect(sessionStorage.getItem('password_rotation_token')).toBeNull()
    expect(mocks.renderLogin).toHaveBeenCalledWith(
      'Sesi penggantian kata sandi tidak valid atau telah berakhir. Silakan login kembali.',
    )
  })
})
