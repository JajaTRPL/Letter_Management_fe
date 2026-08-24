// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  toast: vi.fn((_options: { text: string }) => ({ showToast: vi.fn() })),
  renderLogin: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('toastify-js', () => ({ default: mocks.toast }))
// ResetPassword.ts now routes through the shared toast wrapper instead of
// calling Toastify directly. Re-route the wrapper's calls back through the
// same `mocks.toast` spy so existing assertions on `options.text` still work.
vi.mock('../../shared/toast', () => ({
  showSuccess: (text: string) => mocks.toast({ text }),
  showError: (text: string) => mocks.toast({ text }),
  showWarning: (text: string) => mocks.toast({ text }),
  showInfo: (text: string) => mocks.toast({ text }),
}))
vi.mock('../Login', () => ({ renderLogin: mocks.renderLogin }))

import { renderForgotPassword } from '../ResetPassword'

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
  },
  json: async () => body,
}) as Response

const flushAsync = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const submitForgotPassword = async (email: string, responseBody: unknown) => {
  mocks.fetch.mockResolvedValueOnce(jsonResponse(responseBody))
  renderForgotPassword()

  const emailInput = document.getElementById('email') as HTMLInputElement
  emailInput.value = email
  emailInput.dispatchEvent(new Event('input', { bubbles: true }))
  document.getElementById('forgot-password-form')?.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  )
  await flushAsync()
}

const fillOtp = (code: string) => {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.otp-input'))
  code.split('').forEach((digit, index) => {
    inputs[index].value = digit
    inputs[index].dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = '<div id="app"></div>'
  localStorage.clear()
  mocks.toast.mockClear()
  mocks.renderLogin.mockClear()
  mocks.fetch.mockReset()
  vi.stubGlobal('fetch', mocks.fetch)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('forgot-password email OTP flow', () => {
  it('renders the email-only request form', () => {
    renderForgotPassword()

    expect(document.getElementById('forgot-password-form')).not.toBeNull()
    expect(document.querySelector<HTMLInputElement>('#email')?.type).toBe('email')
    expect(document.body.textContent).toContain('Lupa Kata Sandi?')
    expect(document.body.textContent).not.toContain('Mode simulasi')
  })

  it('uses the same generic request UX for known and unknown emails', async () => {
    const generic = { message: 'Jika email terdaftar, kode verifikasi telah dikirim.' }

    await submitForgotPassword('KNOWN@EXAMPLE.TEST', generic)
    expect(document.getElementById('verify-token-form')).not.toBeNull()
    expect(JSON.parse(String(mocks.fetch.mock.calls[0][1]?.body))).toEqual({
      email: 'known@example.test',
    })

    await submitForgotPassword('unknown@example.test', generic)
    expect(document.getElementById('verify-token-form')).not.toBeNull()

    const messages = mocks.toast.mock.calls.map(([options]) => String(options.text))
    expect(messages.every((message) => !/terdaftar|tidak ditemukan/i.test(
      message.replace('Jika email terdaftar, kode verifikasi telah dikirim.', ''),
    ))).toBe(true)
    expect(messages.filter((message) => message === generic.message)).toHaveLength(2)
  })

  it('does not show an OTP in normal mode and shows it only when the backend explicitly supplies local simulation data', async () => {
    await submitForgotPassword('normal@example.test', {
      message: 'Jika email terdaftar, kode verifikasi telah dikirim.',
    })

    expect(mocks.toast.mock.calls.some(([options]) => String(options.text).includes('Mode simulasi'))).toBe(false)

    await submitForgotPassword('local@example.test', {
      message: 'Jika email terdaftar, kode verifikasi telah dikirim.',
      token_simulation: '123456',
    })

    expect(mocks.toast.mock.calls.some(([options]) => (
      String(options.text).includes('Mode simulasi lokal')
      && String(options.text).includes('123456')
    ))).toBe(true)
  })

  it('renders numeric OTP inputs and displays invalid or expired backend errors safely', async () => {
    await submitForgotPassword('person@example.test', {
      message: 'Jika email terdaftar, kode verifikasi telah dikirim.',
    })

    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.otp-input'))
    expect(inputs).toHaveLength(6)
    expect(inputs.every((input) => input.inputMode === 'numeric')).toBe(true)

    mocks.fetch.mockResolvedValueOnce(jsonResponse({
      message: 'Kode verifikasi telah kedaluwarsa. Silakan minta kode baru.',
    }, 422))
    fillOtp('123456')
    document.getElementById('verify-token-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    await flushAsync()

    expect(mocks.toast.mock.calls.some(([options]) => (
      String(options.text) === 'Kode verifikasi telah kedaluwarsa. Silakan minta kode baru.'
    ))).toBe(true)
  })

  it('shows the initial resend countdown immediately and enables resend when it finishes', async () => {
    await submitForgotPassword('person@example.test', {
      message: 'Jika email terdaftar, kode verifikasi telah dikirim.',
    })

    const resend = document.getElementById('back-to-forgot') as HTMLButtonElement
    expect(resend.disabled).toBe(true)
    expect(resend.textContent?.trim()).toBe('Kirim ulang dalam 60 detik')
    expect(document.getElementById('resend-helper')?.textContent).toContain(
      'Anda dapat meminta kode baru setelah hitung mundur selesai.',
    )

    vi.advanceTimersByTime(1_000)
    expect(resend.textContent?.trim()).toBe('Kirim ulang dalam 59 detik')

    vi.advanceTimersByTime(59_000)
    expect(resend.disabled).toBe(false)
    expect(resend.textContent?.trim()).toBe('Kirim ulang kode')
  })

  it('resets the visible cooldown after a successful resend', async () => {
    const generic = 'Jika email terdaftar, kode verifikasi telah dikirim.'
    await submitForgotPassword('person@example.test', { message: generic })

    vi.advanceTimersByTime(60_000)
    const resend = document.getElementById('back-to-forgot') as HTMLButtonElement
    expect(resend.disabled).toBe(false)

    mocks.fetch.mockResolvedValueOnce(jsonResponse({ message: generic }))
    resend.click()
    await flushAsync()

    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(resend.disabled).toBe(true)
    expect(resend.textContent?.trim()).toBe('Kirim ulang dalam 60 detik')
    expect(mocks.toast.mock.calls.some(([options]) => String(options.text) === generic)).toBe(true)
  })

  it('uses backend retry timing for HTTP 429 and keeps the OTP step active', async () => {
    await submitForgotPassword('person@example.test', {
      message: 'Jika email terdaftar, kode verifikasi telah dikirim.',
    })

    vi.advanceTimersByTime(60_000)
    const resend = document.getElementById('back-to-forgot') as HTMLButtonElement

    mocks.fetch.mockResolvedValueOnce(jsonResponse({
      message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
      seconds_left: 30,
    }, 429))
    resend.click()
    await flushAsync()

    expect(document.getElementById('verify-token-form')).not.toBeNull()
    expect(resend.disabled).toBe(true)
    expect(resend.textContent?.trim()).toBe('Kirim ulang dalam 30 detik')
    expect(mocks.toast.mock.calls.some(([options]) => (
      String(options.text) === 'Terlalu banyak permintaan. Silakan coba lagi nanti.'
    ))).toBe(true)
  })

  it('keeps reset state in memory, validates confirmation, and returns to login without auto-login', async () => {
    await submitForgotPassword('person@example.test', {
      message: 'Jika email terdaftar, kode verifikasi telah dikirim.',
    })

    const resetToken = 'a'.repeat(64)
    mocks.fetch.mockResolvedValueOnce(jsonResponse({
      message: 'Kode berhasil diverifikasi.',
      reset_token: resetToken,
    }))
    fillOtp('123456')
    document.getElementById('verify-token-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    await flushAsync()

    expect(document.getElementById('reset-password-form')).not.toBeNull()

    const password = document.getElementById('new-password') as HTMLInputElement
    const confirmation = document.getElementById('confirm-password') as HTMLInputElement
    password.value = 'NewSecure1!'
    confirmation.value = 'Different1!'
    document.getElementById('reset-password-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    await flushAsync()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)

    confirmation.value = 'NewSecure1!'
    mocks.fetch.mockResolvedValueOnce(jsonResponse({
      message: 'Kata sandi berhasil direset. Silakan login kembali.',
    }))
    document.getElementById('reset-password-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    await flushAsync()
    await vi.dynamicImportSettled()

    const resetRequest = JSON.parse(String(mocks.fetch.mock.calls[2][1]?.body))
    expect(resetRequest).toEqual({
      email: 'person@example.test',
      reset_token: resetToken,
      password: 'NewSecure1!',
      password_confirmation: 'NewSecure1!',
    })
    expect(password.value).toBe('')
    expect(confirmation.value).toBe('')
    expect(mocks.renderLogin).toHaveBeenCalledOnce()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })
})
