/**
 * THE PRIORITY BOARD, on "The season so far" (shared/priorities.ts): the
 * group's priorities for the season on one ordered list, each with the season
 * goal it serves, the role that owns it and where it stands.
 *
 * The ORDER is the circle's. It changes in a meeting: a facilitator puts the
 * board on the agenda, the room votes, the facilitator sets the order and
 * keeps it on the board. This page never reorders anything. People who may
 * run sessions add priorities and change their words, owner and status here.
 */
import { useCallback, useEffect, useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BOARD_API, BOARD_STATUSES, PRIORITY_LIMITS, boardItemApi, type BoardCard, type BoardPayload } from "@shared/priorities";
import { gameFetch } from "@/lib/gameApi";
import { BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, FIELD, H2, HINT, LABEL, RING, TILE } from "@/components/journey/look";
import { ServesPicker } from "@/components/sessions/ServesPicker";
import { refusalOf, useStatusLabel } from "./priorityWords";

export default function PriorityBoard({ seasonId }: { seasonId: string | null }) {
  const { t } = useLingui();
  const statusLabel = useStatusLabel();
  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [text, setText] = useState("");
  const [serves, setServes] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  const read = useCallback(async () => {
    try {
      const res = await gameFetch(seasonId ? `${BOARD_API}?season=${encodeURIComponent(seasonId)}` : BOARD_API);
      setBoard(res.ok ? ((await res.json()) as BoardPayload) : null);
    } catch {
      setBoard(null);
    }
  }, [seasonId]);

  useEffect(() => {
    void read();
  }, [read]);

  const send = async (path: string, method: string, body: unknown): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await gameFetch(path, { method, body: JSON.stringify(body) });
      if (!res.ok) {
        setError((await refusalOf(res)) ?? t`That did not save. Try again.`);
        return false;
      }
      setBoard((await res.json()) as BoardPayload);
      return true;
    } catch {
      setError(t`That did not save. Try again.`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!board?.season) return null;
  // Changes go to the running season only: a past season's board is a record.
  const keep = board.mayKeep && seasonId == null;
  const row = (i: BoardCard) => (
    <li key={i.id} className={`${TILE} flex items-start gap-3`} data-board-item={i.id} data-status={i.status}>
      <span className={RING} aria-label={t({ message: `Number ${i.place}`, context: "priority board, an item's place in the order" })}>
        {i.place}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className={i.status === "set_aside" ? "text-muted-foreground line-through" : "font-semibold text-foreground"}>{i.text}</p>
        <p className="flex flex-wrap gap-2">
          <span className={CHIP_SOFT}>{statusLabel(i.status)}</span>
          {i.servesGoal && <span className={CHIP_SOFT}>{t({ message: `Serves: ${i.servesGoal}`, context: "priority board, the season goal an item serves" })}</span>}
          <span className={CHIP_SOFT}>{i.ownerRole ? t({ message: `Owner: ${i.ownerRole}`, context: "priority board, the role that owns an item" }) : t`No owner role yet`}</span>
        </p>
        {keep && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${FIELD} w-auto`}
              aria-label={t({ message: `Status of ${i.text}`, context: "priority board, choose an item's status" })}
              value={i.status}
              disabled={busy}
              onChange={(e) => void send(boardItemApi(i.id), "PATCH", { status: e.target.value })}
            >
              {BOARD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <select
              className={`${FIELD} w-auto max-w-[16rem]`}
              aria-label={t({ message: `Owner role of ${i.text}`, context: "priority board, choose the role that owns an item" })}
              value={i.ownerRoleId ?? ""}
              disabled={busy}
              onChange={(e) => void send(boardItemApi(i.id), "PATCH", { ownerRoleId: e.target.value || null })}
            >
              <option value="">{t({ message: "No owner role", context: "priority board, no role owns this item" })}</option>
              {board.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <ServesPicker goals={board.goals} value={i.servesGoalId} disabled={busy} label={i.text} onChange={(g) => void send(boardItemApi(i.id), "PATCH", { servesGoalId: g })} />
          </div>
        )}
      </div>
    </li>
  );

  return (
    <section aria-labelledby={`${ids}-h`} className={CARD} data-priority-board>
      <p className={EYEBROW}>{board.season.name}</p>
      <h2 id={`${ids}-h`} className={`mt-1 ${H2}`}>
        {t({ message: "The priority board", context: "the season's ordered list of group priorities" })}
      </h2>
      <p className={`mt-2 ${HINT}`}>{t`The group's priorities for the season, in the order the circle chose. The order changes in a meeting's vote.`}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {board.items.length ? <ol className="mt-4 space-y-3">{board.items.map(row)}</ol> : <p className={`mt-3 ${HINT}`}>{t`Nothing is on the board yet.`}</p>}
      {keep && (
        <form
          className="mt-5 space-y-3 border-t border-border pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send(BOARD_API, "POST", { text, servesGoalId: serves, ownerRoleId: owner || null })) {
              setText("");
              setServes(null);
              setOwner("");
            }
          }}
        >
          <label htmlFor={`${ids}-text`} className={LABEL}>
            {t({ message: "Add a priority", context: "priority board, add an item" })}
          </label>
          <input id={`${ids}-text`} className={FIELD} value={text} maxLength={PRIORITY_LIMITS.text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <ServesPicker goals={board.goals} value={serves} onChange={setServes} disabled={busy} />
            <select className={`${FIELD} w-auto max-w-[16rem]`} aria-label={t({ message: "Owner role", context: "priority board, choose the role that owns a new item" })} value={owner} disabled={busy} onChange={(e) => setOwner(e.target.value)}>
              <option value="">{t({ message: "No owner role", context: "priority board, no role owns this item" })}</option>
              {board.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button type="submit" className={BTN_SECONDARY} disabled={busy || !text.trim()}>
              {t`Add to the board`}
            </button>
          </div>
          <p className={HINT}>{t`A new priority goes to the end. The circle places it at its next vote.`}</p>
        </form>
      )}
    </section>
  );
}
