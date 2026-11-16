/**
 * /rites/ceremony/:id: a spoken rite, held live (onboarding screens 06 and 07).
 *
 * The same page on every phone in the ceremony, drawn for who is holding it:
 *   the candidate   one line at a time, large, and one button to say it was
 *                   spoken; then the mark, drawn with a finger; then the wait.
 *   a witness       the same lines as they are spoken, and once the last line
 *                   and the mark are in, one button: witnessed.
 *   anybody else    who may witness: join, present or on a call.
 * It asks the server every few seconds while the ceremony is open, so each
 * phone sees the others' taps. When it is sworn the card turns: the ring of
 * marks, the card with its new stamps, and the next step, offered once.
 *
 * Full screen: no other control, the ceremony colour, the place's photo behind.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { MARK_SIZE } from "@shared/rites";
import { Avatar, BottomNav, Chip, MarkSvg, MemberCard, Ring, RitesWorld, Sigil, TopBar } from "@/components/rites/parts";
import { ritesGet, ritesSend, type CeremonyView, type MeView, type RingView } from "@/components/rites/ritesApi";

function DrawMark({ onDone, busy }: { onDone: (strokes: number[][][]) => void; busy: boolean }) {
  const { t } = useLingui();
  const [strokes, setStrokes] = useState<number[][][]>([]);
  const drawing = useRef(false);
  const svg = useRef<SVGSVGElement | null>(null);
  const point = (e: React.PointerEvent): number[] => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return [0, 0];
    return [((e.clientX - r.left) / r.width) * MARK_SIZE, ((e.clientY - r.top) / r.height) * MARK_SIZE];
  };
  const path = strokes.map((s) => `M${s.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}${s.length === 1 ? `L${s[0][0]} ${s[0][1]}` : ""}`).join("");
  return (
    <div>
      <svg
        ref={svg}
        className="drawpad parch"
        viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`}
        role="img"
        aria-label={t({ message: "Drawing area for your mark", context: "rites" })}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drawing.current = true;
          setStrokes((s) => [...s, [point(e)]]);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const p = point(e);
          setStrokes((s) => {
            const last = s[s.length - 1];
            const prev = last[last.length - 1];
            if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) < 1.2) return s;
            return [...s.slice(0, -1), [...last, p]];
          });
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginTop: 14 }}>
        <button type="button" className="btn ghost" onClick={() => setStrokes([])} disabled={!strokes.length || busy}>
          <Trans context="rites">Clear</Trans>
        </button>
        <button type="button" className="btn ember" onClick={() => onDone(strokes)} disabled={!strokes.length || busy}>
          <Trans context="rites">This is my mark</Trans>
        </button>
      </div>
    </div>
  );
}

/** A witness who joined may still confirm for ten minutes after the count was reached (QA P1-8, P2-9). */
const LATE_WITNESS_MS = 10 * 60 * 1000;

function Sworn({ c, onConfirm }: { c: CeremonyView; onConfirm: () => void }) {
  const mine = c.witnesses.find((x) => x.you);
  const late = !!mine && !mine.confirmed && !!c.closedAt && Date.now() - new Date(c.closedAt).getTime() < LATE_WITNESS_MS;
  const [me, setMe] = useState<MeView | null>(null);
  const [ring, setRing] = useState<RingView | null>(null);
  useEffect(() => {
    void ritesGet<RingView>("/api/rites/ring").then(setRing).catch(() => undefined);
    if (c.you.isCandidate) void ritesGet<MeView>("/api/rites/me").then(setMe).catch(() => undefined);
  }, [c.you.isCandidate]);
  const w = c.words;
  const numbers = me ? [me.tokens.record, me.tokens.voice].filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ n: x.n, name: x.name })) : [];
  return (
    <div className={`app${me?.nav.length ? " has-nav" : ""}`}>
      <TopBar sigil={c.sigil} name={w.swornBar || c.rite.done} heading>
        <Chip place={c.place} places={w.places} />
      </TopBar>
      <div className="pad center">
        {w.swornKicker ? <p className="sc">{w.swornKicker}</p> : null}
        <h1 style={{ fontSize: 38, marginTop: 4 }}>{c.you.isCandidate ? w.swornTitle : `${c.candidate.name}: ${c.rite.done}`}</h1>
        {c.you.isCandidate && w.swornLine ? <p className="muted" style={{ marginTop: 8 }}>{w.swornLine}</p> : null}
        {c.answer ? <p className="sc ember" style={{ marginTop: 10, fontSize: 18 }}>{c.answer}</p> : null}
        {late ? (
          <button type="button" className="btn ember" style={{ marginTop: 16 }} onClick={onConfirm}>
            <Trans context="rites">Witnessed</Trans>
          </button>
        ) : null}
      </div>
      {ring && ring.marks.length ? (
        <div className="parch ringwrap">
          <Ring
            marks={c.you.isCandidate ? ring.marks : ring.marks.map((m) => ({ ...m, mine: false }))}
            sigil={c.sigil}
            centre={
              <>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 17, lineHeight: 1.1 }}>{ring.title}</p>
                <p className="tiny muted">{(w.ringCount || "").replace("{n}", String(ring.count))}</p>
              </>
            }
          />
        </div>
      ) : null}
      {me ? (
        <div className="pad" style={{ marginTop: 20 }}>
          <MemberCard
            name={me.name}
            stageWord={me.stageWord}
            mark={me.mark}
            meta={me.buddy ? `${me.words.buddy.charAt(0).toUpperCase()}${me.words.buddy.slice(1)}: ${me.buddy.name}` : undefined}
            stamps={me.stamps}
            fresh={me.stamps.filter((s) => s.state === "on").slice(0, 2).map((s) => s.id)}
            numbers={numbers}
          />
          {w.nextTitle ? (
            <div className="panel center" style={{ marginTop: 16 }}>
              {w.nextKicker ? <p className="sc">{w.nextKicker}</p> : null}
              <p style={{ fontFamily: "var(--font-display)", fontSize: 22, marginTop: 4 }}>{w.nextTitle}</p>
              {w.nextLabel ? (
                <Link className="btn gold" style={{ marginTop: 14 }} href={w.nextHref || "/card"}>
                  {w.nextLabel}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="pad" style={{ marginTop: 20 }}>
          <Link className="btn ghost" href="/rites">
            <Trans context="rites">Back to the rites</Trans>
          </Link>
        </div>
      )}
      {me ? <BottomNav items={me.nav} on="card" /> : null}
    </div>
  );
}

export default function Ceremony() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<CeremonyView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setC(await ritesGet<CeremonyView>(`/api/rites/ceremonies/${encodeURIComponent(id ?? "")}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!c || c.step === "sworn" || c.step === "set-aside") return;
    const t = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(t);
  }, [c, load]);

  const act = async (path: string, body: unknown = {}) => {
    setBusy(true);
    setError("");
    try {
      setC(await ritesSend<CeremonyView>("POST", `/api/rites/ceremonies/${encodeURIComponent(id ?? "")}/${path}`, body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!c) return <RitesWorld><div className="app pad" style={{ paddingTop: 40 }}>{error ? <p className="muted">{error}</p> : null}</div></RitesWorld>;
  const w = c.words;

  if (c.step === "sworn") {
    return (
      <RitesWorld look={c.look} lang={<PageLanguageBar tone="onDark" />}>
        <Sworn c={c} onConfirm={() => void act("confirm")} />
      </RitesWorld>
    );
  }

  const me = c.witnesses.find((x) => x.you);
  const spokenAll = c.spoken >= c.lines.length;

  return (
    <RitesWorld look={c.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className="app ceremony">
        {c.photo ? <div className="bg" style={{ backgroundImage: `url("${c.photo.replace(/"/g, "")}")` }} /> : null}
        <div className="wrap">
          <div className="topbar">
            <div style={{ color: "var(--ceremony)" }}>
              <Sigil src={c.sigil} />
            </div>
            <h1 className="name">{c.rite.title}</h1>
            <div className="sp" />
            <Chip place={c.place} places={w.places} />
          </div>

          {c.step === "set-aside" ? (
            <p className="center muted" style={{ marginTop: 30 }}>
              <Trans context="rites">This ceremony was set aside.</Trans>
            </p>
          ) : null}

          {c.step === "speaking" || (c.step === "witnessing" && !c.you.isCandidate) || (c.step === "marking" && !c.you.isCandidate) ? (
            <>
              {c.you.isCandidate ? <p className="center small" style={{ margin: "2px 24px 0", color: "color-mix(in srgb, var(--ceremony) 35%, var(--foreground))" }}>{w.ceremonyHelp}</p> : null}
              <div className="dots">
                {c.lines.map((_, i) => (
                  <i key={i} className={i <= c.spoken ? "on" : ""} />
                ))}
              </div>
              <div className="lines" aria-live="polite">
                {c.lines.map((line, i) => {
                  const cur = spokenAll ? c.lines.length - 1 : c.spoken;
                  if (i < cur) return <p key={i} className="ln done">{line}</p>;
                  if (i === cur) return <p key={i} className="ln now">{line}</p>;
                  if (i === cur + 1) return <p key={i} className="ln next">{line}</p>;
                  return null;
                })}
              </div>
            </>
          ) : null}

          {c.step === "marking" && c.you.isCandidate ? (
            <div className="pad" style={{ marginTop: 18 }}>
              <h2 className="center">{w.markTitle}</h2>
              <p className="center muted small" style={{ marginTop: 6 }}>{w.markLine}</p>
              <DrawMark
                busy={busy}
                onDone={async (strokes) => {
                  setBusy(true);
                  setError("");
                  try {
                    await ritesSend("POST", "/api/rites/mark", { strokes });
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </div>
          ) : null}

          {c.step === "witnessing" && c.you.isCandidate ? (
            <div className="pad center" style={{ marginTop: 26 }}>
              {c.mark ? (
                <div style={{ width: 96, height: 96, margin: "0 auto", color: "var(--seal)" }}>
                  <MarkSvg path={c.mark} width={5} />
                </div>
              ) : null}
              <p style={{ fontFamily: "var(--font-display)", fontSize: 24, marginTop: 10 }}>
                <Trans context="rites">Your witnesses confirm now.</Trans>
              </p>
            </div>
          ) : null}

          <div className="pad" style={{ marginTop: 26 }}>
            <p className="sc ember">{w.witnessesTitle}</p>
            {c.witnesses.length === 0 ? (
              <p className="small muted" style={{ marginTop: 8 }}>
                <Trans context="rites">Nobody has joined yet. A witness opens this rite on their own phone.</Trans>
              </p>
            ) : null}
            {c.witnesses.map((x) => (
              <div key={x.id} className="wit">
                <Avatar name={x.initial} tone={x.isBuddy ? "" : "g"} />
                <div>
                  <p style={{ fontWeight: 600 }}>{x.name}</p>
                  <p className="tiny muted">
                    {x.isBuddy ? w.witnessBuddy : w.witnessOther}
                    {x.via === "call" ? <> · <Trans context="rites">on a call</Trans></> : null}
                  </p>
                </div>
                {x.confirmed ? (
                  <span className="ok">
                    <Trans context="rites">witnessed</Trans>
                  </span>
                ) : (
                  <span className="ok">
                    ● <Trans context="rites">listening</Trans>
                  </span>
                )}
              </div>
            ))}

            {error ? <p className="note err" style={{ marginTop: 12 }}>{error}</p> : null}

            {c.you.isCandidate && c.step === "speaking" ? (
              <button type="button" className="btn ember" style={{ marginTop: 22 }} disabled={busy} onClick={() => act("spoken", { line: c.spoken })}>
                {w.spoken}
              </button>
            ) : null}

            {!c.you.isCandidate && !me && c.you.mayWitness && c.step !== "set-aside" ? (
              <div style={{ display: "grid", gridTemplateColumns: c.rite.callCounts ? "1fr 1fr" : "1fr", gap: 10, marginTop: 22 }}>
                <button type="button" className="btn ember" disabled={busy} onClick={() => act("witness", { via: "present" })}>
                  <Trans context="rites">I'm here</Trans>
                </button>
                {c.rite.callCounts ? (
                  <button type="button" className="btn ghost" disabled={busy} onClick={() => act("witness", { via: "call" })}>
                    <Trans context="rites">I'm on the call</Trans>
                  </button>
                ) : null}
              </div>
            ) : null}

            {me && !me.confirmed && c.step === "witnessing" ? (
              <button type="button" className="btn ember" style={{ marginTop: 22 }} disabled={busy} onClick={() => act("confirm")}>
                <Trans context="rites">Witnessed</Trans>
              </button>
            ) : null}

            {w.ceremonyFoot ? <p className="center tiny muted" style={{ marginTop: 10 }}>{w.ceremonyFoot}</p> : null}
          </div>
        </div>
      </div>
    </RitesWorld>
  );
}
