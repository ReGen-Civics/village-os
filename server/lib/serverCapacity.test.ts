/**
 * What this server can hold, read by itself (the lead, 19 Nov 2026): the container's memory limit from its cgroup,
 * v2 first and v1 after, with "no limit" read as none, and the volume's room.
 */
import os from "node:os";
import { describe, expect, it } from "vitest";
import { diskRoom, memoryLimit, parseCgroupMemory, serverCapacity } from "./serverCapacity";
import { roomFor } from "./uploadDisk";

describe("the container's memory limit", () => {
  it("reads a figure, and reads 'max', nothing, or v1's enormous no-limit as no limit", () => {
    expect(parseCgroupMemory("1073741824\n")).toBe(1073741824);
    expect(parseCgroupMemory("max\n")).toBeNull();
    expect(parseCgroupMemory("")).toBeNull();
    expect(parseCgroupMemory(null)).toBeNull();
    expect(parseCgroupMemory("9223372036854771712")).toBeNull();
  });

  it("asks v2 first, then v1, and says which answered", async () => {
    const files: Record<string, string> = { "/sys/fs/cgroup/memory/memory.limit_in_bytes": "536870912" };
    expect(await memoryLimit(async (f) => files[f] ?? null)).toEqual({ bytes: 536870912, source: "cgroup v1" });
    files["/sys/fs/cgroup/memory.max"] = "max";
    expect(await memoryLimit(async (f) => files[f] ?? null)).toEqual({ bytes: null, source: "cgroup v2" });
    expect(await memoryLimit(async () => null)).toEqual({ bytes: null, source: null });
  });

  it("reports the machine's memory, this process's, and the room on a real volume", async () => {
    const c = await serverCapacity(os.tmpdir(), async () => "2147483648");
    expect(c.memory).toMatchObject({ limitBytes: 2147483648, limitSource: "cgroup v2", hostTotalBytes: os.totalmem() });
    expect(c.memory.rssBytes).toBeGreaterThan(0);
    expect(c.disk.freeBytes).toBeGreaterThan(0);
    expect(c.disk.totalBytes).toBeGreaterThanOrEqual(c.disk.freeBytes!);
    // A folder not made yet is read on its nearest parent.
    expect((await diskRoom(`${os.tmpdir()}/not-made-yet/deeper`)).freeBytes).toBeGreaterThan(0);
  });
});

describe("room on the volume for an upload", () => {
  const MiB = 1024 * 1024;
  it("needs the upload, everything arriving and the reserve; a volume that cannot say leaves the count cap to decide", async () => {
    const free = async () => 1000 * MiB;
    expect(await roomFor("/x", 400 * MiB, 0, 512 * MiB, free)).toBe(true);
    expect(await roomFor("/x", 400 * MiB, 100 * MiB, 512 * MiB, free)).toBe(false);
    expect(await roomFor("/x", 600 * MiB, 0, 512 * MiB, free)).toBe(false);
    expect(await roomFor("/x", 600 * MiB, 0, 512 * MiB, async () => null)).toBe(true);
  });
});
