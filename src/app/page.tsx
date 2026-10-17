import { copy } from '@/content/en'

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[72rem] flex-col justify-center px-4 py-10">
      <div className="max-w-2xl">
        <p
          className="text-sm uppercase tracking-widest text-[var(--muted)]"
          style={{ fontFamily: 'var(--font-jakarta)' }}
        >
          {copy.app.name}
        </p>
        <h1
          className="mt-3 font-semibold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            textWrap: 'balance',
            lineHeight: 1.15,
          }}
        >
          {copy.app.tagline}
        </h1>
        <p className="mt-6 text-base text-[var(--muted)]">
          {copy.landing.description}
        </p>
      </div>
    </main>
  )
}
