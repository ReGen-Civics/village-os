// @vitest-environment jsdom
/**
 * BREADCRUMBS (the lead's team call, 26 Nov 2026): a page below its menu entry gets the trail back up, in the menu's
 * own words; an entry's own page and a page in no entry get none (components/nav/Breadcrumbs.tsx).
 */
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { formatter } from "@lingui/format-po";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { mergedPoText } from "../../../scripts/lib/poFragments.mjs";

const cfg: { current: Record<string, unknown> } = { current: {} };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: [], loaded: true, failed: false }) }));
vi.mock("@/lib/gameApi", () => ({
  useGameConfig: () => cfg.current,
  altOr: (value: string | undefined, fallback: string) => (typeof value === "string" ? value : fallback),
}));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/NotificationToasts", () => ({ default: () => null }));
vi.mock("@/components/RewardMoment", () => ({ default: () => null }));
vi.mock("./mobile/MobileTabBar", () => ({ default: () => null, isBareRoute: () => false }));
vi.mock("./mobile/MobileFab", () => ({ default: () => null }));
vi.mock("./NextStepTrail", () => ({ default: () => null }));

import Layout from "./Layout";
import { useCrumbLeaf } from "./nav/crumbLeaf";

afterEach(cleanup);

function Page({ name }: { name?: string }) {
  useCrumbLeaf(name);
  return <p>page body</p>;
}

const at = (where: string, opts: { menu?: Record<string, unknown>; name?: string } = {}) => {
  cfg.current = { project: { name: "Willowbrook" }, images: {}, ...(opts.menu ? { menu: opts.menu } : {}) };
  const { hook } = memoryLocation({ path: where, static: true });
  return render(
    <Router hook={hook}>
      <Layout>
        <Page name={opts.name} />
      </Layout>
    </Router>,
  );
};
const trail = () => screen.queryByRole("navigation", { name: "Breadcrumb" });

describe("the breadcrumb", () => {
  it("leads back up from a page below its entry: the group as words, the entry as a link", () => {
    at("/powers/water");
    const nav = trail()!;
    expect(nav).toBeTruthy();
    expect(nav.textContent?.replace(/\s*\/\s*/g, " / ").trim()).toBe("Decide / What We Look After");
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/powers"]);
  });

  it("ends with the page's own name when it gives one, marked as the page", () => {
    at("/powers/water", { name: "  Water  " });
    const here = within(trail()!).getByText("Water");
    expect(here.getAttribute("aria-current")).toBe("page");
    expect(trail()!.textContent?.replace(/\s*\/\s*/g, " / ").trim()).toBe("Decide / What We Look After / Water");
  });

  it("drops the page's name when the page leaves", () => {
    const r = at("/powers/water", { name: "Water" });
    act(() => r.unmount());
    at("/powers/fire");
    expect(trail()!.textContent).not.toContain("Water");
  });

  it("speaks the village's own words for the group and the entry", () => {
    at("/powers/water", { menu: { groups: { Decide: "Choose together" }, labels: { "/powers": "Who holds what" } } });
    expect(trail()!.textContent?.replace(/\s*\/\s*/g, " / ").trim()).toBe("Choose together / Who holds what");
  });

  it("is not drawn on an entry's own page, on a page in no entry, or under an entry the village hid", () => {
    at("/powers");
    expect(trail()).toBeNull();
    cleanup();
    at("/admin/anything");
    expect(trail()).toBeNull();
    cleanup();
    at("/powers/water", { menu: { hidden: ["/powers"] } });
    expect(trail()).toBeNull();
  });

  it("has its name in Spanish", async () => {
    const dir = path.resolve(__dirname, "../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const id = generateMessageId("Breadcrumb", "the trail at the top of a page: where it sits in the menu, read aloud");
    expect(es[id]?.translation).toBe("Ruta de navegación");
  });
});
