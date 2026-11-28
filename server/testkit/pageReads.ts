/**
 * THE STEWARDS' GET ROUTES EACH ADMIN PAGE READS, DERIVED: the table shared/adminActs/reads.ts is held equal to.
 *
 * An act is plain data and reads no files, so the routes a page reads are written down beside the registry. What
 * is written down is exactly what this derives, and server/gardenReads.test.ts fails by name when the two differ,
 * in either direction. Nobody types a read: `npx tsx scripts/garden-reads.ts --write` rewrites the table.
 *
 *   which routes   every GET route the server registers (server/testkit/routeDoors.ts) that is a steward's by
 *                  evidence: it sits under /api/admin/, the permission matrix shows it is admin's, or its own
 *                  handler asks the admin question or names a power only a role gives (`stewardsRoute`,
 *                  shared/gardenScore.ts). A route with no such evidence is never claimed for an admin page,
 *                  even where an admin page calls it.
 *   which pages    every Admin tab that is a page of its own, and every page beside Admin an act lands on
 *   reads          the page's own code calls the route's path (server/testkit/clientReads.ts says how it reads
 *                  a page, and what it cannot see)
 */
import { ADMIN_ACTS } from "../../shared/adminActs";
import { TAB_PAGES } from "../../shared/adminActs/derived";
import { stewardsRoute } from "../../shared/gardenScore";
import { barePath } from "../../shared/gardenMounts";
import { ClientReader, codeCalls } from "./clientReads";
import { readMatrix } from "./gardenInputs";
import { routeDoors } from "./routeDoors";

export interface PageReads {
  /** Tab key -> the stewards' GET routes its code calls, sorted. A tab that reads none is absent. */
  tabs: Record<string, string[]>;
  /** A page's bare path -> the stewards' GET routes its code calls, sorted. */
  paths: Record<string, string[]>;
  /** Tabs and pages the reader found no component for, so nothing can be claimed for them. */
  blind: string[];
}

/** The pages beside Admin an act lands on, each a bare path, once. */
export function actPagePaths(): string[] {
  return Array.from(new Set(ADMIN_ACTS.filter((a) => !a.tab && a.path).map((a) => barePath(a.path!)))).sort();
}

export function derivePageReads(root: string): PageReads {
  const matrix = readMatrix(root);
  const { doors } = routeDoors(root);
  const gets = Array.from(new Set(doors.filter((d) => d.method === "GET" && d.path.startsWith("/api/") && stewardsRoute(d, matrix)).map((d) => d.path))).sort();
  const reader = new ClientReader(root);
  const blind: string[] = [];
  const found = (code: string) => gets.filter((p) => codeCalls(code, p));

  const tabs: Record<string, string[]> = {};
  for (const t of TAB_PAGES) {
    if (!reader.tabComponents().has(t.key)) {
      blind.push(`tab ${t.key}`);
      continue;
    }
    const reads = found(reader.tabCode(t.key));
    if (reads.length) tabs[t.key] = reads;
  }
  const paths: Record<string, string[]> = {};
  for (const p of actPagePaths()) {
    if (!reader.pageComponents().has(p)) {
      blind.push(`page ${p}`);
      continue;
    }
    const reads = found(reader.pageCode(p));
    if (reads.length) paths[p] = reads;
  }
  return { tabs, paths, blind };
}
