import { Heart } from 'lucide-react'
import { copy } from '@/content/en'

export function Footer() {
  return (
    <footer
      className="mx-auto w-full max-w-[72rem] px-4 pb-6 pt-4 text-center text-xs text-[var(--muted)]"
      style={{
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      <p className="flex flex-wrap items-center justify-center gap-1">
        <span>{copy.footer.createdWith}</span>
        <Heart
          aria-label={copy.footer.heartAria}
          className="h-3.5 w-3.5 text-[var(--primary-strong)]"
          fill="currentColor"
        />
        <span>{copy.footer.byPrefix}</span>
        <a
          href="https://github.com/haingo-raz"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--text)] underline underline-offset-2 hover:text-[var(--primary-strong)]"
        >
          {copy.footer.handle}
        </a>
        <span>{copy.footer.year}</span>
      </p>
    </footer>
  )
}
