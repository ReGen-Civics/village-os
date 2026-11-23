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
import { Trans, useLingui } from "@lingui/react/macro";
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

/** Every balance in one list of parts, in the village's own token names. Empty when nothing is held. */
export function balanceParts(a: Pick<OrgAccountView, "balances" | "decimals" | "tokenNames">): string[] {
  return Object.entries(a.balances ?? {})
    .filter(([, v]) => Number(v) !== 0)
    .map(([slug, v]) => `${formatTokenAmount(v, a.decimals?.[slug] ?? 0)} ${a.tokenNames?.[slug] ?? slug}`);
}

/**
 * The list read, taken apart field by field. A body of any other shape (an
 * older server, a stubbed fetch, a proxy page) reads as no accounts and both
 * doors shut, so the panel draws its empty state instead of throwing inside
 * the Tokens tab and taking the registry above it down too.
 */
export function listFrom(d: unknown): ListBody {
  const o = d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
  return {
    accounts: Array.isArray(o.accounts) ? (o.accounts as OrgAccountView[]) : [],
    roles: Array.isArray(o.roles) ? (o.roles as ListBody["roles"]) : [],
    open: o.open === true,
    routing: o.routing === true,
  };
}

/** The path comes first, so the admin-reach guard can read which route each call reaches. */
async function call(path: string, password: string, method: string, body?: unknown): Promise<any> {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(password, body === undefined ? {} : { "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(refusal(d, ""));
  return d;
}

export default function OrgAccountsPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [list, setList] = useState<ListBody | null>(null);
  const [error, setError] = useState("");
  const [roleId, setRoleId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailBody | null>(null);
  const [rename, setRename] = useState("");
  const [gathering, setGathering] = useState("");

  const said = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

  const load = useCallback(async () => {
    try {
      setList(listFrom(await call("/admin/org-accounts", password, "GET")));
      setError("");
    } catch (e) {
      setError(said(e, t`The accounts could not be read.`));
    }
  }, [password, t]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const raw = await call(`/admin/org-accounts/${encodeURIComponent(id)}`, password, "GET");
        if (!raw || typeof raw !== "object" || !raw.account) throw new Error("");
        const d: DetailBody = {
          account: raw.account,
          history: Array.isArray(raw.history) ? raw.history : [],
          services: Array.isArray(raw.services) ? raw.services : [],
          operators: Array.isArray(raw.operators) ? raw.operators : [],
          gatherings: Array.isArray(raw.gatherings) ? raw.gatherings : [],
        };
        setDetail(d);
        setRename(d.account.label);
      } catch (e) {
        toast.error(said(e, t`That account could not be read.`));
      }
    },
    [password, t],
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
      await call("/admin/org-accounts", password, "POST", { orgRoleId: roleId, label: label.trim() || undefined });
      toast.success(t({ message: "Account opened", context: "admin venture accounts" }));
      setRoleId("");
      setLabel("");
      await load();
    } catch (e) {
      toast.error(said(e, t`The account could not be opened.`));
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (id: string) => {
    try {
      await call(`/admin/org-accounts/${encodeURIComponent(id)}`, password, "PUT", { label: rename });
      toast.success(t({ message: "Name saved", context: "admin venture accounts" }));
      await Promise.all([load(), loadDetail(id)]);
    } catch (e) {
      toast.error(said(e, t`The name could not be saved.`));
    }
  };

  const link = async (id: string) => {
    if (!gathering) return;
    try {
      await call(`/admin/org-accounts/${encodeURIComponent(id)}/services`, password, "POST", { kind: "event", id: gathering });
      setGathering("");
      await loadDetail(id);
    } catch (e) {
      toast.error(said(e, t`The gathering could not be linked.`));
    }
  };

  const unlink = async (id: string, s: OrgServiceLink) => {
    try {
      await call(`/admin/org-accounts/${encodeURIComponent(id)}/services/${s.kind}/${encodeURIComponent(s.id)}`, password, "DELETE");
      await loadDetail(id);
    } catch (e) {
      toast.error(said(e, t`The gathering could not be taken off.`));
    }
  };

  return (
    <section aria-labelledby="org-accounts-h" className="bg-card border border-border rounded-xl p-5 mb-6">
      <h3 id="org-accounts-h" className="font-semibold text-foreground mb-1">
        <Trans context="admin venture accounts">Venture accounts</Trans>
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        <Trans>
          Members spend credits, and ventures redeem them. A venture's account holds what members pay it. The people seated in the
          venture's role see its balance and history. An account never closes and its credits never expire.
        </Trans>
      </p>
      {list && (
        <ul className="text-xs text-muted-foreground mb-4 space-y-1">
          <li>
            {list.open ? t`Members can pay venture accounts now.` : t`Members cannot pay venture accounts yet. You can open accounts first.`}{" "}
            <a className="underline text-teal-deep" href="/admin?tab=variables&variable=ledger.org_accounts_open">
              {list.open ? t({ message: "Change", context: "admin venture accounts" }) : t({ message: "Turn it on", context: "admin venture accounts" })}
            </a>
          </li>
          <li>
            {list.routing
              ? t`Seat fees for a venture's own gatherings go to the venture.`
              : t`Seat fees go to the village treasury, including for a venture's gatherings.`}{" "}
            <a className="underline text-teal-deep" href="/admin?tab=variables&variable=ledger.org_service_routing">
              {t({ message: "Change", context: "admin venture accounts" })}
            </a>
          </li>
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!list && !error && (
        <p className="text-sm text-muted-foreground">
          <Trans context="admin venture accounts">Loading...</Trans>
        </p>
      )}

      {list && (
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <label className="text-sm text-foreground flex flex-col gap-1 min-w-0 flex-1 basis-48">
            <Trans context="admin venture accounts">Venture role</Trans>
            <select
              className="border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">{t({ message: "Choose a role", context: "admin venture accounts" })}</option>
              {list.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.futureVenture ? t({ message: `${r.name} (future venture)`, context: "admin venture accounts" }) : r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-foreground flex flex-col gap-1 min-w-0 flex-1 basis-40">
            <Trans>Name members read (optional)</Trans>
            <input
              className="border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
              value={label}
              maxLength={120}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t({ message: "The role's name", context: "admin venture accounts" })}
            />
          </label>
          <button
            type="button"
            disabled={!roleId || busy}
            onClick={openAccount}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
          >
            <Trans context="admin venture accounts">Open account</Trans>
          </button>
        </div>
      )}

      {list && list.accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          <Trans>No venture holds an account yet.</Trans>
        </p>
      )}
      {list && list.accounts.length > 0 && (
        <ul className="divide-y divide-border">
          {list.accounts.map((a) => {
            const parts = balanceParts(a);
            return (
              <li key={a.orgRoleId} className="py-3">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-medium text-foreground">{a.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.roleName ? t({ message: `Role: ${a.roleName}`, context: "admin venture accounts" }) : t`Its role is gone from the org chart`}
                    </p>
                  </div>
                  <p className="text-sm text-foreground basis-40">{parts.length ? parts.join(", ") : t({ message: "Nothing held yet", context: "admin venture accounts" })}</p>
                  <button
                    type="button"
                    className="text-sm underline text-teal-deep"
                    onClick={() => setOpenId(openId === a.orgRoleId ? null : a.orgRoleId)}
                    aria-expanded={openId === a.orgRoleId}
                  >
                    {openId === a.orgRoleId ? t({ message: "Close", context: "admin venture accounts" }) : t({ message: "Details", context: "admin venture accounts" })}
                  </button>
                </div>
                {openId === a.orgRoleId && detail && detail.account.orgRoleId === a.orgRoleId && (
                  <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      {detail.operators.length ? t({ message: `Run by: ${detail.operators.join(", ")}`, context: "admin venture accounts" }) : t`Nobody is seated in the role yet.`}
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-xs text-foreground flex flex-col gap-1 min-w-0 flex-1 basis-48">
                        <Trans context="admin venture accounts">Name members read</Trans>
                        <input
                          className="border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm"
                          value={rename}
                          maxLength={120}
                          onChange={(e) => setRename(e.target.value)}
                        />
                      </label>
                      <button type="button" className="px-3 py-1 rounded-lg border border-border text-sm" onClick={() => saveName(a.orgRoleId)}>
                        <Trans context="admin venture accounts">Save name</Trans>
                      </button>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground mb-1">
                        <Trans>Gatherings this venture runs</Trans>
                      </p>
                      {detail.services.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          <Trans context="admin venture accounts">None yet.</Trans>
                        </p>
                      )}
                      <ul className="space-y-1">
                        {detail.services.map((s) => (
                          <li key={`${s.kind}:${s.id}`} className="flex items-center gap-2 text-sm text-foreground">
                            <span className="min-w-0 flex-1 truncate">{s.title ?? t`A gathering that has been removed`}</span>
                            <button type="button" className="text-xs underline text-destructive" onClick={() => unlink(a.orgRoleId, s)}>
                              <Trans context="admin venture accounts">Take off</Trans>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {detail.gatherings.length > 0 ? (
                        <div className="flex flex-wrap items-end gap-2 mt-2">
                          <select
                            aria-label={t`A gathering with a seat fee`}
                            className="border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm min-w-0 flex-1 basis-48"
                            value={gathering}
                            onChange={(e) => setGathering(e.target.value)}
                          >
                            <option value="">{t`Choose a gathering with a seat fee`}</option>
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
                            <Trans context="admin venture accounts">Link</Trans>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          <Trans>No gathering asks a seat fee yet.</Trans>
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground mb-1">
                        <Trans context="admin venture accounts">History</Trans>
                      </p>
                      {detail.history.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          <Trans>Nothing has moved yet.</Trans>
                        </p>
                      ) : (
                        <ul className="text-xs space-y-1">
                          {detail.history.map((h) => {
                            const amount = `${h.amount < 0 ? "-" : "+"}${formatTokenAmount(Math.abs(h.amount), h.decimals)} ${h.tokenName}`;
                            const who = h.withName ? (h.amount < 0 ? t({ message: `to ${h.withName}`, context: "admin venture accounts" }) : t({ message: `from ${h.withName}`, context: "admin venture accounts" })) : h.source;
                            return (
                              <li key={h.id} className="flex flex-wrap gap-x-3 text-foreground">
                                <span className="text-muted-foreground">{new Date(h.at).toLocaleDateString()}</span>
                                <span className={h.amount < 0 ? "text-destructive" : "text-open"}>{amount}</span>
                                <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                                  {h.description ? `${who}: ${h.description}` : who}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
