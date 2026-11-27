/**
 * The rule under the branch the page belongs to (config/navBearings.ts): the band's own active colour (index.css,
 * `--band-active`, the focus colour there, measured at 3:1 on the band in modePalettes.test.ts and
 * seaChartPalette.test.ts). The parent carries `relative`.
 */
export default function LitRule() {
  return (
    <span
      aria-hidden="true"
      data-lit-rule=""
      className="pointer-events-none absolute inset-x-0 -bottom-1.5 h-0.5 rounded-full"
      style={{ background: "var(--band-active, var(--color-amber-on-band))" }}
    />
  );
}
