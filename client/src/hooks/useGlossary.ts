/**
 * The village's own words, explained (shared/glossary.ts): read once per page load from the public content route,
 * through the section listing so a village that has written none never asks (hooks/useVillageContent.ts), and
 * cleaned on the way in. Null until it has arrived, and an empty glossary when it cannot be read: a mark appears only
 * once its sentence is here, so nothing flashes in and then away.
 */
import { useEffect, useState } from "react";
import { GLOSSARY_SECTION, glossaryOf, type Glossary } from "@shared/glossary";
import { readVillageSection } from "@/hooks/useVillageContent";

let read: Promise<Glossary> | null = null;

function readGlossary(): Promise<Glossary> {
  if (!read) read = readVillageSection(GLOSSARY_SECTION).then(glossaryOf, () => ({}));
  return read;
}

/** For tests: forget the read. */
export function forgetGlossary(): void {
  read = null;
}

export function useGlossary(): Glossary | null {
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  useEffect(() => {
    let live = true;
    void readGlossary().then((g) => live && setGlossary(g));
    return () => {
      live = false;
    };
  }, []);
  return glossary;
}
