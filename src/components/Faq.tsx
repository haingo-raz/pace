'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'

type Item = { q: string; a: string }

type Props = {
  items: ReadonlyArray<Item>
}

export function Faq({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  return (
    <Card className="!p-0 overflow-hidden">
      <ul className="divide-y divide-[var(--border)]">
        {items.map((item, i) => {
          const isOpen = openIndex === i
          const panelId = `faq-panel-${i}`
          const headerId = `faq-header-${i}`
          return (
            <li key={item.q}>
              <h3>
                <button
                  type="button"
                  id={headerId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-[var(--text)] hover:bg-[var(--raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-strong)]"
                  style={{ minHeight: 48 }}
                >
                  <span className="flex-1">{item.q}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={
                      'h-4 w-4 flex-shrink-0 transition-transform ' +
                      (isOpen ? 'rotate-180' : '')
                    }
                  />
                </button>
              </h3>
              {isOpen ? (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  className="px-4 pb-4 pt-1 text-sm text-[var(--muted)]"
                >
                  {item.a}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
