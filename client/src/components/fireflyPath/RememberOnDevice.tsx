/**
 * "Remember my answers on this device": ticked to start (the lead, 19 Nov 2026),
 * with a line beside it to untick it on a shared device. Unticking, or the button,
 * forgets what this device keeps, and this browser remembers they unticked
 * (fireflyPath/applyRemember.ts). Nothing goes to the server until they send.
 */
import { flushSync } from "react-dom";
import { useLingui } from "@lingui/react/macro";
import { HINT, LINK, TILE } from "@/components/journey/look";
import { forgetApplyAnswers, keepRememberChoice } from "./applyRemember";

export function RememberOnDevice({ on, onChange, onForgotten }: { on: boolean; onChange: (on: boolean) => void; onForgotten: () => void }) {
  const { t } = useLingui();
  const forget = () => {
    // Untick first, synchronously: that runs any save still pending from the tick (a passive effect a slow machine
    // has not run yet), and with the box off no save runs after. Then clear. Clearing first let a pending save write
    // the draft straight back (RememberOnDevice.test.tsx).
    flushSync(() => onChange(false));
    keepRememberChoice(false);
    forgetApplyAnswers();
    onForgotten();
  };
  const tick = () => {
    keepRememberChoice(true);
    onChange(true);
  };
  return (
    <div className={`${TILE} mt-3 grid gap-2`} data-remember-on-device={on ? "on" : "off"}>
      <div className="flex min-h-11 items-start gap-3">
        <input id="propose-remember" type="checkbox" aria-describedby="propose-remember-hint propose-remember-shared" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-notice" checked={on} onChange={(e) => (e.target.checked ? tick() : forget())} />
        <div className="grid gap-1">
          <label htmlFor="propose-remember" className="cursor-pointer font-semibold text-foreground">{t({ message: "Remember my answers on this device", context: "founding application, remember on this device" })}</label>
          <p id="propose-remember-hint" className={HINT}>{t({ message: "Only this browser keeps them, so you can come back later. Nothing reaches us until you send.", context: "founding application, remember on this device" })}</p>
          <p id="propose-remember-shared" className={HINT} data-remember-shared="">{t({ message: "On a shared device, untick it.", context: "founding application, remember on this device" })}</p>
        </div>
      </div>
      {on && (
        <button type="button" className={`${LINK} inline-flex min-h-11 items-center justify-self-start text-sm`} onClick={forget} data-forget-on-device="">
          {t({ message: "Forget my answers on this device", context: "founding application, remember on this device" })}
        </button>
      )}
    </div>
  );
}
