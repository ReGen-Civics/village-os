/**
 * THE NAME OF THE FIELD A VOICE BUTTON BELONGS TO (a11y sweep P2-9, 14 Nov
 * 2026). Every "Speak instead of typing", "Record this answer" and clip player
 * on a form used to share one name, so a screen reader listing the buttons
 * heard the same words a dozen times. The field already has a name, its
 * <label>, so the buttons beside it read it from there: one source, nothing
 * for a call site to keep in step. The button's own words come first, so the
 * name still starts with what is on screen (WCAG 2.5.3, label in name).
 */
import { useEffect, useState, type RefObject } from "react";

const MAX = 80;

/** The field's label text (or its aria-label), once it is drawn. "" when it has neither. */
export function useFieldName(ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>): string {
  const [name, setName] = useState("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fromLabel = el.labels?.[0]?.textContent ?? "";
    const text = (fromLabel || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    setName(text.length > MAX ? `${text.slice(0, MAX - 1).trimEnd()}…` : text);
  });
  return name;
}

/** A button's words with the field it acts on: "Record this answer: Why you, and why now". */
export const forField = (words: string, field: string): string => (field ? `${words}: ${field}` : words);
