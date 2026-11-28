/**
 * BEFORE YOUR CALL: THE EARLIER HOLDERS' VOICE REFLECTIONS (the lead, 27 Nov 2026: "so that the visionary at the end
 * can listen to these before her call (and community can listen to mine before their call...)"). Each earlier
 * conversation's recordings, by role, with a player. The recording is fetched through the notes' own file door with
 * the reader's sign-in, then played from the page; no address that works without signing in reaches the page. Record
 * and play only: nothing here transcribes or judges. Never drawn for the applicant: the walkthrough's door answers 404.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { authToken } from "@/lib/gameApi";
import { BTN_NOTICE, EYEBROW, H2, HINT } from "@/components/journey/look";
import type { ServedNote } from "@shared/conversationNotes";

export type Reflection = { interviewId: number; role: string; notes: ServedNote[] };

function Player({ note, role }: { note: ServedNote; role: string }) {
  const { t } = useLingui();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const load = async () => {
    if (!note.fileHref) return;
    setFailed(false);
    const token = authToken();
    const res = await fetch(note.fileHref, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }).catch(() => null);
    if (!res?.ok) return setFailed(true);
    setSrc(URL.createObjectURL(await res.blob()));
  };
  return (
    <div className="mt-2" data-reflection={note.id}>
      {src ? (
        <audio controls autoPlay src={src} className="w-full" aria-label={t({ message: `${role}'s reflection`, context: "walkthrough: a voice reflection's player" })} />
      ) : (
        <button type="button" className={BTN_NOTICE} onClick={() => void load()} data-reflection-play="">
          {t({ message: `Listen to ${role}'s reflection`, context: "walkthrough: play a voice reflection" })}
        </button>
      )}
      {failed && <p role="alert" className={`${HINT} text-destructive`}>{t({ message: "That recording did not open.", context: "walkthrough: a voice reflection failed" })}</p>}
    </div>
  );
}

export default function Reflections({ items }: { items: Reflection[] }) {
  const { t } = useLingui();
  if (!items.length) return null;
  const roles = items.map((r) => r.role).join(" & ");
  return (
    <section aria-labelledby="reflections-heading" className="mt-6 min-w-0" data-walk-reflections="">
      <p className={EYEBROW}>{t({ message: "Private to the team", context: "conversation notes: the kicker" })}</p>
      <h3 id="reflections-heading" className={`mt-1 ${H2}`}>{t({ message: `Before your call: listen to ${roles}`, context: "walkthrough: the earlier holders' voice reflections, heading" })}</h3>
      <p className={`mt-1 ${HINT}`}>{t({ message: "Their voice reflections from their own conversations. Never shown to the applicant.", context: "walkthrough: what the reflections are" })}</p>
      <ul className="mt-3 grid gap-3">
        {items.map((r) => (
          <li key={r.interviewId} className="min-w-0" data-reflections-of={r.interviewId}>
            <p className="font-semibold text-foreground">{r.role}</p>
            {r.notes.map((n) => (
              <Player key={n.id} note={n} role={r.role} />
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
