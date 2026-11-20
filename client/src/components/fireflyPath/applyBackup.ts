/**
 * THE APPLICATION, AS A FILE THE APPLICANT KEEPS (apply safety net, 19 Nov 2026).
 *
 * When a send fails, the page offers "Download my application": one readable
 * .html page built from what this browser holds (the saved draft, or the same
 * fields read from the page when nothing was kept), never from the server. It
 * names the village, every role applied for, every question with its answer
 * (each added role's commitment, price and split among them), when it was made
 * and the page it came from, and ends with the raw draft as JSON so nothing is
 * lost in the reading.
 *
 * What the draft never holds by rule (fireflyPath/applyDraft.ts) the file
 * cannot hold either: references, the background-check consent, files and
 * recordings. It says so, and the email asks for the files.
 *
 * Loaded only with the safety net (SafetyNet.tsx), off the page's first view.
 */
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { ApplyDraft } from "./applyDraft";
import { TERM_KEYS, TERM_LABELS } from "@shared/termsWords";
import { PIECE_NAMES } from "@shared/pieceSuggestions";

export interface BackupRole {
  id: string;
  name: string;
}

export interface BackupInput {
  village: string;
  /** The first role, then each role added. */
  roles: BackupRole[];
  draft: ApplyDraft;
  /** Season goals by id, so a value item's goal reads in words. */
  goals: Array<{ id: string; text: string }>;
  now: Date;
  pageUrl: string;
}

const W = {
  title: msg({ message: "Role application backup", context: "application backup file" }),
  lede: msg({ message: "This file was made on your device because your application did not reach us. Email it to us, and attach any files you meant to upload.", context: "application backup file" }),
  village: msg({ message: "Village", context: "application backup file" }),
  roles: msg({ message: "Roles", context: "application backup file" }),
  made: msg({ message: "Made", context: "application backup file" }),
  page: msg({ message: "Page", context: "application backup file" }),
  knowUs: msg({ message: "Ways you have got to know us", context: "application backup file" }),
  name: msg({ message: "Your name", context: "application backup file" }),
  email: msg({ message: "Your email", context: "application backup file" }),
  why: msg({ message: "Why you, and why now", context: "application backup file" }),
  based: msg({ message: "Where you are based", context: "application backup file" }),
  languages: msg({ message: "Languages", context: "application backup file" }),
  story: msg({ message: "Your story", context: "application backup file" }),
  self: msg({ message: "Your Human Design, Gene Keys, or ways of working", context: "application backup file" }),
  links: msg({ message: "Links to your work", context: "application backup file" }),
  aim: msg({ message: "Your aim in this role", context: "application backup file" }),
  items: msg({ message: "Value items", context: "application backup file" }),
  doneWhen: msg({ message: "Done when", context: "application backup file" }),
  serves: msg({ message: "Serves", context: "application backup file" }),
  terms: msg({ message: "The terms", context: "application backup file" }),
  commitment: msg({ message: "Commitment", context: "application backup file" }),
  ask: msg({ message: "Price ask", context: "application backup file" }),
  negotiate: msg({ message: "To talk through", context: "application backup file" }),
  split: msg({ message: "Split", context: "application backup file" }),
  accept: msg({ message: "Accepted", context: "application backup file" }),
  talk: msg({ message: "To talk through", context: "application backup file" }),
  rampUp: msg({ message: "Ramp-up", context: "application backup file" }),
  yes: msg({ message: "Yes", context: "application backup file" }),
  no: msg({ message: "No", context: "application backup file" }),
  firstDay: msg({ message: "Your first moon", context: "application backup file" }),
  timeZone: msg({ message: "Time zone", context: "application backup file" }),
  windows: msg({ message: "Times that suit you", context: "application backup file" }),
  start: msg({ message: "Earliest start", context: "application backup file" }),
  shape: msg({ message: "Your notes on the role card", context: "application backup file" }),
  notKept: msg({ message: "References, the background-check consent, files and voice recordings are never kept on your device, so they are missing here. Attach your files to the email, and we will ask for references again.", context: "application backup file" }),
  raw: msg({ message: "Everything above, as data", context: "application backup file" }),
  none: msg({ message: "Not answered", context: "application backup file" }),
};

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The file's name: plain letters, the role and the day, so it is easy to find and attach. */
export function backupFileName(roleName: string, now: Date): string {
  const slug = roleName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "role";
  return `application-${slug}-${now.toISOString().slice(0, 10)}.html`;
}

/** The whole file, as one self-contained .html page. Every value the applicant wrote is escaped. */
export function backupHtml(input: BackupInput, i18n: I18n = appI18n): string {
  const w = (d: (typeof W)[keyof typeof W]) => i18n._(d);
  const { draft: d, roles } = input;
  const or = (s: string | null | undefined) => (s && s.trim() ? esc(s) : `<em>${esc(w(W.none))}</em>`);
  const row = (label: string, value: string) => `<dt>${esc(label)}</dt><dd>${value}</dd>`;
  const goal = new Map(input.goals.map((g) => [g.id, g.text]));
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  const termsOf = (t: ApplyDraft["terms"], withAnswers: boolean) => {
    const rows: string[] = [row(w(W.commitment), t.commitmentPct == null ? or("") : esc(`${t.commitmentPct}%`))];
    if (t.payAsk) rows.push(row(w(W.ask), t.payAsk.kind === "negotiate" ? esc(w(W.negotiate)) + (t.payAsk.why ? `<br>${esc(t.payAsk.why)}` : "") : esc(`${t.payAsk.monthly}${t.payAsk.per ? ` / ${t.payAsk.per}` : ""}`) + (t.payAsk.why ? `<br>${esc(t.payAsk.why)}` : "")));
    if (t.paySplit?.length) rows.push(row(w(W.split), t.paySplit.map((s) => esc(`${s.label}: ${s.pct}%`)).join("<br>")));
    if (withAnswers) {
      for (const k of TERM_KEYS) {
        const a = t.answers[k];
        if (!a) continue;
        rows.push(row(TERM_LABELS[k], esc(a.choice === "accept" ? w(W.accept) : w(W.talk)) + (a.note ? `<br>${esc(a.note)}` : "")));
      }
    }
    return rows.join("");
  };

  const sections: string[] = [];
  sections.push(
    `<dl>${row(w(W.village), or(input.village))}${row(w(W.roles), roles.map((r) => esc(r.name)).join(", ") || or(""))}${row(w(W.made), esc(input.now.toISOString()))}${row(w(W.page), or(input.pageUrl))}</dl>`,
  );
  sections.push(`<h2>${esc(w(W.knowUs))}</h2><p>${d.knowUs.length ? d.knowUs.map(esc).join("<br>") : or("")}</p>`);
  sections.push(
    `<dl>${row(w(W.name), or(d.name))}${row(w(W.email), or(d.email))}${row(w(W.why), or(d.why))}${row(w(W.based), or(d.about.based))}${row(w(W.languages), or(d.about.languages))}${row(w(W.story), or(d.about.story))}${row(w(W.self), or(d.selfKnowledge))}${row(w(W.links), d.links.filter((l) => l.url.trim()).map((l) => esc(l.label ? `${l.label}: ${l.url}` : l.url)).join("<br>") || or(""))}</dl>`,
  );
  const items = d.items.filter((g) => g.title.trim() || g.doneWhen.trim() || g.serves);
  sections.push(
    `<h2>${esc(w(W.aim))}</h2><p>${or(d.aim)}</p><h2>${esc(w(W.items))}</h2>${
      items.length
        ? `<ol>${items.map((g) => `<li><strong>${or(g.title)}</strong><br>${esc(w(W.doneWhen))}: ${or(g.doneWhen)}${g.serves ? `<br>${esc(w(W.serves))}: ${esc(goal.get(g.serves) ?? g.serves)}` : ""}</li>`).join("")}</ol>`
        : `<p>${or("")}</p>`
    }`,
  );
  if (d.pieceSuggestions.length) {
    sections.push(`<h2>${esc(w(W.shape))}</h2><ul>${d.pieceSuggestions.map((p) => `<li>${esc(`${roleName(p.roleId)}, ${PIECE_NAMES[p.piece] ?? p.piece} (${p.kind}): `)}${esc(p.text)}</li>`).join("")}</ul>`);
  }
  sections.push(`<h2>${esc(w(W.terms))}: ${esc(roles[0]?.name ?? "")}</h2><dl>${termsOf(d.terms, true)}${row(w(W.rampUp), esc(d.rampUp ? w(W.yes) : w(W.no)))}</dl>`);
  for (const x of d.extras ?? []) sections.push(`<h2>${esc(w(W.terms))}: ${esc(roleName(x.roleId))}</h2><dl>${termsOf(x.terms, false)}</dl>`);
  sections.push(
    `<h2>${esc(w(W.firstDay))}</h2><dl>${row(w(W.timeZone), or(d.practical.timeZone))}${row(w(W.windows), d.practical.windows.length ? d.practical.windows.map(esc).join("<br>") : or(""))}${row(w(W.start), or(d.practical.earliestStart))}</dl>`,
  );
  sections.push(`<p class="note">${esc(w(W.notKept))}</p>`);
  // The raw draft at the end, so a reader can rebuild every answer even where the page above reads it loosely.
  const raw = JSON.stringify({ village: input.village, roles, madeAt: input.now.toISOString(), page: input.pageUrl, draft: d }, null, 2);
  sections.push(`<h2>${esc(w(W.raw))}</h2><pre>${esc(raw)}</pre>`);

  const title = `${w(W.title)}: ${roles[0]?.name ?? ""}`;
  return `<!doctype html><html lang="${esc(i18n.locale || "en")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1f2937;line-height:1.5}dt{font-weight:600;margin-top:.75rem}dd{margin:0;white-space:pre-wrap}pre{white-space:pre-wrap;word-break:break-word;background:#f3f4f6;padding:1rem;font-size:.8rem}.note{border-left:3px solid #b45309;padding-left:.75rem}</style></head><body><h1>${esc(title)}</h1><p>${esc(w(W.lede))}</p>${sections.join("\n")}</body></html>`;
}

const MAIL = {
  subject: msg({ message: "Role application backup - {roles}", context: "application backup email subject" }),
  body: msg({
    message: "Hello,\n\nI tried to send my role application on your site and it did not go through. Before sending this email, I will attach the application file I downloaded from the page, and any files I meant to upload (a CV, for example).\n\nThank you.",
    context: "application backup email body",
  }),
};

/** The mailto link, or "" when the village has set no contact address: then the page shows no email line at all. */
export function backupMailto(contactEmail: string, roleNames: readonly string[], i18n: I18n = appI18n): string {
  const to = contactEmail.trim();
  if (!to) return "";
  const subject = i18n._({ ...MAIL.subject, values: { roles: roleNames.filter(Boolean).join(", ") } });
  return `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(i18n._(MAIL.body))}`;
}

/** Hand the file to the browser to save. */
export function saveBackup(html: string, fileName: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
