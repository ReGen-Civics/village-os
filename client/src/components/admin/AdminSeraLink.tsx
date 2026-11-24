/**
 * A way back and forth between admin and the Sera board.
 *
 * The chip shows for a steward, which the catalog decides. Anyone else sees
 * nothing. The return screen is what `/admin?tab=modules&module=saberra` opens,
 * so the board's link lands in admin instead of bouncing back to the board.
 */
import { useEffect, useState } from "react";
import { authHeaders } from "@/components/admin/adminApi";
import { Trans } from "@lingui/react/macro";

// Sits in the header's right-hand cluster, on the light card.
const CHIP = "inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-card-foreground hover:bg-muted";

export function AdminSeraChip({ password }: { password: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let gone = false;
    fetch("/api/modules/catalog", { headers: authHeaders(password) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!gone) setShow(d?.viewer?.mode === "steward"); })
      .catch(() => { if (!gone) setShow(false); });
    return () => { gone = true; };
  }, [password]);
  if (!show) return null;
  return <a href="/modules/saberra" className={CHIP}><Trans context="AdminSeraLink, a">Sera board</Trans></a>;
}

export function SeraAdminHome() {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 text-gray-900">
      <h2 className="text-xl font-semibold"><Trans context="AdminSeraLink, h2">Sera</Trans></h2>
      <p className="mt-2 text-base text-gray-700"><Trans context="AdminSeraLink, p">The Sera board is on its own page. Nothing here is changed by opening it.</Trans></p>
      <a href="/modules/saberra" className="mt-3 inline-flex min-h-[44px] items-center text-base font-medium text-teal-deep underline">
        <Trans context="AdminSeraLink, a">Open the Sera board
      </Trans></a>
    </section>
  );
}
