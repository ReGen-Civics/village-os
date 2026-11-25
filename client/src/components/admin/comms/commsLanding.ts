/**
 * Where an Admin search result (or any link) lands on Mail settings.
 *
 * The address is `/admin?tab=comms-settings&setting=comms.<item>`, the ids in
 * shared/adminSearch.ts. A checklist item opens and its first control takes
 * the focus; the test email lands on the "Send me a test" button itself, and
 * Pause all on its own button. Anything else lands on nothing, and the page
 * opens as it always did.
 */
import { COMMS_SETTING_PREFIX } from "@shared/adminSearch";
import { SETUP_KEYS, type SetupKey } from "@shared/comms/settings";

/** The id of the "Send me a test" button. */
export const TEST_EMAIL_BUTTON_ID = "comms-test-email-send";
/** The id of the Pause all button. */
export const PAUSE_ALL_BUTTON_ID = "comms-pause-all-button";

/** The panel a checklist item opens, the same id ChecklistRow gives it. */
export function setupPanelId(key: SetupKey): string {
  return `comms-setup-${key}`;
}

export interface CommsLanding {
  /** The checklist item to open, when the control lives inside one. */
  open: SetupKey | null;
  /** What takes the focus. */
  focus: string;
}

export function commsLanding(setting: string | null | undefined): CommsLanding | null {
  if (!setting || !setting.startsWith(COMMS_SETTING_PREFIX)) return null;
  const rest = setting.slice(COMMS_SETTING_PREFIX.length);
  if (rest === "pause-all") return { open: null, focus: PAUSE_ALL_BUTTON_ID };
  if (!(SETUP_KEYS as readonly string[]).includes(rest)) return null;
  const key = rest as SetupKey;
  return { open: key, focus: key === "test-email" ? TEST_EMAIL_BUTTON_ID : setupPanelId(key) };
}
