/**
 * "GET YOUR GENE KEYS" ON THE CHARACTER PAGE: a card that stays, and a popup once.
 *
 * Rye, 2026-10-22: where members pick their character, "with a popup but also
 * in the character selection screen", they are asked to get their Gene Keys.
 *
 *   - The card is on the page for as long as the member has no saved result.
 *   - The popup opens after a character is picked (a moment of success, never
 *     on page load), and only once on this device, so it never nags. Not now
 *     closes it; the card is still there.
 *
 * Both wear the profile's night world inside the character page's daylight, the
 * way role cards already do (`sheet-night` on the component, not the page).
 * Nothing renders while the module is off or while the member's result is
 * still being read.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { SeedGlint } from "@/components/sacred/living";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useMyGeneKeys } from "./useMyGeneKeys";
import { useGuideName } from "@/hooks/useGuideName";
import { guideNameAtSentenceStart } from "@shared/guideName";
import { BTN_GOLD, BTN_PLAIN, HINT, NIGHT_CARD } from "./ui";
import { Trans } from "@lingui/react/macro";

const SEEN_KEY = "gene-keys-prompt-seen";

function seenHere(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeenHere(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // A browser that refuses storage shows the popup again next time, which is harmless.
  }
}

/**
 * Who is speaking in the popup: the village's own guide, or "The village
 * guide" while it has no name. Asked only when the popup opens, so the page
 * does not read the Work With Us document for every visitor.
 */
function GuideLabel() {
  const guide = useGuideName();
  return <>{guide.loaded ? guideNameAtSentenceStart(guide.name) : "\u00a0"}</>;
}

export interface GeneKeysPromptProps {
  /** Goes up by one each time a character is picked on this page. */
  picked: number;
  /** "The Builder", for "The Builder is yours." */
  characterName: string | null;
}

export default function GeneKeysPrompt({ picked, characterName }: GeneKeysPromptProps) {
  const { on, mine } = useMyGeneKeys();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (picked > 0 && on && mine === null && !seenHere()) {
      markSeenHere();
      setOpen(true);
    }
  }, [picked, on, mine]);

  if (!on || mine !== null) return null;

  return (
    <>
      <section aria-labelledby="gene-keys-invite-h" className={NIGHT_CARD}>
        <h2 id="gene-keys-invite-h" className="flex items-center gap-2 font-display text-xl text-card-foreground">
          <Trans context="GeneKeysPrompt, h2"><SeedGlint className="h-5 w-5 text-notice" aria-hidden="true" />
          Get your Gene Keys
        </Trans></h2>
        <p className="mt-1 text-sm text-foreground">
          <Trans context="GeneKeysPrompt, p">See the two lines you carry and how you work best. Your lines help us find roles and teams that fit you.
        </Trans></p>
        <Link href="/profile/gene-keys" className={`${BTN_GOLD} mt-4`}>
          <Trans context="GeneKeysPrompt, Link">Find my lines
        </Trans></Link>
      </section>
      {open ? (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="sheet-night max-w-md rounded-2xl border-border bg-card p-6 text-card-foreground">
            <p className="text-sm text-notice"><GuideLabel /></p>
            <DialogTitle className="font-display text-3xl font-normal text-foreground">
              {characterName ? `${characterName} is yours.` : "Your character is chosen."}
            </DialogTitle>
            <DialogDescription className="text-base text-foreground">
              <Trans context="GeneKeysPrompt, DialogDescription">Want to see the lines you carry too? Your Gene Keys show how you work best, and which roles and teams might fit you.
            </Trans></DialogDescription>
            <p className={HINT}><Trans context="GeneKeysPrompt, p">Takes about a minute. You can always find it on this page.</Trans></p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href="/profile/gene-keys" className={BTN_GOLD} onClick={() => setOpen(false)}>
                <Trans context="GeneKeysPrompt, Link">Get your Gene Keys
              </Trans></Link>
              <button type="button" className={BTN_PLAIN} onClick={() => setOpen(false)}>
                <Trans context="GeneKeysPrompt, button">Not now
              </Trans></button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
