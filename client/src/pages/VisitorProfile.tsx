/**
 * A VISITOR'S PROFILE (the lead, 25 Nov 2026; the contract is shared/visitorProfile.ts, the routes
 * server/routes/visitorProfile.ts).
 *
 * Clearly a visitor's: none of a member's pages, only what this person gave the village and did
 * here. Their details and keep-in-touch answer, their applications (withdraw, or edit, which
 * withdraws it and reopens the form with their answers), the forms they sent, the pages we noted,
 * a download of all of it, and delete. And the one way further: request an invitation to full
 * membership, which a steward answers in Admin, Portal visitors.
 */
import { useCallback, useEffect, useId, useState } from "react";
import { DoorOpen, Download, Trash2 } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { useVillageName } from "@/hooks/useVillageName";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CARD_FEATURED, EYEBROW, FIELD, H1, H2, HINT, LABEL, LEDE, LINK, WORLD } from "@/components/journey/look";
import { INTERESTS, type Interest } from "@shared/entrance";
import { DELETE_WORD, INVITE_NOTE_MAX, mayRequestInvite, type VisitorApplication, type VisitorProfile as Profile } from "@shared/visitorProfile";

const when = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

export default function VisitorProfile() {
  const { t } = useLingui();
  const village = useVillageName();
  const ids = useId();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signed_out">("loading");
  const [note, setNote] = useState<{ tone: "alert" | "status"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState({ name: "", whatsapp: "", link: "", interest: "" as Interest | "" });
  const [inviteNote, setInviteNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");

  const failed = () => t({ message: "That did not go through. Try again in a moment.", context: "portal entrance: a generic failure" });

  const take = useCallback((p: Profile) => {
    setProfile(p);
    setDetails({ name: p.name, whatsapp: p.whatsapp ?? "", link: p.link ?? "", interest: (INTERESTS as readonly string[]).includes(p.interest ?? "") ? (p.interest as Interest) : "" });
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/visitor/me", { credentials: "same-origin" })
      .then(async (r) => {
        // The body is read on every answer, a refusal included: one left unread holds the request open.
        const body = (await r.json().catch(() => null)) as { profile?: Profile } | null;
        if (!live) return;
        if (r.status === 401) return setState("signed_out");
        if (body?.profile) {
          take(body.profile);
          setState("ready");
        } else setState("signed_out");
      })
      .catch(() => live && setState("signed_out"));
    return () => {
      live = false;
    };
  }, [take]);

  /** One change sent, the profile read back from the answer. */
  const send = async (path: string, method: string, body?: unknown): Promise<Record<string, any> | null> => {
    if (busy) return null;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const answer = (await res.json().catch(() => null)) as Record<string, any> | null;
      if (!res.ok) {
        setNote({ tone: "alert", text: answer?.message ?? failed() });
        return null;
      }
      if (answer?.profile) take(answer.profile as Profile);
      return answer ?? {};
    } catch {
      setNote({ tone: "alert", text: failed() });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const interestWords: Record<Interest, string> = {
    seeder: t({ message: "Becoming a founding seeder", context: "portal entrance: what draws you, a founding seeder" }),
    home: t({ message: "A home here", context: "portal entrance: what draws you, a home" }),
    visit: t({ message: "Visiting", context: "portal entrance: what draws you, a visit" }),
    role: t({ message: "A role on the team", context: "portal entrance: what draws you, a role" }),
    curious: t({ message: "Just curious", context: "portal entrance: what draws you, curiosity" }),
  };

  const statusWords: Record<VisitorApplication["status"], string> = {
    unconfirmed: t({ message: "Waiting for you to confirm your email", context: "visitor profile: an application's status" }),
    confirmed: t({ message: "With us, waiting on a decision", context: "visitor profile: an application's status" }),
    adopted: t({ message: "Accepted", context: "visitor profile: an application's status" }),
    declined: t({ message: "Not this time", context: "visitor profile: an application's status" }),
    withdrawn: t({ message: "Withdrawn", context: "visitor profile: an application's status" }),
  };

  if (state === "loading") return <Layout>{null}</Layout>;

  if (state === "signed_out" || !profile) {
    return (
      <Layout>
        <div className={WORLD}>
          <main className="container flex max-w-2xl flex-col gap-6 py-12 sm:py-20" data-visitor-profile="signed-out">
            <h1 className={H1}>{t({ message: "Your visit", context: "visitor profile: heading when not signed in" })}</h1>
            <p className={LEDE}>{t({ message: "Sign in with the email you gave us when you entered. We send a 6-digit code to it.", context: "visitor profile: not signed in" })}</p>
            <a href="/visitor/sign-in?next=%2Fvisitor" className={`${BTN_PRIMARY} self-start text-base`}>
              {t({ message: "Sign in with a code", context: "sign in: link to a visitor's code sign-in" })}
            </a>
          </main>
        </div>
      </Layout>
    );
  }

  const p = profile;
  const canAsk = mayRequestInvite(p.invite, Date.now());

  const withdraw = async (a: VisitorApplication) => {
    if (!window.confirm(t({ message: "Withdraw this application? It will no longer be considered.", context: "visitor profile: confirm withdrawing an application" }))) return;
    const r = await send(`/api/visitor/me/applications/${encodeURIComponent(a.id)}/withdraw`, "POST");
    if (r) setNote({ tone: "status", text: t({ message: "Your application is withdrawn.", context: "visitor profile: withdrawn" }) });
  };

  const edit = async (a: VisitorApplication) => {
    if (
      !window.confirm(
        t({
          message: "Editing withdraws this application and opens the form with your answers, so you can change them and send it again. Any files you attached need attaching again. Go ahead?",
          context: "visitor profile: confirm editing an application, which withdraws and resubmits",
        }),
      )
    )
      return;
    const r = await send(`/api/visitor/me/applications/${encodeURIComponent(a.id)}/edit`, "POST");
    if (r && typeof r.resume === "string") window.location.assign(r.resume);
  };

  return (
    <Layout>
      <div className={WORLD}>
        <main className="container flex max-w-3xl flex-col gap-8 py-12 sm:py-16" data-visitor-profile="">
          <header className="flex flex-col gap-3">
            <p className={EYEBROW}>{t({ message: "Your visit", context: "visitor profile: eyebrow" })}</p>
            <h1 className={H1}>{t({ message: `Hi ${p.name}`, context: "visitor profile: heading, with their name" })}</h1>
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-notice px-3 py-1 text-sm font-semibold text-notice" data-visitor-badge="">
              {t({ message: "Visitor", context: "visitor profile: the badge that says this is a visitor, not a member" })}
            </p>
            <p className={LEDE}>
              {t({
                message: `You are visiting ${village}. This is your visitor profile: what you have shared with us, and your applications. Full membership is by invitation.`,
                context: "visitor profile: what this page is",
              })}
            </p>
          </header>

          {note && (
            <p role={note.tone} className={note.tone === "alert" ? "rounded-xl border border-destructive/60 bg-muted p-4 text-sm text-foreground" : `${HINT} rounded-xl border border-border bg-muted p-4`}>
              {note.text}
            </p>
          )}

          {/* The way further: an invitation to full membership. */}
          <section className={`${CARD_FEATURED} flex flex-col gap-4`} aria-labelledby={`${ids}-invite`} data-visitor-invite={p.invite?.status ?? "none"}>
            <span className="inline-flex size-10 items-center justify-center rounded-full border-2 border-notice text-notice" aria-hidden="true">
              <DoorOpen className="size-5" />
            </span>
            <h2 id={`${ids}-invite`} className={H2}>
              {t({ message: "Full membership", context: "visitor profile: the invitation section" })}
            </h2>
            {p.invite?.status === "requested" && (
              <p className={LEDE}>{t({ message: `Your request for an invitation is with us, since ${when(p.invite.requestedAt)}. We will let you know.`, context: "visitor profile: invitation requested" })}</p>
            )}
            {p.invite?.status === "promoted" && (
              <p className={LEDE}>{t({ message: "You are a member now. Check your email for the link to set your password, then sign in as a member.", context: "visitor profile: promoted" })}</p>
            )}
            {p.invite?.status === "declined" && (
              <>
                <p className={LEDE}>{p.invite.declineWords || t({ message: "Not this time. Thank you for asking.", context: "visitor profile: invitation declined, no words written" })}</p>
                {!canAsk && p.invite.askAgainFrom && (
                  <p className={HINT}>{t({ message: `You can ask again from ${when(p.invite.askAgainFrom)}.`, context: "visitor profile: when a declined visitor may ask again" })}</p>
                )}
              </>
            )}
            {canAsk && (
              <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await send("/api/visitor/me/invitation", "POST", { note: inviteNote });
                  if (r) setInviteNote("");
                }}
              >
                <p className={LEDE}>{t({ message: "If you want full access and full membership, request an invitation here.", context: "visitor profile: the invitation offer" })}</p>
                <label htmlFor={`${ids}-note`} className={LABEL}>
                  {t({ message: "A few words for us", context: "visitor profile: the invitation note" })}{" "}
                  <span className="font-normal text-muted-foreground">{t({ message: "(optional)", context: "portal entrance: marks a field as optional" })}</span>
                </label>
                <textarea id={`${ids}-note`} rows={3} maxLength={INVITE_NOTE_MAX} value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} className={`${FIELD} min-h-24`} />
                <button type="submit" className={`${BTN_PRIMARY} self-start text-base`} disabled={busy} data-visitor-request-invite="">
                  {t({ message: "Request an invitation", context: "visitor profile: the invitation button" })}
                </button>
              </form>
            )}
          </section>

          <section className={`${CARD} flex flex-col gap-4`} aria-labelledby={`${ids}-apps`}>
            <h2 id={`${ids}-apps`} className={H2}>
              {t({ message: "Your applications", context: "visitor profile: applications section" })}
            </h2>
            {p.applications.length === 0 ? (
              <p className={HINT}>
                {t({ message: "No applications yet.", context: "visitor profile: no applications" })}{" "}
                <a href="/roles" className={LINK}>
                  {t({ message: "See the open roles", context: "visitor profile: link to the roles" })}
                </a>
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {p.applications.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-border p-4" data-visitor-application={a.status}>
                    <p className="font-semibold text-foreground">{a.roles.join(", ")}</p>
                    <p className={HINT}>
                      {statusWords[a.status]} · {t({ message: `Sent ${when(a.sentAt)}`, context: "visitor profile: when an application was sent" })}
                    </p>
                    {a.open && (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void edit(a)} data-visitor-edit="">
                          {t({ message: "Edit and send again", context: "visitor profile: edit an application" })}
                        </button>
                        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void withdraw(a)} data-visitor-withdraw="">
                          {t({ message: "Withdraw", context: "visitor profile: withdraw an application" })}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${CARD} flex flex-col gap-4`} aria-labelledby={`${ids}-details`}>
            <h2 id={`${ids}-details`} className={H2}>
              {t({ message: "What you shared with us", context: "visitor profile: details section" })}
            </h2>
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await send("/api/visitor/me", "PATCH", { name: details.name, whatsapp: details.whatsapp, link: details.link, interest: details.interest || null });
                if (r) setNote({ tone: "status", text: t({ message: "Saved.", context: "visitor profile: details saved" }) });
              }}
            >
              <div className="flex flex-col gap-2">
                <label htmlFor={`${ids}-name`} className={LABEL}>{t({ message: "Your name", context: "portal entrance: name field" })}</label>
                <input id={`${ids}-name`} value={details.name} maxLength={120} onChange={(e) => setDetails({ ...details, name: e.target.value })} className={`${FIELD} min-h-11`} />
              </div>
              <p className={HINT}>
                {t({ message: `Your email: ${p.email}. Verified ${when(p.verifiedAt)}.`, context: "visitor profile: the verified email, not editable" })}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                  <label htmlFor={`${ids}-wa`} className={LABEL}>{t({ message: "WhatsApp number", context: "portal entrance: optional WhatsApp field" })}</label>
                  <input id={`${ids}-wa`} type="tel" value={details.whatsapp} maxLength={40} onChange={(e) => setDetails({ ...details, whatsapp: e.target.value })} className={`${FIELD} min-h-11`} />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <label htmlFor={`${ids}-link`} className={LABEL}>{t({ message: "Website or social link", context: "portal entrance: optional link field" })}</label>
                  <input id={`${ids}-link`} value={details.link} maxLength={500} onChange={(e) => setDetails({ ...details, link: e.target.value })} className={`${FIELD} min-h-11`} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor={`${ids}-interest`} className={LABEL}>{t({ message: "What draws you here?", context: "portal entrance: the optional interest question" })}</label>
                <select id={`${ids}-interest`} value={details.interest} onChange={(e) => setDetails({ ...details, interest: e.target.value as Interest | "" })} className={`${FIELD} min-h-11`}>
                  <option value="">{t({ message: "Not said", context: "visitor profile: no interest chosen" })}</option>
                  {INTERESTS.map((k) => (
                    <option key={k} value={k}>
                      {interestWords[k]}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className={`${BTN_PRIMARY} self-start text-base`} disabled={busy}>
                {t({ message: "Save", context: "visitor profile: save details" })}
              </button>
            </form>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className={LABEL}>{t({ message: "Updates and opportunities by email", context: "visitor profile: keep in touch" })}</p>
              <p className={HINT}>
                {p.updates === "yes"
                  ? t({ message: "You said yes.", context: "visitor profile: keep in touch answer" })
                  : p.updates === "no"
                    ? t({ message: "You said no.", context: "visitor profile: keep in touch answer" })
                    : t({ message: "You have not answered.", context: "visitor profile: keep in touch answer" })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={p.updates === "yes" ? BTN_PRIMARY : BTN_SECONDARY} disabled={busy} aria-pressed={p.updates === "yes"} onClick={() => void send("/api/visitor/me", "PATCH", { updates: "yes", words: t({ message: "Updates and opportunities by email", context: "visitor profile: keep in touch" }) })}>
                  {t({ message: "Yes", context: "portal entrance: the keep-in-touch answer yes" })}
                </button>
                <button type="button" className={p.updates === "no" ? BTN_PRIMARY : BTN_SECONDARY} disabled={busy} aria-pressed={p.updates === "no"} onClick={() => void send("/api/visitor/me", "PATCH", { updates: "no", words: t({ message: "Updates and opportunities by email", context: "visitor profile: keep in touch" }) })}>
                  {t({ message: "No", context: "portal entrance: the keep-in-touch answer no" })}
                </button>
              </div>
            </div>
          </section>

          {(p.forms.length > 0 || p.pages.length > 0) && (
            <section className={`${CARD} flex flex-col gap-4`} aria-labelledby={`${ids}-done`}>
              <h2 id={`${ids}-done`} className={H2}>
                {t({ message: "What you did here", context: "visitor profile: activity section" })}
              </h2>
              {p.forms.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm text-foreground">
                  {p.forms.map((f, i) => (
                    <li key={i}>{t({ message: `Sent ${f.type}, ${when(f.at)}`, context: "visitor profile: a form they sent" })}</li>
                  ))}
                </ul>
              )}
              {p.pages.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm text-foreground">{t({ message: `Pages you opened: ${p.pages.length}`, context: "visitor profile: pages noted" })}</summary>
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                    {p.pages.map((g, i) => (
                      <li key={i} className="break-all">
                        {when(g.at)} {g.path}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}

          <section className={`${CARD} flex flex-col gap-4`} aria-labelledby={`${ids}-data`}>
            <h2 id={`${ids}-data`} className={H2}>
              {t({ message: "Your data", context: "visitor profile: data section" })}
            </h2>
            <a href="/api/visitor/me/export" className={`${BTN_SECONDARY} self-start`} download data-visitor-export="">
              <Download className="size-4" aria-hidden="true" />
              {t({ message: "Download everything we keep", context: "visitor profile: export" })}
            </a>
            <form
              className="flex flex-col gap-3 border-t border-border pt-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await send("/api/visitor/me", "DELETE", { confirm: confirmDelete.trim() });
                if (r) window.location.assign("/");
              }}
            >
              <p className={HINT}>
                {t({
                  message: `Delete removes your details, your answers and the pages we noted, and takes you off our email list. Applications still waiting are withdrawn; your name and address come off every application 90 days after its decision. Type ${DELETE_WORD} to confirm.`,
                  context: "visitor profile: what delete does",
                })}
              </p>
              <input aria-label={t({ message: `Type ${DELETE_WORD} to confirm`, context: "visitor profile: delete confirmation field" })} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} className={`${FIELD} min-h-11 max-w-xs`} />
              <button type="submit" className={`${BTN_SECONDARY} self-start`} disabled={busy || confirmDelete.trim() !== DELETE_WORD} data-visitor-delete="">
                <Trash2 className="size-4" aria-hidden="true" />
                {t({ message: "Delete my data", context: "visitor profile: delete" })}
              </button>
            </form>
          </section>

          <p>
            <button
              type="button"
              className={LINK}
              onClick={async () => {
                const r = await send("/api/visitor/me/sign-out", "POST");
                if (r) window.location.assign("/");
              }}
            >
              {t({ message: "Sign out of your visit on this device", context: "visitor profile: sign out" })}
            </button>
          </p>
        </main>
      </div>
    </Layout>
  );
}
