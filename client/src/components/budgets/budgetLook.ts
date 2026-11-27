/**
 * The budget desk's two looks. On /governance/treasury it draws in the sheet's look
 * (docs/DESIGN_RULE.md, the class strings in components/journey/look.ts); in
 * Admin it draws like the other books a treasurer keeps there
 * (CashPayoutsTab), which is light-only by ruling. Plain strings, no import
 * cost beyond the words.
 */
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, FIELD, H2, HINT, LABEL, TILE } from "@/components/journey/look";

export interface BudgetLook {
  panel: string;
  tile: string;
  eyebrow: string;
  h2: string;
  hint: string;
  chip: string;
  label: string;
  field: string;
  primary: string;
  secondary: string;
  error: string;
  figure: string;
}

export const SHEET_LOOK: BudgetLook = {
  panel: CARD,
  tile: TILE,
  eyebrow: EYEBROW,
  h2: H2,
  hint: HINT,
  chip: CHIP_SOFT,
  label: LABEL,
  field: FIELD,
  primary: BTN_PRIMARY,
  secondary: BTN_SECONDARY,
  error: "rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive",
  figure: "font-display text-3xl text-foreground",
};

export const ADMIN_LOOK: BudgetLook = {
  panel: "rounded-xl border border-border bg-white p-6",
  tile: "rounded-xl border border-border bg-white p-4",
  eyebrow: "text-xs font-medium uppercase tracking-wide text-muted-foreground",
  h2: "text-lg font-semibold text-foreground",
  hint: "text-sm text-muted-foreground",
  chip: "inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
  label: "text-xs font-medium text-muted-foreground",
  field: "mt-1 block w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-foreground",
  primary: "min-h-11 rounded-lg bg-teal-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-40",
  secondary: "min-h-11 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-40",
  error: "rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive",
  figure: "text-2xl font-semibold text-foreground",
};
