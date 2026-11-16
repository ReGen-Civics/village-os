/**
 * The moment the map opens (the design's screen 10, a ceremony moment): full
 * screen, nothing else on it, the meter full, every pin the member may now see,
 * three counts, what is now open to them, and one button.
 *
 * Shown once per member and opening: the server says when the map opened
 * (`openedAt`), and this device remembers it was shown. Every word that names
 * the village's things (the map, the layers) is the village's own setting.
 * Under reduced motion it is a plain appearance with no movement.
 */
import { useEffect, useRef } from "react";
import { Footprints, Layers, ShieldCheck } from "lucide-react";
import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Layer, PinDot, PinView } from "@shared/hiddenMap";
import type { MapMe } from "@/lib/hiddenMapApi";
import SevenMeter from "./SevenMeter";
import WorldMap from "./WorldMap";
import { BTN_PRIMARY, EYEBROW, HINT, NOTE } from "@/components/journey/look";

const KEY = "village.hiddenMap.opened";

/** Whether this member has already seen this opening on this device. */
export function openingSeen(userId: string, openedAt: string | null): boolean {
  if (!openedAt) return true;
  try {
    return window.localStorage.getItem(`${KEY}.${userId}`) === openedAt;
  } catch {
    return true;
  }
}

function markSeen(userId: string, openedAt: string) {
  try {
    window.localStorage.setItem(`${KEY}.${userId}`, openedAt);
  } catch {
    /* a private window: the moment may show again, which is harmless */
  }
}

export default function OpeningMoment({ me, userId, pins, onDone }: { me: MapMe; userId: string; pins: ReadonlyArray<PinView | PinDot>; onDone: () => void }) {
  const { t } = useLingui();
  const heading = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // Start at the top: the celebration first, then the scroll down to the button.
  useEffect(() => {
    root.current?.scrollTo?.({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, []);
  const done = () => {
    if (me.openedAt) markSeen(userId, me.openedAt);
    onDone();
  };
  const others = (Object.keys(me.labels) as Layer[]).filter((l) => l !== "planting");
  const plantings = me.labels.planting;

  return (
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby="hm-opened" className="fixed inset-0 z-50 overflow-y-auto bg-background motion-safe:animate-in motion-safe:fade-in">
      <div className="container max-w-xl space-y-6 py-10">
        <p className={`${EYEBROW} text-center`}>{t({ message: `${me.needed} ${plantings}, vouched`, context: "hidden map, the moment the map opens" })}</p>
        <h1 ref={heading} tabIndex={-1} id="hm-opened" className="text-center font-display text-4xl leading-tight text-foreground sm:text-5xl">
          <Trans>The map is yours!</Trans>
        </h1>
        <p className={`${NOTE} text-center`}><Trans>Here is every place the members have logged.</Trans></p>
        <SevenMeter needed={me.needed} vouched={me.needed} logged={me.needed} glow />
        <WorldMap pins={pins} basemap={me.basemap} maxTileZoom={me.maxZoom} labels={me.labels} vouchesPerPin={me.vouchesPerPin} height={320} />
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted p-3">
            <dt className={HINT}>{plantings}</dt>
            <dd className="font-display text-2xl text-card-foreground">{me.allPins}</dd>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <dt className={HINT}><Trans context="hidden map, the moment the map opens">Members who logged</Trans></dt>
            <dd className="font-display text-2xl text-card-foreground">{me.planters}</dd>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <dt className={HINT}><Trans context="hidden map, the moment the map opens">Maps opened</Trans></dt>
            <dd className="font-display text-2xl text-card-foreground">{me.openedBefore + 1}</dd>
          </div>
        </dl>
        <section aria-labelledby="hm-now-open">
          <h2 id="hm-now-open" className="font-display text-2xl text-foreground"><Trans>Now open to you</Trans></h2>
          <ul className="mt-3 divide-y divide-border">
            <li className="flex items-start gap-3 py-3">
              <Footprints className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <p className={NOTE}><Trans><span className="font-semibold text-foreground">Return visits.</span> Find a place others logged and photograph how it is growing.</Trans></p>
            </li>
            <li className="flex items-start gap-3 py-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <p className={NOTE}><Trans><span className="font-semibold text-foreground">Vouching</span> for a newer member's places, with the place in view.</Trans></p>
            </li>
            {others.map((l) => (
              <li key={l} className="flex items-start gap-3 py-3">
                <Layers className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <p className={NOTE}><span className="font-semibold text-foreground">{me.labels[l]}.</span></p>
              </li>
            ))}
          </ul>
        </section>
        {me.openedBefore > 0 && (
          <p className={`${NOTE} text-center`}>{t`${plural(me.openedBefore, { one: "# member opened the map before you.", other: "# members opened the map before you." })}`}</p>
        )}
        <button type="button" className={`${BTN_PRIMARY} w-full`} onClick={done}><Trans context="hidden map, the moment the map opens">Explore the map</Trans></button>
      </div>
    </div>
  );
}
