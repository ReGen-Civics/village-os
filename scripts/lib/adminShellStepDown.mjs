/**
 * THE STEP DOWN: the admin allowance falls on the day the old admin shell is
 * retired (the founder's ruling, 28 Nov 2026, fourth point).
 *
 * The admin allowance (MAX_ADMIN_DIST_KB) is sized while the old shell, the
 * page the /admin route drew on the day of the ruling, still ships beside the
 * Admin Garden that replaces it. The day that page leaves the build, its
 * weight is room nobody asked for, and room in a budget gets spent. So the
 * weight is written down (scripts/admin-shell-step-down.json), and once the
 * page is gone the allowance must have come down by at least that much.
 *
 * Pure, so the gate (which has a build and asks "is the page in any chunk")
 * and the self-test (which has the source tree and asks "is the page's file
 * still there") reach the same verdict from the same rule.
 */

/** A budget as CI reads it: `NAME: 123` on a line of the workflow, or null when the workflow sets none. */
export function budgetInWorkflow(workflowText, name) {
  const m = workflowText.match(new RegExp(`^\\s*${name}:\\s*(\\d+)\\s*$`, "m"));
  return m ? Number(m[1]) : null;
}

/**
 * @param {{ page: string, chargedKb: number, allowanceWithShellKb: number | null }} record
 *        scripts/admin-shell-step-down.json.
 * @param {boolean} shellPresent whether the old shell's page is still built (or, for the self-test, still in the tree).
 * @param {number | null} allowanceKb MAX_ADMIN_DIST_KB as CI reads it, null when it is not set.
 * @returns {{ ok: boolean, state: "ships" | "retired", maxAllowanceKb: number | null, message: string }}
 */
export function stepDownVerdict(record, shellPresent, allowanceKb) {
  const recorded = record.allowanceWithShellKb ?? null;
  const now = allowanceKb ?? null;
  if (shellPresent) {
    if (recorded !== now) {
      return {
        ok: false,
        state: "ships",
        maxAllowanceKb: null,
        message:
          `The admin allowance is ${now === null ? "not set" : `${now} KB`} where CI reads it, and scripts/admin-shell-step-down.json records ${recorded === null ? "none" : `${recorded} KB`}. ` +
          `While the old admin shell (${record.page}) still ships, write the allowance into "allowanceWithShellKb" there in the same change: it is the number the step down is measured from.`,
      };
    }
    return { ok: true, state: "ships", maxAllowanceKb: null, message: `The old admin shell (${record.page}) still ships; the allowance steps down by ${record.chargedKb} KB the day it does not.` };
  }
  if (recorded === null || now === null) {
    return { ok: true, state: "retired", maxAllowanceKb: null, message: `The old admin shell (${record.page}) is gone and ${recorded === null ? "no allowance was recorded while it shipped" : "no admin allowance is set"}, so there is nothing to step down.` };
  }
  const cap = recorded - record.chargedKb;
  if (now > cap) {
    return {
      ok: false,
      state: "retired",
      maxAllowanceKb: cap,
      message:
        `The old admin shell (${record.page}) is no longer built, and the admin allowance is ${now} KB. It was ${recorded} KB with the shell, and the shell weighed ${record.chargedKb} KB block-charged, ` +
        `so the allowance must come down to ${cap} KB or less. Lower MAX_ADMIN_DIST_KB in .github/workflows/ci.yml (and MAX_TOTAL_DIST_KB by the same amount).`,
    };
  }
  return { ok: true, state: "retired", maxAllowanceKb: cap, message: `The old admin shell (${record.page}) is gone and the admin allowance came down from ${recorded} KB to ${now} KB, at least the shell's ${record.chargedKb} KB.` };
}
