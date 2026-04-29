import { handleRedirection } from '../login/Login'
import { attachNimUppercaseHandler, normalizeNim } from '../shared/nim-utils'
import { populateStudyProgramSelect } from '../shared/study-program-select'
import { apiFetch } from '../shared/api-client'
import { showSuccess } from '../shared/toast'
import { UserStatus } from '../shared/user-status'

/**
 * Profile completion page for Pending_Profile users (Google SSO).
 * Requires NIM and Study Program selection before accessing the system.
 */
export const renderProfileCompletion = () => {
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
              <h2 class="text-3xl font-bold mb-2 tracking-tight">Lengkapi Profil</h2>
              <p class="text-sm text-white/70">Sebelum mengakses sistem, lengkapi data berikut</p>
            </div>

            <div class="bg-amber-500/20 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3 mb-6 backdrop-blur-md shadow-inner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-400 shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <div>
                <p class="text-sm font-semibold text-amber-300">Data Wajib Diisi</p>
                <p class="text-xs text-amber-200/80 mt-0.5">NIM dan Program Studi diperlukan untuk mengakses fitur sistem.</p>
              </div>
            </div>

            <form id="complete-profile-form" class="space-y-5">
              <div class="space-y-2">
                <label for="nim" class="block text-sm font-medium text-white/80 ml-1">NIM</label>
                <input 
                  type="text" 
                  id="nim" 
                  placeholder="Contoh: 24/535278/SV/12345" 
                  required
                  class="block w-full px-4 py-3.5 bg-black/20 border border-white/10 rounded-xl focus:ring-4 focus:ring-teal-400/10 focus:border-teal-400/50 outline-none transition-all text-white placeholder-white/30 shadow-inner uppercase"
                >
                <p id="nim-hint" class="text-[10px] text-white/40 hidden ml-1"></p>
              </div>

              <div class="space-y-2">
                <label for="study-program" class="block text-sm font-medium text-white/80 ml-1">Program Studi</label>
                <div class="relative" id="custom-select-container">
                  <select id="study-program" class="hidden">
                    <option value="">Memuat program studi...</option>
                  </select>
                  
                  <!-- Custom Select Trigger (Closed State Glassmorphism) -->
                  <button type="button" id="custom-select-trigger" class="flex items-center justify-between w-full px-4 py-3.5 bg-black/20 border border-white/10 rounded-xl focus:ring-4 focus:ring-teal-400/10 focus:border-teal-400/50 outline-none transition-all text-white shadow-inner cursor-pointer text-left backdrop-blur-md">
                    <span id="custom-select-text" class="truncate text-white/70">Memuat program studi...</span>
                    <svg class="w-4 h-4 text-white/40 pointer-events-none transition-transform duration-200" id="custom-select-arrow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                  </button>

                  <!-- Custom Select Dropdown (Open State Solid Contrast) -->
                  <div id="custom-select-dropdown" class="absolute left-0 right-0 bottom-full mb-2 z-50 origin-bottom scale-95 opacity-0 invisible transition-all duration-200 ease-out bg-[#F8FAFC] rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.4)] border border-gray-200 overflow-hidden flex flex-col" style="backdrop-filter: none;">
                    <div class="p-2 border-b border-gray-200/60 bg-[#F8FAFC]">
                      <div class="relative">
                        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <input type="text" id="custom-select-search" class="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-shadow" placeholder="Cari program studi..." autocomplete="off">
                      </div>
                    </div>
                    <ul id="custom-select-list" class="max-h-72 overflow-y-auto py-2">
                    </ul>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                id="submit-profile-btn"
                class="w-full flex justify-center py-3.5 px-4 mt-2 rounded-xl text-base font-bold text-white transition-all transform active:scale-[0.97] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#008080] to-teal-500 hover:from-teal-400 hover:to-[#008080] shadow-[0_4px_15px_rgba(0,128,128,0.4)] hover:shadow-[0_8px_25px_rgba(0,128,128,0.6)] border border-white/20"
              >
                Simpan & Lanjutkan
              </button>

              <div id="profile-error" class="hidden w-full rounded-xl px-4 py-3 text-center text-sm font-medium bg-red-500/20 text-red-200 border border-red-500/30 backdrop-blur-md shadow-inner"></div>
            </form>
          </div>
        </div>
        </div>
      </div>
    </div>
  `

  // NIM auto-uppercase (uses shared handler)
  const nimInput = document.getElementById('nim') as HTMLInputElement
  if (nimInput) {
    attachNimUppercaseHandler(nimInput)
  }

  // Load study programs (uses shared component — single source)
  const select = document.getElementById('study-program') as HTMLSelectElement
  if (select) {
    populateStudyProgramSelect(select).then(() => {
      const container = document.getElementById('custom-select-container')
      const trigger = document.getElementById('custom-select-trigger')
      const textSpan = document.getElementById('custom-select-text')
      const arrow = document.getElementById('custom-select-arrow')
      const dropdown = document.getElementById('custom-select-dropdown')
      const list = document.getElementById('custom-select-list')
      
      if (!trigger || !dropdown || !list || !textSpan || !arrow) return

      let isOpen = false

      const toggleDropdown = () => {
        isOpen = !isOpen
        const searchInput = document.getElementById('custom-select-search') as HTMLInputElement | null
        
        if (isOpen) {
          dropdown.classList.remove('scale-95', 'opacity-0', 'invisible')
          dropdown.classList.add('scale-100', 'opacity-100', 'visible')
          arrow.classList.add('rotate-180')
          trigger.classList.add('border-teal-400/50', 'ring-4', 'ring-teal-400/10')
          
          if (searchInput) {
            setTimeout(() => searchInput.focus(), 100)
          }
        } else {
          dropdown.classList.add('scale-95', 'opacity-0', 'invisible')
          dropdown.classList.remove('scale-100', 'opacity-100', 'visible')
          arrow.classList.remove('rotate-180')
          trigger.classList.remove('border-teal-400/50', 'ring-4', 'ring-teal-400/10')
          
          if (searchInput && searchInput.value) {
            searchInput.value = ''
            searchInput.dispatchEvent(new Event('input'))
          }
        }
      }

      trigger.addEventListener('click', toggleDropdown)

      document.addEventListener('click', (e) => {
        if (isOpen && container && !container.contains(e.target as Node)) {
          toggleDropdown()
        }
      })

      textSpan.textContent = 'Pilih Program Studi...'
      list.innerHTML = ''

      Array.from(select.children).forEach((child, groupIdx) => {
        if (child.tagName === 'OPTGROUP') {
          const optgroup = child as HTMLOptGroupElement
          const groupHeader = document.createElement('li')
          groupHeader.className = 'sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-teal-700 uppercase tracking-wider bg-teal-50/95 backdrop-blur-md border-b border-teal-100/50 flex items-center transition-all duration-200'
          groupHeader.innerHTML = `<svg class="w-3.5 h-3.5 mr-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>` + optgroup.label
          groupHeader.dataset.groupId = groupIdx.toString()
          list.appendChild(groupHeader)

          Array.from(optgroup.children).forEach(optionChild => {
            const option = optionChild as HTMLOptionElement
            if (option.value) {
              const liOpt = document.createElement('li')
              liOpt.className = 'px-4 py-2.5 text-sm font-medium text-gray-700 cursor-pointer hover:bg-teal-50 hover:text-teal-900 transition-all duration-200 pl-6 border-b border-gray-50 last:border-b-0'
              liOpt.textContent = option.textContent
              liOpt.dataset.value = option.value
              liOpt.dataset.groupId = groupIdx.toString()
              list.appendChild(liOpt)
            }
          })
        }
      })

      // Event Delegation for selection
      list.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        const liOpt = target.closest('li[data-value]') as HTMLLIElement | null
        if (!liOpt) return

        select.value = liOpt.dataset.value!
        textSpan.textContent = liOpt.textContent
        textSpan.classList.remove('text-white/70')
        textSpan.classList.add('text-white')
        
        // Update selected styling
        Array.from(list.querySelectorAll('li[data-value]')).forEach(c => {
          c.classList.remove('bg-teal-100', 'text-teal-900')
          c.classList.add('text-gray-700')
        })
        liOpt.classList.remove('text-gray-700')
        liOpt.classList.add('bg-teal-100', 'text-teal-900')
        
        toggleDropdown()
      })

      // Search Filtering Logic
      const searchInput = document.getElementById('custom-select-search') as HTMLInputElement | null
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const term = (e.target as HTMLInputElement).value.toLowerCase()
          const allOptions = Array.from(list.querySelectorAll('li[data-value]')) as HTMLLIElement[]
          const activeGroups = new Set<string>()

          allOptions.forEach(opt => {
            const text = opt.textContent?.toLowerCase() || ''
            if (text.includes(term)) {
              opt.classList.remove('hidden')
              activeGroups.add(opt.dataset.groupId!)
            } else {
              opt.classList.add('hidden')
            }
          })

          const allHeaders = Array.from(list.querySelectorAll('li:not([data-value])')) as HTMLLIElement[]
          allHeaders.forEach(header => {
            if (activeGroups.has(header.dataset.groupId!)) {
              header.classList.remove('hidden')
            } else {
              header.classList.add('hidden')
            }
          })
        })
      }
    })
  }

  // Form submit
  document.getElementById('complete-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const nim = normalizeNim((document.getElementById('nim') as HTMLInputElement).value)
    const studyProgramId = (document.getElementById('study-program') as HTMLSelectElement).value
    const btn = document.getElementById('submit-profile-btn') as HTMLButtonElement
    const errorEl = document.getElementById('profile-error') as HTMLElement

    if (!nim || !studyProgramId) {
      errorEl.textContent = 'Semua field wajib diisi.'
      errorEl.classList.remove('hidden')
      return
    }

    btn.disabled = true
    btn.textContent = 'Menyimpan...'
    errorEl.classList.add('hidden')

    try {
      const response = await apiFetch('/api/auth/complete-profile', {
        method: 'POST',
        body: JSON.stringify({ nim, study_program_id: parseInt(studyProgramId) }),
      })

      const result = await response.json()

      if (response.ok) {
        localStorage.setItem('auth_status', UserStatus.ACTIVE)
        showSuccess('Profil berhasil dilengkapi!')
        handleRedirection(localStorage.getItem('auth_role') || 'mahasiswa')
      } else {
        const msg = result.errors
          ? Object.values(result.errors).flat().join(', ')
          : result.message || 'Gagal menyimpan profil'
        errorEl.textContent = msg
        errorEl.classList.remove('hidden')
        btn.disabled = false
        btn.textContent = 'Simpan & Lanjutkan'
      }
    } catch (err) {
      console.error(err)
      errorEl.textContent = 'Gagal menghubungi server.'
      errorEl.classList.remove('hidden')
      btn.disabled = false
      btn.textContent = 'Simpan & Lanjutkan'
    }
  })
}
