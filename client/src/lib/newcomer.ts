/**
 * WHO IS A NEWCOMER, for the front door (a reviewer's feedback, approved by
 * the lead on 24 Nov 2026): a visitor, or someone signed in whom the village
 * has not admitted yet. The menu, the phone tab bar and the shortcuts button
 * keep a member's working areas out of a newcomer's way (config/nav.ts,
 * `newcomers`).
 *
 * Admitted is read the way the server reads it (`isAdmitted`,
 * server/lib/admission.ts): a membership granted, or a stage granted at the
 * admission rung or above, and a ladder without that rung has no door, so
 * everyone signed in counts as in. An admin or a founder is always a member.
 * Both records ride on the signed-in account (`GET /api/profile`).
 *
 * It decides what a menu offers and nothing else. Every page and route keeps
 * its own gate.
 */
import { useAuth } from "@/contexts/AuthContext";
import { useGameConfig } from "@/lib/gameApi";
import { useAreaInUse } from "@/lib/areasInUse";

/** The rung whose rule is being admitted (ADMISSION_RUNG, server/lib/admission.ts). */
const ADMISSION_RUNG = "member";

export interface AdmissionView {
  role?: string | null;
  membershipGranted?: unknown;
  stageGranted?: unknown;
}

/** Whether this account is a member. `stages` null is a ladder not known yet, which admits nobody on a stage alone. */
export function isMemberView(user: AdmissionView | null | undefined, stages: readonly { id: string }[] | null): boolean {
  if (!user) return false;
  if (user.role === "admin" || user.role === "founder") return true;
  if (user.membershipGranted === true || user.membershipGranted === 1) return true;
  if (!stages) return false;
  const door = stages.findIndex((s) => s.id === ADMISSION_RUNG);
  if (door < 0) return true;
  const granted = String(user.stageGranted ?? "");
  return !!granted && stages.findIndex((s) => s.id === granted) >= door;
}

/** True for a visitor and for a signed-in account the village has not admitted; false for a member. */
export function useNewcomer(): boolean {
  const { user } = useAuth();
  const cfg = useGameConfig();
  return !isMemberView(user as AdmissionView | null, cfg?.stages ?? null);
}

/**
 * The menu's newcomer test for one entry (config/nav.ts, `newcomers`): true
 * when this reader is offered it. A member is offered every entry; a newcomer
 * none marked "never", and an "in-use" one once its area is in use.
 */
export function useNewcomerShows(): { newcomer: boolean; shows: (entry: { href: string; module?: string; newcomers?: "never" | "in-use" }) => boolean } {
  const newcomer = useNewcomer();
  const inUse = useAreaInUse(newcomer);
  return { newcomer, shows: (e) => !newcomer || !e.newcomers || (e.newcomers === "in-use" && inUse(e)) };
}
