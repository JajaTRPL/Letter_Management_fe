import { renderForgotPassword } from './ResetPassword'
import Toastify from 'toastify-js'
import { renderAdminDashboard } from '../dashboard/AdminDashboard'
import { renderMahasiswaDashboard } from '../dashboard/MahasiswaDashboard'
import { renderTendikDashboard } from '../dashboard/TendikDashboard'
import { renderAkademikDashboard } from '../dashboard/AkademikDashboard'

export const handleRedirection = (role: string) => {
  localStorage.setItem('auth_role', role)
  if (role === 'super_admin') {
    renderAdminDashboard()
  } else if (role === 'mahasiswa') {
    renderMahasiswaDashboard()
  } else if (role === 'tendik') {
    renderTendikDashboard(role)
  } else if (['akademik', 'kaprodi', 'kadep', 'sekdep', 'sekprodi'].includes(role)) {
    renderAkademikDashboard(role)
  } else {
    Toastify({
      text: 'Role tidak dikenali, menghubungi admin.',
      duration: 3000,
      close: true,
      gravity: "top",
      position: "right",
      style: { background: "#EF4444" } // Red
    }).showToast()
  }
}

export const renderLogin = () => {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <div class="min-h-screen w-full flex items-center justify-center bg-cover bg-center bg-no-repeat relative overflow-hidden font-['Inter']" style="background-image: url('/bc-login.png');">
      <div class="absolute inset-0 bg-[#002d2d]/40 pointer-events-none"></div>

      <div class="container mx-auto px-6 py-8 relative z-10">
        <div class="flex flex-col lg:flex-row items-center justify-around gap-12 w-full rounded-3xl p-10 lg:p-14" style="background: rgba(255,255,255,0.08); border: 1.5px solid #BFBFBF; backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);">
        <div class="flex flex-col items-center text-center lg:items-center lg:text-center max-w-xl text-white">
          <div class="mb-6 animate-fade-in ">
            <img src="/ugm-logo.png" alt="University Logo" class="w-32 h-32 object-contain drop-shadow-2xl">
          </div>
          <h1 class="text-3xl md:text-5xl font-bold leading-tight drop-shadow-lg text-center">
            Sistem Persuratan<br>
            <span class="text-secondary-teal">Departemen Teknik Elektro dan Informatika</span>
          </h1>
        </div>

        <div class="flex flex-col items-center w-full max-w-md">
          <div class="text-center mb-8 text-white">
            <h2 class="text-3xl font-semibold mb-2">Selamat Datang</h2>
            <p class="text-sm opacity-90 px-4 text-center">Selamat datang kembali! Tolong isi email dan kata sandi.</p>
          </div>

          <div class="bg-white w-full p-8 md:p-10 rounded-2xl shadow-2xl backdrop-blur-sm bg-white/95 animate-slide-up">
            <form id="login-form" class="space-y-6">
              <div class="space-y-2">
                <label for="email" class="block text-sm font-semibold text-gray-700">Email</label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-secondary-teal transition-colors">
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
                    class="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary-teal/20 focus:border-secondary-teal outline-none transition-all placeholder-gray-400 text-gray-700"
                  >
                </div>
              </div>

              <div class="space-y-2">
                <label for="password" class="block text-sm font-semibold text-gray-700">Kata Sandi</label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-secondary-teal transition-colors">
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
                    class="block w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary-teal/20 focus:border-secondary-teal outline-none transition-all placeholder-gray-400 text-gray-700"
                    style="-webkit-appearance: none; appearance: none;"
                  >
                  <button type="button" id="toggle-password" class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none">
                    <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="flex justify-end">
                <button type="button" id="trigger-forgot-password" class="text-xs font-medium text-gray-400 hover:text-secondary-teal transition-colors focus:outline-none">Lupa Kata Sandi?</button>
              </div>

              <div class="flex items-center">
                <input 
                  id="remember" 
                  name="remember" 
                  type="checkbox" 
                  class="h-4 w-4 text-secondary-teal focus:ring-secondary-teal border-gray-300 rounded cursor-pointer"
                >
                <label for="remember" class="ml-2 block text-sm text-gray-600 cursor-pointer">
                  Ingat saya
                </label>
              </div>

              <button 
                type="submit"
                id="submit-btn"
                class="w-full flex justify-center py-3.5 px-4 border-0 rounded-xl shadow-sm text-base font-bold text-white transition-all transform active:scale-[0.98] focus:outline-none"
                style="background-color: #8E8E93; cursor: not-allowed;"
              >
                Masuk
              </button>

              <div id="login-error" class="hidden w-full rounded-xl px-4 py-3 text-center text-sm font-medium" style="background-color: #FEE2E2; color: #FF383C; border: none;"></div>
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
    submitBtn.style.backgroundColor = filled ? '' : '#8E8E93'
    submitBtn.style.cursor = filled ? 'pointer' : 'not-allowed'
    if (filled) {
      submitBtn.classList.add('bg-secondary-teal', 'hover:bg-secondary-teal/90')
      submitBtn.classList.remove('bg-[#8E8E93]')
    } else {
      submitBtn.classList.remove('bg-secondary-teal', 'hover:bg-secondary-teal/90')
    }
  }

  emailInput.addEventListener('input', updateSubmitBtn)
  passwordInput.addEventListener('input', updateSubmitBtn)

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
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('auth_name', data.user.name)
        if (data.user.sub_role) {
            localStorage.setItem('auth_sub_role', data.user.sub_role)
        } else {
            localStorage.removeItem('auth_sub_role')
        }
        handleRedirection(data.user.sub_role && ['kaprodi', 'kadep', 'sekdep', 'sekprodi'].includes(data.user.sub_role) ? data.user.sub_role : data.user.role)
      } else {
        if (response.status === 404) {
          showLoginError('Endpoint API tidak ditemukan (404). Pastikan backend Laravel sudah jalan di port 8000.')
        } else {
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
}
