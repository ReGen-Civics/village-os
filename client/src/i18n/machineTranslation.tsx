import { useSyncExternalStore } from "react";
import { Trans } from "@lingui/react/macro";
import { Languages } from "lucide-react";

/**
 * WORDS A MACHINE TRANSLATED ARE SHOWN MARKED (Rye, 15 Nov 2026): a village's
 * own words in another language, drafted by AI, show to readers marked as a
 * machine translation until a person with the power approves them.
 *
 * A page reads its words through `usePageContent`, which tells this store when
 * any of them came from a machine draft. The layout draws one note at the end
 * of the page while any reader on it holds one, so every page that takes a
 * translation is marked without each page drawing its own. A role card marks
 * itself (`MachineTranslationMark`), because a card shows on pages that hold
 * no translated page words at all.
 */
const holders = new Set<string>();
const listeners = new Set<() => void>();
let snapshot = false;

function emit() {
  snapshot = holders.size > 0;
  listeners.forEach((l) => l());
}

/** Say whether the reader named `key` is showing a machine translation now. */
export function markMachineTranslated(key: string, on: boolean): void {
  const had = holders.has(key);
  if (on === had) return;
  if (on) holders.add(key);
  else holders.delete(key);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAnyMachineTranslated(): boolean {
  return useSyncExternalStore(subscribe, () => snapshot, () => false);
}

/** The page's note, at the end of the page, while any of its words are a machine's. */
export function MachineTranslationNote() {
  const on = useAnyMachineTranslated();
  if (!on) return null;
  return (
    <div className="container py-6">
      <p className="flex items-start gap-2 text-sm text-muted-foreground" data-testid="machine-translation-note">
        <Languages className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <Trans context="note at the end of a page whose village words a machine translated">
          Some words on this page are a machine translation. A person has not checked them yet.
        </Trans>
      </p>
    </div>
  );
}

/** The mark on one role card whose words a machine translated. */
export function MachineTranslationMark() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="machine-translation-mark">
      <Languages className="size-3.5 shrink-0" aria-hidden="true" />
      <Trans context="mark on a role card whose words a machine translated">Machine translation, not yet checked by a person</Trans>
    </p>
  );
}
