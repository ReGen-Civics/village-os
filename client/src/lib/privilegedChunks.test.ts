/**
 * The Treasury, Admin, Mint and Cash pages keep their own lazy chunks: none of
 * them may join "smallpages", "midpages", "shopfront" or "smallui", where a
 * member opening a neighbour would download them (client/src/lib/privilegedChunks.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mayJoinSharedGroup, PRIVILEGED_PAGE } from "./privilegedChunks";

const page = (name: string) => path.join(process.cwd(), "client", "src", "pages", `${name}.tsx`);

describe("privileged pages never ride a shared page group", () => {
  it("keeps the Treasury out, on either slash", () => {
    expect(mayJoinSharedGroup(page("Treasury"))).toBe(false);
    expect(mayJoinSharedGroup("C:/repo/client/src/pages/Treasury.tsx")).toBe(false);
    expect(mayJoinSharedGroup("C:\\repo\\client\\src\\pages\\Treasury.tsx")).toBe(false);
  });

  it("keeps Admin*, Mint* and Cash* pages out", () => {
    for (const name of ["Admin", "AdminGuide", "Mint", "CashPayouts"]) expect(mayJoinSharedGroup(page(name)), name).toBe(false);
  });

  it("keeps the shared hand-mint form and the treasury components out", () => {
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/MintDesk.tsx")).toBe(false);
    expect(mayJoinSharedGroup("/repo/client/src/components/treasury/TreasuryCard.tsx")).toBe(false);
    // Pay by member (#1358) and the cash desk, each drawn by the Treasury and by Admin.
    expect(mayJoinSharedGroup("C:\\repo\\client\\src\\components\\myMoon\\PayBoard.tsx")).toBe(false);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/CashPayoutsTab.tsx")).toBe(false);
    // The role waitlist's admin panel and its letter, which /roles draws only for an admin.
    expect(mayJoinSharedGroup("/repo/client/src/components/roleCard/WaitlistAdmin.tsx")).toBe(false);
    expect(mayJoinSharedGroup("C:\\repo\\client\\src\\components\\roleCard\\WaitlistLetter.tsx")).toBe(false);
    expect(mayJoinSharedGroup("/repo/client/src/components/roleCard/WaitlistForm.tsx")).toBe(true);
    expect(mayJoinSharedGroup("/repo/client/src/components/myMoon/MyMoon.tsx")).toBe(true);
  });

  it("lets ordinary member pages and components group as before", () => {
    for (const name of ["Roles", "Events", "Badges", "Stay"]) expect(mayJoinSharedGroup(page(name)), name).toBe(true);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/TokensTab.test.tsx")).toBe(true);
    expect(PRIVILEGED_PAGE.test("/repo/client/src/components/Treasury.tsx")).toBe(false);
  });

  it("is asked by every page and component group rule in vite.config.ts", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "vite.config.ts"), "utf8");
    // The page rule that hands out smallpages, shopfront and midpages.
    expect(config).toMatch(/if \(SMALL_PAGE\.test\(id\)[^\n]*mayJoinSharedGroup\(id\)\) \{/);
    // The three module group rules: smallGroupOf, the "keyset-" candidate filter, and lazyGroupPlan's `free`
    // (the "lazy-" groups and every module that rides in a group).
    expect(config.match(/!SMALL_GROUP_NEVER\.test\(id\) &&\s*\n\s*mayJoinSharedGroup\(id\) &&/g)?.length).toBe(3);
  });
});
