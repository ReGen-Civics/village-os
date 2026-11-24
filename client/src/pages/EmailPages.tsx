/**
 * THE PAGES AN EMAIL LINKS TO (the comms build spec 5.4): preferences,
 * unsubscribe, and the action page for a one-click answer.
 *
 * ONE LAZY CHUNK FOR ALL THREE. Each is a single small screen reached from an
 * email, usually by somebody signed out, and the three share their shape, so
 * App.tsx imports this file three times by name and the bundler keeps it one
 * chunk: one request on a slow link, and one 4 KB block of the dist budget in
 * place of three.
 *
 * NOTHING HAPPENS ON ARRIVAL. Every page reads its signed `?t=` link, shows
 * what a press would do, and acts only on a press, because mail scanners
 * open every link in an email and a page that acted on load would act for a
 * scanner. The server holds the same rule on its side: no GET under
 * `/api/comms` changes anything.
 *
 * NO SIGN-IN. The link is the key, and the server answers with what the link
 * can change and nothing about whose it is: an address hint, never the
 * address. The words beside each switch come from shared/comms/preferences.ts,
 * which the server's answers are built from too.
 *
 * Members' pages, so semantic tokens throughout: these follow the theme the
 * village chose, unlike the light-only admin.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { BTN_PRIMARY, LINK, WORLD } from "@/components/journey/look";
import {
  ESSENTIAL_NOTE,
  KIND_WORDS,
  PAUSE_DAYS,
  type ActionDescription,
  type ActionOutcome,
  type KindView,
  type PreferencesView,
  type UnsubscribeView,
} from "@shared/comms/preferences";
import { Trans, useLingui } from "@lingui/react/macro";

/** The signed link from the address bar, or "". */
const tokenFromUrl = (): string => new URLSearchParams(window.location.search).get("t") ?? "";

const NO_LINK = "This page needs the link from an email the village sent you. Open that email and press the link again.";
const UNREACHABLE = "That did not reach the village. Check your connection and try again.";

interface Answer {
  ok: boolean;
  status: number;
  body: any;
}

/** One call to the comms routes. Never throws: a failure is an answer with ok false. */
async function call(path: string, token: string, init?: { method: string; body?: unknown }): Promise<Answer> {
  try {
    const res = await fetch(`${path}?t=${encodeURIComponent(token)}`, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0, body: { error: UNREACHABLE } };
  }
}

const errorOf = (a: Answer, fallback: string): string => String(a.body?.error ?? a.body?.message ?? "").trim() || fallback;

const dateWords = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Layout>
      {/* The night world (public launch QA, 24 Nov 2026): every email's own pages in the sheet's look, same words. */}
      <section className={`${WORLD} py-12 sm:py-20`}>
        <div className="container px-4">
          <div className="max-w-md mx-auto bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-8">
            <h1 className="font-display text-2xl font-bold text-card-foreground mb-4">{title}</h1>
            {children}
          </div>
        </div>
      </section>
    </Layout>
  );
}

const primaryButton = `${BTN_PRIMARY} w-full`;
const quietButton =
  "w-full min-h-11 rounded-xl border border-border bg-card text-card-foreground font-medium px-4 py-2 disabled:opacity-50";

function Notice({ text }: { text: string }) {
  return (
    <p role="status" className="rounded-xl border border-border bg-muted text-sm text-card-foreground p-3 mb-4">
      {text}
    </p>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <p role="alert" className="text-sm text-destructive mb-4">
      {text}
    </p>
  );
}

// ── Preferences ─────────────────────────────────────────────────────────────

function KindSwitch({ k, busy, onChange }: { k: KindView; busy: boolean; onChange: (on: boolean) => void }) {
  const words = KIND_WORDS[k.kind];
  return (
    <li>
      <button
        type="button"
        aria-pressed={k.on}
        disabled={busy || !k.changeable}
        onClick={() => onChange(!k.on)}
        className="w-full min-h-12 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-card-foreground">{words.label}</span>
          <span className="block text-xs text-muted-foreground mt-0.5">{words.description}</span>
          {k.note && <span className="block text-xs text-muted-foreground mt-1">{k.note}</span>}
        </span>
        <span
          aria-hidden="true"
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${k.on ? "bg-notice" : "bg-muted-foreground/30"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${k.on ? "translate-x-4" : "translate-x-0.5"}`}
          />
        </span>
      </button>
    </li>
  );
}

/**
 * Every choice for one address. Shared by the preferences page and the action
 * page, which opens it for a link signed for preferences.
 */
export function PreferencesPanel({ token, onVillage }: { token: string; onVillage?: (name: string) => void }) {
  const { t } = useLingui();
  const [view, setView] = useState<PreferencesView | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  useEffect(() => {
    if (!token) return;
    void call("/api/comms/preferences", token).then((a) => {
      if (a.ok && a.body?.view) {
        setView(a.body.view);
        onVillage?.(a.body.view.village);
      } else setError(errorOf(a, NO_LINK));
    });
  }, [token, onVillage]);

  const change = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError("");
      setNotice("");
      const a = await call("/api/comms/preferences", token, { method: "POST", body });
      setBusy(false);
      if (!a.ok) {
        // The switch never moved: the page shows what the server holds.
        setError(`${errorOf(a, UNREACHABLE)} Nothing changed.`);
        return;
      }
      setView(a.body.view);
      setConfirmStop(false);
      if (a.body.notice) setNotice(a.body.notice);
    },
    [token],
  );

  if (!token) return <p className="text-sm text-muted-foreground">{NO_LINK}</p>;
  if (!view) return error ? <Problem text={error} /> : <p className="text-sm text-muted-foreground"><Trans context="EmailPages, p">Loading your choices...</Trans></p>;

  const paused = view.pausedUntil && Date.parse(view.pausedUntil) > Date.now();
  return (
    <div>
      {view.addressHint && <p className="text-sm text-muted-foreground mb-4"><Trans context="EmailPages, p">For {view.addressHint}</Trans></p>}
      {notice && <Notice text={notice} />}
      {error && <Problem text={error} />}

      {view.blocked ? (
        <p className="text-sm text-card-foreground mb-4">{view.blocked.sentence}</p>
      ) : view.stopped ? (
        <div className="space-y-3 mb-4">
          <p className="text-sm text-card-foreground">
            <Trans context="EmailPages, p">You get no email from {view.village}, except the kind you ask for, like a password link.
          </Trans></p>
          <button type="button" className={primaryButton} disabled={busy} onClick={() => void change({ startAgain: true })}>
            <Trans context="EmailPages, button">Start again
          </Trans></button>
        </div>
      ) : (
        <>
          {paused && (
            <div className="rounded-xl border border-border bg-muted p-3 mb-4">
              <p className="text-sm font-medium text-card-foreground"><Trans context="EmailPages, p">Paused until {dateWords(view.pausedUntil!)}.</Trans></p>
              <p className="text-xs text-muted-foreground mt-1"><Trans context="EmailPages, p">It starts again by itself on that day.</Trans></p>
            </div>
          )}
          <ul className="space-y-2 mb-6" aria-label={t({ message: "Kinds of email", context: "EmailPages, aria-label" })}>
            {view.kinds.map((k) => (
              <KindSwitch key={k.kind} k={k} busy={busy} onChange={(on) => void change({ kind: k.kind, on })} />
            ))}
          </ul>

          <div className="space-y-2 border-t border-border pt-4 mb-4">
            <p className="text-xs text-muted-foreground">
              <Trans context="EmailPages, p">Pause gathering reminders, path emails and letters for {PAUSE_DAYS} days. After that they start again by
              themselves.
            </Trans></p>
            <button type="button" className={quietButton} disabled={busy} onClick={() => void change({ pause: !paused })}>
              {paused ? "Start again now" : `Pause for ${PAUSE_DAYS} days`}
            </button>
          </div>

          <div className="space-y-2 border-t border-border pt-4 mb-4">
            <p className="text-xs text-muted-foreground">
              <Trans context="EmailPages, p">Stop every email from {view.village} to this address, except the kind you ask for.
            </Trans></p>
            {confirmStop ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-card-foreground"><Trans context="EmailPages, p">Stop everything for this address?</Trans></p>
                <button
                  type="button"
                  className={`${quietButton} border-destructive text-destructive`}
                  disabled={busy}
                  onClick={() => void change({ stopEverything: true })}
                >
                  <Trans context="EmailPages, button">Yes, stop everything
                </Trans></button>
                <button type="button" className={quietButton} disabled={busy} onClick={() => setConfirmStop(false)}>
                  <Trans context="EmailPages, button">Keep my choices
                </Trans></button>
              </div>
            ) : (
              <button
                type="button"
                className={`${quietButton} text-destructive`}
                disabled={busy}
                onClick={() => setConfirmStop(true)}
              >
                <Trans context="EmailPages, button">Stop everything
              </Trans></button>
            )}
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground border-t border-border pt-4">{ESSENTIAL_NOTE}</p>
    </div>
  );
}

/** `/email/preferences?t=`: every kind of email with its switch, a pause, and "stop everything". */
export function EmailPreferences() {
  const { t } = useLingui();
  const token = useMemo(tokenFromUrl, []);
  const [village, setVillage] = useState("");
  return (
    <Shell title={village ? t({ message: `Your email from ${village}`, context: "EmailPages, title" }) : t({ message: "Your email", context: "EmailPages, title" })}>
      <PreferencesPanel token={token} onVillage={setVillage} />
    </Shell>
  );
}

// ── Unsubscribe ─────────────────────────────────────────────────────────────

/** `/email/unsubscribe?t=`: says what will stop, and stops it on a confirmed press. */
export function EmailUnsubscribe() {
  const { t } = useLingui();
  const token = useMemo(tokenFromUrl, []);
  const [view, setView] = useState<UnsubscribeView | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void call("/api/comms/unsubscribe", token).then((a) => {
      if (a.ok && a.body?.view) setView(a.body.view);
      else setError(errorOf(a, NO_LINK));
    });
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    setError("");
    const a = await call("/api/comms/unsubscribe", token, { method: "POST" });
    setBusy(false);
    if (!a.ok) return setError(`${errorOf(a, UNREACHABLE)} Nothing changed.`);
    setDone(String(a.body?.sentence ?? "Done."));
  };

  const what = view ? (view.kind === "all" ? "every email" : view.label.toLowerCase()) : "";
  const choices = view?.preferencesToken ? `/email/preferences?t=${encodeURIComponent(view.preferencesToken)}` : null;
  return (
    <Shell title={view ? (view.kind === "all" ? t({ message: "Stop every email?", context: "EmailPages, title" }) : t({ message: `Stop ${what}?`, context: "EmailPages, title" })) : t({ message: "Unsubscribe", context: "EmailPages, title" })}>
      {!token ? (
        <p className="text-sm text-muted-foreground">{NO_LINK}</p>
      ) : !view ? (
        error ? <Problem text={error} /> : <p className="text-sm text-muted-foreground"><Trans context="EmailPages, p">Loading...</Trans></p>
      ) : (
        <div className="space-y-4">
          {error && <Problem text={error} />}
          {done ? (
            <Notice text={done} />
          ) : view.done ? (
            <p className="text-sm text-card-foreground"><Trans context="EmailPages, p">This is already stopped. Nothing more to do here.</Trans></p>
          ) : (
            <>
              <p className="text-sm text-card-foreground">
                {view.kind === "all"
                  ? `You will stop getting email from ${view.village}, except the kind you ask for, like a password link.`
                  : `You will stop getting ${what} from ${view.village}. Everything else stays as it is.`}
              </p>
              <button type="button" className={primaryButton} disabled={busy} onClick={() => void confirm()}>
                {view.kind === "all" ? "Stop every email" : `Stop ${what}`}
              </button>
            </>
          )}
          {choices && (
            <a href={choices} className={`block text-sm ${LINK}`}>
              <Trans context="EmailPages, a">Choose which emails you get
            </Trans></a>
          )}
        </div>
      )}
    </Shell>
  );
}

// ── The action page ─────────────────────────────────────────────────────────

function ActionPanel({ token, description, onAnswered }: {
  token: string;
  description: ActionDescription;
  onAnswered: (outcome: ActionOutcome) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = description.input ?? null;
  const preferences = typeof description.data?.preferencesToken === "string" ? description.data.preferencesToken : null;

  const answer = async (choice: string | null) => {
    setBusy(true);
    setError("");
    const a = await call("/api/comms/action", token, { method: "POST", body: { choice, text: input ? text : null } });
    setBusy(false);
    if (!a.ok) return setError(`${errorOf(a, UNREACHABLE)} Nothing changed.`);
    onAnswered(a.body.outcome);
  };

  return (
    <div className="space-y-4">
      {description.paragraphs.map((p, i) => (
        <p key={i} className="text-sm text-card-foreground">
          {p}
        </p>
      ))}
      {error && <Problem text={error} />}
      {input && (
        <label className="block text-sm text-card-foreground">
          {input.label}
          {input.multiline ? (
            <textarea
              value={text}
              maxLength={input.maxLength}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-xl border border-border bg-background p-2 text-sm"
            />
          ) : (
            <input
              value={text}
              maxLength={input.maxLength}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-border bg-background p-2 text-sm"
            />
          )}
        </label>
      )}
      {description.choices.map((c) => (
        <button
          key={c.value}
          type="button"
          aria-pressed={description.current === c.value}
          className={c.primary ? primaryButton : quietButton}
          disabled={busy}
          onClick={() => void answer(c.value)}
        >
          {c.label}
          {description.current === c.value ? " (your answer)" : ""}
        </button>
      ))}
      {input && description.choices.length === 0 && (
        <button type="button" className={primaryButton} disabled={busy || !text.trim()} onClick={() => void answer(null)}>
          <Trans context="EmailPages, button">Send
        </Trans></button>
      )}
      {preferences && (
        <a href={`/email/preferences?t=${encodeURIComponent(preferences)}`} className={`block text-sm ${LINK}`}>
          <Trans context="EmailPages, a">Your email choices
        </Trans></a>
      )}
    </div>
  );
}

/** `/email/a?t=`: the answer a one-click link carries, shown, and changeable. */
export function EmailAction() {
  const { t } = useLingui();
  const token = useMemo(tokenFromUrl, []);
  const [purpose, setPurpose] = useState("");
  const [description, setDescription] = useState<ActionDescription | null>(null);
  const [result, setResult] = useState<ActionOutcome | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    void call("/api/comms/action", token).then((a) => {
      if (a.ok && a.body?.description) {
        setPurpose(String(a.body.purpose ?? ""));
        setDescription(a.body.description);
      } else setError(errorOf(a, NO_LINK));
    });
  }, [token]);

  if (purpose === "preferences") {
    return (
      <Shell title={description?.title ?? t({ message: "Your email", context: "EmailPages, title" })}>
        <PreferencesPanel token={token} />
      </Shell>
    );
  }
  const shown = result?.description ?? description;
  return (
    <Shell title={result?.title ?? description?.title ?? t({ message: "Your answer", context: "EmailPages, title" })}>
      {!token ? (
        <p className="text-sm text-muted-foreground">{NO_LINK}</p>
      ) : !shown ? (
        error ? <Problem text={error} /> : <p className="text-sm text-muted-foreground"><Trans context="EmailPages, p">Loading...</Trans></p>
      ) : (
        <div className="space-y-4">
          {result && result.paragraphs.length > 0 && <Notice text={result.paragraphs.join(" ")} />}
          {result && shown.choices.length > 0 && (
            <p className="text-xs text-muted-foreground"><Trans context="EmailPages, p">You can change your answer below.</Trans></p>
          )}
          <ActionPanel token={token} description={shown} onAnswered={setResult} />
        </div>
      )}
    </Shell>
  );
}
