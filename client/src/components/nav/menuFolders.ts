/**
 * THE MENU'S SHELL HALF (kept small: the app shell loads on the first page).
 *
 * A VILLAGE'S OWN FOLDER NAMES (the lead, 27 Nov 2026: "Yes" to village-named folders). The village names a folder
 * in Admin, Menu (shared/menuDoc.ts, `folders`, keyed by the platform's folder name); until it does, a folder is the
 * platform's word in the reader's language (config/navWords.ts). Layout provides the village's names once, and every
 * surface that draws a folder (the dropdowns, the drawer, the account menu, the phone's More sheet and the breadcrumb)
 * reads them here, so a rename reaches all of them at once.
 *
 * THE FIREFLY'S PICK: Layout holds which entry wears it; the work of choosing it lives in the lazy joys chunk
 * (nav/menuJoys.tsx), so the first page carries only this context.
 */
import { createContext, useContext } from "react";
import type { I18n } from "@lingui/core";
import { navWord } from "@/config/nav";

export const MenuFolderNames = createContext<Readonly<Record<string, string>>>({});

/** A folder's name for this reader: the village's own, else the platform's word, translated. */
export function folderWord(platform: string, own: Readonly<Record<string, string>> | undefined, i18n?: I18n): string {
  return own?.[platform] || navWord(platform, i18n);
}

export function useFolderNames(): Readonly<Record<string, string>> {
  return useContext(MenuFolderNames);
}

/** The one entry that wears the firefly, or null (nav/menuJoys.tsx chooses it). */
export const MenuFirefly = createContext<string | null>(null);

/** The member whose waiting count the menu carries, or null (a visitor, a newcomer): nav/WaitingCount.tsx. */
export const MenuWaitingFor = createContext<string | null>(null);
