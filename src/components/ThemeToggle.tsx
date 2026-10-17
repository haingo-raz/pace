'use client'

import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { copy } from '@/content/en'

type Mode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'pace.theme'
const ORDER: Mode[] = ['system', 'light', 'dark']

function readStored(): Mode {
  if (typeof window === 'undefined') return 'system'
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // storage unavailable; fall through to system
  }
  return 'system'
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', onChange)
  window.addEventListener('pace:theme-change', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener('pace:theme-change', onChange)
  }
}

function apply(mode: Mode) {
  const html = document.documentElement
  if (mode === 'system') {
    html.removeAttribute('data-theme')
  } else {
    html.setAttribute('data-theme', mode)
  }
}

function persist(mode: Mode) {
  try {
    if (mode === 'system') {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, mode)
    }
  } catch {
    // storage unavailable; the in-session DOM state still applies
  }
  window.dispatchEvent(new Event('pace:theme-change'))
}

export function ThemeToggle() {
  const mode = useSyncExternalStore<Mode>(subscribe, readStored, () => 'system')

  function cycle() {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]
    apply(next)
    persist(next)
  }

  const nextMode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]
  const label = copy.theme.switchTo[nextMode]
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)]"
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
    </button>
  )
}
