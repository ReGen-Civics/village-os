/**
 * The ventures you run, what each one holds, and redeeming it (0419, 0420;
 * credits lanes 1 and 2).
 *
 * Members spend credits, and only ventures redeem them (the lead, 23 Nov
 * 2026). A member seated in a venture's role runs that venture, so this card
 * shows them the venture's balance and its payments in and out, on their own
 * Treasury tab beside their wallet, and, once the village opens the door
 * (`ledger.org_redemption_open`), a Redeem action: how many credits, which
 * currency, and where the money should go. The Treasury pays outside the
 * platform and confirms; until then the request waits and can be cancelled.
 *
 * THE TREASURY'S QUEUE LIVES IN THIS FILE TOO, as a second section, so the
 * Profile chunk carries one more component and the page makes one more
 * request, never a new chunk: the dist budget is block-charged. It asks the
 * gated queue route only when the member route hints the viewer may hold the
 * redemption key (`mayConfirm`), so an ordinary member never takes a refused
 * request (ruling 28). The queue route still runs the gate.
 *
 * Renders nothing when the member runs no venture with an account and keeps
 * no redemption queue.
 */
import { useCallback, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Store } from "lucide-react";
import { authToken } from "@/lib/gameApi";
import { useAuth } from "@/contexts/AuthContext";
import { formatTokenGrouped } from "@/lib/tokenAmount";
import { formatMoney } from "@shared/money";
import type { OrgAccountEntry, OrgAccountView } from "@shared/orgAccounts";
import type { OrgRedemptionTerms, OrgRedemptionView } from "@shared/orgRedemptions";
import { BTN_NOTICE, BTN_PRIMARY, BTN_SECONDARY, CARD, FIELD, H2, HINT, LABEL, QUIET, TILE } from "@/components/journey/look";

interface Mine {
  account: OrgAccountView;
  history: OrgAccountEntry[];
}
interface Redeeming {
  terms: OrgRedemptionTerms;
  ventures: Array<{ orgRoleId: string; label: string; history: OrgRedemptionView[]; redeemed: Array<{ currency: string; text: string }> }>;
  tokens: Array<{ slug: string; name: string; decimals: number }>;
  mayConfirm: boolean;
}
interface Queue {
  /** Whether this reader holds the redemption key. An admin reading while nobody does cannot decide. */
  holdsKey: boolean;
  waiting: OrgRedemptionView[];
  decided: OrgRedemptionView[];
}

const headers = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
};
const getJson = (url: string) =>
  fetch(url, { headers: headers() })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
const postJson = async (url: string, body: unknown): Promise<{ ok: boolean; json: any }> => {
  const r = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  return { ok: r.ok, json: await r.json().catch(() => null) };
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");

export default function VentureAccountsCard() {
  const { user } = useAuth();
  const { t } = useLingui();
  const [mine, setMine] = useState<Mine[]>([]);
  const [redeeming, setRedeeming] = useState<Redeeming | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);

  const load = useCallback(() => {
    getJson("/api/org-accounts/mine").then((d) => setMine(Array.isArray(d?.accounts) ? d.accounts : []));
    getJson("/api/org-redemptions/mine").then((d: Redeeming | null) => {
      setRedeeming(d);
      if (d?.mayConfirm) getJson("/api/admin/org-redemptions").then((q) => setQueue(q && Array.isArray(q.waiting) ? q : null));
    });
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;
  const showQueue = !!queue && (queue.waiting.length > 0 || queue.decided.length > 0);
  if (mine.length === 0 && !showQueue) return null;

  return (
    <>
      {mine.length > 0 && (
        <section id="ventures" aria-labelledby="ventures-h" className={`${CARD} scroll-mt-28`}>
          <h2 id="ventures-h" className={`${H2} flex items-center gap-2`}>
            <Store className="h-5 w-5 text-notice" aria-hidden="true" />
            {mine.length === 1 ? t`The venture you run` : t`The ventures you run`}
          </h2>
          <p className={`${HINT} mt-1`}>
            <Trans>What members have paid each venture. Its credits never expire.</Trans>
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {mine.map(({ account, history }) => {
              const held = Object.entries(account.balances).filter(([, v]) => Number(v) !== 0);
              const r = redeeming?.ventures.find((v) => v.orgRoleId === account.orgRoleId);
              return (
                <article key={account.orgRoleId} className={TILE}>
                  <h3 className="font-display text-lg font-bold text-card-foreground">{account.label}</h3>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {held.length
                      ? held
                          .map(([slug, v]) => `${formatTokenGrouped(v, account.decimals[slug] ?? 0)} ${account.tokenNames[slug] ?? slug}`)
                          .join(", ")
                      : t({ message: "Nothing held yet", context: "profile ventures you run" })}
                  </p>
                  {redeeming && r && (
                    <RedeemDoor account={account} venture={r} redeeming={redeeming} onDone={load} />
                  )}
                  {history.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2" aria-label={t({ message: `Payments for ${account.label}`, context: "profile ventures you run" })}>
                      {history.slice(0, 10).map((h) => (
                        <li key={h.id} className={`${QUIET} flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm`}>
                          <span className={h.amount < 0 ? "font-semibold text-destructive" : "font-semibold text-open"}>
                            {h.amount < 0 ? "-" : "+"}
                            {formatTokenGrouped(Math.abs(h.amount), h.decimals)} {h.tokenName}
                          </span>
                          <span className="order-last min-w-0 basis-full text-foreground sm:order-none sm:basis-0 sm:flex-1">
                            {h.source === "org_redemption_hold"
                              ? t({ message: "Held for a redemption", context: "profile ventures you run" })
                              : h.source === "org_redemption_release"
                                ? t({ message: "Back from a redemption", context: "profile ventures you run" })
                                : <>
                                    {h.withName ? (h.amount < 0 ? t({ message: `to ${h.withName}`, context: "profile ventures you run" }) : t({ message: `from ${h.withName}`, context: "profile ventures you run" })) : h.amount < 0 ? t({ message: "paid out", context: "profile ventures you run" }) : t({ message: "received", context: "profile ventures you run" })}
                                    {h.description ? `: ${h.description}` : ""}
                                  </>}
                          </span>
                          <time className="ml-auto text-xs text-muted-foreground" dateTime={h.at}>
                            {new Date(h.at).toLocaleDateString()}
                          </time>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {showQueue && queue && <TreasuryQueue queue={queue} onDone={load} />}
    </>
  );
}

/** The words for a redemption's state, keyed by the union so a new state cannot render blank. */
function useStateWords() {
  const { t } = useLingui();
  return {
    requested: t({ message: "Waiting for the Treasury", context: "venture redemption state" }),
    confirmed: t({ message: "Paid and confirmed", context: "venture redemption state" }),
    refused: t({ message: "Not redeemed", context: "venture redemption state" }),
    cancelled: t({ message: "Cancelled", context: "venture redemption state" }),
  } satisfies Record<OrgRedemptionView["state"], string>;
}

function RedeemDoor({ account, venture, redeeming, onDone }: { account: OrgAccountView; venture: Redeeming["ventures"][number]; redeeming: Redeeming; onDone: () => void }) {
  const { t } = useLingui();
  const words = useStateWords();
  const { terms } = redeeming;
  const tokens = redeeming.tokens.filter((tk) => Number(account.balances[tk.slug] ?? 0) > 0);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(tokens[0]?.slug ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(terms.currencies[0] ?? "USD");
  const [payTo, setPayTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const rate = terms.rateMinor[currency];
  const n = Number(amount);
  const gross = rate != null && n > 0 ? formatMoney(Math.round(n * rate), currency) : null;

  const submit = async () => {
    setBusy(true);
    setError("");
    const r = await postJson("/api/org-redemptions", { orgRoleId: account.orgRoleId, token, amount: n, currency, ...(terms.canSealDetails ? { payTo } : { payRef: payTo }) });
    setBusy(false);
    if (!r.ok) return setError(String(r.json?.error ?? t({ message: "That did not go through.", context: "venture redemption" })));
    setNotice(t({ message: `Asked. The Treasury pays ${r.json?.redemption?.grossText ?? ""} to where you said, then confirms.`, context: "venture redemption" }));
    setOpen(false);
    setAmount("");
    setPayTo("");
    onDone();
  };
  const cancel = async (id: string) => {
    const r = await postJson(`/api/org-redemptions/${id}/cancel`, {});
    if (!r.ok) setError(String(r.json?.error ?? ""));
    onDone();
  };

  return (
    <div className="mt-3 flex flex-col gap-3">
      {terms.open && tokens.length > 0 && !open && (
        <button type="button" className={`${BTN_NOTICE} self-start`} onClick={() => setOpen(true)}>
          {t({ message: "Redeem", context: "venture redemption button" })}
        </button>
      )}
      {notice && <p className="text-sm font-medium text-open" role="status">{notice}</p>}
      {open && (
        <form
          className={`${QUIET} flex flex-col gap-3`}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className={HINT}>
            {t({ message: `One credit is worth ${formatMoney(terms.rateMinor[terms.pegCurrency] ?? 0, terms.pegCurrency)}. Ventures together can redeem ${terms.leftCredits} more credits this moon.`, context: "venture redemption" })}
          </p>
          {tokens.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t({ message: "Which credits", context: "venture redemption" })}</span>
              <select className={FIELD} value={token} onChange={(e) => setToken(e.target.value)}>
                {tokens.map((tk) => (
                  <option key={tk.slug} value={tk.slug}>{tk.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t({ message: "How many credits", context: "venture redemption" })}</span>
              <input className={FIELD} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t({ message: "Paid in", context: "venture redemption currency" })}</span>
              <select className={FIELD} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {terms.currencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          {terms.canSealDetails ? (
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t({ message: "Where the money should go", context: "venture redemption" })}</span>
              <textarea className={FIELD} rows={2} maxLength={300} value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder={t({ message: "The account, and the name on it", context: "venture redemption" })} required />
              <span className={HINT}>{t({ message: "Kept sealed. Only the people who run this venture and the Treasury see it in full.", context: "venture redemption" })}</span>
            </label>
          ) : (
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t({ message: "Payment reference", context: "venture redemption" })}</span>
              <input className={FIELD} maxLength={200} value={payTo} onChange={(e) => setPayTo(e.target.value)} required />
              <span className={HINT}>{t({ message: "This village cannot keep account details safely yet. Give a reference the Treasury can look up, such as an invoice number.", context: "venture redemption" })}</span>
            </label>
          )}
          {terms.confirmers === 0 && (
            <p className={HINT}>{t({ message: "Nobody holds the redemption key yet, so a request waits until the village gives it to someone.", context: "venture redemption" })}</p>
          )}
          <p className="text-sm text-foreground" aria-live="polite">
            {gross
              ? t({ message: `The Treasury pays ${gross}.`, context: "venture redemption" })
              : rate == null
                ? t({ message: `There is no daily rate for ${currency} today.`, context: "venture redemption" })
                : ""}
          </p>
          {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={BTN_PRIMARY} disabled={busy || !(n > 0) || !payTo.trim()}>
              {t({ message: "Ask to redeem", context: "venture redemption" })}
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(false)}>
              {t({ message: "Not now", context: "venture redemption" })}
            </button>
          </div>
        </form>
      )}
      {!open && error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
      {venture.history.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t({ message: `Redemptions for ${account.label}`, context: "venture redemption" })}>
          {venture.history.slice(0, 5).map((h) => (
            <li key={h.id} className={`${QUIET} flex flex-wrap items-center gap-x-3 gap-y-1 text-sm`}>
              <span className="font-semibold text-foreground">{h.credits} {h.tokenName}</span>
              <span className="text-foreground">{h.grossText}</span>
              {h.paidText && h.paidText !== h.grossText && <span className="text-foreground">{t({ message: `paid ${h.paidText}`, context: "venture redemption, what actually went out" })}</span>}
              <span className="text-muted-foreground">{words[h.state]}</span>
              {h.paymentRef && <span className="text-muted-foreground">{t({ message: `Ref ${h.paymentRef}`, context: "venture redemption payment reference" })}</span>}
              {h.state === "requested" && (
                <button type="button" className={`${BTN_SECONDARY} ml-auto`} onClick={() => void cancel(h.id)}>
                  {t({ message: "Cancel", context: "venture redemption" })}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {venture.redeemed.length > 0 && (
        <p className={HINT}>
          {t({ message: `Paid to this venture through redemption so far: ${venture.redeemed.map((m) => m.text).join(", ")}`, context: "venture redemption" })}
        </p>
      )}
    </div>
  );
}

function TreasuryQueue({ queue, onDone }: { queue: Queue; onDone: () => void }) {
  const { t } = useLingui();
  const words = useStateWords();
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [paid, setPaid] = useState<Record<string, string>>({});
  const [paidIn, setPaidIn] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  const act = async (id: string, to: "confirm" | "refuse") => {
    setBusy(id);
    const text = String(refs[id] ?? "");
    const r = await postJson(
      `/api/admin/org-redemptions/${id}/${to}`,
      to === "confirm" ? { paymentRef: text, paidAmount: paid[id] ?? "", paidCurrency: paid[id] ? paidIn[id] ?? "" : "" } : { note: text },
    );
    setBusy("");
    setErrors((e) => ({ ...e, [id]: r.ok ? "" : String(r.json?.error ?? "") }));
    if (r.ok) onDone();
  };

  return (
    <section id="venture-redemptions" aria-labelledby="venture-redemptions-h" className={`${CARD} scroll-mt-28`}>
      <h2 id="venture-redemptions-h" className={H2}>
        {t({ message: "Venture redemptions", context: "treasury queue heading" })}
      </h2>
      <p className={`${HINT} mt-1`}>
        <Trans>Pay each venture outside the platform first, then confirm with the payment's reference. Confirming destroys the held credits. Nobody who runs a venture can confirm its own.</Trans>
      </p>
      {!queue.holdsKey && (
        <p className={`${HINT} mt-2`}>{t({ message: "Nobody has given you the redemption key, so you can read this queue and cannot decide it. Only a holder of the key confirms a venture's redemption.", context: "treasury queue" })}</p>
      )}
      {queue.waiting.length === 0 && (
        <p className={`${HINT} mt-4`}>{t({ message: "Nothing is waiting.", context: "treasury queue" })}</p>
      )}
      <div className="mt-4 flex flex-col gap-4">
        {queue.waiting.map((w) => (
          <article key={w.id} className={TILE}>
            <h3 className="font-display text-lg font-bold text-card-foreground">{w.ventureLabel}</h3>
            <p className="mt-1 text-2xl font-bold text-foreground">{w.grossText}</p>
            <p className="text-sm text-foreground">
              {t({ message: `${w.credits} ${w.tokenName} at ${w.rateText} each`, context: "treasury queue" })}
              {w.fxRate != null ? t({ message: `, converted at ${w.fxRate.toFixed(4)} ${w.currency} per ${w.pegCurrency} (${w.fxAsOf ?? ""})`, context: "treasury queue" }) : ""}
            </p>
            <p className="mt-2 text-sm text-foreground">
              <span className={LABEL}>{t({ message: "Pay to:", context: "treasury queue" })}</span> <span className="break-words">{w.payTo ?? (w.payToLast4 ? `•••• ${w.payToLast4}` : t({ message: `Reference ${w.payRef ?? ""}`, context: "treasury queue, payment reference the venture gave" }))}</span>
            </p>
            <p className={`${HINT} mt-1`}>
              {t({ message: `Asked by ${w.requestedByName ?? w.requestedBy} on ${day(w.createdAt)}`, context: "treasury queue" })}
            </p>
            {queue.holdsKey && (
              <>
                <label className="mt-3 flex flex-col gap-1">
                  <span className={LABEL}>{t({ message: "Payment reference, or why not", context: "treasury queue" })}</span>
                  <input className={FIELD} value={refs[w.id] ?? ""} maxLength={200} onChange={(e) => setRefs((r) => ({ ...r, [w.id]: e.target.value }))} />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className={LABEL}>{t({ message: "What actually went out, if different", context: "treasury queue" })}</span>
                    <input className={FIELD} inputMode="decimal" value={paid[w.id] ?? ""} placeholder={w.grossText} onChange={(e) => setPaid((r) => ({ ...r, [w.id]: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={LABEL}>{t({ message: "Paid in", context: "treasury queue currency" })}</span>
                    <input className={FIELD} maxLength={3} value={paidIn[w.id] ?? w.currency} onChange={(e) => setPaidIn((r) => ({ ...r, [w.id]: e.target.value.toUpperCase() }))} />
                  </label>
                </div>
              </>
            )}
            {errors[w.id] && <p className="mt-2 text-sm font-medium text-destructive" role="alert">{errors[w.id]}</p>}
            {queue.holdsKey && <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={BTN_PRIMARY} disabled={busy === w.id || !(refs[w.id] ?? "").trim()} onClick={() => void act(w.id, "confirm")}>
                {t({ message: "Paid, confirm", context: "treasury queue button" })}
              </button>
              <button type="button" className={BTN_SECONDARY} disabled={busy === w.id || !(refs[w.id] ?? "").trim()} onClick={() => void act(w.id, "refuse")}>
                {t({ message: "Do not redeem", context: "treasury queue button" })}
              </button>
            </div>}
          </article>
        ))}
      </div>
      {queue.decided.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2" aria-label={t({ message: "Decided recently", context: "treasury queue" })}>
          {queue.decided.slice(0, 10).map((d) => (
            <li key={d.id} className={`${QUIET} flex flex-wrap items-center gap-x-3 gap-y-1 text-sm`}>
              <span className="font-semibold text-foreground">{d.ventureLabel}</span>
              <span className="text-foreground">{t({ message: `asked ${d.grossText}`, context: "treasury queue, what the venture asked for" })}</span>
              {d.paidText && (
                <span className="text-foreground">
                  {t({ message: `paid ${d.paidText}`, context: "venture redemption, what actually went out" })}
                  {d.paidFxRate != null ? ` (${d.paidFxRate.toFixed(4)} ${d.paidCurrency ?? ""}/${d.pegCurrency})` : ""}
                </span>
              )}
              <span className="text-muted-foreground">{words[d.state]}</span>
              {d.paymentRef && <span className="text-muted-foreground">{t({ message: `Ref ${d.paymentRef}`, context: "venture redemption payment reference" })}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{day(d.decidedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
