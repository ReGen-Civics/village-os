/**
 * The front door of a role proposal: a welcome, three questions in the
 * member's own words, and the switch to the six steps.
 *
 * The three answers are typed here and saved as typed. The guide does not
 * write them. Full control is the six steps, and switching does not clear
 * anything already written.
 */
import GrowingText from "@/components/sessions/GrowingText";
import { operationsRoleName, opsPartner } from "@shared/roleProposalHonesty";
import { useGuideName } from "@/hooks/useGuideName";
import { OWN_WORDS_MAX } from "@shared/roleProposals";
import type { OrgView } from "./StepRoles";
import type { SeasonState } from "./StepSeason";
import { STEPS, type StepKey } from "./proposalWords";
import { H2, LEDE, PANEL, PRIMARY, SECONDARY } from "./parts";
import { useProposalWords, type ProposalWords } from "@/components/roleProposal/proposalWordsMirror";

export type ProposalPath = "quick" | "full";
export type FrontScreen = "welcome" | "yours" | "steps";

/** A link with no step is the quick path. A link that names a step stays on the six steps. */
export function pathFromUrl(): ProposalPath {
  if (typeof window === "undefined") return "full";
  const q = new URLSearchParams(window.location.search);
  const path = q.get("path");
  if (path === "quick") return "quick";
  if (path === "full") return "full";
  return q.get("step") ? "full" : "quick";
}

export function rememberPath(path: ProposalPath): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("path", path);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}

/** A role card opens the quick path with that role ready to add. */
export function proposeRoleHref(roleId: string): string {
  const q = new URLSearchParams({ role: roleId, path: "quick" });
  return `/role-proposals/new?${q.toString()}`;
}

/** The role a card linked here, once. */
export function roleFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("role")?.trim() ?? "";
}

export interface SavedPlace {
  path: ProposalPath;
  step: StepKey;
  front: FrontScreen;
}

const placeKey = (id: string) => `rp-place:${id}`;

/** The link names a path or a step, so it wins over what this browser last had open. */
export function urlNamesPlace(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  return q.has("path") || q.has("step");
}

/** Where this browser last left this draft. Null when nothing was stored, or it cannot be read. */
export function readPlace(id: string): SavedPlace | null {
  if (typeof window === "undefined" || !id) return null;
  try {
    const raw = window.sessionStorage.getItem(placeKey(id));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SavedPlace>;
    if (p.path !== "quick" && p.path !== "full") return null;
    if (p.front !== "welcome" && p.front !== "yours" && p.front !== "steps") return null;
    if (!(STEPS as readonly string[]).includes(p.step ?? "")) return null;
    return { path: p.path, step: p.step as StepKey, front: p.front };
  } catch {
    return null;
  }
}

export function writePlace(id: string, place: SavedPlace): void {
  if (typeof window === "undefined" || !id) return;
  try {
    window.sessionStorage.setItem(placeKey(id), JSON.stringify(place));
  } catch {
    // A private window can refuse storage. The draft itself is already on the server.
  }
}

/** Keep a role from the page that started the draft, onto the draft's own address. */
export function keepRoleOn(href: string): string {
  if (typeof window === "undefined") return href;
  const role = roleFromUrl();
  if (!role) return href;
  const url = new URL(href, window.location.origin);
  if (!url.searchParams.get("role")) url.searchParams.set("role", role);
  if (!url.searchParams.get("path")) url.searchParams.set("path", "quick");
  return `${url.pathname}${url.search}`;
}

export function PathToggle({ path, onPath }: { path: ProposalPath; onPath: (next: ProposalPath) => void }) {
  const RW = useProposalWords();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={`${RW.quickPath} or ${RW.fullControl}`}>
      <button type="button" className={path === "quick" ? PRIMARY : SECONDARY} aria-pressed={path === "quick"} onClick={() => onPath("quick")}>
        {RW.quickPath}
      </button>
      <button type="button" className={path === "full" ? PRIMARY : SECONDARY} aria-pressed={path === "full"} onClick={() => onPath("full")}>
        {RW.fullControl}
      </button>
    </div>
  );
}

export function WelcomeScreen({ org, onStart }: { org: OrgView | null | "failed"; onStart: () => void }) {
  const RW = useProposalWords();
  // The guide is the village's assistant; the Ops role only fills open parts with the member.
  const guide = useGuideName();
  const ops = org === null ? null : opsPartner(operationsRoleName(org !== "failed" ? org.roles : []));
  return (
    <div className="grid gap-4">
      <h2 id="rp-welcome" tabIndex={-1} className={`${H2} outline-none`}>{RW.welcomeTitle}</h2>
      <p className={LEDE}>{RW.welcomeLede}</p>
      {guide.loaded && ops !== null && (
        <p className={LEDE}>
          {RW.guideHere(guide.name)} {RW.opsFillsOpen(ops)}
        </p>
      )}
      <button type="button" className={PRIMARY} onClick={onStart}>
        {RW.startQuestions}
      </button>
    </div>
  );
}

const questions = (RW: ProposalWords) =>
  [
    { key: "love", label: RW.love, hint: RW.loveHint },
    { key: "offer", label: RW.offer, hint: "" },
    { key: "why", label: RW.whyHere, hint: "" },
  ] as const;

export function YourWordsScreen({
  season,
  onChange,
}: {
  season: SeasonState;
  onChange: (next: SeasonState) => void;
}) {
  const RW = useProposalWords();
  const set = (key: "love" | "offer" | "why", value: string) => onChange({ ...season, ownWords: { ...season.ownWords, [key]: value } });
  return (
    <div className="grid gap-4">
      <div>
        <h2 id="rp-your-words" tabIndex={-1} className={`${H2} outline-none`}>{RW.yourWordsTitle}</h2>
        <p className={`${LEDE} mt-1`}>{RW.yourWordsLede}</p>
      </div>
      <p className="text-sm font-semibold text-notice" data-words-kept="">
        {RW.yourWordsKept}
      </p>
      <p className="text-sm text-foreground" data-any-language="">
        {RW.anyLanguage}
      </p>
      {questions(RW).map((q) => (
        <div key={q.key} className={`${PANEL} grid gap-2`}>
          <GrowingText id={`own-${q.key}`} label={q.label} placeholder={q.hint || undefined} value={season.ownWords[q.key]} onValue={(v) => set(q.key, v)} max={OWN_WORDS_MAX} minRows={3} mic />
        </div>
      ))}
    </div>
  );
}

/** Back and "Pick the roles", drawn in the sticky step bar so no bar ever hides them. */
export function YourWordsActions({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const RW = useProposalWords();
  return (
    <div className="flex items-center justify-between gap-2" data-yours-actions="">
      <button type="button" className={SECONDARY} onClick={onBack}>
        {RW.back}
      </button>
      <button type="button" className={PRIMARY} onClick={onNext}>
        {RW.onToRoles}
      </button>
    </div>
  );
}

/** The member door's agent side for one role (0374): a member proposes an agent they keep. */
export function agentProposalHref(roleId: string): string {
  const q = new URLSearchParams({ agent: "1", role: roleId });
  return `/role-proposals/new?${q.toString()}`;
}
