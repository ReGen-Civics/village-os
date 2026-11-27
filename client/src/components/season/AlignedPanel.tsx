/**
 * ALIGNED, the Aligned tab of `/season`. It was the page `/aligned` (seat
 * settings PR6) until the season fold (27 Nov 2026), and it now opens with the
 * reader's own standing, which is what a member comes here for:
 *
 *   WAITING ON YOU   every text the reader is a party to and may align with
 *                    now, each with its Align button (AlignmentCard)
 *   THE AGREEMENT    the village's confidentiality agreement (role journey L7),
 *                    for anybody signed in: a newcomer aligns here before their
 *                    role starts
 *   THE REGISTER     every set of terms in the alignment store, every version,
 *                    for a member holding `terms.read`: searched on the server,
 *                    filtered by kind, grouped by the year each text was written,
 *                    read a page at a time, and no count anywhere (R55)
 *
 * A signed-in guest is answered 401 by the register and reads one sentence in
 * its place; the agreement above still draws for them.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Search } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { BreathingLoader } from "@/components/natural";
import AlignmentCard from "@/components/alignment/AlignmentCard";
import RegisterEntry from "@/components/alignment/RegisterEntry";
import ConfidentialityCard, {
  type ConfidentialityState,
} from "@/components/alignment/ConfidentialityCard";
import {
  fetchMyAlignments,
  fetchRegister,
  type ServedAlignment,
} from "@/components/alignment/alignmentsApi";
import { ALIGNED_WORDS, type RegisterRow } from "@shared/alignedRegister";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  EYEBROW,
  FIELD,
  H2,
  HINT,
  LABEL,
  LEDE,
  TILE,
} from "@/components/journey/look";

type Phase = "loading" | "ready" | "members" | "error";

/** What the page's trail reads off this tab. `waiting` is null until the reader's own list has answered. */
export interface AlignedStatus {
  waiting: number | null;
  agreement: ConfidentialityState | null;
}

/** The texts asking this reader to align now: pending, and theirs to align with. */
export function waitingOnYou(
  rows: readonly ServedAlignment[]
): ServedAlignment[] {
  return rows.filter(
    r => r.state === "pending" && !!r.you?.mayAlign && !r.you.aligned
  );
}

function Register() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [kinds, setKinds] = useState<Array<{ id: string; label: string }>>([]);
  const [kind, setKind] = useState<string | null>(null);
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [read, setRead] = useState(0);
  const [more, setMore] = useState(false);
  const [readingMore, setReadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    setPhase("loading");
    void fetchRegister({ q: query || undefined, kind: kind ?? undefined }).then(
      a => {
        if (!alive) return;
        if (a.ok) {
          setKinds(a.data.kinds ?? []);
          setRows(a.data.rows ?? []);
          setRead((a.data.rows ?? []).length);
          setMore(!!a.data.more);
          setPhase("ready");
        } else if (a.status === 401) setPhase("members");
        else {
          setError(a.error);
          setPhase("error");
        }
      }
    );
    return () => {
      alive = false;
    };
  }, [query, kind]);

  /** Merged by id, never appended: offset paging over a growing record can hand back a row already here. */
  const readMore = async () => {
    if (readingMore) return;
    setReadingMore(true);
    const a = await fetchRegister({ offset: read, kind: kind ?? undefined });
    if (a.ok) {
      setRows(prev => {
        const byId = new Map(prev.map(r => [r.textId, r]));
        for (const r of a.data.rows ?? []) byId.set(r.textId, r);
        return Array.from(byId.values());
      });
      setRead(n => n + (a.data.rows ?? []).length);
      setMore(!!a.data.more);
    } else setError(a.error);
    setReadingMore(false);
  };

  const years = useMemo(() => {
    const by = new Map<string, RegisterRow[]>();
    for (const r of rows) {
      const list = by.get(r.year);
      if (list) list.push(r);
      else by.set(r.year, [r]);
    }
    return Array.from(by.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(draft.trim());
  };

  return (
    <section
      aria-labelledby="aligned-register-h"
      className={`${CARD} space-y-6`}
      data-aligned-register=""
    >
      <div>
        <p className={EYEBROW}>{ALIGNED_WORDS.eyebrow}</p>
        <h2 id="aligned-register-h" className={`${H2} mt-1`}>
          <Trans context="season page, the aligned register heading">
            The register
          </Trans>
        </h2>
        <p className={`${LEDE} mt-2`}>{ALIGNED_WORDS.lede}</p>
      </div>

      {phase === "members" ? (
        <div className={TILE}>
          <p className="font-semibold text-foreground">
            {ALIGNED_WORDS.membersOnly}
          </p>
          <p className={`${HINT} mt-1`}>{ALIGNED_WORDS.membersOnlyLine}</p>
        </div>
      ) : (
        <>
          <form
            role="search"
            onSubmit={submit}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="aligned-search" className={`block ${LABEL}`}>
                {ALIGNED_WORDS.searchLabel}
              </label>
              <input
                id="aligned-search"
                type="search"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={ALIGNED_WORDS.searchPlaceholder}
                maxLength={200}
                className={`${FIELD} mt-1 min-h-11`}
              />
            </div>
            <button type="submit" className={BTN_PRIMARY}>
              <Search className="size-4" aria-hidden="true" />
              {ALIGNED_WORDS.search}
            </button>
          </form>

          {kinds.length > 1 && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={ALIGNED_WORDS.kinds}
            >
              {[
                { id: null as string | null, label: ALIGNED_WORDS.everyKind },
                ...kinds,
              ].map(k => (
                <button
                  key={k.id ?? "all"}
                  type="button"
                  aria-pressed={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={`jw-btn inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${kind === k.id ? "border-notice bg-notice text-background" : "border-border text-foreground hover:bg-muted"}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          )}

          {phase === "loading" && (
            <div className="flex justify-center py-10">
              <BreathingLoader label={ALIGNED_WORDS.loading} />
            </div>
          )}
          {phase === "error" && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}

          {phase === "ready" && query && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-xl text-foreground">
                  {ALIGNED_WORDS.results(query)}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setDraft("");
                    setQuery("");
                  }}
                  className={BTN_SECONDARY}
                >
                  {ALIGNED_WORDS.clear}
                </button>
              </div>
              {rows.length === 0 ? (
                <p className={`${HINT} mt-3`}>{ALIGNED_WORDS.noResults}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {rows.map(r => (
                    <li key={r.textId}>
                      <RegisterEntry row={r} headingLevel={4} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {phase === "ready" && !query && rows.length === 0 && (
            <div className={`${TILE} text-center`}>
              <p className={HINT}>{ALIGNED_WORDS.empty}</p>
            </div>
          )}

          {phase === "ready" &&
            !query &&
            years.map(([year, list]) => (
              <div
                key={year}
                role="group"
                aria-labelledby={`aligned-y-${year}`}
              >
                <h3
                  id={`aligned-y-${year}`}
                  className="border-b border-border pb-1 font-display text-xl text-foreground"
                >
                  {year}
                </h3>
                <ul className="mt-3 space-y-3">
                  {list.map(r => (
                    <li key={r.textId}>
                      <RegisterEntry row={r} headingLevel={4} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          {/* The rest of the record when somebody wants it. No count and no sense of a page left unfinished (R55). */}
          {phase === "ready" && !query && more && (
            <div>
              <button
                type="button"
                onClick={() => void readMore()}
                disabled={readingMore}
                className={BTN_SECONDARY}
              >
                {readingMore ? ALIGNED_WORDS.readingMore : ALIGNED_WORDS.more}
              </button>
              <p className={`${HINT} mt-1.5`}>{ALIGNED_WORDS.moreLine}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function AlignedPanel({
  onStatus,
}: {
  onStatus?: (s: AlignedStatus) => void;
}) {
  const [mine, setMine] = useState<ServedAlignment[] | null>(null);
  const [agreement, setAgreement] = useState<ConfidentialityState | null>(null);
  // A link to #confidentiality (the newcomer's "align first" step) lands on the agreement once it has drawn, once.
  const landed = useRef(false);
  const onAgreement = useCallback((s: ConfidentialityState) => {
    setAgreement(s);
    if (
      landed.current ||
      s === "none" ||
      window.location.hash !== "#confidentiality"
    )
      return;
    landed.current = true;
    requestAnimationFrame(() =>
      document
        .getElementById("confidentiality")
        ?.scrollIntoView?.({ block: "start" })
    );
  }, []);

  const loadMine = useCallback(async () => {
    const a = await fetchMyAlignments();
    setMine(a.ok && Array.isArray(a.data?.alignments) ? a.data.alignments : []);
  }, []);
  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  const waiting = mine ? waitingOnYou(mine) : null;
  const waitingCount = waiting ? waiting.length : null;
  useEffect(() => {
    onStatus?.({ waiting: waitingCount, agreement });
  }, [onStatus, waitingCount, agreement]);

  const allClear =
    waiting !== null &&
    waiting.length === 0 &&
    agreement !== "asked" &&
    agreement !== null;

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="aligned-standing-h"
        className={CARD}
        data-aligned-standing=""
      >
        <p className={EYEBROW}>
          <Trans context="season page, aligned tab eyebrow">Asked of you</Trans>
        </p>
        <h2 id="aligned-standing-h" className={`${H2} mt-1`}>
          {waiting && waiting.length > 0 ? (
            <Trans context="season page, aligned tab heading while texts wait">
              Waiting on you
            </Trans>
          ) : (
            <Trans context="season page, aligned tab heading">
              What you align with
            </Trans>
          )}
        </h2>
        {mine === null ? null : waiting && waiting.length > 0 ? (
          <>
            <p className={`${HINT} mt-2`}>
              <Trans context="season page, aligned tab, why these wait">
                Each of these starts once every party aligns. Read the words,
                then align.
              </Trans>
            </p>
            <ul className="mt-4 space-y-4">
              {waiting.map(r => (
                <li key={r.textId ?? r.title}>
                  <AlignmentCard
                    alignment={r}
                    headingLevel={3}
                    showWords={false}
                    onChanged={() => void loadMine()}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p
            className={`mt-2 font-semibold ${allClear ? "text-open" : "text-muted-foreground"}`}
            role="status"
          >
            {allClear ? (
              <Trans context="season page, aligned tab, nothing waits">
                Nothing waits on you. You are aligned with everything asked of
                you.
              </Trans>
            ) : (
              <Trans context="season page, aligned tab, no texts wait">
                No terms wait on you.
              </Trans>
            )}
          </p>
        )}
      </section>

      <ConfidentialityCard onState={onAgreement} />

      <Register />
    </div>
  );
}
