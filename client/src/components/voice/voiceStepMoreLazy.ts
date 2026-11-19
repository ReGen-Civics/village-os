/**
 * ONE IMPORT OF THE VOICE STEP'S SECOND HALF (hotfix, 19 Nov 2026).
 *
 * VoiceInvite.tsx and VoiceClips.tsx both draw VoiceStepMore.tsx lazily. Its
 * chunk opens with a top-level await (the long English it carries, see
 * client/src/i18n/copySplit.ts), and two separate `import()` calls racing for
 * a module that is still awaiting can hand one of them the module before its
 * top-level `let`s exist on iOS Safari. The page then threw "Cannot access
 * uninitialized variable" inside useSyncExternalStore and an applicant could
 * not open /propose-a-role at all.
 *
 * So the chunk is asked for exactly once: both places draw this ONE lazy
 * component, and React.lazy calls its loader once. The switch's state also lives outside that chunk
 * (voiceWriteDownStore.ts), in a module with no top-level await, so even a
 * module handed over early has nothing in its temporal dead zone to read.
 */
import { lazy } from "react";
import { autoWriteDown } from "./voiceWriteDownStore";

/**
 * Reading the switch here, before the import, is what keeps the store in the
 * page's own chunk: a bare `import "./voiceWriteDownStore"` is dropped as
 * side-effect free and the bundler folds the store back into VoiceStepMore.
 */
export const VoiceStepMoreLazy = lazy(() => {
  autoWriteDown();
  return import("./VoiceStepMore");
});
