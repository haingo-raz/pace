import { ANNOUNCER_DELAY_MS } from '@/config/constants'

/** Writes to the layout's #announcer live region. No-ops on the server. */
export function announce(message: string): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById('announcer')
  if (!el) return
  // Clear first so a repeat of the same string still fires a change event.
  el.textContent = ''
  // Short delay so assistive tech picks up the mutation.
  setTimeout(() => {
    el.textContent = message
  }, ANNOUNCER_DELAY_MS)
}
