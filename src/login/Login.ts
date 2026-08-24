import { renderForgotPassword } from './ResetPassword'
import { showError } from '../shared/toast'
import { renderAdminDashboard } from '../dashboard/AdminDashboard'
import { renderMahasiswaDashboard } from '../dashboard/MahasiswaDashboard'
import { renderTendikDashboard } from '../dashboard/TendikDashboard'
import { renderAkademikDashboard } from '../dashboard/AkademikDashboard'
import { renderProfileCompletion } from '../mahasiswa/ProfileCompletion'
import { UserStatus } from '../shared/user-status'
import { apiFetch } from '../shared/api-client'
import type { ProfileCompletionStatus } from '../mahasiswa/ProfileCompletion'
import { clearNormalAuthState } from '../shared/auth-state'
import { renderPasswordRotation } from './PasswordRotation'
import {
  clearPasswordRotationState,
  storePasswordRotationChallenge,
} from './password-rotation-state'

export const handleRedirection = async (
  role: string,
  needsCompletion?: boolean,
  completion?: ProfileCompletionStatus,
) => {
  localStorage.setItem('auth_role', role)
  const status = localStorage.getItem('auth_status')
  let resolvedCompletion = completion
  let requiresCompletion = needsCompletion

  if (resolvedCompletion) {
    localStorage.setItem('auth_completion', JSON.stringify(resolvedCompletion))
  }

  if (requiresCompletion === undefined && localStorage.getItem('auth_token')) {
    try {
      const response = await apiFetch('/api/auth/profile-completion')
      if (response.ok) {
        const payload = await response.json()
        resolvedCompletion = payload.completion
        requiresCompletion = Boolean(resolvedCompletion?.needs_completion)
        localStorage.setItem('auth_completion', JSON.stringify(resolvedCompletion))
      }
    } catch {
      // Fall back to the persisted lifecycle status when the status check is unavailable.
    }
  }

  if (requiresCompletion === undefined) {
    requiresCompletion =
      localStorage.getItem('auth_requires_completion') === 'true'
      || status === UserStatus.PENDING_PROFILE
  }

  if (requiresCompletion) {
    localStorage.setItem('auth_requires_completion', 'true')
    await renderProfileCompletion(resolvedCompletion)
    return
  }

  localStorage.removeItem('auth_requires_completion')
  localStorage.removeItem('auth_completion')

  if (role === 'super_admin') {
    renderAdminDashboard()
  } else if (role === 'mahasiswa') {
    renderMahasiswaDashboard()
  } else if (role === 'tendik') {
    renderTendikDashboard(role)
  } else if (['akademik', 'kaprodi', 'kadep', 'sekdep', 'sekprodi'].includes(role)) {
    renderAkademikDashboard(role)
  } else {
    showError('Role tidak dikenali, menghubungi admin.')
  }
}

export const renderLogin = (initialMessage?: string) => {
  clearPasswordRotationState()
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-['Inter'] bg-cover bg-center bg-no-repeat" style="background-image: url('/bc-login.png');">
      <!-- Dark Overlay Gradient -->
      <div class="absolute inset-0" style="background: linear-gradient(135deg, rgba(2,44,34,0.9), rgba(6,78,59,0.85)); pointer-events: none;"></div>

      <div class="container mx-auto px-6 py-8 relative z-10 flex justify-center">
        <!-- BIG GLASS PANEL -->
        <div class="flex flex-col lg:flex-row items-center justify-around gap-12 w-full max-w-6xl rounded-[2.5rem] p-10 lg:p-14 relative" 
             style="background: rgba(255,255,255,0.04); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 20px 60px rgba(0,0,0,0.4), inset 0 1px rgba(255,255,255,0.1);">
        
        <div class="flex flex-col items-center text-center lg:items-center lg:text-center max-w-xl text-white">
          <div class="mb-6 animate-fade-in">
            <img src="/ugm-logo.png" alt="University Logo" class="w-32 h-32 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          </div>
          <h1 class="text-3xl md:text-5xl font-bold leading-tight tracking-tight drop-shadow-lg text-center text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">
            Sistem Persuratan<br>
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-emerald-300">Departemen Teknik Elektro dan Informatika</span>
          </h1>
        </div>

        <div class="flex flex-col items-center w-full max-w-md">
          <div class="w-full p-8 md:p-10 rounded-[2rem] relative shadow-2xl animate-slide-up" style="background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2);">
            
            <div class="text-center mb-8 text-white">
              <h2 class="text-3xl font-bold mb-2 tracking-tight">Selamat Datang</h2>
              <p class="text-sm text-white/70">Silakan masuk menggunakan email dan kata sandi Anda</p>
            </div>

            <form id="login-form" class="space-y-5">
              <div class="space-y-2">
                <label for="email" class="block text-sm font-medium text-white/80 ml-1">Email</label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-teal-300 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <input 
                    type="email" 
                    id="email" 
                    placeholder="Masukkan email" 
                    required
                    class="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl outline-none transition-all text-white placeholder-white/30 shadow-inner focus:bg-black/30 focus:border-teal-400/50 focus:ring-4 focus:ring-teal-400/10"
                  >
                </div>
              </div>

              <div class="space-y-2">
                <label for="password" class="block text-sm font-medium text-white/80 ml-1">Kata Sandi</label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-teal-300 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <input 
                    type="password" 
                    id="password" 
                    placeholder="Masukkan kata sandi" 
                    required
                    autocomplete="current-password"
                    class="block w-full pl-11 pr-12 py-3.5 bg-black/20 border border-white/10 rounded-xl outline-none transition-all text-white placeholder-white/30 shadow-inner focus:bg-black/30 focus:border-teal-400/50 focus:ring-4 focus:ring-teal-400/10"
                  >
                  <button type="button" id="toggle-password" class="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white/80 transition-colors focus:outline-none">
                    <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between pt-1">
                <div class="flex items-center">
                  <input 
                    id="remember" 
                    name="remember" 
                    type="checkbox" 
                    class="h-4 w-4 bg-black/20 border-white/20 rounded text-teal-400 focus:ring-teal-400/30 cursor-pointer"
                  >
                  <label for="remember" class="ml-2 block text-sm text-white/70 cursor-pointer hover:text-white transition-colors">
                    Ingat saya
                  </label>
                </div>
                <button type="button" id="trigger-forgot-password" class="hidden text-xs font-medium text-teal-300 hover:text-teal-200 hover:drop-shadow-[0_0_8px_rgba(94,234,212,0.5)] transition-all focus:outline-none">Lupa Kata Sandi?</button>
              </div>

              <button 
                type="submit"
                id="submit-btn"
                disabled
                class="w-full flex justify-center py-3.5 px-4 rounded-xl text-base font-bold text-white transition-all transform active:scale-[0.97] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#008080] to-teal-500 hover:from-teal-400 hover:to-[#008080] shadow-[0_4px_15px_rgba(0,128,128,0.4)] hover:shadow-[0_8px_25px_rgba(0,128,128,0.6)] border border-white/20"
              >
                Masuk
              </button>

              <div id="login-error" class="hidden w-full rounded-xl px-4 py-3 text-center text-sm font-medium bg-red-500/20 text-red-200 border border-red-500/30 backdrop-blur-md shadow-inner"></div>

              <div class="relative my-6 flex items-center justify-center">
                <div class="absolute w-full border-t border-white/10"></div>
                <span class="relative px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-semibold tracking-wider uppercase text-white/50 backdrop-blur-md shadow-sm">atau</span>
              </div>

              <button type="button" id="google-login-btn" class="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl transition-all transform active:scale-[0.97] focus:outline-none text-sm font-semibold text-white bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/30 shadow-[0_4px_15px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.2)]">
                <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Masuk dengan Google
              </button>

              <p id="login-google-hint" class="mt-4 text-center text-xs leading-relaxed text-white/50">
                Gunakan akun <span class="font-medium text-white/70">Google UGM</span> Anda (@mail.ugm.ac.id / @ugm.ac.id). Mahasiswa baru bisa langsung masuk lalu melengkapi data. Akun staf &amp; dosen didaftarkan lebih dulu oleh Super Admin.
              </p>

              <!-- Google's own rendered button, kept off-screen. Our styled
                   button above proxies a click into it instead of relying
                   solely on the One Tap prompt() flow, which some browsers
                   silently refuse when FedCM is disabled or was previously
                   dismissed by the user for this site. -->
              <div id="google-real-btn" style="position: fixed; top: -9999px; left: -9999px;"></div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `

  const passwordInput = document.getElementById('password') as HTMLInputElement
  const emailInput = document.getElementById('email') as HTMLInputElement
  const toggleBtn = document.getElementById('toggle-password') as HTMLButtonElement
  const eyeIcon = document.getElementById('eye-icon') as any
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement

  const updateSubmitBtn = () => {
    const filled = emailInput.value.trim() !== '' && passwordInput.value !== ''
    submitBtn.disabled = !filled
  }

  emailInput.addEventListener('input', updateSubmitBtn)
  passwordInput.addEventListener('input', updateSubmitBtn)

  // Email-based password reset is an email-dependent feature. Reveal its link
  // ONLY when the server confirms it is operationally available (a real mail
  // path exists), so we never offer a "Lupa Kata Sandi" flow that dead-ends —
  // fail-safe: on any error or when disabled, the link stays hidden.
  void (async () => {
    try {
      const res = await fetch('/api/auth/config')
      if (!res.ok) return
      const cfg = await res.json()
      if (cfg?.password_reset_enabled === true) {
        document.getElementById('trigger-forgot-password')?.classList.remove('hidden')
      }
    } catch {
      // Leave the reset link hidden.
    }
  })()

  const showLoginError = (message: string) => {
    const errorEl = document.getElementById('login-error')
    if (errorEl) {
      errorEl.textContent = message
      errorEl.classList.remove('hidden')
    }
  }

  const hideLoginError = () => {
    const errorEl = document.getElementById('login-error')
    if (errorEl) {
      errorEl.classList.add('hidden')
      errorEl.textContent = ''
    }
  }

  if (initialMessage) showLoginError(initialMessage)

  toggleBtn?.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password'
    passwordInput.type = isPassword ? 'text' : 'password'

    if (isPassword) {
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      `
    } else {
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      `
    }
  })

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    hideLoginError()
    const email = (document.getElementById('email') as HTMLInputElement).value
    const password = passwordInput.value
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      }

      if (response.ok) {
        clearPasswordRotationState()
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('auth_name', data.user.name)
        localStorage.setItem('auth_user_id', String(data.user.id))
        if (data.user.sub_role) {
            localStorage.setItem('auth_sub_role', data.user.sub_role)
        } else {
            localStorage.removeItem('auth_sub_role')
        }
        if (data.user.role_level) {
            localStorage.setItem('auth_role_level', data.user.role_level)
        } else {
            localStorage.removeItem('auth_role_level')
        }
        if (data.user.assigned_tasks) {
            localStorage.setItem('auth_assigned_tasks', JSON.stringify(data.user.assigned_tasks))
        } else {
            localStorage.removeItem('auth_assigned_tasks')
        }
        if (data.user.tendik_role) {
            localStorage.setItem('auth_tendik_role', data.user.tendik_role)
        } else {
            localStorage.removeItem('auth_tendik_role')
        }
        localStorage.setItem('auth_status', data.user.status)
        handleRedirection(
          data.user.sub_role && ['kaprodi', 'kadep', 'sekdep', 'sekprodi'].includes(data.user.sub_role)
            ? data.user.sub_role
            : data.user.role,
          data.needs_completion,
          data.completion,
        )
      } else {
        if (response.status === 423 && data.code === 'PASSWORD_ROTATION_REQUIRED') {
          clearNormalAuthState()
          if (
            typeof data.rotation_token === 'string'
            && typeof data.expires_in === 'number'
            && storePasswordRotationChallenge(data.rotation_token, data.expires_in)
          ) {
            await renderPasswordRotation(
              typeof data.message === 'string' ? data.message : undefined,
            )
            return
          }
        }

        const serverMessage = typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : ''
        if (response.status === 404) {
          showLoginError('Endpoint API tidak ditemukan (404). Pastikan backend Laravel sudah jalan di port 8000.')
        } else if (response.status === 423) {
          showLoginError('Sesi penggantian kata sandi tidak valid. Silakan coba login kembali.')
        } else if (response.status === 403 || response.status === 429) {
          // Akun disuspend, atau terlalu banyak percobaan (rate limit sementara).
          // Tampilkan pesan asli server — JANGAN salah menyebutnya "kata sandi
          // salah", agar pengguna tahu ini bukan soal password dan bisa pulih.
          showLoginError(serverMessage || 'Login tidak dapat dilanjutkan saat ini. Silakan coba lagi nanti.')
        } else if (response.status === 401 && data.code === 'INITIAL_PASSWORD_RETIRED') {
          // Password awal sudah tidak berlaku — arahkan ke jalur login yang benar.
          showLoginError(serverMessage || 'Password awal tidak lagi berlaku. Gunakan Google UGM atau Lupa Kata Sandi.')
        } else {
          // Kredensial salah (401) — pesan ramah dengan panduan mencoba lagi.
          showLoginError('Email atau kata sandi yang Anda masukkan tidak sesuai. Silakan coba lagi.')
        }
      }
    } catch (error) {
      console.error('Error:', error)
      showLoginError('Tidak dapat terhubung ke server. Pastikan backend Laravel aktif.')
    }
  })

  document.getElementById('trigger-forgot-password')?.addEventListener('click', () => {
    renderForgotPassword()
  })

  // Google Sign-In handler (GIS credential/ID token flow)
  document.getElementById('google-login-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('google-login-btn') as HTMLButtonElement
    btn.disabled = true
    btn.innerHTML = 'Memproses...'

    // Watchdog for a FedCM request that the browser aborts without ever
    // invoking GIS's `callback` below (e.g. third-party sign-in disabled,
    // or previously dismissed for this site — see the FedCM comment further
    // down). Without this, `settled` never flips and the button is stuck on
    // "Memproses..." forever with no feedback. 12s is generous headroom
    // over a normal credential round-trip.
    let settled = false
    let watchdog: ReturnType<typeof setTimeout> | undefined

    try {
      await loadGIS()

      const clientId = getGoogleClientId()
      if (!clientId) {
        showLoginError('Google Client ID belum dikonfigurasi.')
        btn.disabled = false
        btn.innerHTML = googleBtnContent
        return
      }

      const google = (window as any).google

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          settled = true
          clearTimeout(watchdog)

          if (!response.credential) {
            showLoginError('Google login dibatalkan.')
            resetGoogleBtn(btn)
            return
          }

          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            })

            const data = await res.json()

            if (res.ok) {
              clearPasswordRotationState()
              localStorage.setItem('auth_token', data.token)
              localStorage.setItem('auth_name', data.user.name)
              localStorage.setItem('auth_user_id', String(data.user.id))
              localStorage.setItem('auth_status', data.user.status)
              if (data.user.sub_role) {
                localStorage.setItem('auth_sub_role', data.user.sub_role)
              } else {
                localStorage.removeItem('auth_sub_role')
              }
              if (data.user.tendik_role) {
                localStorage.setItem('auth_tendik_role', data.user.tendik_role)
              } else {
                localStorage.removeItem('auth_tendik_role')
              }
              if (data.user.avatar_url) localStorage.setItem('auth_avatar', data.user.avatar_url)
              const dashboardRole =
                data.user.sub_role && ['kaprodi', 'kadep', 'sekdep', 'sekprodi'].includes(data.user.sub_role)
                  ? data.user.sub_role
                  : data.user.role
              handleRedirection(dashboardRole, data.needs_completion, data.completion)
            } else {
              showLoginError(data.message || 'Google login gagal.')
              resetGoogleBtn(btn)
            }
          } catch (err) {
            console.error(err)
            showLoginError('Gagal memproses login Google.')
            resetGoogleBtn(btn)
          }
        },
      })

      // Start the stuck-button watchdog right before the attempt that can
      // hit FedCM. renderButton()'s click can also go through FedCM on
      // current Chrome (not just prompt()), so this covers both paths.
      watchdog = setTimeout(() => {
        if (settled) return
        settled = true
        showLoginError(
          'Google Sign-In tidak merespons. Browser mungkin memblokir sign-in pihak ketiga (FedCM) untuk situs ini — coba izinkan lewat ikon kunci/info di address bar lalu ulangi, atau login dengan email & kata sandi.',
        )
        resetGoogleBtn(btn)
      }, 12000)

      // Render Google's own button off-screen and proxy a click into it,
      // rather than calling the One Tap `.prompt()` flow directly. `.prompt()`
      // depends on FedCM and fails silently/with a console-only error when a
      // browser has FedCM disabled or previously dismissed the prompt for this
      // site — leaving the user stuck with no visible feedback. The rendered
      // button uses Google's standard sign-in flow, which degrades far more
      // reliably across browsers, while still invoking the exact same
      // `callback` above (same ID-token/credential shape, no backend change).
      const realBtnContainer = document.getElementById('google-real-btn')
      if (realBtnContainer) {
        realBtnContainer.innerHTML = ''
        google.accounts.id.renderButton(realBtnContainer, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
        })
        const clickable = realBtnContainer.querySelector<HTMLElement>('div[role="button"]')
        if (clickable) {
          clickable.click()
        } else {
          // Google's markup hasn't hydrated the way we expect — fall back to
          // the prompt so the attempt still has a chance to succeed.
          google.accounts.id.prompt()
        }
      } else {
        google.accounts.id.prompt()
      }
    } catch (err) {
      settled = true
      clearTimeout(watchdog)
      console.error(err)
      showLoginError('Gagal memuat Google Sign-In. Pastikan koneksi internet aktif.')
      resetGoogleBtn(btn)
    }
  })
}

const googleBtnContent = `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Masuk dengan Google`

function resetGoogleBtn(btn: HTMLButtonElement) {
  btn.disabled = false
  btn.innerHTML = googleBtnContent
}

function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load GIS'))
    document.head.appendChild(script)
  })
}

function getGoogleClientId(): string {
  return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || ''
}
