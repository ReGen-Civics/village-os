/**
 * SEND IT TO THE ANCHOR CIRCLE (ruling 7, the lead, 27 Nov 2026). After the final conversation is written up, the
 * applicant refines their proposal, then sends it on with this button. It asks once, because the proposal is fixed
 * from that moment. The walkthrough offers the same act to Ops and the Visionary.
 */
import { useState } from "react";
import { gameFetch } from "@/lib/gameApi";
import { BTN_PRIMARY, BTN_SECONDARY, HINT } from "@/components/journey/look";

export default function SendToCircle({ url, words, onDone }: { url: string; words: { button: string; ask: string; yes: string; keep: string; failed: string }; onDone: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const go = async () => {
    setBusy(true);
    setFailed(false);
    const res = await gameFetch(url, { method: "POST", body: "{}", cache: "no-store" }).catch(() => null);
    setBusy(false);
    if (res?.ok) onDone();
    else setFailed(true);
  };
  return (
    <div id="send-to-circle" className="grid gap-2" data-send-to-circle="">
      {!asking ? (
        <button type="button" className={BTN_PRIMARY} onClick={() => setAsking(true)} data-send-open="">
          {words.button}
        </button>
      ) : (
        <div className="grid gap-2" role="group" data-send-confirm="">
          <p className="text-foreground">{words.ask}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void go()} data-send-yes="">
              {words.yes}
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setAsking(false)}>
              {words.keep}
            </button>
          </div>
        </div>
      )}
      {failed && <p role="alert" className={`${HINT} text-destructive`}>{words.failed}</p>}
    </div>
  );
}
