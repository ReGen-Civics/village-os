/**
 * ROLE APPLICATIONS THAT ARE WAITING, for Admin's Today and Inbox.
 *
 * Two doors bring a role application in, and both must show on the first
 * screen an admin sees (Rye, 16 Nov 2026: "I should see role applications here
 * in admin"). An application from somebody with no account sat only in a
 * collapsed panel on the form list, and was missed.
 *
 * - People with no account: `GET /api/admin/open-proposals`. Its `proposals`
 *   are the confirmed ones, which is every one still waiting for an answer.
 * - Members: `GET /api/governance/role-applications`, where `awaiting-holder`
 *   and `voting` are still open (OPEN_STATUSES, shared/seatApplications.ts).
 *
 * Each row names the applicant, the role, when, and links straight to the
 * application's own page. Reading only: nothing here decides anything. A read
 * that fails or is refused is an empty list, so Today still loads.
 */
import { API_BASE, authHeaders } from "@/components/admin/adminApi";
import { OPEN_STATUSES, STATUS_WORDS, type ApplicationStatus } from "@shared/seatApplications";

export interface RoleApplicationRow {
  id: string;
  kind: "no-account" | "member";
  who: string;
  role: string;
  /** ISO time it reached the village, or null when not recorded. */
  at: string | null;
  when: string;
  status: string;
  href: string;
}

interface OpenDeskShape {
  proposals?: Array<{
    id?: string;
    name?: string | null;
    roles?: Array<{ name?: string | null }>;
    createdAt?: string | null;
    confirmedAt?: string | null;
  }>;
}

interface MemberListShape {
  applications?: Array<{
    id?: string;
    href?: string;
    status?: string;
    candidate?: { name?: string | null } | null;
    seats?: Array<{ name?: string | null }>;
    createdAt?: string | null;
  }>;
}

export function whenLabel(iso: string | null | undefined): string {
  const at = new Date(iso ?? "");
  if (!iso || Number.isNaN(at.getTime())) return "Date not recorded";
  return at.toLocaleString([], { month: "short", day: "numeric", year: "numeric" });
}

function roleNames(names: Array<string | null | undefined>, missing: string): string {
  const list = names.map((n) => String(n ?? "").trim()).filter(Boolean);
  return list.length ? list.join(", ") : missing;
}

const isOpen = (status: string | undefined): status is ApplicationStatus =>
  typeof status === "string" && (OPEN_STATUSES as readonly string[]).includes(status);

/** Both lists as one, oldest first: the person who has waited longest is at the top. */
export function roleApplicationRows(desk: OpenDeskShape | null | undefined, members: MemberListShape | null | undefined): RoleApplicationRow[] {
  const open: RoleApplicationRow[] = (Array.isArray(desk?.proposals) ? desk!.proposals! : [])
    .filter((p) => typeof p?.id === "string" && p.id)
    .map((p) => {
      const at = p.confirmedAt || p.createdAt || null;
      return {
        id: `open:${p.id}`,
        kind: "no-account",
        who: String(p.name ?? "").trim() || "Name taken off",
        role: roleNames((p.roles ?? []).map((r) => r?.name), "A role no longer offered"),
        at,
        when: whenLabel(at),
        status: "No account yet",
        href: `/open-proposals/${encodeURIComponent(String(p.id))}`,
      };
    });
  const mine: RoleApplicationRow[] = (Array.isArray(members?.applications) ? members!.applications! : [])
    .filter((a) => typeof a?.id === "string" && a.id && isOpen(a.status))
    .map((a) => ({
      id: `member:${a.id}`,
      kind: "member",
      who: String(a.candidate?.name ?? "").trim() || "A member",
      role: roleNames((a.seats ?? []).map((s) => s?.name), "A role"),
      at: a.createdAt ?? null,
      when: whenLabel(a.createdAt),
      status: STATUS_WORDS[a.status as ApplicationStatus],
      href: a.href || `/role-applications/${encodeURIComponent(String(a.id))}`,
    }));
  const time = (row: RoleApplicationRow) => {
    const t = new Date(row.at ?? "").getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  };
  return [...open, ...mine].sort((x, y) => time(x) - time(y));
}

export function roleApplicationsSentence(count: number): string {
  if (count === 0) return "No role application is waiting.";
  return count === 1 ? "1 role application is waiting." : `${count} role applications are waiting.`;
}

/** Reads both doors. A refusal or a failure on either reads as nothing waiting there. */
export async function fetchWaitingRoleApplications(password: string, signal?: AbortSignal): Promise<RoleApplicationRow[]> {
  const read = (url: string) =>
    fetch(url, { headers: authHeaders(password), signal })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const [desk, members] = await Promise.all([
    read(`${API_BASE}/admin/open-proposals`),
    read(`${API_BASE}/governance/role-applications`),
  ]);
  return roleApplicationRows(desk, members);
}
