/**
 * HIRING THE FOUNDING TEAM FIRST (Rye, 14 Nov 2026): on the form for a role that
 * opens after the founding team, said before a word is written, that the reply
 * waits until the founding team is in place (shared/foundingTeam.ts).
 */
import { useLingui } from "@lingui/react/macro";
import { TILE } from "@/components/journey/look";

export function OpensLaterNote({ show }: { show: boolean | undefined }) {
  const { t } = useLingui();
  if (!show) return null;
  return (
    <p className={`mt-4 ${TILE} text-sm text-foreground`} data-opens-later="">
      {t({ message: "This role opens after the founding team. You are welcome to apply now. We are filling the founding team first, so it may be a while before we reply.", context: "founding application, later role note" })}
    </p>
  );
}
