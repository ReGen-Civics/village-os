/**
 * REPLAY PAST CRASH EMAILS THROUGH THE NEW RULES (the lead, 25 Nov 2026: "measure before and after").
 *
 * Reads what an admin can export: the crash alert emails in Admin, Comms (origin `notify.immediate`, subject
 * "Something broke in browser on <page>: <message>"), or the crash lines in the admin audit trail (kind
 * `client_crash`, text "<Name>: <message> (on <page>, <browser>, build <build>, <bundle>)"). Answers how many
 * would have emailed under server/lib/crashTriage.ts.
 *
 * WHAT AN EXPORT CANNOT SAY, said plainly in the result. A past email carries the message and the page and no stack,
 * so whether a frame was ours is not in it, and neither is who reported it. The replay therefore gives a RANGE:
 *   - at most: every signature left after the noise rules, once per day, as if each were ours;
 *   - at least: only the signatures that came back at least `spreadVisitors` times within the window, once per day,
 *     counting each report as a different visitor (generous, since one visitor can report twice).
 * Each email went to every admin on the list, so rows are first collapsed to one report per crash per minute.
 */
import { isCrashNoise, stableMessage } from "../../shared/crashNoise";
import { isStaleBuildMessage } from "../../shared/staleBuild";
import { TRIAGE_DEFAULTS, type TriageDials } from "./crashTriage";

export interface ReplayRow {
  /** The email's subject or the audit line's text. */
  text: string;
  /** When it was sent or recorded. */
  at: Date;
}

export interface ReplayReport {
  rows: number;
  /** Rows that are not browser crashes at all (another notice in the same export). */
  notCrashes: number;
  /** One per crash per minute, after collapsing the copies sent to each admin. */
  crashes: number;
  droppedAsNoise: number;
  droppedAsStaleBuild: number;
  signatures: number;
  wouldEmailAtMost: number;
  wouldEmailAtLeast: number;
  /** Each signature left, most first, with how many reports and how many emails at most and at least. */
  bySignature: Array<{ message: string; page: string; reports: number; atMost: number; atLeast: number }>;
  noise: Array<{ message: string; reports: number }>;
}

const SUBJECT = /^Something broke in browser on (\S+): ([\s\S]+)$/;
const AUDIT = /^(?:[\w$]+: )?([\s\S]+?) \(on (\S+), ([^,]*), build /;

/** The message and page out of one row, or null for a row that is not a browser crash. */
export function parseRow(text: string): { message: string; page: string } | null {
  const t = String(text ?? "").trim();
  const s = SUBJECT.exec(t);
  if (s) return { page: s[1], message: s[2].trim() };
  const a = AUDIT.exec(t);
  if (a) return { message: a[1].trim(), page: a[2] };
  return null;
}

/** Emails one signature would send: once, then again only after the window has passed. */
function emailsAcross(times: readonly number[], everyMs: number): number {
  let n = 0;
  let last = -Infinity;
  for (const t of times) {
    if (t - last >= everyMs) {
      n++;
      last = t;
    }
  }
  return n;
}

export function replay(rows: readonly ReplayRow[], dials: TriageDials = TRIAGE_DEFAULTS): ReplayReport {
  const report: ReplayReport = { rows: rows.length, notCrashes: 0, crashes: 0, droppedAsNoise: 0, droppedAsStaleBuild: 0, signatures: 0, wouldEmailAtMost: 0, wouldEmailAtLeast: 0, bySignature: [], noise: [] };
  const seen = new Set<string>();
  const kept = new Map<string, { message: string; page: string; times: number[] }>();
  const noise = new Map<string, number>();
  for (const row of [...rows].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const parsed = parseRow(row.text);
    if (!parsed) {
      report.notCrashes++;
      continue;
    }
    const minute = Math.floor(row.at.getTime() / 60_000);
    const once = `${parsed.page}|${parsed.message}|${minute}`;
    if (seen.has(once)) continue;
    seen.add(once);
    report.crashes++;
    if (isCrashNoise(parsed.message, [])) {
      report.droppedAsNoise++;
      noise.set(parsed.message, (noise.get(parsed.message) ?? 0) + 1);
      continue;
    }
    if (isStaleBuildMessage(parsed.message)) {
      report.droppedAsStaleBuild++;
      noise.set(parsed.message, (noise.get(parsed.message) ?? 0) + 1);
      continue;
    }
    const key = stableMessage(parsed.message);
    const k = kept.get(key) ?? { message: parsed.message, page: parsed.page, times: [] };
    k.times.push(row.at.getTime());
    kept.set(key, k);
  }
  const everyMs = dials.emailEveryHours * 3600_000;
  const windowMs = dials.spreadMinutes * 60_000;
  for (const k of Array.from(kept.values())) {
    const atMost = emailsAcross(k.times, everyMs);
    // The moments a report was the Nth within the window: when the spread rule would have fired.
    const spread = k.times.filter((t, i) => k.times.filter((u, j) => j <= i && t - u < windowMs).length >= dials.spreadVisitors);
    const atLeast = emailsAcross(spread, everyMs);
    report.bySignature.push({ message: k.message, page: k.page, reports: k.times.length, atMost, atLeast });
    report.wouldEmailAtMost += atMost;
    report.wouldEmailAtLeast += atLeast;
  }
  report.signatures = kept.size;
  report.bySignature.sort((a, b) => b.reports - a.reports);
  report.noise = Array.from(noise, ([message, reports]) => ({ message, reports })).sort((a, b) => b.reports - a.reports);
  return report;
}

/** Rows out of an export as it comes: a JSON array of objects, or a CSV with a header row. */
export function rowsFromExport(raw: string): ReplayRow[] {
  const text = raw.replace(/^﻿/, "").trim();
  const objects: Array<Record<string, unknown>> = text.startsWith("[") || text.startsWith("{") ? asArray(JSON.parse(text)) : csvObjects(text);
  const pick = (o: Record<string, unknown>, names: string[]) => {
    for (const n of names) {
      const hit = Object.keys(o).find((k) => k.toLowerCase() === n);
      if (hit && o[hit] != null && String(o[hit]).trim() !== "") return String(o[hit]);
    }
    return "";
  };
  return objects
    .map((o) => ({ text: pick(o, ["subject", "title", "text"]), at: new Date(pick(o, ["sent_at", "sentat", "created_at", "createdat", "at", "date"])) }))
    .filter((r) => r.text && !Number.isNaN(r.at.getTime()));
}

function asArray(v: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
  const inner = v && typeof v === "object" ? Object.values(v as object).find(Array.isArray) : null;
  return (inner as Array<Record<string, unknown>>) ?? [];
}

/** A small CSV reader: quoted fields, doubled quotes, commas and newlines inside quotes. */
function csvObjects(text: string): Array<Record<string, unknown>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((f) => f.trim() !== ""));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}
