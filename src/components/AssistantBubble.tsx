'use client'

import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy } from '@/content/en'
import { useToast } from '@/components/ui/Toast'
import type { AssistantReply } from '@/types'

const STORAGE_KEY = 'pace.assistant.position'
const BUBBLE_SIZE = 56
const PANEL_WIDTH = 320
const PANEL_HEIGHT = 320
const EDGE_GAP = 12
const MAX_INPUT = 500
const HISTORY_LIMIT = 8

type Position = { x: number; y: number }

function clampToViewport(pos: Position): Position {
  if (typeof window === 'undefined') return pos
  const maxX = window.innerWidth - BUBBLE_SIZE - EDGE_GAP
  const maxY = window.innerHeight - BUBBLE_SIZE - EDGE_GAP
  return {
    x: Math.max(EDGE_GAP, Math.min(maxX, pos.x)),
    y: Math.max(EDGE_GAP, Math.min(maxY, pos.y)),
  }
}

function defaultPosition(): Position {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  return clampToViewport({
    x: window.innerWidth - BUBBLE_SIZE - EDGE_GAP,
    y: window.innerHeight - BUBBLE_SIZE - 96,
  })
}

function loadPosition(): Position {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Position
      if (
        typeof parsed?.x === 'number' &&
        typeof parsed?.y === 'number'
      ) {
        return clampToViewport(parsed)
      }
    }
  } catch {
    // ignore
  }
  return defaultPosition()
}

type Message =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; reply?: AssistantReply }

export function AssistantBubble() {
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()
  const panelId = useId()

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Message[]>([])

  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(loadPosition())
  }, [])

  useEffect(() => {
    if (!mounted) return
    const onResize = () => setPosition((p) => clampToViewport(p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mounted])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [messages.length, sending])

  const persist = useCallback((p: Position) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    } catch {
      // ignore
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (open) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        px: position.x,
        py: position.y,
      }
    },
    [open, position.x, position.y],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const start = dragStart.current
    if (!start) return
    const next = clampToViewport({
      x: start.px + (e.clientX - start.x),
      y: start.py + (e.clientY - start.y),
    })
    setPosition(next)
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = dragStart.current
      dragStart.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.hypot(dx, dy) < 4) {
        setOpen((v) => !v)
        return
      }
      persist(position)
    },
    [persist, position],
  )

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    const nextHistory = [...messages, { role: 'user' as const, text }]
    setMessages(nextHistory)
    setDraft('')
    setSending(true)
    const historyPayload = nextHistory
      .slice(-HISTORY_LIMIT - 1, -1)
      .map((m) => ({ role: m.role, text: m.text }))
    const res = await apiFetch<AssistantReply>('/api/assistant', {
      method: 'POST',
      body: JSON.stringify({ message: text, history: historyPayload }),
    })
    setSending(false)
    if (!res.ok) {
      const msg =
        res.error.code === 'RATE_LIMITED'
          ? copy.assistant.rateLimited
          : res.error.code === 'AI_UNAVAILABLE'
            ? copy.assistant.unavailable
            : copy.errors.generic
      setMessages((prev) => [...prev, { role: 'assistant', text: msg }])
      toast.error(msg)
      return
    }
    const data = res.data
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', text: data.text, reply: data },
    ])
    announce(data.text)
    if (data.kind === 'action_done') {
      if (pathname !== '/dashboard') {
        router.push('/dashboard')
      } else {
        router.refresh()
      }
      window.dispatchEvent(new CustomEvent('pace:tasks-changed'))
    }
  }

  if (!mounted) return null

  const panelX =
    position.x + PANEL_WIDTH > window.innerWidth - EDGE_GAP
      ? position.x + BUBBLE_SIZE - PANEL_WIDTH
      : position.x
  const openUpward = position.y + BUBBLE_SIZE + PANEL_HEIGHT + EDGE_GAP > window.innerHeight
  const panelY = openUpward
    ? position.y - PANEL_HEIGHT - EDGE_GAP
    : position.y + BUBBLE_SIZE + EDGE_GAP
  const safePanelX = Math.max(
    EDGE_GAP,
    Math.min(window.innerWidth - PANEL_WIDTH - EDGE_GAP, panelX),
  )
  const safePanelY = Math.max(
    EDGE_GAP,
    Math.min(window.innerHeight - PANEL_HEIGHT - EDGE_GAP, panelY),
  )

  return (
    <div
      ref={containerRef}
      className="fixed z-50"
      style={{ left: 0, top: 0, pointerEvents: 'none' }}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={open ? copy.assistant.bubbleClose : copy.assistant.bubbleOpen}
        aria-expanded={open}
        aria-controls={panelId}
        className="pointer-events-auto flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--primary-strong)] text-white shadow-lg hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-strong)]"
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          touchAction: 'none',
          cursor: 'grab',
        }}
      >
        {open ? (
          <X aria-hidden="true" className="h-6 w-6" />
        ) : (
          <MessageCircle aria-hidden="true" className="h-6 w-6" />
        )}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={copy.assistant.panelLabel}
          className="pointer-events-auto flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl"
          style={{
            position: 'absolute',
            left: safePanelX,
            top: safePanelY,
            width: PANEL_WIDTH,
            height: PANEL_HEIGHT,
          }}
        >
          <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--raised)] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <MessageCircle
                aria-hidden="true"
                className="h-4 w-4 text-[var(--primary-strong)]"
              />
              <h2
                className="truncate text-sm font-semibold text-[var(--text)]"
                style={{ fontFamily: 'var(--font-fraunces)' }}
              >
                {copy.assistant.heading}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={copy.assistant.bubbleClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollerRef}
            className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                {copy.assistant.intro}
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    'max-w-[85%] rounded-md px-3 py-2 text-sm ' +
                    (m.role === 'user'
                      ? 'self-end bg-[var(--primary-strong)] text-white'
                      : 'self-start bg-[var(--raised)] text-[var(--text)] border border-[var(--border)]')
                  }
                >
                  {m.text}
                </div>
              ))
            )}
            {sending ? (
              <div
                aria-label={copy.assistant.typing}
                className="self-start flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--raised)] px-3 py-2"
              >
                <span className="assistant-dot" aria-hidden="true" />
                <span
                  className="assistant-dot"
                  style={{ animationDelay: '160ms' }}
                  aria-hidden="true"
                />
                <span
                  className="assistant-dot"
                  style={{ animationDelay: '320ms' }}
                  aria-hidden="true"
                />
              </div>
            ) : null}
          </div>

          <form
            ref={formRef}
            onSubmit={onSubmit}
            className="flex items-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-2 py-2"
          >
            <label htmlFor={`${panelId}-input`} className="sr-only">
              {copy.assistant.inputLabel}
            </label>
            <textarea
              ref={inputRef}
              id={`${panelId}-input`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!sending && draft.trim()) {
                    formRef.current?.requestSubmit()
                  }
                }
              }}
              maxLength={MAX_INPUT}
              rows={1}
              placeholder={copy.assistant.inputPlaceholder}
              disabled={sending}
              className="flex-1 resize-none rounded-md border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-sm text-[var(--text)] max-h-24"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label={copy.assistant.send}
              aria-busy={sending || undefined}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-[var(--primary-strong)] text-white disabled:opacity-60"
            >
              <Send aria-hidden="true" className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
