/**
 * THE GUIDE'S DOCK (the founder, 27 Nov 2026: setting up and running a village
 * is led by the guide, who sits beside every admin screen, takes speech,
 * explains, and prepares changes a person approves. Clicking and typing
 * always remain).
 *
 * One surface in place of two: the helper panel beside Admin
 * (../AdminHelperPanel.tsx, which this grew from and whose pieces it shares)
 * and the launch guide on the road to launch (components/journey/
 * LaunchGuide.tsx). It draws only while the village's dial
 * `platform.admin_guide_dock` is on; off, the two old surfaces stand exactly
 * as they were (../AdminHelperHost.tsx and ./JourneyGuide.tsx decide).
 *
 * TWO SHAPES, ONE BUTTON. Docked is the right-hand column the helper always
 * had. Expanded gives the conversation the main width and lists what the
 * guide has prepared beside it, under "Say yes". The same button contracts it
 * again, and so does Escape (Escape on a docked dock closes it, as it always
 * did). The choice is remembered on this device (./dockState.ts). On a phone
 * the dock is the full width either way, so it has one shape there and no
 * button.
 *
 * TALK. One box (components/chat/ChatComposer.tsx), which never sends by
 * itself. Words that arrive by voice land in the box to be edited, and a
 * small "You said" line above it shows what was heard; nothing is asked until
 * the person presses Send. Above the box sit up to four suggested next steps
 * (./dockSuggestions.ts): a press puts the words in the box and stops there.
 *
 * SAY YES. The guide writes nothing. A dial she proposes goes on the page's
 * one save bar ("Review and save"), and only a person's Save writes it. A
 * change that is not a dial she may draft for the review page ("Send to
 * review"), where a person accepts it. Both are the server's rules
 * (server/routes/adminHelper.ts); this file only draws them.
 *
 * WHO ANSWERS is always said: the village's guide by the name the village
 * gave it, or Sera, and on whose key. Where both can answer the person picks.
 *
 * WHERE IT SITS IS THE HOST'S. `placement="fixed"` (the default, today's Admin
 * and road to launch) is the fixed right-hand column, started under the
 * sticky header and stopped above the foot of the window, as the helper panel
 * is. `placement="slot"` is a plain block that fills whatever its container
 * gives it: no fixed positioning, no top or bottom, no layer of its own. The
 * garden's frame is the intended host for the slot: the frame owns the place,
 * and the dock only draws inside it. Its inside lays itself out by its OWN
 * width (container queries), never the window's, so it reads the same in a
 * narrow slot as on a phone.
 *
 * WHO HOLDS THE STATE IS THE HOST'S CHOICE TOO. With `state` and
 * `onStateChange` the dock is controlled: the expand, contract and close
 * buttons (and Escape) only call `onStateChange` with one of three words,
 * "closed", "docked" or "expanded", and the dock keeps no memory of its own.
 * Without them it remembers docked or expanded in this browser.
 *
 * A finished reply is announced to a screen reader once, whole, from one
 * quiet status line; the conversation itself is not a live region.
 *
 * NIGHT FIRST, ON THE GARDEN'S TOKENS (the founder, 27 Nov 2026). The dock's
 * own root carries the garden's scope (`.garden`, ../garden/garden.css) in
 * BOTH placements, so every token it names (bg-card, text-foreground,
 * border-border, bg-muted, text-muted-foreground, text-notice) is the garden's
 * night whatever the page around it is: the older admin tabs are still light,
 * and the dock is night beside them. The main act (Send, Review and save, the
 * chosen pill) is the garden's gold with the ground as its ink, the one pair
 * the garden measures for it. No numbered palette class and no literal colour.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ArrowRight, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { HelperAnswer, HelperProposal, HelperProvider, HelperStatus } from "@shared/adminHelper";
import { guideNameAtSentenceStart, UNNAMED_GUIDE } from "@shared/guideName";
import { guideLabelIn } from "@/lib/guideNameWords";
import ChatComposer from "@/components/chat/ChatComposer";
import { useChatDraft } from "@/components/chat/chatDraft";
import { appendSpoken } from "@/components/journal/GrowingTextarea";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { GARDEN } from "../garden/Garden";
import type { NavGroup } from "../adminNavGroups";
import { askGuide, askHelper, fetchHelperStatus, fileForReview, tabsFromGroups, type GuideConsulted, type HelperLine } from "../adminHelperApi";
import { ConnectSteps, OpenLabel, ProposalCard, proposalMarkOf, readPicked, rememberPicked, secondaryBtn, SwitchedOff, WhatTheGuideReads, type ProposalState } from "../helperPieces";
import { AdviceCard, ConsultedLine, FilingCard, GuideChoice, GuideFace, WhoAnswers, type FilingState } from "./DockCards";
import { dockDraftKey, dockSaidKey, readDockShape, rememberDockShape, type DockShape } from "./dockState";
import { DOCKED_SUGGESTIONS, MAX_SUGGESTIONS, useDockSuggestions, type SuggestionPlace } from "./dockSuggestions";
import { replyAsWords, ReplyText, useLinkNamer } from "./replyLinks";

/** The dock's conversations: the helper inside Admin, the launch guide, the organizing guide. */
export type DockMode = "helper" | "launch" | "organize";

/** The three states a host can hold the dock in. The dock itself only ever draws the last two. */
export type DockState = "closed" | DockShape;

type Turn = HelperLine & { answer?: HelperAnswer; consulted?: GuideConsulted; applied?: "dropped"; filing?: FilingState };

const NO_GROUPS: readonly NavGroup[] = [];
const NO_MARKS: readonly string[] = [];
const NO_PROPOSALS: readonly HelperProposal[] = [];

const cssLength = (v: number | string): string => (typeof v === "number" ? `${v}px` : v);

/** True from a tablet's width up, where the dock has two shapes. With no way to ask (a test, an old browser), wide. */
function useWide(): boolean {
  const query = "(min-width: 640px)";
  const [wide, setWide] = useState(() => {
    try {
      return typeof window.matchMedia === "function" ? window.matchMedia(query).matches : true;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return wide;
}

/** The smallest cover that counts as a keyboard: a scrollbar or a browser bar moves the same numbers by far less. */
const KEYBOARD_MIN = 80;

/**
 * How much of the window a phone's keyboard covers, top and bottom, so the
 * dock ends above it and Send stays in sight. The dock is fixed to the
 * window, and a keyboard shrinks only what is visible of it. A pinch zoom
 * moves the same numbers and is left alone.
 */
function useKeyboardCover(): { top: number; bottom: number } {
  const [cover, setCover] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || typeof vv.addEventListener !== "function") return;
    const sync = () => {
      const zoomed = Math.abs((vv.scale ?? 1) - 1) > 0.01;
      const bottom = zoomed ? 0 : Math.round(window.innerHeight - (vv.offsetTop ?? 0) - vv.height);
      const lifted = bottom >= KEYBOARD_MIN;
      const next = { top: lifted ? Math.max(0, Math.round(vv.offsetTop ?? 0)) : 0, bottom: lifted ? bottom : 0 };
      setCover((was) => (was.top === next.top && was.bottom === next.bottom ? was : next));
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);
  return cover;
}

export interface GuideDockProps {
  /** Where the dock stands: beside Admin, or on the road to launch. */
  surface: "admin" | "journey";
  /** The conversations on offer here, first one open. One mode shows no tabs. */
  modes: readonly DockMode[];
  /** The signed-in person's session token, as every admin call carries it. */
  password: string;
  /** The Admin map, for the helper. */
  groups?: readonly NavGroup[];
  /** The open admin tab, so the guide knows where the admin is. */
  tab?: string;
  /**
   * "fixed" (the default): the fixed right-hand column, between `top` and `bottom`. "slot": a plain block that fills
   * the width and height its container gives it; `top` and `bottom` are not read, and the container decides the rest.
   */
  placement?: "fixed" | "slot";
  /** Fixed only. Where the dock starts: the header's bottom edge, in pixels, or any CSS length. */
  top?: number | string;
  /** Fixed only. Where it stops: the height the foot of the window covers. */
  bottom?: number | string;
  /** Closes the dock, when the host does not hold its state (`onStateChange`). */
  onClose?: () => void;
  /** The shape to draw, held by the host. With it the dock remembers nothing of its own. */
  state?: DockShape;
  /** Told what the person asked for: "expanded", "docked" or "closed". With it the dock remembers nothing of its own. */
  onStateChange?: (next: DockState) => void;
  onOpenTab?: (key: string) => void;
  /** For tests and previews: skip the status fetch. */
  initialStatus?: HelperStatus;
  /** For tests and previews: the shape to open in, in place of the remembered one. */
  initialShape?: DockShape;
  /** The shape to open in when this person never chose one. Docked unless the surface says otherwise. */
  defaultShape?: DockShape;
  /** Proposals waiting on the save bar, and the ones saved, by key and value (AdminHelperHost). */
  waiting?: readonly string[];
  saved?: readonly string[];
  /** The proposals on the save bar themselves, so "Say yes" still lists them after the dock was closed. */
  onBar?: readonly HelperProposal[];
  onReview?: (p: HelperProposal) => void;
  onUnreview?: (p: HelperProposal) => void;
  /** Told the status this dock read, so its host learns when the village turns the dock off again. */
  onStatus?: (s: HelperStatus) => void;
  /**
   * What the host knows an internal address to be, by the address: a launch row's `fixAt` and its `fixLabel`. A reply
   * that carries one draws it as a link with these words (./replyLinks.tsx).
   */
  linkNames?: Readonly<Record<string, string>>;
  /** The person's name, for her first line. Left out, the signed-in member's own. */
  personName?: string;
}

export default function GuideDock({
  surface,
  modes,
  password,
  groups = NO_GROUPS,
  tab = "",
  placement = "fixed",
  top = 0,
  bottom = 0,
  onClose,
  state,
  onStateChange,
  onOpenTab,
  initialStatus,
  initialShape,
  defaultShape = "docked",
  waiting = NO_MARKS,
  saved = NO_MARKS,
  onBar = NO_PROPOSALS,
  onReview,
  onUnreview,
  onStatus,
  linkNames,
  personName,
}: GuideDockProps) {
  const { t, i18n } = useLingui();
  // Her first line greets the person by their first name, when the page knows it.
  const signedIn = useOptionalAuth()?.user?.name;
  const firstName = String(personName ?? signedIn ?? "").trim().split(/\s+/)[0] ?? "";
  const namer = useLinkNamer(linkNames, groups);
  const [status, setStatus] = useState<HelperStatus | null>(initialStatus ?? null);
  const [statusError, setStatusError] = useState("");
  const [mode, setMode] = useState<DockMode>(modes[0] ?? "helper");
  // A mode that left the list (the village launched, so the launch guide is done) falls back to the first one offered.
  const shown: DockMode = modes.includes(mode) ? mode : modes[0] ?? "helper";

  /*
   * The launch and organizing guides open on a greeting, the same words and the same first turn the launch guide's
   * own panel has, so what is sent to their two routes is what that panel sends.
   */
  const [threads, setThreads] = useState<Record<DockMode, Turn[]>>(() => ({
    helper: [],
    launch: [{ role: "assistant", content: t`I can see exactly where your launch stands. Want to start with what's blocking, or shall I walk the whole journey with you?` }],
    organize: [{ role: "assistant", content: t`Ask me about organizing: governance, conflict, membership, legal shells, internal economics. I read your village's brief first, then its own calls, and they outrank the books when they speak to it.` }],
  }));
  const turns = threads[shown];
  const started = turns.some((turn) => turn.role === "user");

  // A person's words: kept per person and per conversation, the way every chat draft is (./dockState.ts).
  const [draft, setDraft] = useChatDraft(dockDraftKey(password, shown));
  const [said, setSaid] = useChatDraft(dockSaidKey(password, shown));

  const [busy, setBusy] = useState<DockMode | null>(null);
  const [errors, setErrors] = useState<Partial<Record<DockMode, string>>>({});
  const [gone, setGone] = useState<Partial<Record<DockMode, boolean>>>({});
  // The finished reply, said once to a screen reader.
  const [announce, setAnnounce] = useState("");

  const dock = useRef<HTMLElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  // ── Docked or expanded ────────────────────────────────────────────────────
  const slotted = placement === "slot";
  // Held by the host (the garden's frame), or remembered here in this browser.
  const controlled = state !== undefined || onStateChange !== undefined;
  // A fixed dock has one shape on a phone, where it is the full width either way. In a slot the host decides.
  const windowWide = useWide();
  const wide = slotted || windowWide;
  const [ownShape, setOwnShape] = useState<DockShape>(() => initialShape ?? (controlled ? "docked" : readDockShape(defaultShape)));
  const shape: DockShape = controlled ? state ?? "docked" : ownShape;
  const expanded = wide && shape === "expanded";
  const reshape = useCallback(
    (next: DockShape) => {
      if (controlled) {
        onStateChange?.(next);
        return;
      }
      setOwnShape(next);
      rememberDockShape(next);
    },
    [controlled, onStateChange],
  );
  const close = useCallback(() => {
    if (onStateChange) onStateChange("closed");
    else onClose?.();
  }, [onStateChange, onClose]);
  const expandedNow = useRef(expanded);
  expandedNow.current = expanded;

  // A status the host read arrives as a prop, sometimes a moment after the dock opened.
  useEffect(() => {
    if (initialStatus) setStatus(initialStatus);
  }, [initialStatus]);
  useEffect(() => {
    if (initialStatus) return;
    const ctrl = new AbortController();
    fetchHelperStatus(password, ctrl.signal)
      .then((s) => {
        setStatus(s);
        onStatus?.(s);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setStatusError(String(e?.message ?? e));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked once per open, as the helper panel asks
  }, [password, initialStatus]);

  // Focus: the box when the dock can take words, and back to whatever opened the dock when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      if (opener && opener.isConnected && opener !== document.body && typeof opener.focus === "function") opener.focus();
    };
  }, []);
  const ready = shown === "helper" ? status?.on === true : !gone[shown];
  useEffect(() => {
    if (ready) input.current?.focus();
  }, [ready, shown]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [turns, busy]);

  // Escape contracts an expanded dock, and closes a docked one.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (expandedNow.current) reshape("docked");
      else close();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [close, reshape]);

  // ── Who answers ───────────────────────────────────────────────────────────
  const [picked, setPicked] = useState<HelperProvider | null>(() => readPicked());
  const chosen: HelperProvider | null = status && picked && status.available.includes(picked) ? picked : status?.provider ?? null;
  const pick = (p: HelperProvider) => {
    setPicked(p);
    rememberPicked(p);
  };
  /*
   * The village's own guide under the name the village gave it (an unnamed one in the reader's language), and Sera
   * under the name the village's connection gives her. Never "Claude": that is the model, said in the line beneath.
   */
  const villageGuide = guideLabelIn(status?.names?.anthropic || (status && status.provider !== "sera" ? status.guide : "") || UNNAMED_GUIDE.own, i18n);
  const seraName = status?.names?.sera || "Sera";
  const names: Record<HelperProvider, string> = { anthropic: guideNameAtSentenceStart(villageGuide), sera: seraName };
  // The launch and organizing guides are the village's own; the helper is whoever was picked.
  const guide = guideNameAtSentenceStart(shown === "helper" && chosen === "sera" ? seraName : villageGuide);

  // ── Talking ───────────────────────────────────────────────────────────────
  const place: SuggestionPlace = shown === "helper" ? { mode: "helper", tab } : { mode: shown };
  const suggestions = useDockSuggestions(place, !started, expanded ? MAX_SUGGESTIONS : DOCKED_SUGGESTIONS);

  const onDraft = useCallback(
    (next: string) => {
      setDraft(next);
      // An emptied box has nothing heard in it any more.
      if (!next.trim()) setSaid("");
    },
    [setDraft, setSaid],
  );
  const heard = useCallback((phrase: string) => setSaid((was) => appendSpoken(was, phrase)), [setSaid]);
  const suggest = (words: string) => {
    setDraft(words);
    setSaid("");
    input.current?.focus();
  };

  const append = (at: DockMode, turn: Turn) => setThreads((all) => ({ ...all, [at]: [...all[at], turn] }));

  const send = async () => {
    const words = draft.trim();
    if (!words || busy) return;
    const at = shown;
    const next: Turn[] = [...threads[at], { role: "user", content: words }];
    setThreads((all) => ({ ...all, [at]: next }));
    setDraft("");
    setSaid("");
    setErrors((e) => ({ ...e, [at]: "" }));
    setAnnounce("");
    setBusy(at);
    const lines = next.map(({ role, content }) => ({ role, content }));
    const speaker = guide;
    if (at === "helper") {
      const out = await askHelper(password, { messages: lines, tabs: tabsFromGroups(groups), tab, provider: chosen });
      setBusy(null);
      if (!out.ok) {
        if (out.off) setStatus((s) => ({ guide: s?.guide ?? "", on: false, off: out.off, provider: null, available: [], names: {}, ...(s?.dock ? { dock: true } : {}) }));
        else {
          const spent = out.error === "assistant-unavailable";
          setErrors((e) => ({ ...e, [at]: spent ? t({ message: "The guide has answered all it can for today. It starts again tomorrow.", context: "guide dock, the day's answers are used up" }) : out.error }));
        }
        return;
      }
      const said = out.answer.reply;
      append(at, { role: "assistant", content: said, answer: out.answer });
      // Read aloud with each address said as the page it names, never as a path.
      const reply = replyAsWords(said, namer);
      setAnnounce(t({ message: `${speaker} says: ${reply}`, context: "guide dock, a finished reply read to a screen reader" }));
      return;
    }
    const out = await askGuide(password, at, lines);
    setBusy(null);
    if (!out.ok) {
      if (out.gone) setGone((g) => ({ ...g, [at]: true }));
      else setErrors((e) => ({ ...e, [at]: out.error || t`Something hiccuped. Ask me that again?` }));
      return;
    }
    const said = out.reply || t`Something hiccuped. Ask me that again?`;
    append(at, { role: "assistant", content: said, consulted: out.consulted });
    const reply = replyAsWords(said, namer);
    setAnnounce(t({ message: `${speaker} says: ${reply}`, context: "guide dock, a finished reply read to a screen reader" }));
  };

  // ── What she prepared ─────────────────────────────────────────────────────
  const patchHelperTurn = (index: number, patch: Partial<Turn>) =>
    setThreads((all) => ({ ...all, helper: all.helper.map((turn, i) => (i === index ? { ...turn, ...patch } : turn)) }));

  const sendToReview = async (index: number) => {
    const filing = threads.helper[index]?.answer?.filing;
    if (!filing) return;
    patchHelperTurn(index, { filing: { state: "sending" } });
    const out = await fileForReview(password, filing.ticket);
    patchHelperTurn(index, { filing: out.ok ? { state: "sent", filed: out.filed } : { state: "failed", error: out.error } });
  };

  const proposalState = (turn: Turn): ProposalState => {
    const p = turn.answer?.proposal;
    if (!p) return null;
    if (turn.applied === "dropped") return "dropped";
    if (waiting.includes(proposalMarkOf(p))) return "waiting";
    return saved.includes(proposalMarkOf(p)) ? "saved" : null;
  };

  /** The card, or cards, one of the helper's turns carries. */
  const cardsOf = (turn: Turn, index: number): ReactNode => (
    <>
      {turn.answer?.proposal && (
        <ProposalCard
          proposal={turn.answer.proposal}
          state={proposalState(turn)}
          onReview={() => onReview?.(turn.answer!.proposal!)}
          onUnreview={() => onUnreview?.(turn.answer!.proposal!)}
          onDrop={() => patchHelperTurn(index, { applied: "dropped" })}
        />
      )}
      {turn.answer?.filing && (
        <FilingCard
          filing={turn.answer.filing}
          state={turn.filing}
          onSend={() => void sendToReview(index)}
          onDrop={() => patchHelperTurn(index, { filing: { state: "dropped" } })}
        />
      )}
    </>
  );

  const prepared = threads.helper
    .map((turn, index) => ({ turn, index }))
    .filter(({ turn }) => (turn.answer?.proposal && turn.applied !== "dropped") || (turn.answer?.filing && turn.filing?.state !== "dropped"));
  // Still on the save bar from before the dock was closed: listed too, so nothing prepared is out of sight.
  const inTalk = new Set(threads.helper.flatMap((turn) => (turn.answer?.proposal ? [proposalMarkOf(turn.answer.proposal)] : [])));
  const fromBar = onBar.filter((p) => !inTalk.has(proposalMarkOf(p)));
  const preparedCount = prepared.length + fromBar.length;

  // ── The frame ─────────────────────────────────────────────────────────────
  const cover = useKeyboardCover();
  // In a slot the container places the dock, so nothing here is measured or pinned.
  const style: CSSProperties | undefined = slotted
    ? undefined
    : {
        top: cover.top > 0 ? `max(${cssLength(top)}, ${cover.top}px)` : top,
        bottom: cover.bottom > 0 ? `max(${cssLength(bottom)}, ${cover.bottom}px)` : bottom,
      };
  /*
   * Fixed: the right-hand column, on its own layer. Slot: a block that fills its container and never grows past the
   * window, so with a container of any height the conversation scrolls inside and Send stays in sight.
   */
  const frame = slotted
    ? "relative h-full max-h-dvh min-h-0 w-full min-w-0"
    : `fixed right-0 w-full border-l border-border shadow-lg ${surface === "journey" ? "z-[70]" : "z-20"} ${expanded ? "left-0" : "sm:w-[26rem]"}`;
  /*
   * The box grows to at most half of the column it sits in (ChatComposer's `within`), so however long the draft, the
   * box and Send stay inside the dock. A new object whenever the column's height can have changed makes the box fit
   * itself again.
   */
  const within = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return column.current;
      },
      set current(_el) {
        /* read only: the column's own ref is the one written */
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each of these changes the column's height
    [expanded, cover.top, cover.bottom, top, bottom, shown, preparedCount],
  );

  const helperOff = shown === "helper" && status && !status.on;
  /*
   * Who is answering, under her name. The helper: whoever was picked. The launch and organizing guides are the
   * village's own guide on the same key the helper would use, so the same line is true of them while a key can answer.
   */
  const whoAnswers =
    shown === "helper" ? (
      chosen && status?.on ? <WhoAnswers provider={chosen} name={names[chosen]} lent={status.lent === true} /> : null
    ) : status?.available.includes("anthropic") ? (
      <WhoAnswers provider="anthropic" name={names.anthropic} lent={status.lent === true} />
    ) : null;

  return (
    <aside
      ref={dock}
      aria-label={t({ message: `${guide}, your guide`, context: "guide dock, the dock's own name" })}
      data-testid="guide-dock"
      data-shape={expanded ? "expanded" : "docked"}
      data-placement={placement}
      {...(surface === "journey" && !slotted ? { "data-hides-fab": "", "data-dialogue": "" } : {})}
      style={style}
      // The garden's scope, on the dock's own root: night in both placements. Gold is the main act's ground.
      className={`${GARDEN} @container flex flex-col overflow-hidden [--primary:var(--garden-gold)] [--primary-foreground:var(--garden-ground)] ${frame}`}
    >
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
        {/* Her face: the village's own guide in her gold ring. Sera, or a painting that will not load, is a letter. */}
        <GuideFace name={guide} portrait={!(shown === "helper" && chosen === "sera")} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-semibold leading-tight text-foreground">{guide}</h2>
          {whoAnswers}
          <p className="hidden text-xs text-muted-foreground @min-[40rem]:block">
            {shown === "helper" ? (
              <Trans context="admin helper panel">Helps you find things and proposes changes for you to approve.</Trans>
            ) : shown === "launch" ? (
              <Trans context="guide dock, what the launch guide does">Walks you through what is left before the launch.</Trans>
            ) : (
              <Trans context="guide dock, what the organizing guide does">Counsel on organizing, from your village's own brief first.</Trans>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {wide && (
            <button
              type="button"
              onClick={() => reshape(expanded ? "docked" : "expanded")}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? t({ message: "Bring the guide back to the side", context: "guide dock, contracts the dock" })
                  : t({ message: "Open the guide wide", context: "guide dock, expands the dock" })
              }
              data-testid="guide-dock-shape"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expanded ? <Minimize2 className="h-5 w-5" aria-hidden="true" /> : <Maximize2 className="h-5 w-5" aria-hidden="true" />}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label={t({ message: "Close the guide", context: "guide dock, closes the dock" })}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        </div>
          {/* The two choices, on a row of their own under her name: side by side where they fit, stacked where they do not. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 empty:hidden">
          {shown === "helper" && status?.on && status.available.length > 1 && <GuideChoice available={status.available} names={names} chosen={chosen} onPick={pick} />}
          {modes.length > 1 && (
            <div role="group" aria-label={t({ message: "What to talk about", context: "guide dock, the choice of conversation" })} className="flex max-w-full flex-wrap gap-1">
              {modes.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={shown === m}
                  onClick={() => setMode(m)}
                  className={`min-h-11 rounded-full px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${shown === m ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-muted"}`}
                >
                  {m === "helper" ? (
                    <Trans context="guide dock, the conversation that helps inside Admin">Admin</Trans>
                  ) : m === "launch" ? (
                    <Trans context="launch guide tab">Launch</Trans>
                  ) : (
                    <Trans context="launch guide tab">Organizing</Trans>
                  )}
                </button>
              ))}
            </div>
          )}
          </div>
      </div>

      {shown === "helper" && !status && !statusError && (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          <Trans context="admin helper panel">Opening the helper</Trans>
        </div>
      )}
      {shown === "helper" && statusError && <p role="alert" className="p-4 text-sm text-destructive">{statusError}</p>}
      {helperOff && (status.off === "switch" ? <SwitchedOff /> : <ConnectSteps onOpenIntegrations={() => onOpenTab?.("integrations")} />)}

      {(shown !== "helper" || status?.on) && (
        <div className={`flex min-h-0 flex-1 flex-col ${expanded ? "@min-[44rem]:flex-row" : ""}`}>
          <div ref={column} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-testid="guide-talk">
              <div className={`space-y-3 ${expanded ? "mx-auto w-full max-w-3xl" : ""}`}>
                {shown === "helper" && turns.length === 0 && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {/* One warm line in her voice first; then what she does and reads, from its one place. */}
                    <p className="font-display text-lg leading-snug text-foreground" data-testid="guide-first-line">
                      {firstName ? (
                        <Trans context="guide dock, the guide's first line before any question">Hello, {firstName}. What are we tending today?</Trans>
                      ) : (
                        <Trans context="guide dock, the guide's first line before any question">Hello. What are we tending today?</Trans>
                      )}
                    </p>
                    <WhatTheGuideReads rules={status?.rules} />
                  </div>
                )}
                {gone[shown] && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p><Trans context="guide dock, the guide cannot answer">The guide cannot answer just now. It needs an AI key, or it has answered all it can for today. Everything here still works by hand.</Trans></p>
                    {onOpenTab ? (
                      <button type="button" onClick={() => onOpenTab("integrations")} className={secondaryBtn}>
                        <Trans context="admin helper, opens the Integrations page">Open Integrations</Trans>
                      </button>
                    ) : (
                      <a href="/admin?tab=integrations" className={secondaryBtn}>
                        <Trans context="admin helper, opens the Integrations page">Open Integrations</Trans>
                      </a>
                    )}
                  </div>
                )}
                {!gone[shown] &&
                  turns.map((turn, i) => (
                    <div key={i} className={turn.role === "user" ? "flex justify-end" : ""}>
                      <div
                        className={
                          turn.role === "user"
                            ? "gd-plaque max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm text-foreground"
                            : "max-w-full whitespace-pre-wrap break-words rounded-2xl bg-muted px-3 py-2 text-sm text-foreground"
                        }
                      >
                        {turn.role === "assistant" ? <ReplyText text={turn.content} namer={namer} inAdmin={surface === "admin"} /> : turn.content}
                        {turn.role === "assistant" && <ConsultedLine consulted={turn.consulted} />}
                      </div>
                      {turn.answer?.open && onOpenTab && (
                        <button
                          type="button"
                          onClick={() => onOpenTab(turn.answer!.open!.key)}
                          className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <OpenLabel label={turn.answer.open.label} />
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      {turn.answer?.refused && <p className="mt-2 text-xs text-muted-foreground">{turn.answer.refused}</p>}
                      {(turn.answer?.proposal || turn.answer?.filing) &&
                        (expanded ? (
                          <p className="mt-2 text-xs text-muted-foreground" data-testid="guide-prepared-pointer">
                            <Trans context="guide dock, points from the conversation to the Say yes list">Prepared for you. It waits under Say yes.</Trans>
                          </p>
                        ) : (
                          cardsOf(turn, i)
                        ))}
                      {/* Her advice prepares nothing, so it never joins the list of what waits on a yes: it stays with her words, in both shapes. */}
                      {turn.answer?.advice && <AdviceCard advice={turn.answer.advice} />}
                    </div>
                  ))}
                {busy === shown && (
                  <p className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    <Trans context="admin helper panel">{guide} is thinking</Trans>
                  </p>
                )}
                {errors[shown] && <p role="alert" className="text-sm text-destructive">{errors[shown]}</p>}
                <div ref={end} />
              </div>
            </div>

            {!gone[shown] && (
              <div className={`shrink-0 border-t border-border ${expanded ? "mx-auto w-full max-w-3xl" : ""}`}>
                {said && draft.trim() !== "" && (
                  <p data-testid="guide-you-said" className="line-clamp-3 break-words px-3 pt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground"><Trans context="guide dock, labels the words that were heard by voice">You said</Trans></span>{" "}
                    {said}
                  </p>
                )}
                {draft.trim() === "" && !busy && suggestions.length > 0 && (
                  <div
                    role="group"
                    aria-label={t({ message: "Suggested next steps", context: "guide dock, the suggestions above the talk box" })}
                    data-testid="guide-suggestions"
                    className="flex gap-2 overflow-x-auto px-3 pt-2 @min-[25rem]:flex-wrap @min-[25rem]:overflow-x-visible"
                  >
                    {suggestions.map((words) => (
                      <button
                        key={words}
                        type="button"
                        onClick={() => suggest(words)}
                        className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @min-[25rem]:shrink @min-[25rem]:whitespace-normal @min-[25rem]:text-left"
                      >
                        {words}
                      </button>
                    ))}
                  </div>
                )}
                <ChatComposer
                  id={`guide-dock-${shown}`}
                  className="p-3"
                  inputRef={input}
                  within={within}
                  value={draft}
                  onChange={onDraft}
                  onSend={() => void send()}
                  onSpoken={heard}
                  busy={busy !== null}
                  label={<Trans context="admin helper panel">Your question</Trans>}
                  placeholder={shown === "helper" ? t({ message: "How do I…", context: "admin helper, question box placeholder" }) : t`Ask about any step…`}
                  sendLabel={t({ message: "Send", context: "admin helper, sends the question" })}
                  sendClassName="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}
          </div>

          {expanded && shown === "helper" && (
            <section
              aria-label={t({ message: "Say yes", context: "guide dock, the list of what the guide prepared" })}
              data-testid="guide-say-yes"
              className={`order-first max-h-[35%] shrink-0 overflow-y-auto border-b border-border px-4 py-3 @min-[44rem]:order-none @min-[44rem]:max-h-none @min-[44rem]:w-[19rem] @min-[44rem]:border-b-0 @min-[44rem]:border-l @min-[64rem]:w-[24rem] ${preparedCount === 0 ? "hidden @min-[44rem]:block" : ""}`}
            >
              <h3 className="font-display text-base font-semibold text-foreground"><Trans context="guide dock, the list of what the guide prepared">Say yes</Trans></h3>
              <p className="text-xs text-muted-foreground">
                <Trans context="guide dock, under the Say yes heading">What {guide} has prepared. Each one waits on you, and nothing changes until you say so.</Trans>
              </p>
              {preparedCount === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground"><Trans context="guide dock, the Say yes list is empty">Nothing is waiting on you.</Trans></p>
              ) : (
                <div className="mt-1 space-y-2">
                  {prepared.map(({ turn, index }) => (
                    <div key={index}>{cardsOf(turn, index)}</div>
                  ))}
                  {fromBar.map((p) => (
                    <ProposalCard key={proposalMarkOf(p)} proposal={p} state="waiting" onReview={() => onReview?.(p)} onUnreview={() => onUnreview?.(p)} onDrop={() => onUnreview?.(p)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* The one place a finished reply is announced: once, whole. The conversation above is not a live region. */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="guide-announce">
        {announce}
      </p>
    </aside>
  );
}
