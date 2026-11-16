/**
 * /aboard/welcome: the reward moment (onboarding screen 04). The newcomer's
 * card appears with every rite waiting and the next one marked, and the member
 * who walks beside them, with the first word they wrote.
 *
 * A choice made before a Google sign-in left the page is sent here, once.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Trans } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { PLACES, type PlaceKey } from "@shared/rites";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, BottomNav, Chip, Icon, MemberCard, RitesWorld, TopBar } from "@/components/rites/parts";
import { ritesGet, ritesSend, type MeView } from "@/components/rites/ritesApi";
import { ABOARD_KEPT } from "./ComeAboard";

export default function Arrived() {
  const { user, loading } = useAuth();
  const [me, setMe] = useState<MeView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const kept = localStorage.getItem(ABOARD_KEPT);
        if (kept) {
          localStorage.removeItem(ABOARD_KEPT);
          await ritesSend("POST", "/api/rites/aboard", JSON.parse(kept));
        }
      } catch {
        /* the choice can be made again from the card */
      }
      try {
        const d = await ritesGet<MeView>("/api/rites/me");
        if (alive) setMe(d);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user && !loading) {
    return (
      <RitesWorld>
        <div className="app pad" style={{ paddingTop: 40 }}>
          <Link className="btn gold" href="/login?next=/aboard/welcome">
            <Trans context="rites">Sign in</Trans>
          </Link>
        </div>
      </RitesWorld>
    );
  }
  if (!me) return <RitesWorld><div className="app pad" style={{ paddingTop: 40 }}>{error ? <p className="muted">{error}</p> : null}</div></RitesWorld>;

  const w = me.words;
  const places = { phone: w.placePhone, site: w.placeSite, gathering: w.placeGathering };
  const questPlace = (PLACES as readonly string[]).includes(w.firstQuestPlace) ? (w.firstQuestPlace as PlaceKey) : null;

  return (
    <RitesWorld look={me.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className={`app${me.nav.length ? " has-nav" : ""}`}>
        <div className="rays" />
        <TopBar sigil={me.sigil} name={me.village}>
          <Chip place="phone" places={places} />
        </TopBar>
        <div className="pad" style={{ position: "relative" }}>
          {w.arrivedKicker ? <p className="sc center" style={{ marginTop: 6 }}>{w.arrivedKicker}</p> : null}
          <h1 className="center" style={{ fontSize: 40, marginTop: 4 }}>{w.arrivedTitle}</h1>

          <div style={{ marginTop: 20 }}>
            <MemberCard
              name={me.name}
              stageWord={me.stageWord}
              mark={me.mark}
              markHint={w.markHint}
              meta={me.inviter ? w.cameWith : undefined}
              stamps={me.stamps}
              foot={w.stampsFoot ? <p className="tiny muted" style={{ marginTop: 12 }}>{w.stampsFoot}</p> : null}
            />
          </div>

          <h2 style={{ marginTop: 28 }}>{w.buddyTitle}</h2>
          <p className="small muted" style={{ marginTop: 4 }}>{w.buddyLine}</p>
          {me.buddy ? (
            <div className="panel" style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar name={me.buddy.name} src={me.buddy.avatar} large />
                <div>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1 }}>{me.buddy.name}</p>
                  <p className="small muted">{me.memberWord}</p>
                </div>
              </div>
              {me.buddy.greeting ? <div className="bubble">{me.buddy.greeting}</div> : null}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                <Link className="btn gold small" style={{ width: "100%" }} href={me.buddy.handle ? `/profile/${me.buddy.handle}` : "/messages"}>
                  {w.sayHello}
                </Link>
                <Link className="btn ghost small" style={{ width: "100%" }} href="/rites">
                  {w.meetLabel}
                </Link>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ marginTop: 12 }}>
              <p className="small muted">
                <Trans context="rites">The village pairs you soon. You'll see them here.</Trans>
              </p>
            </div>
          )}

          {w.firstQuestTitle ? (
            <Link className="panel" href={w.firstQuestHref || "/quests"} style={{ marginTop: 14, display: "flex", gap: 14, alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <div className="icbox"><Icon name="quests" /></div>
              <div style={{ flex: 1 }}>
                <p className="tiny muted">
                  <Trans context="rites">Your first quest</Trans>
                </p>
                <p style={{ fontWeight: 600 }}>{w.firstQuestTitle}</p>
              </div>
              <Chip place={questPlace} places={places} />
            </Link>
          ) : null}
        </div>
        <BottomNav items={me.nav} on="card" />
      </div>
    </RitesWorld>
  );
}
