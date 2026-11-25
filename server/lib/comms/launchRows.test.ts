import { describe, expect, it } from "vitest";
import type { SetupItem } from "../../../shared/comms/settings";
import { LAUNCH_REQUIREMENTS } from "../../../shared/launchRequirements";
import { LAUNCH_SETUP_KEYS, commsLaunchRow } from "./setup";

const item = (key: SetupItem["key"], done: boolean): SetupItem => ({ key, n: 5, label: key, done, required: true, detail: `${key} ${done ? "set" : "missing"}`, fix: "" });

describe("comms launch rows", () => {
  it("reads the postal address off the checklist, done or not", () => {
    expect(commsLaunchRow([item("postal-address", true)], "postal-address")).toEqual({ state: "ok", detail: "postal-address set" });
    expect(commsLaunchRow([item("postal-address", false)], "postal-address")).toEqual({ state: "missing", detail: "postal-address missing" });
  });

  it("has a resolver for every comms: launch row, so none reads as a platform bug", () => {
    const names = LAUNCH_REQUIREMENTS.filter((r) => r.checkKey.startsWith("comms:")).map((r) => r.checkKey.slice("comms:".length));
    expect(names).toContain("postal-address");
    for (const n of names) expect(Object.keys(LAUNCH_SETUP_KEYS), n).toContain(n);
  });
});
