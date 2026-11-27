import { i18n as appI18n, setupI18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLocale } from "@/i18n/LocaleProvider";
import { usePageReadingCopy } from "@/hooks/usePageContent";
import { BTN_SECONDARY, TILE } from "@/components/journey/look";
import type { PageSpec } from "@shared/pageContent/types";

/**
 * THE NOTE ABOVE A BINDING PAGE'S READING COPY (the lead, 26 Nov 2026).
 *
 * A binding page (the pledge, the rights pages, the good neighbor agreement) may carry a reading copy in the
 * reader's language. While it shows, this says so, and says in the reader's language AND in English that the
 * English text is the binding version, with one button to read the English itself. Nothing while the page
 * has no reading copy, so an English reader, or a page nobody has copied, draws nothing at all.
 */
export const BINDING = msg({ message: "The English text is the binding version.", context: "binding page reading copy" });
// The same sentence in English, whatever language the reader chose. Written out: a built bundle keeps only a
// message's id, so no catalog lookup can give the English back while another language is active.
export const BINDING_EN = "The English text is the binding version."; // i18n-ok: shown in English on purpose, beside the reader's language
const ENGLISH = setupI18n({ locale: "en", messages: { en: {} } });

export default function ReadingCopyNote({ spec }: { spec: PageSpec }) {
  useLocale(); // drawn again when the reader changes language
  // The app's own catalog, or the English when no language has started (a page rendered on its own, as in a test).
  const i18n = appI18n.locale ? appI18n : ENGLISH;
  const copy = usePageReadingCopy(spec);
  if (!copy.active) return null;
  const said = i18n._(BINDING);
  return (
    <aside role="note" className={`${TILE} mb-6 space-y-2`} data-reading-copy={copy.showingEnglish ? "english" : "copy"}>
      <p className="text-sm font-semibold text-foreground">
        {copy.showingEnglish
          ? i18n._(msg({ message: "You are reading the binding English text.", context: "binding page reading copy" }))
          : i18n._(msg({ message: "This is a reading copy in your language.", context: "binding page reading copy" }))}
      </p>
      {said !== BINDING_EN && <p className="text-sm text-muted-foreground">{said}</p>}
      <p lang="en" className="text-sm text-muted-foreground">
        {BINDING_EN}
      </p>
      <button type="button" onClick={copy.toggle} className={`${BTN_SECONDARY} print:hidden`}>
        {copy.showingEnglish
          ? i18n._(msg({ message: "Read the copy in my language", context: "binding page reading copy: the button" }))
          : i18n._(msg({ message: "Read the binding English", context: "binding page reading copy: the button" }))}
      </button>
    </aside>
  );
}
