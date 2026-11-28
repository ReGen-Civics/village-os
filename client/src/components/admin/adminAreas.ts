/**
 * Where every admin tab lives, in six plain areas.
 *
 * Home is the start page unless this device has turned it off. An old
 * `?tab=` link still opens that tab. The names and the one-line help are
 * the words a new steward reads.
 *
 * A tab is listed here once. A tab that was folded into another keeps its
 * address in adminTabAliases.ts and has no row here, so Home never shows one
 * page under two rows.
 */
import { storedText, writeStored } from "@/lib/safeStorage";
import { tabLanding } from "./adminTabAliases";

export const HOME_SWITCH_KEY = "admin.homeBase";

import type { AreaId } from "@shared/adminTabs";

export type { AreaId };

export interface AdminArea {
  id: AreaId;
  name: string;
  plain: string;
  help: string;
}

export const ADMIN_AREAS: AdminArea[] = [
  { id: "today", name: "Today", plain: "What needs you now", help: "Start here. It shows what is waiting and where to go next." },
  { id: "inbox", name: "Inbox", plain: "Everything people sent you", help: "Requests, notes and things waiting for an answer." },
  { id: "people", name: "People", plain: "Members and players", help: "Who is here, and the roles they hold." },
  { id: "village", name: "Your village", plain: "How the village is set up", help: "The pages, the rules and the parts you can turn on." },
  { id: "events", name: "Events and messages", plain: "What you tell people", help: "The calendar and the mail the village sends." },
  { id: "connections", name: "Connections", plain: "Outside services the village uses", help: "Email, payments and the other services the village connects to." },
];

// The tab table lives in shared/adminTabs.ts, so the server and the registry of acts read the same rows.
export { ADMIN_TABS, tabEntry, tabsInArea, type AdminTabEntry } from "@shared/adminTabs";

export function homeBaseOn(): boolean {
  return storedText("local", HOME_SWITCH_KEY) !== "0";
}

export function setHomeBaseOn(on: boolean): void {
  writeStored("local", HOME_SWITCH_KEY, on ? "1" : "0");
}

/** The tab to open when the address does not name one. */
export function fallbackAdminTab(): string {
  return homeBaseOn() ? "home" : "submissions";
}

/**
 * An explicit `?tab=` wins. A bare /admin uses the device's start page. A tab
 * that was folded into another opens the one that holds its control now.
 */
export function tabFromSearch(search: string): string {
  const named = new URLSearchParams(search).get("tab");
  return named && named.trim() ? tabLanding(named).tab : fallbackAdminTab();
}
