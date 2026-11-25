/**
 * /card: the member's card, grown up (onboarding screen 13).
 *
 * The mark, the stage in the village's words, the two numbers (the village's
 * record token and its voting token) as a name and a number and nothing more,
 * the rites in the village's order, what earned the record, and the members
 * with their Voice. A former member's Voice rests: it shows, it counts on no
 * new ballot (server/lib/governanceWeights.ts), and it wakes when they return.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import RitesSignedOut from "@/components/rites/RitesSignedOut";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, BottomNav, Chip, MemberCard, RitesWorld, TopBar } from "@/components/rites/parts";
import { ritesGet, type CrewView, type MeView, type RecordView, type RitesError } from "@/components/rites/ritesApi";
import ModuleGate from "@/components/modules/ModuleGate";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function Card() {
  const { t } = useLingui();
  const { user, loading } = useAuth();
  const [me, setMe] = useState<MeView | null>(null);
  const [record, setRecord] = useState<RecordView | null>(null);
  const [crew, setCrew] = useState<CrewView | null>(null);
  const [error, setError] = useState("");
  const [off, setOff] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    ritesGet<MeView>("/api/rites/me")
      .then((d) => alive && setMe(d))
      .catch((e) => alive && ((e as RitesError).status === 404 ? setOff(true) : setError((e as Error).message)));
    ritesGet<RecordView>("/api/rites/record").then((d) => alive && setRecord(d)).catch(() => undefined);
    ritesGet<CrewView>("/api/rites/crew").then((d) => alive && setCrew(d)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user && !loading) return <RitesSignedOut next="/card" />;
  if (off) return <ModuleGate moduleId="rites" name={t({ message: "Rites", context: "module name" })} />;
  if (!me) return <RitesWorld><div className="app pad" style={{ paddingTop: 40 }}>{error ? <p className="muted">{error}</p> : null}</div></RitesWorld>;

  const w = me.words;
  const places = { phone: w.placePhone, site: w.placeSite, gathering: w.placeGathering };
  const numbers = [me.tokens.record, me.tokens.voice].filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ n: x.n, name: x.name }));
  const buddyWord = `${w.buddy.charAt(0).toUpperCase()}${w.buddy.slice(1)}`;

  return (
    <RitesWorld look={me.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className={`app${me.nav.length ? " has-nav" : ""}`}>
        <TopBar sigil={me.sigil} name={w.cardTitle} heading>
          <Chip place="phone" places={places} />
        </TopBar>
        <div className="pad">
          <MemberCard
            name={me.name}
            stageWord={me.stageWord}
            mark={me.mark}
            markHint={w.markHint}
            meta={me.buddy ? `${buddyWord}: ${me.buddy.name}` : me.inviter ? w.cameWith : undefined}
            stamps={me.stamps}
            numbers={numbers}
            numbersFirst
            foot={!me.sworn && w.beforeRiteNote ? <p className="tiny muted" style={{ marginTop: 12 }}>{w.beforeRiteNote}</p> : null}
          />

          {record && record.entries.length ? (
            <>
              <h3 style={{ marginTop: 26 }}>{w.recordTitle}</h3>
              <ul className="rec panel" style={{ marginTop: 10 }}>
                {record.entries.map((e) => (
                  <li key={e.id}>
                    <span>
                      <b>{e.title}</b>
                      <br />
                      <span className="w">{new Date(e.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    </span>
                    <span className="n">+{fmt(e.n)}</span>
                  </li>
                ))}
              </ul>
              {record.token ? <p className="tiny muted" style={{ marginTop: 8 }}>{record.token}</p> : null}
            </>
          ) : null}

          {crew && crew.crew.length ? (
            <>
              <h3 style={{ marginTop: 26 }}>{w.crewTitle}</h3>
              <ul className="crew panel" style={{ marginTop: 10 }}>
                {crew.crew.map((p, i) => (
                  <li key={p.id} className={p.resting ? "rest" : ""}>
                    <Avatar name={p.name} src={p.avatar} tone={p.you || p.resting ? "b" : i === 0 ? "g" : ""} />
                    <div>
                      <p style={{ fontWeight: 600 }}>
                        {p.roles.length ? `${p.roles[0]} (${p.name})` : p.name}
                        {p.resting ? <span className="rest-tag">{w.away}</span> : null}
                      </p>
                      <p className="tiny muted">
                        {p.roles.length ? p.roles.join(", ") : crew.member}
                        {p.you ? <> · <Trans context="rites">you</Trans></> : null}
                      </p>
                    </div>
                    {crew.voiceName ? (
                      <div className="v">
                        <b>{fmt(p.voice)}</b>
                        <span>{p.resting ? w.resting : crew.voiceName}</span>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {w.crewFoot ? <p className="tiny muted" style={{ marginTop: 8 }}>{w.crewFoot}</p> : null}
            </>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
            {me.openCeremonies[0] ? (
              <Link className="btn ember small" href={`/rites/ceremony/${me.openCeremonies[0].id}`}>
                <Trans context="rites">Back to your rite</Trans>
              </Link>
            ) : null}
            <Link className="btn ghost small" href="/rites">
              <Trans context="rites">Rites and witnessing</Trans>
            </Link>
            <Link className="btn ghost small" href="/fleet">
              <Trans context="rites">The whole village</Trans>
            </Link>
            <Link className="btn ghost small" href="/rites/packet">
              <Trans context="rites">Your printed code</Trans>
            </Link>
          </div>
        </div>
        <BottomNav items={me.nav} on="card" />
      </div>
    </RitesWorld>
  );
}
