/**
 * One role as `/api/org` sends it, with its circle's name, for a host that knows only the role's id
 * (the application form, the page a decider reads). Null while it loads; `missing` when the village no
 * longer lists it. The read carries the member's token where there is one, as the Roles page's does.
 */
import { useEffect, useState } from "react";
import { readerLanguage } from "@/lib/readerLanguage";
import { useLocale } from "@/i18n/LocaleProvider";
import { gameFetch } from "@/lib/gameApi";

export type OrgSeat = { seat: Record<string, any>; circleName: string | null } | "missing" | null;

export function useOrgSeats(roleIds: readonly string[]): Record<string, OrgSeat> {
  const key = roleIds.join("|");
  const [seats, setSeats] = useState<Record<string, OrgSeat>>({});
  const { locale } = useLocale(); // circle names come in the reader's language (lib/readerLanguage.ts)
  useEffect(() => {
    let live = true;
    if (!key) return;
    gameFetch("/api/org", readerLanguage(locale))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live) return;
        const roles: any[] = Array.isArray(data?.roles) ? data.roles : [];
        const circles = new Map<string, string>((Array.isArray(data?.circles) ? data.circles : []).map((c: any) => [String(c.id), String(c.name ?? "")]));
        const out: Record<string, OrgSeat> = {};
        for (const id of key.split("|")) {
          const seat = roles.find((r) => String(r?.id) === id);
          out[id] = seat ? { seat, circleName: circles.get(String(seat.circleId)) || null } : "missing";
        }
        setSeats(out);
      })
      .catch(() => live && setSeats(Object.fromEntries(key.split("|").map((id) => [id, "missing" as const]))));
    return () => {
      live = false;
    };
  }, [key, locale]);
  return seats;
}
