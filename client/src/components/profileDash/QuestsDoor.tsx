/**
 * MY WORK'S ONE DOOR TO THE VILLAGE'S QUESTS (the lead, 27 Nov 2026, the portal's next moves:
 * "On My work, the quest board summary repeats the village's Quests page; it could become one
 * link to it." His answer: "yes").
 *
 * The profile used to draw GameDashboard's Quests card here: the member's first four claims and a
 * door to the board. Their own quests are drawn in full just above it (YourQuests), so the card
 * said the same thing twice and then pointed at the board. This is the door alone.
 *
 * A MEMBER WHO HOLDS A ROLE IS NOT PUSHED TOWARD QUESTS (the lead, 27 Nov 2026: roles do not
 * normally do quests; quests are a way for others to contribute). For them the door stays last on
 * the tab and says the board is there if they want it. For everyone else it is the way in.
 */
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { SeedGlint } from "@/components/sacred/living";
import { CARD, DOOR, H2, HINT } from "@/components/journey/look";

export default function QuestsDoor({ holdsRole }: { holdsRole: boolean }) {
  const { t } = useLingui();
  return (
    <section aria-labelledby="quests-door-h" className={CARD} data-quests-door={holdsRole ? "role" : "open"}>
      <h2 id="quests-door-h" className={`flex items-center gap-2 ${H2}`}>
        <SeedGlint className="h-5 w-5 text-notice" aria-hidden="true" />
        {t({ message: "The village's quests", context: "profile My work: the door to the Quests page, heading" })}
      </h2>
      <p className={`mt-2 ${HINT}`}>
        {holdsRole
          ? t({ message: "Your roles carry your work. Quests are how others in the village chip in, and the board is there whenever you want one.", context: "profile My work: the door to Quests, for a member who holds a role" })
          : t({ message: "Quests are a way to take part, alone or with others. Find one that fits on the Quests page.", context: "profile My work: the door to Quests, for a member with no role" })}
      </p>
      <Link href="/quests" className={`mt-4 ${DOOR}`}>
        {t({ message: "Open Quests", context: "profile My work: the door to the village's Quests page" })}
        <ArrowRight className="h-4 w-4 shrink-0 text-notice transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
