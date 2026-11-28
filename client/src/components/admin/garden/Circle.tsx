/**
 * THE CIRCLE: who is here, and what waits on a second signature. The roll for
 * the launch vote.
 *
 * A ring of people, each with a first name and a plain state word the caller
 * supplies ("answered", "waiting"). The caller's order is kept exactly:
 * nothing here sorts, counts or ranks a person.
 */
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import "./garden.css";

export interface CirclePerson {
  /** A stable id, unique in the circle. */
  id: string;
  /** The person's name. Only the first name is shown. */
  name: string;
  /** One plain word or two for where they stand, in the caller's words. */
  state?: string;
  /** Their portrait. Without one, their initial stands in the ring. */
  portraitUrl?: string;
}

export interface CircleProps {
  /** The people, in the order the caller wants them shown. */
  people: readonly CirclePerson[];
  /** What the list is, for a screen reader. Left out: "The circle". */
  label?: string;
  /** One line under the ring, in the caller's words ("Nothing waits on a second signature"). */
  note?: string;
  className?: string;
}

/** The first name of a person's name, and the letter that stands for them. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export default function Circle({ people, label, note, className = "" }: CircleProps) {
  const { t } = useLingui();
  const [noPortrait, setNoPortrait] = useState<ReadonlySet<string>>(new Set());
  return (
    <div className={`flex flex-col gap-3 ${className}`.trim()}>
      <ul aria-label={label ?? t({ message: "The circle", context: "garden circle" })} className="m-0 flex list-none flex-wrap gap-4 p-0">
        {people.map((person) => {
          const first = firstNameOf(person.name);
          const portrait = person.portraitUrl && !noPortrait.has(person.id) ? person.portraitUrl : null;
          return (
            <li key={person.id} className="flex w-16 flex-col items-center gap-1 text-center">
              <span className="gd-ring size-14" aria-hidden="true">
                {portrait ? (
                  <img src={portrait} alt="" loading="lazy" decoding="async" onError={() => setNoPortrait((was) => new Set(was).add(person.id))} />
                ) : (
                  <span className="font-display text-xl">{first.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <span className="max-w-full truncate text-sm font-semibold text-foreground">{first}</span>
              {person.state ? <span className="text-xs text-muted-foreground">{person.state}</span> : null}
            </li>
          );
        })}
      </ul>
      {note ? <p className="m-0 text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}
