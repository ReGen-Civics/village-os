import { gameFetch, QuestClaim } from "@/lib/gameApi";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Send} from "lucide-react";
import { SeedGlint } from "@/components/sacred/living";
import Celebration from "@/components/natural/Celebration";
import { useCountUp, useMomentWindow } from "@/components/natural/moments";
import { claimMoment } from "@/lib/celebrated";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { playMoment } from "@/lib/sound";
import { linesWords, type WorkPay } from "@/lib/workPay";
import { useLingui, Trans } from "@lingui/react/macro";

// questIdFromTitle is gone (S10): quest ids are REAL server references now.
// Deriving ids from titles meant a rename silently orphaned every claim.

/**
 * THE REWARD MOMENT: a quest consented, which is the emotional peak of the
 * whole game and shipped as a static green span.
 *
 * It is `moment` intensity, the rationed one. A member consents a handful of
 * quests a season and every one of them is a piece of real work somebody else
 * agreed was worth releasing value for, so this is exactly the event the
 * budget was reserved for. Seeds on the wind: the work leaves and lands
 * somewhere.
 *
 * ONCE, EVER. `claimMoment` is checked before anything plays, keyed on the
 * claim id, so the celebration belongs to the consent and not to the mount.
 * Coming back to the quest page next week shows the settled line.
 *
 * WHAT THE NUMBER IS. `credited` is what the ledger moved; `amount` is what
 * the witness granted. They differ only when a standing badge multiplied the
 * grant, and when they do, both are named. The old line printed `amount`
 * alone, which under-reported every badge holder's payout.
 *
 * IT NEVER BLOCKS. The drawing is `pointer-events: none` and absolutely
 * positioned, so the row below stays clickable while it plays and the layout
 * does not move underneath a thumb.
 */
/*
 * SINCE 2026-10-21 A CONSENT GRANTS NO GRATITUDE, so `amount` is null on every new
 * consent and the line names what the quest pays instead (0265). An older
 * consent still shows the recognition its witness granted, badge bonus and all.
 */
function ConsentedReward({ claim, decimals, pay }: { claim: QuestClaim; decimals: number; pay?: WorkPay | null }) {
  const granted = claim.amount ?? 0;
  const credited = claim.credited ?? granted;
  const bonus = credited - granted;
  /*
   * WHAT SCALE THESE NUMBERS ARE IN. A quest pays the recognition token, and
   * both `amount` and `credited` are ledger figures, so they are MINOR units
   * like every other row. GameDashboard divides that same token's balance
   * through this same formatter and ProfileJourney divides its ledger lines,
   * so the biggest green number in the game was the one contradicting them.
   *
   * `seed` stays the raw INT deliberately: it picks which drawing plays and is
   * never read as a quantity.
   */
  const show = (n: number) => formatTokenAmount(n, decimals);
  // Read once on mount: claiming the moment IS the check, so a re-render can
  // never re-open it, and two mounted copies cannot both play it. A consent
  // whose pay the reward moment names is celebrated there instead, once and on
  // every device (`announcedByRewardMoment`), so this one stays quiet and
  // leaves its own once unspent.
  const [fresh] = useState(() => !claim.announcedByRewardMoment && claimMoment(`quest:${claim.id}`));
  const showing = useMomentWindow(fresh);
  const shown = useCountUp(credited, fresh);

  useEffect(() => {
    if (fresh) playMoment("quest_complete", "confirm");
  }, [fresh]);

  return (
    /* The right gutter is CONSTANT, not conditional. The seeds are drawn over
       it, and padding that appeared with them would reflow the sentence
       underneath twice: once when the moment opens and again when it closes.
       A few empty pixels beside a status line cost nothing; text jumping
       under someone's eyes costs the sentence. */
    <div className="relative pr-24">
      {/* pointer-events-none on the WRAPPER. The kit sets it on
          `.nat-celebrate` itself, which is one element further in: a
          positioned wrapper without it is still hit-testable, and a hit test
          proved it was swallowing clicks on the row underneath. */}
      {showing && (
        <span className="absolute right-0 -top-3 z-10 pointer-events-none">
          <Celebration
            kind="seeds"
            intensity="moment"
            size={88}
            seed={granted}
            message={credited ? `Quest complete! +${show(credited)}` : "Quest complete!"}
          />
        </span>
      )}
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <Trans context="QuestActions, span"><CheckCircle2 className="w-4 h-4" /> Complete{credited ? ` · +${show(shown)}` : ""}</Trans>
      </span>
      {/* The bonus is information, so it stays after the drawing has gone. A
          badge holder was previously told the pre-multiplier grant and never
          saw the rest of what landed. */}
      {!credited && pay && pay.lines.length > 0 && (
        <p className="text-xs text-emerald-800 mt-1"><Trans context="QuestActions, p">This quest rewards you with {linesWords(pay.lines)}.</Trans></p>
      )}
      {bonus > 0 && (
        <p className="text-xs text-emerald-800 mt-1">
          <Trans context="QuestActions, p">{show(granted)} granted, and {show(bonus)} more for a standing badge you hold.
        </Trans></p>
      )}
    </div>
  );
}

export default function QuestActions({
  questId,
  signedIn,
  claim,
  decimals = 0,
  pay,
  isExample = false,
  onChanged,
}: {
  questId: string;
  signedIn: boolean;
  /**
   * An example of the work to come (the lead, 24 Nov 2026). It cannot be
   * taken, so the act is a disabled "Example quest" for everybody, signed in
   * or not, and the stamp on the poster says why. The claim route refuses an
   * example whatever this says.
   */
  isExample?: boolean;
  claim: QuestClaim | undefined;
  /**
   * The recognition token's scale, from `/api/game/me`'s `gratitude.decimals`.
   * Defaults to 0, which is what every token in the registry carried before
   * Voice and what an unanswered payload honestly means.
   */
  decimals?: number;
  /** What the quest pays (0265), named on the consented line. */
  pay?: WorkPay | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [artifactUrl, setArtifactUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const { t } = useLingui();

  if (isExample && (!claim || claim.status === "declined")) {
    return (
      <div className="px-6 py-3 border-t border-border">
        <button
          type="button"
          disabled
          className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
          data-example-take
        >
          {t({ message: "Example quest", context: "quest page: the take button on an example, disabled" })}
        </button>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t({ message: "This shows the kind of quest to come. It cannot be taken.", context: "quest page: under the disabled take button on an example" })}
        </p>
      </div>
    );
  }

  // This is the conversion CTA for every signed-out visitor on the quests
  // board — it was a 17px tap target, under WCAG 2.5.8's 24px floor and well
  // under a comfortable thumb. Now a full-width 44px row.
  if (!signedIn) {
    return (
      <div className="px-6 py-1 border-t border-border">
        <Link
          href="/register"
          className="flex items-center min-h-[44px] text-sm font-semibold text-teal-deep hover:text-teal transition-colors"
        >
          <Trans context="QuestActions, Link">Sign in to take this Quest
        </Trans></Link>
      </div>
    );
  }

  const doClaim = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await gameFetch(`/api/game/quests/${questId}/claim`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? d.error ?? "That didn't go through. Try again.");
        // And the claim is read again. The likeliest refusal is a claim this
        // member already holds, from a second tap or another tab.
        onChanged();
      } else {
        onChanged();
      }
    } catch {
      setError("That didn't go through. Try again.");
    }
    setBusy(false);
  };

  const doSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await gameFetch(`/api/game/quests/${questId}/submit`, {
        method: "POST",
        body: JSON.stringify({ artifactUrl, note }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? d.error ?? "That didn't go through. Try again.");
        // And the claim is read again, with the form left open on what was
        // typed. The likeliest refusal is a claim a steward decided meanwhile,
        // and the page should show that decision.
        onChanged();
      } else {
        setShowSubmit(false);
        onChanged();
      }
    } catch {
      setError("That didn't go through. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="px-6 py-3 border-t border-border">
      {!claim || claim.status === "declined" ? (
        <button
          onClick={doClaim}
          disabled={busy}
          className="inline-flex items-center gap-2 text-sm font-semibold bg-teal-deep text-white px-4 py-2 rounded-lg hover:bg-teal-deep-dark disabled:opacity-50 transition-colors pointer-coarse:min-h-11"
        >
          <SeedGlint className="w-4 h-4" /> {busy ? "Taking it…" : "Take this Quest"}
        </button>
      ) : claim.status === "claimed" ? (
        showSubmit ? (
          <form onSubmit={doSubmit} className="space-y-2">
            <input
              type="url"
              value={artifactUrl}
              onChange={(e) => setArtifactUrl(e.target.value)}
              placeholder={t({ message: "Link to your work (photo, doc...)", context: "QuestActions, placeholder" })}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg outline-none focus:border-teal-deep"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t({ message: "A few words about what you did", context: "QuestActions, placeholder" })}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg outline-none focus:border-teal-deep resize-y"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-semibold bg-teal-deep text-white px-3 py-1.5 rounded-lg hover:bg-teal-deep-dark disabled:opacity-50 transition-colors pointer-coarse:min-h-11">
                <Trans context="QuestActions, button"><Send className="w-3.5 h-3.5" /> Turn it in
              </Trans></button>
              <button type="button" onClick={() => setShowSubmit(false)} className="text-sm text-muted-foreground px-2 pointer-coarse:min-h-11 pointer-coarse:px-3">
                <Trans context="QuestActions, button">Cancel
              </Trans></button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowSubmit(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-amber text-foreground px-4 py-2 rounded-lg hover:bg-amber/90 transition-colors pointer-coarse:min-h-11"
          >
            <Trans context="QuestActions, button"><Send className="w-4 h-4" /> Turn in your work
          </Trans></button>
        )
      ) : claim.status === "submitted" ? (
        <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-700">
          <Trans context="QuestActions, span"><Send className="w-4 h-4" /> Turned in! Waiting on the circle's yes.
        </Trans></span>
      ) : (
        <ConsentedReward claim={claim} decimals={decimals} pay={pay} />
      )}
      {/* role="alert": claiming, submitting and abandoning a quest all
          report their refusal here, and it is the only report. Without the
          role a member using a screen reader presses Claim, hears nothing,
          and has no way to learn the quest was already taken. */}
      {error && <p role="alert" className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
