/**
 * The task board's address and its menu words: the two things the site's
 * menus need from the task board. Apart from shared/sessionTasks.ts, which
 * re-exports both, because the menus are on every page and sessionTasks
 * brings the session model with it (about 30 KB the first page then carried
 * for every visitor, signed in or not).
 */

/** The board's anchor on the profile, so an email and a notice can land on it. */
export const TASK_BOARD_ANCHOR = "my-tasks";
export const TASK_BOARD_PATH = `/profile#${TASK_BOARD_ANCHOR}`;

/** The task board's entry in the account menu and the shortcuts. */
export const TASK_MENU = {
  label: "My tasks",
  /** The count's name for a screen reader. The count is hidden when nothing waits. */
  waiting: (n: number): string => (n === 1 ? "1 task waits on you" : `${n} tasks wait on you`),
};
