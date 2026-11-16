/**
 * /welcome: the village's living world before any form (onboarding screen 02).
 *
 * A place before a form: the village's photo and words, the pulse, the first
 * hour and the long road, the ways in, and the village's agreement one tap
 * away. Arriving with an invitation (`?invite=`) it names who is waiting, and
 * the main action carries the link to sign-up. Counts are numbers with nothing
 * attached; nothing here ever names a place.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Trans } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { Avatar, Chip, Icon, RitesWorld, TopBar, ago } from "@/components/rites/parts";
import { ritesGet, ritesSend, type DoorView, type PublicView } from "@/components/rites/ritesApi";

interface PulseRow {
  id: string;
  type: string;
  text: string;
  at: string;
}

function inviteParam(): string {
  try {
    return new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
  } catch {
    return "";
  }
}

function InterestForm({ door, onDone }: { door: DoorView; onDone: () => void }) {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel"
      style={{ marginTop: 10 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await ritesSend("POST", "/api/rites/interest", { doorId: door.id, name, email });
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="f" htmlFor="interest-name" style={{ marginTop: 0 }}>
        <Trans context="rites interest form">Your name</Trans>
      </label>
      <input id="interest-name" className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      <label className="f" htmlFor="interest-email">
        <Trans context="rites interest form">Email</Trans>
      </label>
      <input id="interest-email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      {error ? <p className="note err" style={{ marginTop: 10 }}>{error}</p> : null}
      <button className="btn gold small" style={{ marginTop: 12, width: "100%" }} disabled={busy}>
        <Trans context="rites interest form">Leave your name</Trans>
      </button>
    </form>
  );
}

export default function Welcome() {
  const [invite] = useState(inviteParam);
  const [data, setData] = useState<PublicView | null>(null);
  const [failed, setFailed] = useState(false);
  const [pulse, setPulse] = useState<PulseRow[]>([]);
  const [openDoor, setOpenDoor] = useState<string | null>(null);
  const [left, setLeft] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    ritesGet<PublicView>(`/api/rites/public${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    fetch("/api/game/pulse")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => alive && setPulse(Array.isArray(rows) ? rows.slice(0, 4) : []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [invite]);

  if (failed) {
    return (
      <RitesWorld>
        <div className="app pad" style={{ paddingTop: 40 }}>
          <p className="muted">
            <Trans context="rites">This page isn't open yet.</Trans>
          </p>
        </div>
      </RitesWorld>
    );
  }
  if (!data) return <RitesWorld><div className="app" /></RitesWorld>;

  const w = data.welcome;

  return (
    <RitesWorld look={data.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className="app welcome">
        <TopBar sigil={data.sigil} name={data.village}>
          <Chip place="phone" places={data.places} />
        </TopBar>
        <div className="wrap">
          <div className="wgrid">
            <div>
              <div className="hero">
                {w.photo ? <img src={w.photo} alt={w.photoAlt} /> : <div style={{ height: 300 }} />}
                <div className="over">
                  {w.kicker ? <p className="sc" style={{ marginBottom: 8 }}>{w.kicker}</p> : null}
                  <h1>{w.title}</h1>
                  {w.lede ? <p className="lede">{w.lede}</p> : null}
                  <Link className="btn gold" style={{ marginTop: 18 }} href={invite ? `/aboard?invite=${encodeURIComponent(invite)}` : "/aboard"}>
                    {w.cta}
                  </Link>
                </div>
              </div>
            </div>
            <div className="side">
              <section className="s pad">
                {data.inviter ? (
                  <div className="welcome-from">
                    <Avatar name={data.inviter} />
                    <p className="small">{w.waiting}</p>
                  </div>
                ) : null}
                <div className="sh">
                  <h3>{w.pulseTitle}</h3>
                  <span className="live">
                    <Trans context="rites welcome pulse">live</Trans>
                  </span>
                </div>
                <ul className="pulse panel" style={{ padding: "4px 14px" }}>
                  {pulse.length === 0 ? (
                    <li>
                      <span className="muted small">
                        <Trans context="rites welcome pulse">Quiet for now.</Trans>
                      </span>
                    </li>
                  ) : (
                    pulse.map((p) => (
                      <li key={p.id}>
                        <span className="dot">{p.type === "rite_stamped" ? "✦" : "•"}</span>
                        <span>{p.text}</span>
                        <span className="when">{ago(p.at)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </section>
              {w.steps.length ? (
                <section className="s pad">
                  <div className="sh">
                    <h3>{w.stepsTitle}</h3>
                    {w.stepsNote ? <span className="muted small">{w.stepsNote}</span> : null}
                  </div>
                  <ol className="steps panel" style={{ padding: "2px 14px" }}>
                    {w.steps.map((s, i) => (
                      <li key={s.title}>
                        <span className="n">{i + 1}</span>
                        <span className="t">
                          <b>{s.title}</b>
                          <span>{s.line}</span>
                        </span>
                        <Chip place={s.place} places={data.places} />
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>
          </div>

          {w.doors.some((d) => d.onWelcome) ? (
            <section className="s pad">
              <div className="sh">
                <h3>{w.doorsTitle}</h3>
              </div>
              <div className="doors">
                {w.doors.filter((d) => d.onWelcome).map((d) => (
                  <div key={d.id}>
                    {d.interestOnly ? (
                      <button type="button" className="door" onClick={() => setOpenDoor(openDoor === d.id ? null : d.id)} aria-expanded={openDoor === d.id}>
                        <div className="ic"><Icon name="card" /></div>
                        <div style={{ flex: 1 }}>
                          <b>{d.title}</b>
                          <p className="small muted">{left.includes(d.id) ? <Trans context="rites">Thank you. We'll write to you.</Trans> : d.line}</p>
                        </div>
                        <Chip place={d.place} places={data.places} />
                      </button>
                    ) : (
                      <a className="door" href={d.href || (invite ? `/aboard?invite=${encodeURIComponent(invite)}` : "/aboard")}>
                        <div className="ic"><Icon name="vehicle" /></div>
                        <div style={{ flex: 1 }}>
                          <b>{d.title}</b>
                          <p className="small muted">{d.line}</p>
                        </div>
                        <Chip place={d.place} places={data.places} />
                      </a>
                    )}
                    {openDoor === d.id && !left.includes(d.id) ? (
                      <InterestForm
                        door={d}
                        onDone={() => {
                          setLeft((l) => [...l, d.id]);
                          setOpenDoor(null);
                        }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
              {w.doorsFoot ? <p className="small muted" style={{ marginTop: 10 }}>{w.doorsFoot}</p> : null}
            </section>
          ) : null}

          {w.road.length || w.lockTitle ? (
            <section className="s pad">
              <div className="sh">
                <h3>{w.roadTitle}</h3>
              </div>
              <div className="longrow">
                <div className="road">
                  {w.road.map((r, i) => (
                    <div key={r.title} className="roadcard">
                      <div className="ic"><Icon name={i === 0 ? "quests" : "sprout"} /></div>
                      <div>
                        <b>{r.title}</b>
                        <p className="small muted">{r.line}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {w.lockTitle ? (
                  <div className="fogmap">
                    <svg viewBox="0 0 400 170" preserveAspectRatio="none" aria-hidden="true">
                      <g fill="none" stroke="var(--border)" strokeWidth="1">
                        <path d="M-10 120 C 60 80, 90 140, 160 100 S 260 40, 410 90" />
                        <path d="M-10 140 C 70 100, 110 160, 180 120 S 280 60, 410 110" opacity=".6" />
                        <path d="M-10 60 C 50 30, 130 70, 200 40 S 330 10, 410 30" opacity=".5" />
                      </g>
                    </svg>
                    <div className="lk">
                      <div>
                        <div className="l"><Icon name="lock" /></div>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: 19 }}>{w.lockTitle}</p>
                        <p className="small muted">{w.lockLine}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {data.articles.title ? (
            <section className="s pad">
              <div className="parch art">
                {data.articles.kicker ? <p className="sc" style={{ color: "var(--seal)" }}>{data.articles.kicker}</p> : null}
                <h3 style={{ marginTop: 4 }}>{data.articles.title}</h3>
                {data.articles.lede ? <p style={{ fontSize: 14.5, marginTop: 8 }}>{data.articles.lede}</p> : null}
                {data.articles.items.length ? (
                  <ol>
                    {data.articles.items.map((a) => (
                      <li key={a.n} value={a.n}>
                        <b>{a.title}</b> {a.line}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {data.articles.href ? (
                  <a className="small" style={{ display: "block", marginTop: 10, fontWeight: 600, color: "var(--seal)", textDecoration: "none" }} href={data.articles.href}>
                    {data.articles.linkLabel}
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </RitesWorld>
  );
}
