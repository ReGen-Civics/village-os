/**
 * CHANGE REQUESTS, AS A KIND OF DECISION (the lead, 27 Nov 2026: "Change Requests become a kind of decision under
 * Decisions"). The Change requests section of /governance/decisions (`#changes`), which was the /changes list page.
 *
 *   - In review across the village: other members' change requests in review, each a door to the page where you take
 *     part.
 *   - Yours: what you started, with the step each one stands on.
 *   - Start one: a name and a why, behind one button, so the section reads as a list first.
 *
 * One panel with a display heading and its count, and each list a quest log: a row with its step in a chip, its
 * title, one line saying where it stands, and an arrow to its own page (the profile's YourQuests rows).
 *
 * Every rule is the server's, unchanged: `GET /api/change-requests` answers anyone signed in (the reader's own, and
 * everyone's in review or in a vote), and starting one asks `mechanics.propose` through the one gate, so a member who
 * may not start one is told so by the route in its own words. Each row opens `/governance/decisions/changes/:id`.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { ArrowRight } from "lucide-react";
import VoiceArea from "@/components/voice/VoiceArea";
import { headers, refusal, type ChangeRequestSummary } from "@/components/governance/changeRequestClient";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, FIELD, H2, HINT, LABEL, TILE } from "@/components/journey/look";
import { changeRequestHref } from "@shared/changeRequestAddress";

type State = ChangeRequestSummary["state"];

const STEP_WORDS: Record<State, MessageDescriptor> = {
  gathering: msg({ message: "Gathering", context: "change request step" }),
  in_review: msg({ message: "In review", context: "change request step" }),
  voting: msg({ message: "In the vote", context: "change request step" }),
  closed: msg({ message: "Decided", context: "change request step" }),
};

const field = `${FIELD} mt-1 block min-h-11 text-base`;

/** The quest log's row (the profile's YourQuests): a door to the thing's own page, the arrow in gold. */
const ROW =
  "group flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-foreground no-underline hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Row({ c }: { c: ChangeRequestSummary }) {
  const { t, i18n } = useLingui();
  const step = STEP_WORDS[c.state] ? i18n._(STEP_WORDS[c.state]) : "";
  const author = c.author;
  const who = c.yours ? t({ message: "Yours", context: "a change request you started" }) : t({ message: `Started by ${author}`, context: "who started a change request" });
  const when = i18n.date(new Date(c.updatedAt), { day: "numeric", month: "short" });
  const live = c.state === "in_review" || c.state === "voting";
  return (
    <li>
      <Link href={changeRequestHref(c.id)} className={ROW} data-testid={`cr-row-${c.id}`}>
        <span className="min-w-0 space-y-1">
          {step ? <span className={`${CHIP_SOFT} ${live ? "border-notice/60 text-notice" : ""}`}>{step}</span> : null}
          <span className="block break-words font-semibold text-foreground">{c.title}</span>
          <span className="block text-sm text-muted-foreground">
            <Plural value={c.changes} one="# change" other="# changes" /> · {who} · {when}
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-notice motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function ChangeRequestsSection() {
  const { t } = useLingui();
  const [mine, setMine] = useState<ChangeRequestSummary[] | null>(null);
  const [open, setOpen] = useState<ChangeRequestSummary[]>([]);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    fetch("/api/change-requests", { headers: headers() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        setMine(Array.isArray(b?.mine) ? b.mine : []);
        setOpen(Array.isArray(b?.open) ? b.open : []);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/change-requests", { method: "POST", headers: headers(), body: JSON.stringify({ title, why }) }).catch(() => null);
    setBusy(false);
    if (!res) return setError(t`That did not go through. Try again in a moment.`);
    if (!res.ok) return setError(await refusal(res, t`That change request could not be started.`));
    const { id } = await res.json();
    window.location.assign(changeRequestHref(String(id)));
  };

  // Every change request the reader can open from here, theirs and everyone's in review, counted once.
  const count = mine === null ? null : new Set([...mine, ...open].map((c) => c.id)).size;

  return (
    <section id="changes" aria-labelledby="cr-heading" className={`${CARD} scroll-mt-24 space-y-5`} data-testid="change-requests">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={EYEBROW}>
            <Trans context="decisions: the change requests section, eyebrow">Read before a vote</Trans>
          </p>
          <h2 id="cr-heading" className={`${H2} mt-1`}>
            <Trans context="decisions: the change requests section">Change requests</Trans>
            {count !== null ? <span className="ml-2 text-lg font-normal text-muted-foreground">({count})</span> : null}
          </h2>
          <p className={`${HINT} mt-1`}>
            <Trans context="decisions: the change requests section">Several setting changes, one reason, one vote. The village reads each one before it goes to the vote.</Trans>
          </p>
        </div>
        <button type="button" className={BTN_SECONDARY} aria-expanded={starting} aria-controls="cr-start" onClick={() => setStarting((s) => !s)}>
          <Trans context="heading on the change requests page">Start a change request</Trans>
        </button>
      </div>

      {starting && (
        <form
          id="cr-start"
          className={`${TILE} space-y-3`}
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <p className={HINT}>
            <Trans>Give it a name and say why. Then add the changes, from here or from any setting with a Suggest button.</Trans>
          </p>
          <label className={`${LABEL} block`}>
            <Trans context="the name of a change request">Name</Trans>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} />
          </label>
          <label className={`${LABEL} block`}>
            <Trans context="the reason for a change request">Why</Trans>
            <VoiceArea value={why} onValue={setWhy}>
              <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={4000} rows={3} className={`${field} py-2`} />
            </VoiceArea>
          </label>
          <button type="submit" className={BTN_PRIMARY} disabled={busy || !title.trim() || !why.trim()}>
            {busy ? t({ message: "Starting…", context: "starting a change request" }) : t({ message: "Start it", context: "start a change request" })}
          </button>
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      )}

      {failed ? (
        <div className={`${TILE} space-y-2`} role="alert">
          <p className="text-sm text-foreground">
            <Trans context="decisions: the change requests section">The change requests did not load. Some may be waiting for your voice.</Trans>
          </p>
          <button type="button" onClick={load} className={BTN_SECONDARY}>
            <Trans context="retry a failed read">Try again</Trans>
          </button>
        </div>
      ) : mine === null ? (
        <p className={HINT} role="status">
          <Trans context="decisions: the change requests section">Reading the change requests.</Trans>
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className={EYEBROW}>
              <Trans context="heading on the change requests page">In review across the village</Trans>
            </h3>
            {open.length === 0 ? (
              <p className={HINT}>
                <Trans>Nothing is being weighed right now.</Trans>
              </p>
            ) : (
              <ul className="space-y-2">{open.map((c) => <Row key={c.id} c={c} />)}</ul>
            )}
          </div>
          <div className="space-y-2">
            <h3 className={EYEBROW}>
              <Trans context="heading on the change requests page">Your change requests</Trans>
            </h3>
            {mine.length === 0 ? (
              <p className={HINT}>
                <Trans>You have none yet. Gather several changes here and the village votes on them together.</Trans>
              </p>
            ) : (
              <ul className="space-y-2">{mine.map((c) => <Row key={c.id} c={c} />)}</ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
