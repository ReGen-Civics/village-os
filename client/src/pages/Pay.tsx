/**
 * /pay: send credits to somebody, and receive them.
 *
 * The lead, 23 Nov 2026: members spend credits with each other and with
 * ventures; only ventures redeem, so this page has no cash-out; credits never
 * expire, so it shows no expiry; and one credit is worth what the village set,
 * shown beside every amount in the member's own currency.
 *
 * Phone first: one step at a time, Pay and Receive as two tabs, the next act
 * within thumb reach. From `lg` up both halves sit side by side and the pad
 * takes the keyboard. Any page may open it: `/pay` to pay, `/pay?tab=receive`
 * for the member's code, and a request link (`/pay?to=@handle&amount=5`,
 * shared/payLink.ts) opens it with the person, and the amount if any, filled in.
 *
 * Sending goes through `POST /api/wallet/send`, the one member-send door (a
 * single `postTransfer`, the client's nonce as its idempotency key). The reads
 * are `server/routes/pay.ts`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { gameFetch } from "@/lib/gameApi";
import { chosenDisplayCurrency, useDisplayRates } from "@/lib/workPay";
import { formatDate } from "@/i18n/format";
import { getFormattingLocale } from "@/i18n/i18n";
import { BreathingLoader } from "@/components/natural";
import { CARD, CHIP, CHIP_SOFT, EYEBROW, H1, HINT, LEDE, LINK, WORLD } from "@/components/journey/look";
import { parsePayLink, type Payee, type PayRequest } from "@shared/payLink";
import { AmountLine, AmountStep, ConfirmStep, ReceiptStep, WhoStep, type MoneyContext, type PayReceipt } from "@/components/pay/PaySteps";
import ReceivePanel from "@/components/pay/ReceivePanel";
import ScanLink from "@/components/pay/ScanLink";
import { padPress, primaryCurrency, typedMinor, type PaySummary } from "@/components/pay/payMoney";

type Step = "who" | "amount" | "confirm" | "done";
type Tab = "pay" | "receive";

const errorOf = async (r: Response, fallback: string): Promise<string> => {
  const d = await r.json().catch(() => null);
  return String(d?.error ?? "") || fallback;
};

export default function Pay() {
  const { t } = useLingui();
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const search = useSearch();
  const opened = useMemo(() => parsePayLink(`?${search}`), [search]);
  const askedTab: Tab = new URLSearchParams(search).get("tab") === "receive" ? "receive" : "pay";

  const [summary, setSummary] = useState<PaySummary | null>(null);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [recent, setRecent] = useState<Payee[]>([]);
  const [tab, setTab] = useState<Tab>(askedTab);
  const [step, setStep] = useState<Step>("who");
  const [slug, setSlug] = useState<string>("");
  const [payee, setPayee] = useState<Payee | null>(null);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Payee[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchProblem, setSearchProblem] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [linkProblem, setLinkProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendProblem, setSendProblem] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PayReceipt | null>(null);
  /**
   * ONE NONCE PER PAYMENT, minted when a new payment starts and never on a
   * retry, so a second press or a retry after a dropped connection posts once.
   * The ledger's unique index on the key is what makes that true.
   */
  const [nonce, setNonce] = useState(() => crypto.randomUUID());
  const rates = useDisplayRates();
  const locale = getFormattingLocale();

  const loadSummary = useCallback(async () => {
    try {
      const r = await gameFetch("/api/pay");
      if (!r.ok) throw new Error(await errorOf(r, ""));
      const d: PaySummary = await r.json();
      setSummary(d);
      setSlug((s) => s || d.tokens[0]?.slug || "");
    } catch {
      setLoadProblem(t({ context: "pay page", message: "Your credits did not load. Try again in a moment." }));
    }
  }, [t]);

  useEffect(() => {
    if (!user) return;
    void loadSummary();
    gameFetch("/api/pay/recent")
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((d) => setRecent(Array.isArray(d.people) ? d.people : []))
      .catch(() => setRecent([]));
  }, [user?.id, loadSummary]);

  /** Open a request link: find who it names, then go to the pad with what it asked filled in. */
  const openRequest = useCallback(
    async (req: PayRequest) => {
      setScanOpen(false);
      setLinkProblem(null);
      if (!req.to) return;
      const r = await gameFetch(`/api/pay/resolve?to=${encodeURIComponent(req.to.kind === "org" ? `org:${req.to.ref}` : `@${req.to.ref}`)}`);
      if (!r.ok) {
        setLinkProblem(await errorOf(r, t({ context: "pay page", message: "That link did not open. Ask them to share it again." })));
        return;
      }
      const d = await r.json();
      setTab("pay");
      setPayee(d.payee);
      setTyped(req.amount ?? "");
      setNote(req.note ?? "");
      setReceipt(null);
      setNonce(crypto.randomUUID());
      setStep("amount");
    },
    [t],
  );

  // A link in the address bar is opened once, as soon as somebody is signed in.
  const openedOnce = useRef(false);
  useEffect(() => {
    if (!user || openedOnce.current || !opened.to) return;
    openedOnce.current = true;
    void openRequest(opened);
  }, [user?.id, opened, openRequest]);

  // Search a little after the member stops typing.
  useEffect(() => {
    const q = query.replace(/^@+/, "").trim();
    setSearchProblem(null);
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let alive = true;
    const timer = window.setTimeout(async () => {
      try {
        const r = await gameFetch(`/api/pay/people?q=${encodeURIComponent(q)}`);
        if (!alive) return;
        if (!r.ok) {
          setResults([]);
          setSearchProblem(await errorOf(r, t({ context: "pay page", message: "The search did not answer. Try again in a moment." })));
        } else {
          const d = await r.json();
          setResults(Array.isArray(d.people) ? d.people : []);
        }
      } catch {
        if (alive) setSearchProblem(t({ context: "pay page", message: "The search did not answer. Try again in a moment." }));
      } finally {
        if (alive) setSearching(false);
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, t]);

  const token = summary?.tokens.find((x) => x.slug === slug) ?? summary?.tokens[0] ?? null;
  const minor = token ? typedMinor(typed, token.decimals) : 0;
  const money: MoneyContext = {
    target: primaryCurrency({
      chosenHere: chosenDisplayCurrency(),
      saved: summary?.displayCurrency ?? null,
      village: summary?.villageCurrency ?? null,
      face: token?.face?.currency ?? null,
    }),
    rates: rates?.rates ?? null,
    locale,
  };

  const pick = (p: Payee) => {
    setPayee(p);
    setStep("amount");
    setReceipt(null);
    setSendProblem(null);
    setNonce(crypto.randomUUID());
  };
  const onKey = useCallback((k: string) => setTyped((cur) => padPress(cur, k, token?.decimals ?? 0)), [token?.decimals]);
  const toConfirm = useCallback(() => {
    setSendProblem(null);
    setStep("confirm");
  }, []);
  const restart = () => {
    setStep("who");
    setPayee(null);
    setTyped("");
    setNote("");
    setQuery("");
    setReceipt(null);
    setSendProblem(null);
    setNonce(crypto.randomUUID());
  };

  const send = async () => {
    if (!payee || !token || busy) return;
    setBusy(true);
    setSendProblem(null);
    try {
      // A member by id; a venture by its own field, so a server that does not know ventures yet refuses it plainly.
      const who = payee.kind === "org" ? { toOrg: payee.id } : { to: payee.id };
      const r = await gameFetch("/api/wallet/send", {
        method: "POST",
        body: JSON.stringify({ ...who, tokenType: token.slug, amount: minor, note: note.trim(), clientNonce: nonce }),
      });
      if (!r.ok) {
        // The server's sentence, verbatim: it knows the balance and the rule.
        setSendProblem(await errorOf(r, t({ context: "pay page", message: "That payment did not go through." })));
        return;
      }
      const d = await r.json();
      setReceipt({
        sentMinor: Number(d.sent ?? minor),
        toName: String(d.to ?? payee.name),
        balanceMinor: Number(d.balance ?? token.balance - minor),
        note: note.trim(),
        at: new Date(),
      });
      setStep("done");
      setRecent((list) => [payee, ...list.filter((p) => !(p.kind === payee.kind && p.id === payee.id))].slice(0, 8));
      void loadSummary();
    } catch {
      setSendProblem(t({ context: "pay page", message: "That did not reach the village. Press send again: it will only go once." }));
    } finally {
      setBusy(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const signedOut = !!auth && !auth.loading && !user;
  const tabButton = (id: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`jw-btn min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold ${tab === id ? "bg-notice text-background" : "text-muted-foreground hover:bg-muted"}`}
    >
      {label}
    </button>
  );

  return (
    <Layout>
      <div className={`${WORLD} py-6 sm:py-12`}>
        <div className="mx-auto max-w-6xl space-y-6 px-4">
          <header className="space-y-2">
            <p className={EYEBROW}>{t({ context: "pay page", message: "Credits" })}</p>
            <h1 className={H1}>{t({ context: "pay page title", message: "Pay and receive" })}</h1>
            {token ? (
              <p className={LEDE}>
                <span className="text-muted-foreground">{t({ context: "pay page, balance line", message: "You hold" })} </span>
                <AmountLine minor={token.balance} token={token} money={money} />
              </p>
            ) : (
              <p className={LEDE}>{t({ context: "pay page", message: "Pay someone here for a jar of honey, a haircut, an afternoon of help." })}</p>
            )}
          </header>

          {signedOut ? (
            <div className={CARD}>
              <p className={HINT}>
                {t({ context: "pay page", message: "Sign in to pay and receive credits." })}{" "}
                <Link href={`/login?next=${encodeURIComponent(`/pay${search ? `?${search}` : ""}`)}`} className={LINK}>
                  {t({ context: "pay page, link", message: "Sign in" })}
                </Link>
              </p>
            </div>
          ) : !summary ? (
            loadProblem ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {loadProblem}
              </p>
            ) : (
              <div className="flex justify-center py-16">
                <BreathingLoader label={t({ context: "pay page", message: "Loading your credits" })} />
              </div>
            )
          ) : !token ? (
            <div className={CARD}>
              <p className={HINT}>{t({ context: "pay page", message: "This village has not opened sending credits between people yet." })}</p>
            </div>
          ) : (
            <>
              <div role="tablist" aria-label={t({ context: "pay page", message: "Pay or receive" })} className="flex gap-1 rounded-xl border border-border bg-card p-1 lg:hidden">
                {tabButton("pay", t({ context: "pay page tab", message: "Pay" }))}
                {tabButton("receive", t({ context: "pay page tab", message: "Receive" }))}
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
                <section aria-labelledby="pay-h" className={`${CARD} ${tab === "pay" ? "" : "hidden lg:block"}`}>
                  <h2 id="pay-h" className="sr-only">
                    {t({ context: "pay page tab", message: "Pay" })}
                  </h2>
                  {summary.tokens.length > 1 && step !== "done" && (
                    <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-label={t({ context: "pay page", message: "Which credits" })}>
                      {summary.tokens.map((x) => (
                        <button key={x.slug} type="button" role="radio" aria-checked={x.slug === token.slug} onClick={() => setSlug(x.slug)} className={`jw-btn min-h-11 ${x.slug === token.slug ? CHIP : CHIP_SOFT}`}>
                          {x.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {linkProblem && (
                    <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {linkProblem}
                    </p>
                  )}
                  {step === "who" && (
                    <div className="space-y-6">
                      <WhoStep
                        query={query}
                        onQuery={setQuery}
                        results={results}
                        searching={searching}
                        searchProblem={searchProblem}
                        recent={recent}
                        onPick={pick}
                        onScan={() => setScanOpen((o) => !o)}
                      />
                      {scanOpen && <ScanLink onFound={openRequest} onClose={() => setScanOpen(false)} />}
                    </div>
                  )}
                  {step === "amount" && payee && (
                    <AmountStep
                      payee={payee}
                      token={token}
                      typed={typed}
                      minor={minor}
                      note={note}
                      onKey={onKey}
                      onNote={setNote}
                      onNext={toConfirm}
                      onChangePayee={restart}
                      money={money}
                    />
                  )}
                  {step === "confirm" && payee && (
                    <ConfirmStep
                      payee={payee}
                      token={token}
                      minor={minor}
                      note={note}
                      busy={busy}
                      problem={sendProblem}
                      onSend={send}
                      onBack={() => setStep("amount")}
                      money={money}
                    />
                  )}
                  {step === "done" && receipt && (
                    <ReceiptStep
                      receipt={receipt}
                      token={token}
                      money={money}
                      onAgain={restart}
                      dateText={formatDate(receipt.at, { dateStyle: "medium", timeStyle: "short" })}
                    />
                  )}
                </section>
                <div className={tab === "receive" ? "" : "hidden lg:block"}>
                  <ReceivePanel me={summary.me} token={token} target={money.target} rates={money.rates} locale={locale} origin={origin} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
