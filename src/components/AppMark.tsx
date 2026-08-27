/**
 * The generic app mark: a minimalist poker chip. Used wherever there is no
 * brand-specific logo (the default felt emblem, the header/lobby fallback, the
 * favicon). It is NOT any tenant's logo - a brand's own mark comes from its
 * brands.logo_url. Colour comes from `currentColor` so it can be recoloured
 * (gold in the header, engraved into the felt).
 */
export default function AppMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <circle cx="32" cy="32" r="25" strokeWidth="4" />
      <circle cx="32" cy="32" r="15" strokeWidth="3.5" />
      <g strokeWidth="5">
        <line x1="32" y1="7" x2="32" y2="14" />
        <line x1="32" y1="7" x2="32" y2="14" transform="rotate(60 32 32)" />
        <line x1="32" y1="7" x2="32" y2="14" transform="rotate(120 32 32)" />
        <line x1="32" y1="7" x2="32" y2="14" transform="rotate(180 32 32)" />
        <line x1="32" y1="7" x2="32" y2="14" transform="rotate(240 32 32)" />
        <line x1="32" y1="7" x2="32" y2="14" transform="rotate(300 32 32)" />
      </g>
    </svg>
  );
}
