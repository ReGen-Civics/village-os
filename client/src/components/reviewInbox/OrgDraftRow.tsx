/**
 * AN ORG CHART DRAFT, DECIDED ON ITS ROW (lane 4c; the lead, 25 Nov 2026: "I can't even find where to publish").
 *
 * The row shows what the draft would do, line by line, and the one decision this person may make, read from the
 * draft's own decide answer (`GET /api/org/drafts/:id/decide`), never worked out here:
 *   - Publish: a live holder of the power (publish-by-power), or an admin before the village has launched by vote (the
 *     admin panel's publish). The publish names the changes the person read (`expectedChanges`), so a draft that
 *     gained a change since it was drawn is refused, not published.
 *   - Put it to the village: whoever the server says may open the vote, when they may not publish it themselves.
 *   - Anybody else, and a draft under a vote: the door to read it where it lives.
 * Both POSTs are the doors /review/structure and the role cards already use (client/src/components/review).
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP_SOFT, DOOR, HINT, LINK, QUIET } from "@/components/journey/look";
import { authToken } from "@/lib/gameApi";
import type { InboxItem } from "@shared/reviewInbox";
import { sourceText } from "./sourceWords";

interface DecideAnswer {
  status: string;
  changes: number;
  blocked: number;
  blockedLines: { reads: string; blocked: string }[];
  youMayPublish: boolean;
  adminMayPublish: boolean;
  youMayPutToVillage: boolean;
  ballot: { id: string; closesAt: string | null } | null;
}

interface Line {
  changeId: string;
  reads: string;
  blocked: string | null;
}

function headers(): Record<string, string> {
  const t = authToken();
  return { "content-type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

const draftIdOf = (item: InboxItem) => item.key.slice(item.key.indexOf(":") + 1);

export default function OrgDraftRow({ item, onDone }: { item: InboxItem; onDone: (said: string) => void }) {
  const { t, i18n } = useLingui();
  const id = draftIdOf(item);
  const [answer, setAnswer] = useState<DecideAnswer | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [step, setStep] = useState<"idle" | "publish" | "put" | "busy">("idle");
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  const read = useCallback(async () => {
    const enc = encodeURIComponent(id);
    const [d, p] = await Promise.all([
      fetch(`/api/org/drafts/${enc}/decide`, { headers: headers() }).catch(() => null),
      // The lines are the admin panel's preview; a person who may not read it still gets the decision and the door.
      fetch(`/api/admin/org/drafts/${enc}/preview`, { headers: headers() }).catch(() => null),
    ]);
    setAnswer(d && d.ok ? ((await d.json()) as DecideAnswer) : null);
    setLines(p && p.ok ? (((await p.json()) as { lines?: Line[] }).lines ?? []) : null);
  }, [id]);
  useEffect(() => {
    void read();
  }, [read]);

  const failed = t({ context: "review inbox: an org chart draft", message: "That did not go through. Reload and try again." });
  const post = async (path: string, body: unknown, done: string) => {
    setStep("busy");
    try {
      const r = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      const out = (await r.json().catch(() => null)) as { message?: string; error?: string } | null;
      setSaid(r.ok ? { ok: true, text: done } : { ok: false, text: String(out?.message ?? out?.error ?? failed) });
      if (r.ok) onDone(done);
      await read();
    } catch {
      setSaid({ ok: false, text: failed });
    } finally {
      setStep("idle");
    }
  };

  const words = sourceText("structure", i18n);
  const open = answer?.status === "open";
  const mayPublish = !!answer && open && !answer.ballot && answer.blocked === 0 && answer.changes > 0 && (answer.youMayPublish || answer.adminMayPublish);
  const mayPut = !!answer && open && !answer.ballot && !mayPublish && answer.youMayPutToVillage;
  const n = answer?.changes ?? lines?.length ?? 0;
  const closes = answer?.ballot?.closesAt ? i18n.date(new Date(answer.ballot.closesAt), { day: "numeric", month: "short" }) : null;
  const shown = lines ?? (answer?.blockedLines ?? []).map((l, i) => ({ changeId: String(i), reads: l.reads, blocked: l.blocked }));

  return (
    <li className={`${QUIET} space-y-3`} data-testid={`row-${item.key}`}>
      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={CHIP_SOFT}>{words.what}</span>
          {answer ? (
            <span className={HINT}>
              <Plural context="review inbox: an org chart draft" value={n} one="# change" other="# changes" />
            </span>
          ) : null}
        </p>
        <p className="text-base text-foreground">{item.summary}</p>
        <p className="text-sm text-foreground">{words.does}</p>
      </div>

      {shown.length ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            <Trans context="review inbox: an org chart draft">What it does</Trans>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground" data-testid={`draft-lines-${id}`}>
            {shown.map((l) => (
              <li key={l.changeId}>
                {l.reads}
                {l.blocked ? <span className="block text-destructive">{l.blocked}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {answer?.ballot ? (
        <p className={HINT}>
          {closes ? (
            <Trans context="review inbox: an org chart draft">The village is voting on this draft. The vote closes {closes}.</Trans>
          ) : (
            <Trans context="review inbox: an org chart draft">The village is voting on this draft.</Trans>
          )}
        </p>
      ) : null}
      {answer && answer.blocked > 0 ? (
        <p className="text-sm text-destructive">
          <Trans context="review inbox: an org chart draft">Something in it cannot be applied as the village stands, so it cannot be published yet.</Trans>
        </p>
      ) : null}

      {step === "publish" || step === "put" ? (
        <div className="space-y-3 rounded-xl border border-notice/60 bg-card p-4" role="group" aria-label={t({ context: "review inbox: an org chart draft", message: "Confirm" })}>
          <p className="font-semibold text-card-foreground">
            {step === "publish" ? (
              <Plural context="review inbox: an org chart draft" value={n} one="Publish this draft? Its one change goes onto the org chart now." other="Publish this draft? Its # changes go onto the org chart now." />
            ) : (
              <Trans context="review inbox: an org chart draft">Put this draft to the village? A vote opens, and the village decides it.</Trans>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              data-testid={`draft-yes-${id}`}
              onClick={() => {
                const enc = encodeURIComponent(id);
                if (step === "publish") {
                  const path = answer!.youMayPublish ? `/api/org/drafts/${enc}/publish-by-power` : `/api/admin/org/drafts/${enc}/publish`;
                  void post(path, lines ? { expectedChanges: lines.map((l) => l.changeId) } : {}, t({ context: "review inbox: an org chart draft", message: "Published. The org chart has changed." }));
                } else void post(`/api/org/drafts/${enc}/put-to-village`, {}, t({ context: "review inbox: an org chart draft", message: "Put to the village. A vote is open." }));
              }}
            >
              {step === "publish" ? <Trans context="review inbox: an org chart draft">Yes, publish it</Trans> : <Trans context="review inbox: an org chart draft">Yes, open the vote</Trans>}
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setStep("idle")}>
              <Trans context="review inbox: an org chart draft">Not yet</Trans>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {mayPublish ? (
            <button type="button" className={BTN_PRIMARY} disabled={step === "busy"} onClick={() => setStep("publish")} data-testid={`draft-publish-${id}`}>
              <Trans context="review inbox: an org chart draft">Publish</Trans>
            </button>
          ) : null}
          {mayPut ? (
            <button type="button" className={BTN_PRIMARY} disabled={step === "busy"} onClick={() => setStep("put")} data-testid={`draft-put-${id}`}>
              <Trans context="review inbox: an org chart draft">Put it to the village</Trans>
            </button>
          ) : null}
          {mayPublish || mayPut ? (
            <Link href={item.decideAt} className={`${LINK} inline-flex min-h-11 items-center text-sm`}>
              {words.door}
            </Link>
          ) : (
            <Link href={item.decideAt} className={`${DOOR} whitespace-nowrap`}>
              {words.door}
            </Link>
          )}
        </div>
      )}

      {said ? (
        <p role={said.ok ? "status" : "alert"} className={said.ok ? "text-sm text-foreground" : "text-sm text-destructive"} data-testid={`draft-said-${id}`}>
          {said.text}
        </p>
      ) : null}
    </li>
  );
}
