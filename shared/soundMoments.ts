/**
 * The moments the product makes a sound for, shared by the audio layer
 * (client/src/lib/sound.ts) and the route a village loads its sounds through
 * (server/routes/brandSounds.ts, gap G8). The first five are the platform's;
 * the last three are for the new modules (a stamp landing, a seal breaking,
 * something unlocking), which play them the same way.
 */
export const SOUND_MOMENT_IDS = [
  "quest_complete",
  "gratitude",
  "stage_advance",
  "notification",
  "ui_tick",
  "stamp",
  "seal",
  "unlock",
] as const;

export type SoundMomentId = (typeof SOUND_MOMENT_IDS)[number];
