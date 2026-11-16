/**
 * Audit S2: the two ADMIN_PASSWORD doors share a GLOBAL budget of failures,
 * checked before the compare, and refuse a password under 20 characters.
 */
import { describe, expect, it } from "vitest";
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  adminPasswordTooShort,
  DOOR_LIMITS,
  passwordDoorThrottled,
  recordPasswordDoorFailure,
  shortPasswordLogLine,
  type DoorCounter,
} from "./passwordDoors";

function memoryCounter(): DoorCounter & { hits: Map<string, number> } {
  const hits = new Map<string, number>();
  return {
    hits,
    count: async (bucket) => hits.get(bucket) ?? 0,
    record: async (bucket) => void hits.set(bucket, (hits.get(bucket) ?? 0) + 1),
  };
}

const PROD = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

describe("the password floor", () => {
  it("refuses under 20 characters outside the test runner, and accepts 20", () => {
    expect(ADMIN_PASSWORD_MIN_LENGTH).toBe(20);
    expect(adminPasswordTooShort("x".repeat(19), PROD)).toBe(true);
    expect(adminPasswordTooShort("x".repeat(20), PROD)).toBe(false);
    expect(adminPasswordTooShort(null, PROD)).toBe(true);
  });

  it("exempts only the test runner", () => {
    expect(adminPasswordTooShort("short", { NODE_ENV: "production", VITEST: "true" } as NodeJS.ProcessEnv)).toBe(false);
    expect(adminPasswordTooShort("short", { NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("the log line names the variable and the length, never the value", () => {
    const line = shortPasswordLogLine("bootstrap", 9);
    expect(line).toContain("ADMIN_PASSWORD is 9 characters");
    expect(line).toContain("[bootstrap]");
  });
});

describe("the global bucket", () => {
  it("a pool of addresses shares one hourly budget", async () => {
    const c = memoryCounter();
    const { globalHour } = DOOR_LIMITS["village-export"];
    for (let i = 0; i < globalHour; i++) {
      const ip = `198.51.100.${i}`;
      expect(await passwordDoorThrottled(c, "village-export", ip), `attempt ${i + 1}`).toBeNull();
      await recordPasswordDoorFailure(c, "village-export", ip);
    }
    // A brand new address is refused too: the budget is the door's.
    expect(await passwordDoorThrottled(c, "village-export", "203.0.113.200")).toBe("hour");
    // The other door has its own.
    expect(await passwordDoorThrottled(c, "bootstrap", "203.0.113.200")).toBeNull();
  });

  it("the daily cap holds when the hourly window has rolled over", async () => {
    const c = memoryCounter();
    c.hits.set("bootstrap-fail-all:day", DOOR_LIMITS.bootstrap.globalDay);
    expect(await passwordDoorThrottled(c, "bootstrap", "198.51.100.1")).toBe("day");
  });

  it("one address is still held to its own, smaller budget", async () => {
    const c = memoryCounter();
    c.hits.set("bootstrap-fail-ip:198.51.100.1", DOOR_LIMITS.bootstrap.perIpHour);
    expect(await passwordDoorThrottled(c, "bootstrap", "198.51.100.1")).toBe("ip");
    expect(await passwordDoorThrottled(c, "bootstrap", "198.51.100.2")).toBeNull();
  });

  it("fails CLOSED when the global count cannot be taken, open on the per-IP one", async () => {
    const down: DoorCounter = { count: async () => null, record: async () => {} };
    expect(await passwordDoorThrottled(down, "village-export", "198.51.100.1")).toBe("day");
    const ipDown: DoorCounter = { count: async (b) => (b.includes("-fail-ip:") ? null : 0), record: async () => {} };
    expect(await passwordDoorThrottled(ipDown, "village-export", "198.51.100.1")).toBeNull();
  });
});
