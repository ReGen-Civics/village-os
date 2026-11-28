/**
 * The Treasury, Admin, Mint and Cash pages keep their own lazy chunks: none of
 * them may join "smallpages", "midpages", "shopfront" or "smallui", where a
 * member opening a neighbour would download them (client/src/lib/privilegedChunks.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ONLY_HOME, drawsAdminOnly, mayJoinSharedGroup, opensPrivileged, PRIVILEGED_PAGE } from "./privilegedChunks";

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

  it("keeps the admin garden out: its look and its mount on /admin, and nothing beside them", () => {
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/gardenMount/AdminGardenShell.tsx")).toBe(false);
    expect(mayJoinSharedGroup("C:\\repo\\client\\src\\components\\admin\\gardenMount\\AdminGardenShell.tsx")).toBe(false);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/garden/Grounds.tsx")).toBe(false);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/garden/StatusBand.tsx")).toBe(false);
    // Its plain modules too: the place table and the memory helper were grouped with member pages by a rule that named only components.
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/garden/places.ts")).toBe(false);
    expect(mayJoinSharedGroup("C:\\repo\\client\\src\\components\\admin\\garden\\gardenMemory.ts")).toBe(false);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/gardenMount/groundTabs.ts")).toBe(false);
    expect(mayJoinSharedGroup("/repo/shared/gardenArt.ts")).toBe(false);
    expect(mayJoinSharedGroup("/repo/shared/gardenArtOther.ts")).toBe(true);
    // A neighbour whose name only starts the same is an ordinary admin component.
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/gardening/Other.tsx")).toBe(true);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/HomeBase.tsx")).toBe(true);
  });

  it("lets ordinary member pages and components group as before", () => {
    for (const name of ["Roles", "Events", "Badges", "Stay"]) expect(mayJoinSharedGroup(page(name)), name).toBe(true);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/TokensTab.test.tsx")).toBe(true);
    expect(PRIVILEGED_PAGE.test("/repo/client/src/components/Treasury.tsx")).toBe(false);
  });

  it("is asked by every page and component group rule in vite.config.ts", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "vite.config.ts"), "utf8").replace(/\r\n/g, "\n");
    // Both askers go through mayJoinSharedGroup: a component group also asks what the module opens, a page group what the page draws.
    expect(config).toMatch(/const groupable = \(id: string, info: ModuleInfoOf\): boolean => mayJoinSharedGroup\(id\) && !opensPrivileged\(info\(id\)\?\.dynamicallyImportedIds \?\? \[\]\);/);
    expect(config).toMatch(/const groupablePage = \(id: string, info: ModuleInfoOf\): boolean => mayJoinSharedGroup\(id\) && !drawsAdminOnly\(info\(id\)\?\.importedIds \?\? \[\]\);/);
    // The page rules: smallpages, shopfront and midpages; the big page groups; the rites.
    expect(config).toMatch(/if \(SMALL_PAGE\.test\(id\)[^\n]*groupablePage\(id, getModuleInfo\)\) \{/);
    expect(config).toMatch(/!key\.has\(m\) && groupablePage\(m, getModuleInfo\)\)/);
    expect(config).toMatch(/if \(RITES_PAGE\.test\(id\)[^\n]*groupablePage\(id, getModuleInfo\)\) return "rites";/);
    // The three module group rules: smallGroupOf, the "keyset-" candidate filter, and lazyGroupPlan's `free`
    // (the "lazy-" groups and every module that rides in a group); and a follower, which rides in its importer's group.
    expect(config.match(/!SMALL_GROUP_NEVER\.test\(id\) &&\s*\n\s*groupable\(id, info\) &&/g)?.length).toBe(3);
    expect(config).toMatch(/SMALL_GROUP_NEVER\.test\(dep\) \|\| !groupable\(dep, info\)/);
    // And nothing asks the bare name rule alone any more.
    expect(config.match(/mayJoinSharedGroup\(/g)?.length).toBe(2);
  });
});

/**
 * THE GUIDE'S DOCK AND THE ADMIN GARDEN sit behind the admin pages' own chunks (28 Nov 2026). Before this rule the
 * helper's host rode "smallui", so the dock's chunk, with the garden's code and stylesheet in it, was one lazy import
 * away from every member page that loads that group.
 */
describe("the dock and the garden never ride a shared group, and neither does a door to them", () => {
  const src = (...parts: string[]) => path.join(process.cwd(), "client", "src", ...parts);
  /** A module's lazy imports, read from its source and resolved the way the build resolves a relative one. */
  const lazyImportsOf = (file: string): string[] =>
    Array.from(fs.readFileSync(file, "utf8").matchAll(/import\(\s*["']([^"']+)["']\s*\)/g), (m) =>
      m[1].startsWith(".") ? path.resolve(path.dirname(file), m[1]) + ".tsx" : m[1].replace(/^@\//, src() + path.sep) + ".tsx",
    );
  const staticImportsOf = (file: string): string[] =>
    Array.from(fs.readFileSync(file, "utf8").matchAll(/^import\s[^;]*?from\s+["']([^"']+)["'];?\s*$/gm), (m) =>
      m[1].startsWith(".") ? path.resolve(path.dirname(file), m[1]) + ".tsx" : m[1].replace(/^@\//, src() + path.sep) + ".tsx",
    );

  it("keeps every file of the two folders out, whatever it is called, on either slash", () => {
    for (const file of ["dock/GuideDock.tsx", "dock/dockState.ts", "dock/dockWords.tsx", "dock/JourneyGuide.tsx", "garden/Garden.tsx", "garden/speaking.tsx", "garden/gardenMemory.ts", "garden/garden.css", "garden/a/new/Piece.tsx"]) {
      expect(mayJoinSharedGroup(`/repo/client/src/components/admin/${file}`), file).toBe(false);
      expect(mayJoinSharedGroup(`C:\\repo\\client\\src\\components\\admin\\${file.replace(/\//g, "\\")}`), file).toBe(false);
    }
    // Every file that is really there, so a new one cannot slip by under a name nobody thought of.
    for (const folder of ["dock", "garden"]) {
      for (const name of fs.readdirSync(src("components", "admin", folder))) expect(mayJoinSharedGroup(src("components", "admin", folder, name)), `${folder}/${name}`).toBe(false);
    }
    // The folders beside them are not swept up: Admin's own small helpers group as they did.
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/adminHelperApi.ts")).toBe(true);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/search/adminSearchModel.ts")).toBe(true);
    expect(mayJoinSharedGroup("/repo/client/src/components/dock/Thing.tsx")).toBe(true);
    expect(ADMIN_ONLY_HOME.test("/repo/client/src/components/admin/gardening.ts")).toBe(false);
  });

  it("holds out a door: a module that lazily imports a privileged piece, told by what it opens and never by its name", () => {
    expect(opensPrivileged([])).toBe(false);
    expect(opensPrivileged(["/repo/client/src/components/admin/AdminHelperPanel.tsx", "/repo/client/src/pages/Roles.tsx"])).toBe(false);
    expect(opensPrivileged(["/repo/client/src/components/admin/AdminHelperPanel.tsx", "/repo/client/src/components/admin/dock/GuideDock.tsx"])).toBe(true);
    expect(opensPrivileged(["C:\\repo\\client\\src\\components\\admin\\garden\\Garden.tsx"])).toBe(true);
    // The pieces the rule already knew are doors' ends too.
    expect(opensPrivileged(["/repo/client/src/components/admin/MintDesk.tsx"])).toBe(true);
    expect(opensPrivileged(["/repo/client/src/components/myMoon/PayBoard.tsx"])).toBe(true);
  });

  it("finds the helper's host to be a door, read from its own source", () => {
    const host = src("components", "admin", "AdminHelperHost.tsx");
    const opens = lazyImportsOf(host);
    expect(opens.map((f) => path.relative(src(), f).replace(/\\/g, "/"))).toContain("components/admin/dock/GuideDock.tsx");
    expect(opensPrivileged(opens)).toBe(true);
    // By its name alone the host would group, which is how "smallui" took it: the rule is what it opens.
    expect(mayJoinSharedGroup(host)).toBe(true);
    // The road's own opener lives in the dock's folder, so it is held out twice over.
    expect(opensPrivileged(lazyImportsOf(src("components", "admin", "dock", "JourneyGuide.tsx")))).toBe(true);
  });

  it("keeps a route page that draws the dock or the garden in a file of its own: the road to launch does", () => {
    expect(drawsAdminOnly([])).toBe(false);
    expect(drawsAdminOnly(["/repo/client/src/components/treasury/deskLooks.tsx", "/repo/client/src/components/admin/MintDesk.tsx"])).toBe(false);
    expect(drawsAdminOnly(["/repo/client/src/components/admin/dock/JourneyGuide.tsx"])).toBe(true);
    expect(drawsAdminOnly(["C:\\repo\\client\\src\\components\\admin\\garden\\index.ts"])).toBe(true);
    const road = src("pages", "JourneyToLaunch.tsx");
    expect(drawsAdminOnly(staticImportsOf(road))).toBe(true);
    // By its name the road would join a page group; before this rule it stood alone only by its weight.
    expect(mayJoinSharedGroup(road)).toBe(true);
    // A member page draws neither.
    expect(drawsAdminOnly(staticImportsOf(src("pages", "Roles.tsx")))).toBe(false);
  });

  it("no module outside the two folders imports them, but the host, the road and the dock itself", () => {
    const outside: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (!ADMIN_ONLY_HOME.test(full + path.sep)) walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) continue;
        const text = fs.readFileSync(full, "utf8");
        if (/(?:from\s+|import\(\s*)["'][^"']*(?:admin\/|\.\/|\.\.\/)(?:dock|garden)\/[^"']*["']/.test(text)) outside.push(path.relative(src(), full).replace(/\\/g, "/"));
      }
    };
    walk(src());
    expect(outside.sort()).toEqual(["components/admin/AdminHelperHost.tsx", "pages/JourneyToLaunch.tsx"]);
  });
});

