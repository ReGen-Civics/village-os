/**
 * WHAT THIS SERVER CAN HOLD, READ BY ITSELF (the lead, 19 Nov 2026: "ensure we can receive full uploads"). The
 * admin-only capacity view (GET /api/admin/server-capacity, server/routes/openProposals.ts) reports it beside the
 * upload caps, so the people who keep the village can see whether a full application fits without anybody opening
 * the hosting provider's dashboard.
 *
 *   memory   the container's limit from its cgroup (v2 `memory.max`, else v1 `memory.limit_in_bytes`; "max" or an
 *            absurd v1 figure is no limit), the machine's total (`os.totalmem()`), and this process's RSS and heap
 *   disk     free and total bytes on the volume uploads stream to (`fs.statfs`)
 *
 * Read only, and nothing here is ever served to anybody but an admin.
 */
import fs from "node:fs";
import os from "node:os";

/** The cgroup files, in the order they are tried. */
export const CGROUP_MEMORY_FILES = [
  { file: "/sys/fs/cgroup/memory.max", source: "cgroup v2" },
  { file: "/sys/fs/cgroup/memory/memory.limit_in_bytes", source: "cgroup v1" },
] as const;

/** A v1 "no limit" is the largest page-aligned 63-bit figure; anything past a petabyte reads as no limit. */
const NO_LIMIT_ABOVE = 2 ** 50;

/** One cgroup file's text, as a limit in bytes, or null for no limit or nothing readable. */
export function parseCgroupMemory(text: string | null): number | null {
  const t = (text ?? "").trim();
  if (!t || t === "max") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n >= NO_LIMIT_ABOVE) return null;
  return n;
}

export interface MemoryLimit {
  bytes: number | null;
  /** Which file said so, or null when neither set a limit. */
  source: string | null;
}

/** The container's memory limit. `read` returns a file's text or null; a suite hands in its own. */
export async function memoryLimit(read: (file: string) => Promise<string | null> = (f) => fs.promises.readFile(f, "utf8").catch(() => null)): Promise<MemoryLimit> {
  for (const { file, source } of CGROUP_MEMORY_FILES) {
    const text = await read(file);
    if (text === null) continue;
    return { bytes: parseCgroupMemory(text), source };
  }
  return { bytes: null, source: null };
}

export interface DiskRoom {
  freeBytes: number | null;
  totalBytes: number | null;
}

/** Free and total bytes on the volume holding `dir` (or its nearest existing parent). */
export async function diskRoom(dir: string): Promise<DiskRoom> {
  let at = dir;
  for (let i = 0; i < 8; i++) {
    try {
      const s = await fs.promises.statfs(at);
      return { freeBytes: Number(s.bavail) * Number(s.bsize), totalBytes: Number(s.blocks) * Number(s.bsize) };
    } catch {
      const up = at.replace(/[\\/][^\\/]*$/, "");
      if (!up || up === at) break;
      at = up;
    }
  }
  return { freeBytes: null, totalBytes: null };
}

export interface ServerCapacity {
  memory: { limitBytes: number | null; limitSource: string | null; hostTotalBytes: number; rssBytes: number; heapUsedBytes: number };
  disk: DiskRoom;
}

/** The server's memory and the uploads volume's room, now. */
export async function serverCapacity(uploadsDir: string, read?: (file: string) => Promise<string | null>): Promise<ServerCapacity> {
  const limit = await memoryLimit(read);
  const mem = process.memoryUsage();
  return {
    memory: { limitBytes: limit.bytes, limitSource: limit.source, hostTotalBytes: os.totalmem(), rssBytes: mem.rss, heapUsedBytes: mem.heapUsed },
    disk: await diskRoom(uploadsDir),
  };
}
