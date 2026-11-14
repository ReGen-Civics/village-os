/**
 * HOW MUCH YOU GIVE, ON THE "YOUR ROLES" CARD (Rye, 14 Nov 2026).
 *
 *   "attached to this should be the commitment percentage slider 1. across
 *   all roles (50% across all) 2. a way to then further decide (of that 50%
 *   of my total time what % of my time would go to each of my roles - this is
 *   optional and will affect pay if roles are paid differently, in my case
 *   they're all folded into 1 pay, but other roles may be different)."
 *
 *   "This should connect more with roles/compensation and not be front and
 *   center on the profile."
 *
 * So the old "How much can you give right now?" card left Today and lives
 * here, beside the roles it is about. ONE SOURCE OF TRUTH: the same word in
 * `member_commitments` (useMyCommitment), with the split carried on that row.
 * Saving the total keeps the split; saving the split says the total again.
 *
 * THE SPLIT is shares OF THE TOTAL that add up to 100 ("of my 50%, 60% goes
 * to Hosting"), each also shown as a part of the whole person ("30% of you").
 * It is optional and starts closed. Whether it touches pay is read off how
 * the roles are paid (`rolePayFold`): one agreement for every role is one
 * pay, and the card says the split changes nothing; separate agreements are
 * where it is meant to matter.
 *
 * TODO(commitment-split-pay): weight pay by the split for roles paid apart.
 * Waits for the lead's ruling; nothing that pays reads this today
 * (server/lib/commitmentBoundary.test.ts).
 *
 * Private to the member. Nobody else sees it, and it never ranks anyone.
 */
import { useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChartPie, Gauge, History } from "lucide-react";
import { useMyCommitment } from "@/lib/useMyCommitment";
import {
  COMMITMENT_PERIODS,
  evenSplit,
  rolePayFold,
  shareOfYou,
  splitForRoles,
  type CommitmentPeriod,
  type RoleSplitShare,
} from "@shared/commitment";
import { civilDayWords } from "@shared/seasonPlans";
import { BTN_SECONDARY, FIELD, HINT, LABEL } from "@/components/journey/look";

export interface CommitmentSeat {
  id: string;
  name: string;
  heldThrough?: string | null;
}

const SUMMARY = "flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-sm font-semibold text-notice [&::-webkit-details-marker]:hidden";

export default function RolesCommitment({ seats }: { seats: readonly CommitmentSeat[] }) {
  const { t } = useLingui();
  const mine = useMyCommitment(true);
  const [pct, setPct] = useState<number | null>(null);
  const [period, setPeriod] = useState<CommitmentPeriod | null>(null);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<RoleSplitShare[] | null>(null);
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);

  const ids = useMemo(() => seats.map((s) => s.id), [seats]);
  const saved = useMemo(() => splitForRoles(mine.now?.split ?? null, ids), [mine.now, ids]);
  const fold = rolePayFold(seats);
  if (!mine.loaded) return null;

  const periodWords: Record<CommitmentPeriod, string> = {
    season: t({ message: "This season", context: "commitment field: the period a member's word covers" }),
    moon: t({ message: "This moon", context: "commitment field: the period a member's word covers" }),
    week: t({ message: "This week", context: "commitment field: the period a member's word covers" }),
  };
  const total = pct ?? mine.pct ?? 50;
  const shownPeriod = period ?? mine.now?.period ?? "season";
  const split = draft ?? saved;
  const splitSum = split ? split.reduce((s, x) => s + x.share, 0) : 100;
  const splitWhole = splitSum === 100;
  const changed = pct !== null || period !== null || note.trim() !== "" || draft !== null;
  const nowPct = mine.now?.pct ?? 0;
  const nowFrom = mine.now?.fromDate ? civilDayWords(mine.now.fromDate) : "";
  const earlier = mine.history.filter((h) => h.id !== mine.now?.id).slice(0, 4);
  const many = seats.length >= 2;

  const setShare = (roleId: string, share: number) => {
    const base = split ?? evenSplit(ids);
    const clean = Math.max(0, Math.min(100, Math.round(Number.isFinite(share) ? share : 0)));
    setDraft(base.map((s) => (s.roleId === roleId ? { ...s, share: clean } : s)));
  };

  const save = async () => {
    setBusy(true);
    const r = await mine.say({ pct: total, period: shownPeriod, note: note.trim() || null, ...(split && splitWhole ? { split } : {}) });
    setBusy(false);
    if (r.ok) {
      setPct(null);
      setPeriod(null);
      setNote("");
      setDraft(null);
      setSaid(t({ message: "Saved. The open work and roles now fit this.", context: "commitment field: after saving" }));
    } else setSaid(r.error);
  };

  const foldLine =
    fold === "together"
      ? t({ message: "Your roles share one pay, so there is nothing you need to split. Splitting your time is only for your own planning.", context: "commitment split: every role is paid through one agreement" })
      : fold === "apart"
        ? t({ message: "Your roles are paid on separate agreements. Say how your time falls between them. Pay does not read this yet. The village is still deciding how it will.", context: "commitment split: roles paid on separate agreements" })
        : t({ message: "No pay agreement covers these roles yet, so a split is only for your own planning.", context: "commitment split: no agreement covers the roles" });

  return (
    <div className="mt-5 rounded-xl border border-border/60 p-4" data-commitment-field="">
      <h3 id="my-commitment-title" className="flex items-center gap-2 font-display text-lg font-semibold text-card-foreground">
        <Gauge className="h-5 w-5 text-notice" aria-hidden="true" />
        {t({ message: "How much you give", context: "commitment on the roles card: heading" })}
      </h3>
      <p className={`mt-1 ${HINT}`}>
        {mine.now
          ? t({ message: `One percent for all your roles together. You said ${nowPct}% from ${nowFrom}. Only you see this.`, context: "commitment on the roles card: what holds now" })
          : t({ message: "One percent of yourself, for all your roles together. The open work and the roles you see will fit it. Only you see this.", context: "commitment on the roles card: before a first word" })}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 flex-1 items-center gap-3" htmlFor="my-commitment-pct">
          <input
            id="my-commitment-pct"
            aria-label={t({ message: "Percent you can give", context: "commitment field" })}
            type="range"
            min={5}
            max={100}
            step={5}
            value={total}
            onChange={(e) => setPct(Number(e.target.value))}
            className="h-11 w-full min-w-[10rem] accent-notice"
            aria-valuetext={`${total}%`}
          />
          <span className="w-14 text-right font-display text-xl font-bold text-foreground" aria-hidden="true">{total}%</span>
        </label>
        <select
          className={`${FIELD} min-h-11 w-auto`}
          value={shownPeriod}
          onChange={(e) => setPeriod(e.target.value as CommitmentPeriod)}
          aria-label={t({ message: "The time this covers", context: "commitment field" })}
        >
          {COMMITMENT_PERIODS.map((p) => (
            <option key={p} value={p}>{periodWords[p]}</option>
          ))}
        </select>
      </div>

      {many && (
        <details className="mt-3 rounded-lg border border-border/60 px-3" open={fold === "apart" || saved !== null || undefined} data-commitment-split="">
          <summary className={SUMMARY}>
            <ChartPie className="h-4 w-4" aria-hidden="true" />
            {t({ message: "Split your time across roles (optional)", context: "commitment split: the disclosure" })}
          </summary>
          <p className={`pb-2 ${HINT}`}>{foldLine}</p>
          <p className={`pb-3 ${HINT}`}>
            {t({ message: `Give each role a part of your ${total}%. The parts add up to 100%.`, context: "commitment split: how the parts work" })}
          </p>
          <ul className="space-y-3 pb-3">
            {seats.map((s) => {
              const share = split?.find((x) => x.roleId === s.id)?.share ?? evenSplit(ids).find((x) => x.roleId === s.id)?.share ?? 0;
              const ofYou = shareOfYou(total, share);
              const roleName = s.name;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <label htmlFor={`split-${s.id}`} className="min-w-0 flex-[1_1_14rem] text-sm font-semibold text-card-foreground">
                    {roleName}
                  </label>
                  <span className="flex items-center gap-1">
                    <input
                      id={`split-${s.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      step={5}
                      value={share}
                      onChange={(e) => setShare(s.id, Number(e.target.value))}
                      className={`${FIELD} min-h-11 w-20 text-right`}
                    />
                    <span className="text-sm text-muted-foreground" aria-hidden="true">%</span>
                  </span>
                  <span className="w-24 text-sm text-muted-foreground">
                    {t({ message: `${ofYou}% of you`, context: "commitment split: a role's part of the whole person" })}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3 pb-3">
            <p role="status" className={`text-sm font-semibold ${splitWhole ? "text-muted-foreground" : "text-notice"}`}>
              {splitWhole
                ? t({ message: "The parts add up to 100%.", context: "commitment split: the parts are whole" })
                : t({ message: `The parts add up to ${splitSum}%. Make them 100% to save.`, context: "commitment split: the parts are not whole" })}
            </p>
            <button type="button" className="min-h-11 text-sm font-medium text-notice underline underline-offset-2" onClick={() => setDraft(evenSplit(ids))}>
              {t({ message: "Split evenly", context: "commitment split: button" })}
            </button>
          </div>
        </details>
      )}

      <details className="mt-3">
        <summary className={SUMMARY}>
          <History className="h-4 w-4" aria-hidden="true" />
          {t({ message: "A note, and what you said before", context: "commitment on the roles card: the note and history disclosure" })}
        </summary>
        <label className="block">
          <span className={LABEL}>{t({ message: "A note for yourself (optional)", context: "commitment field" })}</span>
          <input className={`${FIELD} mt-1 min-h-11`} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />
        </label>
        {earlier.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {earlier.map((h) => {
              const was = h.pct;
              const from = civilDayWords(h.fromDate);
              const span = periodWords[h.period].toLowerCase();
              return (
                <li key={h.id}>
                  {t({ message: `${was}% from ${from}, ${span}`, context: "commitment field: one earlier word" })}
                  {h.note ? `: ${h.note}` : ""}
                </li>
              );
            })}
          </ul>
        )}
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={BTN_SECONDARY} onClick={save} disabled={busy || !splitWhole || (!changed && !!mine.now)} data-commitment-save="">
          {t({ message: "Save", context: "commitment field" })}
        </button>
        {said && <p role="status" className={HINT}>{said}</p>}
      </div>
    </div>
  );
}
