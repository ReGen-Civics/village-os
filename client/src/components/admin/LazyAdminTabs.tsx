/**
 * THE ADMIN TABS THAT LOAD ON THEIR OWN, behind one spot in Admin.tsx (wayfinding lane, 27 Nov 2026).
 *
 * Admin.tsx sits at its file-line ratchet (scripts/file-lines-baseline.json), so a new lazy tab joins the spot an
 * existing one already took instead of adding an import and a render line there. Each tab is its own chunk, so the
 * Admin chunk never pays for a tab that is opened rarely.
 *   - compare    Compare proposals side by side (the lead, 20 Nov 2026).
 *   - menu-use   How the menu is used (MenuUseTab.tsx).
 */
import { lazy, Suspense } from "react";

const CompareTab = lazy(() => import("./CompareTab"));
const MenuUseTab = lazy(() => import("./MenuUseTab"));

const TABS: Readonly<Record<string, typeof CompareTab>> = { compare: CompareTab, "menu-use": MenuUseTab };

/** The lazy tab for `tab`, or nothing when the open tab is not one of them. */
export default function LazyAdminTab({ tab, password }: { tab: string; password: string }) {
  const Tab = TABS[tab];
  return Tab ? (
    <Suspense fallback={null}>
      <Tab password={password} />
    </Suspense>
  ) : null;
}
