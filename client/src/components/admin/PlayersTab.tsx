/**
 * The Players tab: everyone with an account, what they may do on this site and
 * where they stand in village life. Moved out of client/src/pages/Admin.tsx so
 * the per-path status, balances and filters (Rye, 2026-10-31) could land
 * without growing a file that sits at its line ratchet. The card and the key
 * live in ./PlayerCard.tsx.
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { BulkStageGrant } from "./StageFloorPicker";
import PersonalListsPanel from "@/components/yourList/PersonalListsPanel";
import AgeBandCorrection from "./AgeBandCorrection";
import MemberEmails from "./MemberEmails";
import OpsEmailSwitch from "./OpsEmailSwitch";

const AgentsPanel = lazy(() => import("./AgentsPanel"));
// Only opened when a steward goes to delete someone, so it loads then.
const ErasePrepPanel = lazy(() => import("@/components/yourList/ErasePrepPanel"));
import { NO_FILTER, PlayerCard, PlayersFilters, PlayersKey, filterPlayers, type LadderStage, type PathOption, type Player, type PlayerDetail } from "./PlayerCard";
import { Trans, useLingui } from "@lingui/react/macro";
import SaveBar, { saveEach, type SaveResult } from "@/components/SaveBar";

export default function PlayersTab({ password }: { password: string }) {
  const { t } = useLingui();
  const { user: me } = useAuth();
  const iAmFounder = me?.role === "founder";
  const [players, setPlayers] = useState<Player[]>([]);
  const [stages, setStages] = useState<LadderStage[]>([]);
  const [paths, setPaths] = useState<PathOption[]>([]);
  // Ladders, balances and who last set a stage: a second read, so the roster paints first.
  const [detail, setDetail] = useState<any | null>(null);
  const [filter, setFilter] = useState(NO_FILTER);
  /*
   * R90: THE FOUNDER ROLE ENDS WHEN THE VILLAGE STARTS ITS GAME, so who may
   * work the control below changes at that moment and this tab has to know it.
   * Before launch only a founder may change a role. After launch any
   * administrator may, and no new founder can be made.
   *
   * Read from the server rather than inferred from the roster, because a
   * client that guesses at a permission is a client that eventually disagrees
   * with the gate. `/api/game/mechanics` answers strangers and already carries
   * the fact, so this costs no new route and no token.
   */
  const [gameStarted, setGameStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  /**
   * Access and stage picked on a card, waiting on the page's one save bar
   * (components/SaveBar.tsx). Picking used to act at once; a slip on a select
   * could make somebody an admin. The confirm questions still ask, at Save.
   */
  const [drafts, setDrafts] = useState<Record<string, { role?: Player["role"]; stage?: string | null }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes, mRes] = await Promise.all([
        fetch(`${API_BASE}/admin/players`, { headers: authHeaders(password) }),
        fetch(`${API_BASE}/game/config`),
        fetch(`${API_BASE}/game/mechanics`),
      ]);
      const p = await pRes.json();
      const c = await cRes.json();
      const m = await mRes.json();
      setPlayers(Array.isArray(p) ? p : []);
      setStages(c?.stages ?? []);
      setPaths(c?.paths ?? []);
      fetch(`${API_BASE}/admin/players/detail`, { headers: authHeaders(password) })
        .then((r) => (r.ok ? r.json() : null))
        .then(setDetail)
        .catch(() => setDetail(null));
      setGameStarted(m?.gameStart?.started === true);
    } catch { setPlayers([]); }
    setLoading(false);
  }, [password]);

  useEffect(() => { load(); }, [load]);

  /** Null when it landed, the reason when it did not. */
  const grant = async (id: string, stageId: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/admin/players/${id}/stage`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ stageId: stageId || null }),
      });
      if (!res.ok) return refusal(await res.json().catch(() => ({})), t({ message: "Update failed", context: "PlayersTab, toast" }));
      return null;
    } catch { return t({ message: "Update failed", context: "PlayersTab, toast" }); }
  };

  const [erasing, setErasing] = useState<{ id: string; email: string } | null>(null);
  const eraseSheet = useRef<HTMLDivElement>(null);
  // Bring the sheet itself into view once it is drawn: a plain jump, wherever the tab sits on the page.
  useEffect(() => {
    if (erasing) eraseSheet.current?.scrollIntoView?.({ block: "start" });
  }, [erasing]);
  const remove = async (id: string, email: string) => {
    if (!confirm(`Delete player ${email}? This removes their account. Their past quest claims and ledger entries are kept.`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/players/${id}`, {
        method: "DELETE",
        headers: authHeaders(password),
      });
      if (!res.ok) throw new Error();
      toast.success(t({ message: "Player deleted", context: "PlayersTab, toast" }));
      load();
    } catch { toast.error(t({ message: "Delete failed", context: "PlayersTab, toast" })); }
  };

  /** Null when it landed, the reason when it did not. A "no" to a question is a reason too, so the change stays on the bar. */
  const setRole = async (id: string, role: string, name: string): Promise<string | null> => {
    const declined = t({ message: "Not changed: you answered no.", context: "PlayersTab, access declined" });
    if (role === "founder" && !confirm(`Make ${name} a FOUNDER? Founders manage admins and can only be demoted by another founder.`)) return declined;
    try {
      const put = (body: object) => fetch(`${API_BASE}/admin/users/${id}/role`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      let res = await put({ role });
      let data = await res.json();
      // The server asks before raising an account whose address nobody proved (R104).
      if (res.status === 409 && data?.code === "address_unproved") {
        if (!confirm(`${data.error}\n\nGive ${name} ${role} access anyway?`)) return declined;
        res = await put({ role, addressUnprovedOk: true });
        data = await res.json();
      }
      if (!res.ok) return refusal(data, t({ message: "Role change failed", context: "PlayersTab, access refused" }));
      return null;
    } catch { return t({ message: "Role change failed", context: "PlayersTab, access refused" }); }
  };

  /** Every picked access or stage that differs from what the player has now. */
  const pending = players.flatMap((p) => {
    const d = drafts[p.id];
    if (!d) return [];
    const out: { key: string; label: string; run: () => Promise<string | null> }[] = [];
    if (d.role !== undefined && d.role !== p.role) out.push({ key: `${p.id}:role`, label: t({ message: `${p.name}'s access`, context: "PlayersTab, save bar item" }), run: () => setRole(p.id, d.role!, p.name) });
    if (d.stage !== undefined && d.stage !== (p.stageGranted ?? null)) out.push({ key: `${p.id}:stage`, label: t({ message: `${p.name}'s stage`, context: "PlayersTab, save bar item" }), run: () => grant(p.id, d.stage ?? "") });
    return out;
  });
  const saveDrafts = async (): Promise<SaveResult> => {
    const { result, failedKeys } = await saveEach(pending);
    // What landed leaves the bar; what did not stays, by name.
    setDrafts((all) => {
      const next: typeof all = {};
      for (const [id, d] of Object.entries(all)) {
        const kept = { ...(failedKeys.has(`${id}:role`) ? { role: d.role } : {}), ...(failedKeys.has(`${id}:stage`) ? { stage: d.stage } : {}) };
        if (Object.keys(kept).length) next[id] = kept;
      }
      return next;
    });
    await load();
    return result;
  };
  const draftOf = (id: string, patch: { role?: Player["role"]; stage?: string | null }) =>
    setDrafts((all) => ({ ...all, [id]: { ...all[id], ...patch } }));

  const revokeSessions = async (id: string, name: string) => {
    if (!confirm(`Sign ${name} out everywhere? They keep their account and password. Every active session ends, and so do their agent tokens, agent inbox, own model key and private calendar address.`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}/revoke-sessions`, {
        method: "POST",
        headers: authHeaders(password),
      });
      if (!res.ok) throw new Error();
      toast.success(t({ message: "Sessions revoked", context: "PlayersTab, toast" }));
    } catch { toast.error(t({ message: "Revoke failed", context: "PlayersTab, toast" })); }
  };

  const detailFor = (id: string): PlayerDetail | undefined => {
    if (!detail) return undefined;
    const set = detail.stageSetBy?.[id];
    return {
      ladders: detail.ladders?.[id] ?? [],
      holdings: detail.balances?.[id] ?? [],
      stageSet: set ? { at: set.at, by: players.find((x) => x.id === set.actorUserId)?.name ?? null } : null,
    };
  };

  return (
    <div>
      <SaveBar
        count={pending.length}
        onSave={saveDrafts}
        onDiscard={() => setDrafts({})}
        what={t({ message: "access and stages", context: "PlayersTab, what the save bar saves" })}
      />
      {erasing && (
        <div ref={eraseSheet} className="mb-4 rounded-lg border border-border bg-card p-4">
          <Suspense fallback={<p className="text-sm text-muted-foreground"><Trans context="PlayersTab, p">Loading...</Trans></p>}>
            <ErasePrepPanel
              key={erasing.id}
              password={password}
              players={players}
              initialUserId={erasing.id}
              onContinue={() => { const e = erasing; setErasing(null); remove(e.id, e.email); }}
              onCancel={() => setErasing(null)}
            />
          </Suspense>
        </div>
      )}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900"><Trans context="PlayersTab, h2">Players</Trans></h2>
        <p className="text-sm text-gray-500 mt-1">
          <Trans context="PlayersTab, p">Everyone with an account: what they may do on this site, and where they stand in village life.
        </Trans></p>
      </div>
      {loading ? <div className="text-center py-12 text-muted-foreground"><Trans context="PlayersTab, div">Loading...</Trans></div> : players.length === 0 ? (
        <p className="text-sm text-muted-foreground"><Trans context="PlayersTab, p">No players yet.</Trans></p>
      ) : (
        <>
          <PersonalListsPanel password={password} players={players} />
          <Suspense fallback={null}><AgentsPanel password={password} players={players} /></Suspense>
          <PlayersKey players={players} stages={stages} gameStarted={gameStarted} />
          <PlayersFilters value={filter} onChange={setFilter} stages={stages} paths={paths} shown={filterPlayers(players, filter).length} total={players.length} />
          <div className="space-y-3">
            {picked.length > 0 && <BulkStageGrant stages={stages} ids={picked} password={password} onDone={() => { setPicked([]); load(); }} />}
            {filterPlayers(players, filter).map((p) => (
              <PlayerCard
                key={p.id}
                player={drafts[p.id] ? { ...p, role: drafts[p.id].role ?? p.role, stageGranted: drafts[p.id].stage !== undefined ? drafts[p.id].stage ?? null : p.stageGranted } : p}
                detail={detailFor(p.id)}
                stages={stages}
                paths={paths}
                canSetAccess={gameStarted || iAmFounder}
                gameStarted={gameStarted}
                picked={picked.includes(p.id)}
                onPick={(on) => setPicked((s) => (on ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                onAccess={(role) => draftOf(p.id, { role })}
                onStage={(id) => draftOf(p.id, { stage: id ?? null })}
                onSignOut={() => revokeSessions(p.id, p.name)}
                onDelete={() => setErasing({ id: p.id, email: p.email })}
                footerExtra={
                  <>
                    {/* The daily failed-actions report goes to admins and founders only, so the switch shows on their cards. */}
                    {(p.role === "admin" || p.role === "founder") && <OpsEmailSwitch key={`${p.id}:${p.opsEmail ?? "daily"}`} userId={p.id} initial={p.opsEmail} password={password} />}
                    <AgeBandCorrection userId={p.id} name={p.name} password={password} />
                    <MemberEmails userId={p.id} password={password} />
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
