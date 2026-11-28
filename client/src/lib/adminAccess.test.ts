/**
 * The one test for "may this person use admin", and the menu rule built on it.
 *
 * The server sends `adminAccess` on the signed-in account (publicUser,
 * server/index.ts). These cases are the three ways in the server knows, and
 * the two people it keeps out.
 */
import { describe, expect, it } from "vitest";
import { ACCOUNT_MENU, NAV, isGroup, type NavLink } from "@/config/nav";
import { hasAdminAccess, holdsAdminRole, menuRolesAllow } from "./adminAccess";

const member = { role: "member", adminAccess: false };
const groupHolder = { role: "member", adminAccess: true };
const admin = { role: "admin", adminAccess: true };
const founder = { role: "founder", adminAccess: true };

describe("hasAdminAccess", () => {
  it("lets in an admin's account, a founder's account, and admin access through a power group", () => {
    expect(hasAdminAccess(admin)).toBe(true);
    expect(hasAdminAccess(founder)).toBe(true);
    expect(hasAdminAccess(groupHolder)).toBe(true);
  });

  it("reads the role even when an older payload carries no adminAccess", () => {
    expect(hasAdminAccess({ role: "admin" })).toBe(true);
    expect(hasAdminAccess({ role: "founder" })).toBe(true);
  });

  it("keeps out a member, a signed-out visitor, and an account with no role", () => {
    expect(hasAdminAccess(member)).toBe(false);
    expect(hasAdminAccess({ role: "member" })).toBe(false);
    expect(hasAdminAccess({})).toBe(false);
    expect(hasAdminAccess(null)).toBe(false);
    expect(hasAdminAccess(undefined)).toBe(false);
  });

  it("takes only the server's own true for an answer", () => {
    for (const notTrue of ["true", 1, "yes", {}, []]) {
      expect(hasAdminAccess({ role: "member", adminAccess: notTrue }), JSON.stringify(notTrue)).toBe(false);
    }
  });
});

describe("holdsAdminRole", () => {
  it("is the account's own role, so a power group's admin access is not enough", () => {
    expect(holdsAdminRole(admin)).toBe(true);
    expect(holdsAdminRole(founder)).toBe(true);
    expect(holdsAdminRole(groupHolder)).toBe(false);
    expect(holdsAdminRole(member)).toBe(false);
    expect(holdsAdminRole(null)).toBe(false);
  });
});

describe("menuRolesAllow", () => {
  const adminOnly = ["admin", "founder"] as const;
  const signedIn = ["member", "admin", "founder"] as const;

  it("shows an entry with no list to everyone, a visitor included", () => {
    expect(menuRolesAllow(undefined, null)).toBe(true);
    expect(menuRolesAllow(undefined, member)).toBe(true);
  });

  it("shows nothing with a list to a visitor", () => {
    expect(menuRolesAllow(adminOnly, null)).toBe(false);
    expect(menuRolesAllow(signedIn, undefined)).toBe(false);
  });

  it("reads the account's own role exactly as the menu always did", () => {
    expect(menuRolesAllow(adminOnly, admin)).toBe(true);
    expect(menuRolesAllow(adminOnly, founder)).toBe(true);
    expect(menuRolesAllow(adminOnly, member)).toBe(false);
    expect(menuRolesAllow(signedIn, member)).toBe(true);
    // A list that names one role and not the other still means what it says.
    expect(menuRolesAllow(["admin"], founder)).toBe(false);
    expect(menuRolesAllow(["founder"], admin)).toBe(false);
    expect(menuRolesAllow(adminOnly, { role: undefined })).toBe(false);
  });

  it("offers the admin pages to a member whose admin access comes from a power group", () => {
    expect(menuRolesAllow(adminOnly, groupHolder)).toBe(true);
    expect(menuRolesAllow(["admin"], groupHolder)).toBe(true);
    expect(menuRolesAllow(signedIn, groupHolder)).toBe(true);
    // A founder-only list is a different question and stays the founder's.
    expect(menuRolesAllow(["founder"], groupHolder)).toBe(false);
  });

  it("opens every entry the menu keeps for admins, and only those, to the group holder", () => {
    const every: NavLink[] = [...NAV.flatMap((e) => (isGroup(e) ? e.items : [e])), ...ACCOUNT_MENU];
    const adminEntries = every.filter((l) => l.roles?.includes("admin") && !l.roles.includes("member"));
    // A floor, so an empty list cannot pass: Command Centre, Review and Village Settings at least.
    expect(adminEntries.length).toBeGreaterThanOrEqual(3);
    for (const l of adminEntries) {
      expect(menuRolesAllow(l.roles, groupHolder), l.href).toBe(true);
      expect(menuRolesAllow(l.roles, member), l.href).toBe(false);
    }
    // And for everybody whose own role decides, the answer is the old predicate's, on every entry.
    const old = (l: NavLink, role: string | undefined) => !l.roles || (!!role && l.roles.includes(role));
    for (const l of every) {
      for (const who of [member, admin, founder]) {
        expect(menuRolesAllow(l.roles, who), `${l.href} as ${who.role}`).toBe(old(l, who.role));
      }
      expect(menuRolesAllow(l.roles, null), `${l.href} signed out`).toBe(old(l, undefined));
    }
  });
});
