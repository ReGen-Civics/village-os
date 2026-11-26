/**
 * Admin then Tokens: the registry, and the ONE place a token is named.
 *
 * MOVED OUT OF client/src/pages/Admin.tsx. The monolith ratchet
 * (scripts/check-file-lines.mjs) says the page may only ever get smaller, and
 * this tab is the one this lane was editing, so it is the one that leaves.
 * Everything that changed on the way out, in full:
 *
 *   - the imports at the top of this file, and `export default` on the
 *     function
 *   - a `lifecycles` prop, so the list can follow which modules run here
 *   - each row gained a plain sentence, its slug stated as fixed, and a line
 *     when its module is off
 *   - the governance chip says where a token is MINTED in words
 *   - the mint picker reads the same filtered list the table does
 *   - the lines this lane wrote use `text-muted-foreground` rather than a
 *     Tailwind default gray, because scripts/check-tailwind-gray.mjs starts a
 *     new file at zero
 *
 * The mint, rename, sending, visibility and grant-signing flows moved
 * untouched.
 *
 * Why this tab in particular is worth its own file: it is the surface a
 * founder rebrands through, and the platform has just removed two rival
 * naming boxes from the Setup Wizard that could never win against this
 * registry. Keeping the winner buried mid-monolith is how the losers survived.
 */
import TokenJobsPanel from "./TokenJobsPanel";
import OrgAccountsPanel from "./OrgAccountsPanel";
import MintDesk from "./MintDesk";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ModuleLifecycle } from "@shared/modules";
import { ExampleChip, forgetExamplesCache } from "@/components/ExamplesBanner";
import { API_BASE, authHeaders, refusal } from "@/components/admin/adminApi";
import { tokenModule, tokenModuleIsOff, visibleTokens } from "@/components/admin/tokenCatalog";
import TokenMeaningField from "./TokenMeaningField";
import VillageTokensWordField from "./VillageTokensWordField";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { takePrefill } from "@/lib/profilePrefill";
import { Trans, useLingui } from "@lingui/react/macro";

/**
 * THE ONE PAGE WHERE A TOKEN IS NAMED.
 *
 * `lifecycles` is the modules map the shell already holds. A module's own
 * token is absent from this list while its module is off, which is the
 * founder's ruling that module tokens are named inside their module and go
 * dark when it is switched off. `visibleTokens` keeps an already-issued one
 * listed anyway, with a line saying its module is off, because the same ruling
 * says the row is never destroyed and a steward answering for somebody's
 * balance has to be able to find it. Null means the map has not arrived: show
 * everything rather than flash a short registry.
 */
export default function TokensTab({ password, lifecycles }: { password: string; lifecycles: Record<string, ModuleLifecycle> | null }) {
  const { t } = useLingui();
  const [tokens, setTokens] = useState<any[]>([]);
  const [mintCap, setMintCap] = useState<number>(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ slug: "", name: "", kind: "credit", transferable: false });
  const [renaming, setRenaming] = useState<{ slug: string; name: string } | null>(null);
  /**
   * The recognition token's name from a ReGen Civics file (ProfileImport.tsx),
   * put in its rename box unsaved. `found: false` says no recognition token
   * here can take a new name, so the words are shown for a founder to place.
   */
  const [handed, setHanded] = useState<{ name: string; found: boolean } | null>(null);

  /*
   * THIS SCREEN SPEAKS WHOLE TOKENS. The ledger does not.
   *
   * Every amount the server sends here is MINOR units, and every token in the
   * registry except Village Voice carries 0 decimals, where the two are the
   * same number. Voice carries 3, so this tab showed a grant of 10 Voice as
   * "10,000" and its Amount box minted 0.010 Voice to a steward who typed 10.
   * The mint box and its grants now live in MintDesk.tsx, converted together
   * there; the issued-to-date figures below are converted here.
   */

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The grants record is MintDesk's own read (MintDesk.tsx).
      const [tRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/admin/tokens`, { headers: authHeaders(password) }),
        fetch(`${API_BASE}/admin/players`, { headers: authHeaders(password) }),
      ]);
      const t = await tRes.json();
      const p = await pRes.json();
      setTokens(Array.isArray(t.tokens) ? t.tokens : []);
      const name = takePrefill("tokenName");
      if (name) {
        const recognition = (Array.isArray(t.tokens) ? t.tokens : []).find(
          (x: any) => x?.kind === "recognition" && x?.governance === "platform" && !x?.isExample,
        );
        if (recognition) setRenaming({ slug: recognition.slug, name });
        setHanded({ name, found: !!recognition });
      }
      setMintCap(Number(t.mintCapPerCycle) || 0);
      setPlayers(Array.isArray(p) ? p : []);
    } catch { setTokens([]); }
    setLoading(false);
  }, [password]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/tokens`, {
        method: "POST",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(refusal(data, "failed"));
      toast.success(`Token "${data.token?.name}" created`);
      setForm({ slug: "", name: "", kind: "credit", transferable: false });
      // The village minting its own token is what retires the example market.
      forgetExamplesCache("exchange");
      load();
    } catch (e: any) { toast.error(e?.message || "Create failed"); }
  };

  const rename = async () => {
    if (!renaming || !renaming.name.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/admin/tokens/${renaming.slug}`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ name: renaming.name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(refusal(data, "failed"));
      toast.success(`Renamed to "${data.token?.name}". Every page follows`);
      setRenaming(null);
      setHanded(null);
      load();
    } catch (e: any) { toast.error(e?.message || "Rename failed"); }
  };

  /**
   * Show or hide a token for members. VISIBILITY ONLY: balances, history and
   * the ledger are untouched, so this is reversible and conservation still
   * proves at boot. Deliberately not called "disable" anywhere a founder can
   * read it — a word that sounds like it stops the economy, attached to a
   * switch that does not, is how somebody hides a token believing they have
   * frozen it.
   */
  /**
   * 0092: open or close member-to-member sending on one token.
   *
   * The server refuses by KIND, so recognition can never be opened from here.
   * The control is rendered only where the server would say yes, and the
   * refusal is surfaced verbatim when a stale panel tries anyway.
   */
  const setSending = async (t: any, transferable: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/admin/tokens/${t.slug}`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ transferable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(refusal(data, "failed"));
      toast.success(
        transferable
          ? `Members can send ${t.name} to each other`
          : `${t.name} stays put. Balances are untouched`,
      );
      load();
    } catch (e: any) { toast.error(e?.message || "Could not change sending"); }
  };

  const setActive = async (t: any, active: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/admin/tokens/${t.slug}`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(refusal(data, "failed"));
      toast.success(
        active
          ? `${t.name} is visible to members again`
          : `${t.name} is hidden from members. Balances are untouched`,
      );
      load();
    } catch (e: any) { toast.error(e?.message || "Could not change visibility"); }
  };

  /* Every token this village runs, module tokens included while their module
     is on. See client/src/components/admin/tokenCatalog.ts for the one
     exception and why it exists. */
  const shown = visibleTokens(tokens, lifecycles);
  // Minting into an example token is refused, and no ledger row exists for
  // one, so it never belongs in the mint picker.
  //
  // Built from `shown` rather than from the full registry: a page that has
  // just left a token off its own list must not then offer to mint into it,
  // and a picker with more tokens in it than the table above is the kind of
  // disagreement that makes a founder distrust both.
  // Gratitude is never minted by hand: it is only sent member to member (Rye,
  // 2026-10-23), and the route refuses it.
  const platformTokens = shown.filter((t) => t.governance === "platform" && !t.isExample && t.slug !== "gratitude");

  return (
    <div>
      {handed && (
        <p className="mb-4 text-sm text-gray-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
          {handed.found
            ? `The rename box on your recognition token now holds "${handed.name}", from your ReGen Civics profile. Nothing is saved until you press Save beside it.`
            : `Your ReGen Civics profile names your recognition token "${handed.name}". No recognition token here can take a new name yet, so nothing was put in a box.`}
        </p>
      )}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900"><Trans context="TokensTab, h2">Tokens</Trans></h2>
        <p className="text-sm text-gray-500 mt-1">
          <Trans context="TokensTab, p">Every token this village runs, and the one place any of them is named.
          Renaming one here renames it everywhere it appears, wallet to public
          pages, and no other screen carries a second box for the same name. A
          token's <strong>slug</strong> is fixed from the day it is created:
          history is keyed on it and is never re-denominated.
          <br />
          <span className="mt-1 inline-block">
            A module's own token is listed while that module is on. Switch the
            module off and its token leaves this list, and every balance stays
            exactly where it is.
          </span>
          <br />
          <span className="mt-1 inline-block">
            <strong>Shown to members</strong> hides a token from member-facing pages and
            nothing more. Balances, history and the ledger are untouched, so hiding one
            is reversible and takes nothing away from anybody who holds it. It does not
            stop a mint rule from paying. To stop issuance, pause the rule in the Mint.
          </span></Trans>
        </p>
      </div>
      <VillageTokensWordField password={password} />
      <TokenJobsPanel password={password} />
      <OrgAccountsPanel password={password} />
      {loading ? <div className="text-center py-12 text-muted-foreground"><Trans context="TokensTab, div">Loading...</Trans></div> : (
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5"><Trans context="TokensTab, th">Token</Trans></th>
                  <th className="px-4 py-2.5"><Trans context="TokensTab, th">Kind</Trans></th>
                  <th className="px-4 py-2.5"><Trans context="TokensTab, th">Where it is minted</Trans></th>
                  <th className="px-4 py-2.5"><Trans context="TokensTab, th">Peer transfers</Trans></th>
                  <th className="px-4 py-2.5"><Trans context="TokensTab, th">Shown to members</Trans></th>
                  <th className="px-4 py-2.5"><Trans context="TokensTab, th">Issued to date</Trans></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.slug} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      {renaming && renaming.slug === t.slug ? (
                        <span className="flex items-center gap-1.5">
                          <input
                            value={renaming.name}
                            onChange={(e) => setRenaming({ slug: t.slug, name: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setRenaming(null); }}
                            autoFocus
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1 w-40"
                          />
                          <button onClick={rename} disabled={!renaming.name.trim()}
                            className="text-xs bg-teal-deep text-white rounded-lg px-2 py-1 disabled:opacity-40"><Trans context="TokensTab, button">Save</Trans></button>
                          <button onClick={() => setRenaming(null)} className="text-xs text-muted-foreground"><Trans context="TokensTab, button">Cancel</Trans></button>
                        </span>
                      ) : (
                        <>
                          <span className="font-medium text-gray-900">{t.name}</span>
                          {t.isExample && <ExampleChip className="ml-2 align-middle" />}
                          {/* Rename, mint and stock are all refused on a
                              seeded token. Without the chip an example token
                              is indistinguishable from a real one here, which
                              is the registry telling the founder a lie. */}
                          {t.governance === "platform" && !t.isExample && (
                            <button onClick={() => setRenaming({ slug: t.slug, name: t.name })}
                              className="ml-2 text-xs text-teal-deep underline"><Trans context="TokensTab, button">rename</Trans></button>
                          )}
                          {/* WHAT IT MEANS, in the village's own words (0283).
                              The platform used to write this sentence, and the
                              2026-10-22 ruling says platform copy never says
                              what a token does. Members read it on their wallet. */}
                          <TokenMeaningField token={t} password={password} onSaved={load} />
                          {/* The row SAYS the slug is fixed. Every
                              repeat-protection key in the ledger carries it,
                              so it is the one field here that can never move,
                              and printing it small left that unsaid. */}
                          <p className="text-[11px] text-muted-foreground mt-0.5 opacity-80">
                            <Trans context="TokensTab, p">slug <span className="font-mono text-muted-foreground">{t.slug}</span>, fixed for good
                          </Trans></p>
                          {tokenModuleIsOff(t, lifecycles) && (
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              <Trans context="TokensTab, p">The {tokenModule(t.slug)} module is off. Members cannot see this
                              token, and every balance in it is still here.
                            </Trans></p>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{t.kind}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.governance === "platform"
                          ? "bg-teal-deep/10 text-teal-deep"
                          : "bg-purple-50 text-purple-700 border border-purple-200"
                      }`}>
                        {t.governance === "platform" ? "Minted here" : "Base mirror, read only"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {/* 0092: sending is a switch now, and only on a credit
                          token this platform governs. Recognition shows the
                          reason instead of a control, because a dead switch
                          reads as a bug and a stated rule reads as a rule. */}
                      {t.governance === "platform" && t.kind === "credit" && !t.isExample
                        && t.slug !== "stay-credit" && t.slug !== "library-credit" ? (
                        <button
                          type="button"
                          onClick={() => setSending(t, !t.transferable)}
                          aria-pressed={!!t.transferable}
                          className={`min-h-9 text-xs rounded-full px-3 py-1.5 border ${
                            t.transferable
                              ? "bg-teal-deep/10 text-teal-deep border-teal-deep/30"
                              : "bg-gray-100 text-gray-600 border-gray-300"
                          }`}
                        >
                          {t.transferable ? "yes" : "no"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t.kind === "recognition" ? "never" : "no"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.governance === "platform" && !t.isExample ? (
                        <button
                          type="button"
                          onClick={() => setActive(t, !t.active)}
                          aria-pressed={t.active !== false}
                          className={`min-h-9 text-xs rounded-full px-3 py-1.5 border ${
                            t.active !== false
                              ? "bg-teal-deep/10 text-teal-deep border-teal-deep/30"
                              : "bg-gray-100 text-gray-600 border-gray-300"
                          }`}
                        >
                          {t.active !== false ? "Shown" : "Hidden"}
                        </button>
                      ) : (
                        // The same two refusals the rename control respects, and
                        // said out loud rather than shown as a dead switch.
                        <span className="text-xs text-muted-foreground">
                          {t.isExample ? "example" : "read-only"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {Object.entries(t.issuedBy ?? {}).length === 0
                        ? <span className="text-gray-300">-</span>
                        : Object.entries(t.issuedBy).map(([acct, n]) => (
                            <div key={acct} className="text-xs">
                              <span className="font-mono text-muted-foreground">{acct.replace("sys:", "")}</span>: {formatTokenAmount(Number(n), Number(t.decimals ?? 0))}
                            </div>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-1"><Trans context="TokensTab, h3">Create a platform token</Trans></h3>
            <p className="text-xs text-gray-500 mb-3">
              <Trans context="TokensTab, p">Name tokens as you enable modules: stay credits, library credits, event
              tickets. The slug is permanent: history is never re-denominated.
            </Trans></p>
            <div className="flex flex-wrap items-center gap-2">
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder={t({ message: "slug (e.g. stay-credits)", context: "TokensTab, placeholder" })} className="text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono w-48" />
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t({ message: "Display name", context: "TokensTab, placeholder" })} className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-48" />
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
                className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white">
                <option value="credit">credit</option>
                <option value="recognition">recognition</option>
              </select>
              <label className="text-xs text-gray-600 flex items-center gap-1.5">
                <input type="checkbox" checked={form.transferable}
                  onChange={(e) => setForm({ ...form, transferable: e.target.checked })} />
                members may send it
              </label>
              <button onClick={create} disabled={!form.slug || !form.name}
                className="text-sm bg-teal-deep text-white rounded-lg px-4 py-2 font-medium disabled:opacity-40">
                <Trans context="TokensTab, button">Create
              </Trans></button>
            </div>
          </div>

          {/* The hand mint and the grants record (MintDesk.tsx), the same
              piece the Treasury page draws for a token.mint holder. */}
          <MintDesk password={password} tokens={platformTokens} members={players} mintCap={mintCap} onChanged={load} />
        </div>
      )}
    </div>
  );
}
