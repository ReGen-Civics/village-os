/**
 * The application page's hold on "Save and finish later" (fireflyPath/applySaveLater.ts): the token this tab
 * holds, the draft a resume link opened, and the state of the last save. Kept out of ProposeARole.tsx so the
 * page stays readable in one sitting.
 */
import { useEffect, useRef, useState } from "react";
import type { DraftOpened } from "@shared/applicationDrafts";
import { aboutYouOf, type AboutYouValue } from "@/components/openProposal/AboutYou";
import type { DraftToSave } from "./applySaveLater";
import type { SaveLaterState } from "./SaveLater";

/** The token in the address's fragment (shared/applicationDrafts.ts `tokenFromHash`), read here so the page's chunk carries none of that module. */
function tokenFromHash(hash: string): string | null {
  const m = /^#resume=([A-Za-z0-9_-]{43})$/.exec(hash);
  return m ? m[1] : null;
}

/** Nothing saved yet. */
export const NO_SAVE: SaveLaterState = { saving: false, saved: null, url: null, problem: null };

// The saving and opening code loads on first use, so it rides no route's first view (scripts/route-first-view.json).
const later = () => import("./applySaveLater");

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

/** Keep the token in the address bar's fragment, so a reload of this tab opens the same draft. */
function keepTokenInAddress(token: string) {
  if (typeof window === "undefined") return;
  window.history.replaceState?.(window.history.state, "", `${window.location.pathname}${window.location.search}#resume=${token}`);
}

export function useSaveLater(link: string) {
  const [token, setToken] = useState<string | null>(() => (typeof window === "undefined" ? null : tokenFromHash(window.location.hash)));
  const [opening, setOpening] = useState(token !== null);
  const [opened, setOpened] = useState<{ opened: DraftOpened; files: File[] } | null>(null);
  const [state, setState] = useState<SaveLaterState>(NO_SAVE);
  const used = useRef(false);

  useEffect(() => {
    if (!token || used.current) return;
    used.current = true;
    void later().then((m) => m.openDraft(token)).catch(() => ({ ok: false as const, error: "network" as const })).then((r) => {
      if (r.ok) setOpened({ opened: r.opened, files: r.files });
      else {
        setToken(null);
        setState({ ...NO_SAVE, problem: { ok: false, error: r.error } });
      }
      setOpening(false);
    });
    // Opened once, from the address this page arrived on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (d: Omit<DraftToSave, "token" | "link">) => {
    setState((s) => ({ ...s, saving: true, problem: null }));
    const m = await later().catch(() => null);
    if (!m) {
      setState((s) => ({ ...s, saving: false, problem: { ok: false, error: "network" } }));
      return;
    }
    const r = await m.saveDraft({ ...d, token, link });
    if (!r.ok) {
      // A draft the server no longer keeps: the next save starts a new one.
      if (r.error === "gone") setToken(null);
      setState((s) => ({ ...s, saving: false, problem: r }));
      return;
    }
    setToken(r.saved.token);
    keepTokenInAddress(r.saved.token);
    setState({ saving: false, saved: r.saved, url: m.resumeUrl(r.saved.token, link, window.location.origin), problem: null });
  };

  const discard = () => {
    if (token) void later().then((m) => m.discardDraft(token)).catch(() => undefined);
  };

  return { opening, opened, state, save, discard };
}
