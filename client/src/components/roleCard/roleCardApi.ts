/**
 * The two public reads behind the founding team section and the full card
 * (server/routes/roleEdit.ts): which roles the founding team features, and one
 * role's founding sections with who last edited it. Both read with the
 * member's token when there is one, so an editor reads an unlisted role too.
 */
import { gameFetch } from "@/lib/gameApi";
import { NO_VILLAGE_PAY, readSections, villagePayFrom, type RoleCardSections, type VillagePay } from "@shared/roleCardSections";
import { DEFAULT_OTHER_WAYS, otherWaysOf, type OtherWays } from "@shared/otherWays";
import type { FilledTeamRole } from "@shared/foundingTeam";
import type { RoleFill } from "@shared/commitmentRange";

export interface FoundingTeamAnswer {
  on: boolean;
  roleIds: string[];
  /** Each featured role's name, by id, for words that name the open founding roles. */
  names: Record<string, string>;
  sections: Record<string, RoleCardSections>;
  showPayRanges: boolean;
  villagePay: VillagePay;
  /** The "Other ways to join" tiles (shared/otherWays.ts), the defaults when the read fails. */
  otherWays: OtherWays;
  /** The current team beside the open roles (Rye, 14 Nov 2026): the founding circles' filled roles, holders by first name when the village shows names. */
  team: FilledTeamRole[];
  /** How full each role is, by id (Rye, 14 Nov 2026): what its holders give against what it needs. */
  fill: Record<string, RoleFill>;
  /**
   * True when the read itself failed (a 500, a 429, no connection). The answer
   * is still the section off, so no page waits on it, but a page that leads
   * with the founding team can say it could not load instead of silently
   * dropping it (performance QA sweep, resilience P2-6).
   */
  failed?: boolean;
}

export interface RoleCardAnswer {
  roleId: string;
  sections: RoleCardSections | null;
  lastEdited: { by: string | null; on: string } | null;
  showPayRanges: boolean;
  villagePay: VillagePay;
  mayEdit: boolean;
}

const OFF: FoundingTeamAnswer = { on: false, roleIds: [], names: {}, sections: {}, showPayRanges: false, villagePay: NO_VILLAGE_PAY, otherWays: DEFAULT_OTHER_WAYS, team: [], fill: {} };
const FAILED: FoundingTeamAnswer = { ...OFF, failed: true };

/** The fills as the server sent them, read again so a bad row draws nothing. */
function fillOf(v: unknown): Record<string, RoleFill> {
  const out: Record<string, RoleFill> = {};
  if (!v || typeof v !== "object") return out;
  for (const [id, f] of Object.entries(v as Record<string, any>)) {
    const held = Number(f?.heldPct);
    const target = Number(f?.targetPct);
    if (Number.isFinite(held) && held >= 0 && Number.isFinite(target) && target > 0) out[id] = { heldPct: held, targetPct: target, openPct: Math.max(0, target - held), covered: held >= target };
  }
  return out;
}

/** The team as the server sent it, read again so a bad row draws nothing. */
function teamOf(v: unknown): FilledTeamRole[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r: any) => r && typeof r.id === "string" && typeof r.name === "string" && r.name.trim())
    .map((r: any) => ({ id: r.id, name: r.name.trim(), holders: Array.isArray(r.holders) ? r.holders.filter((h: unknown): h is string => typeof h === "string" && !!h.trim()) : [] }));
}

/** The village's pay block as the server sent it, read again here so a bad answer draws nothing. */
function payOf(v: any): VillagePay {
  if (!v || typeof v !== "object") return NO_VILLAGE_PAY;
  const shape = Array.isArray(v.shape) ? v.shape.map((x: any) => `${String(x?.label ?? "")} ${String(x?.pct ?? "")}`).join(", ") : "";
  return villagePayFrom({ shape, atRisk: String(v.atRisk ?? ""), note: String(v.note ?? "") });
}

/** The founding team, or the section off (marked `failed`) when the read fails: the page never waits on it to show its roles. */
export async function readFoundingTeam(): Promise<FoundingTeamAnswer> {
  try {
    const r = await gameFetch("/api/org/founding-team");
    if (!r.ok) return FAILED;
    const d = await r.json();
    const roleIds = Array.isArray(d?.roleIds) ? d.roleIds.filter((x: unknown): x is string => typeof x === "string") : [];
    const sections: Record<string, RoleCardSections> = {};
    const names: Record<string, string> = {};
    for (const id of roleIds) {
      const name = d?.names?.[id];
      if (typeof name === "string" && name.trim()) names[id] = name.trim();
      const read = readSections(d?.sections?.[id]);
      if (read.ok) sections[id] = read.value;
    }
    return { on: d?.on === true && roleIds.length > 0, roleIds, names, sections, showPayRanges: d?.showPayRanges === true, villagePay: payOf(d?.villagePay), otherWays: otherWaysOf(d?.otherWays), team: teamOf(d?.team), fill: fillOf(d?.fill) };
  } catch {
    return FAILED;
  }
}

/** One role's founding sections and its last edit, or null when the read fails. */
export async function readRoleCard(roleId: string): Promise<RoleCardAnswer | null> {
  try {
    const r = await gameFetch(`/api/org/role-card/${encodeURIComponent(roleId)}`);
    if (!r.ok) return null;
    const d = await r.json();
    const read = d?.sections ? readSections(d.sections) : null;
    const last = d?.lastEdited && typeof d.lastEdited.on === "string" ? { by: typeof d.lastEdited.by === "string" ? d.lastEdited.by : null, on: d.lastEdited.on } : null;
    return {
      roleId,
      sections: read && read.ok ? read.value : null,
      lastEdited: last,
      showPayRanges: d?.showPayRanges === true,
      villagePay: payOf(d?.villagePay),
      mayEdit: d?.mayEdit === true,
    };
  } catch {
    return null;
  }
}
