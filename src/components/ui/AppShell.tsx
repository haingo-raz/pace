'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Home, Palette, Settings } from 'lucide-react'
import { copy } from '@/content/en'
import { BrandMark } from '@/components/BrandMark'
import { AssistantBubble } from '@/components/AssistantBubble'
import { Footer } from '@/components/Footer'

type NavItem = { href: string; label: string; Icon: typeof Home }

const NAV: NavItem[] = [
  { href: '/dashboard', label: copy.nav.home, Icon: Home },
  { href: '/stats', label: copy.nav.stats, Icon: BarChart2 },
  { href: '/coloring', label: copy.nav.coloring, Icon: Palette },
  { href: '/settings', label: copy.nav.settings, Icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/')

  return (
    <div className="flex min-h-screen w-full">
      <nav
        aria-label={copy.nav.label}
        className="hidden md:flex md:flex-col md:w-56 md:border-r md:border-[var(--border)] md:bg-[var(--surface)] md:px-4 md:py-6 md:gap-2"
      >
        <div className="mb-4 px-2">
          <BrandMark size="lg" />
        </div>
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={
                'flex items-center gap-3 rounded-md px-3 py-2 min-h-11 text-sm ' +
                (active
                  ? 'bg-[var(--raised)] text-[var(--text)] font-medium'
                  : 'text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]')
              }
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <main
        className="flex-1 w-full"
        style={{
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto w-full max-w-[72rem] px-4 py-6 md:py-10">
          {children}
        </div>
        <Footer />
      </main>

      <nav
        aria-label={copy.nav.label}
        className="fixed inset-x-0 bottom-0 z-40 flex md:hidden border-t border-[var(--border)] bg-[var(--surface)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={
                'flex-1 flex flex-col items-center justify-center gap-1 min-h-16 text-xs ' +
                (active
                  ? 'text-[var(--primary-strong)] font-medium'
                  : 'text-[var(--muted)]')
              }
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <AssistantBubble />
    </div>
  )
}
