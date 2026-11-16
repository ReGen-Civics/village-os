/**
 * "Remember my answers on this device": the visitor's own choice, off until
 * they tick it (fireflyPath/applyRemember.ts). Unticking, or the button,
 * forgets what this device keeps. Nothing goes to the server until they send.
 */
import { useLingui } from "@lingui/react/macro";
import { HINT, LINK, TILE } from "@/components/journey/look";
import { forgetApplyAnswers } from "./applyRemember";

export function RememberOnDevice({ on, onChange, onForgotten }: { on: boolean; onChange: (on: boolean) => void; onForgotten: () => void }) {
  const { t } = useLingui();
  const forget = () => {
    forgetApplyAnswers();
    onChange(false);
    onForgotten();
  };
  return (
    <div className={`${TILE} mt-3 grid gap-2`} data-remember-on-device={on ? "on" : "off"}>
      <div className="flex min-h-11 items-start gap-3">
        <input id="propose-remember" type="checkbox" aria-describedby="propose-remember-hint" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-notice" checked={on} onChange={(e) => (e.target.checked ? onChange(true) : forget())} />
        <div className="grid gap-1">
          <label htmlFor="propose-remember" className="cursor-pointer font-semibold text-foreground">{t({ message: "Remember my answers on this device", context: "founding application, remember on this device" })}</label>
          <p id="propose-remember-hint" className={HINT}>{t({ message: "Only this browser keeps them, so you can come back later. Nothing reaches us until you send.", context: "founding application, remember on this device" })}</p>
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
