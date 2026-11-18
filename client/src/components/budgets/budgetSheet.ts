/**
 * A BUDGET SHEET, READ INTO ROWS (budgets spec R11 to R13, the upload).
 *
 * The server takes an upload as rows of cells (`POST /api/admin/budgets/import`,
 * `ImportRow` in server/lib/budgets.ts) and reads every cell itself: the
 * period, the circle and role by name or id, the category, the amount in the
 * village's number format. This file only turns a sheet into those rows. It
 * decides nothing about a cell, so a cell the server would refuse arrives as
 * written and comes back refused, with the server's sentence.
 *
 * A sheet is a CSV file saved from a spreadsheet, or cells copied straight out
 * of one and pasted (tab separated). The first row names the columns. Extra
 * columns are ignored; a missing column is simply not sent.
 */

/** The cells an upload row may carry, as `ImportRow` names them. */
export const SHEET_COLUMNS = ["period", "circle", "role", "category", "label", "planned", "spent", "currency", "note"] as const;
export type SheetColumn = (typeof SHEET_COLUMNS)[number];
export type SheetRow = Partial<Record<SheetColumn, string>>;

/** Other headings a spreadsheet tends to use, each read as one column. */
const ALIASES: Record<string, SheetColumn> = {
  period: "period",
  moon: "period",
  month: "period",
  circle: "circle",
  team: "circle",
  role: "role",
  category: "category",
  kind: "category",
  label: "label",
  line: "label",
  name: "label",
  description: "label",
  planned: "planned",
  amount: "planned",
  budget: "planned",
  spent: "spent",
  currency: "currency",
  note: "note",
  notes: "note",
};

/** A heading as a key: lower case, spaces and dashes as underscores, then the alias. */
const columnOf = (heading: string): SheetColumn | null => {
  const key = heading.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/^_+|_+$/g, "");
  return ALIASES[key] ?? (key.startsWith("planned") ? "planned" : null);
};

/** Tab when the first line has one (cells pasted from a spreadsheet), then semicolon, then comma. */
function delimiterOf(firstLine: string): string {
  if (firstLine.includes("\t")) return "\t";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

/** Every record of the text, quotes honoured: a quoted cell may hold the delimiter, a newline or "" for a quote. */
export function splitRecords(text: string, delimiter: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

export type SheetRead =
  | { ok: true; rows: SheetRow[]; columns: SheetColumn[]; ignored: string[] }
  | { ok: false; problem: "empty" | "no_columns" | "no_rows" | "no_label" };

/** A sheet's text read into rows the import route takes. */
export function readBudgetSheet(text: string): SheetRead {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, problem: "empty" };
  const firstLine = trimmed.split(/\r?\n/, 1)[0];
  const records = splitRecords(trimmed, delimiterOf(firstLine));
  const [head, ...body] = records;
  const map = head.map(columnOf);
  const columns = Array.from(new Set(map.filter((c): c is SheetColumn => c !== null)));
  if (!columns.length) return { ok: false, problem: "no_columns" };
  if (!columns.includes("label")) return { ok: false, problem: "no_label" };
  const ignored = head.filter((_, i) => map[i] === null).map((h) => h.trim()).filter(Boolean);
  const rows: SheetRow[] = body.map((cells) => {
    const row: SheetRow = {};
    map.forEach((col, i) => {
      if (!col || row[col] !== undefined) return;
      const v = (cells[i] ?? "").trim();
      if (v !== "") row[col] = v;
    });
    return row;
  });
  if (!rows.length) return { ok: false, problem: "no_rows" };
  return { ok: true, rows, columns, ignored };
}
