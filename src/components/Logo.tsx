/** The Tabula brand mark — same silhouette as public/favicon.svg, recolored
 * with the brand gradient so it can be reused inline (e.g. the toolbar
 * "Tabula" button) without pulling in the favicon's blur-heavy glow layers. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 46" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="tabula-logo-gradient" x1="0" y1="0" x2="48" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#7e14ff" />
          <stop offset="100%" stopColor="#47bfff" />
        </linearGradient>
      </defs>
      <path
        fill="url(#tabula-logo-gradient)"
        d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
      />
    </svg>
  );
}
