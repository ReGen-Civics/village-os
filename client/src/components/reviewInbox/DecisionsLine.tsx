/**
 * THE ONE COUNT, SAID ONE WAY (the Admin Garden plan, 27 Nov 2026: "One count, defined once: decisions waiting on you.
 * Applications are listed and never counted.").
 *
 * The server defines the count per person on every read (shared/reviewInbox.ts, `decisionCounts`). This is the only
 * place its sentence is written, and Admin Home and /admin/review both draw it, so the two can never say different
 * numbers or different words. Until 27 Nov Home said "23 requests" and "184 things" on one screen.
 *
 *   - "At least" while a queue did not load: the number is then a floor, and the line says how many are unknown.
 *   - Blocked rows are said beside the count, never inside it.
 *   - Applications are named as listed and not counted. No number here is about a person.
 *   - `held` is the review page's own (what the engine held back); Home leaves it out.
 */
import { Plural } from "@lingui/react/macro";
import type { InboxCounts } from "./useReviewInbox";

export default function DecisionsLine({ counts, held = 0 }: { counts: InboxCounts; held?: number }) {
  const { decisions, applications, blocked } = counts;
  const heldCount = held;
  const unknown = counts.unknown.length;
  return (
    <>
      {unknown ? (
        <Plural context="the one count, while a queue did not load" value={decisions} one="At least # decision waiting on you." other="At least # decisions waiting on you." />
      ) : (
        <Plural context="the one count" value={decisions} one="# decision waiting on you." other="# decisions waiting on you." />
      )}
      {blocked ? (
        <>
          {" "}
          <Plural context="review inbox: header" value={blocked} one="# blocked." other="# blocked." />
        </>
      ) : null}
      {heldCount ? (
        <>
          {" "}
          <Plural context="review inbox: header" value={heldCount} one="# held." other="# held." />
        </>
      ) : null}
      {applications ? (
        <>
          {" "}
          <Plural context="the one count: applications are listed and never counted" value={applications} one="# application is listed, and is not counted." other="# applications are listed, and are not counted." />
        </>
      ) : null}
      {unknown ? (
        <>
          {" "}
          <Plural context="review inbox: header" value={unknown} one="# queue did not load, so its number is unknown." other="# queues did not load, so their numbers are unknown." />
        </>
      ) : null}
    </>
  );
}
