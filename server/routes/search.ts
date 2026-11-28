/**
 * FIND ANYTHING, the server half (shared/findAnything.ts holds the rules and the ranking, shared/findPages.ts the pages).
 *
 *   GET  /api/search/index   every place THIS reader may open: pages, roles, circles, quests, and people for members
 *   POST /api/search/guide   the village's guide names one to three of those places for words the search missed
 *
 * ── WHO SEES WHAT, decided here and nowhere else ──────────────────────────
 *
 * The client ranks what this route returns and nothing more, so a visitor's browser never holds a member's page or
 * name to hide. Each page in FIND_PAGES passes, in order: its audience (signed in, admitted as the server reads
 * admission, admin by `isAdmin`), its module's lifecycle the way `requireModule` reads it, its story-page switch
 * (`storyServed`, the switches every page and the not-found answer read), and any power it names, through the one
 * gate (`mayStillSee`, shared/capabilities.ts). An admin also gets the admin search's own entries, filtered by the
 * same `visibleEntries` admin search uses. Roles and circles follow the listing rule `/api/org` reads (an unlisted
 * role is a steward's or its holder's); quests are the board's, closed ones out; people are the village's admitted
 * members, read only by an admitted member.
 *
 * ── THE GUIDE ─────────────────────────────────────────────────────────────
 *
 * What goes to the provider: the typed words (at most FIND_QUERY_MAX characters) and this reader's own list of
 * places with their titles, paths and one short line each (`guideDestinations`). Never a person, a member's name,
 * an email or anything a member wrote about themselves. What comes back is kept only where its path is on that
 * same list (`pickDestinations`), so the guide can never send anybody to a page it invented.
 *
 * It is the village guide by the name the village gave it (`workWithUs.assistantName`, shared/guideName.ts), on the
 * village's own key through the one engine (`callAssistant`, mode `find`), counted in the usage table like every
 * other call. With no key, or a provider that cannot answer, it answers 200 `unavailable` and the dialog keeps its
 * own results with a gentle line. The companion's consent line is for a member's own documents; this sends none,
 * and the dialog says under the button that only the typed words go.
 *
 * THE ENTRANCE. The portal gate reads GETs only, and the guide is a POST that answers with the village's places, so
 * it asks the gate's own check first (`entrancePasses`, server/lib/entrance.ts) and answers a stranger who has not
 * entered 401 `entrance_required`, before any limit is counted or any place is read. The index is a GET: the gate
 * itself holds it.
 *
 * LIMITS: the index 240 reads an hour per person (an address for a visitor); the guide 20 questions an hour per
 * person, then the engine's burst guard, the mode's day, a signed-in account's share of it and, for a visitor,
 * the strangers' slices of it. A refusal says which it was (`limit: "hour"` or `"day"`), so the dialog can too.
 */
import type { Express, Request } from "express";
import type { AppDeps } from "../lib/appDeps";
import type { AssistantPath } from "../lib/assistantUsage";
import { DEFAULT_ASSISTANT_MODEL, SHARE_SPENT, anonymousDaySlices, callAssistant, parseJsonReply, resolveKey, type AssistantResult } from "../lib/assistant";
import { isAdmitted } from "../lib/admission";
import { countsAsVillager } from "../lib/canvasNames";
import { isDepartedHandle } from "../lib/profile";
import { listOrgAssignments, listOrgRoles } from "../lib/orgChart";
import { listingViewerFor } from "../lib/listingViewer";
import { questClosed } from "../repos/quests";
import { visibleEntries } from "./adminSearch";
import { effectiveLifecycle } from "../lib/modules";
import { brochurePageServed } from "../lib/brochurePages";
import { isMemberDoor } from "../../shared/brochure";
import { CONTROL_ENTRIES, OUTSIDE_ENTRIES, adminSearchHref } from "../../shared/adminSearch";
import { circleViews } from "../../shared/circleView";
import { circlesToShow, visibleTo } from "../../shared/roleListing";
import { rolePath } from "../../shared/roleSlug";
import { GAME_CONFIG } from "../../shared/gameConfig";
import { ipBucket } from "../../shared/openProposals";
import { guideAudience, guideName } from "../../shared/guideName";
import {
  FIND_HELP_MAX,
  FIND_QUERY_MAX,
  findGuidePrompt,
  guideDestinations,
  pickDestinations,
  type FindEntry,
  type FindGuideAnswer,
  type FindGuideLimit,
  type FindIndex,
} from "../../shared/findAnything";
import { FIND_PAGES, audienceAdmits, lifecycleAdmits, pageEntry, type FindReader } from "../../shared/findPages";

/** Where the roles, circles, quests and people come from. `searchSources` reads them; a test hands in its own. */
export interface SearchSources {
  /** The roles this reader may find, already through the listing rule. */
  roles(viewer: any | null, admin: boolean): Promise<Array<{ id: string; name: string; slug?: string | null; aim?: string | null; whyItMatters?: string | null; path?: string }>>;
  /** The circles this reader may find, already through the listing rule. */
  circles(viewer: any | null, admin: boolean): Promise<Array<{ id: string; name: string; purpose?: string | null; aliases?: readonly string[] }>>;
  /** The quest board's quests. */
  quests(): Promise<Array<{ id: string; title: string; subtitle?: string | null; description?: string | null; status?: string | null }>>;
  /** The village's admitted members by handle. Asked only for an admitted reader. */
  people(): Promise<Array<{ handle: string; name: string }>>;
}

export interface SearchDeps extends Pick<AppDeps, "authedUser" | "isAdmin" | "mayStillSee" | "clientIp" | "overLimit"> {
  /**
   * The portal entrance's own answer for this caller (`entrancePasses`, server/lib/entrance.ts): true when the
   * entrance is off, or the caller is signed in, an agent, our own automation, or has entered. The gate reads
   * only GETs, and the guide is a POST that answers with the village's places, so it asks here itself.
   */
  entrancePasses(req: Request): Promise<boolean>;
  sources: SearchSources;
  /** A module's effective lifecycle. Absent: `effectiveLifecycle` (server/lib/modules.ts). */
  lifecycle?(id: string): string;
  /** Whether this village serves a story page to this reader. Absent: `storyServed` below. */
  storyServed?(path: string, signedIn: boolean): boolean;
  villageName(): string;
  /** The village's word for what a member signs (`project.commitmentName`), for that page's name. */
  commitmentName(): string;
  /** The village's own names for its menu entries, by address (the menu document's `labels`), so search says them. */
  menuNames?(): Readonly<Record<string, string>>;
  /** The village guide's stored name (`workWithUs.assistantName`). */
  villageGuideName(): unknown;
  noteAssistantUsage(mode: string, model: string, call: AssistantResult, userId: string | null, path?: AssistantPath): Promise<void>;
}

const HOUR_MS = 60 * 60 * 1000;
export const INDEX_READS_PER_HOUR = 240;
export const GUIDE_ASKS_PER_HOUR = 20;

/** The two refusals a reader can meet, told apart so the dialog says which: this hour, or today. */
export const HOUR_SPENT: FindGuideLimit = { error: "That's a lot of asking for one hour. The search still works; ask again in a little while.", limit: "hour" };
export const DAY_SPENT: FindGuideLimit = { error: "The guide has rested for today. The search still works on its own.", limit: "day" };

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** The roles, circles, quests and people, read the way `/api/org`, `/api/quests` and the profiles read them. */
export function searchSources(deps: Pick<AppDeps, "getPool" | "lapseContext" | "circlesRepo" | "questsRepo" | "members" | "capabilityCtx">): SearchSources {
  const listing = async (viewer: any | null, admin: boolean) => {
    const [roles, assignments] = await Promise.all([listOrgRoles(deps.getPool()), listOrgAssignments(deps.getPool(), deps.lapseContext())]);
    const capCtx = viewer ? await deps.capabilityCtx(viewer) : null;
    return { roles, view: listingViewerFor({ admin, capCtx, userId: viewer?.id ?? null, assignments }) };
  };
  return {
    async roles(viewer, admin) {
      const { roles, view } = await listing(viewer, admin);
      const shown = roles.filter((r) => r.active !== false && visibleTo(r, view));
      return shown.map((r) => ({ id: r.id, name: r.name, slug: (r as { slug?: string | null }).slug ?? null, aim: r.aim, whyItMatters: r.whyItMatters, path: rolePath(r, roles) }));
    },
    async circles(viewer, admin) {
      const { roles, view } = await listing(viewer, admin);
      return circlesToShow(circleViews(deps.circlesRepo.all()), roles, view).map((c) => ({ id: c.id, name: c.name, purpose: c.purpose, aliases: c.aliases }));
    },
    async quests() {
      return (await deps.questsRepo.all()).map((q: any) => ({ id: String(q.id), title: String(q.title ?? ""), subtitle: q.subtitle ?? null, description: q.description ?? null, status: q.status ?? null }));
    },
    async people() {
      return (await deps.members.all())
        .filter((u: any) => countsAsVillager(u) && typeof u.handle === "string" && u.handle.trim() && !isDepartedHandle(u.handle))
        .map((u: any) => ({ handle: String(u.handle), name: String(u.name ?? "").trim() }))
        .filter((p) => p.name);
    },
  };
}

/** A story page served to this reader: a member's door always to somebody signed in, the rest by the switches (`servedTo`). */
export function storyServed(path: string, signedIn: boolean): boolean {
  return (signedIn && isMemberDoor(path)) || brochurePageServed(path);
}

/** Who is reading, from the server's own answers. An admin or a founder is always a member. */
export async function readerOf(deps: Pick<SearchDeps, "authedUser" | "isAdmin">, req: Request): Promise<{ viewer: any | null; reader: FindReader }> {
  const viewer = await deps.authedUser(req);
  const admin = viewer ? await deps.isAdmin(req) : false;
  const member = !!viewer && (admin || viewer.role === "admin" || viewer.role === "founder" || isAdmitted(viewer, GAME_CONFIG.stages));
  return { viewer, reader: { signedIn: !!viewer, member, admin } };
}

/** Every place this reader may open, pages first. People only when `withPeople` and the reader is a member. */
export async function buildFindIndex(deps: SearchDeps, req: Request, viewer: any | null, r: FindReader, withPeople: boolean): Promise<FindEntry[]> {
  const out: FindEntry[] = [];
  const seen = new Set<string>();
  const put = (e: FindEntry) => {
    if (seen.has(e.path)) return;
    seen.add(e.path);
    out.push(e);
  };
  const asked = new Map<string, boolean>();
  const may = async (cap: Parameters<SearchDeps["mayStillSee"]>[1]) => {
    if (!asked.has(cap)) asked.set(cap, await deps.mayStillSee(req, cap));
    return asked.get(cap)!;
  };

  const lifecycle = deps.lifecycle ?? effectiveLifecycle;
  const served = deps.storyServed ?? storyServed;
  const words = { commitment: deps.commitmentName(), names: deps.menuNames?.() ?? {} };
  for (const p of FIND_PAGES) {
    if (!audienceAdmits(p.audience, r)) continue;
    if (p.module && !lifecycleAdmits(lifecycle(p.module), r)) continue;
    if (p.unlessModule && lifecycleAdmits(lifecycle(p.unlessModule), r)) continue;
    if (p.brochure && !served(p.brochure, r.signedIn)) continue;
    if (p.anyOf) {
      let open = false;
      for (const cap of p.anyOf) if ((open = await may(cap))) break;
      if (!open) continue;
    }
    put(pageEntry(p, words));
  }

  if (r.admin) {
    const admin = await visibleEntries([...OUTSIDE_ENTRIES, ...CONTROL_ENTRIES], may, lifecycle);
    for (const e of admin) {
      put({ id: `${e.kind === "control" ? "setting" : "page"}:${e.id}`, kind: e.kind === "control" ? "setting" : "page", title: e.title, help: e.help, path: adminSearchHref(e), synonyms: e.synonyms });
    }
  }

  const [roles, circles, quests] = await Promise.all([
    deps.sources.roles(viewer, r.admin).catch(() => []),
    deps.sources.circles(viewer, r.admin).catch(() => []),
    deps.sources.quests().catch(() => []),
  ]);
  for (const role of roles) {
    const path = role.path ?? rolePath(role);
    put({ id: `role:${role.id}`, kind: "role", title: clip(role.name, 120), help: clip(role.aim || role.whyItMatters, FIND_HELP_MAX), path });
  }
  for (const c of circles) {
    put({ id: `circle:${c.id}`, kind: "circle", title: clip(c.name, 120), help: clip(c.purpose, FIND_HELP_MAX), path: `/circles/${encodeURIComponent(c.id)}`, synonyms: c.aliases ?? [] });
  }
  for (const q of quests) {
    if (questClosed(q.status) || !q.title) continue;
    put({ id: `quest:${q.id}`, kind: "quest", title: clip(q.title, 120), help: clip(q.subtitle || q.description, FIND_HELP_MAX), path: `/quests/${encodeURIComponent(q.id)}` });
  }

  if (withPeople && (r.member || r.admin)) {
    for (const p of await deps.sources.people().catch(() => [])) {
      put({ id: `person:${p.handle}`, kind: "person", title: clip(p.name, 120), help: "", path: `/profile/${encodeURIComponent(p.handle)}` });
    }
  }
  return out;
}

/** The bucket one person is counted on: their account, or their address (an IPv6 /64 counts as one). */
const whoOf = (viewer: any | null, deps: Pick<SearchDeps, "clientIp">, req: Request) =>
  viewer?.id ? `user:${String(viewer.id)}` : `addr:${ipBucket(deps.clientIp(req))}`;

export function register(app: Express, deps: SearchDeps): void {
  app.get("/api/search/index", async (req, res) => {
    const { viewer, reader } = await readerOf(deps, req);
    if (await deps.overLimit(`find-index:${whoOf(viewer, deps, req)}`, INDEX_READS_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "Search is resting for a moment. Try again shortly." });
    }
    const entries = await buildFindIndex(deps, req, viewer, reader, true);
    const body: FindIndex = {
      entries,
      people: entries.some((e) => e.kind === "person"),
      guide: { name: guideName(deps.villageGuideName(), guideAudience(viewer)).name, available: resolveKey() !== null },
    };
    res.set("Cache-Control", "private, no-store");
    res.json(body);
  });

  app.post("/api/search/guide", async (req, res) => {
    // Before the limits and before any place is read: behind the entrance, a stranger gets nothing of the village.
    // A check that cannot read its own record fails closed with 503, as the gate does.
    let passes = false;
    try {
      passes = await deps.entrancePasses(req);
    } catch {
      return res.status(503).json({ error: "unavailable", message: "This page is not available right now. Try again in a moment." });
    }
    if (!passes) {
      return res.status(401).json({ error: "entrance_required", message: "Enter the portal first: a name and an email address are all it asks." });
    }
    const { viewer, reader } = await readerOf(deps, req);
    const query = clip(req.body?.query, FIND_QUERY_MAX);
    if (!query) return res.status(400).json({ error: "Type what you are looking for first." });
    const who = whoOf(viewer, deps, req);
    if (await deps.overLimit(`find-guide:${who}`, GUIDE_ASKS_PER_HOUR, HOUR_MS)) return res.status(429).json(HOUR_SPENT);
    const guide = guideName(deps.villageGuideName(), guideAudience(viewer)).name;
    const unavailable: FindGuideAnswer = { state: "unavailable", guide };
    if (resolveKey() === null) return res.json(unavailable);

    // Never people: the guide's list is places, and the reader's own.
    const allowed = await buildFindIndex(deps, req, viewer, reader, false);
    const destinations = guideDestinations(allowed);
    const uid = viewer?.id ? String(viewer.id) : null;
    const bucket = ipBucket(deps.clientIp(req));
    const call = await callAssistant({
      mode: "find",
      system: findGuidePrompt({ guide, village: deps.villageName(), destinations }),
      messages: [{ role: "user", content: query }],
      model: DEFAULT_ASSISTANT_MODEL,
      clientIp: deps.clientIp(req),
      burstKey: `assist-find:${who}`,
      burstPerHour: GUIDE_ASKS_PER_HOUR,
      userId: uid,
      ...(uid ? {} : { daySlices: anonymousDaySlices("find", bucket) }),
    });
    await deps.noteAssistantUsage("find", DEFAULT_ASSISTANT_MODEL, call, uid);
    if (!call.ok) {
      // A day slice spent (the account's share, an address's, or the strangers' pool) is the day, never the hour.
      if (call.status === 429) return res.status(429).json(call.error === SHARE_SPENT ? DAY_SPENT : HOUR_SPENT);
      // The mode's whole day spent, for the village: the same "rested for today", never "can't answer right now".
      if (call.reason === "day") return res.status(429).json(DAY_SPENT);
      return res.json(unavailable);
    }
    const kept = destinations.map((d) => allowed.find((e) => e.path === d.path)!).filter(Boolean);
    const answer: FindGuideAnswer = { state: "answered", guide, picks: pickDestinations(parseJsonReply(call.text, { picks: [] }), kept) };
    res.set("Cache-Control", "private, no-store");
    res.json(answer);
  });
}
