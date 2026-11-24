/**
 * A MEMBER'S ADDRESSES, READ BY AN ADMIN (0430). Which address is main, the
 * extra ones the member proved, and where their mail goes. Read only: an admin
 * cannot attach an address for anybody, because an address is attached only by
 * the code mailed to it (server/routes/memberEmails.ts). Loaded when opened, so
 * the roster does not make one read per card.
 *
 * Admin is a light-only workspace by ruling (2026-09-04): fixed grays here.
 */
import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { AccountEmails } from "@shared/memberEmails";
import { API_BASE, authHeaders } from "./adminApi";

export default function MemberEmails({ userId, password }: { userId: string; password: string }) {
  const { t } = useLingui();
  const [data, setData] = useState<AccountEmails | null>(null);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    if (data) return;
    try {
      const r = await fetch(`${API_BASE}/admin/members/${encodeURIComponent(userId)}/emails`, { headers: authHeaders(password) });
      if (!r.ok) throw new Error(String(r.status));
      setData((await r.json()) as AccountEmails);
    } catch {
      setFailed(true);
    }
  };

  const deliveryWords: Record<AccountEmails["delivery"], string> = {
    main: t({ message: "Main address only", context: "admin member emails: delivery" }),
    other: t({ message: "The other address only", context: "admin member emails: delivery" }),
    both: t({ message: "Both addresses", context: "admin member emails: delivery" }),
  };

  return (
    <details className="text-xs text-gray-700" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void load()}>
      <summary className="cursor-pointer select-none text-gray-600">
        <Trans context="admin member emails: summary">Email addresses</Trans>
      </summary>
      {failed ? (
        <p className="mt-1 text-gray-500">
          <Trans context="admin member emails">The addresses could not be read. Try again.</Trans>
        </p>
      ) : !data ? (
        <p className="mt-1 text-gray-400">
          <Trans context="admin member emails">Loading...</Trans>
        </p>
      ) : (
        <div className="mt-1 space-y-1">
          <p>
            <span className="font-semibold">{data.main}</span>{" "}
            <span className="text-gray-500">
              {data.mainVerified ? (
                <Trans context="admin member emails: main state">(main, confirmed)</Trans>
              ) : (
                <Trans context="admin member emails: main state">(main, not confirmed yet)</Trans>
              )}
            </span>
          </p>
          {data.extras.map((e) => (
            <p key={e.email}>
              {e.email}{" "}
              <span className="text-gray-500">
                <Trans context="admin member emails: extra state">(confirmed {new Date(e.verifiedAt).toLocaleDateString()})</Trans>
              </span>
            </p>
          ))}
          <p className="text-gray-600">
            <Trans context="admin member emails: delivery line">Email goes to: {deliveryWords[data.delivery]} ({data.deliversTo.join(", ")})</Trans>
          </p>
          <p className="text-gray-500">
            <Trans context="admin member emails: no admin write">Only the member can add an address, by entering the code sent to it.</Trans>
          </p>
        </div>
      )}
    </details>
  );
}
