/**
 * THE NO-SIGN BAND, SAID IN WORDS.
 *
 * Inside the band one setter's word sets a figure; outside it, a reason and a
 * second signer, or the village. The band is two dials (`noSignBand`,
 * shared/valuation.ts): how far under the suggestion it reaches and how far
 * over. The server lays the village's own dials over the model it sends
 * (`currentModel`), so this reads the same band the server judges against.
 */
import { useLingui } from "@lingui/react/macro";
import { noSignBand, type ValuationModel } from "@shared/valuation";

export default function NoSignBandNote({ model, className = "text-sm text-muted-foreground" }: { model: ValuationModel; className?: string }) {
  const { t } = useLingui();
  const { belowPct, abovePct } = noSignBand(model.engine);
  const sentence =
    belowPct > 0 && abovePct > 0
      ? t({ message: `The band runs from ${belowPct}% under the suggestion to ${abovePct}% over it.`, context: "no-sign band" })
      : belowPct > 0
        ? t({ message: `The band runs from ${belowPct}% under the suggestion up to the suggestion itself.`, context: "no-sign band" })
        : abovePct > 0
          ? t({ message: `The band runs from the suggestion itself up to ${abovePct}% over it.`, context: "no-sign band" })
          : t({ message: `The band is the suggestion itself.`, context: "no-sign band" });
  return (
    <p className={className} data-no-sign-band={`${belowPct}:${abovePct}`}>
      {sentence} {t({ message: `Inside it, one person's word sets the figure.`, context: "no-sign band" })}
    </p>
  );
}
