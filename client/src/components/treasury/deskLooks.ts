/**
 * THE TREASURER'S DESKS, IN TWO LOOKS (fold QA round 1, 27 Nov 2026).
 *
 * The cash desk (CashPayoutsTab), the hand mint (MintDesk) and the pricing desk (PricingDesk) are drawn twice: in
 * Admin, which is light-only by ruling, and in Governance's Treasury, which stands in the sheet's night world
 * (docs/DESIGN_RULE.md). Each takes a `look`, the way BudgetDesk already does (components/budgets/budgetLook.ts).
 *
 * The ADMIN looks are the class strings each desk drew before, copied site by site, so Admin does not move. The SHEET
 * looks draw from components/journey/look.ts: the desk sits on the section's CARD, its parts on TILEs (one depth, never
 * a panel in a panel in a panel), one gold act per desk (BTN_PRIMARY), an act repeated on every row gold-edged
 * (BTN_NOTICE), every other act edged (BTN_SECONDARY), and every target at least 44px.
 *
 * Plain strings and one context, no component: a page pays only the words.
 */
import { createContext } from "react";
import { BTN_NOTICE, BTN_PRIMARY, BTN_SECONDARY, FIELD, HINT, LABEL, LINK, TILE } from "@/components/journey/look";

// ── The cash desk ───────────────────────────────────────────────────────────

export interface CashDeskLook {
  /** The box a refusal or sign-in sentence sits in. */
  refusedBox: string;
  /** A link in that box. */
  link: string;
  /** Export CSV. */
  exportBtn: string;
  /** The totals strip. */
  totals: string;
  /** The To pay / Paid switch, and one of its two halves. */
  tabs: string;
  tab: string;
  tabOn: string;
  tabOff: string;
  /** A select or input. */
  field: string;
  /** One member's lines. */
  group: string;
  /** "Record a bank transfer", on every member's lines. */
  rowAct: string;
  /** The transfer form opened under a member's lines. */
  payingBox: string;
  /** "Pick every line", "Clear". */
  textBtn: string;
  /** The one main act: Review the transfer, Yes, record it. */
  primary: string;
  /** Back, Cancel. */
  secondary: string;
  /** A line's tick box while picking. */
  tick: string;
}

export const CASH_ADMIN: CashDeskLook = {
  refusedBox: "rounded-xl border border-border bg-white p-6",
  link: "inline-flex min-h-[44px] items-center font-medium text-teal-deep underline",
  exportBtn: "min-h-9 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground",
  totals: "rounded-xl border border-border bg-white p-4",
  tabs: "flex rounded-lg border border-border bg-white p-0.5",
  tab: "min-h-9 rounded-md px-3 py-1.5 text-sm font-medium",
  tabOn: "bg-teal-deep text-white",
  tabOff: "text-foreground",
  field: "mt-1 block rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-foreground",
  group: "rounded-xl border border-border bg-white p-4",
  rowAct: "min-h-9 rounded-lg bg-teal-deep px-3 py-1.5 text-sm font-medium text-white",
  payingBox: "space-y-3 rounded-lg bg-gray-50 p-3",
  textBtn: "underline text-foreground",
  primary: "min-h-9 rounded-lg bg-teal-deep px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40",
  secondary: "min-h-9 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground",
  tick: "mt-1",
};

export const CASH_SHEET: CashDeskLook = {
  refusedBox: TILE,
  link: `${LINK} inline-flex min-h-11 items-center`,
  exportBtn: BTN_SECONDARY,
  totals: TILE,
  tabs: "flex rounded-xl border border-border bg-muted p-1",
  tab: "jw-btn min-h-11 rounded-lg px-4 text-sm font-semibold",
  tabOn: "bg-notice text-background",
  tabOff: "text-foreground hover:bg-card",
  field: `${FIELD} mt-1 block min-h-11`,
  group: TILE,
  rowAct: BTN_NOTICE,
  payingBox: "space-y-3 border-t border-border pt-3",
  textBtn: "min-h-11 px-1 text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground",
  primary: BTN_PRIMARY,
  secondary: BTN_SECONDARY,
  tick: "mt-1 size-6 shrink-0 accent-notice",
};

// ── The hand mint ───────────────────────────────────────────────────────────

export interface MintDeskLook {
  /** The mint form's part, and the grants record's part below it. */
  formBox: string;
  grantsBox: string;
  heading: string;
  /** How the mint's rules are told: Admin's full paragraph, or three short lines. */
  rules: "paragraph" | "bullets";
  rulesText: string;
  /** The form's fields: in a wrapping row in Admin, two to a row from sm up on the sheet. */
  formGrid: string;
  /** A field's visible label, wrapping the field; the reason's label takes the row's room. */
  label: string;
  reasonLabel: string;
  select: string;
  amount: string;
  reason: string;
  primary: string;
  /** One grant waiting or decided. */
  row: string;
  /** Sign it, on each grant waiting. */
  rowAct: string;
  secondary: string;
}

export const MINT_ADMIN: MintDeskLook = {
  formBox: "border border-border rounded-xl p-5",
  grantsBox: "border border-border rounded-xl p-5",
  heading: "font-semibold text-foreground mb-1",
  rules: "paragraph",
  rulesText: "text-xs text-muted-foreground mb-3",
  formGrid: "flex flex-wrap items-end gap-2",
  label: "flex flex-col gap-1 text-xs font-medium text-muted-foreground",
  reasonLabel: "flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground",
  select: "text-sm border border-border rounded-lg px-2 py-2 bg-background text-foreground",
  amount: "text-sm border border-border rounded-lg px-3 py-2 w-28 bg-background text-foreground",
  reason: "text-sm border border-border rounded-lg px-3 py-2 w-full bg-background text-foreground",
  primary: "min-h-11 text-sm bg-teal-deep text-white border border-border rounded-lg px-4 py-2 font-medium disabled:opacity-40",
  row: "flex flex-wrap items-center gap-3 border border-border rounded-lg px-3 py-2.5",
  rowAct: "min-h-11 text-sm bg-teal-deep text-white border border-border rounded-lg px-3 py-2 font-medium",
  secondary: "min-h-11 text-sm border border-border text-foreground rounded-lg px-3 py-2 font-medium",
};

export const MINT_SHEET: MintDeskLook = {
  formBox: "space-y-4",
  grantsBox: "space-y-4 border-t border-border pt-6",
  heading: "font-display text-xl text-card-foreground",
  rules: "bullets",
  rulesText: `${HINT} list-disc space-y-1 pl-5`,
  formGrid: "grid items-end gap-3 sm:grid-cols-2",
  label: `${LABEL} flex flex-col gap-1`,
  reasonLabel: `${LABEL} flex flex-col gap-1`,
  select: `${FIELD} min-h-11`,
  amount: `${FIELD} min-h-11`,
  reason: `${FIELD} min-h-11`,
  primary: BTN_PRIMARY,
  row: `${TILE} flex flex-wrap items-center gap-3`,
  rowAct: BTN_NOTICE,
  secondary: BTN_SECONDARY,
};

// ── The pricing desk ────────────────────────────────────────────────────────

export interface PricingDeskLook {
  /** A row's hours, as little as and as much as. */
  hourInput: string;
  /** The row the three hour boxes sit in, with their "from" and "to". */
  hoursRow: string;
  /** The hours before the Treasurer confirms them. */
  hoursPending: string;
  /** The one main act: use every suggestion inside the band. */
  bulk: string;
  /** Use a row's suggestion, set or send a row's own figure. */
  rowAct: string;
  /** Own figure, Confirm the hours, Cancel. */
  secondary: string;
  /** The small label a phone shows over a cell. */
  cellLabel: string;
  /** The four steps of the Treasurer's path. */
  stepDone: string;
  stepNow: string;
  stepIdle: string;
  link: string;
  /** A sentence that informs: no cash budget, a claim keeping its price. */
  info: string;
  infoRow: string;
  /** The four counts. */
  chipReady: string;
  chipHours: string;
  chipFlagged: string;
  chipQuiet: string;
  /** The list of quests. */
  table: string;
  flaggedRow: string;
  /** A row's kind of work and conditions. */
  inlineSelect: string;
  ownField: string;
  ownFieldOk: string;
  ownFieldFlagged: string;
  /** Send a figure outside the band for signing. */
  danger: string;
  flaggedBox: string;
  reasonSelect: string;
  /** The note an admin setting pay reads (PayDoorNote); unset keeps its own amber. */
  doorNote?: string;
  /** Draw no "use every suggestion" act while nothing is inside the band. */
  hideEmptyBulk?: boolean;
}

const PRICE_BTN = "rounded-lg px-3 py-2 text-sm font-semibold min-h-[40px]";

export const PRICING_ADMIN: PricingDeskLook = {
  hourInput: "w-12 border border-border rounded-md px-1.5 py-1.5 text-sm bg-card text-center",
  hoursRow: "flex flex-nowrap items-center gap-1.5 text-sm col-span-2 md:col-span-1",
  hoursPending: "border-notice bg-amber-light",
  bulk: `${PRICE_BTN} bg-teal-deep text-white hover:bg-teal-deep-dark disabled:opacity-50`,
  rowAct: `${PRICE_BTN} bg-teal-deep text-white hover:bg-teal-deep-dark disabled:opacity-50`,
  secondary: `${PRICE_BTN} border border-border text-teal-deep bg-card hover:bg-muted`,
  cellLabel: "block text-[11px] font-bold uppercase tracking-wide text-muted-foreground md:hidden",
  stepDone: "rounded-xl border p-3 border-sage/30 bg-sage-light",
  stepNow: "rounded-xl border p-3 border-teal-deep ring-2 ring-muted bg-card",
  stepIdle: "rounded-xl border p-3 border-border bg-card",
  link: "underline font-semibold",
  info: "rounded-xl bg-aqua-light text-foreground px-3 py-2 text-sm",
  infoRow: "rounded-lg bg-aqua-light text-foreground",
  chipReady: "rounded-full px-3 py-1 bg-sage-light text-sage",
  chipHours: "rounded-full px-3 py-1 bg-amber-light text-amber-ink",
  chipFlagged: "rounded-full px-3 py-1 bg-coral/10 text-coral",
  chipQuiet: "rounded-full px-3 py-1 bg-muted text-muted-foreground",
  table: "rounded-xl border border-border bg-card",
  flaggedRow: "bg-coral/5",
  inlineSelect: "appearance-none bg-transparent underline decoration-dotted cursor-pointer",
  ownField: "w-full border rounded-md px-2 py-2 text-sm",
  ownFieldOk: "border-border bg-card",
  ownFieldFlagged: "border-coral/40 bg-coral/10 text-coral font-semibold",
  danger: `${PRICE_BTN} bg-coral text-white disabled:opacity-50`,
  flaggedBox: "rounded-lg bg-coral/10 text-coral",
  reasonSelect: "border border-coral/30 rounded-md px-2 py-1 bg-card text-sm",
};

export const PRICING_SHEET: PricingDeskLook = {
  // On a phone the cell label leads the row; from md up it is hidden, so the row is one column shorter.
  hoursRow: "col-span-2 grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 text-sm md:col-span-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]",
  hourInput: "min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-1.5 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
  hoursPending: "border-notice",
  bulk: BTN_PRIMARY,
  rowAct: BTN_NOTICE,
  secondary: BTN_SECONDARY,
  cellLabel: "block text-xs font-semibold uppercase tracking-widest text-muted-foreground md:hidden",
  stepDone: "rounded-xl border border-open/50 bg-muted p-3",
  stepNow: "rounded-xl border-2 border-notice bg-card p-3",
  stepIdle: "rounded-xl border border-border bg-muted p-3",
  link: LINK,
  info: "rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground",
  infoRow: "rounded-lg border border-border bg-muted text-foreground",
  chipReady: "rounded-full border border-open/60 px-3 py-1 text-open",
  chipHours: "rounded-full border border-notice/70 px-3 py-1 text-notice",
  chipFlagged: "rounded-full border border-destructive/60 px-3 py-1 text-destructive",
  chipQuiet: "rounded-full border border-border bg-muted px-3 py-1 text-muted-foreground",
  table: "rounded-xl border border-border",
  flaggedRow: "bg-destructive/5",
  inlineSelect: "min-h-11 appearance-none bg-transparent text-left text-foreground underline decoration-dotted cursor-pointer",
  ownField: "min-h-11 w-full rounded-lg border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
  ownFieldOk: "border-border bg-background text-foreground",
  ownFieldFlagged: "border-destructive bg-destructive/10 text-destructive font-semibold",
  danger: BTN_NOTICE,
  flaggedBox: "rounded-lg border border-destructive/50 bg-destructive/10 text-destructive",
  reasonSelect: "min-h-11 rounded-lg border border-destructive/40 bg-background px-2 text-sm text-foreground",
  doorNote: "rounded-xl border border-notice/60 bg-muted px-3 py-2 text-sm text-foreground",
  hideEmptyBulk: true,
};

// ── The End of Moon review queue (components/myMoon/ReviewQueue.tsx) ──────────

/** The queue's classes. My Moon's look (MOON_QUEUE) lives beside the queue, so this file never carries moonUi. */
export interface QueueLook {
  /** The queue's own box; empty on a page that already sets it on a card. */
  section: string;
  headingTag: "h2" | "h3";
  heading: string;
  /** One member's recap. */
  row: string;
  /** One item inside it. */
  item: string;
  /** Open, Close. */
  toggle: string;
  /** An item's Approve, chosen and not. */
  choiceOn: string;
  choiceOff: string;
  /** An item's Return with a note, chosen. */
  returnOn: string;
  /** The one main act: Approve the work. */
  approveWork: string;
  /** Return the whole recap with a note. */
  secondary: string;
  input: string;
}

export const QUEUE_SHEET: QueueLook = {
  section: "flex flex-col gap-4",
  headingTag: "h3",
  heading: "font-display text-xl text-card-foreground",
  row: `${TILE} flex flex-col gap-3`,
  item: "flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0",
  toggle: `${BTN_SECONDARY} self-start`,
  choiceOn: `${BTN_NOTICE} bg-notice/15`,
  choiceOff: BTN_SECONDARY,
  returnOn: `${BTN_SECONDARY} border-destructive text-destructive`,
  approveWork: BTN_PRIMARY,
  secondary: BTN_SECONDARY,
  input: `${FIELD} min-h-11`,
};

/** Pay by member inside the End of Moon card: a part of the card, set off by a rule, never a panel of its own. */
export const PAY_BOARD_SHEET = "flex scroll-mt-28 flex-col gap-3 border-t border-border pt-5";

// ── The End of Moon review's settings (components/admin/moonReview) ─────────

/** The three settings editors' classes (PayersEditor, VillageSettingsEditor, RhythmEditor), read from context. */
export interface SettingsKit {
  input: string;
  label: string;
  button: string;
  primary: string;
  /** The panel each part of an editor sits in. */
  box: string;
}

/** Admin's: the classes the editors drew before (`inputClass` and the rest in useSettingsDocument.ts). */
export const ADMIN_KIT: SettingsKit = {
  input: "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground",
  label: "block text-sm font-medium text-foreground",
  button: "min-h-9 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground",
  primary: "min-h-9 rounded-lg bg-teal-deep px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40",
  box: "rounded-xl border border-border bg-white p-4",
};

/** The sheet's, which Governance's Treasury provides around the panel. */
export const SETTINGS_SHEET_KIT: SettingsKit = {
  input: `${FIELD} mt-1 w-full min-h-11`,
  label: `${LABEL} block`,
  button: BTN_SECONDARY,
  primary: BTN_PRIMARY,
  box: TILE,
};

/** Admin provides nothing, so Admin's editors read ADMIN_KIT. Kept here so the page that provides it carries no editor code. */
export const SettingsKitContext = createContext<SettingsKit>(ADMIN_KIT);
