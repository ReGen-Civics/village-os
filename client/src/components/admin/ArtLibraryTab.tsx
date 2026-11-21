/**
 * THE ART LIBRARY, in Admin (Rye, 20 Nov 2026): the 48 painted animals and plants (shared/natureArt.ts),
 * which role shows each one, and a picker per role. A role nobody chose for keeps the painting drawn
 * from its id, so every card has art with nothing saved here. The same paintings are a looks set for
 * members' companions and stand for the role cards' Digital Companions by name.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { NATURE_ART, natureArt, natureArtUrl, type NatureKind } from "@shared/natureArt";
import { refreshRoleArt } from "@/lib/natureArt";

type Payload = { roles: Record<string, string>; chosen: Record<string, string>; names: Record<string, string> };

export default function ArtLibraryTab({ password }: { password: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<NatureKind | "all">("all");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${API_BASE}/admin/art/nature`, { headers: authHeaders(password) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return setError(refusal(j, "The art library did not load."));
        setData({ roles: j.roles ?? {}, chosen: j.chosen ?? {}, names: j.names ?? {} });
      })
      .catch(() => setError("The art library did not load."));
  }, [password]);

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
    if (!r.ok) return toast.error(refusal(j, "That painting did not save."));
    setData({ roles: j.roles ?? {}, chosen: j.chosen ?? {}, names: j.names ?? {} });
    refreshRoleArt(j.roles ?? {});
    toast.success(slug ? `Saved: ${natureArt(slug)?.name ?? slug}` : "Back to the automatic painting");
  };

  const shown = NATURE_ART.filter((a) => kind === "all" || a.kind === kind);
  const roleIds = data ? Object.keys(data.names).sort((a, b) => (data.names[a] ?? a).localeCompare(data.names[b] ?? b)) : [];

  return (
    <div className="flex flex-col gap-8" data-art-library="">
      <header>
        <h2 className="font-display text-2xl font-bold text-foreground">Art library</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {NATURE_ART.length} painted animals and plants of Costa Rica. Every role card, upcoming role and venture card shows one. A role you leave on automatic keeps the painting it was given, and no two roles share one. Members can also pick any of them as their companion&apos;s look, and a role card&apos;s Digital Companion named after one of these animals shows its painting.
        </p>
      </header>

      {error && <p role="alert" className="text-sm text-notice">{error}</p>}

      <section aria-labelledby="art-roles-h" className="flex flex-col gap-3">
        <h3 id="art-roles-h" className="font-display text-xl font-bold text-foreground">Each role&apos;s painting</h3>
        {!data && !error && <p className="text-sm text-muted-foreground">Reading the roles.</p>}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roleIds.map((id) => {
            const slug = data!.roles[id]!;
            const auto = !data!.chosen[id];
            return (
              <li key={id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm" data-art-role={id}>
                <img src={natureArtUrl(slug)} alt="" loading="lazy" className="aspect-[3/4] w-14 shrink-0 rounded-xl border border-notice/40 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-card-foreground">{data!.names[id]}</p>
                  <label className="sr-only" htmlFor={`art-${id}`}>Painting for {data!.names[id]}</label>
                  <select
                    id={`art-${id}`}
                    className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm"
                    value={auto ? "" : slug}
                    disabled={saving === id}
                    onChange={(e) => void choose(id, e.target.value || null)}
                  >
                    <option value="">Automatic ({natureArt(slug)?.name ?? slug})</option>
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
          <h3 id="art-all-h" className="font-display text-xl font-bold text-foreground">The library</h3>
          <div role="group" aria-label="Show" className="flex gap-1 rounded-full border border-border bg-card p-1">
            {(["all", "animal", "plant"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full px-4 text-sm ${kind === k ? "bg-foreground text-background" : "text-foreground"}`}>
                {k === "all" ? "All" : k === "animal" ? "Animals" : "Plants"}
              </button>
            ))}
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((a) => (
            <li key={a.slug} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-art-slug={a.slug}>
              <a href={natureArtUrl(a.slug)} target="_blank" rel="noreferrer" className="block">
                <img src={natureArtUrl(a.slug)} alt={a.name} loading="lazy" className="aspect-[3/4] w-full object-cover" />
              </a>
              <div className="p-3">
                <p className="font-semibold leading-tight text-card-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.es}</p>
                <p className="mt-1 text-xs text-muted-foreground">{(usedBy.get(a.slug) ?? []).join(", ") || "Not on a role yet"}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
