/**
 * SAVE AND FINISH LATER, THE PAGE'S SIDE (the lead, 24 Nov 2026; the contract is shared/applicationDrafts.ts).
 *
 * A save sends each file the server does not hold yet as a part (POST /api/open-proposals/parts, the door a send
 * uses), then the answers and the file ids in one request. The server answers the private token, which the page
 * keeps in this tab only and in the address bar's fragment, never in storage. Opening a resume link reads the
 * answers back and fetches each kept file as a real File, so a send after resuming uploads them like any other.
 *
 * Which File the server already holds is remembered per File object (`KEPT`), so saving again sends only what
 * is new, and a file removed on the page is dropped from the draft.
 */
import { aboutYouOf, type AboutYouValue } from "@/components/openProposal/AboutYou";
import { DRAFT_ERRORS, resumePath, type DraftError, type DraftFileRef, type DraftOpened, type DraftSaved } from "@shared/applicationDrafts";

/** The parts door a send uses (components/openProposal/sendParts.ts PARTS_PATH), written here so this lazy file imports nothing from the page's chunk. */
const PARTS_PATH = "/api/open-proposals/parts";
const SAVE_PATH = "/api/application-drafts";

/** What a server draft keeps beyond the device draft: references, consent, the agreement and an early application. */
export interface ServerExtras {
  references: AboutYouValue["references"];
  consent: boolean;
  agreed: { nda: boolean };
  early: boolean;
}

export function serverExtrasOf(draft: Record<string, unknown> | undefined): ServerExtras {
  const s = draft && typeof draft.server === "object" && draft.server ? (draft.server as Record<string, unknown>) : {};
  const about = aboutYouOf({ references: s.references, consent: s.consent });
  return { references: about.references, consent: about.consent, agreed: { nda: (s.agreed as { nda?: unknown } | undefined)?.nda === true }, early: s.early === true };
}


/** The server's id for each File it keeps in the draft. */
const KEPT = new WeakMap<File, string>();

export type SaveResult = { ok: true; saved: DraftSaved } | { ok: false; error: DraftError | "network"; message?: string };

type Fetch = (url: string, init: RequestInit) => Promise<Response>;
const defaultFetch: Fetch = (url, init) => fetch(url, init);
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const errorOf = (status: number, data: any): DraftError => {
  if (status === 429) return DRAFT_ERRORS.tooMany;
  if (status === 404) return DRAFT_ERRORS.gone;
  if (status === 413) return DRAFT_ERRORS.tooBig;
  const e = typeof data?.error === "string" ? data.error : "";
  return (Object.values(DRAFT_ERRORS) as string[]).includes(e) ? (e as DraftError) : DRAFT_ERRORS.invalid;
};

export interface DraftToSave {
  token: string | null;
  roleId: string;
  link: string;
  step: number;
  draft: Record<string, unknown>;
  email: string;
  name: string;
  locale: string;
  files: readonly File[];
}

/** Save the whole application as a draft. Never throws: a dropped line is `network`. */
export async function saveDraft(d: DraftToSave, fetchImpl: Fetch = defaultFetch): Promise<SaveResult> {
  try {
    const keep: string[] = [];
    const parts: string[] = [];
    const sentNow: Array<[File, number]> = [];
    for (const f of d.files) {
      const id = KEPT.get(f);
      if (id) {
        keep.push(id);
        continue;
      }
      const fd = new FormData();
      fd.append("kind", "files");
      if (d.link) fd.append("link", d.link);
      fd.append("part", f, f.name);
      const r = await fetchImpl(PARTS_PATH, { method: "POST", body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || typeof data?.id !== "string") return { ok: false, error: r.status === 429 ? DRAFT_ERRORS.tooMany : DRAFT_ERRORS.files, message: typeof data?.error === "string" ? data.error : undefined };
      sentNow.push([f, parts.length]);
      parts.push(data.id);
    }
    const r = await fetchImpl(SAVE_PATH, json({ token: d.token ?? undefined, roleId: d.roleId, link: d.link || undefined, step: d.step, draft: d.draft, email: d.email, name: d.name, locale: d.locale, files: { keep, parts } }));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: errorOf(r.status, data), message: typeof data?.message === "string" ? data.message : undefined };
    const saved = data as DraftSaved;
    // The new files are the last ones in the answer, in the order they were sent.
    const fresh = saved.files.slice(keep.length);
    for (const [f, i] of sentNow) if (fresh[i]) KEPT.set(f, fresh[i].id);
    return { ok: true, saved };
  } catch {
    return { ok: false, error: "network" };
  }
}

export type OpenResult = { ok: true; opened: DraftOpened; files: File[]; extras: ServerExtras } | { ok: false; error: DraftError | "network" };

/** Read a saved draft back, with every kept file as a File the form can send. */
export async function openDraft(token: string, fetchImpl: Fetch = defaultFetch): Promise<OpenResult> {
  try {
    const r = await fetchImpl(`${SAVE_PATH}/open`, json({ token }));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: errorOf(r.status, data) };
    const opened = data as DraftOpened;
    const files: File[] = [];
    for (const ref of opened.files ?? []) {
      const f = await fileOf(token, ref, fetchImpl);
      if (f) files.push(f);
    }
    return { ok: true, opened, files, extras: serverExtrasOf(opened.draft) };
  } catch {
    return { ok: false, error: "network" };
  }
}

async function fileOf(token: string, ref: DraftFileRef, fetchImpl: Fetch): Promise<File | null> {
  const r = await fetchImpl(`${SAVE_PATH}/file`, json({ token, fileId: ref.id }));
  if (!r.ok) return null;
  const bytes = await r.arrayBuffer();
  const file = new File([bytes], ref.name, { type: r.headers.get("content-type") ?? "" });
  KEPT.set(file, ref.id);
  return file;
}

/** Remove the draft once the application is sent. A failure is left to the 30-day cleanup. */
export async function discardDraft(token: string, fetchImpl: Fetch = defaultFetch): Promise<void> {
  await fetchImpl(`${SAVE_PATH}/discard`, json({ token })).catch(() => undefined);
}

/** The full resume link for this page's address. */
export function resumeUrl(token: string, link: string, origin: string): string {
  return `${origin}${resumePath(token, link || null)}`;
}
