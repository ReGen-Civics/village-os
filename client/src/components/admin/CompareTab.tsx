/**
 * COMPARE PROPOSALS (the lead, 20 Nov 2026): every proposal waiting for a decision, filtered by the data's own
 * category (a role's circle, a quest's circle), up to four of one category side by side, and a split helper that maps
 * how several qualified candidates could share one role's deliverables without doubling up.
 *
 * Lazy-loaded from Admin (`activeTab === "compare"`), so it costs the first page nothing.
 *
 * THE LINE, said on screen in one sentence: no AI chooses, ranks or scores anybody here. The person marks who they
 * consider qualified first; the helper then only maps deliverables and commitments (shared/deliverableSplit.ts, plain
 * rules, no model). Every split is a suggestion a person edits, and nothing on this page accepts, declines, sends or
 * saves: each proposal's own page is where a person decides, and the links open its counter-offer prefilled for them
 * to read and save, or not.
 *
 * Rows line up across the columns on a wide screen (one grid, the same field on the same line); on a phone the
 * columns become a row of cards to swipe through.
 *
 * Drawn in the profile's look (docs/DESIGN_RULE.md, client/src/components/journey/look.ts).
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { MAX_COMPARE, inCategory, pickedItems, togglePick, type CompareItem, type ComparePayload, type CompareRole, type CompareWay, type PickProblem } from "@shared/proposalCompare";
import { fittedCommitments, heldByNobody, heldTwice, mapDeliverables, movePiece, type DeliverableMap, type SplitRule } from "@shared/deliverableSplit";
import { BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, FIELD, HINT, LINK, TILE } from "@/components/journey/look";
import { API_BASE, authHeaders, refusal } from "./adminApi";

const COL = "min-w-0 border-t border-border px-3 py-3 text-sm text-foreground";
/** Admin sets `white-space: nowrap` on every cell outside any layer (adminNight.css), which beats a utility class. */
const WRAP = { whiteSpace: "normal" } as const;
const LABEL_CELL = "border-t border-border px-3 py-3 text-sm font-semibold text-muted-foreground";

export default function CompareTab({ password }: { password: string }) {
  const { t } = useLingui();
  const [data, setData] = useState<ComparePayload | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [problem, setProblem] = useState<PickProblem | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API_BASE}/admin/proposal-compare`, { headers: authHeaders(password), signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? t({ message: "Comparing proposals is open to the people who read them at the admin desk.", context: "admin compare" }) : refusal(d, t({ message: "The proposals could not be read just now. Try again in a moment.", context: "admin compare" })));
        setData(d as ComparePayload);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(String(e?.message ?? e));
      });
    return () => ctrl.abort();
  }, [password, t]);

  const items = data?.items ?? [];
  const shown = useMemo(() => inCategory(items, category), [items, category]);
  const picked = useMemo(() => pickedItems(keys, items), [keys, items]);
  const categoryLabel = (key: string): string => {
    const c = data?.categories.find((x) => x.key === key);
    if (c?.label) return c.label;
    return key.startsWith("quest:") ? t({ message: "Quests with no circle", context: "admin compare" }) : t({ message: "No circle", context: "admin compare" });
  };
  const wayWords = (w: CompareWay): string =>
    ({
      full: t({ message: "Full application", context: "admin compare, how a proposal came in" }),
      early: t({ message: "Early application, the role was coming soon", context: "admin compare, how a proposal came in" }),
      conversation: t({ message: "Start a conversation", context: "admin compare, how a proposal came in" }),
      member: t({ message: "A member's application", context: "admin compare, how a proposal came in" }),
      quest: t({ message: "Quest idea", context: "admin compare, how a proposal came in" }),
    })[w];
  const whoWords = (i: CompareItem): string => i.who || (i.whoKind === "visitor" ? t({ message: "A visitor", context: "admin compare" }) : i.whoKind === "machine" ? t({ message: "Drafted by a tool, sent for a person to read", context: "admin compare" }) : t({ message: "No name given", context: "admin compare" }));
  const problemWords = (p: PickProblem): string =>
    p === "too-many"
      ? t({ message: `You can compare up to ${MAX_COMPARE} at a time. Untick one to add another.`, context: "admin compare" })
      : t({ message: "Compare one category at a time. Untick these first to pick from another.", context: "admin compare" });

  const tick = (item: CompareItem) => {
    const out = togglePick(keys, item, items);
    setKeys(out.keys);
    setProblem(out.problem);
  };

  return (
    <div className="space-y-6" data-compare-tab="">
      <header className="space-y-2">
        <p className={EYEBROW}>{t({ message: "Compare", context: "admin compare" })}</p>
        <h2 className="font-display text-2xl font-bold text-foreground">{t({ message: "Proposals side by side", context: "admin compare" })}</h2>
        <p className={`max-w-2xl ${HINT}`}>
          {t({ message: `Every role application and quest idea waiting for a decision. Pick a category, then tick up to ${MAX_COMPARE} to read them side by side.`, context: "admin compare" })}
        </p>
        <p className="max-w-2xl text-sm font-semibold text-foreground" data-compare-rule="">
          {t({ message: "No AI chooses, ranks or scores anyone here: you decide who is qualified, and accepting happens on each proposal's own page.", context: "admin compare" })}
        </p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
      {!data && !error && <p className={HINT}>{t({ message: "Reading the proposals…", context: "admin compare" })}</p>}

      {data && (
        <section className={CARD} aria-labelledby="compare-list">
          <h3 id="compare-list" className="sr-only">{t({ message: "Waiting for a decision", context: "admin compare" })}</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t({ message: "Category", context: "admin compare" })}>
            <CategoryChip on={category === null} onClick={() => setCategory(null)} label={t({ message: `All (${items.length})`, context: "admin compare" })} />
            {data.categories.map((c) => (
              <CategoryChip key={c.key} on={category === c.key} onClick={() => setCategory(c.key)} label={`${categoryLabel(c.key)} (${c.count})`} />
            ))}
          </div>

          <p aria-live="polite" className="mt-4 min-h-6 text-sm font-semibold text-notice" data-compare-problem="">
            {problem ? problemWords(problem) : picked.length ? t({ message: `${picked.length} of ${MAX_COMPARE} ticked, all in ${categoryLabel(picked[0].category)}.`, context: "admin compare" }) : ""}
          </p>

          {shown.length === 0 ? (
            <p className={`mt-2 ${HINT}`}>{t({ message: "Nothing is waiting for a decision here.", context: "admin compare" })}</p>
          ) : (
            <ul className="mt-2 grid gap-2" data-compare-list="">
              {shown.map((i) => {
                const on = keys.includes(i.key);
                return (
                  <li key={i.key}>
                    <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 ${on ? "border-notice bg-notice/10" : "border-border bg-muted"}`}>
                      <input type="checkbox" className="mt-1 size-5 shrink-0 accent-notice" checked={on} onChange={() => tick(i)} data-compare-pick={i.key} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="font-semibold text-foreground">{whoWords(i)}</span>
                          <span className={CHIP_SOFT}>{wayWords(i.way)}</span>
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {i.title}
                          {i.commitmentPct !== null && ` · ${t({ message: `${i.commitmentPct}% commitment`, context: "admin compare" })}`}
                          {i.dates.received && ` · ${t({ message: `arrived ${i.dates.received}`, context: "admin compare" })}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {picked.length > 0 && <SideBySide items={picked} wayWords={wayWords} whoWords={whoWords} onUntick={tick} />}
      {picked.some((i) => i.kind === "role") && data && <SplitHelper items={picked.filter((i) => i.kind === "role")} roles={data.roles} whoWords={whoWords} />}
    </div>
  );
}

function CategoryChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "border-notice bg-notice text-background" : "border-border bg-card text-foreground hover:bg-muted"}`}
    >
      {label}
    </button>
  );
}

/** The comparison: one grid on a wide screen so each field sits on one line across the columns, cards to swipe on a phone. */
function SideBySide({ items, wayWords, whoWords, onUntick }: { items: CompareItem[]; wayWords: (w: CompareWay) => string; whoWords: (i: CompareItem) => string; onUntick: (i: CompareItem) => void }) {
  const { t } = useLingui();
  const rows: Array<{ key: string; label: string; cell: (i: CompareItem) => ReactNode }> = [
    { key: "who", label: t({ message: "Who", context: "admin compare row" }), cell: (i) => <span className="font-semibold">{whoWords(i)}</span> },
    { key: "title", label: t({ message: "Role or quest", context: "admin compare row" }), cell: (i) => i.title },
    { key: "way", label: t({ message: "How it came in", context: "admin compare row" }), cell: (i) => wayWords(i.way) },
    {
      key: "commitment",
      label: t({ message: "Commitment", context: "admin compare row" }),
      cell: (i) => (i.commitmentPct !== null ? t({ message: `${i.commitmentPct}% of their energy and attention`, context: "admin compare" }) : <Empty />),
    },
    { key: "aim", label: t({ message: "Their aim", context: "admin compare row" }), cell: (i) => (i.aim ? <p className="whitespace-pre-line">{i.aim}</p> : <Empty />) },
    { key: "deliverables", label: t({ message: "What they would deliver", context: "admin compare row" }), cell: (i) => <Deliverables item={i} /> },
    { key: "terms", label: t({ message: "Their terms", context: "admin compare row" }), cell: (i) => <Terms item={i} /> },
    { key: "dates", label: t({ message: "Dates", context: "admin compare row" }), cell: (i) => <Dates item={i} /> },
    {
      key: "link",
      label: t({ message: "Full proposal", context: "admin compare row" }),
      cell: (i) => (
        <div className="flex flex-wrap items-center gap-3">
          <a className={LINK} href={i.href}>{t({ message: "Open the full proposal", context: "admin compare" })}</a>
          <button type="button" className={BTN_SECONDARY} onClick={() => onUntick(i)}>{t({ message: "Untick", context: "admin compare" })}</button>
        </div>
      ),
    },
  ];
  return (
    <section className={CARD} aria-labelledby="compare-side" data-compare-side="">
      <p className={EYEBROW}>{t({ message: "Side by side", context: "admin compare" })}</p>
      <h3 id="compare-side" className="font-display text-xl font-bold text-foreground">{t({ message: `${items.length} proposals`, context: "admin compare" })}</h3>
      {/* Wide: one grid, the label then one cell per proposal on every line, so the same field always lines up. */}
      <div className="mt-4 hidden overflow-x-auto md:block">
        <div className="grid" style={{ gridTemplateColumns: `7.5rem repeat(${items.length}, minmax(10rem, 1fr))` }} data-compare-grid="">
          {rows.map((r) => [
            <div key={`${r.key}-label`} className={LABEL_CELL}>{r.label}</div>,
            ...items.map((i) => (
              <div key={`${r.key}-${i.key}`} className={COL} data-compare-cell={r.key}>{r.cell(i)}</div>
            )),
          ])}
        </div>
      </div>
      {/* Phone: one card per proposal, swiped sideways, each field under its own label in the same order. */}
      <div className="-mx-2 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2 md:hidden" data-compare-swipe="">
        {items.map((i) => (
          <article key={i.key} className={`${TILE} w-[85%] shrink-0 snap-center`} aria-label={whoWords(i)}>
            <dl className="grid gap-3">
              {rows.map((r) => (
                <div key={r.key}>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{r.label}</dt>
                  <dd className="mt-1 text-sm text-foreground">{r.cell(i)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      {items.length > 1 && <p className={`mt-2 md:hidden ${HINT}`}>{t({ message: "Swipe sideways to read the next one.", context: "admin compare" })}</p>}
    </section>
  );
}

function Empty() {
  const { t } = useLingui();
  return <span className="text-muted-foreground">{t({ message: "Not given", context: "admin compare" })}</span>;
}

function Deliverables({ item }: { item: CompareItem }) {
  const { t } = useLingui();
  if (!item.deliverables.length) return <Empty />;
  return (
    <ul className="grid gap-2">
      {item.deliverables.map((d, n) => (
        <li key={n} className="rounded-lg border border-border bg-background px-2 py-1.5">
          <span>{d.text}</span>
          {d.doneWhen && <span className="block text-xs text-muted-foreground">{t({ message: `Done when: ${d.doneWhen}`, context: "admin compare" })}</span>}
          {d.date && <span className="block text-xs text-muted-foreground">{t({ message: `By ${d.date}`, context: "admin compare" })}</span>}
        </li>
      ))}
    </ul>
  );
}

function Terms({ item }: { item: CompareItem }) {
  const { t } = useLingui();
  const x = item.terms;
  if (!x || (!x.choice && !x.talkAbout.length && !x.note && !x.rampUp && !x.ask && !x.countered)) return <Empty />;
  return (
    <div className="grid gap-1">
      {x.choice && <span>{x.choice === "accept" ? t({ message: "Accepts the terms on offer", context: "admin compare" }) : t({ message: "Would like to talk about the terms", context: "admin compare" })}</span>}
      {x.talkAbout.length > 0 && <span className="text-muted-foreground">{t({ message: `To talk about: ${x.talkAbout.join(", ")}`, context: "admin compare" })}</span>}
      {x.note && <span className="whitespace-pre-line text-muted-foreground">{x.note}</span>}
      {x.rampUp && <span>{t({ message: "Asks to ramp up over time", context: "admin compare" })}</span>}
      {x.ask?.kind === "amount" && <span>{t({ message: `Asks ${x.ask.amount} each ${x.ask.per}`, context: "admin compare" })}</span>}
      {x.ask?.kind === "negotiate" && <span>{t({ message: "Price to talk about on the first call", context: "admin compare" })}</span>}
      {x.countered && <span className={CHIP_SOFT}>{t({ message: "Counter-offer sent", context: "admin compare" })}</span>}
    </div>
  );
}

function Dates({ item }: { item: CompareItem }) {
  const { t } = useLingui();
  const d = item.dates;
  const lines = [
    d.earliestStart && t({ message: `Earliest start: ${d.earliestStart}`, context: "admin compare" }),
    d.startsOn && t({ message: `Asks to begin: ${d.startsOn}`, context: "admin compare" }),
    d.termStarts && d.termEnds && t({ message: `For the moon ${d.termStarts} to ${d.termEnds}`, context: "admin compare" }),
    !d.termStarts && d.termEnds && t({ message: `Term ends: ${d.termEnds}`, context: "admin compare" }),
    d.received && t({ message: `Arrived: ${d.received}`, context: "admin compare" }),
  ].filter(Boolean) as string[];
  return lines.length ? <div className="grid gap-1">{lines.map((l) => <span key={l}>{l}</span>)}</div> : <Empty />;
}

/**
 * THE SPLIT HELPER. A person marks who they consider qualified; the helper maps those candidates' deliverables for one
 * role: what overlaps (each overlap named), what only one offered, what the role asks that nobody offered, whether the
 * commitments add up, and one or two ways to share the work so nobody doubles up. Every piece can be moved by hand.
 */
function SplitHelper({ items, roles, whoWords }: { items: CompareItem[]; roles: CompareRole[]; whoWords: (i: CompareItem) => string }) {
  const { t } = useLingui();
  const roleIds = Array.from(new Set(items.map((i) => i.roleId).filter((x): x is string => !!x)));
  const [roleId, setRoleId] = useState<string>(roleIds[0] ?? "");
  const [qualified, setQualified] = useState<string[]>([]);
  const [rule, setRule] = useState<SplitRule>("fewest-first");
  const [edited, setEdited] = useState<Record<string, string[]> | null>(null);
  const role = roles.find((r) => r.id === roleId) ?? null;
  const forRole = items.filter((i) => i.roleId === roleId);
  const activeRole = roleIds.includes(roleId) ? roleId : roleIds[0] ?? "";
  useEffect(() => {
    if (activeRole !== roleId) setRoleId(activeRole);
  }, [activeRole, roleId]);

  const candidates = forRole.map((i) => ({ key: i.key, deliverables: i.deliverables.map((d) => d.text), commitmentPct: i.commitmentPct }));
  const order = forRole.map((i) => i.key).filter((k) => qualified.includes(k));
  const map: DeliverableMap | null = role && order.length ? mapDeliverables(candidates, order, role.outcomes, role.commitmentTarget) : null;
  const split = map ? map.splits.find((s) => s.rule === rule) ?? map.splits[0] : null;
  const holds = edited ?? split?.holds ?? {};
  const pieceText = (id: string) => map?.pieces.find((p) => p.id === id)?.text ?? id;
  const nameOf = (key: string) => {
    const i = forRole.find((x) => x.key === key);
    return i ? whoWords(i) : key;
  };
  const reset = () => setEdited(null);
  const fitted = map ? fittedCommitments(candidates.filter((c) => order.includes(c.key)), role?.commitmentTarget ?? null) : {};
  const twice = heldTwice(holds);
  const nobody = map ? heldByNobody(map, holds) : [];
  const ruleWords = (r: SplitRule) =>
    r === "fewest-first"
      ? t({ message: "Each shared piece goes to whoever holds the fewest so far", context: "admin compare split rule" })
      : t({ message: "Each shared piece goes to whoever has the most room for their commitment", context: "admin compare split rule" });

  return (
    <section className={CARD} aria-labelledby="compare-split" data-compare-split="">
      <p className={EYEBROW}>{t({ message: "Split helper", context: "admin compare" })}</p>
      <h3 id="compare-split" className="font-display text-xl font-bold text-foreground">{t({ message: "Share one role across several people", context: "admin compare" })}</h3>
      <p className={`mt-2 max-w-2xl ${HINT}`}>
        {t({ message: "Mark who you consider qualified. The helper then maps only their deliverables and commitments, by plain rules written beside each split. It never says who is better, and nothing here is sent or saved.", context: "admin compare" })}
      </p>

      {roleIds.length > 1 && (
        <label className="mt-4 grid max-w-sm gap-1">
          <span className="text-sm font-semibold text-foreground">{t({ message: "Role", context: "admin compare" })}</span>
          <select className={FIELD} value={activeRole} onChange={(e) => { setRoleId(e.target.value); setEdited(null); }}>
            {roleIds.map((id) => <option key={id} value={id}>{roles.find((r) => r.id === id)?.name ?? id}</option>)}
          </select>
        </label>
      )}

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-foreground">{t({ message: `Who do you consider qualified for ${role?.name ?? ""}?`, context: "admin compare" })}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {forRole.map((i) => (
            <label key={i.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted px-3">
              <input
                type="checkbox"
                className="size-5 accent-notice"
                checked={qualified.includes(i.key)}
                onChange={() => { setQualified((q) => (q.includes(i.key) ? q.filter((k) => k !== i.key) : [...q, i.key])); setEdited(null); }}
                data-compare-qualified={i.key}
              />
              <span className="text-sm text-foreground">{whoWords(i)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {!map && <p className={`mt-4 ${HINT}`}>{t({ message: "Mark at least one person to see the map.", context: "admin compare" })}</p>}

      {map && role && (
        <div className="mt-6 grid gap-6" data-compare-map="">
          <div className={TILE}>
            <p className="text-sm font-semibold text-foreground">{t({ message: "Commitment", context: "admin compare" })}</p>
            <p className="mt-1 text-sm text-foreground" data-compare-commitment={map.commitment.state}>
              {map.commitment.state === "fits"
                ? t({ message: `Together they give ${map.commitment.total}%, exactly the ${map.commitment.target}% the role needs.`, context: "admin compare" })
                : map.commitment.state === "over"
                  ? t({ message: `Together they give ${map.commitment.total}%, ${map.commitment.gap}% more than the ${map.commitment.target}% the role needs.`, context: "admin compare" })
                  : t({ message: `Together they give ${map.commitment.total}%, ${map.commitment.gap}% short of the ${map.commitment.target}% the role needs.`, context: "admin compare" })}
            </p>
            {map.commitment.unknown.length > 0 && <p className={`mt-1 ${HINT}`}>{t({ message: `Gave no commitment: ${map.commitment.unknown.map(nameOf).join(", ")}.`, context: "admin compare" })}</p>}
            <p className={`mt-1 ${HINT}`} data-compare-places="">
              {role.taken + order.length > role.places
                ? t({ message: `The role holds ${role.places} at once and ${role.taken} hold it now. Seating ${order.length} more needs ${role.taken + order.length} places: change the number on the role in the Org Chart first.`, context: "admin compare" })
                : t({ message: `The role holds ${role.places} at once and ${role.taken} hold it now, so there is room for ${order.length} more.`, context: "admin compare" })}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">{t({ message: "Where they overlap", context: "admin compare" })}</p>
            {map.overlaps.length === 0 ? (
              <p className={`mt-1 ${HINT}`}>{t({ message: "No two of them offered the same piece of work.", context: "admin compare" })}</p>
            ) : (
              <ul className="mt-2 grid gap-2" data-compare-overlaps="">
                {map.overlaps.map((o) => (
                  <li key={o.pieceId} className="rounded-lg border border-notice/60 bg-notice/10 px-3 py-2 text-sm text-foreground">
                    {t({ message: `${o.by.map(nameOf).join(" and ")} both offered: ${o.text}`, context: "admin compare overlap" })}
                  </li>
                ))}
              </ul>
            )}
            {map.unclaimed.length > 0 && (
              <p className={`mt-2 ${HINT}`} data-compare-unclaimed="">{t({ message: `The role asks for this and nobody offered it: ${map.unclaimed.map(pieceText).join("; ")}.`, context: "admin compare" })}</p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">{t({ message: "A way to share the work", context: "admin compare" })}</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t({ message: "Split rule", context: "admin compare" })}>
              {map.splits.map((s) => (
                <button key={s.rule} type="button" aria-pressed={rule === s.rule} onClick={() => { setRule(s.rule); setEdited(null); }} className={`min-h-11 rounded-lg border px-3 text-left text-sm ${rule === s.rule ? "border-notice bg-notice/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {ruleWords(s.rule)}
                </button>
              ))}
            </div>
            <p className={`mt-2 ${HINT}`}>{t({ message: "A tie goes to whoever you marked first. Move any piece to someone else; this is a suggestion for you to edit.", context: "admin compare" })}</p>

            <div className="mt-3 overflow-x-auto">
              <table className="block w-full border-collapse text-sm md:table" data-compare-split-table="">
                <thead className="hidden md:table-header-group">
                  <tr>
                    <th scope="col" className="border-b border-border px-2 py-2 text-left font-semibold text-foreground">{t({ message: "Candidate", context: "admin compare" })}</th>
                    <th scope="col" className="border-b border-border px-2 py-2 text-left font-semibold text-foreground">{t({ message: "The deliverables they would hold", context: "admin compare" })}</th>
                    <th scope="col" className="border-b border-border px-2 py-2 text-left font-semibold text-foreground">{t({ message: "Commitment", context: "admin compare" })}</th>
                  </tr>
                </thead>
                <tbody className="block md:table-row-group">
                  {map.candidates.map((k) => {
                    const item = forRole.find((x) => x.key === k);
                    const fit = fitted[k];
                    const mine = holds[k] ?? [];
                    const prefillHref = item && fit !== null && fit !== undefined ? `${item.href}?commitment=${fit}&role=${encodeURIComponent(roleId)}` : item?.href;
                    return (
                      <tr key={k} className="block border-b border-border py-2 align-top md:table-row md:py-0" data-compare-split-row={k}>
                        <th scope="row" className="block px-2 pt-2 text-left font-semibold text-foreground md:table-cell md:border-b md:border-border md:py-3">{nameOf(k)}</th>
                        <td style={WRAP} className="block px-2 py-2 md:table-cell md:border-b md:border-border md:py-3">
                          {mine.length === 0 ? (
                            <span className="text-muted-foreground">{t({ message: "Nothing in this split", context: "admin compare" })}</span>
                          ) : (
                            <ul className="grid gap-2">
                              {mine.map((id) => {
                                const offeredBy = map.pieces.find((p) => p.id === id)?.offeredBy ?? [];
                                return (
                                  <li key={id} className="grid gap-1">
                                    <span>{pieceText(id)}</span>
                                    <select
                                      aria-label={t({ message: `Move "${pieceText(id)}" to`, context: "admin compare" })}
                                      className="min-h-11 w-full max-w-xs rounded-lg border border-border bg-background px-2 text-sm text-foreground"
                                      value={k}
                                      onChange={(e) => setEdited(movePiece(holds, id, e.target.value === "" ? null : e.target.value))}
                                    >
                                      {map.candidates.map((c) => (
                                        <option key={c} value={c}>{offeredBy.includes(c) ? nameOf(c) : t({ message: `${nameOf(c)} (did not offer it)`, context: "admin compare" })}</option>
                                      ))}
                                      <option value="">{t({ message: "Nobody for now", context: "admin compare" })}</option>
                                    </select>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </td>
                        <td style={WRAP} className="block px-2 pb-2 md:table-cell md:border-b md:border-border md:py-3">
                          <span className="block">{item?.commitmentPct !== null && item?.commitmentPct !== undefined ? t({ message: `${item.commitmentPct}% offered`, context: "admin compare" }) : t({ message: "None given", context: "admin compare" })}</span>
                          {fit !== null && fit !== undefined && fit !== item?.commitmentPct && <span className="block text-muted-foreground">{t({ message: `${fit}% would fit the role`, context: "admin compare" })}</span>}
                          {prefillHref && (
                            <a className={`${LINK} mt-1 block break-words`} href={prefillHref} data-compare-prefill={k}>
                              {fit !== null && fit !== undefined && fit !== item?.commitmentPct ? t({ message: `Open their proposal with ${fit}% in the counter-offer`, context: "admin compare" }) : t({ message: "Open their proposal", context: "admin compare" })}
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(twice.length > 0 || nobody.length > 0 || edited) && (
              <div className="mt-2 grid gap-1 text-sm">
                {twice.length > 0 && <p className="text-notice">{t({ message: `Held twice in this split: ${twice.map(pieceText).join("; ")}.`, context: "admin compare" })}</p>}
                {nobody.length > 0 && <p className="text-muted-foreground">{t({ message: `Offered but held by nobody now: ${nobody.map(pieceText).join("; ")}.`, context: "admin compare" })}</p>}
                {edited && <button type="button" className={`${BTN_SECONDARY} w-fit`} onClick={reset}>{t({ message: "Put the suggestion back", context: "admin compare" })}</button>}
              </div>
            )}
            <p className={`mt-3 ${HINT}`}>
              {t({ message: "The link opens their proposal with the commitment typed into the counter-offer. Nothing changes until you read it and press Save there, and accepting stays on that page.", context: "admin compare" })}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
