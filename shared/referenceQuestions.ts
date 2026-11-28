/**
 * THE STANDARD FOLLOW-UP QUESTIONS (the lead, 27 Nov 2026: "Give the follow-up person a short, standard set of
 * questions in their notes, the same for everyone"). A village setting, so the village words its own; the platform's
 * default is short and plain. They open in the notes box of whoever follows a reference up, when the notes are empty.
 */
export const REFERENCE_QUESTIONS_VARIABLE = "org.reference_questions";

export const REFERENCE_QUESTIONS_DEFAULT = [
  "How do you know them, and for how long?",
  "What are they great at?",
  "Where might they need support?",
  "Would you work with them again? Why?",
  "Anything else we should know?",
].join("\n");
