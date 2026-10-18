'use client'

import {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'

export type MenuItem = {
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

type Props = {
  items: MenuItem[]
  label: string
  triggerLabel: string
  triggerTitle?: string
  triggerClassName?: string
  triggerDisabled?: boolean
  children: ReactNode
}

const MENU_WIDTH = 176
const MENU_GAP = 4

export function Menu({
  items,
  label,
  triggerLabel,
  triggerTitle,
  triggerClassName,
  triggerDisabled,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) {
      triggerRef.current?.focus()
    }
  }, [])

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCoords({
      top: r.bottom + MENU_GAP,
      left: Math.max(8, r.right - MENU_WIDTH),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onReflow = () => place()
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return
    itemRefs.current[activeIndex]?.focus()
  }, [open, activeIndex])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        close(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(true)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + items.length) % items.length)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(items.length - 1)
    }
  }

  function pick(item: MenuItem) {
    if (item.disabled) return
    close(true)
    item.onClick()
  }

  const dropdown =
    open && mounted
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: MENU_WIDTH,
              zIndex: 1000,
            }}
            className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--raised)] shadow-lg"
          >
            {items.map((item, i) => (
              <button
                key={item.label}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                tabIndex={i === activeIndex ? 0 : -1}
                onClick={() => pick(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={
                  'block w-full px-4 py-2 text-left text-sm min-h-11 ' +
                  (item.destructive
                    ? 'text-[var(--danger)] hover:bg-[var(--danger)]/10 '
                    : 'text-[var(--text)] hover:bg-[var(--surface)] ') +
                  'focus:outline-none focus:bg-[var(--surface)] disabled:opacity-60 disabled:cursor-not-allowed'
                }
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={triggerLabel}
        title={triggerTitle}
        disabled={triggerDisabled}
        onClick={() => {
          setActiveIndex(0)
          setOpen((v) => !v)
        }}
        className={triggerClassName}
      >
        {children}
      </button>
      {dropdown}
    </div>
  )
}
