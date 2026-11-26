/**
 * APPROVE OR IMPROVE A TRANSLATION of the village's own words (Rye, 15 Nov
 * 2026; with the 6 Nov ruling that translations are crowdsourced and legal
 * text is protected).
 *
 * WHO MAY WRITE follows who may write the English (act follows power):
 *   role cards and their founding sections   org.decide
 *   a page's words                            story.tell
 * Anyone else suggests (propose freely): two suggestion controls,
 * `role_card_translation` and `page_translation`, registered below, whose
 * Accept calls the same write a holder's improvement does.
 *
 *   GET    /api/admin/content-translations?kind&ref&locale   every field, its English, its translation and whether it is stale
 *   PUT    /api/admin/content-translations                   a person's translation, approved in their name
 *   POST   /api/admin/content-translations/approve           approve the machine draft the holder read
 *   DELETE /api/admin/content-translations                   take one away; readers see the English
 *   POST   /api/admin/content-translations/draft             machine drafts for what has none (see below)
 *
 * THE ENGLISH IS NEVER TAKEN FROM THE REQUEST. Every write reads the field's
 * English live (contentTranslationSource.ts) and stores its hash, so a
 * translation is always of words the village says.
 *
 * MACHINE DRAFTS ARE OFF unless the server runs with
 * CONTENT_MACHINE_DRAFTS=on. Drafting writes rows, and on a live village that
 * is a production write a person decides to make (coordinator, 15 Nov). Pay
 * words and binding pages are never drafted, whatever the switch says.
 */
import { isVillageDocRef } from "../../shared/villageDocTranslation";
import { noSharedCache, readerLocale, villageDocTranslation } from "../lib/contentTranslationRead";
import { villagePaths } from "../lib/villagePaths";
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import { CONTENT_KINDS, contentTranslationProblem, translatableLocales, type ContentKind } from "../../shared/contentTranslation";
import type { Capability } from "../../shared/capabilities";
import { AI_DRAFT_SERVICE } from "../../shared/aiDraftService";
import { registerAdminEditControl, type AdminEditControl } from "../lib/adminSuggestions";
import { englishOf, translatableFields, type SourceField, type SourceReaders } from "../lib/contentTranslationSource";
import { approveDraft, removeTranslation, sourceHash, translationsFor, writeTranslation } from "../repos/contentTranslations";

/** The power that writes the English, and so its translations. */
export function powerFor(kind: ContentKind): Capability {
  // The village's own documents outside its pages (the homepage words in Identity, the visit page) are said in
  // public like a page's words, so the same power writes them and their translations.
  return kind === "page_section" || kind === "village_doc" ? "story.tell" : "org.decide";
}

export const MACHINE_DRAFT_SWITCH = "CONTENT_MACHINE_DRAFTS";
export const machineDraftsOn = (env: NodeJS.ProcessEnv = process.env) => env[MACHINE_DRAFT_SWITCH] === "on";

/** Most fields drafted in one ask: a page's words fit, and the model's answer stays inside its room. */
export const DRAFT_BATCH = 40;

/** Draft asks per holder per hour. Each one sends a page of the village's words to the model's provider. */
export const DRAFTS_PER_HOUR = 12;
const HOUR_MS = 60 * 60 * 1000;

/**
 * WHO READS THE WORDS A DRAFT SENDS (coordinator, 15 Nov): the one name in
 * shared/aiDraftService.ts, which the voice drafts' notice reads too. The
 * editor shows this line beside the Draft button, before anything is sent.
 */
export const MACHINE_DRAFT_SERVICE = AI_DRAFT_SERVICE;
export const MACHINE_DRAFT_NOTICE = `Drafting sends the English of these fields to ${MACHINE_DRAFT_SERVICE}, which writes the drafts. Pay words and binding pages are never sent.`;

export interface MachineDraftAsk {
  locale: string;
  items: Array<{ field: string; english: string }>;
  userId: string;
  req: Request;
}

export interface ContentTranslationDeps {
  guardCapability: (req: Request, res: Response, cap: Capability) => Promise<boolean>;
  authedUser: (req: Request) => Promise<{ id: string } | null>;
  getPool: () => Pool;
  contentSection: (section: string) => unknown;
  /** The village's documents outside its pages, by name ("brand", "visit-config"); absent, none takes a translation. */
  villageDoc?: (ref: string) => unknown;
  /** The shared rate limiter (server/index.ts `overLimit`): true when the bucket is spent. */
  overLimit: (bucket: string, max: number, windowMs: number) => Promise<boolean>;
  /** The model's drafts by field, or null when it could not answer. Wired to callAssistant in index.ts. */
  machineDraft: (ask: MachineDraftAsk) => Promise<Record<string, string> | null>;
  env?: NodeJS.ProcessEnv;
}

type Key = { kind: ContentKind; refKey: string; field: string; locale: string };

/** The request's (kind, ref, field?, locale), read and checked; a refusal in words otherwise. */
function keyOf(src: Record<string, unknown>, needField: boolean): { ok: true; key: Key } | { ok: false; error: string } {
  const kind = String(src.kind ?? "");
  const refKey = String(src.ref ?? "");
  const field = String(src.field ?? "");
  const locale = String(src.locale ?? "");
  if (!(CONTENT_KINDS as readonly string[]).includes(kind)) return { ok: false, error: `kind must be one of: ${CONTENT_KINDS.join(", ")}` };
  if (!refKey || refKey.length > 80) return { ok: false, error: "Name the role or page (ref)." };
  if (needField && (!field || field.length > 120)) return { ok: false, error: "Name the field." };
  if (!translatableLocales().includes(locale)) return { ok: false, error: `locale must be one of: ${translatableLocales().join(", ")}` };
  return { ok: true, key: { kind: kind as ContentKind, refKey, field, locale } };
}

/** The version a suggestion binds to: the English it translates and the translation there now. */
async function versionOf(pool: Pool, readers: SourceReaders, key: Key): Promise<string> {
  const english = await englishOf(readers, key.kind, key.refKey, key.field);
  const row = (await translationsFor(pool, key.kind, [key.refKey], key.locale)).find((r) => r.field === key.field);
  return sourceHash(`${english?.english ?? ""}\u0000${row?.status ?? ""}\u0000${row?.text ?? ""}`).slice(0, 32);
}

/**
 * A person's translation, approved in their name: the write behind PUT and
 * behind an accepted suggestion. The caller has asked the gate.
 */
export async function savePersonTranslation(
  pool: Pool,
  readers: SourceReaders,
  key: Key,
  text: unknown,
  by: string,
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const source = await englishOf(readers, key.kind, key.refKey, key.field);
  if (!source) return { ok: false, status: 404, body: { error: "no_such_field", message: "There are no words there to translate." } };
  const problem = contentTranslationProblem({ ...key, text: String(text ?? ""), status: "approved", source: source.english });
  if (problem) return { ok: false, status: 400, body: { error: "bad_translation", message: problem } };
  await writeTranslation(pool, { ...key, text: String(text).trim(), sourceHash: sourceHash(source.english), status: "approved", by });
  return { ok: true };
}

export function register(app: Pick<Express, "get" | "put" | "post" | "delete">, deps: ContentTranslationDeps): void {
  // The village's path names live in their own store (server/lib/villagePaths.ts), so "paths" is read here.
  const villageDoc = (ref: string): unknown => (ref === "paths" ? { paths: villagePaths() } : deps.villageDoc?.(ref) ?? null);
  const readers = (): SourceReaders => ({ pool: deps.getPool(), contentSection: deps.contentSection, villageDoc });
  const BASE = "/api/admin/content-translations";

  /**
   * The village's words outside its pages in the reader's language (shared/villageDocTranslation.ts): the
   * homepage headline, sentence and footer line, and the visit page. Public, like the page read: fresh
   * translations only, a machine draft named in `machine`, and an empty answer, never an error, when there
   * is none.
   */
  app.get("/api/village-doc/:ref/translation", async (req, res) => {
    const ref = String(req.params.ref ?? "");
    const locale = readerLocale(req);
    noSharedCache(res);
    if (!locale || !isVillageDocRef(ref)) return res.json({ translation: null });
    res.json({ translation: await villageDocTranslation(deps.getPool(), ref, villageDoc(ref), locale) });
  });

  app.get(BASE, async (req, res) => {
    const k = keyOf(req.query as Record<string, unknown>, false);
    if (!k.ok) return res.status(400).json({ error: "bad_request", message: k.error });
    if (!(await deps.guardCapability(req, res, powerFor(k.key.kind)))) return;
    const fields = await translatableFields(readers(), k.key.kind, k.key.refKey);
    if (!fields) return res.status(404).json({ error: "not_translatable", message: "There is nothing here that takes a translation." });
    const rows = new Map((await translationsFor(deps.getPool(), k.key.kind, [k.key.refKey], k.key.locale)).map((r) => [r.field, r]));
    res.set("Cache-Control", "no-store").json({
      kind: k.key.kind,
      ref: k.key.refKey,
      locale: k.key.locale,
      machineDrafts: machineDraftsOn(deps.env),
      // Named before anything is sent, so the holder knows where a draft's words go.
      machineDraftService: MACHINE_DRAFT_SERVICE,
      machineDraftNotice: MACHINE_DRAFT_NOTICE,
      fields: fields.map((f) => {
        const row = rows.get(f.field);
        const hash = sourceHash(f.english);
        return {
          field: f.field,
          english: f.english,
          protection: f.protection,
          sourceHash: hash,
          // A STALE TRANSLATION IS KEPT AND SHOWN (coordinator, 15 Nov): readers see the English, and the editor
          // shows the old translation as "needs update" beside the new English, so approved work is never lost.
          translation: row
            ? { text: row.text, status: row.status, stale: row.sourceHash !== hash, needsUpdate: row.sourceHash !== hash, approvedBy: row.approvedBy, updatedAt: row.updatedAt }
            : null,
        };
      }),
    });
  });

  app.put(BASE, async (req, res) => {
    const k = keyOf(req.body ?? {}, true);
    if (!k.ok) return res.status(400).json({ error: "bad_request", message: k.error });
    if (!(await deps.guardCapability(req, res, powerFor(k.key.kind)))) return;
    const me = await deps.authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const r = await savePersonTranslation(deps.getPool(), readers(), k.key, req.body?.text, me.id);
    if (!r.ok) return res.status(r.status).json(r.body);
    res.json({ ok: true });
  });

  app.post(`${BASE}/approve`, async (req, res) => {
    const k = keyOf(req.body ?? {}, true);
    if (!k.ok) return res.status(400).json({ error: "bad_request", message: k.error });
    if (!(await deps.guardCapability(req, res, powerFor(k.key.kind)))) return;
    const me = await deps.authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const source = await englishOf(readers(), k.key.kind, k.key.refKey, k.key.field);
    const seen = String(req.body?.sourceHash ?? "");
    // The English moved since the holder read the draft: approving it would approve a translation of other words.
    if (!source || sourceHash(source.english) !== seen) {
      return res.status(409).json({ error: "stale", message: "The English changed since you read this draft. Reload to see it." });
    }
    if (!(await approveDraft(deps.getPool(), k.key, seen, me.id))) {
      return res.status(409).json({ error: "not_a_draft", message: "That draft changed or was already approved. Reload to see it." });
    }
    res.json({ ok: true });
  });

  app.delete(BASE, async (req, res) => {
    const k = keyOf({ ...(req.query as Record<string, unknown>), ...(req.body ?? {}) }, true);
    if (!k.ok) return res.status(400).json({ error: "bad_request", message: k.error });
    if (!(await deps.guardCapability(req, res, powerFor(k.key.kind)))) return;
    res.json({ ok: true, removed: await removeTranslation(deps.getPool(), k.key) });
  });

  app.post(`${BASE}/draft`, async (req, res) => {
    const k = keyOf(req.body ?? {}, false);
    if (!k.ok) return res.status(400).json({ error: "bad_request", message: k.error });
    if (!(await deps.guardCapability(req, res, powerFor(k.key.kind)))) return;
    const me = await deps.authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    if (!machineDraftsOn(deps.env)) {
      return res.status(403).json({ error: "machine_drafts_off", message: "Machine drafts are switched off on this village. Write the translation, or ask the person who runs the server." });
    }
    if (await deps.overLimit(`content-translation-draft:${me.id}`, DRAFTS_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "too_many_asks", message: "That is a lot of drafts for one hour. Try again a little later." });
    }
    const fields = await translatableFields(readers(), k.key.kind, k.key.refKey);
    if (!fields) return res.status(404).json({ error: "not_translatable", message: "There is nothing here that takes a translation." });
    const have = new Map((await translationsFor(deps.getPool(), k.key.kind, [k.key.refKey], k.key.locale)).map((r) => [r.field, r]));
    // Only open fields with no fresh translation: pay words are a person's, and a fresh row (draft or approved) stays.
    const todo: SourceField[] = fields.filter((f) => f.protection === "open" && have.get(f.field)?.sourceHash !== sourceHash(f.english)).slice(0, DRAFT_BATCH);
    if (!todo.length) return res.json({ ok: true, drafted: 0, refused: 0, left: 0 });
    const got = await deps.machineDraft({ locale: k.key.locale, items: todo.map((f) => ({ field: f.field, english: f.english })), userId: me.id, req });
    if (!got) return res.status(503).json({ error: "draft_unavailable", message: "The machine could not draft this now. Try again in a moment." });
    let drafted = 0;
    let refused = 0;
    for (const f of todo) {
      const text = got[f.field];
      if (typeof text !== "string") continue;
      // The model's words meet the same check a person's do: braces, bold, length, no markup.
      if (contentTranslationProblem({ ...k.key, field: f.field, text, status: "ai_draft", source: f.english })) {
        refused++;
        continue;
      }
      const out = await writeTranslation(deps.getPool(), { ...k.key, field: f.field, text: text.trim(), sourceHash: sourceHash(f.english), status: "ai_draft", by: null });
      if (out === "written") drafted++;
    }
    const left = fields.filter((f) => f.protection === "open" && have.get(f.field)?.sourceHash !== sourceHash(f.english)).length - todo.length;
    res.json({ ok: true, drafted, refused, left });
  });

  // ── Suggestions: any member proposes a translation; a holder of the power accepts ──
  for (const [id, kinds] of [
    ["role_card_translation", ["role_card", "role_card_sections"]],
    ["page_translation", ["page_section"]],
  ] as const) {
    const fromPayload = (payload: unknown): Key | null => {
      const k = keyOf((payload ?? {}) as Record<string, unknown>, true);
      return k.ok && (kinds as readonly string[]).includes(k.key.kind) ? k.key : null;
    };
    const control: AdminEditControl = {
      read: () => ({ value: null, version: "content-translations" }),
      problem: (payload) => {
        if (!fromPayload(payload)) return "A translation names its kind, ref, field and locale.";
        const text = (payload as Record<string, unknown>).text;
        return typeof text === "string" && text.trim() ? null : "Write the translation.";
      },
      versionFor: async (payload) => {
        const key = fromPayload(payload);
        return key ? versionOf(deps.getPool(), readers(), key) : "content-translations";
      },
      prepare: async (payload) => {
        const key = fromPayload(payload);
        if (!key) return { problem: "A translation names its kind, ref, field and locale.", payload };
        const source = await englishOf(readers(), key.kind, key.refKey, key.field);
        if (!source) return { problem: "There are no words there to translate.", payload };
        const text = String((payload as Record<string, unknown>).text ?? "").trim();
        const problem = contentTranslationProblem({ ...key, text, status: "approved", source: source.english });
        return { problem, payload: { kind: key.kind, ref: key.refKey, field: key.field, locale: key.locale, text }, version: await versionOf(deps.getPool(), readers(), key) };
      },
      describe: async (payload) => {
        const key = fromPayload(payload);
        if (!key) return [];
        const source = await englishOf(readers(), key.kind, key.refKey, key.field);
        return [`${key.locale}: "${source?.english ?? key.field}" reads "${String((payload as Record<string, unknown>).text ?? "")}"`];
      },
      apply: async (payload, was, by) => {
        const key = fromPayload(payload);
        if (!key) return { ok: false, status: 400, body: { error: "bad_request" } };
        if (was && was !== (await versionOf(deps.getPool(), readers(), key))) {
          return { ok: false, status: 409, body: { error: "stale", message: "The English or its translation changed since this was suggested." } };
        }
        return savePersonTranslation(deps.getPool(), readers(), key, (payload as Record<string, unknown>).text, (by?.decidedBy ?? "suggestion").slice(0, 64));
      },
    };
    registerAdminEditControl(id, control);
  }
}
