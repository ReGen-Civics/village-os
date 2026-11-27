/**
 * THE DRAFT PAGE, /governance/decisions/drafts/:draftId (the lead, 26 Nov 2026: "when I click on 'read the draft' it
 * doesn't take me to a draft of this card, it should with a clear before and after changes ... and ability to edit").
 *
 * One stable address per org chart draft, linked from the review row, Your work, the Find box and the notice. It says
 * in plain words what the draft changes, who proposed it and from where, where it stands, who must still act and what
 * publishing does; then each change, before and after, field by field; then the acts the server's decide answer
 * allows. Reads and acts are in `useDraftPage`; the pieces are in components/orgDraft, so a later visual layer
 * restyles them without touching either.
 */
import { useState } from "react";
import { Link, useParams } from "wouter";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, H2, HINT, LINK, NOTE, QUIET } from "@/components/journey/look";
import DraftChangeCard from "@/components/orgDraft/DraftChangeCard";
import FieldDiff, { useFieldLabel } from "@/components/orgDraft/FieldDiff";
import { useDraftPage, type DecideAnswer, type Said } from "@/components/orgDraft/useDraftPage";
import { draftPageHref, type DraftView } from "@shared/orgDraftView";

function StateChip({ view, decide }: { view: DraftView; decide: DecideAnswer | null }) {
  const blocked = view.changes.some((c) => c.blocked);
  const notice = "inline-flex items-center rounded-full border border-notice/70 px-3 py-1 text-xs font-semibold text-notice";
  if (view.status === "published") return <span className={CHIP_SOFT}><Trans context="draft page: state">Published</Trans></span>;
  if (view.status === "withdrawn") return <span className={CHIP_SOFT}><Trans context="draft page: state">Withdrawn</Trans></span>;
  if (view.status === "reverted") return <span className={CHIP_SOFT}><Trans context="draft page: state">Put back</Trans></span>;
  if (decide?.ballot) return <span className={notice}><Trans context="draft page: state">Under a village vote</Trans></span>;
  if (blocked) return <span className={notice}><Trans context="draft page: state">Cannot be published yet</Trans></span>;
  return <span className={notice}><Trans context="draft page: state">Waiting for a decision</Trans></span>;
}

/** Where the draft came from, in words. */
function Source({ view }: { view: DraftView }) {
  const sera = view.source.moduleId === "saberra";
  if (view.source.kind === "human") {
    return view.source.fromProposal ? (
      <Trans context="draft page: where it came from">A person accepted waiting proposals into this draft.</Trans>
    ) : (
      <Trans context="draft page: where it came from">A person made it in the role editor or the org chart.</Trans>
    );
  }
  return sera ? (
    <Trans context="draft page: where it came from">Sera suggested it. A person reads it before anything changes.</Trans>
  ) : (
    <Trans context="draft page: where it came from">An agent proposed it. A person reads it before anything changes.</Trans>
  );
}

function WhoActs({ decide }: { decide: DecideAnswer | null }) {
  if (!decide) return <Trans context="draft page: who must act">Whoever holds the power to change the org chart.</Trans>;
  if (decide.ballot) return <Trans context="draft page: who must act">The village, in the vote that is open now.</Trans>;
  if (decide.youMayPublish || decide.adminMayPublish) return <Trans context="draft page: who must act">You may publish it. A village vote is the other way.</Trans>;
  if (decide.ballotNeeded) return <Trans context="draft page: who must act">Nobody holds the power to change the org chart, so a village vote decides it.</Trans>;
  return (
    <Plural
      context="draft page: who must act"
      value={decide.holderCount}
      one="The one person who holds the power to change the org chart, or a village vote."
      other="One of the # people who hold the power to change the org chart, or a village vote."
    />
  );
}

function Proposer({ view }: { view: DraftView }) {
  const p = view.proposer;
  if (!p && view.source.kind !== "human") return <span className="font-display text-lg font-bold text-foreground">{view.source.moduleId === "saberra" ? "Sera" : <Trans context="draft page: who proposed it">An agent</Trans>}</span>;
  if (!p) return <Trans context="draft page">Not recorded</Trans>;
  return (
    <span>
      {p.roles.length ? <span className="font-display text-lg font-bold text-foreground">{p.roles.join(", ")}</span> : null}
      {p.firstName ? <span className={p.roles.length ? "ml-2 text-muted-foreground" : "text-foreground"}>{p.firstName}</span> : null}
    </span>
  );
}

function Revisions({ view }: { view: DraftView }) {
  const { i18n } = useLingui();
  const label = useFieldLabel();
  const made = view.createdAt ? i18n.date(new Date(view.createdAt), { day: "numeric", month: "short" }) : null;
  return (
    <section className={`${CARD} space-y-3`} aria-labelledby="draft-revisions">
      <h2 id="draft-revisions" className={H2}>
        <Trans context="draft page">Revisions</Trans>
      </h2>
      <ol className="space-y-3">
        {[...view.revisions].reverse().map((r) => (
          <li key={r.number} className="space-y-2 border-t border-border pt-3">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{r.number}</span>
              {r.at ? <span className="text-muted-foreground"> · {i18n.date(new Date(r.at), { day: "numeric", month: "short" })}</span> : null}
              {r.by ? <span className="text-muted-foreground"> · {[...r.by.roles, r.by.firstName].filter(Boolean).join(", ")}</span> : null}
            </p>
            {r.note ? <p className="text-sm italic text-foreground">"{r.note}"</p> : null}
            {r.leftOut ? (
              <p className={HINT}>
                <Trans context="draft page: a revision">Left out: {r.leftOut}</Trans>
              </p>
            ) : (
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-notice">
                  <Trans context="draft page: a revision">What changed: {r.fields.map((f) => label(f.field, f.label)).join(", ")}</Trans>
                </summary>
                <div className="space-y-3 pt-2">
                  {r.fields.map((f) => (
                    <FieldDiff key={f.field} field={f} />
                  ))}
                </div>
              </details>
            )}
          </li>
        ))}
        <li className="border-t border-border pt-3 text-sm text-foreground">
          <span className="font-semibold">1</span>
          {made ? <span className="text-muted-foreground"> · {made}</span> : null}
          <span className="text-muted-foreground">
            {" · "}
            <Trans context="draft page: a revision">The draft as it was made</Trans>
          </span>
        </li>
      </ol>
    </section>
  );
}

function Actions({ view, decide, acts, onSaid }: { view: DraftView; decide: DecideAnswer | null; acts: ReturnType<typeof useDraftPage>["acts"]; onSaid: (s: Said) => void }) {
  const { t } = useLingui();
  const [step, setStep] = useState<"idle" | "publish" | "put" | "withdraw" | "busy">("idle");
  const [copied, setCopied] = useState(false);
  const open = view.status === "open";
  const blocked = view.changes.some((c) => c.blocked);
  const mayPublish = open && !!decide && (decide.youMayPublish || decide.adminMayPublish);
  const mayPut = open && !!decide && decide.youMayPutToVillage && !mayPublish;
  const mayWithdraw = open && !!decide?.youMayWithdraw;
  const n = view.changeIds.length;
  const run = async (p: Promise<{ ok: boolean; message: string | null }>, done: string) => {
    setStep("busy");
    const r = await p;
    setStep("idle");
    onSaid(r.ok ? { ok: true, text: done } : { ok: false, text: r.message ?? t({ context: "draft page", message: "That did not go through. Reload and try again." }) });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + draftPageHref(view.id));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
      {step === "publish" || step === "put" || step === "withdraw" ? (
        <div className="space-y-3" role="group" aria-label={t({ context: "draft page", message: "Confirm" })}>
          <p className="font-semibold text-foreground">
            {step === "withdraw" ? (
              <Trans context="draft page">Withdraw this draft? It is kept on record, and it can no longer be published. Nothing on the org chart changes.</Trans>
            ) : step === "publish" ? (
              <Plural context="draft page" value={n} one="Publish this draft? Its one change goes onto the org chart now." other="Publish this draft? Its # changes go onto the org chart now." />
            ) : (
              <Trans context="draft page">Put this draft to the village? A vote opens, and the village decides it.</Trans>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              data-testid="draft-confirm"
              onClick={() => {
                if (step === "withdraw") void run(acts.withdraw(), t({ context: "draft page", message: "Withdrawn. It can no longer be published." }));
                else if (step === "publish") void run(acts.publish(!!decide?.youMayPublish, view.changeIds), t({ context: "draft page", message: "Published. The org chart has changed." }));
                else void run(acts.putToVillage(), t({ context: "draft page", message: "Put to the village. A vote is open." }));
              }}
            >
              {step === "withdraw" ? <Trans context="draft page">Yes, withdraw it</Trans> : step === "publish" ? <Trans context="draft page">Yes, publish it</Trans> : <Trans context="draft page">Yes, open the vote</Trans>}
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setStep("idle")}>
              <Trans context="draft page">Not yet</Trans>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {mayPublish ? (
            <button type="button" className={BTN_PRIMARY} disabled={step === "busy" || blocked} onClick={() => setStep("publish")} data-testid="draft-publish">
              <Trans context="draft page">Publish</Trans>
            </button>
          ) : null}
          {mayPut ? (
            <button type="button" className={BTN_PRIMARY} disabled={step === "busy" || blocked} onClick={() => setStep("put")} data-testid="draft-put">
              <Trans context="draft page">Put it to the village</Trans>
            </button>
          ) : null}
          {mayWithdraw ? (
            <button type="button" className={BTN_SECONDARY} disabled={step === "busy"} onClick={() => setStep("withdraw")} data-testid="draft-withdraw">
              <Trans context="draft page">Withdraw</Trans>
            </button>
          ) : null}
          <button type="button" className={BTN_SECONDARY} onClick={() => void copy()}>
            {copied ? <Trans context="draft page">Link copied</Trans> : <Trans context="draft page">Copy link</Trans>}
          </button>
          {blocked && (mayPublish || mayPut) ? (
            <p className={HINT}>
              <Trans context="draft page">Publishing waits until every change can be applied. Fix or leave out the ones marked above.</Trans>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function OrgDraft() {
  const { draftId = "" } = useParams<{ draftId: string }>();
  const { load, acts } = useDraftPage(draftId);
  const { i18n, t } = useLingui();
  const [said, setSaid] = useState<Said | null>(null);

  let body: React.ReactNode;
  if (load.phase === "loading") {
    body = (
      <p className={NOTE} role="status">
        <Trans context="draft page">Reading the draft…</Trans>
      </p>
    );
  } else if (load.phase === "signedOut") {
    body = (
      <p className={NOTE}>
        <Trans context="draft page">Sign in to read this draft.</Trans>{" "}
        <Link href="/login" className={LINK}>
          <Trans context="draft page">Sign in</Trans>
        </Link>
      </p>
    );
  } else if (load.phase === "missing") {
    body = (
      <p className={NOTE}>
        <Trans context="draft page">There is no draft at this address that you can read. Drafts are read by whoever may decide the org chart and by the person who made them.</Trans>
      </p>
    );
  } else if (load.phase === "failed") {
    body = (
      <p className={NOTE} role="alert">
        <Trans context="draft page">This draft did not load. Reload the page to try again.</Trans>
      </p>
    );
  } else {
    const { view, decide } = load;
    const made = view.createdAt ? i18n.date(new Date(view.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;
    const others = view.otherOpenDrafts;
    const moved = view.changes.some((c) => c.fields.some((f) => f.moved));
    const unknownBase = view.status === "open" && view.changes.some((c) => c.kind === "edit" && !c.baseKnown);
    const last = view.changes.length <= 1;
    body = (
      <div className="space-y-6" data-testid="org-draft">
        <header className="space-y-3">
          <p className="flex flex-wrap items-center gap-2">
            <StateChip view={view} decide={decide} />
            <span className={CHIP_SOFT}>
              <Plural context="draft page" value={view.changeIds.length} one="One change" other="# changes" />
            </span>
          </p>
          <h1 className="font-display text-3xl leading-tight text-foreground sm:text-4xl">{view.title}</h1>
          {view.rationale ? <p className={NOTE}>{view.rationale}</p> : null}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-base sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">
              <Trans context="draft page: the header">Proposed by</Trans>
            </dt>
            <dd className="m-0">
              <Proposer view={view} />
              {made ? <span className="text-muted-foreground"> · {made}</span> : null}
            </dd>
            <dt className="text-muted-foreground">
              <Trans context="draft page: the header">Came from</Trans>
            </dt>
            <dd className="m-0 text-foreground">
              <Source view={view} />
            </dd>
            {view.status === "open" ? (
              <>
                <dt className="text-muted-foreground">
                  <Trans context="draft page: the header">Who must act</Trans>
                </dt>
                <dd className="m-0 text-foreground">
                  <WhoActs decide={decide} />
                </dd>
                <dt className="text-muted-foreground">
                  <Trans context="draft page: the header">Publishing</Trans>
                </dt>
                <dd className="m-0 text-foreground">
                  <Trans context="draft page: the header">Writes every change below onto the org chart at once, or none of them. A role card's history keeps the old words, so a change can be put back.</Trans>
                </dd>
              </>
            ) : null}
          </dl>
        </header>

        {moved ? (
          <div className="rounded-xl border-2 border-notice/70 p-4" role="alert">
            <p className="font-semibold text-foreground">
              <Trans context="draft page">The live card changed after this draft was written.</Trans>
            </p>
            <p className={NOTE}>
              <Trans context="draft page">Each field where that happened is marked below with what changed. Read them before publishing, so nothing newer is written over.</Trans>
            </p>
          </div>
        ) : null}
        {unknownBase ? (
          <p className={HINT}>
            <Trans context="draft page">This draft was written before drafts kept the card they were written against, so "Before" is the card as it stands now.</Trans>
          </p>
        ) : null}
        {others.length ? (
          <div className={QUIET}>
            <p className="text-base text-foreground">
              <Plural context="draft page" value={others.length} one="Another open draft changes the same role or circle:" other="# other open drafts change the same role or circle:" />
            </p>
            <ul className="mt-1 space-y-1">
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={draftPageHref(o.id)} className={LINK}>
                    {o.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <section aria-labelledby="draft-changes" className="space-y-3">
          <h2 id="draft-changes" className={H2}>
            <Trans context="draft page">What changes</Trans>
          </h2>
          <ul className="space-y-4">
            {view.changes.map((c) => (
              <DraftChangeCard key={c.id} change={c} mayEdit={view.mayEdit} last={last} acts={acts} onSaid={(text) => setSaid({ ok: true, text })} />
            ))}
          </ul>
        </section>

        {said ? (
          <p role={said.ok ? "status" : "alert"} className={said.ok ? "text-base text-foreground" : "text-base text-destructive"} data-testid="draft-said">
            {said.text}
          </p>
        ) : null}

        {view.revisions.length ? <Revisions view={view} /> : null}

        <Actions view={view} decide={decide} acts={acts} onSaid={setSaid} />
      </div>
    );
  }

  return (
    <Layout>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-10">
        <nav aria-label={t({ context: "draft page: the way back, read aloud", message: "Where you are" })} className="text-sm text-muted-foreground">
          <Link href="/admin/review" className={LINK}>
            <Trans context="draft page: the way back">Review</Trans>
          </Link>
          <span aria-hidden="true"> › </span>
          <Trans context="draft page: the way back">Org chart draft</Trans>
        </nav>
        {body}
      </main>
    </Layout>
  );
}
