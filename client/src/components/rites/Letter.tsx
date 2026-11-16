/**
 * THE LETTER (onboarding screen 01): an invitation link, dressed as a letter
 * from the member who made it. The sign-up page (`/register?invite=`) shows it
 * first whenever the rites module serves one; breaking the seal goes on to the
 * village's welcome with the link, then to joining.
 *
 * `useLetter` answers null when the module is off, not public, or the link is
 * not good, and the sign-up page goes on exactly as before.
 */
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { PageLanguageBar } from "@/i18n/PageLanguageBar";
import { Chip, RitesWorld, Sigil, TopBar, type Look, type Places } from "./parts";

export interface LetterView {
  valid: boolean;
  inviter: string;
  line: string | null;
  letter: Record<string, string>;
  village: string;
  counts: Array<{ label: string; n: number }>;
  look: Look;
  places: Places;
  sigil?: string;
}

export function useLetter(invite: string): LetterView | null | undefined {
  const [letter, setLetter] = useState<LetterView | null | undefined>(invite ? undefined : null);
  useEffect(() => {
    if (!invite) return;
    let alive = true;
    fetch(`/api/rites/letter?token=${encodeURIComponent(invite)}`)
      .then((r) => (r.ok ? r.json() : null))
      // Only a letter's own shape counts: a valid flag alone is the invitation check's answer, not a letter.
      .then((d) => alive && setLetter(d && d.valid === true && d.letter && typeof d.letter === "object" && typeof d.inviter === "string" ? (d as LetterView) : null))
      .catch(() => alive && setLetter(null));
    return () => {
      alive = false;
    };
  }, [invite]);
  return letter;
}

export default function Letter({ letter, onOpen }: { letter: LetterView; onOpen: () => void }) {
  const [breaking, setBreaking] = useState(false);
  const l = letter.letter;
  return (
    <RitesWorld look={letter.look} lang={<PageLanguageBar tone="onDark" />}>
      <div className="app">
        <TopBar sigil={letter.sigil} name={letter.village}>
          <Chip place="phone" places={letter.places} />
        </TopBar>
        {l.kicker ? <p className="sc center" style={{ margin: "4px 0 10px" }}>{l.kicker}</p> : null}
        <div className="letter parch">
          {l.photo ? <img src={l.photo} alt={l.photoAlt} /> : null}
          <div className="body">
            <h1 style={{ fontSize: 31 }}>{l.title}</h1>
            {letter.line ? (
              <>
                <div className="rule" />
                <p className="hand">{`“${letter.line}”`}</p>
                <p className="small muted" style={{ marginTop: 4, textAlign: "right" }}>{l.signature}</p>
              </>
            ) : null}
            {l.about ? (
              <>
                <div className="rule" />
                <p style={{ fontSize: 15.5 }}>{l.about}</p>
              </>
            ) : null}
            {letter.counts.length ? (
              <div className="nums" style={{ marginTop: 16 }}>
                {letter.counts.map((c) => (
                  <div key={c.label}>
                    <b>{c.n.toLocaleString("en-US")}</b>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className={`seal${breaking ? " broken" : ""}`}
          aria-label={l.seal}
          onClick={() => {
            setBreaking(true);
            window.setTimeout(onOpen, window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 600);
          }}
        >
          <Sigil src={letter.sigil} className="s" />
        </button>
        <p className="center" style={{ marginTop: 12, fontFamily: "var(--font-display)", fontSize: 22 }}>{l.seal}</p>
        <p className="center small muted" style={{ marginTop: 4 }}>{l.sealLine}</p>
        <p className="sr-only">
          <Trans context="rites">Opening the letter takes you to the village's welcome.</Trans>
        </p>
      </div>
    </RitesWorld>
  );
}
