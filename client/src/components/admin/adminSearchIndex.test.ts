/**
 * The search index and the menu agree: every control and every synonym row
 * names a tab that exists (client/src/components/admin/adminAreas.ts), so no
 * result can land on a page that is not there.
 */
import { describe, expect, it } from "vitest";
import { CONTROL_ENTRIES, TAB_SYNONYMS } from "@shared/adminSearch";
import { ADMIN_TABS } from "./adminAreas";

const KEYS = new Set(ADMIN_TABS.map((t) => t.key));

describe("the search index names only real tabs", () => {
  it("every control's tab exists", () => {
    for (const e of CONTROL_ENTRIES) expect(KEYS.has(e.tab!), `${e.id} -> ${e.tab}`).toBe(true);
  });

  it("every synonym row's tab exists", () => {
    for (const key of Object.keys(TAB_SYNONYMS)) expect(KEYS.has(key), key).toBe(true);
  });
});
