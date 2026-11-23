/**
 * COMING SOON AND FUTURE VENTURES (Rye and the Operations Steward, 16 Nov 2026).
 *
 * A coming-soon role is shown under the steward who leads its circle and is
 * applied for early, through the same one-role flow. A future venture is shown
 * in its own section, with no lead, and is applied for with a pitch. The server
 * sends `comingSoon: true` or `futureVenture: true` only on such a role
 * (shared/roleListing.ts). This file draws the badge, and the note that rides
 * beside Apply on the role's card, on the application form and on the
 * confirmation. It also draws the line for a role only an agent holds.
 */
import { Trans, useLingui } from "@lingui/react/macro";
import { ventureOpenNow } from "@shared/roleListing";

type Flagged = { comingSoon?: boolean | null; futureVenture?: boolean | null; heldByAgent?: boolean | null } | null | undefined;

export function ComingSoonChip({ role, className = "" }: { role: Flagged; className?: string }) {
  if (!role || (role.comingSoon !== true && role.futureVenture !== true)) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-secondary text-secondary-foreground border border-border ${className}`} data-testid="coming-soon-chip">
      {role.futureVenture === true ? (
        <Trans context="badge on a role offered as a venture to build and run, applied for with a pitch">Open venture</Trans>
      ) : (
        <Trans context="badge on a role whose interviews start after the lead hires">Coming soon</Trans>
      )}
    </span>
  );
}

/**
 * A VENTURE'S BADGE ON THE ROLES PAGE (the lead, 23 Nov 2026): an outlined gold "Open now" pill, with its dot, for a
 * venture whose door is open (`ventureOpenNow`, shared/roleListing.ts), and a quiet outlined "Accepting proposals" for
 * every other one. Outlined so neither reads as a button, and in the village's true gold (the dash gold), never the
 * `notice` accent a village may tint the colour of its buttons. No priority words: nothing urgent is put in front of
 * a visitor. Under the Open ventures heading it stands in for "Open venture", which that heading already says.
 */
export function VentureChip({ role, className = "" }: { role: { futureVenture?: boolean | null; recruiting?: boolean | null } | null | undefined; className?: string }) {
  if (role?.futureVenture !== true) return null;
  const now = ventureOpenNow(role);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${now ? "border-dash-gold text-dash-gold-lit" : "border-border text-muted-foreground"} ${className}`}
      data-testid="venture-chip"
      data-open-now={now ? "" : undefined}
    >
      {now && <span className="size-1.5 rounded-full bg-dash-gold-lit" aria-hidden="true" />}
      {now ? (
        <Trans context="badge on a venture open now for pitches, an outlined pill">Open now</Trans>
      ) : (
        <Trans context="badge on a venture taking proposals, not marked open now">Accepting proposals</Trans>
      )}
    </span>
  );
}

/** The roles lane's approved words (19 Nov 2026), said wherever a coming-soon role is shown: it leads to the waitlist. */
export function useComingSoonNote(): string {
  const { t } = useLingui();
  return t({
    message: "This role is not open yet, and the card may change before it opens. Leave your details and we will write to you when it does.",
    context: "note on a coming-soon role: the card, the application form and its confirmation",
  });
}

export function ComingSoonNote({ show = true, className = "" }: { show?: boolean; className?: string }) {
  const note = useComingSoonNote();
  if (!show) return null;
  return (
    <p className={`text-sm leading-relaxed text-foreground ${className}`} data-coming-soon-note="">
      {note}
    </p>
  );
}

/** The five things a venture's pitch covers, in order. */
export function usePitchPrompts(): string[] {
  const { t } = useLingui();
  return [
    t({ message: "Your concept and offering", context: "future venture pitch, part 1" }),
    t({ message: "How it serves the village, the land and the wider community", context: "future venture pitch, part 2" }),
    t({ message: "Your experience building and running something like it", context: "future venture pitch, part 3" }),
    t({ message: "How it would operate, and what you bring: skills, team, capital", context: "future venture pitch, part 4" }),
    t({ message: "A first financial picture", context: "future venture pitch, part 5" }),
  ];
}

/** On a future venture: what holding one means, and what the pitch covers. */
export function VentureNote({ show = true, className = "" }: { show?: boolean; className?: string }) {
  const { t } = useLingui();
  const prompts = usePitchPrompts();
  if (!show) return null;
  return (
    <div className={`text-sm leading-relaxed text-foreground ${className}`} data-venture-note="">
      <p>
        {t({
          message:
            "Apply to hold this venture: to build it and run it, in partnership with the village. Tell us your vision as a pitch. Terms such as space, partnership and revenue share are shaped together and are subject to legal review.",
          context: "note on a future venture: the card, the application form and its confirmation",
        })}
      </p>
      <p className="mt-2 font-semibold">{t({ message: "Your pitch covers:", context: "future venture pitch, the list's lead-in" })}</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5">
        {prompts.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
    </div>
  );
}

/** The note for whichever early state a role is in, or nothing. */
export function StateNote({ role, className = "" }: { role: Flagged; className?: string }) {
  if (role?.futureVenture === true) return <VentureNote className={className} />;
  if (role?.comingSoon === true) return <ComingSoonNote className={className} />;
  return null;
}

/** A role only an agent holds (Rye, 16 Nov 2026). Never the agent's name, which stays off public surfaces. */
export function HeldByAgentLine({ role, className = "" }: { role: Flagged; className?: string }) {
  if (role?.heldByAgent !== true) return null;
  return (
    <span className={`block text-sm text-muted-foreground ${className}`} data-held-by-agent="">
      <Trans context="a role held for now by the village's digital assistant, never a person">Held for now by our digital assistant.</Trans>
    </span>
  );
}
