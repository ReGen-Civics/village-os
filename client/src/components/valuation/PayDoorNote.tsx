/**
 * WHICH DOOR THE READER SETS PAY THROUGH (coordinator ruling, 2026-11-09; G-B3).
 *
 * The server answers it (`holderStanding`, server/lib/holderDoor.ts) and sends
 * it as `payDoor` on the model and desk reads. A holder sees nothing; an admin
 * using the panel's door is told it closes at launch, so nobody learns that
 * from a refusal later.
 */
import { Trans } from "@lingui/react/macro";

export type PayDoor = "holder" | "admin-before-launch" | "admin-no-steward" | null | undefined;

const AMBER = "rounded-lg border border-amber-ink/30 bg-amber-light px-3 py-2 text-sm text-amber-ink";

/** `className`: the note's box; Admin's amber by default, the sheet's tile in Governance's Treasury. */
export default function PayDoorNote({ door, className = AMBER }: { door: PayDoor; className?: string }) {
  if (door !== "admin-before-launch" && door !== "admin-no-steward") return null;
  return (
    <p className={className} data-pay-door={door}>
      {door === "admin-before-launch" ? (
        <Trans context="pay door">You are setting pay as an admin. This stays open until the launch vote carries. After that, only whoever holds the pay power sets pay, or the village by vote.</Trans>
      ) : (
        <Trans context="pay door">You are setting pay as an admin because the village has no steward yet. Once someone holds the steward's role, only whoever holds the pay power sets pay, or the village by vote.</Trans>
      )}
    </p>
  );
}
