/**
 * THE LATEST BROWSER CRASHES, for admins on Village Health (crash guard,
 * 19 Nov 2026). Each line is one crash screen a visitor saw, as the server
 * stored it (server/routes/clientCrash.ts): what broke, the page, the browser
 * family and the build. It holds nothing about the person.
 *
 * The read is admin only, so for everyone else it answers 401 and this draws
 * nothing. An empty list draws nothing too: no news is the good case.
 */
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { authToken } from "@/lib/gameApi";

export interface BrowserCrash {
  id: string;
  at: string;
  route: string | null;
  text: string;
}

export function BrowserCrashesCard({ load = defaultLoad }: { load?: () => Promise<BrowserCrash[] | null> }) {
  const [crashes, setCrashes] = useState<BrowserCrash[] | null>(null);
  useEffect(() => {
    let live = true;
    load()
      .then((c) => live && setCrashes(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [load]);
  if (!crashes || crashes.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm" data-testid="browser-crashes">
      <p className="flex items-center gap-2 font-semibold text-foreground text-sm mb-1">
        <AlertTriangle size={16} className="text-destructive" aria-hidden="true" />
        Crash screens visitors saw
      </p>
      <p className="text-xs text-muted-foreground mb-3">Only admins see this. Each line is the error, the page, the browser and the build. Nothing about the person is kept.</p>
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

async function defaultLoad(): Promise<BrowserCrash[] | null> {
  const t = authToken();
  const r = await fetch("/api/admin/client-crashes", { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!r.ok) return null;
  const body = (await r.json()) as { crashes?: BrowserCrash[] };
  return Array.isArray(body.crashes) ? body.crashes : null;
}
