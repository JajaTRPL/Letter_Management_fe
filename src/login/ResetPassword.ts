import Toastify from 'toastify-js'

// Navigate back to the Login page. Loaded lazily so ResetPassword does not
// statically depend on Login (that page→page edge is part of the inherited
// import cycle, C1). Same runtime behavior — both call sites are async/event-driven.
const renderLogin = (): void => {
  void import('./Login').then((mod) => mod.renderLogin())
}

declare global {
  interface Window {
    tempEmail?: string;
  }
}

const startCountdown = (button: HTMLElement, seconds: number) => {
  let timeLeft = seconds
  const originalText = button.innerText
  const isButton = button instanceof HTMLButtonElement
  if (isButton) (button as HTMLButtonElement).disabled = true

  const timer = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timer)
      if (isButton) (button as HTMLButtonElement).disabled = false
      button.innerText = originalText
      return
    }
    button.innerText = `Tunggu ${timeLeft} detik`
    timeLeft--
  }, 1000)
}

export const renderForgotPassword = () => {
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
              <h2 class="text-3xl font-bold mb-2 tracking-tight">Lupa Kata Sandi?</h2>
              <p class="text-sm text-white/70">Masukkan email Anda untuk menerima kode verifikasi</p>
            </div>

            <form id="forgot-password-form" class="space-y-5">
              <div class="space-y-2">
                <label for="email" class="block text-sm font-medium text-white/80 ml-1">Email</label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-teal-300 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
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

              <div class="flex justify-end pt-1">
                <button type="button" id="back-to-login" class="text-xs font-medium text-teal-300 hover:text-teal-200 hover:drop-shadow-[0_0_8px_rgba(94,234,212,0.5)] transition-all focus:outline-none">Kembali ke Login</button>
              </div>

              <button 
                type="submit"
                id="generate-token-btn"
                disabled
                class="w-full flex justify-center py-3.5 px-4 rounded-xl text-base font-bold text-white transition-all transform active:scale-[0.97] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#008080] to-teal-500 hover:from-teal-400 hover:to-[#008080] shadow-[0_4px_15px_rgba(0,128,128,0.4)] hover:shadow-[0_8px_25px_rgba(0,128,128,0.6)] border border-white/20 mt-4"
              >
                Kirim Kode
              </button>
            </form>
          </div>
        </div>
        </div>
      </div>
    </div>
  `

  const fpEmailInput = document.getElementById('email') as HTMLInputElement
  const generateTokenBtn = document.getElementById('generate-token-btn') as HTMLButtonElement

  const updateGenerateBtn = () => {
    const filled = fpEmailInput.value.trim() !== ''
    generateTokenBtn.disabled = !filled
  }

  fpEmailInput.addEventListener('input', updateGenerateBtn)

  document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const submitBtn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement
    const email = (document.getElementById('email') as HTMLInputElement).value
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const contentType = response.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      }

      if (response.ok) {
        if (data.token_simulation) {
          Toastify({
            text: `Mode Simulasi: Token Anda adalah ${data.token_simulation}\n\nSalin token ini untuk verifikasi karena sistem sedang tidak mengirim email asli.`,
            duration: 8000, close: true, gravity: "top", position: "right",
            style: { background: "#3B82F6" } // Blue
          }).showToast()
        } else {
          Toastify({
            text: data.message || 'Token berhasil dikirim!',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#10B981" } // Green
          }).showToast()
        }
        window.tempEmail = email
        renderVerifyToken()
      } else {
        if (response.status === 429) {
          const seconds = data.seconds_left || 60
          startCountdown(submitBtn, seconds)
          Toastify({
            text: data.message || 'Harap tunggu sebentar sebelum mengirim ulang.',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#EAB308" } // Yellow
          }).showToast()
        } else if (response.status === 404) {
          Toastify({
            text: 'Endpoint API tidak ditemukan (404).',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#EF4444" }
          }).showToast()
        } else {
          Toastify({
            text: data.message || 'Email tidak ditemukan atau terjadi kesalahan.',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#EF4444" }
          }).showToast()
        }
      }
    } catch (error) {
      console.error('Error:', error)
      Toastify({
        text: 'Terjadi kesalahan pada server. Pastikan backend Laravel aktif.',
        duration: 3000, close: true, gravity: "top", position: "right",
        style: { background: "#EF4444" }
      }).showToast()
    }
  })

  document.getElementById('back-to-login')?.addEventListener('click', () => {
    renderLogin()
  })
}

export const renderVerifyToken = () => {
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
              <h2 class="text-3xl font-bold mb-2 tracking-tight">Verifikasi Kode</h2>
              <p class="text-sm text-white/70">Kami telah mengirimkan kode verifikasi ke email Anda</p>
            </div>

            <form id="verify-token-form" class="space-y-5">
              <div class="space-y-3">
                <label class="block text-sm font-medium text-white/80 text-center">Kode Verifikasi (6 Digit)</label>
                <div class="flex justify-center gap-3" id="otp-inputs">
                  <input type="text" maxlength="1" inputmode="numeric" class="otp-input w-12 h-14 text-center text-2xl font-bold bg-black/20 border border-white/10 rounded-xl focus:border-teal-400/50 focus:bg-black/30 focus:ring-4 focus:ring-teal-400/10 outline-none transition-all text-white placeholder-white/30 shadow-inner" required>
                  <input type="text" maxlength="1" inputmode="numeric" class="otp-input w-12 h-14 text-center text-2xl font-bold bg-black/20 border border-white/10 rounded-xl focus:border-teal-400/50 focus:bg-black/30 focus:ring-4 focus:ring-teal-400/10 outline-none transition-all text-white placeholder-white/30 shadow-inner" required>
                  <input type="text" maxlength="1" inputmode="numeric" class="otp-input w-12 h-14 text-center text-2xl font-bold bg-black/20 border border-white/10 rounded-xl focus:border-teal-400/50 focus:bg-black/30 focus:ring-4 focus:ring-teal-400/10 outline-none transition-all text-white placeholder-white/30 shadow-inner" required>
                  <input type="text" maxlength="1" inputmode="numeric" class="otp-input w-12 h-14 text-center text-2xl font-bold bg-black/20 border border-white/10 rounded-xl focus:border-teal-400/50 focus:bg-black/30 focus:ring-4 focus:ring-teal-400/10 outline-none transition-all text-white placeholder-white/30 shadow-inner" required>
                  <input type="text" maxlength="1" inputmode="numeric" class="otp-input w-12 h-14 text-center text-2xl font-bold bg-black/20 border border-white/10 rounded-xl focus:border-teal-400/50 focus:bg-black/30 focus:ring-4 focus:ring-teal-400/10 outline-none transition-all text-white placeholder-white/30 shadow-inner" required>
                  <input type="text" maxlength="1" inputmode="numeric" class="otp-input w-12 h-14 text-center text-2xl font-bold bg-black/20 border border-white/10 rounded-xl focus:border-teal-400/50 focus:bg-black/30 focus:ring-4 focus:ring-teal-400/10 outline-none transition-all text-white placeholder-white/30 shadow-inner" required>
                </div>
              </div>

              <div class="flex justify-end pt-2">
                <button type="button" id="back-to-forgot" class="text-xs font-medium text-teal-300 hover:text-teal-200 hover:drop-shadow-[0_0_8px_rgba(94,234,212,0.5)] transition-all focus:outline-none">Kirim ulang kode</button>
              </div>

              <button 
                type="submit" 
                class="w-full flex justify-center py-3.5 px-4 rounded-xl text-base font-bold text-white transition-all transform active:scale-[0.97] focus:outline-none bg-gradient-to-r from-[#008080] to-teal-500 hover:from-teal-400 hover:to-[#008080] shadow-[0_4px_15px_rgba(0,128,128,0.4)] hover:shadow-[0_8px_25px_rgba(0,128,128,0.6)] border border-white/20 mt-4"
              >
                Verifikasi
              </button>
            </form>
          </div>
        </div>
        </div>
      </div>
    </div>
  `

  // OTP Input Logic
  const otpInputs = document.querySelectorAll<HTMLInputElement>('.otp-input')
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value
      if (val && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus()
      }
    })

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpInputs[index - 1].focus()
      }
    })

    // On paste, spread the numbers
    input.addEventListener('paste', (e) => {
      e.preventDefault()
      const pasteData = e.clipboardData?.getData('text').slice(0, 6)
      if (pasteData) {
        pasteData.split('').forEach((char, i) => {
          if (otpInputs[i]) {
            otpInputs[i].value = char
          }
        })
        otpInputs[Math.min(pasteData.length, 5)].focus()
      }
    })
  })

  document.getElementById('verify-token-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const token = Array.from(otpInputs).map(i => i.value).join('')
    if (token.length < 6) {
      Toastify({
        text: 'Silakan masukkan 6 digit token dengan lengkap.',
        duration: 3000, close: true, gravity: "top", position: "right",
        style: { background: "#EAB308" }
      }).showToast()
      return
    }
    try {
      const response = await fetch('/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: window.tempEmail,
          token: token
        })
      })

      const contentType = response.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      }

      if (response.ok) {
        Toastify({
          text: data.message || 'Token berhasil diverifikasi!',
          duration: 3000, close: true, gravity: "top", position: "right",
          style: { background: "#10B981" }
        }).showToast()
        renderResetPassword()
      } else {
        if (response.status === 404) {
          Toastify({
            text: 'Endpoint API tidak ditemukan (404). Pastikan backend Laravel sudah jalan di port 8000.',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#EF4444" }
          }).showToast()
        } else {
          Toastify({
            text: data.message || 'Token salah atau sudah kadaluwarsa.',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#EF4444" }
          }).showToast()
        }
      }
    } catch (error) {
      console.error('Error:', error)
      Toastify({
        text: 'Terjadi kesalahan pada verifikasi token. Pastikan backend Laravel aktif.',
        duration: 3000, close: true, gravity: "top", position: "right",
        style: { background: "#EF4444" }
      }).showToast()
    }
  })

  document.getElementById('back-to-forgot')?.addEventListener('click', async (e) => {
    const resendBtn = e.target as HTMLButtonElement
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: window.tempEmail })
      })

      const contentType = response.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      }

      if (response.ok) {
        if (data.token_simulation) {
          Toastify({
            text: `Mode Simulasi: Token baru Anda adalah ${data.token_simulation}\n\nSalin token ini untuk verifikasi.`,
            duration: 8000, close: true, gravity: "top", position: "right",
            style: { background: "#3B82F6" }
          }).showToast()
        } else {
          Toastify({
            text: data.message || 'Token baru telah dikirim ke email Anda.',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#10B981" }
          }).showToast()
        }
        startCountdown(resendBtn, 60)
      } else {
        if (response.status === 429) {
          const seconds = data.seconds_left || 60
          startCountdown(resendBtn, seconds)
          Toastify({
            text: data.message || 'Harap tunggu sebentar sebelum mengirim ulang.',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#EAB308" }
          }).showToast()
        } else {
          Toastify({
            text: data.message || 'Terjadi kesalahan saat mengirim ulang token.',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#EF4444" }
          }).showToast()
        }
      }
    } catch (error) {
      console.error('Error:', error)
      Toastify({
        text: 'Terjadi kesalahan pada server.',
        duration: 3000, close: true, gravity: "top", position: "right",
        style: { background: "#EF4444" }
      }).showToast()
    }
  })
}

export const renderResetPassword = () => {
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
              <h2 class="text-3xl font-bold mb-2 tracking-tight">Atur Ulang Kata Sandi</h2>
              <p class="text-sm text-white/70">Kata sandi baru Anda harus aman.</p>
            </div>

            <form id="reset-password-form" class="space-y-5">
              <div class="space-y-2">
                <label for="new-password" class="block text-sm font-medium text-white/80 ml-1">Kata Sandi Baru</label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-teal-300 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <input 
                    type="password" 
                    id="new-password" 
                    placeholder="Masukkan kata sandi baru" 
                    required
                    class="block w-full pl-11 pr-12 py-3.5 bg-black/20 border border-white/10 rounded-xl outline-none transition-all text-white placeholder-white/30 shadow-inner focus:bg-black/30 focus:border-teal-400/50 focus:ring-4 focus:ring-teal-400/10"
                  >
                  <button type="button" id="toggle-new-password" class="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white/80 transition-colors focus:outline-none">
                    <svg id="eye-icon-new" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                <label for="confirm-password" class="block text-sm font-medium text-white/80 ml-1">Konfirmasi Kata Sandi</label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-teal-300 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  </div>
                  <input 
                    type="password" 
                    id="confirm-password" 
                    placeholder="Ulangi kata sandi baru" 
                    required
                    class="block w-full pl-11 pr-12 py-3.5 bg-black/20 border border-white/10 rounded-xl outline-none transition-all text-white placeholder-white/30 shadow-inner focus:bg-black/30 focus:border-teal-400/50 focus:ring-4 focus:ring-teal-400/10"
                  >
                  <button type="button" id="toggle-confirm-password" class="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white/80 transition-colors focus:outline-none">
                    <svg id="eye-icon-confirm" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                class="w-full flex justify-center py-3.5 px-4 rounded-xl text-base font-bold text-white transition-all transform active:scale-[0.97] focus:outline-none bg-gradient-to-r from-[#008080] to-teal-500 hover:from-teal-400 hover:to-[#008080] shadow-[0_4px_15px_rgba(0,128,128,0.4)] hover:shadow-[0_8px_25px_rgba(0,128,128,0.6)] border border-white/20 mt-4"
              >
                Simpan Kata Sandi
              </button>
            </form>
          </div>
        </div>
        </div>
      </div>
    </div>
  `

  const newPasswordInput = document.getElementById('new-password') as HTMLInputElement
  const confirmPasswordInput = document.getElementById('confirm-password') as HTMLInputElement
  const toggleNewBtn = document.getElementById('toggle-new-password') as HTMLButtonElement
  const toggleConfirmBtn = document.getElementById('toggle-confirm-password') as HTMLButtonElement

  const setupToggle = (input: HTMLInputElement, btn: HTMLButtonElement, iconId: string) => {
    btn?.addEventListener('click', () => {
      const isPassword = input.type === 'password'
      input.type = isPassword ? 'text' : 'password'
      const icon = document.getElementById(iconId)
      if (icon) {
        if (isPassword) {
          icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
        } else {
          icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`
        }
      }
    })
  }

  setupToggle(newPasswordInput, toggleNewBtn, 'eye-icon-new')
  setupToggle(confirmPasswordInput, toggleConfirmBtn, 'eye-icon-confirm')

  document.getElementById('reset-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const newPassword = newPasswordInput.value
    const confirmPassword = confirmPasswordInput.value

    if (newPassword !== confirmPassword) {
      Toastify({
        text: 'Kata sandi dan konfirmasi tidak cocok!',
        duration: 3000, close: true, gravity: "top", position: "right",
        style: { background: "#EAB308" }
      }).showToast()
      return
    }

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: window.tempEmail,
          password: newPassword,
          password_confirmation: confirmPassword
        })
      })

      const contentType = response.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      }

      if (response.ok) {
        Toastify({
          text: data.message || 'Kata sandi berhasil diatur ulang!',
          duration: 3000, close: true, gravity: "top", position: "right",
          style: { background: "#10B981" }
        }).showToast()
        renderLogin()
      } else {
        if (response.status === 404) {
          Toastify({
            text: 'Endpoint API tidak ditemukan (404). Pastikan backend Laravel sudah jalan di port 8000.',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#EF4444" }
          }).showToast()
        } else {
          Toastify({
            text: data.message || 'Gagal mereset password.',
            duration: 3000, close: true, gravity: "top", position: "right",
            style: { background: "#EF4444" }
          }).showToast()
        }
      }
    } catch (error) {
      console.error('Error:', error)
      Toastify({
        text: 'Terjadi kesalahan pada saat mereset kata sandi. Pastikan backend Laravel aktif.',
        duration: 3000, close: true, gravity: "top", position: "right",
        style: { background: "#EF4444" }
      }).showToast()
    }
  })
}
