/**
 * THE SPLIT A CARD'S WORDS SAY, HELD TO THE SPLIT IT PAYS (the coordinator, 23 Nov 2026; shared/paySplitDrift.ts).
 *
 * Asked where a role card's words are saved: the role editor's save (`saveRoleEdit`) and the filing of a
 * `role_card` proposal, which mirrors that save, so a change refused on accept is refused when it is filed.
 *
 * REFUSE, AND ONLY FOR WHAT THE SAVE TOUCHES. A card whose words already name an old split is not blocked from an
 * unrelated save (its aim, its deliverables): only a field this save changes is read, unless the save changes the
 * card's split itself, when every field is read, because that is the moment words written for the old split stop
 * being true. A change to the village's own `org.pay_shape` is a variable write, outside this check.
 */
import type { OrgRole } from "./orgChart";
import { cardPay, NO_VILLAGE_PAY, readVillagePayShape, SECTION_WORDS, type RoleCardSections } from "../../shared/roleCardSections";
import { splitDrift, splitDriftProblem, textOf } from "../../shared/paySplitDrift";
import { ROLE_WORD_FIELDS } from "./roleProposals";
import { ROLE_CARD_FIELDS } from "../../shared/roleCardText";
import { stringVar } from "./variables";

/** The section lines that are words, with the heading the refusal names. */
const SECTION_TEXT: ReadonlyArray<[keyof RoleCardSections, string]> = [
  ["payNote", SECTION_WORDS.payNoteLabel],
  ["paySplitNote", SECTION_WORDS.splitNoteLabel],
  ["aiSupport", SECTION_WORDS.aiSupport],
  ["idealBackground", SECTION_WORDS.idealBackground],
  ["qualities", SECTION_WORDS.qualities],
  ["onboarding", SECTION_WORDS.onboarding],
  ["where", SECTION_WORDS.where],
  ["deliverables", "Deliverables"],
];

const sectionText = (s: RoleCardSections, k: keyof RoleCardSections): string =>
  k === "deliverables" ? (s.deliverables ?? []).map((d) => d.title).join("\n") : textOf(s[k]);

/**
 * The refusal for a split said by hand that the card, as this save leaves it, does not pay, or null.
 * `changedWords` holds only the word fields this save changes; `held` and `next` are the sections before and after.
 * `villageShape` is the village's split (`org.pay_shape`), read here when it is not given.
 */
export function splitDriftRefusal(
  role: OrgRole,
  changedWords: Record<string, unknown>,
  held: RoleCardSections,
  next: RoleCardSections,
  villageShape = readVillagePayShape(stringVar("org.pay_shape")),
): { error: string; field: string } | null {
  const village = { ...NO_VILLAGE_PAY, shape: villageShape };
  const shape = cardPay(next, village)?.shape ?? [];
  const before = cardPay(held, village)?.shape ?? [];
  const shapeMoved = JSON.stringify(shape) !== JSON.stringify(before);
  const posted = role as unknown as Record<string, unknown>;
  const words = ROLE_WORD_FIELDS.fields
    .filter((k) => shapeMoved || k in changedWords)
    .map((k) => ({ field: k, text: textOf(k in changedWords ? changedWords[k] : posted[k]) }));
  const sections = SECTION_TEXT.filter(([k]) => shapeMoved || sectionText(held, k) !== sectionText(next, k)).map(([k]) => ({ field: `sections.${String(k)}`, text: sectionText(next, k) }));
  const d = splitDrift([...words, ...sections], shape);
  if (!d) return null;
  const label = d.field.startsWith("sections.")
    ? SECTION_TEXT.find(([k]) => `sections.${String(k)}` === d.field)?.[1] ?? d.field
    : ROLE_CARD_FIELDS.find((f) => f.key === d.field)?.heading ?? d.field;
  return { error: splitDriftProblem(d, shape, label), field: d.field };
}
