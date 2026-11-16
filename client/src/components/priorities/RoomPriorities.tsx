/**
 * THE ROOM'S PRIORITY SECTIONS (shared/priorities.ts), drawn by the meeting
 * type panel (components/sessions/TemplatePanel.tsx) when the template's flow
 * asks for them:
 *
 *   TopsSection        `top_priorities`, Monday: each person here and their
 *                      top priority for the week. A person sets their own; the
 *                      facilitator or the secretary can type one in for anybody
 *                      here.
 *   TopsReviewSection  `top_priorities_review`, Friday: each person's line,
 *                      marked done, partly or carried over by the person or a
 *                      host. A carried line stays their line next week.
 *   BoardVoteSection   `priority_vote`: the season's priority board. A host
 *                      puts it on the agenda, the room votes it with the rest,
 *                      the facilitator sets the order, and a host keeps that
 *                      order on the board.
 *
 * Every write answers with the panel as it now stands.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { PRIORITY_LIMITS, type RoomTop } from "@shared/priorities";
import { PRIORITY_OUTCOMES, type TemplateRoomView, type TemplateSection } from "@shared/sessionTemplates";
import HarvestPlant, { HarvestWord } from "@/components/sessions/HarvestPlant";
import { ServesChip, ServesPicker } from "@/components/sessions/ServesPicker";
import { BTN_QUIET, BTN_SECONDARY, CHIP, HINT, INPUT, LABEL_CAPS, SOFT } from "@/components/sessions/roomUi";
import { dayWords, useStatusLabel } from "./priorityWords";

type Write = (path: string, method: string, body: unknown) => Promise<boolean>;

interface Props {
  view: TemplateRoomView;
  section: TemplateSection;
  busy: boolean;
  /** The facilitator, the secretary or a joined admin, in an open room. */
  canHost: boolean;
  write: Write;
}

function Heading({ section }: { section: TemplateSection }) {
  return (
    <div>
      <h3 className={LABEL_CAPS}>{section.title}</h3>
      {section.prompt && <p className={`mt-1 ${HINT}`}>{section.prompt}</p>}
    </div>
  );
}

/** One person's line form: their own, or a host typing one in for them. */
function LineForm({ person, view, busy, write, onDone }: { person: RoomTop; view: TemplateRoomView; busy: boolean; write: Write; onDone(): void }) {
  const { t } = useLingui();
  const mine = person.no === view.viewerNo;
  const [text, setText] = useState(person.line && person.line.weekOf === view.tops?.weekOf ? person.line.text : "");
  const [serves, setServes] = useState<string | null>(null);
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await write("/tops", "POST", mine ? { text, servesGoalId: serves } : { text, servesGoalId: serves, forNo: person.no })) onDone();
      }}
    >
      <input
        className={`${INPUT} min-w-0 flex-1`}
        aria-label={mine ? t`Your top priority this week` : t({ message: `Top priority for ${person.name}`, context: "meeting room, a host types a person's top priority for the week" })}
        placeholder={t({ message: "One line", context: "placeholder for a top priority" })}
        value={text}
        maxLength={PRIORITY_LIMITS.text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <ServesPicker goals={view.season?.goals ?? []} value={serves} onChange={setServes} disabled={busy} />
      <button type="submit" className={BTN_SECONDARY} disabled={busy || !text.trim()}>
        {t({ message: "Keep it", context: "meeting room, save a person's top priority" })}
      </button>
      <button type="button" className={BTN_QUIET} disabled={busy} onClick={onDone}>
        {t({ message: "Cancel", context: "priorities, stop editing without saving" })}
      </button>
    </form>
  );
}

export function TopsSection({ view, section, busy, canHost, write }: Props) {
  const { t } = useLingui();
  const [editing, setEditing] = useState<number | null>(null);
  const tops = view.tops;
  const open = view.open && view.joined;
  return (
    <div className="space-y-2" data-section="top_priorities">
      <Heading section={section} />
      {tops?.people.length ? (
        <ul className="space-y-1.5">
          {tops.people.map((p) => {
            const fresh = p.line != null && p.line.weekOf === tops.weekOf;
            const mayWrite = open && (p.no === view.viewerNo || canHost);
            return (
              <li key={p.no} className={SOFT} data-top={p.no}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-muted-foreground">{p.name}</span>
                    {p.line ? (
                      <span className="text-foreground">
                        {p.line.text} <ServesChip goal={p.line.servesGoal} />
                        {!fresh && <span className="block text-xs text-muted-foreground">{t`Carried from the week of ${dayWords(p.line.weekOf)}`}</span>}
                      </span>
                    ) : (
                      <span className={HINT}>{t`No top priority yet.`}</span>
                    )}
                  </span>
                  {mayWrite && editing !== p.no && (
                    <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => setEditing(p.no)}>
                      {fresh ? t({ message: "Change", context: "priorities, change what was set" }) : t({ message: "Set it", context: "meeting room, set a person's top priority for the week" })}
                    </button>
                  )}
                </div>
                {editing === p.no && <LineForm person={p} view={view} busy={busy} write={write} onDone={() => setEditing(null)} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={HINT}>{t`Names show here as people join the room.`}</p>
      )}
    </div>
  );
}

export function TopsReviewSection({ view, section, busy, canHost, write }: Props) {
  const { t } = useLingui();
  const tops = view.tops;
  const withLines = (tops?.people ?? []).filter((p) => p.line);
  const open = view.open && view.joined;
  return (
    <div className="space-y-2" data-section="top_priorities_review">
      <Heading section={section} />
      {withLines.length ? (
        <ul className="space-y-1.5">
          {withLines.map((p) => {
            const line = p.line!;
            const mayMark = open && (p.no === view.viewerNo || canHost);
            return (
              <li key={p.no} className={`${SOFT} flex flex-wrap items-center justify-between gap-2`} data-outcome={line.outcome ?? "open"}>
                <span className="flex min-w-0 items-start gap-2 text-foreground">
                  <HarvestPlant outcome={line.outcome} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-muted-foreground">{p.name}</span>
                    {line.text} <ServesChip goal={line.servesGoal} />
                  </span>
                </span>
                <span className="flex flex-wrap gap-1" role="group" aria-label={t`How did it go for ${p.name}?`}>
                  {PRIORITY_OUTCOMES.map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={line.outcome === o}
                      disabled={busy || !mayMark}
                      className={
                        line.outcome === o
                          ? "min-h-11 rounded-full border border-notice bg-notice px-3 text-sm font-semibold text-background"
                          : "min-h-11 rounded-full border border-border px-3 text-sm text-foreground hover:border-notice disabled:opacity-60"
                      }
                      onClick={() => void write(`/tops/${p.no}`, "PATCH", { outcome: line.outcome === o ? null : o })}
                    >
                      <HarvestWord outcome={o} />
                    </button>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={HINT}>{t`Nobody here has a top priority to read back yet.`}</p>
      )}
    </div>
  );
}

export function BoardVoteSection({ view, section, busy, canHost, write }: Props) {
  const { t } = useLingui();
  const statusLabel = useStatusLabel();
  const board = view.board;
  if (!board) return null;
  return (
    <div className="space-y-2" data-section="priority_vote">
      <Heading section={section} />
      <p className={LABEL_CAPS}>{t`The season's priority board`}</p>
      {board.items.length ? (
        <ol className="space-y-1.5">
          {board.items.map((i) => (
            <li key={i.id} className={`${SOFT} flex flex-wrap items-center gap-2`} data-board-item={i.id}>
              <span className="tabular-nums text-muted-foreground">{i.place}.</span>
              <span className="min-w-0 flex-1 text-foreground">{i.text}</span>
              <span className={CHIP}>{statusLabel(i.status)}</span>
              {i.ownerRole && <span className={CHIP}>{i.ownerRole}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <p className={HINT}>{t`Nothing is on the board yet.`}</p>
      )}
      {canHost && board.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void write("/board", "POST", { act: "agenda" })}>
            {t`Put the board on the agenda`}
          </button>
          {board.onAgenda > 0 && (
            <button type="button" className={BTN_SECONDARY} disabled={busy || !board.orderSet} onClick={() => void write("/board", "POST", { act: "keep" })}>
              {t`Keep this order on the board`}
            </button>
          )}
        </div>
      )}
      {canHost && board.onAgenda > 0 && !board.orderSet && <p className={HINT}>{t`Once the room has voted, set the agenda's order. Then keep it on the board.`}</p>}
    </div>
  );
}
