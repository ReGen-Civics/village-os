/**
 * THE APPLICATION'S STEPS, the drawn pieces (the lead, 11 Nov 2026; Phase A,
 * lane A1). The page is pages/ProposeARole.tsx; the step map is ./stones.ts;
 * the village's words are shared/foundingApplication.ts.
 *
 *   StepMark          six circles on a gold rule: where you are, and a way
 *                     back to any step already reached (a phone and a tablet)
 *   StepTrail         the same six as a vertical trail with every name, in
 *                     its own column beside the step (a desk, D-06)
 *   AboutPanes        About you's three short panes, named under the step (M7)
 *   RewardsBeside     the rewards' shape in the rail beside every step (D-06)
 *   RoleChoice        with no role named, the open roles, one door each
 *   KnowUsStep        step 1: the ways to get to know us, each ticked by the
 *                     applicant; it never locks, and says so
 *   ValueItems        step 3: several value items, each tagged to one of the
 *                     season's goals, shown right there
 *   CompensationShape step 4: the shape of compensation as data (N% where the
 *                     village has set nothing), the plain word on risk, the footer
 *   FirstDayFacts     step 5: the first cycle and the first conversations
 *
 * THE FOUNDING REGISTER (Phase A brief): the same night world, quieter. Larger
 * display type, more space, gold rules, sacred geometry only as structure, and
 * no game words. Fireflies belong to the page's one primary act, never here.
 */
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
export { OpensLaterNote } from "./OpensLaterNote";
import { ArrowRight, Check, Plus, X } from "lucide-react";
import { BTN_SECONDARY, CARD, DOOR, EYEBROW, FIELD, HINT, LABEL, QUIET, TILE } from "@/components/journey/look";
import { LAST_STONE, stoneOfField } from "./stones";
import { applyWordT } from "./applyWordsT";
import { DraftMark } from "@/components/proposalDrafts/AskSera";
import GrowingField from "@/components/form/GrowingField";
import { BLANK_GOAL, GOAL_LIMITS } from "@shared/proposalGoals";
import { waitlistHref } from "@shared/roleListing";
import type { DraftableGoal } from "@shared/seraDrafts";
import type { FoundingSetup } from "@shared/foundingApplication";
import type { KnowUsLinks } from "@shared/knowUsLinks";
import { KnowUsWays } from "./KnowUsWays";
import { EarlyWords } from "./EarlyWords";
import { MoonText } from "@/components/MoonWord";
import { TokenText, useShareNames } from "@/components/ContributionWord";

/** A gold rule, the register's one ornament. */
export const GOLD_RULE = "border-t border-notice/40";

/**
 * WHERE YOU ARE: six circles on a gold rule. The step you are on is filled,
 * a step already reached is a ring you can return to, a step ahead waits.
 * On a phone the circles carry it alone (the heading names the step); on a
 * desk each circle has its name under it.
 */
export function StepMark({ labels, now, reached, onGo }: { labels: readonly string[]; now: number; reached: number; onGo: (i: number) => void }) {
  const { t } = useLingui();
  const count = labels.length;
  return (
    <nav aria-label={t({ message: `The ${count} steps of your application`, context: "founding application steps" })} data-step-mark="">
      <ol className="relative grid grid-cols-6 gap-1">
        <span aria-hidden="true" className={`absolute inset-x-[8%] top-[1.375rem] ${GOLD_RULE}`} />
        {labels.map((label, i) => {
          const here = i === now;
          const open = i <= reached && !here;
          // A step already walked carries a check, as the desk's trail does (applicant journey QA, 15 Nov 2026).
          const dot = here ? "size-4 bg-notice ring-4 ring-notice/25" : open ? "grid size-5 place-items-center border-2 border-notice bg-background text-notice" : "size-3 border border-border bg-background";
          const inner = (
            <>
              <span className="flex h-11 items-center justify-center">
                <span aria-hidden="true" className={`relative rounded-full ${dot}`} data-step-done={open ? "" : undefined}>
                  {open && <Check className="size-3" strokeWidth={3} />}
                </span>
              </span>
              <span className={`hidden text-center text-xs leading-snug lg:block ${here ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </>
          );
          const name = t({ message: `Step ${i + 1}: ${label}`, context: "founding application steps" });
          return (
            <li key={label} className="min-w-0">
              {open ? (
                <button type="button" onClick={() => onGo(i)} aria-label={name} className="grid w-full justify-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" data-step-go={i}>
                  {inner}
                </button>
              ) : (
                // A plain span may not carry a name (applicant QA, 20 Nov 2026): a screen reader read nothing on a phone, where
                // the label is hidden. The name is said as text, once, and the drawn words are hidden from it.
                <span aria-current={here ? "step" : undefined} className="grid justify-items-center">
                  <span className="sr-only">{name}</span>
                  <span aria-hidden="true" className="contents">{inner}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type ChoiceRole = { id: string; name: string; circle: string; aim: string | null; opensLater?: boolean; held?: boolean };

/**
 * With no role named: the open roles, each one door. One application is for one role.
 *
 * Hiring the founding team first (Rye, 14 Nov 2026): while some roles open after the
 * founding team, the list is two, the founding roles first and then the roles opening
 * next, with the line that says a reply to those waits.
 */
export function RoleChoice({ roles: all, onPick }: { roles: ReadonlyArray<ChoiceRole>; onPick: (id: string) => void }) {
  const { t } = useLingui();
  // A held role offers no Apply here (Rye, 16 Nov 2026).
  const roles = all.filter((r) => r.held !== true);
  if (roles.length === 0) {
    return <p className={HINT}>{t({ message: "No role is open right now. Check back soon.", context: "founding application choose" })}</p>;
  }
  const later = roles.filter((r) => r.opensLater === true);
  const first = roles.filter((r) => r.opensLater !== true);
  if (later.length === 0 || first.length === 0) return <RoleDoors roles={roles} onPick={onPick} />;
  return (
    <div className="grid gap-10">
      <section aria-labelledby="choose-first" data-role-choice-first="">
        <h2 id="choose-first" className="mb-4 font-display text-2xl leading-tight text-foreground">{t({ message: "Filling first: the founding team", context: "founding application choose, founding roles heading" })}</h2>
        <RoleDoors roles={first} onPick={onPick} />
      </section>
      <section aria-labelledby="choose-later" data-role-choice-later="">
        <h2 id="choose-later" className="mb-2 font-display text-2xl leading-tight text-foreground">{t({ message: "Opening next", context: "founding application choose, later roles heading" })}</h2>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t({ message: "You are welcome to apply for these now. We are filling the founding team first, so it may be a while before we reply.", context: "founding application choose, later roles note" })}</p>
        <RoleDoors roles={later} onPick={onPick} />
      </section>
    </div>
  );
}

function RoleDoors({ roles, onPick }: { roles: ReadonlyArray<ChoiceRole>; onPick: (id: string) => void }) {
  const { t } = useLingui();
  return (
    <ul className="grid gap-3" data-role-choice="">
      {roles.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onPick(r.id)} className={`${DOOR} w-full py-4 text-left`} data-role={r.id}>
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{r.circle}</span>
              <span className="break-words font-display text-xl leading-tight">{t({ message: `Apply: ${r.name}`, context: "founding application choose" })}</span>
              {r.aim && <span className="break-words text-sm font-normal text-muted-foreground">{r.aim}</span>}
            </span>
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Step 1: each way ticked by the applicant. The note shows while any is open, and the step never locks. */
export function KnowUsStep({ ways, note, ticked, onChange, links }: { ways: readonly string[]; note: string; ticked: readonly string[]; onChange: (next: string[]) => void; links?: KnowUsLinks }) {
  const { t } = useLingui();
  const open = ways.some((w) => !ticked.includes(w));
  return (
    <div className="grid gap-5">
      {/* Each way as a link, the warm push and the Steward path fork (Rye, 15 Nov 2026). */}
      <KnowUsWays links={links} />
      {ways.length > 0 ? (
        <fieldset className="grid gap-2" data-know-us="">
          <legend className={`mb-2 ${LABEL}`}>{t({ message: "Tick the ones you have done", context: "founding application know us" })}</legend>
          {ways.map((w, i) => (
            <label key={w} htmlFor={`know-us-${i}`} className={`flex min-h-11 cursor-pointer items-center gap-3 ${QUIET}`}>
              <input
                id={`know-us-${i}`}
                type="checkbox"
                className="size-5 shrink-0 accent-notice"
                checked={ticked.includes(w)}
                onChange={() => onChange(ticked.includes(w) ? ticked.filter((x) => x !== w) : [...ticked, w])}
              />
              <span className="min-w-0 break-words text-foreground">{w}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className={HINT}>{t({ message: "We will share how to meet us once you apply.", context: "founding application know us" })}</p>
      )}
      {open && note && (
        <p className="border-l-2 border-notice/60 pl-4 text-sm leading-relaxed text-foreground" data-know-note="">
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * Step 3: several value items, each a deliverable tagged to one of the
 * season's goals, with the goals shown right there. Add, edit, remove. The
 * items travel as the card's goals (shared/proposalGoals.ts judges them).
 */
export function ValueItems({
  roleId,
  items,
  onChange,
  goals,
  assist,
  missingTag,
}: {
  roleId: string;
  items: DraftableGoal[];
  onChange: (next: DraftableGoal[]) => void;
  goals: ReadonlyArray<{ id: string; text: string }>;
  assist?: ReactNode;
  /** The items still without a season goal, by position (1-based), to mark their choice. */
  missingTag?: readonly number[];
}) {
  const { t } = useLingui();
  const rows = items.length ? items : [{ ...BLANK_GOAL }];
  const set = (i: number, next: Partial<DraftableGoal>) => onChange(rows.map((g, k) => (k === i ? { ...g, ...next } : g)));
  const prefix = `value-${roleId}`;
  return (
    <div className="grid gap-6" data-role-card={roleId}>
      {/* What the items become (Rye, 14 Nov 2026): your proposal sets your pay, through this first moon's contract. */}
      <p className="font-semibold text-foreground" data-value-contract="">
        <MoonText text={t({ message: "These items become your first moon's contract: three to five things you'll deliver, each with how we'll know it's done.", context: "founding application value" })} />
      </p>
      {/* Paid on what we truly accomplish (Rye, 14 Nov 2026), said where the contract is written, before anyone signs up to it (steelman QA, 15 Nov 2026). */}
      <p className="text-sm leading-relaxed text-muted-foreground" data-value-pay-follows="">
        {t({ message: "Goals guide the work, and pay follows what you deliver. If a month ends far from what we agreed, your pay can change to match, up or down. The Treasurer proposes any change with a reason, you can reply, and nothing is paid until the Treasurer confirms.", context: "founding application value" })}
      </p>
      {/* The season's goals are offered once, in each item's own choice below (idea 16): no list above it as well. */}
      {goals.length === 0 && (
        <p className={`${QUIET} text-sm text-foreground`} data-no-season-goals="">
          {t({ message: "The village has not set its goals for this season yet. You can still apply: say in each item what it brings.", context: "founding application value" })}
        </p>
      )}
      {assist}
      <ol className="grid gap-4" data-goals-list="">
        {rows.map((g, i) => {
          const n = i + 1;
          const untagged = missingTag?.includes(n) ?? false;
          return (
            <li key={i} className={`${TILE} grid gap-3`} data-value-item={n}>
              <div className="flex items-center justify-between gap-3">
                <p className={EYEBROW}>{t({ message: `Value ${n}`, context: "founding application value" })}</p>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((_, k) => k !== i))}
                    className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <X className="size-4" aria-hidden="true" />
                    {t({ message: `Remove value ${n}`, context: "founding application value" })}
                  </button>
                )}
              </div>
              {g.seraDraft && <DraftMark founding onKeep={() => set(i, { seraDraft: false })} />}
              <div>
                <label htmlFor={`${prefix}-${i}-title`} className={`mb-2 block ${LABEL}`}>
                  {t({ message: "What you will bring", context: "founding application value" })}
                </label>
                <GrowingField minRows={2} id={`${prefix}-${i}-title`} clip={`value-${i + 1}-title`} limit={GOAL_LIMITS.title} value={g.title} onChange={(title) => set(i, { title, seraDraft: false })} className={`${FIELD} py-3`} />
              </div>
              <div>
                <label htmlFor={`${prefix}-${i}-done`} className={`mb-2 block ${LABEL}`}>
                  {t({ message: "How we will know it is done", context: "founding application value" })}
                </label>
                <GrowingField minRows={2} id={`${prefix}-${i}-done`} clip={`value-${i + 1}-done`} limit={GOAL_LIMITS.doneWhen} value={g.doneWhen} onChange={(doneWhen) => set(i, { doneWhen, seraDraft: false })} className={`${FIELD} py-3`} />
              </div>
              {goals.length > 0 && (
                <div>
                  <label htmlFor={`${prefix}-${i}-serves`} className={`mb-2 block ${LABEL}`}>
                    {t({ message: "The season goal it serves", context: "founding application value" })}
                  </label>
                  <select
                    id={`${prefix}-${i}-serves`}
                    value={g.serves}
                    onChange={(e) => set(i, { serves: e.target.value })}
                    className={`${FIELD} min-h-11 py-3`}
                    aria-invalid={untagged || undefined}
                    data-value-serves=""
                  >
                    <option value="">{t({ message: "Choose a goal", context: "founding application value" })}</option>
                    {goals.map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.text}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {rows.length < GOAL_LIMITS.max && (
        <div>
          <button type="button" onClick={() => onChange([...rows, { ...BLANK_GOAL }])} className={BTN_SECONDARY} data-add-value="">
            <Plus className="size-4" aria-hidden="true" />
            {t({ message: "Add another value item", context: "founding application value" })}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Step 4's compensation shape on a phone, where the rail beside the steps does not show: what the rail says (the
 * applicant's own split for each role, else the village's in one line) and the plain word on risk (T68) as the one-line
 * footnote. Never a range, a minimum or a budget figure.
 */

export function CompensationShape({ setup, splits = [] }: { setup: FoundingSetup; splits?: ReadonlyArray<{ name: string; line: string }> }) {
  const { t } = useLingui();
  // The village's own token names, the contribution token's first mention wearing its at-risk tip (the lead, 19 Nov 2026).
  const names = useShareNames();
  return (
    <section aria-labelledby="comp-shape-h" className="grid gap-5" data-comp-shape="">
      <div className={`${GOLD_RULE} pt-5`}>
        <h3 id="comp-shape-h" className="font-display text-2xl text-card-foreground">
          {t({ message: "How compensation is shaped", context: "founding application compensation" })}
        </h3>
        <p className={`mt-1 ${HINT}`}>
          <TokenText text={t({ message: `How your pay is split between cash, ${names.equity} and ${names.credits}. Your price is set above, by your proposal.`, context: "founding application compensation, with the village's token names" })} />
        </p>
      </div>
      {/* The phone's stand-in for the rail (production check of 1.3.25): what the rail says, the applicant's own split for
          each role and the one-line footnote, so the two never disagree. The village's longer note stays off this step. */}
      <OwnSplits setup={setup} splits={splits} />
      {setup.atRisk && (
        <p className="text-xs leading-relaxed text-muted-foreground" data-at-risk="">
          <TokenText text={setup.atRisk} />
        </p>
      )}
    </section>
  );
}

/**
 * Step 5's facts: the first conversation, the first cycle, and the village's first conversations, as one short list
 * with no headings of their own (idea 16: the Steward path already names these steps).
 */
export function FirstDayFacts({ setup, firstConversation = null }: { setup: FoundingSetup; firstConversation?: string | null }) {
  const { t } = useLingui();
  const items = [
    // The first conversation of the role's own list (conversations[0]). Its booking link comes with the invitation and
    // on the status page, so nobody books before we invite them (role journey L6).
    ...(firstConversation ? [{ key: "booking", text: t({ message: `First, a conversation with ${firstConversation}. Once we invite you, you book it through the link in your invitation, or we write with times.`, context: "founding application first day" }) }] : []),
    ...(setup.firstCycle ? [{ key: "cycle", text: setup.firstCycle }] : []),
    ...setup.firstConversations.map((c) => ({ key: `talk:${c}`, text: c })),
  ];
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-2" data-first-day="">
      {items.map((x) => (
        <li key={x.key} className={`${QUIET} whitespace-pre-line text-base leading-relaxed text-foreground`} data-first-booking={x.key === "booking" ? "" : undefined} data-first-cycle={x.key === "cycle" ? "" : undefined} data-first-conversations={x.key.startsWith("talk:") ? "" : undefined}>
          {x.text}
        </li>
      ))}
    </ul>
  );
}

/** The quiet way back to the roles, under the title when more than one is open. */
/**
 * A COMING-SOON ROLE: ITS WAITLIST FIRST, AND AN EARLY APPLICATION (the lead, 19 and 20 Nov 2026). A card's Apply link
 * or a link naming one opens this in place of the form: the way to its waitlist on the roles page, then the lead's
 * words and "Apply early", which opens the form. A draft this device keeps for it is left as it is until then.
 */
export function NotOpenYet({ role, onEarly, children }: { role: { id: string; name: string; circle: string }; onEarly: () => void; children?: ReactNode }) {
  const { t } = useLingui();
  return (
    <section aria-labelledby="not-open-h" className={`${CARD} grid gap-4`} data-role-not-open={role.id}>
      <p className={EYEBROW}>{role.circle}</p>
      <h1 id="not-open-h" className="break-words font-display text-4xl leading-tight text-card-foreground">
        {t({ message: `${role.name} is not open yet`, context: "founding application, a coming-soon role" })}
      </h1>
      <p className="text-base leading-relaxed text-foreground">
        {t({ message: "Join its waitlist to hear when it opens.", context: "founding application, a coming-soon role" })}
      </p>
      <a href={waitlistHref(role.id)} className={`${DOOR} justify-self-start`} data-waitlist-role={role.id}>
        {t({ message: `Join the waitlist for ${role.name}`, context: "founding application, a coming-soon role's waitlist" })}
        <ArrowRight className="size-4" aria-hidden="true" />
      </a>
      <div className={`${GOLD_RULE} grid gap-3 pt-4`} data-early-offer="">
        <p className="text-sm leading-relaxed text-muted-foreground"><EarlyWords /></p>
        <button type="button" onClick={onEarly} className={`${BTN_SECONDARY} justify-self-start`} data-apply-early={role.id}>
          {t({ message: `Apply early for ${role.name}`, context: "founding application, add a coming-soon role as an early application" })}
        </button>
      </div>
      {children}
    </section>
  );
}

/** The quiet way back to the roles, under the title when more than one is open. */
export function OtherRole({ onChoose }: { onChoose: () => void }) {
  const { t } = useLingui();
  return (
    <button type="button" onClick={onChoose} className="min-h-11 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" data-other-role="">
      {t({ message: "Apply for a different role", context: "founding application" })}
    </button>
  );
}


/**
 * A DESK'S PATH (D-06): the six steps as a vertical trail in their own column,
 * every name showing. A passed step is a gold ring with a check and a way back;
 * the step you stand on is filled gold; a step ahead waits as a plain ring.
 */
export function StepTrail({ labels, now, reached, onGo }: { labels: readonly string[]; now: number; reached: number; onGo: (i: number) => void }) {
  const { t } = useLingui();
  const count = labels.length;
  return (
    <nav aria-label={t({ message: `The ${count} steps of your application`, context: "founding application steps" })} data-step-trail="">
      <ol className="grid">
        {labels.map((label, i) => {
          const here = i === now;
          const passed = i <= reached && !here;
          const stone = here
            ? "border-notice bg-notice text-background"
            : passed
              ? "border-notice text-notice"
              : "border-border text-muted-foreground";
          const inner = (
            <>
              <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold ${stone}`}>
                {passed ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={`min-w-0 text-left text-sm leading-snug ${here ? "font-semibold text-foreground" : passed ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </>
          );
          const name = t({ message: `Step ${i + 1}: ${label}`, context: "founding application steps" });
          return (
            <li key={label} className="relative" data-trail-state={here ? "here" : passed ? "passed" : "ahead"}>
              {i < labels.length - 1 && <span aria-hidden="true" className={`absolute left-[11px] top-9 h-4 border-l ${i < reached ? "border-notice/60" : "border-border"}`} />}
              {passed ? (
                <button type="button" onClick={() => onGo(i)} aria-label={name} className="flex min-h-11 w-full items-center gap-3 rounded-lg hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" data-step-go={i}>
                  {inner}
                </button>
              ) : (
                <span aria-current={here ? "step" : undefined} className="flex min-h-11 items-center gap-3">
                  <span className="sr-only">{name}</span>
                  <span aria-hidden="true" className="contents">{inner}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** About you's panes, in order (M7). */
export const ABOUT_PANES = 3;

/** The About you pane that holds a field: who you are, your story, then who can speak for you. */
export function aboutPaneOf(field: string | null): number {
  switch (field) {
    case "name":
    case "email":
    case "why":
    case "voice":
      return 0;
    case "checkConsent":
    case "references":
      return 2;
    default:
      return 1;
  }
}

/** The three panes named under About you's heading, the one you are on marked. */
export function AboutPanes({ names, now }: { names: readonly string[]; now: number }) {
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-about-panes="">
      {names.map((n, i) => (
        <li key={n} aria-current={i === now ? "step" : undefined} className={i === now ? "font-semibold text-foreground" : "text-muted-foreground"}>
          <span className={i === now ? "text-notice" : ""}>{i + 1}</span> {n}
        </li>
      ))}
    </ol>
  );
}

/** The rewards' shape beside every step on a desk (D-06): the split, the line that it is settled in onboarding, the word on risk. */
/**
 * THE REWARDS BESIDE EVERY STEP. Never fixed tiles beside the split they can edit (production check of 1.3.24): the
 * applicant's own split for each role once The terms has worked it, else the village's default in one line.
 */
/**
 * The applicant's own split for each role, the role named when there are several; with none worked yet, the village's
 * split in one line. Shared by the rail (RewardsBeside) and the phone's terms step (CompensationShape).
 */
function OwnSplits({ setup, splits }: { setup: FoundingSetup; splits: ReadonlyArray<{ name: string; line: string }> }) {
  const { t } = useLingui();
  const pcts = setup.shares.map((s) => s.pct);
  // The village's split in one line; with none written, the onboarding line. The longer "Of this, 40% is paid in
  // cash..." sentence went with the rail's fix: it said the village's split where the applicant's own belongs.
  const fallback = pcts.length
    ? t({ message: `Default split ${pcts.join("/")}. You can change it in The terms.`, context: "founding application compensation, the village's split in one line" })
    : t({ message: "To be decided in the onboarding process.", context: "founding application compensation" });
  return splits.length ? (
    <ul className="grid gap-2 text-sm text-foreground" data-own-splits="">
      {splits.map((x) => (
        <li key={x.name} className="break-words">
          {splits.length > 1 ? <span className="font-semibold">{x.name}: </span> : null}
          <TokenText text={x.line} />
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-foreground" data-split-line="">{fallback}</p>
  );
}

/**
 * Open on The terms, where the split is set; `collapsed` on every other step, folded to its heading so the same box
 * does not repeat beside all of them (the roles lane, 19 Nov 2026). Folded, it still opens with a tap.
 */
export function RewardsBeside({ setup, splits = [], collapsed = false }: { setup: FoundingSetup; splits?: ReadonlyArray<{ name: string; line: string }>; collapsed?: boolean }) {
  const { t } = useLingui();
  const heading = t({ message: "How rewards work", context: "founding application compensation" });
  const body = (
    <>
      <OwnSplits setup={setup} splits={splits} />
      {setup.atRisk && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <TokenText text={setup.atRisk} />
        </p>
      )}
    </>
  );
  if (collapsed) {
    return (
      <details className="rounded-2xl border border-border bg-card px-6 py-2 shadow-sm" data-rewards-beside="" data-collapsed="">
        <summary className={`${EYEBROW} flex min-h-11 cursor-pointer items-center`}>{heading}</summary>
        <div className="grid gap-3 pb-4">{body}</div>
      </details>
    );
  }
  return (
    <section aria-labelledby="rewards-beside-h" className="grid gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm" data-rewards-beside="">
      <p id="rewards-beside-h" className={EYEBROW}>
        {heading}
      </p>
      {body}
    </section>
  );
}

/** Every problem found on the last Continue or Send, each a way to its own place (audit M1). */
export function ProblemsList<P extends { field: string | null; message: string }>({ problems, labels, stone, onShow }: { problems: readonly P[]; labels: readonly string[]; stone: number; onShow: (p: P) => void }) {
  const { t } = useLingui();
  if (problems.length === 0) return null;
  return (
    <div id="propose-problems" tabIndex={-1} role="alert" className="mb-8 rounded-lg border border-border bg-muted p-4 text-sm text-foreground outline-none" data-problems="">
      <p className="font-semibold">
        {stone === LAST_STONE
          ? problems.length === 1
            ? t`One thing to fix before we can send this:`
            : t`${problems.length} things to fix before we can send this:`
          : problems.length === 1
            ? t({ message: "One thing to look at before you continue:", context: "founding application check" })
            : t({ message: `${problems.length} things to look at before you continue:`, context: "founding application check" })}
      </p>
      <ul className="mt-2 grid gap-1">
        {problems.map((p, i) => {
          const where = labels[stoneOfField(p.field)];
          return (
            <li key={`${p.field}-${i}`}>
              {/* A refusal that names no answer (a busy connection, the hour's limit) is said as words, never as a link
                  that leads nowhere (applicant QA, 20 Nov 2026). */}
              {!p.field ? (
                <span className="block py-2" data-problem-plain="">{applyWordT(p.message)}</span>
              ) : (
              <button type="button" onClick={() => onShow(p)} className="min-h-11 text-left underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
                {stoneOfField(p.field) !== stone ? `${where}: ${applyWordT(p.message)}` : applyWordT(p.message)}
              </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The role beside the step on a desk: its circle and name, and, open on The terms (idea 16, said once), its aim, the
 * commitment it asks and a check that always happens. On every other step they fold under "About the role".
 */
export function RoleBeside({ role, pct, open = true }: { role: { circle: string; name: string; aim: string | null; alwaysChecked?: boolean }; pct: number | null | undefined; open?: boolean }) {
  const { t } = useLingui();
  const facts = (
    <>
      {role.aim && <p className="text-sm leading-relaxed text-muted-foreground">{role.aim}</p>}
      {typeof pct === "number" && <p className={`${GOLD_RULE} pt-3 text-sm text-foreground`}>{t({ message: `The role asks ${pct}% of your commitment`, context: "founding application beside" })}</p>}
      {role.alwaysChecked && <p className="text-sm text-foreground">{t({ message: "A background check happens for this role whatever the references say.", context: "open proposal role" })}</p>}
    </>
  );
  const any = !!role.aim || typeof pct === "number" || !!role.alwaysChecked;
  return (
    <div className={`${CARD} grid gap-3`} data-role-beside="">
      <p className={EYEBROW}>{role.circle}</p>
      <p className="font-display text-2xl leading-tight text-card-foreground">{role.name}</p>
      {open || !any ? (
        facts
      ) : (
        <details data-role-beside-folded="">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-notice">{t({ message: "About the role", context: "founding application beside" })}</summary>
          <div className="grid gap-3 pb-1">{facts}</div>
        </details>
      )}
    </div>
  );
}

/** A desk's keyboard, named once beside Continue (D-06). */
export function EnterHint() {
  const { t } = useLingui();
  return (
    <span className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground lg:flex" data-enter-hint="">
      <kbd className="rounded-lg border border-border px-1.5 py-0.5 text-xs text-muted-foreground">{t({ message: "Enter", context: "the keyboard key" })}</kbd>
      {t({ message: "to continue", context: "founding application keys" })}
    </span>
  );
}

/** Review & submit: each step in a line, with a way back to it. */
export function ReviewLines({ review, labels, onChange, extras = [] }: { review: ReadonlyArray<[number, string]>; labels: readonly string[]; onChange: (i: number) => void; extras?: ReadonlyArray<{ step: number; label: string; line: string }> }) {
  const { t } = useLingui();
  // Each step's line, then the price and the notes on the role after the step they are made on (applicant journey QA).
  const rows = review.flatMap(([i, line]) => [{ key: `s${i}`, step: i, label: labels[i], line }, ...extras.filter((x) => x.step === i).map((x, k) => ({ key: `x${i}-${k}`, ...x }))]);
  return (
    <ul className="grid gap-2" data-review="">
      {rows.map(({ key, step, label, line }) => (
        <li key={key} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3" data-review-row={key}>
          <span className="grid min-w-0">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
            <span className="break-words text-sm text-foreground">
              <MoonText text={line} />
            </span>
          </span>
          {/* A name of its own for each, "Change About you" (a11y sweep P2-9): five buttons all called "Change" read as one. */}
          <button type="button" onClick={() => onChange(step)} aria-label={t({ message: `Change ${label}`, context: "open proposal review, the button's full name" })} className="min-h-11 shrink-0 px-2 text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            {t({ message: "Change", context: "open proposal review" })}
          </button>
        </li>
      ))}
    </ul>
  );
}
