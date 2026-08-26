/** The Tabula brand mark — a table header row + column forming a "T",
 * with a highlighted cell for a bit of energy. Mirrors public/favicon.svg. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="tabula-logo-h" x1="5" y1="0" x2="43" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#7e14ff" />
          <stop offset="100%" stopColor="#47bfff" />
        </linearGradient>
        <linearGradient id="tabula-logo-v" x1="0" y1="20" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7e14ff" />
          <stop offset="100%" stopColor="#47bfff" />
        </linearGradient>
      </defs>
      <rect x="5" y="6" width="38" height="10" rx="5" fill="url(#tabula-logo-h)" />
      <rect x="19" y="20" width="10" height="20" rx="5" fill="url(#tabula-logo-v)" />
      <rect x="26.5" y="31.5" width="11" height="11" rx="3.5" fill="#47bfff" transform="rotate(12 32 37)" />
    </svg>
  );
}
