/**
 * /aboard/welcome: the reward moment (onboarding screen 04). The newcomer's
 * card appears with every rite waiting and the next one marked, and the member
 * who walks beside them, with the first word they wrote.
 *
 * A choice made before a Google sign-in left the page is sent here, once.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { gameFetch } from "@/lib/gameApi";
import { Trans } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { PLACES, type PlaceKey } from "@shared/rites";
import RitesSignedOut from "@/components/rites/RitesSignedOut";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, BottomNav, Chip, Icon, MemberCard, RitesWorld, TopBar } from "@/components/rites/parts";
import { ritesGet, ritesSend, type MeView } from "@/components/rites/ritesApi";
import { ABOARD_KEPT } from "./ComeAboard";

export default function Arrived() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
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

  if (!user && !loading) return <RitesSignedOut next="/aboard/welcome" />;
  if (!me) return <RitesWorld><div className="app pad" style={{ paddingTop: 40 }}>{error ? <p className="muted">{error}</p> : null}</div></RitesWorld>;

  const w = me.words;
  const places = { phone: w.placePhone, site: w.placeSite, gathering: w.placeGathering };
  // The way in a newcomer chose may carry its own first quest and meeting (QA P3-7): a far-away pirate meets on a call.
  const door = me.doors.find((d) => d.id === me.aboard?.doorId);
  const questTitle = door?.questTitle || w.firstQuestTitle;
  const questHref = door?.questHref || w.firstQuestHref || "/quests";
  const questPlace = door?.questTitle ? door.questPlace ?? null : (PLACES as readonly string[]).includes(w.firstQuestPlace) ? (w.firstQuestPlace as PlaceKey) : null;
  const meetLabel = door?.meetLabel || w.meetLabel;
  const buddy = me.buddy;
  // Say hello opens a conversation with them, falling back to their page (QA P1-5).
  const sayHello = async () => {
    if (!buddy) return;
    try {
      const r = await gameFetch("/api/messages/direct", { method: "POST", body: JSON.stringify({ userId: buddy.id }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.id) return navigate(`/messages/${encodeURIComponent(String(d.id))}`);
    } catch {
      /* the page below is the way */
    }
    navigate(buddy.handle ? `/profile/${buddy.handle}` : "/messages");
  };

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
              foot={
                <>
                  {w.stampsFoot ? <p className="tiny muted" style={{ marginTop: 12 }}>{w.stampsFoot}</p> : null}
                  {/* A line only for someone who has not yet taken the village's admitting rite (QA P3-w-1). */}
                  {!me.sworn && w.beforeRiteNote ? <p className="tiny muted" style={{ marginTop: 6 }}>{w.beforeRiteNote}</p> : null}
                </>
              }
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
                  <p className="small muted">{me.buddy.seat ? `${me.buddy.seat}, ${me.memberWord}` : me.memberWord}</p>
                </div>
              </div>
              {me.buddy.greeting ? <div className="bubble">{me.buddy.greeting}</div> : null}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                <button type="button" className="btn gold small" style={{ width: "100%" }} onClick={() => void sayHello()}>
                  {w.sayHello}
                </button>
                <Link className="btn ghost small" style={{ width: "100%" }} href="/rites">
                  {meetLabel}
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

          {questTitle ? (
            <Link className="panel" href={questHref} style={{ marginTop: 14, display: "flex", gap: 14, alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <div className="icbox"><Icon name="quests" /></div>
              <div style={{ flex: 1 }}>
                <p className="tiny muted">
                  <Trans context="rites">Your first quest</Trans>
                </p>
                <p style={{ fontWeight: 600 }}>{questTitle}</p>
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
