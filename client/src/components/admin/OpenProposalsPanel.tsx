/**
 * ROLE PROPOSALS FROM PEOPLE WITH NO ACCOUNT, the desk side (sheet 19i):
 * the public link's switch, links made for one person, and the proposals
 * that have been confirmed. Server: server/routes/openProposals.ts.
 *
 * A link's address is shown once, when it is made: only its hash is kept.
 * Unconfirmed proposals never show here, because nothing unconfirmed reaches
 * a person. Each confirmed proposal opens its members' page, where the circle
 * answers and a holder of the power that seats people adopts or declines it
 * (open proposals part B, client/src/pages/OpenProposal.tsx).
 */
import { useLingui } from "@lingui/react/macro";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Copy, Link2 } from "lucide-react";
import { API_BASE, authHeaders } from "@/components/admin/adminApi";
import { OPEN_WORDS } from "@shared/openProposals";
import { PlayVoice, StoredWordsSlot, type ServedClip, type ServedVoice } from "@/components/voice/VoiceHeard";
import { STORED_TRANSCRIBE_WORDS } from "@shared/voiceTranscribe";

interface DeskLink {
  id: string;
  label: string;
  createdAt: string;
  on: boolean;
}

interface DeskProposal {
  id: string;
  name: string | null;
  email: string | null;
  via: string | null;
  roles: Array<{ roleId: string; name: string | null; note: string }>;
  why: string;
  aim: string;
  confirmedAt: string | null;
  /** Kept although our confirmation email failed: the words to show beside it, or null. */
  addressUnconfirmed?: string | null;
  /** Their voice, kept with their tick (shared/voiceNotes.ts): the main recordings and the clips beside answers, played here. */
  voice?: ServedVoice | null;
}

interface Desk {
  publicLink: boolean;
  /** What public proposals are for: next season (default) or this moon. */
  term?: "season" | "moon";
  publicPath: string;
  links: DeskLink[];
  proposals: DeskProposal[];
  /** Whether a kept recording can be written down now (shared/voiceTranscribe.ts). */
  transcribeOn?: boolean;
}

/** Recordings and clips on the desk with no AI transcript yet. */
export function waitingCount(proposals: readonly DeskProposal[]): number {
  return proposals.reduce((n, p) => n + [...(p.voice?.notes ?? []), ...(p.voice?.clips ?? [])].filter((r) => !p.voice?.written?.[r.id]).length, 0);
}

const BUTTON = "inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-deep/40";

const copy = (text: string) => {
  void navigator.clipboard?.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy. Select the address and copy it yourself."),
  );
};

/** The clip beside one answer, when they recorded one. */
const clipOf = (p: DeskProposal, field: string): ServedClip | undefined => p.voice?.clips?.find((c) => c.field === field);
/** The clips beside answers this panel does not show (everything but why and aim), listed under their voice. */
const otherClips = (p: DeskProposal): ServedClip[] => (p.voice?.clips ?? []).filter((c) => c.field !== "why" && c.field !== "aim");

export default function OpenProposalsPanel({ password }: { password: string }) {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [label, setLabel] = useState("");
  const [made, setMade] = useState<{ label: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useLingui();

  /** A recording through the admin door, with this desk's own sign-in (server/routes/openProposals.ts). */
  const hear = useCallback((href: string) => fetch(href, { headers: authHeaders(password) }), [password]);
  /** "Write down the words" through the admin door, with the same sign-in. */
  const writeDown = useCallback(
    (id: string, noteId: string) => fetch(`${API_BASE}/admin/open-proposals/${encodeURIComponent(id)}/voice/${encodeURIComponent(noteId)}/transcribe`, { method: "POST", headers: authHeaders(password) }),
    [password],
  );
  const [running, setRunning] = useState(false);
  const call = useCallback(
    async (url: string, method = "GET", body?: unknown) => {
      const res = await fetch(url, {
        method,
        headers: authHeaders(password, body === undefined ? {} : { "Content-Type": "application/json" }),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "That did not work. Try again.");
      return data;
    },
    [password],
  );

  const load = useCallback(() => {
    call(`${API_BASE}/admin/open-proposals`)
      // Anything but the desk's own shape draws nothing, never a broken Submissions tab.
      .then((d) => setDesk(d && typeof d === "object" && Array.isArray(d.links) && Array.isArray(d.proposals) ? (d as Desk) : null))
      .catch(() => setDesk(null));
  }, [call]);

  useEffect(load, [load]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      const d = await fn();
      if (typeof d?.message === "string") toast.success(d.message);
      load();
      return d;
    } catch (e: any) {
      toast.error(e?.message ?? "That did not work. Try again.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  /*
   * "Transcribe all waiting" (the lead, 17 Nov 2026): one run on the server,
   * one recording after another. The desk reloads every few seconds while it
   * runs, so each transcript shows as it lands.
   */
  const transcribeAll = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API_BASE}/admin/open-proposals/voice/transcribe-waiting`, { method: "POST", headers: authHeaders(password) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) throw new Error(typeof d?.error === "string" ? d.error : STORED_TRANSCRIBE_WORDS.unavailable);
      if (res.status === 409) toast(typeof d?.error === "string" ? d.error : STORED_TRANSCRIBE_WORDS.running);
      else toast.success(t({ message: `Writing down ${Number(d?.started) || 0} recordings. Each appears here as it finishes.`, context: "admin open proposals" }));
      for (let i = 0; i < 60; i += 1) {
        await new Promise((r) => setTimeout(r, 6000));
        load();
        if (i * 6 >= (Number(d?.started) || 1) * 120) break;
      }
    } catch (e: any) {
      toast.error(e?.message ?? STORED_TRANSCRIBE_WORDS.unavailable);
    } finally {
      setRunning(false);
    }
  };

  if (!desk) return null;
  const waiting = waitingCount(desk.proposals);
  const publicUrl = `${window.location.origin}${desk.publicPath}`;

  return (
    // Open whenever an application waits, so none is folded out of sight (Rye, 16 Nov 2026: Graham's was missed here).
    <details open={desk.proposals.length > 0} className="mb-6 rounded-xl border border-gray-200 bg-white p-4" data-open-proposals-desk="">
      <summary className="flex min-h-10 cursor-pointer items-center gap-2 font-semibold text-gray-900">
        <Link2 className="h-4 w-4" aria-hidden="true" />
        Role applications from people with no account
        {desk.proposals.length > 0 && <span className="rounded-full bg-teal-deep px-2 py-0.5 text-xs text-white">{desk.proposals.length}</span>}
      </summary>

      <div className="mt-4 grid gap-5">
        <section className="grid gap-2">
          <label className="flex min-h-10 items-center gap-3 text-sm text-gray-800">
            <input
              type="checkbox"
              className="size-5 accent-teal-deep"
              checked={desk.publicLink}
              disabled={busy}
              onChange={(e) => void act(() => call(`${API_BASE}/admin/open-proposals/settings`, "PUT", { publicLink: e.target.checked }))}
            />
            The public link is on: anyone with it can propose
          </label>
          {/* What public proposals are for (Rye, 9 Nov 2026): next season, or this moon (shared/openProposalTerm.ts). */}
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground">
            <legend className="sr-only">{t({ message: "Public proposals are for", context: "open proposals desk term" })}</legend>
            <span className="font-medium">{t({ message: "Proposals are for:", context: "open proposals desk term" })}</span>
            {(["season", "moon"] as const).map((m) => (
              <label key={m} className="inline-flex min-h-10 items-center gap-2">
                <input
                  type="radio"
                  name="open-proposals-term"
                  className="size-4 accent-teal-deep"
                  checked={(desk.term ?? "season") === m}
                  disabled={busy}
                  onChange={() => void act(() => call(`${API_BASE}/admin/open-proposals/settings`, "PUT", { term: m }))}
                />
                {m === "season"
                  ? t({ message: "next season", context: "open proposals desk term" })
                  : t({ message: "this moon (from its new moon to the next)", context: "open proposals desk term" })}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded bg-gray-50 px-2 py-1 text-sm text-gray-800">{publicUrl}</code>
            <button type="button" className={BUTTON} onClick={() => copy(publicUrl)}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy
            </button>
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-gray-900">A link for one person</h3>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!label.trim()) return;
              void act(() => call(`${API_BASE}/admin/open-proposals/links`, "POST", { label })).then((d) => {
                if (d?.url) {
                  setMade({ label: d.label, url: d.url });
                  setLabel("");
                }
              });
            }}
          >
            <label className="grid min-w-0 flex-1 gap-1 text-sm text-gray-700">
              Who it's for (only you see this)
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} className="min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-gray-900" />
            </label>
            <button type="submit" className={BUTTON} disabled={busy || !label.trim()}>
              Make a link
            </button>
          </form>
          {made && (
            <div className="grid gap-2 rounded-lg border border-teal-deep/40 bg-teal-deep/5 p-3 text-sm" data-link-made="">
              <p className="text-gray-900">
                {OPEN_WORDS.linkMade} For {made.label}:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 break-all rounded bg-white px-2 py-1 text-gray-800">{made.url}</code>
                <button type="button" className={BUTTON} onClick={() => copy(made.url)}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy
                </button>
              </div>
            </div>
          )}
          {desk.links.length > 0 && (
            <ul className="grid gap-1">
              {desk.links.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-800">
                  <span className="min-w-0 break-words">
                    {l.label} {!l.on && <span className="text-gray-500">(switched off)</span>}
                  </span>
                  {l.on && (
                    <button type="button" className={BUTTON} disabled={busy} onClick={() => void act(() => call(`${API_BASE}/admin/open-proposals/links/${encodeURIComponent(l.id)}/revoke`, "POST"))}>
                      Switch off
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Confirmed role applications</h3>
          {desk.transcribeOn && waiting > 0 && (
            <div className="flex flex-wrap items-center gap-2" data-transcribe-waiting="">
              <button type="button" className={BUTTON} disabled={running} onClick={() => void transcribeAll()} data-transcribe-waiting-button="">
                {t({ message: "Transcribe all waiting", context: "admin open proposals" })}
              </button>
              <span className="text-sm text-muted-foreground">
                {t({ message: `${waiting} recordings have no words yet. Each is written down by an AI service and kept with its application, marked as an AI transcript.`, context: "admin open proposals" })}
              </span>
            </div>
          )}
          {desk.proposals.length === 0 ? (
            <p className="text-sm text-gray-500">None yet. A role application shows here once its sender confirms their email, or at once, marked, when our confirmation email to them fails.</p>
          ) : (
            desk.proposals.map((p) => (
              <article key={p.id} className="grid gap-2 rounded-lg border border-gray-200 p-3 text-sm" data-open-proposal-row={p.id}>
                <p className="break-words font-semibold text-gray-900">
                  {p.name ?? "Name taken off"} <span className="font-normal text-gray-600">{p.email}</span>
                  {p.via && <span className="font-normal text-gray-500"> (through the link for {p.via})</span>}
                </p>
                {p.addressUnconfirmed && (
                  <p role="note" className="break-words font-semibold text-notice" data-address-unconfirmed="">
                    {p.addressUnconfirmed}
                  </p>
                )}
                <ul className="grid gap-1">
                  {p.roles.map((r) => (
                    <li key={r.roleId} className="break-words text-gray-800">
                      <span className="font-medium">{r.name ?? "A role no longer offered"}</span>
                      {r.note && <span className="text-gray-600">: {r.note}</span>}
                    </li>
                  ))}
                </ul>
                <p className="whitespace-pre-line break-words text-gray-800">{p.why}</p>
                {clipOf(p, "why") && <PlayVoice href={clipOf(p, "why")!.href} seconds={clipOf(p, "why")!.seconds} label={clipOf(p, "why")!.label} fetcher={hear} />}
                {clipOf(p, "why") && <StoredWordsSlot href={clipOf(p, "why")!.href} written={p.voice?.written?.[clipOf(p, "why")!.id]} on={!!desk.transcribeOn} poster={() => writeDown(p.id, clipOf(p, "why")!.id)} />}
                {p.aim && <p className="break-words text-gray-600">Aim: {p.aim}</p>}
                {clipOf(p, "aim") && <PlayVoice href={clipOf(p, "aim")!.href} seconds={clipOf(p, "aim")!.seconds} label={clipOf(p, "aim")!.label} fetcher={hear} />}
                {clipOf(p, "aim") && <StoredWordsSlot href={clipOf(p, "aim")!.href} written={p.voice?.written?.[clipOf(p, "aim")!.id]} on={!!desk.transcribeOn} poster={() => writeDown(p.id, clipOf(p, "aim")!.id)} />}
                {p.voice && (p.voice.notes.length > 0 || otherClips(p).length > 0) && (
                  <div className="grid gap-2 rounded-lg border border-border p-3" data-admin-voice="">
                    <p className="font-semibold text-foreground">{t({ message: "Their voice", context: "admin open proposals" })}</p>
                    {/* The promise the deciders' page makes, here too: who hears it, how long it is kept, and that typing counts the same (steelman QA, 15 Nov 2026). */}
                    <p className="text-sm text-muted-foreground" data-admin-voice-note="">
                      {t({ message: "Only the people who decide this application and the village's admins hear it. It is deleted with the application, and at the latest 90 days after the decision.", context: "admin open proposals" })}{" "}
                      {t({ message: "Recording is optional, and many people type. Weigh typed answers the same as a recording.", context: "their voice, for deciders" })}
                    </p>
                    {p.voice.notes.map((n, i) => (
                      <div key={n.id} className="grid gap-1">
                        <span className="text-sm text-foreground">{t({ message: `Recording ${i + 1}`, context: "admin open proposals" })}</span>
                        <PlayVoice href={n.href} seconds={n.seconds} label={t({ message: `Recording ${i + 1}`, context: "admin open proposals" })} fetcher={hear} />
                        <StoredWordsSlot href={n.href} written={p.voice?.written?.[n.id]} on={!!desk.transcribeOn} poster={() => writeDown(p.id, n.id)} />
                      </div>
                    ))}
                    {otherClips(p).map((c) => (
                      <div key={c.id} className="grid gap-1" data-admin-voice-clip={c.field}>
                        <span className="text-sm text-foreground">{c.label}</span>
                        <PlayVoice href={c.href} seconds={c.seconds} label={c.label} fetcher={hear} />
                        {c.words && <span className="whitespace-pre-line break-words text-sm text-muted-foreground">{c.words}</span>}
                        <StoredWordsSlot href={c.href} written={p.voice?.written?.[c.id]} on={!!desk.transcribeOn} poster={() => writeDown(p.id, c.id)} />
                      </div>
                    ))}
                  </div>
                )}
                <a href={`/open-proposals/${encodeURIComponent(p.id)}`} className="inline-flex min-h-10 items-center gap-1.5 font-medium text-teal-deep underline underline-offset-2">
                  Open its page, where the circle answers and it is decided
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </article>
            ))
          )}
        </section>
      </div>
    </details>
  );
}
