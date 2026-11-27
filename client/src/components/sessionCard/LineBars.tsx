/**
 * SIX BARS READ FROM THE BOTTOM UP, one line lit in gold: a gate's line as a hexagram's line is read. The session
 * card (PullACard.tsx) and the daily card (pages/TodayCard.tsx) both draw it, so the two cards read alike.
 * `label` is what a screen reader hears, in the caller's words ("Line 3 of 6").
 */
export default function LineBars({ line, label, className = "h-14 w-12" }: { line: number; label: string; className?: string }) {
  return (
    <svg viewBox="0 0 28 34" className={`${className} shrink-0`} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <rect key={n} x={2} y={2 + (6 - n) * 5.4} width={24} height={3.2} rx={1.2} className={n === line ? "fill-notice" : "fill-muted-foreground/35"} />
      ))}
    </svg>
  );
}
