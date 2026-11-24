import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock, Sparkles } from "lucide-react";
import { CHIP, CHIP_SOFT, EYEBROW, LEDE, RING } from "@/components/journey/look";

interface Milestone {
  id: string;
  phase: string;
  title: string;
  description: string;
  status: "complete" | "in-progress" | "upcoming" | "future";
  completedDate: string | null;
  updateNote: string;
  order: number;
}

/*
 * THE ROADMAP STANDS IN THE NIGHT WORLD (investor remake, 24 Nov 2026). It was
 * white cards on a stone ground in the middle of the landing, which is night
 * from top to bottom, so it read as a page from another site. It takes the
 * sheet's tokens (docs/DESIGN_RULE.md): gold for what is done, a gold edge for
 * what is under way, the quiet chip for what is ahead. The in-progress icon
 * used to pulse forever beside its words; nothing loops here now.
 */
const NODE = "inline-flex size-11 shrink-0 items-center justify-center rounded-full";
const STATUS_META: Record<Milestone["status"], { label: string; chip: string; node: string; edge: string; Icon: React.ComponentType<{ className?: string }> }> = {
  complete: { label: "Complete", chip: CHIP, node: `${NODE} bg-notice text-background`, edge: "border-notice/60", Icon: CheckCircle2 },
  "in-progress": { label: "In Progress", chip: "inline-flex items-center gap-1 rounded-full border border-notice/70 px-2.5 py-0.5 text-xs font-semibold text-notice", node: RING, edge: "border-border", Icon: Clock },
  upcoming: { label: "Planned", chip: CHIP_SOFT, node: `${NODE} border-2 border-border text-muted-foreground`, edge: "border-border", Icon: Circle },
  future: { label: "Future", chip: CHIP_SOFT, node: `${NODE} border-2 border-dashed border-border text-muted-foreground`, edge: "border-border/70", Icon: Sparkles },
};

export default function BuildProgress() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/milestones")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (alive) { setItems(Array.isArray(data) ? data : []); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  if (!loaded || items.length === 0) return null;

  // Group by phase
  const phases = items.reduce<Record<string, Milestone[]>>((acc, m) => {
    (acc[m.phase] ??= []).push(m);
    return acc;
  }, {});

  return (
    <section className="border-t border-border/60 py-16 sm:py-20">
      <div className="container max-w-5xl">
        <div className="mb-10 max-w-2xl sm:mb-12">
          <p className={`${EYEBROW} mb-3`}>
            Build Progress
          </p>
          <h2 className="mb-3 font-display text-3xl leading-tight text-foreground sm:text-4xl">
            What's Built. What's Coming.
          </h2>
          <p className={LEDE}>
            Real-time milestones from the team. Updated as the village comes online.
          </p>
        </div>

        <ol className="space-y-10">
          {Object.entries(phases).map(([phase, milestones]) => (
            <li key={phase} className="grid gap-4 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-8">
              <h3 className="font-display text-xl text-foreground break-words md:pt-3">
                {phase}
              </h3>
              <ul className="space-y-3">
                {milestones.map((m) => {
                  const meta = STATUS_META[m.status] ?? STATUS_META.upcoming;
                  const Icon = meta.Icon;
                  return (
                    <li
                      key={m.id}
                      className={`flex gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5 ${meta.edge}`}
                    >
                      <span className={meta.node} aria-hidden="true">
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-col-reverse items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-3">
                          <h4 className="min-w-0 font-display text-lg text-card-foreground break-words">
                            {m.title}
                          </h4>
                          <span className={`shrink-0 ${meta.chip}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground break-words">{m.description}</p>
                        {m.completedDate && m.status === "complete" && (
                          <p className="mt-2 text-xs text-muted-foreground">Completed {m.completedDate}</p>
                        )}
                        {m.updateNote && (
                          <p className="mt-3 inline-block rounded-lg border border-notice/40 bg-muted px-3 py-1.5 text-sm text-foreground">
                            {m.updateNote}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
