import { showSuccess } from '../shared/toast'
import {
  getPasswordRotationStatus,
  logoutPasswordRotation,
  submitPasswordRotation,
} from './password-rotation-api'
import {
  clearAllAuthenticationState,
  clearPasswordRotationState,
  getPasswordRotationToken,
} from './password-rotation-state'

type ApiPayload = {
  code?: unknown
  message?: unknown
  errors?: unknown
}

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/
const LOGIN_AGAIN_MESSAGE = 'Sesi penggantian kata sandi tidak valid atau telah berakhir. Silakan login kembali.'

const readPayload = async (response: Response): Promise<ApiPayload> => {
  try {
    const payload: unknown = await response.json()
    return payload && typeof payload === 'object' ? payload as ApiPayload : {}
  } catch {
    return {}
  }
}

const payloadMessage = (payload: ApiPayload, fallback: string): string =>
  typeof payload.message === 'string' && payload.message.trim() ? payload.message : fallback

const validationMessage = (payload: ApiPayload): string | null => {
  if (!payload.errors || typeof payload.errors !== 'object') return null

  for (const value of Object.values(payload.errors as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const message = value.find((item): item is string => typeof item === 'string' && item.trim() !== '')
      if (message) return message
    }
    if (typeof value === 'string' && value.trim()) return value
  }

  return null
}

const returnToLogin = async (message: string): Promise<void> => {
  clearAllAuthenticationState()
  const { renderLogin } = await import('./Login')
  renderLogin(message)
}

const renderLoading = (): void => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  app.innerHTML = `
    <div class="min-h-screen w-full flex items-center justify-center bg-emerald-950 font-['Inter'] text-white">
      <div class="text-center">
        <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-teal-300"></div>
        <p class="text-sm text-white/75">Memeriksa sesi penggantian kata sandi...</p>
      </div>
    </div>
  `
}

const renderForm = (initialMessage?: string): void => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  app.innerHTML = `
    <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-['Inter'] bg-cover bg-center bg-no-repeat" style="background-image: url('/bc-login.png');">
      <div class="absolute inset-0" style="background: linear-gradient(135deg, rgba(2,44,34,0.92), rgba(6,78,59,0.88)); pointer-events: none;"></div>
      <div class="container mx-auto px-6 py-8 relative z-10 flex justify-center">
        <div class="w-full max-w-lg rounded-[2rem] p-8 md:p-10 text-white"
             style="background: rgba(255,255,255,0.07); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 20px 60px rgba(0,0,0,0.4);">
          <div class="mb-7 text-center">
            <img src="/ugm-logo.png" alt="University Logo" class="mx-auto mb-4 h-20 w-20 object-contain">
            <h1 class="text-3xl font-bold">Ganti Kata Sandi</h1>
            <p class="mt-2 text-sm leading-relaxed text-white/70">
              Akun Anda wajib menggunakan kata sandi baru sebelum dapat mengakses sistem.
            </p>
          </div>

          <div id="rotation-message" class="hidden mb-5 rounded-xl border px-4 py-3 text-sm"></div>

          <form id="password-rotation-form" class="space-y-5">
            <div class="space-y-2">
              <label for="rotation-password" class="block text-sm font-medium text-white/80">Kata Sandi Baru</label>
              <input id="rotation-password" type="password" minlength="10" autocomplete="new-password" required
                class="block w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none placeholder:text-white/30 focus:border-teal-400/50 focus:ring-4 focus:ring-teal-400/10"
                placeholder="Masukkan kata sandi baru">
            </div>

            <div class="space-y-2">
              <label for="rotation-password-confirmation" class="block text-sm font-medium text-white/80">Konfirmasi Kata Sandi</label>
              <input id="rotation-password-confirmation" type="password" minlength="10" autocomplete="new-password" required
                class="block w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none placeholder:text-white/30 focus:border-teal-400/50 focus:ring-4 focus:ring-teal-400/10"
                placeholder="Ulangi kata sandi baru">
            </div>

            <p class="text-xs leading-relaxed text-white/60">
              Minimal 10 karakter dan memuat huruf besar, huruf kecil, angka, serta simbol.
            </p>

            <button id="password-rotation-submit" type="submit"
              class="w-full rounded-xl border border-white/20 bg-gradient-to-r from-[#008080] to-teal-500 px-4 py-3.5 font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50">
              Simpan Kata Sandi
            </button>
            <button id="password-rotation-cancel" type="button"
              class="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10">
              Batalkan dan Kembali ke Login
            </button>
          </form>
        </div>
      </div>
    </div>
  `

  const messageElement = document.getElementById('rotation-message')
  const showMessage = (message: string, kind: 'info' | 'error' = 'error'): void => {
    if (!messageElement) return
    messageElement.textContent = message
    messageElement.className = kind === 'info'
      ? 'mb-5 rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 py-3 text-sm text-teal-100'
      : 'mb-5 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm text-red-100'
  }

  if (initialMessage) showMessage(initialMessage, 'info')

  document.getElementById('password-rotation-cancel')?.addEventListener('click', async () => {
    const token = getPasswordRotationToken()
    if (token) {
      try {
        await logoutPasswordRotation(token)
      } catch {
        // Local cleanup must still complete if logout is unavailable.
      }
    }
    await returnToLogin('Penggantian kata sandi dibatalkan. Silakan login kembali.')
  })

  document.getElementById('password-rotation-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const password = (document.getElementById('rotation-password') as HTMLInputElement).value
    const passwordConfirmation = (
      document.getElementById('rotation-password-confirmation') as HTMLInputElement
    ).value
    const submitButton = document.getElementById('password-rotation-submit') as HTMLButtonElement

    if (password !== passwordConfirmation) {
      showMessage('Kata sandi dan konfirmasi tidak cocok.')
      return
    }
    if (!STRONG_PASSWORD.test(password)) {
      showMessage('Kata sandi minimal 10 karakter dan harus memuat huruf besar, huruf kecil, angka, serta simbol.')
      return
    }

    const token = getPasswordRotationToken()
    if (!token) {
      await returnToLogin(LOGIN_AGAIN_MESSAGE)
      return
    }

    submitButton.disabled = true
    submitButton.textContent = 'Menyimpan...'

    try {
      const response = await submitPasswordRotation(token, {
        password,
        password_confirmation: passwordConfirmation,
      })
      const payload = await readPayload(response)

      if (response.ok) {
        clearAllAuthenticationState()
        showSuccess(payloadMessage(payload, 'Kata sandi berhasil diganti. Silakan login kembali.'), 3000)
        const { renderLogin } = await import('./Login')
        renderLogin('Kata sandi berhasil diganti. Silakan login dengan kata sandi baru.')
        return
      }

      if (response.status === 401 || response.status === 403) {
        await returnToLogin(LOGIN_AGAIN_MESSAGE)
        return
      }

      showMessage(
        validationMessage(payload)
          ?? payloadMessage(payload, 'Kata sandi tidak dapat diperbarui. Silakan periksa kembali isian Anda.'),
      )
    } catch {
      showMessage('Tidak dapat terhubung ke server. Silakan coba kembali.')
    } finally {
      if (submitButton.isConnected) {
        submitButton.disabled = false
        submitButton.textContent = 'Simpan Kata Sandi'
      }
    }
  })
}

export const renderPasswordRotation = async (initialMessage?: string): Promise<void> => {
  const token = getPasswordRotationToken()
  if (!token) {
    await returnToLogin(LOGIN_AGAIN_MESSAGE)
    return
  }

  renderLoading()

  try {
    const response = await getPasswordRotationStatus(token)
    const payload = await readPayload(response)

    if (response.status === 401 || response.status === 403) {
      await returnToLogin(LOGIN_AGAIN_MESSAGE)
      return
    }

    if (!response.ok) {
      clearPasswordRotationState()
      await returnToLogin(payloadMessage(payload, LOGIN_AGAIN_MESSAGE))
      return
    }

    renderForm(initialMessage ?? payloadMessage(payload, 'Silakan buat kata sandi baru untuk melanjutkan.'))
  } catch {
    clearPasswordRotationState()
    await returnToLogin('Tidak dapat memeriksa sesi penggantian kata sandi. Silakan login kembali.')
  }
}
