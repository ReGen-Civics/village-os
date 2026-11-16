/**
 * /rites: where a member does the rites work that is not a screen of its own.
 *   - begin a spoken rite they do not hold yet, or go back to one under way;
 *   - witness: the ceremonies open now, for a member who may witness;
 *   - newcomers: pair one with a member, write the first word to your own,
 *     read their line, and witness a plain rite with one tap;
 *   - invite somebody with a line in your own words (the letter);
 *   - your printed code, and the requests it brought, answered with one tap.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import type { StampView } from "@shared/rites";
import { useAuth } from "@/contexts/AuthContext";
import { BottomNav, RitesWorld, Stamps, TopBar } from "@/components/rites/parts";
import { ritesGet, ritesSend, type MeView, type RitesError } from "@/components/rites/ritesApi";
import ModuleGate from "@/components/modules/ModuleGate";
import { gameFetch } from "@/lib/gameApi";

interface Newcomers {
  mayPair: boolean;
  buddyWord: string;
  sworn: Array<{ id: string; name: string }>;
  newcomers: Array<{ id: string; name: string; buddy: { id: string; name: string } | null; mine: boolean; why: string | null; greeting: string | null; stamps: StampView[] }>;
  rites: Array<{ id: string; todo: string }>;
}

interface OpenList {
  mayWitness: boolean;
  title: string;
  ceremonies: Array<{ id: string; candidate: string; rite: string }>;
}

interface Requests {
  requests: Array<{ id: string; name: string; message: string; status: string }>;
}

function Greeting({ newcomerId, initial }: { newcomerId: string; initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <form
      style={{ marginTop: 10 }}
      onSubmit={async (e) => {
        e.preventDefault();
        await ritesSend("PUT", `/api/rites/buddies/${encodeURIComponent(newcomerId)}/greeting`, { greeting: text });
        setSaved(true);
      }}
    >
      <textarea className="in" value={text} maxLength={400} onChange={(e) => { setText(e.target.value); setSaved(false); }} />
      <button className="btn gold small" style={{ marginTop: 8 }} disabled={!text.trim()}>
        {saved ? <Trans context="rites">Saved</Trans> : <Trans context="rites">Save the first word</Trans>}
      </button>
    </form>
  );
}

function Invite() {
  const [link, setLink] = useState("");
  const [id, setId] = useState("");
  const [line, setLine] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <div className="panel" style={{ marginTop: 10 }}>
      {!link ? (
        <button
          type="button"
          className="btn gold small"
          onClick={async () => {
            setError("");
            const r = await gameFetch("/api/invites", { method: "POST", body: "{}" });
            const b = await r.json().catch(() => ({}));
            if (!r.ok) return setError(String(b.error ?? r.status));
            setId(String(b.id));
            setLink(`${window.location.origin}${b.path}`);
          }}
        >
          <Trans context="rites">Make an invitation</Trans>
        </button>
      ) : (
        <>
          <label className="f" htmlFor="letter-line" style={{ marginTop: 0 }}>
            <Trans context="rites">A line in your own words</Trans>
          </label>
          <textarea id="letter-line" className="in" maxLength={200} value={line} aria-describedby="letter-line-hint" onChange={(e) => { setLine(e.target.value); setSaved(false); }} />
          <p id="letter-line-hint" className="tiny muted" style={{ marginTop: 6 }}>
            <Trans context="rites">Anyone holding the link reads this line. Keep private places and plans out of it.</Trans>
          </p>
          <button
            type="button"
            className="btn gold small"
            style={{ marginTop: 8 }}
            disabled={!line.trim()}
            onClick={async () => {
              try {
                await ritesSend("PUT", `/api/rites/letters/${encodeURIComponent(id)}`, { line });
                setSaved(true);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {saved ? <Trans context="rites">Saved</Trans> : <Trans context="rites">Put it on the letter</Trans>}
          </button>
          <p className="small" style={{ marginTop: 12, wordBreak: "break-all" }}>{link}</p>
          <button type="button" className="btn ghost small" style={{ marginTop: 8 }} onClick={() => void navigator.clipboard?.writeText(link)}>
            <Trans context="rites">Copy the link</Trans>
          </button>
        </>
      )}
      {error ? <p className="note err" style={{ marginTop: 10 }}>{error}</p> : null}
    </div>
  );
}

export default function RitesHub() {
  const { t } = useLingui();
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [me, setMe] = useState<MeView | null>(null);
  const [open, setOpen] = useState<OpenList | null>(null);
  const [newcomers, setNewcomers] = useState<Newcomers | null>(null);
  const [requests, setRequests] = useState<Requests | null>(null);
  const [note, setNote] = useState("");
  const [off, setOff] = useState(false);

  const load = useCallback(() => {
    ritesGet<MeView>("/api/rites/me").then(setMe).catch((e) => ((e as RitesError).status === 404 ? setOff(true) : setNote((e as Error).message)));
    ritesGet<OpenList>("/api/rites/ceremonies").then(setOpen).catch(() => undefined);
    ritesGet<Newcomers>("/api/rites/newcomers").then(setNewcomers).catch(() => undefined);
    ritesGet<Requests>("/api/rites/door-requests").then(setRequests).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user && !loading) {
    return (
      <RitesWorld>
        <div className="app pad" style={{ paddingTop: 40 }}>
          <Link className="btn gold" href="/login?next=/rites">
            <Trans context="rites">Sign in</Trans>
          </Link>
        </div>
      </RitesWorld>
    );
  }
  if (off) return <ModuleGate moduleId="rites" name={t({ message: "Rites", context: "module name" })} />;
  if (!me) return <RitesWorld><div className="app pad" style={{ paddingTop: 40 }}>{note ? <p className="muted">{note}</p> : null}</div></RitesWorld>;

  const held = new Set(me.stamps.filter((s) => s.state === "on").map((s) => s.id));
  const begin = me.rites.filter((r) => r.spoken && !held.has(r.id));
  const act = async (fn: () => Promise<unknown>) => {
    setNote("");
    try {
      await fn();
      load();
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  return (
    <RitesWorld look={me.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className={`app${me.nav.length ? " has-nav" : ""}`}>
        <TopBar sigil={me.sigil} name={me.village} />
        <div className="pad">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn ghost small" href="/card">
              <Trans context="rites">Your card</Trans>
            </Link>
            <Link className="btn ghost small" href="/fleet">
              <Trans context="rites">The whole village</Trans>
            </Link>
          </div>
          {note ? <p className="note err">{note}</p> : null}

          {begin.length ? (
            <section className="s" style={{ marginTop: 10 }}>
              <h3>
                <Trans context="rites">Your rites</Trans>
              </h3>
              {begin.map((r) => {
                const going = me.openCeremonies.find((c) => c.riteId === r.id);
                return (
                  <div key={r.id} className="panel" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <p style={{ flex: 1, fontWeight: 600 }}>{r.todo}</p>
                    {going ? (
                      <Link className="btn ember small" href={`/rites/ceremony/${going.id}`}>
                        <Trans context="rites">Go back to it</Trans>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn ember small"
                        onClick={() => act(async () => navigate(`/rites/ceremony/${(await ritesSend<{ id: string }>("POST", "/api/rites/ceremonies", { riteId: r.id })).id}`))}
                      >
                        <Trans context="rites">Begin</Trans>
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          ) : null}

          {open?.mayWitness ? (
            <section className="s">
              <h3>{open.title}</h3>
              {open.ceremonies.length === 0 ? (
                <p className="small muted" style={{ marginTop: 8 }}>
                  <Trans context="rites">No ceremony is open right now.</Trans>
                </p>
              ) : (
                open.ceremonies.map((c) => (
                  <Link key={c.id} className="panel" href={`/rites/ceremony/${c.id}`} style={{ marginTop: 10, display: "block", textDecoration: "none" }}>
                    <b>{c.candidate}</b> <span className="muted">· {c.rite}</span>
                  </Link>
                ))
              )}
            </section>
          ) : null}

          {newcomers?.mayPair && newcomers.newcomers.length ? (
            <section className="s">
              <h3>
                <Trans context="rites">Newcomers</Trans>
              </h3>
              {newcomers.newcomers.map((n) => (
                <div key={n.id} className="panel" style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <p style={{ flex: 1, fontWeight: 600 }}>{n.name}</p>
                    <span className="small muted">{n.buddy ? `${newcomers.buddyWord}: ${n.buddy.name}` : null}</span>
                  </div>
                  {!n.mine ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" className="btn ghost small" onClick={() => act(() => ritesSend("POST", "/api/rites/buddies", { newcomerId: n.id, buddyId: me.id }))}>
                        <Trans context="rites">Walk beside them</Trans>
                      </button>
                      <select
                        className="in"
                        style={{ width: "auto", minHeight: 40, padding: "6px 10px" }}
                        aria-label={t({ message: "Pair with", context: "rites" })}
                        value=""
                        onChange={(e) => e.target.value && act(() => ritesSend("POST", "/api/rites/buddies", { newcomerId: n.id, buddyId: e.target.value }))}
                      >
                        <option value="">{t({ message: "Pair with...", context: "rites" })}</option>
                        {newcomers.sworn.filter((s) => s.id !== n.id).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      {n.why ? <p className="bubble">{n.why}</p> : null}
                      <Greeting newcomerId={n.id} initial={n.greeting} />
                    </>
                  )}
                  <div style={{ marginTop: 12 }} className="parch pcard">
                    <Stamps stamps={n.stamps} />
                  </div>
                  {newcomers.rites.length ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      {newcomers.rites
                        .filter((r) => !n.stamps.some((s) => s.id === r.id && s.state === "on"))
                        .map((r) => (
                          <button key={r.id} type="button" className="btn ghost small" onClick={() => act(() => ritesSend("POST", "/api/rites/stamps", { userId: n.id, riteId: r.id }))}>
                            <Trans context="rites">Witness: {r.todo}</Trans>
                          </button>
                        ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          <section className="s">
            <h3>
              <Trans context="rites">Invite somebody</Trans>
            </h3>
            <Invite />
            <Link className="btn ghost" style={{ marginTop: 10 }} href="/rites/packet">
              <Trans context="rites">Your printed code</Trans>
            </Link>
          </section>

          {requests && requests.requests.length ? (
            <section className="s">
              <h3>
                <Trans context="rites">Asked at your code</Trans>
              </h3>
              {requests.requests.map((r) => (
                <div key={r.id} className="panel" style={{ marginTop: 10 }}>
                  <p style={{ fontWeight: 600 }}>{r.name}</p>
                  {r.message ? <p className="small muted" style={{ marginTop: 4 }}>{r.message}</p> : null}
                  {r.status === "new" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      <button type="button" className="btn gold small" onClick={() => act(async () => setNote(((await ritesSend<{ message: string }>("POST", `/api/rites/door-requests/${r.id}/accept`)).message)))}>
                        <Trans context="rites">Yes</Trans>
                      </button>
                      <button type="button" className="btn ghost small" onClick={() => act(() => ritesSend("POST", `/api/rites/door-requests/${r.id}/decline`))}>
                        <Trans context="rites">Not now</Trans>
                      </button>
                    </div>
                  ) : (
                    <p className="tiny muted" style={{ marginTop: 6 }}>{r.status}</p>
                  )}
                </div>
              ))}
            </section>
          ) : null}
        </div>
        <BottomNav items={me.nav} on="card" />
      </div>
    </RitesWorld>
  );
}
