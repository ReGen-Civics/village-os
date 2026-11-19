/**
 * THE VILLAGE'S OWN NOUNS, FOR SERVER CODE THAT CANNOT REACH THE CONTENT DOCUMENT (the lead, 19 Nov 2026).
 *
 * The vocabulary lives in the content section `app-vocabulary` (shared/vocabulary.ts), which only the host holds.
 * End of Moon needs one of its words, the contribution token's, to read a pay share the village labelled in its
 * own words ("Amora 40") as the contribution share. The host hands over a reader once at boot; until it does, or
 * on a read that fails, this answers null and callers read the registry names alone.
 */
import type { Vocabulary } from "../../shared/vocabulary";

let read: () => Vocabulary | null = () => null;

/** Called once by the host, with a reader of the resolved vocabulary. */
export function readVillageNounsFrom(reader: () => Vocabulary | null): void {
  read = reader;
}

/** The village's resolved vocabulary, or null. */
export function villageNouns(): Vocabulary | null {
  try {
    return read();
  } catch {
    return null;
  }
}
