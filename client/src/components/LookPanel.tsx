import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trans, useLingui } from "@lingui/react/macro";
import { CHARACTER_CARDS, GAME_TOKENS, OVERRIDE_SLOTS, deriveTheme, sanitizeGameTokens, sanitizeOverrides, type GameToken } from "@shared/brandTokens";
import { announceThemeChange } from "@/lib/liveTheme";
import SaveBar, { type SaveResult } from "@/components/SaveBar";
import { changedKeys } from "@/lib/unsavedChanges";

const LOOK_KEYS = ["seed", "character", "place", "accent", "mode", "overrides", "tokens"] as const;

/** What each game token paints (gap G3). Every name in GAME_TOKENS has a line. */
const TOKEN_WORDS: Record<GameToken, string> = {
  "paper": "Paper (anything signed or sworn)",
  "paper-2": "Second paper",
  "paper-foreground": "Ink on paper",
  "paper-muted": "Quiet ink on paper",
  "success": "Success",
  "ceremony": "Ceremony",
  "seal": "Seal ink",
  "stamp-alt": "Second stamp ink",
  "surface-deep": "Deepest ground",
  "glow": "Glow behind a picture",
  "place-1": "First place",
  "place-2": "Second place",
  "place-3": "Third place",
  "map-sea": "Map sea",
  "map-land": "Map land",
  "map-line": "Map lines",
  "map-water": "Map water",
  "map-grid": "Map grid",
  "map-fog": "Map fog",
  "destructive": "Danger",
};

/**
 * What each exact-colour slot paints, in a founder's words. Every slot in
 * OVERRIDE_SLOTS has a line; the compiler holds the two lists together.
 */
const SLOT_WORDS: Record<(typeof OVERRIDE_SLOTS)[number], string> = {
  "--background": "Page ground",
  "--foreground": "Text on the page",
  "--card": "Panels and cards",
  "--card-foreground": "Text on panels",
  "--popover": "Menus and pop-ups",
  "--popover-foreground": "Text in menus",
  "--primary": "Main button",
  "--primary-foreground": "Text on the main button",
  "--primary-hover": "Main button under the pointer",
  "--secondary": "Second button and chips",
  "--secondary-foreground": "Text on the second button",
  "--accent": "Highlighted row",
  "--accent-foreground": "Text on a highlighted row",
  "--muted": "Quiet panel",
  "--muted-foreground": "Quiet text",
  "--border": "Edges and dividers",
  "--input": "Field edges",
  "--ring": "Focus ring",
  "--destructive": "Warnings and errors",
  "--destructive-foreground": "Text on a warning",
  "--sidebar": "Side menu",
  "--sidebar-foreground": "Text in the side menu",
  "--chart-1": "Chart colour 1",
  "--chart-2": "Chart colour 2",
  "--chart-3": "Chart colour 3",
  "--chart-4": "Chart colour 4",
  "--chart-5": "Chart colour 5",
  "--tone-brand": "Brand fill (carries white text)",
  "--tone-brand-hover": "Brand fill under the pointer",
  "--tone-brand-mid": "Brand, middle tone",
  "--tone-brand-soft": "Brand, soft tone",
  "--tone-brand-text": "Brand as text (dark look)",
  "--tone-brand-band": "Header band",
  "--tone-sun": "Accent",
  "--tone-sun-on-band": "Accent as text on the band",
  "--tone-mist": "Mist",
  "--tone-mist-light": "Light mist",
  "--tone-cream": "Cream wash",
  "--radius": "Corner radius (rem, 0 to 1.5)",
};

/**
 * Admin → Make This Yours → Look: the THREE decisions everything visual
 * derives from (docs/DESIGN_TOKENS_SPEC.md §3.1). A founder with no design
 * background picks a colour, a character, and writes one sentence about
 * their place — palette, radius and type pairing derive, with every colour
 * pairing WCAG-measured before it ships (shared/brandTokens.ts).
 *
 * The preview and the contrast report are computed CLIENT-SIDE from the same
 * shared derivation the server emits, so what the founder sees while
 * deciding is exactly what /api/brand/theme.css will serve — one function,
 * two callers, no drift.
 *
 * Self-contained like TypographyPanel, for the same reason: Admin.tsx is a
 * large file another workstream edits; the mount is one line.
 */
export default function LookPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [theme, setTheme] = useState<any>(null);
  /** The four look fields as the server last had them. */
  const [saved, setSaved] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/brand", { headers: { Authorization: `Bearer ${password}` } });
      const data = await res.json();
      setTheme(data.brand?.theme ?? {});
      setSaved(data.brand?.theme ?? {});
    } catch { toast.error("Could not load the look settings"); }
  }, [password]);
  useEffect(() => { load(); }, [load]);

  const save = async (): Promise<SaveResult> => {
    try {
      const res = await fetch("/api/admin/brand", {
        method: "PUT",
        headers: { Authorization: `Bearer ${password}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: {
            seed: theme.seed ?? "",
            character: theme.character ?? "",
            place: theme.place ?? "",
            accent: theme.accent ?? "",
            mode: theme.mode === "dark" ? "dark" : "",
            overrides: sanitizeOverrides(theme.overrides),
            tokens: {
              ...sanitizeGameTokens(theme.tokens),
              ...(typeof theme.tokens?.["font-label"] === "string" && theme.tokens["font-label"].trim()
                ? { "font-label": theme.tokens["font-label"].trim().slice(0, 300) }
                : {}),
            },
          },
        }),
      });
      if (!res.ok) return { ok: false, reason: "The server did not accept the look." };
      setSaved(theme);
      announceThemeChange();
      return { ok: true };
    } catch { return { ok: false, reason: "The save could not reach the server." }; }
  };

  if (!theme) return null;
  const derived = deriveTheme(theme.seed, theme.character, theme.accent, { mode: theme.mode, overrides: theme.overrides, tokens: theme.tokens });
  const tokens: Record<string, string> = theme.tokens && typeof theme.tokens === "object" ? theme.tokens : {};
  const setToken = (name: string, value: string) => {
    const next = { ...tokens };
    if (value) next[name] = value;
    else delete next[name];
    setTheme({ ...theme, tokens: next });
  };
  const overrides: Record<string, string> = theme.overrides && typeof theme.overrides === "object" ? theme.overrides : {};
  const setOverride = (slot: string, value: string) => {
    const next = { ...overrides };
    if (value) next[slot] = value;
    else delete next[slot];
    setTheme({ ...theme, overrides: next });
  };
  const overrideCount = Object.keys(sanitizeOverrides(overrides)).length + Object.keys(sanitizeGameTokens(tokens)).length;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 mt-6">
      <h3 className="font-semibold text-gray-900 mb-1">Look</h3>
      <p className="text-xs text-gray-500 mb-4">
        Three decisions; everything else derives. Leave the colour empty to keep the platform's
        neutral look. Every derived pairing is contrast-checked, so your colour keeps its hue,
        legibility is non-negotiable.
      </p>
      {/* THE ACCENT, the one optional fourth answer. The character turns the
          seed's hue a fixed step to find an accent, which suits most villages
          and cannot reach a brand whose accent is a different family from its
          seed: a deep green seed turns to blue, never to gold. A village whose
          guide names its accent writes it here; its hue and depth are kept and
          its lightness is still measured against the ink and the band, the
          same as the derived one. Blank keeps the character's own. */}

      <div className="flex flex-wrap items-start gap-6 mb-5">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">Seed colour</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(theme.seed ?? "") ? theme.seed : "#6e7376" /* theme-ok: neutral colour-input default before a founder has picked a seed, never rendered as chrome */}
              onChange={(e) => setTheme({ ...theme, seed: e.target.value })}
              aria-label="Seed colour"
              className="h-9 w-12 rounded border border-gray-200 cursor-pointer"
            />
            <input
              value={theme.seed ?? ""}
              onChange={(e) => setTheme({ ...theme, seed: e.target.value })}
              placeholder="#157f7d" // theme-ok: format hint text in an empty field, never applied as a rendered colour
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 w-28 font-mono"
            />
            {theme.seed && (
              <button type="button" onClick={() => setTheme({ ...theme, seed: "" })}
                className="text-xs text-muted-foreground underline underline-offset-2">clear</button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="look-accent">Accent colour, if your guide names one</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(theme.accent ?? "") ? theme.accent : "#6e7376" /* theme-ok: neutral colour-input default before a founder has picked an accent, never rendered as chrome */}
              onChange={(e) => setTheme({ ...theme, accent: e.target.value })}
              aria-label="Accent colour"
              className="h-9 w-12 rounded border border-gray-200 cursor-pointer"
            />
            <input
              id="look-accent"
              value={theme.accent ?? ""}
              onChange={(e) => setTheme({ ...theme, accent: e.target.value })}
              placeholder="optional"
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 w-28 font-mono"
            />
            {theme.accent && (
              <button type="button" onClick={() => setTheme({ ...theme, accent: "" })}
                className="text-xs text-gray-400 underline underline-offset-2">clear</button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-[16rem]">
            Blank lets your character choose one from the seed.
          </p>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm font-medium text-gray-900 mb-1.5">Your place, in one sentence</label>
          <input
            value={theme.place ?? ""}
            onChange={(e) => setTheme({ ...theme, place: e.target.value.slice(0, 160) })}
            placeholder="e.g. river valley among old oaks, temperate and misty"
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Used to ground generated imagery when the design agency lands. Never shown publicly.
          </p>
        </div>
      </div>

      <label className="block text-sm font-medium text-gray-900 mb-1.5">Character</label>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-5" role="radiogroup" aria-label="Character">
        {CHARACTER_CARDS.map((c) => {
          const active = theme.character === c.id;
          // Each card previews ITSELF: its radius, its palette applied to the
          // current seed, its display face. Deciding blind is the failure mode.
          const p = deriveTheme(theme.seed || "#6e7376" /* theme-ok: same neutral default as the colour input above, feeds derivation rather than bypassing it */, c.id, theme.accent);
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme({ ...theme, character: active ? "" : c.id })}
              className={`text-left border px-3 py-2.5 transition-colors ${active ? "border-teal-deep ring-1 ring-teal-deep" : "border-gray-200 hover:border-gray-300"}`}
              style={{ borderRadius: `${c.radiusRem}rem`, background: p?.vars?.["--tone-cream"] }}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full" style={{ background: p?.vars?.["--tone-brand"] }} />
                <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full" style={{ background: p?.vars?.["--tone-sun"] }} />
                <span className="text-sm font-semibold" style={{ color: p?.vars?.["--foreground"] }}>{c.label}</span>
              </span>
              <span className="block text-xs mt-1" style={{ color: p?.vars?.["--muted-foreground"] }}>{c.hint}</span>
            </button>
          );
        })}
      </div>

      {/* THE SCHEME (gap G1). Dark promotes the night layer to every member
          page; Admin stays light by ruling. Both need a seed, like every
          other derived colour. */}
      <fieldset className="mb-5">
        <legend className="block text-sm font-medium text-foreground mb-1.5"><Trans context="admin look: light or dark page heading">Page look</Trans></legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t({ message: "Page look", context: "admin look: light or dark page heading" })}>
          {([["", t({ message: "Light", context: "admin look: page scheme choice" })], ["dark", t({ message: "Dark", context: "admin look: page scheme choice" })]] as const).map(([value, label]) => {
            const active = (theme.mode === "dark" ? "dark" : "") === value;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme({ ...theme, mode: value })}
                className={`rounded-lg border px-3 py-2 text-sm text-foreground ${active ? "border-teal-deep ring-1 ring-teal-deep" : "border-border"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1 max-w-prose">
          <Trans>Dark draws every member page on a dark ground, from your seed. Admin stays light. Needs a seed colour.</Trans>
        </p>
      </fieldset>

      <details className="mb-5 rounded-lg border border-border px-3 py-2.5" open={overrideCount > 0}>
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          {overrideCount ? t`Exact colours (${overrideCount} set)` : t({ message: "Exact colours", context: "admin look: section of exact colour overrides" })}
        </summary>
        <p className="text-xs text-muted-foreground mt-2 mb-3 max-w-prose">
          <Trans>
            Set any colour exactly. A text colour you leave blank is chosen to read on the ground you set.
            Every pair is measured below, and a colour you set can fail: the report says so.
          </Trans>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {OVERRIDE_SLOTS.map((slot) => {
            const value = overrides[slot] ?? "";
            const isRadius = slot === "--radius";
            const start = derived?.vars?.[slot];
            return (
              <div key={slot} className="flex items-center gap-2">
                {!isRadius && (
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(value) ? value : start && /^#[0-9a-f]{6}$/i.test(start) ? start : "#6e7376" /* theme-ok: the colour input's starting point before a founder sets one, never rendered as chrome */}
                    onChange={(e) => setOverride(slot, e.target.value)}
                    aria-label={SLOT_WORDS[slot]}
                    className="h-8 w-10 shrink-0 rounded border border-border cursor-pointer"
                  />
                )}
                <input
                  value={value}
                  onChange={(e) => setOverride(slot, e.target.value.trim().slice(0, 7))}
                  placeholder={isRadius ? "1" : t({ message: "blank", context: "admin look: empty exact colour field" })}
                  aria-label={t({ message: `${SLOT_WORDS[slot]}, exact value`, context: "admin look: exact colour field label" })}
                  className="w-24 shrink-0 text-xs border border-border rounded-lg px-2 py-1.5 font-mono"
                />
                <span className="text-xs text-foreground">{SLOT_WORDS[slot]}</span>
              </div>
            );
          })}
        </div>
        <p className="text-sm font-medium text-foreground mt-4 mb-1">
          <Trans context="admin look: the game colour tokens heading">Game colours</Trans>
        </p>
        <p className="text-xs text-muted-foreground mb-2 max-w-prose">
          <Trans>The colours the game's own pieces use: paper, stamps, the map, the places a quest happens. Blank keeps each one on the page colour it falls back to.</Trans>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(GAME_TOKENS) as GameToken[]).map((name) => {
            const value = tokens[name] ?? "";
            return (
              <div key={name} className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#6e7376" /* theme-ok: the colour input's starting point before a founder sets one, never rendered as chrome */}
                  onChange={(e) => setToken(name, e.target.value)}
                  aria-label={TOKEN_WORDS[name]}
                  className="h-8 w-10 shrink-0 rounded border border-border cursor-pointer"
                />
                <input
                  value={value}
                  onChange={(e) => setToken(name, e.target.value.trim().slice(0, 7))}
                  placeholder={t({ message: "blank", context: "admin look: empty exact colour field" })}
                  aria-label={t({ message: `${TOKEN_WORDS[name]}, exact value`, context: "admin look: exact colour field label" })}
                  className="w-24 shrink-0 text-xs border border-border rounded-lg px-2 py-1.5 font-mono"
                />
                <span className="text-xs text-foreground">{TOKEN_WORDS[name]}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              value={tokens["font-label"] ?? ""}
              onChange={(e) => setToken("font-label", e.target.value.slice(0, 300))}
              placeholder={t({ message: "blank", context: "admin look: empty exact colour field" })}
              aria-label={t({ message: "Label face, as a font stack", context: "admin look: the label font field" })}
              className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 font-mono"
            />
            <span className="text-xs text-foreground"><Trans context="admin look: the label font field">Label face</Trans></span>
          </div>
        </div>
      </details>

      {derived && (
        <div className="mb-4 text-xs rounded-lg border border-gray-100 px-3 py-2.5">
          {/* The honest report (amendment A3): measured pairs, named verdicts,
              and "adjusted" spelled out — never a green tick it didn't earn. */}
          <p className="font-medium text-gray-900 mb-1">
            Contrast: {derived.contrast.pairs.length} pairs measured ·{" "}
            {derived.contrast.status === "ok" && <span className="text-emerald-700">all pass as-is</span>}
            {derived.contrast.status === "adjusted" && <span className="text-amber-700">passes, and your colour's lightness was adjusted to stay readable</span>}
            {derived.contrast.status === "fail" && (
              <span className="text-red-700">
                {overrideCount ? <Trans>FAILING. A colour you set does not read on its partner; see the pairs marked fail</Trans> : <Trans>FAILING. This should not happen; please report it</Trans>}
              </span>
            )}
          </p>
          <p className="text-gray-500">
            worst ratio {derived.contrast.worstRatio}:1 ·{" "}
            {derived.contrast.pairs.map((p) => `${p.name} ${p.ratio}${p.verdict === "fail" ? " (fail)" : ""}`).join(" · ")}
          </p>
        </div>
      )}

      <SaveBar count={changedKeys(saved, theme, LOOK_KEYS).length} onSave={save} onDiscard={() => setTheme(saved)} what="the look" />
    </div>
  );
}
