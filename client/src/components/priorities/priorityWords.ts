/**
 * Small pieces the priorities components share (shared/priorities.ts). Every
 * word a member reads goes through Lingui.
 */
import { useLingui } from "@lingui/react/macro";
import type { BoardStatus } from "@shared/priorities";

/** A board item's status in words. */
export function useStatusLabel(): (s: BoardStatus) => string {
  const { t } = useLingui();
  const labels: Record<BoardStatus, string> = {
    not_started: t({ message: "Not started", context: "priority board, an item's status" }),
    under_way: t({ message: "Under way", context: "priority board, an item's status" }),
    done: t({ message: "Done", context: "priority board, an item's status" }),
    set_aside: t({ message: "Set aside", context: "priority board, an item's status" }),
  };
  return (s) => labels[s];
}

/** "7 December" for a YYYY-MM-DD day, in the reader's language. */
export function dayWords(day: string | null | undefined): string {
  if (!day) return "";
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "long", timeZone: "UTC" });
}

/** The server's own refusal when it sent a sentence, or null. */
export async function refusalOf(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body?.error === "string" && /\s/.test(body.error) ? body.error : null;
  } catch {
    return null;
  }
}
