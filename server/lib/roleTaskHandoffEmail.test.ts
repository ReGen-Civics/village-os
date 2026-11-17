// A task handed to a role reaches its holders by email, on the tasks preference.
import { describe, expect, it } from "vitest";
import { emailCadenceFor, resolveNotifyPrefs } from "./notify";

describe("role task handoff email cadence", () => {
  const defaults = resolveNotifyPrefs({});

  it("emails a hand-on and the answers that wait on somebody at once by default", () => {
    for (const t of ["role_task_handed", "role_task_edited", "role_task_declined"]) expect(emailCadenceFor(t, defaults)).toBe("immediate");
  });

  it("puts an accept and a done in the digest", () => {
    for (const t of ["role_task_accepted", "role_task_done"]) expect(emailCadenceFor(t, defaults)).toBe("daily");
  });

  it("follows the member's tasks preference, and emails nothing when they turned it off", () => {
    const daily = resolveNotifyPrefs({ notify: { tasksEmail: "daily" } });
    expect(emailCadenceFor("role_task_handed", daily)).toBe("daily");
    const off = resolveNotifyPrefs({ notify: { tasksEmail: "off" } });
    for (const t of ["role_task_handed", "role_task_edited", "role_task_declined", "role_task_accepted", "role_task_done"]) expect(emailCadenceFor(t, off)).toBe("off");
    const allOff = resolveNotifyPrefs({ notify: { emailsOff: true } });
    expect(emailCadenceFor("role_task_handed", allOff)).toBe("off");
  });
});
