type Props = { className?: string }

/**
 * Hand-drawn-looking four-point star.
 */
export function StarGlyph({ className }: Props) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3 Q 13.5 10.5, 21 12 Q 13.5 13.5, 12 21 Q 10.5 13.5, 3 12 Q 10.5 10.5, 12 3 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
