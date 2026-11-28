/**
 * THE QUIET WAY OUT (the lead, 27 Nov 2026): "withdraw my application", a plain button that asks once before it acts.
 * Withdrawing closes the application and sends no letter; the page then shows its withdrawn card.
 */
import { useState } from "react";
import { gameFetch } from "@/lib/gameApi";
import { BTN_SECONDARY, HINT } from "@/components/journey/look";

export default function WithdrawApplication({ url, words, onDone }: { url: string; words: { button: string; ask: string; yes: string; keep: string; failed: string }; onDone: () => void }) {
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
    <div className="pt-2" data-withdraw="">
      {!asking ? (
        <button type="button" className="min-h-11 text-sm text-muted-foreground underline underline-offset-4" onClick={() => setAsking(true)} data-withdraw-open="">
          {words.button}
        </button>
      ) : (
        <div className="grid gap-2" role="group" data-withdraw-confirm="">
          <p className="text-foreground">{words.ask}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void go()} data-withdraw-yes="">
              {words.yes}
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setAsking(false)}>
              {words.keep}
            </button>
          </div>
          {failed && <p role="alert" className={`${HINT} text-destructive`}>{words.failed}</p>}
        </div>
      )}
    </div>
  );
}
