import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { markMachineTranslated } from "@/i18n/machineTranslation";
import { readPageTranslation } from "@shared/contentTranslationOverlay";
import { overlayVillageDoc, type VillageDocRef } from "@shared/villageDocTranslation";

/**
 * The village's words outside its pages (the homepage words in Identity, the visit page) in the reader's
 * language, where the village has translated them (shared/villageDocTranslation.ts). English asks nothing;
 * a failed read, or a language with no translation, leaves every word as it is.
 */
export function useVillageDocFields(ref: VillageDocRef): Readonly<Record<string, string>> {
  const { locale } = useLocale();
  const [got, setGot] = useState<{ locale: string; fields: Record<string, string>; machine: boolean } | null>(null);
  useEffect(() => {
    if (locale === "en" || locale.startsWith("en-")) return;
    let alive = true;
    fetch(`/api/village-doc/${encodeURIComponent(ref)}/translation`, { headers: { "X-Village-Locale": locale } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const t = readPageTranslation(d?.translation);
        if (alive) setGot({ locale, fields: t && t.locale === locale ? t.fields : {}, machine: !!t && t.machine.length > 0 });
      })
      .catch(() => {
        if (alive) setGot({ locale, fields: {}, machine: false });
      });
    return () => {
      alive = false;
    };
  }, [ref, locale]);
  const current = got && got.locale === locale ? got : null;
  const machine = !!current?.machine;
  useEffect(() => {
    const key = `village-doc:${ref}`;
    markMachineTranslated(key, machine);
    return () => markMachineTranslated(key, false);
  }, [ref, machine]);
  return current?.fields ?? EMPTY;
}

const EMPTY: Readonly<Record<string, string>> = {};

/** `doc` with the reader's translated fields laid over it; the same object when there are none. */
export function useVillageDoc<T>(ref: VillageDocRef, doc: T): T {
  const fields = useVillageDocFields(ref);
  return Object.keys(fields).length ? overlayVillageDoc(ref, doc, fields) : doc;
}
