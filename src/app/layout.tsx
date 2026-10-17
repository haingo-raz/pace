import type { Metadata } from 'next'
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { ToastProvider } from '@/components/ui/Toast'
import { copy } from '@/content/en'
import './globals.css'

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: copy.app.name,
  description: copy.app.tagline,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jakarta.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          id="announcer"
        />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
