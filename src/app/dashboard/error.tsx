'use client'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { copy } from '@/content/en'

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto w-full max-w-[72rem] px-4 py-10">
      <Card>
        <h1
          className="font-semibold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
          }}
        >
          {copy.tasks.loadFailed}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{copy.errors.generic}</p>
        <div className="mt-4">
          <Button onClick={() => reset()}>{copy.tasks.retry}</Button>
        </div>
      </Card>
    </main>
  )
}
