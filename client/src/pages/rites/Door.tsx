/**
 * /door/:code: what a printed code opens (onboarding screen 00, the scan). A
 * stranger reads who gave it to them, by first name, and asks to join. The
 * request lands in the village's intake naming that member, who answers it.
 *
 * /rites/packet: the member's own printable piece, with their code as a real
 * QR (shared/qr.ts) and the village's words for the front and back.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { useAuth } from "@/contexts/AuthContext";
import { Chip, Qr, RitesWorld, Sigil, TopBar, type Look, type Places } from "@/components/rites/parts";
import { ritesGet, ritesSend } from "@/components/rites/ritesApi";

interface DoorView {
  giver: string;
  village: string;
  door: Record<string, string>;
  look: Look;
  places: Places;
  sigil?: string;
}

export function Door() {
  const { t } = useLingui();
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<DoorView | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [why, setWhy] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ritesGet<DoorView>(`/api/rites/door/${encodeURIComponent(code ?? "")}`).then(setData).catch((e) => setError((e as Error).message));
  }, [code]);

  if (!data) return <RitesWorld><div className="app pad" style={{ paddingTop: 40 }}>{error ? <p className="muted">{error}</p> : null}</div></RitesWorld>;
  const d = data.door;

  return (
    <RitesWorld look={data.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className="app">
        <TopBar sigil={data.sigil} name={data.village}>
          <Chip place="phone" places={data.places} />
        </TopBar>
        <div className="pad">
          <div className="parch" style={{ padding: 22, marginTop: 10 }}>
            <h1 className="hand" style={{ fontSize: 30 }}>{d.title}</h1>
            {d.line ? <p style={{ marginTop: 8, fontSize: 15 }}>{d.line}</p> : null}
            <p className="small muted" style={{ marginTop: 14 }}>{d.given}</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1 }}>{data.giver}</p>
          </div>
          {sent ? (
            <>
              <p className="note" style={{ marginTop: 18 }}>{sent}</p>
              <Link className="btn ghost small" style={{ marginTop: 12 }} href="/aboard">
                <Trans context="rites">I have my invitation already</Trans>
              </Link>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const r = await ritesSend<{ message: string }>("POST", `/api/rites/door/${encodeURIComponent(code ?? "")}/request`, { name, email, why });
                  setSent(r.message);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="f" htmlFor="door-name">
                <Trans context="rites">The name you go by</Trans>
              </label>
              <input id="door-name" className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              <label className="f" htmlFor="door-email">
                <Trans context="rites">Email</Trans>
              </label>
              <input id="door-email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              <label className="f" htmlFor="door-why">
                <Trans context="rites">A line for them</Trans>
              </label>
              <textarea id="door-why" className="in" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={400} placeholder={t`Where you met, what you planted`} />
              {error ? <p className="note err" style={{ marginTop: 12 }}>{error}</p> : null}
              <button className="btn gold" style={{ marginTop: 20 }} disabled={busy}>
                {d.button}
              </button>
            </form>
          )}
        </div>
      </div>
    </RitesWorld>
  );
}

interface MyDoor {
  mayInvite: boolean;
  code: string | null;
  path: string | null;
  giver: string;
  door: Record<string, string>;
  look: Look;
  village: string;
}

export function Packet() {
  const { t } = useLingui();
  const { user, loading } = useAuth();
  const [mine, setMine] = useState<MyDoor | null>(null);
  const [error, setError] = useState("");
  const [sigil, setSigil] = useState("");

  useEffect(() => {
    if (!user) return;
    ritesGet<MyDoor>("/api/rites/door").then(setMine).catch((e) => setError((e as Error).message));
    ritesGet<{ sigil: string }>("/api/rites/me").then((m) => setSigil(m.sigil)).catch(() => undefined);
  }, [user]);

  if (!user && !loading) {
    return (
      <RitesWorld>
        <div className="app pad" style={{ paddingTop: 40 }}>
          <Link className="btn gold" href="/login?next=/rites/packet">
            <Trans context="rites">Sign in</Trans>
          </Link>
        </div>
      </RitesWorld>
    );
  }
  if (!mine) return <RitesWorld><div className="app pad" style={{ paddingTop: 40 }}>{error ? <p className="muted">{error}</p> : null}</div></RitesWorld>;
  if (!mine.mayInvite || !mine.path) {
    return (
      <RitesWorld look={mine.look} lang={<PageLanguageBar tone="onDark" />}>
        <div className="app pad" style={{ paddingTop: 40 }}>
          <p className="muted">
            <Trans context="rites">Your own code opens once you may vouch for somebody.</Trans>
          </p>
        </div>
      </RitesWorld>
    );
  }
  const d = mine.door;
  const url = `${window.location.origin}${mine.path}`;
  const host = window.location.host;

  return (
    <RitesWorld look={mine.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className="app packapp">
        <div className="packtable">
          {d.packetKicker ? <p className="sc center" style={{ margin: "0 0 14px", fontSize: 13, letterSpacing: ".12em" }}>{d.packetKicker}</p> : null}
          <div className="packet front">
            <Sigil src={sigil} className="sig" />
            <h1>{d.packetFront}</h1>
            {d.packetSub ? <p style={{ marginTop: 8, fontFamily: "var(--font-display)", fontSize: 18, fontStyle: "italic" }}>{d.packetSub}</p> : null}
            {d.packetVariety ? <p className="v">{d.packetVariety}</p> : null}
          </div>
          <div className="packet back parch">
            <p className="hand" style={{ fontSize: 30 }}>{d.packetBackTitle}</p>
            {d.packetBackLine ? <p style={{ marginTop: 8, fontSize: 15 }}>{d.packetBackLine}</p> : null}
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 16 }}>
              <Qr text={url} label={t`A code that asks to join through you`} />
              <div>
                <p className="small muted">{d.given}</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1 }}>{mine.giver}</p>
                <p className="small" style={{ marginTop: 6 }}>{d.scanLine}</p>
              </div>
            </div>
            <p className="tiny muted center" style={{ marginTop: 14 }}>{host}</p>
          </div>
        </div>
        <div className="pad noprint" style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <button type="button" className="btn gold" onClick={() => window.print()}>
            <Trans context="rites">Print</Trans>
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              if (!window.confirm(t`Make a new code? The old one stops working, printed ones too.`)) return;
              const r = await ritesSend<{ code: string; path: string }>("POST", "/api/rites/door/replace");
              setMine({ ...mine, code: r.code, path: r.path });
            }}
          >
            <Trans context="rites">Make a new code</Trans>
          </button>
        </div>
      </div>
    </RitesWorld>
  );
}
