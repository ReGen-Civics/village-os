// @vitest-environment jsdom
/**
 * THE PROPOSAL'S EARLIER VERSIONS (QA rounds 2 and 3): the current words once, then each earlier version newest
 * first, dated on ONE clock with the notes beside them (UTC), the time added when two share a day and the seconds
 * when two share a minute.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import ProposalVersions from "./ProposalVersions";

i18n.load("en", {});
i18n.activate("en");
afterEach(cleanup);

const draw = (versions: Array<{ at: string; why: string; aim: string }>) =>
  render(
    <I18nProvider i18n={i18n}>
      <ProposalVersions versions={versions} current={{ why: "Now why.", aim: "Now aim." }} />
    </I18nProvider>,
  );

const labels = () => Array.from(document.querySelectorAll("[data-proposal-version] p:first-child")).map((p) => p.textContent ?? "");

describe("the proposal's earlier versions", () => {
  it("says the current words once, above every earlier version", () => {
    draw([
      { at: "2026-11-20T10:00:00.000Z", why: "First.", aim: "A." },
      { at: "2026-11-25T10:00:00.000Z", why: "Second.", aim: "B." },
    ]);
    expect(document.querySelectorAll("[data-proposal-current]")).toHaveLength(1);
    expect(labels()).toEqual(["Before November 25, 2026", "Before November 20, 2026"]);
  });

  it("groups by the UTC day the notes use: 23:16 UTC on the 27th is the 27th for every reader", () => {
    draw([
      { at: "2026-11-27T05:16:00.000Z", why: "One.", aim: "A." },
      { at: "2026-11-27T23:16:00.000Z", why: "Two.", aim: "B." },
    ]);
    const [later, earlier] = labels();
    expect(later).toContain("November 27, 2026");
    expect(later).toMatch(/11:16\sPM/);
    expect(later).toContain("UTC");
    expect(earlier).toMatch(/5:16\sAM/);
    // CONTROL: a lone day carries no time.
    cleanup();
    draw([{ at: "2026-11-27T23:16:00.000Z", why: "One.", aim: "A." }]);
    expect(labels()[0]).toBe("Before November 27, 2026");
  });

  it("adds the seconds when two versions share a minute", () => {
    draw([
      { at: "2026-11-27T10:16:05.000Z", why: "One.", aim: "A." },
      { at: "2026-11-27T10:16:40.000Z", why: "Two.", aim: "B." },
    ]);
    const [later, earlier] = labels();
    expect(later).toMatch(/10:16:40/);
    expect(earlier).toMatch(/10:16:05/);
    expect(later).not.toBe(earlier);
  });
});
