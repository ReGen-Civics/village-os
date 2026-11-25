/**
 * DECIDING THE CONNECTOR'S CHANGES ON /admin/review (docs/REVIEW_INBOX_PLAN.md, lane 4b).
 *
 * The connector's own routes, called as the person reading the page, and nothing else: the read is
 * `GET /api/admin/proposals` (the same answer /admin/proposals draws), Held is `GET /api/admin/proposals/held`, and every
 * decision goes through `/check`, `/accept`, `/discard`, `/put-back` and the held doors exactly as the proposals page
 * sends them. The server decides who may do what; this hook only remembers what the person did on the page.
 *
 * Two rules the server holds and the page follows (the lead, 25 Nov 2026):
 *   - CONFLICTS BLOCK: accepting one of several waiting changes for the same thing names the others it is chosen over.
 *   - A STALE CHANGE IS SEEN FIRST: its accept carries the version of what is live now that the person was shown.
 */
import { useCallback, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { authToken } from "@/lib/gameApi";
import { setAt } from "@/components/proposals/ProposalEditor";
import type { Decided, Problem, Proposal, ReviewPayload, Where } from "@/components/proposals/reviewTypes";
import { staleVersionOf } from "@shared/proposalConflicts";
import type { HeldCode } from "@shared/suggestionPipeline/engine";

export interface HeldItem {
  id: string;
  kind: string;
  where: Where;
  code: HeldCode | null;
  fields: Record<string, string>;
  receivedAt: string;
  filerKind: "member" | "agent" | "integration";
  reconsider: { code: string } | null;
  released: boolean;
}

type Read = "loading" | "ok" | "refused" | "failed";

function headers(): Record<string, string> {
  const t = authToken();
  return { "content-type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export function useConnectorDesk(onDecided: () => void) {
  const { t } = useLingui();
  const [state, setState] = useState<Read>("loading");
  const [heldState, setHeldState] = useState<Read>("loading");
  const [zone, setZone] = useState("UTC");
  const [changes, setChanges] = useState<Proposal[]>([]);
  const [decided, setDecided] = useState<Decided[]>([]);
  const [held, setHeld] = useState<HeldItem[]>([]);
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [problems, setProblems] = useState<Record<string, Problem[]>>({});
  const [saved, setSaved] = useState<Record<string, "saving" | "saved" | "failed">>({});
  const [checkedPage, setCheckedPage] = useState<Record<string, boolean>>({});
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  /** One line about the last decision, read out once. */
  const [notice, setNotice] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async (): Promise<ReviewPayload | null> => {
    try {
      const r = await fetch("/api/admin/proposals", { headers: headers() });
      if (r.status === 401 || r.status === 403) {
        setState("refused");
        return null;
      }
      if (!r.ok) throw new Error("read failed");
      const d = (await r.json()) as ReviewPayload;
      setZone(d.timezone || "UTC");
      setChanges(d.changes);
      setDecided(d.decided ?? []);
      setEdits(Object.fromEntries(d.changes.map((c) => [c.id, c.draft ?? c.body])));
      setState("ok");
      return d;
    } catch {
      setState("failed");
      return null;
    }
  }, []);

  const loadHeld = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/proposals/held", { headers: headers() });
      if (r.status === 401 || r.status === 403) return setHeldState("refused");
      if (!r.ok) throw new Error("read failed");
      setHeld(((await r.json()) as { held?: HeldItem[] }).held ?? []);
      setHeldState("ok");
    } catch {
      setHeldState("failed");
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([load(), loadHeld()]);
  }, [load, loadHeld]);

  const seenNow = (c: Proposal) => seen[c.id] !== undefined && seen[c.id] === staleVersionOf(c.stale ?? []);

  /** Read the change again and draw it against what is live now: that press is what lets a stale change's Accept through. */
  const seeLive = async (id: string) => {
    const d = await load();
    const fresh = d?.changes.find((c) => c.id === id);
    if (fresh) setSeen((s) => ({ ...s, [id]: staleVersionOf(fresh.stale ?? []) }));
  };

  const saveDraft = (id: string, body: Record<string, unknown>) => {
    clearTimeout(timers.current[id]);
    setSaved((s) => ({ ...s, [id]: "saving" }));
    timers.current[id] = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/proposals/${encodeURIComponent(id)}/draft`, { method: "PUT", headers: headers(), body: JSON.stringify({ body }) });
        setSaved((s) => ({ ...s, [id]: r.ok ? "saved" : "failed" }));
      } catch {
        setSaved((s) => ({ ...s, [id]: "failed" }));
      }
    }, 700);
  };

  const edit = (id: string, path: string, next: unknown) => {
    setEdits((all) => {
      const body = setAt(all[id] ?? {}, path ? path.split(".") : [], next) as Record<string, unknown>;
      saveDraft(id, body);
      return { ...all, [id]: body };
    });
    setProblems((p) => ({ ...p, [id]: [] }));
  };

  const failedWords = () => t({ context: "review inbox: decide", message: "That did not go through. Reload and try again." });

  /** Accept one change as this person: the dry run, then its own route. `over` is the person's choice among options. */
  const accept = async (c: Proposal, choice?: { over?: string[] }) => {
    setBusy(true);
    setNotice(null);
    try {
      const item = {
        id: c.id,
        body: edits[c.id] ?? c.body,
        ...(c.status === "unknown" && checkedPage[c.id] ? { checked: true } : {}),
        ...(choice?.over?.length ? { over: choice.over } : {}),
        ...((c.stale ?? []).length && seenNow(c) ? { seen: seen[c.id] } : {}),
      };
      const check = await fetch("/api/admin/proposals/check", { method: "POST", headers: headers(), body: JSON.stringify({ items: [item] }) });
      const cd = (await check.json().catch(() => ({}))) as { results?: { id: string; ok: boolean; error?: string; field?: string | null }[] };
      const bad = check.ok ? (cd.results ?? []).find((x) => !x.ok) : { id: c.id, ok: false, error: failedWords(), field: null };
      if (bad) return setProblems((p) => ({ ...p, [c.id]: [{ error: bad.error ?? "", field: bad.field ?? null }] }));
      const r = await fetch("/api/admin/proposals/accept", { method: "POST", headers: headers(), body: JSON.stringify({ items: [item] }) });
      const d = (await r.json().catch(() => ({}))) as { results?: { id: string; ok: boolean; error?: string; field?: string | null; otherChosen?: string[] }[] };
      const res = r.ok ? d.results?.[0] : undefined;
      if (!res) setProblems((p) => ({ ...p, [c.id]: [{ error: failedWords(), field: null }] }));
      else if (!res.ok) setProblems((p) => ({ ...p, [c.id]: [{ error: res.error ?? "", field: res.field ?? null }] }));
      else {
        const summary = c.summary;
        setNotice(
          res.otherChosen?.length
            ? t({ context: "review inbox: decide", message: `Accepted: ${summary} The other options are recorded as another option chosen.` })
            : t({ context: "review inbox: decide", message: `Accepted: ${summary}` }),
        );
      }
      await load();
      onDecided();
    } catch {
      setProblems((p) => ({ ...p, [c.id]: [{ error: failedWords(), field: null }] }));
    } finally {
      setBusy(false);
    }
  };

  /** Discard these changes: nothing goes live. */
  const discard = async (ids: string[]) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch("/api/admin/proposals/discard", { method: "POST", headers: headers(), body: JSON.stringify({ ids }) });
      if (!r.ok) setProblems((p) => ({ ...p, [ids[0]!]: [{ error: failedWords(), field: null }] }));
      else setNotice(t({ context: "review inbox: decide", message: "Discarded. Nothing went live." }));
      await load();
      onDecided();
    } catch {
      setProblems((p) => ({ ...p, [ids[0]!]: [{ error: failedWords(), field: null }] }));
    } finally {
      setBusy(false);
    }
  };

  /** File a proposal that puts an accepted change back. Nothing is applied. Answers an error in words, or null. */
  const putBack = async (d: Decided): Promise<string | null> => {
    try {
      const r = await fetch(`/api/admin/proposals/${encodeURIComponent(d.id)}/put-back`, { method: "POST", headers: headers() });
      const body = (await r.json().catch(() => ({}))) as { message?: string };
      if (!r.ok) return body.message || failedWords();
      await load();
      onDecided();
      return null;
    } catch {
      return failedWords();
    }
  };

  /** A person's act on a held suggestion: let a reconsider through to be read, or clear it. */
  const actOnHeld = async (id: string, act: "release" | "clear"): Promise<string | null> => {
    try {
      const r = await fetch(`/api/admin/proposals/held/${encodeURIComponent(id)}/${act}`, { method: "POST", headers: headers() });
      const body = (await r.json().catch(() => ({}))) as { message?: string };
      await loadHeld();
      return r.ok ? null : body.message || failedWords();
    } catch {
      return failedWords();
    }
  };

  return {
    state,
    heldState,
    zone,
    changes,
    decided,
    held,
    edits,
    problems,
    saved,
    checkedPage,
    setCheckedPage,
    busy,
    notice,
    seenNow,
    seeLive,
    edit,
    accept,
    discard,
    putBack,
    actOnHeld,
    loadAll,
  };
}

export type ConnectorDesk = ReturnType<typeof useConnectorDesk>;
