/**
 * Admin then Tokens: venture credit accounts (0419, credits lane 1).
 *
 * Members spend credits, and only ventures redeem them (the lead, 23 Nov
 * 2026). This panel opens a venture's account on the ledger, shows what every
 * venture holds and every payment in and out, and says which gatherings a
 * venture runs so their seat fees can go to it. The server is
 * server/routes/orgAccounts.ts and the shapes are shared/orgAccounts.ts.
 *
 * Which venture gets the first account is the village's choice, typed here.
 * Nothing in the platform names one.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { OrgAccountEntry, OrgAccountView, OrgServiceLink } from "@shared/orgAccounts";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { formatTokenAmount } from "@/lib/tokenAmount";

interface ListBody {
  accounts: OrgAccountView[];
  roles: Array<{ id: string; name: string; futureVenture: boolean }>;
  open: boolean;
  routing: boolean;
}

interface DetailBody {
  account: OrgAccountView;
  history: OrgAccountEntry[];
  services: OrgServiceLink[];
  operators: string[];
  gatherings: Array<{ id: string; title: string }>;
}

/** Every balance on one line, in the village's own token names. */
export function balanceLine(a: Pick<OrgAccountView, "balances" | "decimals" | "tokenNames">): string {
  const parts = Object.entries(a.balances)
    .filter(([, v]) => Number(v) !== 0)
    .map(([slug, v]) => `${formatTokenAmount(v, a.decimals[slug] ?? 0)} ${a.tokenNames[slug] ?? slug}`);
  return parts.length ? parts.join(", ") : "Nothing held yet";
}

async function call(password: string, method: string, path: string, body?: unknown): Promise<any> {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(password, body === undefined ? {} : { "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(refusal(d, "That did not go through."));
  return d;
}

export default function OrgAccountsPanel({ password }: { password: string }) {
  const [list, setList] = useState<ListBody | null>(null);
  const [error, setError] = useState("");
  const [roleId, setRoleId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailBody | null>(null);
  const [rename, setRename] = useState("");
  const [gathering, setGathering] = useState("");

  const load = useCallback(async () => {
    try {
      setList(await call(password, "GET", "/admin/org-accounts"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The accounts could not be read.");
    }
  }, [password]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const d: DetailBody = await call(password, "GET", `/admin/org-accounts/${encodeURIComponent(id)}`);
        setDetail(d);
        setRename(d.account.label);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That account could not be read.");
      }
    },
    [password],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDetail(null);
    setGathering("");
    if (openId) void loadDetail(openId);
  }, [openId, loadDetail]);

  const openAccount = async () => {
    if (!roleId) return;
    setBusy(true);
    try {
      await call(password, "POST", "/admin/org-accounts", { orgRoleId: roleId, label: label.trim() || undefined });
      toast.success("Account opened");
      setRoleId("");
      setLabel("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The account could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (id: string) => {
    try {
      await call(password, "PUT", `/admin/org-accounts/${encodeURIComponent(id)}`, { label: rename });
      toast.success("Name saved");
      await Promise.all([load(), loadDetail(id)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The name could not be saved.");
    }
  };

  const link = async (id: string) => {
    if (!gathering) return;
    try {
      await call(password, "POST", `/admin/org-accounts/${encodeURIComponent(id)}/services`, { kind: "event", id: gathering });
      setGathering("");
      await loadDetail(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The gathering could not be linked.");
    }
  };

  const unlink = async (id: string, s: OrgServiceLink) => {
    try {
      await call(password, "DELETE", `/admin/org-accounts/${encodeURIComponent(id)}/services/${s.kind}/${encodeURIComponent(s.id)}`);
      await loadDetail(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The gathering could not be taken off.");
    }
  };

  return (
    <section aria-labelledby="org-accounts-h" className="bg-card border border-border rounded-xl p-5 mb-6">
      <h3 id="org-accounts-h" className="font-semibold text-foreground mb-1">Venture accounts</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Members spend credits, and ventures redeem them. A venture's account holds what members pay it. The people seated
        in the venture's role see its balance and history. An account never closes and its credits never expire.
      </p>
      {list && (
        <ul className="text-xs text-muted-foreground mb-4 space-y-1">
          <li>
            {list.open ? "Members can pay venture accounts now." : "Members cannot pay venture accounts yet. You can open accounts first."}{" "}
            <a className="underline text-teal-deep" href="/admin?tab=variables&variable=ledger.org_accounts_open">
              {list.open ? "Change" : "Turn it on"}
            </a>
          </li>
          <li>
            {list.routing
              ? "Seat fees for a venture's own gatherings go to the venture."
              : "Seat fees go to the village treasury, including for a venture's gatherings."}{" "}
            <a className="underline text-teal-deep" href="/admin?tab=variables&variable=ledger.org_service_routing">
              Change
            </a>
          </li>
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!list && !error && <p className="text-sm text-muted-foreground">Loading...</p>}

      {list && (
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <label className="text-sm text-foreground flex flex-col gap-1 min-w-0 flex-1 basis-48">
            Venture role
            <select
              className="border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">Choose a role</option>
              {list.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.futureVenture ? " (future venture)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-foreground flex flex-col gap-1 min-w-0 flex-1 basis-40">
            Name members read (optional)
            <input
              className="border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
              value={label}
              maxLength={120}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="The role's name"
            />
          </label>
          <button
            type="button"
            disabled={!roleId || busy}
            onClick={openAccount}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
          >
            Open account
          </button>
        </div>
      )}

      {list && list.accounts.length === 0 && <p className="text-sm text-muted-foreground">No venture holds an account yet.</p>}
      {list && list.accounts.length > 0 && (
        <ul className="divide-y divide-border">
          {list.accounts.map((a) => (
            <li key={a.orgRoleId} className="py-3">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-sm font-medium text-foreground">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.roleName ? `Role: ${a.roleName}` : "Its role is gone from the org chart"}
                  </p>
                </div>
                <p className="text-sm text-foreground basis-40">{balanceLine(a)}</p>
                <button
                  type="button"
                  className="text-sm underline text-teal-deep"
                  onClick={() => setOpenId(openId === a.orgRoleId ? null : a.orgRoleId)}
                  aria-expanded={openId === a.orgRoleId}
                >
                  {openId === a.orgRoleId ? "Close" : "Details"}
                </button>
              </div>
              {openId === a.orgRoleId && detail && detail.account.orgRoleId === a.orgRoleId && (
                <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Run by: {detail.operators.length ? detail.operators.join(", ") : "nobody seated in the role yet"}
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-foreground flex flex-col gap-1 min-w-0 flex-1 basis-48">
                      Name members read
                      <input
                        className="border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm"
                        value={rename}
                        maxLength={120}
                        onChange={(e) => setRename(e.target.value)}
                      />
                    </label>
                    <button type="button" className="px-3 py-1 rounded-lg border border-border text-sm" onClick={() => saveName(a.orgRoleId)}>
                      Save name
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">Gatherings this venture runs</p>
                    {detail.services.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
                    <ul className="space-y-1">
                      {detail.services.map((s) => (
                        <li key={`${s.kind}:${s.id}`} className="flex items-center gap-2 text-sm text-foreground">
                          <span className="min-w-0 flex-1 truncate">{s.title ?? "A gathering that has been removed"}</span>
                          <button type="button" className="text-xs underline text-destructive" onClick={() => unlink(a.orgRoleId, s)}>
                            Take off
                          </button>
                        </li>
                      ))}
                    </ul>
                    {detail.gatherings.length > 0 ? (
                      <div className="flex flex-wrap items-end gap-2 mt-2">
                        <select
                          aria-label="A gathering with a seat fee"
                          className="border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm min-w-0 flex-1 basis-48"
                          value={gathering}
                          onChange={(e) => setGathering(e.target.value)}
                        >
                          <option value="">Choose a gathering with a seat fee</option>
                          {detail.gatherings
                            .filter((g) => !detail.services.some((s) => s.id === g.id))
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.title}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          disabled={!gathering}
                          className="px-3 py-1 rounded-lg border border-border text-sm disabled:opacity-50"
                          onClick={() => link(a.orgRoleId)}
                        >
                          Link
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">No gathering asks a seat fee yet.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">History</p>
                    {detail.history.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nothing has moved yet.</p>
                    ) : (
                      <ul className="text-xs space-y-1">
                        {detail.history.map((h) => (
                          <li key={h.id} className="flex flex-wrap gap-x-3 text-foreground">
                            <span className="text-muted-foreground">{new Date(h.at).toLocaleDateString()}</span>
                            <span className={h.amount < 0 ? "text-destructive" : "text-open"}>
                              {h.amount < 0 ? "-" : "+"}
                              {formatTokenAmount(Math.abs(h.amount), h.decimals)} {h.tokenName}
                            </span>
                            <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                              {h.withName ? `${h.amount < 0 ? "to" : "from"} ${h.withName}` : h.source}
                              {h.description ? `: ${h.description}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
