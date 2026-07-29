// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  handleRedirection: vi.fn(),
  populateStudyProgramSelect: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('../../shared/api-client', () => ({
  apiFetch: mocks.apiFetch,
}))

vi.mock('../../shared/study-program-select', () => ({
  populateStudyProgramSelect: mocks.populateStudyProgramSelect,
}))

function populateVisiblePrograms(select: HTMLSelectElement): void {
    select.innerHTML = `
      <option value="">Pilih Program Studi...</option>
      <optgroup label="DTEDI - Departemen Teknik Elektro dan Informatika">
        <option value="1">TRPL - Teknologi Rekayasa Perangkat Lunak</option>
        <option value="2">TRIK - Teknologi Rekayasa Internet</option>
      </optgroup>
      <optgroup label="DTE - Departemen Teknik Elektro">
        <option value="3">TRE - Teknologi Rekayasa Elektro</option>
      </optgroup>
    `
}

vi.mock('../../shared/toast', () => ({
  showSuccess: mocks.showSuccess,
}))

vi.mock('../../login/Login', () => ({
  handleRedirection: mocks.handleRedirection,
}))

import {
  renderProfileCompletion,
  type ProfileCompletionStatus,
} from '../ProfileCompletion'

function completion(overrides: Partial<ProfileCompletionStatus> = {}): ProfileCompletionStatus {
  return {
    needs_completion: true,
    can_self_complete: true,
    role: 'mahasiswa',
    sub_role: null,
    tendik_role: null,
    fields: ['nim', 'study_program_id'],
    missing_fields: ['NIM', 'Program Studi'],
    message: 'Lengkapi NIM dan Program Studi sebelum mengakses sistem.',
    ...overrides,
  }
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>'
  localStorage.clear()
  mocks.apiFetch.mockReset()
  mocks.handleRedirection.mockReset()
  mocks.populateStudyProgramSelect.mockReset()
  mocks.populateStudyProgramSelect.mockImplementation(async (select: HTMLSelectElement) => {
    populateVisiblePrograms(select)
  })
  mocks.showSuccess.mockReset()
})

describe('role-aware profile completion', () => {
  it('renders NIM and Program Studi for Mahasiswa only', async () => {
    await renderProfileCompletion(completion())

    expect(document.querySelector('label[for="nim"]')?.textContent).toBe('NIM')
    expect(document.querySelector('label[for="study-program-trigger"]')?.textContent).toBe('Program Studi')
    expect(document.getElementById('nip')).toBeNull()
    expect(document.getElementById('department')).toBeNull()
  })

  it('uses the grouped custom selector instead of exposing a native browser dropdown', async () => {
    await renderProfileCompletion(completion())

    const nativeSelect = document.getElementById('study-program') as HTMLSelectElement
    const trigger = document.getElementById('study-program-trigger') as HTMLButtonElement
    const dropdown = document.getElementById('study-program-dropdown') as HTMLElement

    expect(nativeSelect.classList.contains('sr-only')).toBe(true)
    expect(trigger.getAttribute('role')).toBe('combobox')
    expect(trigger.disabled).toBe(false)
    expect(document.getElementById('study-program-search')).not.toBeNull()
    expect(document.querySelectorAll('[data-study-program-group]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-study-program-option]')).toHaveLength(3)
    expect(document.querySelector('[data-study-program-group]')?.textContent).toContain('DTEDI')
    expect(document.getElementById('study-program-selector')?.classList.contains('relative')).toBe(true)
    expect(dropdown.classList.contains('max-w-full')).toBe(true)

    trigger.click()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(dropdown.classList.contains('hidden')).toBe(false)

    ;(document.querySelector('[data-study-program-option][data-value="2"]') as HTMLElement).click()
    expect(nativeSelect.value).toBe('2')
    expect(document.getElementById('study-program-text')?.textContent).toContain('TRIK')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(dropdown.classList.contains('hidden')).toBe(true)

    trigger.click()
    document.getElementById('study-program-search')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(dropdown.classList.contains('hidden')).toBe(true)
  })

  it('filters the custom list by search and shows an empty result for proof markers', async () => {
    await renderProfileCompletion(completion())

    const trigger = document.getElementById('study-program-trigger') as HTMLButtonElement
    const search = document.getElementById('study-program-search') as HTMLInputElement
    const empty = document.getElementById('study-program-empty') as HTMLElement
    trigger.click()

    search.value = 'internet'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(document.querySelectorAll('[data-study-program-option]:not(.hidden)')).toHaveLength(1)
    expect(document.querySelector('[data-study-program-option]:not(.hidden)')?.textContent).toContain('TRIK')

    for (const marker of ['Proof', 'P2C', 'PDQJMSZS85']) {
      search.value = marker
      search.dispatchEvent(new Event('input', { bubbles: true }))
      expect(document.querySelectorAll('[data-study-program-option]:not(.hidden)')).toHaveLength(0)
      expect(empty.classList.contains('hidden')).toBe(false)
    }
  })

  it('renders selector loading, error, and empty states without enabling a native picker', async () => {
    let finishLoading: ((value?: void | PromiseLike<void>) => void) | undefined
    mocks.populateStudyProgramSelect.mockImplementationOnce((select: HTMLSelectElement) => (
      new Promise<void>((resolve) => {
        finishLoading = () => {
          select.innerHTML = '<option value="">Gagal memuat data</option>'
          resolve()
        }
      })
    ))

    const rendering = renderProfileCompletion(completion())
    await vi.waitFor(() => {
      expect(document.getElementById('study-program-text')?.textContent).toBe('Memuat program studi...')
    })
    expect((document.getElementById('study-program-trigger') as HTMLButtonElement).disabled).toBe(true)
    finishLoading?.()
    await rendering

    expect(document.getElementById('study-program-text')?.textContent).toBe('Gagal memuat data')
    expect((document.getElementById('study-program-trigger') as HTMLButtonElement).disabled).toBe(true)

    mocks.populateStudyProgramSelect.mockImplementationOnce(async (select: HTMLSelectElement) => {
      select.innerHTML = '<option value="">Program studi tidak tersedia.</option>'
    })
    await renderProfileCompletion(completion())
    expect(document.getElementById('study-program-text')?.textContent).toBe('Program studi tidak tersedia.')
    expect((document.getElementById('study-program-trigger') as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders only NIP for Tendik', async () => {
    await renderProfileCompletion(completion({
      role: 'tendik',
      tendik_role: 'persuratan',
      fields: ['nip'],
      missing_fields: ['NIP'],
      message: 'Lengkapi NIP sebelum mengakses sistem.',
    }))

    expect(document.querySelector('label[for="nip"]')?.textContent).toBe('NIP')
    expect(document.getElementById('nim')).toBeNull()
    expect(document.getElementById('study-program')).toBeNull()
    expect(document.getElementById('department')).toBeNull()
  })

  it('renders NIP only for Akademik with admin-managed scope', async () => {
    await renderProfileCompletion(completion({
      role: 'akademik',
      sub_role: 'kaprodi',
      fields: ['nip'],
      missing_fields: ['NIP'],
    }))
    expect(document.getElementById('nip')).not.toBeNull()
    expect(document.getElementById('study-program')).toBeNull()
    expect(document.getElementById('department')).toBeNull()
    expect(document.getElementById('completion-role-label')?.textContent).toBe('Ketua Program Studi (Kaprodi)')
  })

  it('blocks stale staff scope fields instead of rendering self-assignment selectors', async () => {
    await renderProfileCompletion(completion({
      role: 'akademik',
      sub_role: 'kadep',
      fields: ['nip', 'department_id'],
      missing_fields: ['NIP', 'Departemen'],
      message: 'Departemen harus ditetapkan oleh Super Admin.',
    }))

    expect(document.getElementById('profile-blocked')).not.toBeNull()
    expect(document.getElementById('nip')).toBeNull()
    expect(document.getElementById('department')).toBeNull()
    expect(document.getElementById('study-program')).toBeNull()
  })

  it('shows an admin-contact state when required scope is not self-completable', async () => {
    await renderProfileCompletion(completion({
      role: 'tendik',
      tendik_role: 'laboran',
      can_self_complete: false,
      fields: ['nip'],
      missing_fields: ['NIP', 'Laboratorium'],
      message: 'Laboratorium harus ditetapkan oleh Super Admin.',
    }))

    expect(document.getElementById('profile-blocked')).not.toBeNull()
    expect(document.getElementById('complete-profile-form')).toBeNull()
    expect(document.getElementById('completion-message')?.textContent).toContain('Super Admin')
  })

  it('renders backend validation errors without redirecting', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: { nip: ['NIP sudah terdaftar di sistem.'] } }),
    } as Response)

    await renderProfileCompletion(completion({
      role: 'tendik',
      fields: ['nip'],
      missing_fields: ['NIP'],
    }))

    ;(document.getElementById('nip') as HTMLInputElement).value = '199001012025011001'
    document.getElementById('complete-profile-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    await vi.waitFor(() => {
      expect(document.getElementById('profile-error')?.textContent).toContain('NIP sudah terdaftar')
    })
    expect(mocks.handleRedirection).not.toHaveBeenCalled()
  })

  it('continues to the correct dashboard after successful completion', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        completion: completion({ needs_completion: false, fields: [], missing_fields: [] }),
        user: { role: 'akademik', sub_role: 'kaprodi' },
      }),
    } as Response)

    await renderProfileCompletion(completion({
      role: 'akademik',
      sub_role: 'kaprodi',
      fields: ['nip'],
      missing_fields: ['NIP'],
    }))

    ;(document.getElementById('nip') as HTMLInputElement).value = '198001012006041001'
    document.getElementById('complete-profile-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    await vi.waitFor(() => {
      expect(mocks.handleRedirection).toHaveBeenCalledWith(
        'kaprodi',
        false,
        expect.objectContaining({ needs_completion: false }),
      )
    })
    expect(localStorage.getItem('auth_status')).toBe('Active')
    expect(mocks.showSuccess).toHaveBeenCalled()
  })

  it('submits Mahasiswa NIM and selected Program Studi only', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        completion: completion({ needs_completion: false, fields: [], missing_fields: [] }),
        user: { role: 'mahasiswa', sub_role: null },
      }),
    } as Response)

    await renderProfileCompletion(completion())
    ;(document.getElementById('nim') as HTMLInputElement).value = '24/535278/sv/12345'
    ;(document.querySelector('[data-study-program-option][data-value="1"]') as HTMLElement).click()
    document.getElementById('complete-profile-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    await vi.waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled())
    const [, request] = mocks.apiFetch.mock.calls[0]
    expect(JSON.parse(request.body)).toEqual({
      nim: '24/535278/SV/12345',
      study_program_id: 1,
    })
  })
})
