/**
 * ROLE CARD WORDS THAT LIVE IN SHARED CODE, IN THE READER'S LANGUAGE (translation lane, 15 Nov 2026).
 *
 * Lingui extracts client/src only, so a sentence written in shared/ reaches a Spanish reader in English. These
 * are the card's own lines from shared/: the English there stays the source a test and the server read, and
 * each one is said again here as a message, keyed by what it is, never matched on its words.
 */
import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { RoleFill } from "@shared/commitmentRange";
import { readTrack, type Track } from "@shared/roleTracks";

/** "This is a paid role" (SECTION_WORDS.paid). */
export const paidRoleLine = (i18n: I18n): string => i18n._(msg({ message: "This is a paid role", context: "role card, under the title" }));

/** A track's label (TRACK_WORDS), or the stored words as they are when they name no track. */
export function trackWords(i18n: I18n, raw: string): string {
  const track: Track | null = readTrack(raw);
  if (track === "contractor") return i18n._(msg({ message: "Paid contractor", context: "role track" }));
  if (track === "volunteer") return i18n._(msg({ message: "Volunteer", context: "role track" }));
  if (track === "employee") return i18n._(msg({ message: "Local employee", context: "role track" }));
  if (track === "ai") return i18n._(msg({ message: "AI", context: "role track" }));
  return raw;
}

/** "50% held · 50% open", "120% held · covered", or "Covered" / "Held, still open" without the share (L3). */
export function fillLine(i18n: I18n, f: RoleFill): string {
  if (f.coarse) return f.covered ? i18n._(msg({ message: "Covered", context: "role fill, one named holder" })) : i18n._(msg({ message: "Held, still open", context: "role fill, one named holder" }));
  const held = f.heldPct;
  const open = f.openPct;
  return f.covered
    ? i18n._(msg({ message: `${held}% held · covered`, context: "role fill" }))
    : i18n._(msg({ message: `${held}% held · ${open}% open`, context: "role fill" }));
}
