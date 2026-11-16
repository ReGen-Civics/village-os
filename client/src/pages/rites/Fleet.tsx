/**
 * /fleet: the village at a glance (onboarding screen 11), read from the
 * modules that hold each part:
 *   the season and its goals   GET /api/season (seasons)
 *   circles, who leads, crew   GET /api/rites/fleet (this module, from the org chart)
 *   gatherings ahead           GET /api/events (events), with places taken
 *   open votes                 GET /api/governance/ballots (governance)
 * A module that is off or refuses simply leaves its part out. Nothing here
 * names a place where anything was planted.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Trans } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import type { NavItem } from "@shared/rites";
import { seasonView, type SeasonView } from "@shared/seasonGoalsView";
import { useAuth } from "@/contexts/AuthContext";
import { BottomNav, Chip, Icon, RitesWorld, TopBar, type Look, type Places } from "@/components/rites/parts";
import { ritesGet } from "@/components/rites/ritesApi";
import { gameFetch } from "@/lib/gameApi";

interface FleetView {
  circles: Array<{ id: string; name: string; photo: string | null; lead: string | null; crew: number }>;
  fleet: Record<string, string>;
  words: Record<string, string>;
  places: Places;
  voice: { name: string; n: number } | null;
  sigil: string;
  nav: NavItem[];
  look: Look;
  village: string;
}

interface Gathering {
  id: string;
  title: string;
  start: string;
  capacity: number | null;
  taken: number | null;
  full: boolean;
}

async function json(path: string): Promise<any | null> {
  try {
    const r = await gameFetch(path);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function gatheringsFrom(body: any): Gathering[] {
  const list: any[] = Array.isArray(body?.events) ? body.events : [];
  const now = Date.now();
  return list
    .map((e) => {
      const start = String(e.startsAt ?? e.start ?? e.startAt ?? "");
      const capacity = Number.isFinite(Number(e.capacity)) && Number(e.capacity) > 0 ? Number(e.capacity) : null;
      const taken = Number.isFinite(Number(e.goingCount ?? e.rsvpCount ?? e.attendeeCount)) ? Number(e.goingCount ?? e.rsvpCount ?? e.attendeeCount) : null;
      return { id: String(e.id), title: String(e.title ?? e.name ?? ""), start, capacity, taken, full: !!(e.full ?? (capacity !== null && taken !== null && taken >= capacity)) };
    })
    .filter((g) => g.title && new Date(g.start).getTime() >= now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);
}

export default function Fleet() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<FleetView | null>(null);
  const [season, setSeason] = useState<SeasonView | null>(null);
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [ballots, setBallots] = useState<Array<{ id: string; title: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    ritesGet<FleetView>("/api/rites/fleet").then((d) => alive && setData(d)).catch((e) => alive && setError((e as Error).message));
    void json("/api/season").then((s) => alive && setSeason(seasonView(s)));
    void json("/api/events").then((b) => alive && setGatherings(gatheringsFrom(b)));
    void json("/api/governance/ballots").then((b) => {
      const list: any[] = Array.isArray(b) ? b : Array.isArray(b?.ballots) ? b.ballots : [];
      if (alive) setBallots(list.filter((x) => (x.status ?? "open") === "open").slice(0, 3).map((x) => ({ id: String(x.id), title: String(x.title ?? x.question ?? x.subjectTitle ?? "") })).filter((x) => x.title));
    });
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user && !loading) {
    return (
      <RitesWorld>
        <div className="app pad" style={{ paddingTop: 40 }}>
          <Link className="btn gold" href="/login?next=/fleet">
            <Trans context="rites">Sign in</Trans>
          </Link>
        </div>
      </RitesWorld>
    );
  }
  if (!data) return <RitesWorld><div className="app pad" style={{ paddingTop: 40 }}>{error ? <p className="muted">{error}</p> : null}</div></RitesWorld>;

  const w = data.words;
  const f = data.fleet;
  const done = season ? season.goals.filter((g) => g.done).length : 0;

  return (
    <RitesWorld look={data.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className={`app fleet${data.nav.length ? " has-nav" : ""}`}>
        <TopBar sigil={data.sigil} name={w.title}>
          <Chip place="phone" places={data.places} />
          <Chip place="gathering" places={data.places} />
        </TopBar>
        <div className="wrap pad">
          <div className="cols">
            <div className="col">
              {season ? (
                <div className="panel">
                  <p className="sc">{w.seasonKicker}</p>
                  <h3 style={{ marginTop: 4 }}>{season.name}</h3>
                  {season.dates ? <p className="tiny muted" style={{ marginTop: 4 }}>{season.dates}</p> : null}
                  {season.goals.map((g) => (
                    <div key={g.id} className="goal">
                      <p>
                        <span>{g.text}</span>
                        <span className="muted">{g.done ? <Trans context="rites">done</Trans> : <Trans context="rites">underway</Trans>}</span>
                      </p>
                      <div className="bar">
                        <i style={{ width: g.done ? "100%" : "0%" }} />
                      </div>
                    </div>
                  ))}
                  {season.goals.length ? (
                    <p className="tiny muted" style={{ marginTop: 10 }}>
                      <Trans context="rites">
                        {done} of {season.goals.length} done
                      </Trans>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <div className="fleetcount">
                  <h3>{w.circlesTitle}</h3>
                  <span className="muted small">{data.circles.length}</span>
                </div>
                {data.circles.map((c) => (
                  <div key={c.id} className="ship" style={{ marginTop: 12 }}>
                    {c.photo ? <img src={c.photo} alt="" /> : null}
                    <div className="b">
                      <div>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1 }}>{c.name}</p>
                        <p className="small muted">
                          {[c.lead, c.crew ? (w.crewCount || "{n}").replace("{n}", String(c.crew)) : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {w.circleLive && c.crew ? <span className="chip ok" style={{ marginLeft: "auto" }}>{w.circleLive}</span> : null}
                    </div>
                  </div>
                ))}
                {f.joinTitle ? (
                  <div className="rig" style={{ marginTop: 12 }}>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>{f.joinTitle}</p>
                    {f.joinLine ? <p className="small muted" style={{ marginTop: 4 }}>{f.joinLine}</p> : null}
                    {f.joinLabel ? (
                      <a className="btn ghost small" style={{ margin: "12px auto 0" }} href={f.joinHref || "/season-places"}>
                        {f.joinLabel}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="col">
              <h3>{w.gatheringsTitle}</h3>
              {gatherings.length === 0 ? (
                <p className="small muted">
                  <Trans context="rites">Nothing on the calendar yet.</Trans>
                </p>
              ) : (
                gatherings.map((g) => (
                  <div key={g.id} className="lf">
                    <div className="top">
                      <div>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: 21, lineHeight: 1.1 }}>{g.title}</p>
                        <p className="small muted">{new Date(g.start).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</p>
                      </div>
                      <Chip place="gathering" places={data.places} />
                    </div>
                    {g.capacity ? (
                      <>
                        <div className="cap">
                          {Array.from({ length: Math.min(g.capacity, 44) }, (_, i) => (
                            <i key={i} className={g.taken !== null && i < g.taken ? "on" : ""} />
                          ))}
                        </div>
                        <p className="tiny muted" style={{ marginTop: 6 }}>
                          {g.taken ?? 0} / {g.capacity}
                        </p>
                      </>
                    ) : null}
                    <Link className="btn ghost small" style={{ marginTop: 12, width: "100%" }} href={`/events/${encodeURIComponent(g.id)}`}>
                      {g.full ? <Trans context="rites">Join the waitlist</Trans> : <Trans context="rites">See the gathering</Trans>}
                    </Link>
                  </div>
                ))
              )}
              {f.applyLine ? (
                <div className="panel">
                  {f.applyKicker ? <p className="sc">{f.applyKicker}</p> : null}
                  <p className="small" style={{ marginTop: 6 }}>{f.applyLine}</p>
                  {f.applyLabel ? (
                    <a className="btn gold small" style={{ marginTop: 12, width: "100%" }} href={f.applyHref || "/season-places"}>
                      {f.applyLabel}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="col">
              {ballots.length ? (
                <div className="panel">
                  <p className="sc">{w.ballotsKicker}</p>
                  <ul className="vote" style={{ marginTop: 8 }}>
                    {ballots.map((b) => (
                      <li key={b.id}>
                        <Link href="/governance" style={{ textDecoration: "none", flex: 1 }}>{b.title}</Link>
                      </li>
                    ))}
                  </ul>
                  {data.voice ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <span className="small">
                        {data.voice.name}: <b>{Math.round(data.voice.n).toLocaleString("en-US")}</b>
                      </span>
                      <Link className="btn gold small" href="/governance">
                        <Trans context="rites">Vote</Trans>
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {f.pathTitle ? (
                <Link className="panel" href={f.pathHref || "/roles"} style={{ display: "flex", gap: 14, alignItems: "center", textDecoration: "none", color: "inherit" }}>
                  <div className="icbox"><Icon name="vehicle" /></div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600 }}>{f.pathTitle}</p>
                    {f.pathLine ? <p className="small muted">{f.pathLine}</p> : null}
                  </div>
                  <span className="muted" style={{ fontSize: 22 }} aria-hidden="true">›</span>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
        <BottomNav items={data.nav} on="fleet" />
      </div>
    </RitesWorld>
  );
}
