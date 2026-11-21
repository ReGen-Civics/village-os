/**
 * THE ART LIBRARY, in Admin (Rye, 20 Nov 2026): the 48 painted animals and plants (shared/natureArt.ts),
 * which role shows each one, and a picker per role. A role nobody chose for keeps the painting drawn
 * from its id, so every card has art with nothing saved here. The same paintings are a looks set for
 * members' companions and stand for the role cards' Digital Companions by name.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { NATURE_ART, natureArt, natureArtUrl, type NatureKind } from "@shared/natureArt";
import { refreshRoleArt } from "@/lib/natureArt";

type Payload = { roles: Record<string, string>; chosen: Record<string, string>; names: Record<string, string> };

export default function ArtLibraryTab({ password }: { password: string }) {
  const { t } = useLingui();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<NatureKind | "all">("all");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${API_BASE}/admin/art/nature`, { headers: authHeaders(password) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return setError(refusal(j, t({ message: "The art library did not load.", context: "admin art library: load failed" })));
        setData({ roles: j.roles ?? {}, chosen: j.chosen ?? {}, names: j.names ?? {} });
      })
      .catch(() => setError(t({ message: "The art library did not load.", context: "admin art library: load failed" })));
  }, [password, t]);

  const usedBy = useMemo(() => {
    const m = new Map<string, string[]>();
    if (data) for (const [id, slug] of Object.entries(data.roles)) m.set(slug, [...(m.get(slug) ?? []), data.names[id] ?? id]);
    return m;
  }, [data]);

  const choose = async (roleId: string, slug: string | null) => {
    setSaving(roleId);
    const r = await fetch(`${API_BASE}/admin/art/nature/roles/${encodeURIComponent(roleId)}`, {
      method: "PUT",
      headers: authHeaders(password, { "Content-Type": "application/json" }),
      body: JSON.stringify({ slug }),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(null);
    if (!r.ok) return toast.error(refusal(j, t({ message: "That painting did not save.", context: "admin art library: save failed" })));
    setData({ roles: j.roles ?? {}, chosen: j.chosen ?? {}, names: j.names ?? {} });
    refreshRoleArt(j.roles ?? {});
    const named = slug ? (natureArt(slug)?.name ?? slug) : "";
    toast.success(slug ? t({ message: `Saved: ${named}`, context: "admin art library: a painting chosen" }) : t({ message: "Back to the automatic painting", context: "admin art library: choice cleared" }));
  };

  const shown = NATURE_ART.filter((a) => kind === "all" || a.kind === kind);
  const roleIds = data ? Object.keys(data.names).sort((a, b) => (data.names[a] ?? a).localeCompare(data.names[b] ?? b)) : [];

  return (
    <div className="flex flex-col gap-8" data-art-library="">
      <header>
        <h2 className="font-display text-2xl font-bold text-foreground">{t({ message: "Art library", context: "admin tab heading" })}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {t({ message: `${NATURE_ART.length} painted animals and plants of Costa Rica. Every role card, upcoming role and venture card shows one. A role you leave on automatic keeps the painting it was given, and no two roles share one. Members can also pick any of them as their companion's look, and a role card's Digital Companion named after one of these animals shows its painting.`, context: "admin art library: what it is" })}
        </p>
      </header>

      {error && <p role="alert" className="text-sm text-notice">{error}</p>}

      <section aria-labelledby="art-roles-h" className="flex flex-col gap-3">
        <h3 id="art-roles-h" className="font-display text-xl font-bold text-foreground">{t({ message: "Each role's painting", context: "admin art library: the roles section" })}</h3>
        {!data && !error && <p className="text-sm text-muted-foreground">{t({ message: "Reading the roles.", context: "admin art library: loading" })}</p>}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roleIds.map((id) => {
            const slug = data!.roles[id]!;
            const auto = !data!.chosen[id];
            return (
              <li key={id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm" data-art-role={id}>
                <img src={natureArtUrl(slug, "sm")} alt="" loading="lazy" className="aspect-[3/4] w-14 shrink-0 rounded-xl border border-notice/40 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-card-foreground">{data!.names[id]}</p>
                  <label className="sr-only" htmlFor={`art-${id}`}>{t({ message: `Painting for ${data!.names[id]}`, context: "admin art library: the picker's label" })}</label>
                  <select
                    id={`art-${id}`}
                    className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm"
                    value={auto ? "" : slug}
                    disabled={saving === id}
                    onChange={(e) => void choose(id, e.target.value || null)}
                  >
                    <option value="">{t({ message: `Automatic (${natureArt(slug)?.name ?? slug})`, context: "admin art library: the automatic choice" })}</option>
                    {NATURE_ART.map((a) => (
                      <option key={a.slug} value={a.slug}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="art-all-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="art-all-h" className="font-display text-xl font-bold text-foreground">{t({ message: "The library", context: "admin art library: the paintings section" })}</h3>
          <div role="group" aria-label={t({ message: "Show", context: "admin art library: filter" })} className="flex gap-1 rounded-full border border-border bg-card p-1">
            {(["all", "animal", "plant"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full px-4 text-sm ${kind === k ? "bg-foreground text-background" : "text-foreground"}`}>
                {k === "all" ? t({ message: "All", context: "admin art library filter" }) : k === "animal" ? t({ message: "Animals", context: "admin art library filter" }) : t({ message: "Plants", context: "admin art library filter" })}
              </button>
            ))}
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((a) => (
            <li key={a.slug} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-art-slug={a.slug}>
              <a href={natureArtUrl(a.slug)} target="_blank" rel="noreferrer" className="block">
                <img src={natureArtUrl(a.slug, "sm")} alt={a.name} loading="lazy" className="aspect-[3/4] w-full object-cover" />
              </a>
              <div className="p-3">
                <p className="font-semibold leading-tight text-card-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.es}</p>
                <p className="mt-1 text-xs text-muted-foreground">{(usedBy.get(a.slug) ?? []).join(", ") || t({ message: "Not on a role yet", context: "admin art library: a painting no role uses" })}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
