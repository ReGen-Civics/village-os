/**
 * THE APPLICATION PAGE'S PLUMBING (client/src/pages/ProposeARole.tsx), moved out so the page stays under the line
 * ceiling: where each field lives on the form, how the cursor is put on a problem, the page's shell, and the roles the
 * address bar names.
 */
import type { ReactNode } from "react";
import Layout from "@/components/Layout";
import { WORLD } from "@/components/journey/look";
import { prefersStill } from "./Thresholds";

/** One thing to fix before sending: the field's name, the words, and where to look for it on the page. */
export interface FormProblem {
  field: string | null;
  message: string;
  target: string | null;
}

/** Where on the form each field name the server or the checks use can be found. */
export function targetFor(field: string | null): string | null {
  switch (field) {
    case "why": return "#propose-why";
    case "aim": return "#propose-aim";
    case "name": return "#propose-name";
    case "email": return "#propose-email";
    case "selfKnowledge": return "#propose-self";
    case "card": return "[data-goals-list]";
    case "serves": return "[data-value-serves]";
    case "terms": return "[data-terms-section]";
    case "agreed": return "[data-agreements] input[type=checkbox][required]";
    // The tick itself, where the box is (final verification: the cursor went to the top of the stone).
    case "checkConsent":
    case "references": return "#propose-about-consent";
    case "about":
    case "links":
    case "files": return "[data-about-you-section]";
    case "membership": return "[data-agreements]";
    case "voice": return "[data-voice-invite]";
    case "timeZone": return "#card-tz";
    case "earliestStart": return "#card-start";
    case "payAsk":
    case "paySplit": return "[data-terms-section]";
    // A role added to the application (the lead, 17 Nov 2026): its own panel on The terms.
    default: return field?.startsWith("roles.") ? `[data-more-role="${field.slice(6)}"]` : null;
  }
}

/** Scroll to what needs fixing and put the cursor there, so a press on Send never looks like nothing happened. */
export function goToProblem(target: string | null) {
  if (typeof document === "undefined") return;
  const el = target ? document.querySelector<HTMLElement>(target) : null;
  const form = document.querySelector<HTMLElement>("[data-open-proposal]");
  const spot = el ?? form?.querySelector<HTMLElement>("#propose-problems") ?? null;
  if (!spot) return;
  spot.scrollIntoView?.({ block: "center", behavior: prefersStill() ? "auto" : "smooth" });
  const focusable = spot.matches("input,textarea,select,button,[tabindex]") ? spot : (firstUnanswered(spot) ?? spot.querySelector<HTMLElement>("input,textarea,select,button"));
  const at = focusable ?? spot;
  // A field found inside a section is centred itself, so the cursor is never off screen.
  if (at !== spot) at.scrollIntoView?.({ block: "center", behavior: "auto" });
  at.focus({ preventScroll: true });
}

/**
 * The first field in a section still waiting for an answer, in reading order:
 * a choice group with nothing picked, an empty list, an empty one-line field,
 * or an empty note box marked required. Null when every field holds
 * something, and the first control is used.
 */
export function firstUnanswered(spot: HTMLElement): HTMLElement | null {
  for (const el of Array.from(spot.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select"))) {
    if (el.disabled || (el instanceof HTMLInputElement && el.type === "hidden")) continue;
    if (el instanceof HTMLInputElement && el.type === "radio") {
      if (!spot.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`)) return el;
      continue;
    }
    if (el instanceof HTMLInputElement && el.type === "checkbox") continue;
    // A note box is optional unless it says otherwise; a one-line field or a list is an answer.
    if (el instanceof HTMLTextAreaElement && !el.required) continue;
    if (el.value.trim() === "") return el;
  }
  return null;
}

/** The words for a problem shown beside its field. */
export function Beside({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 border-l-4 border-notice pl-3 text-sm font-medium text-foreground" data-field-problem="">
      {message}
    </p>
  );
}

/** The form's page: the sheet's night ground, wide enough on a desk for the role beside the step. */
export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <Layout>
      <div className={`${WORLD} py-10 sm:py-16`}>
        <div className={`container ${wide ? "max-w-7xl" : "max-w-2xl"}`}>{children}</div>
      </div>
    </Layout>
  );
}

/** The role named by the link: the first one the village still offers, the others it names, and whether any it named is gone. */
export function roleFromLink(wanted: readonly string[], roles: ReadonlyArray<{ id: string }>, max: number): { id: string | null; gone: boolean; more: string[] } {
  const offered = wanted.filter((id, i) => roles.some((r) => r.id === id) && wanted.indexOf(id) === i);
  // The roles after the first join the same application (the lead, 17 Nov 2026), up to the most one takes.
  return { id: offered[0] ?? null, gone: wanted.length > 0 && offered.length < wanted.length && offered.length === 0, more: offered.slice(1, max) };
}

/** The address bar follows the role chosen, so a reload or a shared link opens the same application. */
export function showRoleInAddress(roleId: string | null) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  q.delete("role");
  if (roleId) q.set("role", roleId);
  const s = q.toString();
  window.history.replaceState?.(window.history.state, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
}

