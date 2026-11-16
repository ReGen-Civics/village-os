/**
 * `/role-path/:roleId`: A ROLE'S PATH, built to the village onboarding
 * design's path screen. What a role asks for before anyone applies
 * (`roles.prerequisites`), what the reader already has, who holds it now, and
 * the role's own application door at the end.
 *
 *   HEADER        the role's name and its purpose
 *   YOUR WAY      each item it asks, done or not, then "Apply"
 *   HOLDS IT NOW  the role (first names), live (III.2)
 *   THE STEPS     the quests it asks, numbered, with what each asks
 *   THE FEE       the product it asks, its price and where to pay
 *
 * Lazy-loaded; theme slots only; the words of the role and its steps are the
 * village's own data.
 */
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Check, Circle } from "lucide-react";
import Layout from "@/components/Layout";
import { SignInDoors } from "@/components/modules/ModuleGate";
import { useAuth } from "@/contexts/AuthContext";
import { BreathingLoader } from "@/components/natural";
import { BTN_PRIMARY, CARD, EYEBROW, H1, H2, HINT, LEDE, LINK, RING, WORLD } from "@/components/journey/look";
import { applySeatsHref } from "@shared/seatApplyLinks";
import { ask, PATH_WORDS as W, roleWithHolders, usd } from "@/components/seasonPlaces/seasonApi";

interface PathPayload {
  roleId: string;
  name: string;
  aim: string | null;
  holders: string[];
  items: Array<{ kind: "product" | "quest"; id: string; title: string; detail: string | null; amountMinor: number | null; href: string; done: boolean }>;
}

const PANEL = "rounded-2xl border border-border bg-card/60 p-4";

export default function RolePath() {
  const { user } = useAuth();
  const [, params] = useRoute("/role-path/:roleId");
  const roleId = params?.roleId ?? "";
  const [path, setPath] = useState<PathPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "members">("loading");

  useEffect(() => {
    if (!user || !roleId) return;
    let alive = true;
    void ask(`/api/governance/role-path/${encodeURIComponent(roleId)}`).then((out) => {
      if (!alive) return;
      if (out.ok) { setPath(out.data); setState("ready"); }
      else setState(out.status === 401 ? "members" : "missing");
    });
    return () => { alive = false; };
  }, [user, roleId]);

  if (!user || state === "members") {
    return (
      <Layout>
        <div className={`${WORLD} py-8`}>
          <div className={`mx-auto max-w-xl px-4 ${CARD} text-center`}><SignInDoors next={`/role-path/${encodeURIComponent(roleId)}`} /></div>
        </div>
      </Layout>
    );
  }

  const quests = path?.items.filter((i) => i.kind === "quest") ?? [];
  const fees = path?.items.filter((i) => i.kind === "product") ?? [];
  const allDone = (path?.items ?? []).every((i) => i.done);

  return (
    <Layout>
      <div className={`${WORLD} py-6 sm:py-10`}>
        <div className="mx-auto max-w-xl space-y-5 px-4">
          {state === "loading" && <div className="flex justify-center py-16"><BreathingLoader label={W.loading} /></div>}
          {state === "missing" && <p className={LEDE}>{W.notFound}</p>}
          {state === "ready" && path && (
            <>
              <header className="space-y-2">
                <p className={EYEBROW}>{W.eyebrow}</p>
                <h1 className={H1}>{W.title(path.name)}</h1>
                {path.aim && <p className={LEDE}>{path.aim}</p>}
              </header>

              <section className={PANEL}>
                <p className={EYEBROW}>{W.wayThere}</p>
                {path.items.length === 0 && <p className={`mt-2 ${HINT}`}>{W.nothingAsked}</p>}
                <ul className="mt-2 divide-y divide-border">
                  {path.items.map((i) => (
                    <li key={`${i.kind}:${i.id}`} className="flex items-center gap-3 py-3">
                      {i.done ? <Check className="size-6 shrink-0 rounded-full bg-chart-3 p-1 text-background" aria-hidden="true" /> : <Circle className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      <a href={i.href} className="flex-1 text-foreground">{i.title}</a>
                      {i.done && <span className={HINT}>{W.done}</span>}
                    </li>
                  ))}
                  <li className="flex items-center gap-3 py-3">
                    <Circle className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1 text-foreground">{W.apply(path.name)}</span>
                    <span className={HINT}>{W.applyLine}</span>
                  </li>
                </ul>
              </section>

              <section className={`${PANEL} flex items-center gap-4`}>
                <span className={`${RING} font-display text-lg`}>{(path.holders[0] ?? path.name).charAt(0)}</span>
                <div>
                  <p className={HINT}>{W.holdsItNow}</p>
                  <p className="font-semibold text-foreground">{path.holders.length ? roleWithHolders(path.name, path.holders) : W.nobodyHolds}</p>
                </div>
              </section>

              {quests.length > 0 && (
                <section className="space-y-2">
                  <h2 className={H2}>{W.steps}</h2>
                  <ol className="divide-y divide-border">
                    {quests.map((q, n) => (
                      <li key={q.id} className="flex items-start gap-3 py-3">
                        <span className={`${RING} size-8 text-sm`}>{n + 1}</span>
                        <a href={q.href} className="flex-1">
                          <b className={`block ${q.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{q.title}</b>
                          {q.detail && <span className={HINT}>{q.detail}</span>}
                        </a>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {fees.map((f) => (
                <section key={f.id} className="flex items-center gap-4">
                  {f.amountMinor !== null && <p className="font-display text-3xl text-primary">{usd(f.amountMinor)}</p>}
                  {f.done
                    ? <span className={HINT}>{W.paid}</span>
                    : <a href={f.href} className={`${BTN_PRIMARY} flex-1`}>{W.pay(f.title)}</a>}
                </section>
              ))}

              {allDone && <Link href={applySeatsHref([path.roleId], { from: `/role-path/${path.roleId}` })} className={`${BTN_PRIMARY} w-full`}>{W.applyNow}</Link>}
              <Link href="/season-places/circles" className={LINK}>{W.seeCircles}</Link>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
