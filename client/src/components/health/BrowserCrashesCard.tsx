/**
 * THE LATEST BROWSER CRASHES, for admins on Village Health (crash guard,
 * 19 Nov 2026). Each line is one crash screen a visitor saw, as the server
 * stored it (server/routes/clientCrash.ts): what broke, the page, the browser
 * family and the build. It holds nothing about the person.
 *
 * BY SIGNATURE (the lead, 25 Nov 2026). Above the lines, each distinct crash
 * once: how many times, first and last seen, the browsers and pages, whether a
 * frame was from our own code, and whether it emailed. A crash alert email links
 * straight to its card here (`#crash-<id>`, server/lib/crashTriage.ts), so the
 * card the email names is scrolled to and marked.
 *
 * The read is admin only, so for everyone else it answers 401 and this draws
 * nothing. An empty list draws nothing too: no news is the good case.
 */
import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { AlertTriangle } from "lucide-react";
import { authToken } from "@/lib/gameApi";

export interface BrowserCrash {
  id: string;
  at: string;
  route: string | null;
  text: string;
}

/** One distinct crash, as GET /api/admin/client-crashes sends it (`SignatureView`, server/lib/crashTriage.ts). */
export interface CrashSignature {
  id: string;
  message: string;
  topFrame: string;
  ours: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  emailedAt: string | null;
  browsers: string[];
  routes: string[];
}

export interface BrowserCrashes {
  crashes: BrowserCrash[];
  signatures: CrashSignature[];
}

/** The signature an email linked to, from the address's hash. */
function linkedSignature(): string {
  if (typeof window === "undefined") return "";
  return /^#crash-([0-9a-f]{16})$/.exec(window.location.hash)?.[1] ?? "";
}

export function BrowserCrashesCard({ load = defaultLoad }: { load?: () => Promise<BrowserCrashes | null> }) {
  const { t } = useLingui();
  const [data, setData] = useState<BrowserCrashes | null>(null);
  const linked = linkedSignature();
  useEffect(() => {
    let live = true;
    load()
      .then((c) => live && setData(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [load]);
  useEffect(() => {
    if (!data || !linked) return;
    document.getElementById(`crash-${linked}`)?.scrollIntoView?.({ block: "center" });
  }, [data, linked]);
  const crashes = data?.crashes ?? [];
  const signatures = data?.signatures ?? [];
  if (!crashes.length && !signatures.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm" data-testid="browser-crashes">
      <p className="flex items-center gap-2 font-semibold text-foreground text-sm mb-1">
        <AlertTriangle size={16} className="text-destructive" aria-hidden="true" />
        <Trans>Crash screens visitors saw</Trans>
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        <Trans>Only admins see this. Each line is the error, the page, the browser and the build. Nothing about the person is kept.</Trans>
      </p>
      {signatures.length > 0 && (
        <ul className="space-y-2 mb-4" aria-label={t({ message: `Each crash once`, context: "Village Health, crash card" })}>
          {signatures.map((s) => (
            <li
              key={s.id}
              id={`crash-${s.id}`}
              data-crash-signature={s.id}
              aria-current={s.id === linked ? "true" : undefined}
              className={`rounded-lg border p-3 text-sm break-words ${s.id === linked ? "border-notice bg-notice/10" : "border-border"}`}
            >
              <p className="font-medium text-foreground">{s.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t({ message: `Seen ${s.seenCount} times, first ${new Date(s.firstSeenAt).toLocaleString()}, last ${new Date(s.lastSeenAt).toLocaleString()}.`, context: "Village Health, crash card" })}{" "}
                {s.ours ? t({ message: `A frame is from our own code: ${s.topFrame}.`, context: "Village Health, crash card" }) : t({ message: `No frame from our own code.`, context: "Village Health, crash card" })}{" "}
                {s.emailedAt ? t({ message: `Last emailed ${new Date(s.emailedAt).toLocaleString()}.`, context: "Village Health, crash card" }) : t({ message: `Not emailed; counted in the daily digest.`, context: "Village Health, crash card" })}
              </p>
              {(s.browsers.length > 0 || s.routes.length > 0) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t({ message: `Browsers: ${s.browsers.join(", ")}. Pages: ${s.routes.join(", ")}.`, context: "Village Health, crash card" })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-2">
        {crashes.map((c) => (
          <li key={c.id} className="text-sm text-foreground break-words">
            <span className="text-xs text-muted-foreground mr-2">{new Date(c.at).toLocaleString()}</span>
            {c.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function defaultLoad(): Promise<BrowserCrashes | null> {
  const t = authToken();
  const r = await fetch("/api/admin/client-crashes", { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!r.ok) return null;
  const body = (await r.json()) as Partial<BrowserCrashes>;
  return {
    crashes: Array.isArray(body.crashes) ? body.crashes : [],
    signatures: Array.isArray(body.signatures) ? body.signatures : [],
  };
}
