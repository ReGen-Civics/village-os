// @vitest-environment jsdom
/**
 * THE MODULE LIBRARY'S LEDE TELLS A READER TO TURN MODULES ON ONLY WHEN THAT READER CAN (copy key R49).
 *
 * The founder's pick of 28 Nov 2026 for the door to a working place: "Every tool this platform has. Turn on the
 * ones your village wants." The page is public, so a visitor and a member read it too, and neither can turn
 * anything on. The first sentence is for every reader. The second is drawn only where the catalog says this reader
 * may turn a module on with one press (`viewer.canSwitch`, decided by the server with `libraryViewer`): an admin or
 * a founder before launch, and a live holder of `module.switch` after it. That is the answer that also draws the
 * page's own Turn on, so the sentence and the button cannot disagree.
 *
 * Each viewer is made by `libraryViewer` itself, so these cases follow the server's rule if it changes. Each
 * reader who is not told is checked against the whole lede word for word, with the first sentence in it, so a page
 * that drew nothing cannot pass.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { libraryViewer, type LibraryViewer } from "@shared/moduleSwitch";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/gameApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gameApi")>()),
  authToken: () => null,
  useGameConfig: () => ({ project: { name: "Sample Village" } }),
}));

import Modules from "./Modules";

const HOLDS = "Every tool this platform has.";
const ACT = "Turn on the ones your village wants.";
const REST = "A village turns on what it needs and leaves the rest on the shelf, and every card wears its pills so you can read it at a glance.";

type Facts = Parameters<typeof libraryViewer>[0];

/** Serve the catalog with this viewer (or with none, as an older server would); every other read is refused. */
function serve(viewer: LibraryViewer | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url) === "/api/modules/catalog"
        ? { ok: true, status: 200, json: async () => ({ groups: [], builder: { guideUrl: "", poolUrl: "" }, modules: [], ...(viewer ? { viewer } : {}) }) }
        : { ok: false, status: 404, json: async () => ({}) },
    ),
  );
}

/** The lede as a reader sees it: the paragraph under the heading, without the closed tooltips' hidden words. */
function lede(): string {
  const p = screen.getByRole("heading", { level: 1, name: "Module Library" }).parentElement?.querySelector("p");
  if (!p) throw new Error("the lede paragraph is not under the heading");
  const seen = p.cloneNode(true) as HTMLElement;
  seen.querySelectorAll("[hidden]").forEach((n) => n.remove());
  return (seen.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Draw the page and wait until the catalog has landed (the search box is drawn only then). */
async function drawn(viewer: LibraryViewer | null): Promise<string> {
  serve(viewer);
  render(<Modules />);
  await screen.findByLabelText("Search the library");
  return lede();
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("the Module Library lede (R49)", () => {
  const TOLD: Array<[string, Facts]> = [
    ["an admin or founder before launch", { signedIn: true, admin: true, holder: false, launched: false }],
    ["a member who holds the power to switch modules, after launch", { signedIn: true, admin: false, holder: true, launched: true }],
    ["an admin who holds that power, after launch", { signedIn: true, admin: true, holder: true, launched: true }],
  ];
  const NOT_TOLD: Array<[string, Facts]> = [
    ["a visitor", { signedIn: false, admin: false, holder: false, launched: false }],
    ["a visitor after launch", { signedIn: false, admin: false, holder: false, launched: true }],
    ["a member before launch", { signedIn: true, admin: false, holder: false, launched: false }],
    ["a member after launch, who may only propose", { signedIn: true, admin: false, holder: false, launched: true }],
    ["an admin after launch who does not hold the power, who may only pause or propose", { signedIn: true, admin: true, holder: false, launched: true }],
  ];

  it.each(TOLD)("tells %s to turn on what the village wants", async (_who, facts) => {
    const viewer = libraryViewer(facts);
    expect(viewer.canSwitch).toBe(true);
    expect(await drawn(viewer)).toBe(`${HOLDS} ${ACT} ${REST}`);
  });

  it.each(NOT_TOLD)("says what the page holds to %s, and does not tell them to turn anything on", async (_who, facts) => {
    const viewer = libraryViewer(facts);
    expect(viewer.canSwitch).toBe(false);
    expect(await drawn(viewer)).toBe(`${HOLDS} ${REST}`);
  });

  it("does not tell anyone to turn anything on when an older server sends no viewer at all", async () => {
    expect(await drawn(null)).toBe(`${HOLDS} ${REST}`);
  });

  it("no longer calls a module a card in the lede's first sentence", async () => {
    expect(await drawn(libraryViewer({ signedIn: false, admin: false, holder: false, launched: false }))).not.toContain("one card at a time");
  });
});
