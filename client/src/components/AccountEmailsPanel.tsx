/**
 * YOUR EMAIL ADDRESSES (the lead, 24 Nov 2026): one account, more than one
 * address. A member adds a second address, a code goes to THAT address, and it
 * is attached once the code comes back. Sign-in works with any attached
 * address, and the member chooses where the village's mail goes: the main
 * address, the other one, or both.
 *
 * The server is the authority for every rule here (server/routes/memberEmails.ts);
 * this panel only shows what it answers and says its refusals in its own words.
 * Drawn in the profile's look (components/journey/look.ts, docs/DESIGN_RULE.md).
 */
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { authToken } from "@/lib/gameApi";
import { BTN_NOTICE, BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, FIELD, H2, HINT, LABEL, NOTE, QUIET, TICK } from "@/components/journey/look";
import { deliveryAddresses, type AccountEmails, type EmailDelivery } from "@shared/memberEmails";

const headers = (): Record<string, string> => {
  const t = authToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

export default function AccountEmailsPanel() {
  const { t } = useLingui();
  const [data, setData] = useState<AccountEmails | null>(null);
  const [adding, setAdding] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "wrong"; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/me/emails", { headers: headers() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  /** One call, its answer shown: the panel follows the server and never runs ahead of it. */
  const send = async (path: string, method: string, body?: unknown): Promise<any | null> => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch(path, { method, headers: headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setNote({ tone: "wrong", text: d?.error ?? t({ message: "That did not save. Try again.", context: "account emails: generic failure" }) });
        return null;
      }
      if (d?.emails) setData(d.emails);
      return d;
    } catch {
      setNote({ tone: "wrong", text: t({ message: "That did not reach the village. Check your connection and try again.", context: "account emails: network failure" }) });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const startAdding = async () => {
    const d = await send("/api/me/emails", "POST", { email: adding });
    if (!d) return;
    setData((cur) => (cur ? { ...cur, pending: d.pending } : cur));
    setAdding("");
    setNote({
      tone: "ok",
      text: d.emailed
        ? t({ message: `We sent a code to ${d.pending.email}. Enter it below.`, context: "account emails: code sent" })
        : t({ message: "The code could not be sent from this village right now. Try again later, or ask a steward to check the email settings.", context: "account emails: code not sent" }),
    });
  };

  const confirm = async () => {
    const d = await send("/api/me/emails/confirm", "POST", { code });
    if (!d) return;
    setCode("");
    setNote({ tone: "ok", text: t({ message: "Address added. You can sign in with it now.", context: "account emails: attached" }) });
  };

  const remove = async (email: string) => {
    if (!window.confirm(t({ message: `Remove ${email} from your account? You will no longer be able to sign in with it.`, context: "account emails: confirm remove" }))) return;
    if (await send(`/api/me/emails/${encodeURIComponent(email)}`, "DELETE")) {
      setNote({ tone: "ok", text: t({ message: "Address removed.", context: "account emails: removed" }) });
    }
  };

  const makeMain = async (email: string) => {
    if (await send("/api/me/emails/main", "POST", { email })) {
      setNote({ tone: "ok", text: t({ message: `${email} is now your main address.`, context: "account emails: main changed" }) });
    }
  };

  const choose = async (delivery: EmailDelivery, to?: string) => {
    if (await send("/api/me/emails/delivery", "PUT", { delivery, ...(to ? { to } : {}) })) {
      setNote({ tone: "ok", text: t({ message: "Saved. Your email will go where you chose.", context: "account emails: delivery saved" }) });
    }
  };

  const resendProof = async () => {
    const d = await send("/api/auth/verify-email/send", "POST", {});
    if (!d) return;
    setNote({
      tone: "ok",
      text: d.already
        ? t({ message: "Your main address is already confirmed. Reload the page to add another.", context: "account emails: proof already" })
        : d.emailed
          ? t({ message: "A confirmation email is on its way to your main address.", context: "account emails: proof sent" })
          : t({ message: "The village could not send the email just now. Try again later.", context: "account emails: proof not sent" }),
    });
  };

  if (!data) return null;
  const hasExtra = data.extras.length > 0;
  const target = data.extras.find((e) => e.getsMail)?.email ?? data.extras[0]?.email ?? null;
  const goesTo = deliveryAddresses(data);
  const choices: Array<{ v: EmailDelivery; label: string }> = [
    { v: "main", label: t({ message: "My main address only", context: "account emails: delivery choice" }) },
    { v: "other", label: t({ message: "My other address only", context: "account emails: delivery choice" }) },
    { v: "both", label: t({ message: "Both addresses", context: "account emails: delivery choice" }) },
  ];

  return (
    <section className={CARD} aria-labelledby="account-emails-heading">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-5 w-5 text-notice" aria-hidden="true" />
        <h2 id="account-emails-heading" className={H2}>
          <Trans context="account emails: heading">Your email addresses</Trans>
        </h2>
      </div>
      <p className={`${NOTE} mb-5`}>
        <Trans context="account emails: lede">
          Sign in with any address on this list. Add another one, such as a village address beside your personal one, and choose where your email goes.
        </Trans>
      </p>

      <ul className="mb-5 space-y-2">
        <li className={`${QUIET} flex flex-wrap items-center justify-between gap-2`}>
          <span className="break-all text-foreground">{data.main}</span>
          <span className={CHIP_SOFT}>
            <Trans context="account emails: the main address label">Main</Trans>
          </span>
        </li>
        {data.extras.map((e) => (
          <li key={e.email} className={`${QUIET} flex flex-wrap items-center justify-between gap-2`}>
            <span className="break-all text-foreground">{e.email}</span>
            <span className="flex flex-wrap gap-2">
              <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => makeMain(e.email)}>
                <Trans context="account emails: button">Make main</Trans>
              </button>
              <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => remove(e.email)}>
                <Trans context="account emails: button">Remove</Trans>
              </button>
            </span>
          </li>
        ))}
      </ul>

      {!data.mainVerified ? (
        <div className="mb-5 space-y-2">
          <p className={HINT}>
            <Trans context="account emails: main unproved">
              Confirm your main address before adding another. Open the confirmation email we sent it, or send a new one here.
            </Trans>
          </p>
          <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={resendProof}>
            <Trans context="account emails: button">Send a confirmation email</Trans>
          </button>
        </div>
      ) : data.pending ? (
        <div className="mb-5 space-y-2">
          <label htmlFor="account-email-code" className={LABEL}>
            <Trans context="account emails: code label">Enter the code we sent to {data.pending.email}</Trans>
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="account-email-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${FIELD} max-w-[10rem] tracking-widest`}
            />
            <button type="button" className={BTN_PRIMARY} disabled={busy || code.length !== 6} onClick={confirm}>
              <Trans context="account emails: button">Confirm the code</Trans>
            </button>
          </div>
          <p className={HINT}>
            <Trans context="account emails: code hint">The code works for 15 minutes. To send a new one, add the address again.</Trans>
          </p>
        </div>
      ) : null}

      {data.mainVerified && (
        <form
          className="mb-6 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (adding.trim()) void startAdding();
          }}
        >
          <label htmlFor="account-email-add" className={LABEL}>
            <Trans context="account emails: add label">Add an email address</Trans>
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="account-email-add"
              type="email"
              autoComplete="email"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              className={`${FIELD} max-w-sm`}
            />
            <button type="submit" className={BTN_NOTICE} disabled={busy || !adding.trim()}>
              <Trans context="account emails: button">Send a code</Trans>
            </button>
          </div>
        </form>
      )}

      <fieldset className="space-y-1" disabled={busy}>
        <legend className={`${LABEL} mb-1`}>
          <Trans context="account emails: delivery legend">Where your email goes</Trans>
        </legend>
        {choices.map((c) => (
          <label key={c.v} className="flex min-h-11 items-center gap-3 text-foreground">
            <input
              type="radio"
              name="account-email-delivery"
              className={TICK}
              checked={data.delivery === c.v}
              disabled={c.v !== "main" && !hasExtra}
              onChange={() => choose(c.v, c.v === "main" ? undefined : target ?? undefined)}
            />
            {c.label}
          </label>
        ))}
        {data.extras.length > 1 && data.delivery !== "main" && (
          <label className="flex flex-wrap items-center gap-2 pt-1">
            <span className={HINT}>
              <Trans context="account emails: which other address">The other address is</Trans>
            </span>
            <select value={target ?? ""} onChange={(e) => choose(data.delivery, e.target.value)} className={`${FIELD} w-auto`}>
              {data.extras.map((e) => (
                <option key={e.email} value={e.email}>
                  {e.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className={`${HINT} pt-1`}>
          <Trans context="account emails: delivery answer">Village email goes to {goesTo.join(", ")}.</Trans>{" "}
          <Trans context="account emails: delivery essential">Sign-in codes and password links always go to the address that asked for them.</Trans>
        </p>
        {!hasExtra && (
          <p className={HINT}>
            <Trans context="account emails: delivery needs extra">Add another address to choose it here.</Trans>
          </p>
        )}
      </fieldset>

      {note && (
        <p role="status" className={`mt-4 text-sm ${note.tone === "wrong" ? "text-destructive" : "text-muted-foreground"}`}>
          {note.text}
        </p>
      )}
    </section>
  );
}
