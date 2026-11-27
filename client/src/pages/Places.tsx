/**
 * PLACES: the village's places and their photos, in one page.
 *
 * It folds what were three pages (the fold, 26 Nov 2026): the shelf of places
 * (`/places`), one place's photos (`/places/:key`, still its own address so a
 * place can be shared) and every photo on one list (`/photographs`, now the
 * "All photos" view at `/places#photos`, where the old address redirects).
 *
 * Three views, picked by the address's hash so each one can be linked to:
 *
 *  - Places (no hash): one card per place, its cover filling the card. The
 *    most-used thing, so it opens first.
 *  - All photos (`#photos`): every photo, newest first, whatever its place.
 *    It is how a person finds a picture of themselves to ask it down.
 *  - Reports (`#reports`): the curator's queue, drawn only for a holder of
 *    `map.curatePhotos`. The curators' notifications point here, and a
 *    curator reaches it even while the shelf is empty.
 *
 * The map draws places; this page never adds one or guesses where one is. A
 * place is here once somebody has photographed it, and its name is the map's
 * own key, respaced (`placeName`).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link, useRoute } from "wouter";
import { Map as MapIcon } from "lucide-react";
import LoadFailed from "@/components/LoadFailed";
import Layout from "@/components/Layout";
import ModuleGate from "@/components/modules/ModuleGate";
import { PAGE_GATE_LINES } from "@/components/modules/gateCopy";
import BreathingLoader from "@/components/natural/BreathingLoader";
import ComingSoonPanel from "@/components/ComingSoonPanel";
import PlaceCard, { type PlaceCardData } from "@/components/places/PlaceCard";
import PlaceGallery from "@/components/places/PlaceGallery";
import PhotoIndex from "@/components/places/PhotoIndex";
import PhotoReportsPanel from "@/components/places/PhotoReportsPanel";
import { jsonHeaders } from "@/components/places/placesApi";
import ViewTabs, { panelId, tabId, type ViewTab } from "@/components/places/ViewTabs";
import { useModule, useModules } from "@/modules/ModuleProvider";
import { BTN_PRIMARY, CARD, EYEBROW, H1, HINT, LEDE, LINK, NOTE, RING, WORLD } from "@/components/journey/look";
import { Trans, useLingui } from "@lingui/react/macro";
import { Labyrinth } from "@/components/sacred/glyphs";

interface ShelfPayload {
  places: PlaceCardData[];
  canContribute: boolean;
  canCurate: boolean;
  openReports: number;
  perPlace: number;
}

type View = "places" | "photos" | "reports";

/** The view an address names. Anything unknown is the shelf. */
export function viewOf(hash: string): View {
  const h = hash.replace(/^#/, "");
  return h === "photos" || h === "reports" ? h : "places";
}

/**
 * The view follows every move of the address: a typed hash, Back and Forward,
 * and a link from the bell to #reports while the page is already open. wouter
 * moves with pushState and replaceState and announces each as an event of
 * that name on window, so the store listens to those beside hashchange.
 */
const ADDRESS_EVENTS = ["hashchange", "popstate", "pushState", "replaceState"];
function onAddress(changed: () => void) {
  for (const e of ADDRESS_EVENTS) window.addEventListener(e, changed);
  return () => {
    for (const e of ADDRESS_EVENTS) window.removeEventListener(e, changed);
  };
}
const readHash = () => window.location.hash;

export default function Places() {
  const modules = useModules();
  const mapModule = useModule("map");
  const [onPlace, params] = useRoute("/places/:key");
  if (modules.loaded && !mapModule) {
    return <ModuleGate moduleId="map" name="Places" behind={PAGE_GATE_LINES.places} />;
  }
  let key = "";
  if (onPlace && params?.key) {
    try {
      key = decodeURIComponent(params.key);
    } catch {
      key = params.key;
    }
  }
  return (
    <Layout>
      <div className={WORLD}>
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:pt-10">
          {onPlace ? <PlaceGallery key={key} structureKey={key} /> : <PlacesHome />}
        </div>
      </div>
    </Layout>
  );
}

function PlacesHome() {
  const { t } = useLingui();
  const [data, setData] = useState<ShelfPayload | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [locked, setLocked] = useState(false);
  const view = viewOf(useSyncExternalStore(onAddress, readHash, () => ""));

  useEffect(() => {
    let live = true;
    fetch("/api/places", { headers: jsonHeaders() })
      .then((r) => {
        if (r.status === 401) {
          if (live) setLocked(true);
          return null;
        }
        return r.ok ? r.json() : Promise.reject(new Error(String(r.status)));
      })
      .then((payload) => {
        if (live && payload) setData(payload);
      })
      .catch(() => {
        if (live) setLoadFailed(true);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  // Each view is a step in the history, so Back walks between them.
  const pick = (next: View) => {
    if (next === view) return;
    const url = `${window.location.pathname}${window.location.search}${next === "places" ? "" : `#${next}`}`;
    window.history.pushState(window.history.state, "", url);
    // wouter's patched pushState announces this itself; said again here so the view moves even where it is not loaded.
    window.dispatchEvent(new Event("pushState"));
  };
  const onLocked = useCallback(() => setLocked(true), []);

  const canCurate = !!data?.canCurate;
  // A reader without the curator's key who follows a #reports link lands on the shelf.
  const shown: View = view === "reports" && data && !canCurate ? "places" : view;
  const placeCount = data?.places.length ?? 0;
  const photoCount = (data?.places ?? []).reduce((n, p) => n + p.photoCount, 0);
  const open = data?.openReports ?? 0;

  const tabs: ViewTab<View>[] = [
    { key: "places", label: <Trans context="places page">By place</Trans> },
    { key: "photos", label: <Trans context="places page">All photos</Trans> },
  ];
  if (canCurate) {
    tabs.push({
      key: "reports",
      label: open > 0 ? <Trans context="places page">Reports ({open})</Trans> : <Trans context="places page">Reports</Trans>,
    });
  }

  const comingSoon = (
    <ComingSoonPanel
      title={t({ message: "Photographs of the land", context: "coming soon: the places and photographs pages" })}
      body={t({ message: "Photographs of the places on the land will gather here as members add them, each with the name of whoever took it.", context: "coming soon: the places and photographs pages" })}
      door={{ href: "/map", label: t({ message: "Open the map", context: "coming soon: the places and photographs pages, the door meanwhile" }) }}
    />
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="space-y-4">
        <div className="flex items-center gap-4">
          <span className={`${RING} size-14 sm:size-16`} aria-hidden="true">
            <Labyrinth className="size-7 sm:size-8" />
          </span>
          <div className="space-y-1">
            <p className={EYEBROW}><Trans context="places page">The village</Trans></p>
            <h1 className={H1}><Trans context="places page">Places</Trans></h1>
          </div>
        </div>
        <p className={LEDE}><Trans context="places page">The land in pictures. Open a place to walk through it.</Trans></p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {data && placeCount > 0 && (
            <dl className="m-0 grid grid-cols-2 gap-2">
              <div className="min-w-24 rounded-xl border border-border bg-muted px-3 py-2">
                <dt className="text-xs text-muted-foreground"><Trans context="places page">Places</Trans></dt>
                <dd className="m-0 font-display text-2xl leading-tight text-foreground">{placeCount}</dd>
              </div>
              <div className="min-w-24 rounded-xl border border-border bg-muted px-3 py-2">
                <dt className="text-xs text-muted-foreground"><Trans context="places page">Photos</Trans></dt>
                <dd className="m-0 font-display text-2xl leading-tight text-foreground">{photoCount}</dd>
              </div>
            </dl>
          )}
          <Link href="/map" className={`${LINK} inline-flex min-h-11 items-center gap-1.5 text-sm`}>
            <MapIcon className="size-4" aria-hidden="true" />
            <Trans context="places page">See them on the map</Trans>
          </Link>
        </div>
      </header>

      {locked ? (
        <section className={`${CARD} space-y-4`}>
          <p className={NOTE}><Trans context="places page">This village keeps its photos for members.</Trans></p>
          <Link href={`/login?next=${encodeURIComponent(`/places${window.location.hash}`)}`} className={BTN_PRIMARY}>
            <Trans context="places page">Sign in to see them</Trans>
          </Link>
        </section>
      ) : !data && loadFailed ? (
        <LoadFailed onRetry={() => { setLoadFailed(false); setAttempt((n) => n + 1); }} />
      ) : !data ? (
        <BreathingLoader label={t({ message: "Opening the places", context: "places page" })} />
      ) : data.places.length === 0 && !canCurate ? (
        comingSoon
      ) : (
        <>
          <ViewTabs tabs={tabs} value={shown} onChange={pick} label={t({ message: "Ways to browse", context: "places page" })} idPrefix="places" />

          {shown === "places" && (
            <div role="tabpanel" id={panelId("places", "places")} aria-labelledby={tabId("places", "places")} className="space-y-4">
              {data.places.length === 0 ? (
                comingSoon
              ) : (
                <>
                  <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
                    {data.places.map((p) => (
                      <PlaceCard key={p.structureKey} place={p} />
                    ))}
                  </ul>
                  {data.canContribute && (
                    <p className={HINT}><Trans context="places page">To add a photo, open its place.</Trans></p>
                  )}
                </>
              )}
            </div>
          )}
          {shown === "photos" && (
            <div role="tabpanel" id={panelId("places", "photos")} aria-labelledby={tabId("places", "photos")}>
              <PhotoIndex onLocked={onLocked} />
            </div>
          )}
          {shown === "reports" && canCurate && (
            <div role="tabpanel" id={panelId("places", "reports")} aria-labelledby={tabId("places", "reports")}>
              <PhotoReportsPanel />
            </div>
          )}
        </>
      )}
    </div>
  );
}
