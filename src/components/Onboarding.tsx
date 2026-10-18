'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'

type TourKey =
  | 'points'
  | 'streak'
  | 'mood'
  | 'add-task'
  | 'task-row'
  | 'color-nav'

type Step = {
  key: TourKey
  label: string
  text: string
}

const STEPS: Step[] = [
  {
    key: 'points',
    label: copy.onboarding.stepLabelPoints,
    text: copy.onboarding.stepCopyPoints,
  },
  {
    key: 'streak',
    label: copy.onboarding.stepLabelStreak,
    text: copy.onboarding.stepCopyStreak,
  },
  {
    key: 'mood',
    label: copy.onboarding.stepLabelMood,
    text: copy.onboarding.stepCopyMood,
  },
  {
    key: 'add-task',
    label: copy.onboarding.stepLabelAddTask,
    text: copy.onboarding.stepCopyAddTask,
  },
  {
    key: 'task-row',
    label: copy.onboarding.stepLabelTaskRow,
    text: copy.onboarding.stepCopyTaskRow,
  },
  {
    key: 'color-nav',
    label: copy.onboarding.stepLabelColorNav,
    text: copy.onboarding.stepCopyColorNav,
  },
]

const REPLAY_EVENT = 'pace:onboarding-replay'
const PANEL_WIDTH = 300
const EDGE_GAP = 12
const HALO_PADDING = 8

type Rect = { top: number; left: number; width: number; height: number }

function findVisibleAnchor(key: TourKey): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)
  for (const el of Array.from(nodes)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Onboarding() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [visibleSteps, setVisibleSteps] = useState<Step[]>([])
  const [anchorRect, setAnchorRect] = useState<Rect | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const previouslyDescribedRef = useRef<{
    el: HTMLElement
    prev: string | null
  } | null>(null)
  const panelId = 'pace-onboarding-panel'

  const beginTour = useCallback(() => {
    const steps = STEPS.filter((s) => !!findVisibleAnchor(s.key))
    if (steps.length === 0) return
    setVisibleSteps(steps)
    setIndex(0)
    setOpen(true)
  }, [])

  // Auto-open when the user has not seen the tour.
  useEffect(() => {
    if (!mounted) return
    let cancelled = false
    void apiFetch<{ needsOnboarding: boolean }>('/api/me/onboarding').then(
      (res) => {
        if (cancelled || !res.ok) return
        if (res.data.needsOnboarding) {
          // Give the dashboard a moment to paint anchors.
          setTimeout(() => {
            if (!cancelled) beginTour()
          }, 300)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [mounted, beginTour])

  // Replay from Settings via a window event.
  useEffect(() => {
    if (!mounted) return
    const onReplay = () => beginTour()
    window.addEventListener(REPLAY_EVENT, onReplay)
    return () => window.removeEventListener(REPLAY_EVENT, onReplay)
  }, [mounted, beginTour])

  const close = useCallback(
    async (skipped: boolean) => {
      setOpen(false)
      await apiFetch('/api/me/onboarding', {
        method: 'POST',
        body: JSON.stringify({ skipped }),
      })
    },
    [],
  )

  const step = visibleSteps[index]
  const total = visibleSteps.length

  // Scroll anchor into view, measure its rect, and set aria-describedby.
  useLayoutEffect(() => {
    if (!open || !step) return
    const el = findVisibleAnchor(step.key)
    if (!el) {
      // Anchor vanished since the tour started; drop that step.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisibleSteps((prev) => prev.filter((s) => s.key !== step.key))
      setIndex((i) => Math.min(i, Math.max(0, visibleSteps.length - 2)))
      return
    }
    const prev = previouslyDescribedRef.current
    if (prev && prev.el !== el) {
      if (prev.prev === null) prev.el.removeAttribute('aria-describedby')
      else prev.el.setAttribute('aria-describedby', prev.prev)
    }
    const existing = el.getAttribute('aria-describedby')
    previouslyDescribedRef.current = { el, prev: existing }
    el.setAttribute('aria-describedby', panelId)

    el.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
    })

    const measure = () => setAnchorRect(rectOf(el))
    measure()
    const t = setTimeout(measure, prefersReducedMotion() ? 20 : 350)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    announce(
      fill(copy.onboarding.stepAria, {
        current: index + 1,
        total,
        label: step.label,
      }),
    )
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [open, step, index, total, visibleSteps.length])

  // Restore aria-describedby when the tour closes.
  useEffect(() => {
    if (open) return
    const prev = previouslyDescribedRef.current
    if (prev) {
      if (prev.prev === null) prev.el.removeAttribute('aria-describedby')
      else prev.el.setAttribute('aria-describedby', prev.prev)
      previouslyDescribedRef.current = null
    }
  }, [open])

  // Focus trap: save previous focus, move into the panel, restore on close.
  useEffect(() => {
    if (!open) return
    prevFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const focusFirst = () => {
      const first =
        panelRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
      first?.focus()
    }
    const t = setTimeout(focusFirst, 20)

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const container = panelRef.current
      if (!container) return
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      prevFocusRef.current?.focus?.()
    }
  }, [open])

  // Position the panel.
  const panelStyle = useMemo<React.CSSProperties>(() => {
    if (!anchorRect || typeof window === 'undefined') {
      return { visibility: 'hidden' }
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const spaceBelow = vh - (anchorRect.top + anchorRect.height)
    const spaceAbove = anchorRect.top
    const openBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove
    const estimatedHeight = 200
    const top = openBelow
      ? Math.min(vh - estimatedHeight - EDGE_GAP, anchorRect.top + anchorRect.height + 12)
      : Math.max(EDGE_GAP, anchorRect.top - estimatedHeight - 12)
    const centre = anchorRect.left + anchorRect.width / 2
    const left = Math.max(
      EDGE_GAP,
      Math.min(vw - PANEL_WIDTH - EDGE_GAP, centre - PANEL_WIDTH / 2),
    )
    return {
      position: 'fixed',
      top,
      left,
      width: PANEL_WIDTH,
      maxWidth: `calc(100vw - ${EDGE_GAP * 2}px)`,
      zIndex: 90,
    }
  }, [anchorRect])

  if (!mounted || !open || !step || !anchorRect) {
    return null
  }

  const haloStyle: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.top - HALO_PADDING,
    left: anchorRect.left - HALO_PADDING,
    width: anchorRect.width + HALO_PADDING * 2,
    height: anchorRect.height + HALO_PADDING * 2,
    border: '2px solid var(--primary-strong)',
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
    pointerEvents: 'none',
    zIndex: 80,
    transition: prefersReducedMotion() ? 'none' : 'top 180ms, left 180ms, width 180ms, height 180ms',
  }

  const atFirst = index === 0
  const atLast = index === total - 1

  return (
    <div aria-hidden={false}>
      <div style={haloStyle} aria-hidden="true" />
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${panelId}-counter`}
        aria-describedby={`${panelId}-text`}
        style={panelStyle}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl"
      >
        <p
          id={`${panelId}-counter`}
          className="text-xs font-medium text-[var(--muted)]"
          style={{ fontFamily: 'var(--font-jetbrains)' }}
        >
          {fill(copy.onboarding.stepCounter, {
            current: index + 1,
            total,
          })}
        </p>
        <p
          id={`${panelId}-text`}
          className="mt-2 text-sm text-[var(--text)]"
        >
          {step.text}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void close(true)}
            className="min-h-9 rounded-md px-3 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            {copy.onboarding.skip}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={atFirst}
              className="min-h-9 rounded-md border border-[var(--border)] px-3 text-sm text-[var(--text)] disabled:opacity-40"
            >
              {copy.onboarding.prev}
            </button>
            <button
              type="button"
              onClick={() => {
                if (atLast) {
                  void close(false)
                } else {
                  setIndex((i) => Math.min(total - 1, i + 1))
                }
              }}
              className="min-h-9 rounded-md bg-[var(--primary-strong)] px-3 text-sm font-medium text-white"
            >
              {atLast ? copy.onboarding.done : copy.onboarding.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ONBOARDING_REPLAY_EVENT = REPLAY_EVENT
