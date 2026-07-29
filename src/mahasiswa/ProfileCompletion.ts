import { attachNimUppercaseHandler, normalizeNim } from '../shared/nim-utils'
import { populateStudyProgramSelect } from '../shared/study-program-select'
import { apiFetch } from '../shared/api-client'
import { showSuccess } from '../shared/toast'
import { UserStatus } from '../shared/user-status'

export interface ProfileCompletionStatus {
  needs_completion: boolean
  can_self_complete: boolean
  role: string
  sub_role?: string | null
  tendik_role?: string | null
  fields: string[]
  missing_fields: string[]
  message: string
}

const fieldInputClass =
  'block w-full px-4 py-3.5 bg-black/20 border border-white/10 rounded-xl focus:ring-4 focus:ring-teal-400/10 focus:border-teal-400/50 outline-none transition-all text-white placeholder-white/30 shadow-inner'

let activeStudyProgramSelectorCleanup: (() => void) | null = null

function roleLabel(completion: ProfileCompletionStatus): string {
  if (completion.role === 'mahasiswa') return 'Mahasiswa'
  if (completion.role === 'tendik') return 'Tenaga Kependidikan'

  const labels: Record<string, string> = {
    kaprodi: 'Ketua Program Studi (Kaprodi)',
    sekprodi: 'Sekretaris Program Studi (Sekprodi)',
    kadep: 'Ketua Departemen (Kadep)',
    sekdep: 'Sekretaris Departemen (Sekdep)',
  }

  return labels[completion.sub_role || ''] || 'Pejabat Akademik'
}

function fieldMarkup(field: string): string {
  if (field === 'nim') {
    return `
      <div class="space-y-2">
        <label for="nim" class="block text-sm font-medium text-white/80 ml-1">NIM</label>
        <input type="text" id="nim" required placeholder="Contoh: 24/535278/SV/12345"
          class="${fieldInputClass} uppercase">
      </div>
    `
  }

  if (field === 'nip') {
    return `
      <div class="space-y-2">
        <label for="nip" class="block text-sm font-medium text-white/80 ml-1">NIP</label>
        <input type="text" id="nip" required placeholder="Masukkan NIP"
          class="${fieldInputClass}">
      </div>
    `
  }

  if (field === 'study_program_id') {
    return `
      <div class="space-y-2">
        <label id="study-program-label" for="study-program-trigger" class="block text-sm font-medium text-white/80 ml-1">Program Studi</label>
        <div id="study-program-selector" class="relative">
          <select id="study-program" class="sr-only" tabindex="-1" aria-hidden="true">
            <option value="">Memuat program studi...</option>
          </select>
          <button
            id="study-program-trigger"
            type="button"
            role="combobox"
            aria-labelledby="study-program-label study-program-text"
            aria-controls="study-program-list"
            aria-haspopup="listbox"
            aria-expanded="false"
            disabled
            class="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-left text-white shadow-inner outline-none transition-all hover:bg-black/30 focus:border-teal-400/50 focus:ring-4 focus:ring-teal-400/10 disabled:cursor-wait disabled:opacity-70"
          >
            <span id="study-program-text" class="truncate text-white/70">Memuat program studi...</span>
            <svg id="study-program-arrow" class="h-4 w-4 shrink-0 text-white/40 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <div
            id="study-program-dropdown"
            class="absolute left-0 right-0 z-50 hidden max-w-full overflow-hidden rounded-xl border border-gray-200 bg-[#F8FAFC] shadow-[0_15px_40px_rgba(0,0,0,0.4)]"
          >
            <div class="border-b border-gray-200/70 bg-[#F8FAFC] p-2">
              <div class="relative">
                <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <input
                  id="study-program-search"
                  type="search"
                  autocomplete="off"
                  aria-label="Cari program studi"
                  class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition-shadow placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                  placeholder="Cari program studi..."
                >
              </div>
            </div>
            <ul id="study-program-list" role="listbox" aria-labelledby="study-program-label" class="max-h-64 overflow-y-auto overscroll-contain py-2"></ul>
            <p id="study-program-empty" class="hidden px-4 py-5 text-center text-sm text-gray-500">Program studi tidak ditemukan.</p>
          </div>
        </div>
      </div>
    `
  }

  return ''
}

function selfCompletableFields(completion: ProfileCompletionStatus): string[] {
  const allowed = completion.role === 'mahasiswa'
    ? new Set(['nim', 'study_program_id'])
    : new Set(['nip'])

  return completion.fields.filter(field => allowed.has(field))
}

function hasUnsupportedSelfCompletionField(completion: ProfileCompletionStatus): boolean {
  return selfCompletableFields(completion).length !== completion.fields.length
}

function attachStudyProgramSelector(select: HTMLSelectElement): () => void {
  const container = document.getElementById('study-program-selector')
  const trigger = document.getElementById('study-program-trigger') as HTMLButtonElement | null
  const text = document.getElementById('study-program-text')
  const arrow = document.getElementById('study-program-arrow')
  const dropdown = document.getElementById('study-program-dropdown')
  const search = document.getElementById('study-program-search') as HTMLInputElement | null
  const list = document.getElementById('study-program-list')
  const empty = document.getElementById('study-program-empty')

  if (!container || !trigger || !text || !arrow || !dropdown || !search || !list || !empty) {
    return () => undefined
  }

  const controller = new AbortController()
  const { signal } = controller
  let isOpen = false
  let activeIndex = -1
  const optionElements: HTMLElement[] = []
  const groupElements: HTMLElement[] = []

  const appendOption = (option: HTMLOptionElement, groupId: string): void => {
    if (!option.value) return

    const item = document.createElement('li')
    item.id = `study-program-option-${optionElements.length}`
    item.dataset.value = option.value
    item.dataset.groupId = groupId
    item.dataset.studyProgramOption = 'true'
    item.setAttribute('role', 'option')
    item.setAttribute('aria-selected', 'false')
    item.tabIndex = -1
    item.className = 'cursor-pointer border-b border-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 outline-none transition-colors last:border-b-0 hover:bg-teal-50 hover:text-teal-900 focus:bg-teal-50 focus:text-teal-900'
    item.textContent = option.textContent?.trim() || option.value
    list.appendChild(item)
    optionElements.push(item)
  }

  Array.from(select.children).forEach((child, groupIndex) => {
    const groupId = String(groupIndex)

    if (child instanceof HTMLOptGroupElement) {
      const heading = document.createElement('li')
      heading.dataset.studyProgramGroup = 'true'
      heading.dataset.groupId = groupId
      heading.setAttribute('role', 'presentation')
      heading.className = 'sticky top-0 z-10 border-y border-teal-100/70 bg-teal-50/95 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-teal-700 first:border-t-0'
      heading.textContent = child.label
      list.appendChild(heading)
      groupElements.push(heading)
      Array.from(child.children).forEach(option => appendOption(option as HTMLOptionElement, groupId))
      return
    }

    if (child instanceof HTMLOptionElement) {
      appendOption(child, groupId)
    }
  })

  if (optionElements.length === 0) {
    const status = select.options[0]?.textContent?.trim()
    text.textContent = status || 'Program studi tidak tersedia.'
    trigger.disabled = true
    return () => controller.abort()
  }

  trigger.disabled = false
  text.textContent = 'Pilih Program Studi...'

  const visibleOptions = (): HTMLElement[] => optionElements.filter(option => !option.classList.contains('hidden'))

  const updateSelectedState = (): void => {
    optionElements.forEach(option => {
      const selected = option.dataset.value === select.value
      option.setAttribute('aria-selected', String(selected))
      option.classList.toggle('bg-teal-100', selected)
      option.classList.toggle('text-teal-900', selected)
      option.classList.toggle('font-bold', selected)
    })
  }

  const closeDropdown = (restoreFocus = false): void => {
    if (!isOpen) return
    isOpen = false
    dropdown.classList.add('hidden')
    dropdown.classList.remove('top-full', 'mt-2', 'bottom-full', 'mb-2')
    arrow.classList.remove('rotate-180')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.removeAttribute('aria-activedescendant')
    search.value = ''
    search.dispatchEvent(new Event('input'))
    activeIndex = -1
    if (restoreFocus) trigger.focus()
  }

  const openDropdown = (): void => {
    if (isOpen || trigger.disabled) return
    isOpen = true
    const bounds = container.getBoundingClientRect()
    const spaceBelow = window.innerHeight - bounds.bottom
    const openAbove = spaceBelow < 320 && bounds.top > spaceBelow
    dropdown.classList.toggle('bottom-full', openAbove)
    dropdown.classList.toggle('mb-2', openAbove)
    dropdown.classList.toggle('top-full', !openAbove)
    dropdown.classList.toggle('mt-2', !openAbove)
    dropdown.classList.remove('hidden')
    arrow.classList.add('rotate-180')
    trigger.setAttribute('aria-expanded', 'true')
    search.focus()
  }

  const selectOption = (option: HTMLElement): void => {
    select.value = option.dataset.value || ''
    text.textContent = option.textContent?.trim() || 'Pilih Program Studi...'
    text.classList.remove('text-white/70')
    text.classList.add('text-white')
    select.dispatchEvent(new Event('change', { bubbles: true }))
    updateSelectedState()
    closeDropdown(true)
  }

  const focusOption = (index: number): void => {
    const visible = visibleOptions()
    if (visible.length === 0) return
    activeIndex = (index + visible.length) % visible.length
    const option = visible[activeIndex]
    trigger.setAttribute('aria-activedescendant', option.id)
    option.focus()
  }

  trigger.addEventListener('click', () => {
    if (isOpen) closeDropdown()
    else openDropdown()
  }, { signal })

  trigger.addEventListener('keydown', event => {
    if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
      event.preventDefault()
      openDropdown()
    }
  }, { signal })

  search.addEventListener('input', () => {
    const term = search.value.trim().toLocaleLowerCase('id-ID')
    const activeGroups = new Set<string>()

    optionElements.forEach(option => {
      const matches = (option.textContent || '').toLocaleLowerCase('id-ID').includes(term)
      option.classList.toggle('hidden', !matches)
      if (matches && option.dataset.groupId) activeGroups.add(option.dataset.groupId)
    })
    groupElements.forEach(group => {
      group.classList.toggle('hidden', !activeGroups.has(group.dataset.groupId || ''))
    })
    empty.classList.toggle('hidden', visibleOptions().length !== 0)
    activeIndex = -1
  }, { signal })

  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown(true)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOption(0)
    }
  }, { signal })

  optionElements.forEach(option => {
    option.addEventListener('click', () => selectOption(option), { signal })
    option.addEventListener('keydown', event => {
      const visible = visibleOptions()
      const currentIndex = visible.indexOf(option)

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusOption(currentIndex + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusOption(currentIndex - 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        focusOption(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        focusOption(visible.length - 1)
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        selectOption(option)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        closeDropdown(true)
      }
    }, { signal })
  })

  document.addEventListener('click', event => {
    if (isOpen && !container.contains(event.target as Node)) closeDropdown()
  }, { signal })

  updateSelectedState()
  return () => controller.abort()
}

function renderLoading(): void {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <div class="min-h-screen w-full flex items-center justify-center bg-emerald-950 text-white">
      <p class="text-sm text-white/70">Memeriksa kelengkapan profil...</p>
    </div>
  `
}

function renderLoadError(): void {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <div class="min-h-screen w-full flex items-center justify-center bg-emerald-950 text-white px-6">
      <div class="max-w-md text-center space-y-4">
        <h2 class="text-2xl font-bold">Status profil tidak dapat dimuat</h2>
        <p class="text-sm text-white/70">Coba lagi. Akses sistem tetap dibatasi oleh server sampai profil lengkap.</p>
        <button id="retry-profile-status" class="px-5 py-3 rounded-xl bg-teal-600 font-semibold hover:bg-teal-500">
          Coba Lagi
        </button>
      </div>
    </div>
  `
  document.getElementById('retry-profile-status')?.addEventListener('click', () => {
    void renderProfileCompletion()
  })
}

async function loadCompletionStatus(): Promise<ProfileCompletionStatus | null> {
  try {
    const response = await apiFetch('/api/auth/profile-completion')
    if (!response.ok) return null
    const payload = await response.json()
    return payload.completion as ProfileCompletionStatus
  } catch {
    return null
  }
}

export const renderProfileCompletion = async (
  initialCompletion?: ProfileCompletionStatus,
): Promise<void> => {
  activeStudyProgramSelectorCleanup?.()
  activeStudyProgramSelectorCleanup = null

  let completion = initialCompletion

  if (!completion) {
    renderLoading()
    completion = await loadCompletionStatus() || undefined
  }

  if (!completion) {
    renderLoadError()
    return
  }

  if (!completion.needs_completion) {
    localStorage.removeItem('auth_requires_completion')
    localStorage.removeItem('auth_completion')
    const { handleRedirection } = await import('../login/Login')
    await handleRedirection(localStorage.getItem('auth_role') || completion.role, false, completion)
    return
  }

  localStorage.setItem('auth_requires_completion', 'true')
  localStorage.setItem('auth_completion', JSON.stringify(completion))

  const app = document.querySelector<HTMLDivElement>('#app')!
  const completionFields = selfCompletableFields(completion)
  const canSubmit =
    completion.can_self_complete
    && completionFields.length > 0
    && !hasUnsupportedSelfCompletionField(completion)
  const fields = completionFields.map(fieldMarkup).join('')

  app.innerHTML = `
    <div class="min-h-screen w-full flex items-center justify-center relative overflow-x-hidden overflow-y-auto font-['Inter'] bg-cover bg-center bg-no-repeat" style="background-image: url('/bc-login.png');">
      <div class="absolute inset-0" style="background: linear-gradient(135deg, rgba(2,44,34,0.9), rgba(6,78,59,0.85)); pointer-events: none;"></div>

      <div class="container mx-auto px-6 py-8 relative z-10 flex justify-center">
        <div class="flex flex-col lg:flex-row items-center justify-around gap-12 w-full max-w-6xl rounded-[2.5rem] p-10 lg:p-14 relative"
          style="background: rgba(255,255,255,0.04); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 20px 60px rgba(0,0,0,0.4);">

          <div class="flex flex-col items-center text-center max-w-xl text-white">
            <img src="/ugm-logo.png" alt="University Logo" class="w-32 h-32 object-contain mb-6">
            <h1 class="text-3xl md:text-5xl font-bold leading-tight">
              Sistem Persuratan<br>
              <span class="text-teal-300">Departemen Teknik Elektro dan Informatika</span>
            </h1>
          </div>

          <div class="relative z-20 flex w-full max-w-md flex-col items-center">
            <div class="relative w-full p-8 md:p-10 rounded-[2rem] shadow-2xl text-white"
              style="background: rgba(255,255,255,0.06); backdrop-filter: blur(40px); border: 1px solid rgba(255,255,255,0.15);">
              <div class="text-center mb-7">
                <h2 class="text-3xl font-bold mb-2">Lengkapi Profil</h2>
                <p id="completion-role-label" class="text-sm text-teal-200">${roleLabel(completion)}</p>
              </div>

              <div class="bg-amber-500/20 border border-amber-500/40 rounded-xl p-4 mb-6">
                <p class="text-sm font-semibold text-amber-300">Data Wajib Diisi</p>
                <p id="completion-message" class="text-xs text-amber-100/80 mt-1"></p>
              </div>

              ${canSubmit ? `
                <form id="complete-profile-form" class="space-y-5">
                  ${fields}
                  <button type="submit" id="submit-profile-btn"
                    class="w-full flex justify-center py-3.5 px-4 rounded-xl text-base font-bold bg-gradient-to-r from-[#008080] to-teal-500 hover:from-teal-400 hover:to-[#008080] disabled:opacity-50 disabled:cursor-not-allowed">
                    Simpan & Lanjutkan
                  </button>
                  <div id="profile-error" class="hidden rounded-xl px-4 py-3 text-center text-sm bg-red-500/20 text-red-200 border border-red-500/30"></div>
                </form>
              ` : `
                <div id="profile-blocked" class="rounded-xl px-4 py-4 text-center text-sm bg-red-500/20 text-red-100 border border-red-500/30">
                  Hubungi Super Admin untuk melengkapi penetapan akun ini.
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  const message = document.getElementById('completion-message')
  if (message) message.textContent = completion.message

  if (!canSubmit) return

  const nimInput = document.getElementById('nim') as HTMLInputElement | null
  if (nimInput) attachNimUppercaseHandler(nimInput)

  const studyProgramSelect = document.getElementById('study-program') as HTMLSelectElement | null
  if (studyProgramSelect) {
    await populateStudyProgramSelect(studyProgramSelect)
    activeStudyProgramSelectorCleanup = attachStudyProgramSelector(studyProgramSelect)
  }

  document.getElementById('complete-profile-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()

    const payload: Record<string, string | number> = {}
    if (completionFields.includes('nim')) {
      payload.nim = normalizeNim((document.getElementById('nim') as HTMLInputElement).value)
    }
    if (completionFields.includes('nip')) {
      payload.nip = (document.getElementById('nip') as HTMLInputElement).value.trim()
    }
    if (completionFields.includes('study_program_id')) {
      payload.study_program_id = Number((document.getElementById('study-program') as HTMLSelectElement).value)
    }

    const hasEmptyValue = Object.values(payload).some(value => value === '' || value === 0)
    const button = document.getElementById('submit-profile-btn') as HTMLButtonElement
    const error = document.getElementById('profile-error') as HTMLElement

    if (hasEmptyValue) {
      error.textContent = 'Semua field wajib diisi.'
      error.classList.remove('hidden')
      return
    }

    button.disabled = true
    button.textContent = 'Menyimpan...'
    error.classList.add('hidden')

    try {
      const response = await apiFetch('/api/auth/complete-profile', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const result = await response.json()

      if (!response.ok) {
        const message = result.errors
          ? Object.values(result.errors).flat().join(', ')
          : result.message || 'Gagal menyimpan profil'
        error.textContent = String(message)
        error.classList.remove('hidden')
        button.disabled = false
        button.textContent = 'Simpan & Lanjutkan'
        return
      }

      localStorage.setItem('auth_status', UserStatus.ACTIVE)
      localStorage.removeItem('auth_requires_completion')
      localStorage.removeItem('auth_completion')
      showSuccess('Profil berhasil dilengkapi!')

      const dashboardRole =
        result.user?.sub_role && ['kaprodi', 'kadep', 'sekdep', 'sekprodi'].includes(result.user.sub_role)
          ? result.user.sub_role
          : result.user?.role || completion!.role
      const { handleRedirection } = await import('../login/Login')
      await handleRedirection(dashboardRole, false, result.completion)
    } catch (requestError) {
      console.error(requestError)
      error.textContent = 'Gagal menghubungi server.'
      error.classList.remove('hidden')
      button.disabled = false
      button.textContent = 'Simpan & Lanjutkan'
    }
  })
}
