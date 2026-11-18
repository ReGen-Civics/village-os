/**
 * How the budget desk talks to the server, and the shapes it reads back.
 *
 * The desk is drawn twice, in Admin (the admin's session as the bearer) and on
 * /budget (the member's session), so it takes a `call` and never builds a
 * header itself. Every route and its gate are in server/routes/budgets.ts; the
 * door the server answers with (`door.mayWrite`) is the only permission the
 * desk reads, and it decides nothing on its own.
 */
import type { BudgetCategory, LineStatus, NotCountedReason, PeriodKind } from "@shared/budgets";

export interface BudgetReply {
  ok: boolean;
  status: number;
  data: any;
}
export type BudgetCall = (path: string, body?: unknown, method?: string) => Promise<BudgetReply>;

/** A call through `fetch`, with the bearer the caller holds. A network failure reads as status 0. */
export function fetchCall(bearer: string): BudgetCall {
  return async (path, body, method = "POST") => {
    try {
      const res = await fetch(`/api${path}`, {
        method,
        headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: {} };
    }
  };
}

/**
 * The server's sentence from a refusal, never its code. The budget routes
 * answer in two shapes: `{ error: code, message: sentence }`, and the door's
 * `{ error: sentence, code }`. A one-word `error` is a code and is skipped.
 */
export function sentenceOf(data: any, fallback: string): string {
  const message = typeof data?.message === "string" ? data.message.trim() : "";
  if (message) return message;
  const error = typeof data?.error === "string" ? data.error.trim() : "";
  if (error && /\s/.test(error)) return error;
  return fallback;
}

export interface BudgetDoorView {
  mayWrite: boolean;
  via?: string;
  code?: string;
  message?: string;
}

/** One line as `lineView` in server/routes/budgets.ts shapes it. */
export interface BudgetLine {
  id: string;
  label: string;
  note: string | null;
  source: string;
  sourceLabel: string | null;
  periodKind: PeriodKind;
  periodKey: string;
  startsOn: string;
  endsOn: string;
  circleId: string | null;
  villageWide: boolean;
  roleId: string | null;
  category: BudgetCategory;
  plannedMinor: number;
  spentMinor: number | null;
  convertedMinor: number | null;
  currency: string;
  status: LineStatus;
  changedAt: string | null;
  changedAs: string | null;
}

export interface BudgetFigure {
  plannedMinor: number;
  committedMinor: number;
  leftMinor: number;
  currency: string;
  working: { notCounted: Array<{ id: string; reason: NotCountedReason; currency: string }> };
}

/** `GET /api/budgets`, the parts the desk draws. */
export interface BudgetRead {
  moon: { id: string; startsOn: string; endsOn: string; days: number };
  villageCurrency: string | null;
  lines: BudgetLine[];
  figure: BudgetFigure | null;
  byCircle: Array<{ circleId: string | null; circleName: string | null; totalMinor: number }>;
  note: { note: string } | null;
  mayReadCash: boolean;
  door: BudgetDoorView;
}

export interface PreviewLine {
  row: number | null;
  id: string | null;
  label: string;
  category: BudgetCategory;
  periodKey: string;
  plannedMinor: number;
  currency: string;
  status: LineStatus;
}
export interface PreviewChange extends PreviewLine {
  op: "change" | "restore" | "withdraw" | "lock" | "adopt";
  before: PreviewLine;
}

/** An import's preview or its write, as `importBudgetLines` answers it with the route's `door`. */
export interface ImportAnswer {
  ok: boolean;
  code: string | null;
  message: string | null;
  written: boolean;
  revision: string;
  added: PreviewLine[];
  changed: PreviewChange[];
  withdrawn: string[];
  unchanged: number;
  refused: Array<{ row: number; cell: string; message: string }>;
  held: Array<{ row: number; cell: string; message: string }>;
  flags: Array<{ row: number | null; cell: string; message: string }>;
  door?: BudgetDoorView & { suggest?: unknown };
}

/** A whole number of minor units, written back as the amount a person typed (2 decimals for most currencies). */
export function majorText(minor: number, exponent: number): string {
  if (exponent <= 0) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const unit = 10 ** exponent;
  return `${sign}${Math.floor(abs / unit)}.${String(abs % unit).padStart(exponent, "0")}`;
}
