/**
 * THE SCREENSHOT ON A FEEDBACK ITEM, in Admin's queue (the fold of /feedback into the guide's panel,
 * 26 Nov 2026). The picture lives in a private folder and is served to an admin alone, with a
 * Bearer token an `<img>` cannot send, so it is fetched on a press and drawn from a blob. Nothing is
 * fetched for an item until somebody asks to see it, so a long queue costs no bandwidth.
 */
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders } from "@/components/admin/adminApi";

export default function FeedbackShot({ id, password }: { id: string; password: string }) {
  const { t } = useLingui();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const show = async () => {
    setState("loading");
    try {
      const r = await fetch(`${API_BASE}/admin/feedback/${encodeURIComponent(id)}/screenshot`, { headers: authHeaders(password) });
      if (!r.ok) throw new Error(String(r.status));
      setUrl(URL.createObjectURL(await r.blob()));
      setState("idle");
    } catch {
      setState("failed");
    }
  };

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-3 block">
        <img src={url} alt={t({ message: "The screenshot sent with this feedback", context: "Admin, feedback: the screenshot" })} className="max-h-80 w-auto rounded-lg border border-border" />
      </a>
    );
  }
  return (
    <button type="button" onClick={show} disabled={state === "loading"} className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
      {state === "failed"
        ? t({ message: "The screenshot did not load. Try again", context: "Admin, feedback: the screenshot failed" })
        : t({ message: "Show the screenshot", context: "Admin, feedback: open the screenshot" })}
    </button>
  );
}
