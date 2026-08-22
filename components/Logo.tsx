/**
 * The brand mark (DESIGN.md §3): four tally strokes with a fifth diagonal
 * crossing stroke, a literal pun on the product name. Drawn on a single
 * 24-unit viewBox so the 2px stroke weight scales proportionally at any
 * badge size, from favicon to marketing scale.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const radius = Math.round(size * 0.2857);
  const iconSize = Math.round(size * 0.643);

  return (
    <div
      style={{ width: size, height: size, borderRadius: radius }}
      className="bg-brand flex items-center justify-center flex-none"
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="7" y1="6" x2="7" y2="18" stroke="var(--on-brand)" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="6" x2="10" y2="18" stroke="var(--on-brand)" strokeWidth="2" strokeLinecap="round" />
        <line x1="13" y1="6" x2="13" y2="18" stroke="var(--on-brand)" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="6" x2="16" y2="18" stroke="var(--on-brand)" strokeWidth="2" strokeLinecap="round" />
        <line x1="5" y1="17.5" x2="18.5" y2="5.5" stroke="var(--on-brand)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
