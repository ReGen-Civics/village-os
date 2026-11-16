/**
 * /aboard: joining, in three fields and one line from the heart (onboarding
 * screen 03), then the one choice of how they are coming in.
 *
 * The account is made by the same door as the sign-up page (`register` in
 * AuthContext, POST /api/auth/register) with the invitation riding along, so
 * the vouch and every rule of that door hold. The way in and the line are the
 * rites module's (POST /api/rites/aboard), sent once the account exists. A
 * member already signed in sees only the choice and the line.
 *
 * Google: the choice and the line are kept on this device and sent when the
 * member lands on /aboard/welcome, because the Google door leaves the page.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSignInMethods } from "@/components/auth/signInMethods";
import { Avatar, Chip, RitesWorld, TopBar } from "@/components/rites/parts";
import { ritesGet, ritesSend, type PublicView } from "@/components/rites/ritesApi";

export const ABOARD_KEPT = "rites.aboard";

function inviteParam(): string {
  try {
    return new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
  } catch {
    return "";
  }
}

export default function ComeAboard() {
  const { t } = useLingui();
  const { user, register } = useAuth();
  const [, navigate] = useLocation();
  const [invite] = useState(inviteParam);
  const [data, setData] = useState<PublicView | null>(null);
  const [google, setGoogle] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [why, setWhy] = useState("");
  const [door, setDoor] = useState<string | null>(null);
  // The first open door is chosen to begin with; a newcomer changes it with one tap.
  useEffect(() => {
    if (data && door === null) setDoor(data.welcome.doors.find((d) => !d.interestOnly)?.id ?? null);
  }, [data, door]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    ritesGet<PublicView>(`/api/rites/public${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(t`This page isn't open yet.`));
    void fetchSignInMethods().then((m) => alive && setGoogle(!!m.google));
    return () => {
      alive = false;
    };
  }, [invite, t]);

  const keep = () => {
    try {
      localStorage.setItem(ABOARD_KEPT, JSON.stringify({ doorId: door, why }));
    } catch {
      /* a blocked store only means the choice is asked again */
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!user) await register(name, email, password, [], invite || undefined);
      await ritesSend("POST", "/api/rites/aboard", { doorId: door, why });
      navigate("/aboard/welcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : t`We couldn't make your account. Try again.`);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <RitesWorld>
        <div className="app pad" style={{ paddingTop: 40 }}>{error ? <p className="muted">{error}</p> : null}</div>
      </RitesWorld>
    );
  }
  const w = data.words;
  const road = (w.aboardRoad || "").split("|").map((s) => s.trim()).filter(Boolean);
  const googleHref = `/api/auth/google/start?${new URLSearchParams({ next: "/aboard/welcome", ...(invite ? { invite } : {}) }).toString()}`;

  return (
    <RitesWorld look={data.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className="app">
        <TopBar sigil={data.sigil} name={road[0] || data.welcome.cta}>
          <Chip place="phone" places={data.places} />
        </TopBar>
        {road.length ? (
          <>
            <div className="road4">
              {road.map((r, i) => (
                <span key={r} className={`d${i === 0 ? " on" : ""}`} />
              ))}
            </div>
            <div className="lbls">
              {road.map((r, i) => (i === 0 ? <b key={r}>{r}</b> : <span key={r}>{r}</span>))}
            </div>
          </>
        ) : null}

        <form className="pad" onSubmit={submit}>
          {data.inviter ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar name={data.inviter} />
              <p className="small">{w.invitedBy}</p>
            </div>
          ) : null}
          <h1 style={{ marginTop: 18, fontSize: 32 }}>{w.aboardTitle}</h1>

          {!user ? (
            <>
              {google ? (
                <>
                  <a className="btn light" style={{ marginTop: 18 }} href={googleHref} onClick={keep}>
                    <Trans context="rites">Continue with Google</Trans>
                  </a>
                  <div className="or">
                    <Trans context="rites">or with your email</Trans>
                  </div>
                </>
              ) : null}
              <label className="f" htmlFor="aboard-name">
                <Trans context="rites">The name you go by</Trans>
              </label>
              <input id="aboard-name" className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              <label className="f" htmlFor="aboard-email">
                <Trans context="rites">Email</Trans>
              </label>
              <input id="aboard-email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              <label className="f" htmlFor="aboard-password">
                <Trans context="rites">Password</Trans>
              </label>
              <input id="aboard-password" className="in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            </>
          ) : null}

          <label className="f" htmlFor="aboard-why">{w.aboardWhy}</label>
          <textarea id="aboard-why" className="in" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={400} />
          {w.aboardWhyHelp ? <p className="tiny muted" style={{ marginTop: 6 }}>{w.aboardWhyHelp}</p> : null}

          {data.welcome.doors.length ? (
            <fieldset style={{ border: 0, padding: 0, margin: "22px 0 0" }}>
              <legend style={{ padding: 0, marginBottom: 6, display: "block", fontSize: 13.5, fontWeight: 600 }}>{w.aboardDoorQuestion}</legend>
              {data.welcome.doors.map((d) => (
                <button key={d.id} type="button" className={`opt${door === d.id ? " sel" : ""}`} aria-pressed={door === d.id} onClick={() => setDoor(d.id)}>
                  <span className="r" />
                  <span style={{ flex: 1 }}>
                    <b>{d.choiceTitle || d.title}</b>
                    <span className="l">{d.choiceLine || d.line}</span>
                  </span>
                  <Chip place={d.place} places={data.places} />
                </button>
              ))}
            </fieldset>
          ) : null}

          {error ? <p className="note err" style={{ marginTop: 14 }}>{error}</p> : null}
          <button className="btn gold" style={{ marginTop: 24 }} disabled={busy}>
            {w.aboardButton}
          </button>
          {w.aboardFoot ? <p className="small muted center" style={{ marginTop: 12 }}>{w.aboardFoot}</p> : null}
        </form>
      </div>
    </RitesWorld>
  );
}
