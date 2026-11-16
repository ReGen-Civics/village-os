/**
 * WORDS AROUND THE APP (gap G7): the lines that carry a place or a meaning and
 * sat in code, so every village read them. An empty quest board's "The meadow
 * is resting", the joining page's lines, the launch vote's name, the profile
 * treasury's headings, the role card glossary, and the membership letter's
 * verb ("Align", "Align and join").
 *
 * EVERY FIELD DEFAULTS TO BLANK, AND BLANK KEEPS THE PLATFORM'S WORDS. Those
 * words are translated (Lingui), so a village that leaves a box blank reads
 * them in its member's language, exactly as before. A village that types a
 * line reads its own, in every language, until it adds translations through
 * the content translations lane. Each box's help says what the platform
 * shows there, so a founder knows what they are replacing.
 *
 * `{village}` is the village's name; `{title}` in the letter heading is the
 * letter's own title.
 */
import type { PageSpec } from "./types";

const KEEP = "Blank keeps the platform's words:";

export const APP_WORDS_PAGE: PageSpec = {
  id: "app-words",
  label: "Words around the app",
  path: "/quests",
  sections: [
    {
      id: "empty",
      label: "Empty screens",
      shows: "What a page says when it has nothing to show yet.",
      fields: [
        { key: "questsTitle", label: "Quest board, nothing posted: heading", help: `${KEEP} "The meadow is resting".`, kind: "text", max: 48, default: "", optional: true },
        { key: "questsLine", label: "Quest board, nothing posted: line", help: `${KEEP} "No Quests posted yet. Post the first one."`, kind: "long", max: 160, default: "", optional: true },
      ],
    },
    {
      id: "joining",
      label: "Joining",
      shows: "The joining page, for someone who arrives with no invitation.",
      fields: [
        { key: "heading", label: "Heading", help: `${KEEP} "You need an invitation to join {village}".`, kind: "text", max: 80, default: "", optional: true },
        { key: "withLink", label: "First line", help: `${KEEP} "Got an invitation link? Open it to create your account."`, kind: "long", max: 200, default: "", optional: true },
        { key: "withoutLink", label: "Second line", help: `${KEEP} "No link yet? Ask to join, and someone from the village will reach out. A community call is a good first step."`, kind: "long", max: 240, default: "", optional: true },
        { key: "askButton", label: "The ask button", help: `${KEEP} "Ask to join".`, kind: "text", max: 32, default: "", optional: true },
      ],
    },
    {
      id: "letter",
      label: "The membership letter's verb",
      shows: "The words a signed-in member reads while signing the membership letter.",
      fields: [
        { key: "readReflect", label: "The three words above the letter", help: `${KEEP} "Read. Reflect. Align."`, kind: "text", max: 40, default: "", optional: true },
        { key: "heading", label: "The heading over the signing box", help: `${KEEP} "Align with the {title}". {title} is the letter's title.`, kind: "text", max: 80, default: "", optional: true },
        { key: "button", label: "The signing button", help: `${KEEP} "Align and join {village}".`, kind: "text", max: 48, default: "", optional: true },
        { key: "busy", label: "While it signs", help: `${KEEP} "Aligning…"`, kind: "text", max: 32, default: "", optional: true },
        { key: "done", label: "Once it is signed", help: `${KEEP} "You aligned with the letter. The village has your request."`, kind: "long", max: 160, default: "", optional: true },
      ],
    },
    {
      id: "launch",
      label: "The launch vote",
      shows: "The name of the vote that starts the village, on the road to launch.",
      fields: [
        { key: "name", label: "What the launch vote is called", help: `${KEEP} "Start the Game".`, kind: "text", max: 32, default: "", optional: true },
      ],
    },
    {
      id: "treasury",
      label: "Your treasury, on the profile",
      shows: "The headings of the treasury on a member's own profile. Name the tokens only: never say what a token does.",
      fields: [
        { key: "kicker", label: "The small line above the heading", help: `${KEEP} "Your treasury".`, kind: "text", max: 32, default: "", optional: true },
        { key: "heading", label: "Heading", help: `${KEEP} "What you hold".`, kind: "text", max: 40, default: "", optional: true },
        { key: "byMoon", label: "The panel by moon", help: `${KEEP} "By moon".`, kind: "text", max: 32, default: "", optional: true },
        { key: "coming", label: "The panel of work in hand", help: `${KEEP} "Coming when you finish".`, kind: "text", max: 40, default: "", optional: true },
        { key: "latest", label: "The latest ledger lines", help: `${KEEP} "Latest in your ledger".`, kind: "text", max: 40, default: "", optional: true },
      ],
    },
    {
      id: "glossary",
      label: "The role card glossary",
      shows: "The short explanations a role card offers for its words.",
      fields: [
        { key: "title", label: "Heading", help: `${KEEP} "What does this mean?"`, kind: "text", max: 40, default: "", optional: true },
        { key: "clocks", label: "Clocks", help: `${KEEP} the platform's explanation of a role's clocks.`, kind: "long", max: 200, default: "", optional: true },
        { key: "rhythm", label: "Rhythm", help: `${KEEP} the platform's explanation of a role's rhythm.`, kind: "long", max: 200, default: "", optional: true },
        { key: "allowance", label: "Allowance", help: `${KEEP} the platform's explanation of a role's allowance.`, kind: "long", max: 200, default: "", optional: true },
        { key: "scoreboard", label: "Scoreboard", help: `${KEEP} the platform's explanation of a role's scoreboard.`, kind: "long", max: 200, default: "", optional: true },
        { key: "domain", label: "Domain", help: `${KEEP} the platform's explanation of a role's domain.`, kind: "long", max: 200, default: "", optional: true },
      ],
    },
  ],
};

export type AppWordSection = "empty" | "joining" | "letter" | "launch" | "treasury" | "glossary";

/**
 * The village's own line for one box, `{words}` filled, or null when it left
 * the box blank (the caller then shows the platform's translated words).
 */
export function appWordOf(stored: unknown, section: AppWordSection, key: string, vars: Readonly<Record<string, string>>): string | null {
  const doc = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const s = doc[section] && typeof doc[section] === "object" ? (doc[section] as Record<string, unknown>) : {};
  const raw = typeof s[key] === "string" ? (s[key] as string).trim() : "";
  if (!raw) return null;
  return raw.replace(/\{([a-zA-Z]+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
