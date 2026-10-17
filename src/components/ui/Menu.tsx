'use client'

import {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

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
  triggerClassName?: string
  triggerDisabled?: boolean
  children: ReactNode
}

export function Menu({
  items,
  label,
  triggerLabel,
  triggerClassName,
  triggerDisabled,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) {
      triggerRef.current?.focus()
    }
  }, [])

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

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={triggerLabel}
        disabled={triggerDisabled}
        onClick={() => {
          setActiveIndex(0)
          setOpen((v) => !v)
        }}
        className={triggerClassName}
      >
        {children}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-20 mt-1 min-w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--raised)] shadow-lg"
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
        </div>
      ) : null}
    </div>
  )
}
