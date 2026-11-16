/**
 * A short last row, centred (design pass D-21): five cards in three columns used to leave a hole.
 * Every card spans two tracks of a doubled grid, and the first card of a short row starts one
 * track in. Used by the roots on /roles and the characters on /roles/select.
 */

/** Literal classes per breakpoint pair, so Tailwind sees every one. */
const STARTS = {
  // Two columns from `sm` (four tracks), three from `lg` (six tracks): the roots on /roles.
  "sm-lg": { lone2: "sm:col-start-2", two3: "lg:col-start-2", one3: "lg:col-start-3", reset3: "lg:col-start-auto" },
  // Two columns on a phone, three from `sm`: the characters on /roles/select.
  "base-sm": { lone2: "col-start-2", two3: "sm:col-start-2", one3: "sm:col-start-3", reset3: "sm:col-start-auto" },
} as const;

/** Where card `i` of `n` starts. */
export function centring(i: number, n: number, at: keyof typeof STARTS = "sm-lg"): string {
  const s = STARTS[at];
  const out: string[] = [];
  const lone = n % 2 === 1 && i === n - 1;
  if (lone) out.push(s.lone2);
  const left = n % 3;
  const first = left > 0 && i === n - left;
  if (first) out.push(left === 2 ? s.two3 : s.one3);
  else if (lone) out.push(s.reset3);
  return out.join(" ");
}
