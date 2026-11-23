/**
 * THE OPERATIONS REPORT EMAIL, SWITCHED BY AN ADMIN FOR SOMEBODY ELSE.
 *
 * The daily failed-actions report goes to every admin and founder. A member
 * can switch its email off on their own profile; this is the admin's door to
 * the same preference (`PUT /api/admin/players/:id/ops-email`), so a member
 * whose seat is not operational stops getting it today without signing in.
 * Email only: the bell row still lands. The server records who changed it.
 *
 * Palette tokens only (scripts/check-tailwind-palette.mjs).
 */
import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { toast } from "sonner";
import { API_BASE, authHeaders, refusal } from "./adminApi";

export type OpsEmail = "daily" | "off";

export default function OpsEmailSwitch({ userId, initial, password }: { userId: string; initial: OpsEmail | undefined; password: string }) {
  const { t } = useLingui();
  const [value, setValue] = useState<OpsEmail>(initial === "off" ? "off" : "daily");
  const [saving, setSaving] = useState(false);

  const change = async (next: OpsEmail) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/players/${encodeURIComponent(userId)}/ops-email`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ opsEmail: next }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(refusal(d, t({ message: "That did not save. Try again.", context: "admin ops report email" })));
      setValue(d?.opsEmail === "off" ? "off" : "daily");
      toast.success(
        next === "off"
          ? t({ message: "Operations report email is off for this member", context: "admin ops report email" })
          : t({ message: "Operations report email is daily for this member", context: "admin ops report email" }),
      );
    } catch (e: any) {
      toast.error(e?.message || t({ message: "That did not save. Try again.", context: "admin ops report email" }));
    }
    setSaving(false);
  };

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="sr-only">
        <Trans context="admin ops report email">Operations report email</Trans>
      </span>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => change(e.target.value as OpsEmail)}
        className="min-h-9 rounded-lg border border-border bg-card px-2 text-xs"
      >
        <option value="daily">{t({ message: "Ops report email: daily", context: "admin ops report email option" })}</option>
        <option value="off">{t({ message: "Ops report email: off", context: "admin ops report email option" })}</option>
      </select>
    </label>
  );
}
