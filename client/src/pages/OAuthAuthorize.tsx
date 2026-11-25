/**
 * THE CONNECTOR'S CONSENT PAGE (End of Moon addendum v6, B4).
 *
 * A connector such as Claude's custom connectors sends a member here to sign
 * in. The member sees which connector is asking and where they will be sent
 * back, picks what it may do (reading their moon is ticked; anything that
 * writes is theirs to tick), and presses Allow or Refuse. Allow hands the
 * connector a single-use code; the token itself is minted when the connector
 * exchanges it, as an ordinary agent token they can revoke under Your agent.
 *
 * A member who is not signed in signs in first and comes straight back.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { gameFetch } from "@/lib/gameApi";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { Trans } from "@lingui/react/macro";
import { BreathingLoader } from "@/components/natural";
import { WORLD, CARD, H1, LEDE, HINT, BTN_PRIMARY, BTN_SECONDARY, TICK } from "@/components/journey/look";

type OfferedScope = "moon.read" | "moon.write" | "tasks.write" | "moon.review" | "admin" | "sera.undoable" | "sessions.write";
interface Offer { scope: OfferedScope; write: boolean; ticked: boolean }
interface Request { clientName: string; redirectHost: string; scopes: Offer[] }

const SCOPE_WORDS: Record<OfferedScope, string> = {
  "moon.read": "Read your moon, your roles, the season and your task board",
  "moon.write": "Draft your own moon: import a moon pack, change an item, set next moon's goals, each after your yes",
  "tasks.write": "Mark your own board tasks Done, Let go or Undo, and hand a task to a role, each one after your yes",
  "moon.review": "If you review recaps: read the review queue and the role signals, never with amounts",
  admin: "As you, an admin: call the admin paths this village opened to agents, each write after a confirm. Erasure, powers, money and secrets stay with people",
  "sera.undoable": "Sera's tools for this agent account: links, suggestions and drafts, each one undoable for 30 days",
  "sessions.write": "Add items to the agenda library for a circle's sessions, each one after your yes",
};

export default function OAuthAuthorize() {
  const { user, loading } = useAuth();
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const clientId = q.get("client_id") ?? "";
  const redirectUri = q.get("redirect_uri") ?? "";
  const [req, setReq] = useState<Request | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (q.get("response_type") !== "code") {
      setProblem("This sign-in link is not one this village answers: it asks for something other than a code.");
      return;
    }
    void (async () => {
      const r = await gameFetch(`/api/agent/oauth/request?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setProblem(String(d.message ?? d.error ?? "This sign-in link did not work."));
      const offer = d as Request;
      setReq(offer);
      // Ticked: what the village ticks by default, plus any read the connector asked for. Writes stay the member's to tick.
      const asked = (q.get("scope") ?? "").split(/\s+/);
      setPicked(offer.scopes.filter((s) => s.ticked || (!s.write && asked.includes(s.scope))).map((s) => s.scope));
    })();
  }, [user, clientId, redirectUri, q]);

  const decide = async (decision: "allow" | "deny") => {
    setBusy(true);
    try {
      const r = await gameFetch("/api/agent/oauth/authorize", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          redirectUri,
          state: q.get("state") ?? undefined,
          codeChallenge: q.get("code_challenge") ?? "",
          codeChallengeMethod: q.get("code_challenge_method") ?? "",
          scopes: picked,
          decision,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || typeof d.redirect !== "string") return setProblem(String(d.error ?? "That did not go through."));
      window.location.assign(d.redirect);
    } finally {
      setBusy(false);
    }
  };

  const here = `${window.location.pathname}${window.location.search}`;

  return (
    // Drawn in the sheet's look (whole-app QA, 25 Nov 2026): the page renders without the shell, and its
    // fixed teal and white fills vanished on the dark ground (the language chip measured 1.01:1 on production).
    <main className={WORLD}>
      <div className="mx-auto max-w-lg px-4 pb-10 pt-3">
      {/* The language selector (spec i18n US2): this page renders without the shell. */}
      <PageLanguageBar tone="onSheet" className="mb-4" />
      <h1 className={H1}><Trans context="OAuthAuthorize, h1">Connect an agent</Trans></h1>
      {loading ? (
        <BreathingLoader className="mt-6" />
      ) : !user ? (
        <div className="mt-4 space-y-4">
          <p className={LEDE}><Trans context="OAuthAuthorize, p">Sign in first, and you come straight back here to decide.</Trans></p>
          <Link href={`/login?next=${encodeURIComponent(here)}`} className={BTN_PRIMARY}><Trans context="OAuthAuthorize, Link">Sign in</Trans></Link>
        </div>
      ) : problem ? (
        <p role="alert" className="mt-4 rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">{problem}</p>
      ) : !req ? (
        <BreathingLoader className="mt-6" />
      ) : (
        <div className="mt-4 space-y-5">
          <p className={LEDE}>
            <Trans context="OAuthAuthorize, p">A connector that says it is <strong>{req.clientName}</strong> asks to act for you, {user.name}. It named itself; check the return address before you allow it. When you decide, you go back to <strong>{req.redirectHost}</strong>.
          </Trans></p>
          <fieldset className={`space-y-4 ${CARD}`}>
            <legend className="px-1 text-sm font-semibold text-foreground"><Trans context="OAuthAuthorize, legend">What it may do</Trans></legend>
            {req.scopes.map((s) => (
              <label key={s.scope} className="flex items-start gap-3 text-sm text-card-foreground">
                <input
                  type="checkbox"
                  className={TICK}
                  checked={picked.includes(s.scope)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.scope] : p.filter((x) => x !== s.scope)))}
                />
                <span>{SCOPE_WORDS[s.scope] ?? s.scope}{s.write ? <span className="ml-1 text-muted-foreground"><Trans context="OAuthAuthorize, span">(writes)</Trans></span> : null}</span>
              </label>
            ))}
          </fieldset>
          <p className={HINT}>
            <Trans context="OAuthAuthorize, p">It never sends money or recaps, approves or pays anything, and it never sees an amount or a pay route. You can end it any time under Your agent on your profile.
          </Trans></p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy || picked.length === 0} onClick={() => void decide("allow")} className={BTN_PRIMARY}><Trans context="OAuthAuthorize, button">Allow</Trans></button>
            <button type="button" disabled={busy} onClick={() => void decide("deny")} className={BTN_SECONDARY}><Trans context="OAuthAuthorize, button">Refuse</Trans></button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
