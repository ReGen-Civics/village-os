/**
 * WHICH CHARACTERS A ROLE SUITS, in the admin org chart (role draft board,
 * Rye 9 Nov 2026: the roles that attach to each character are kept current by
 * the people who run the village, live). Until now a role's tags were only a
 * boot-time guess (server/lib/economySeed.ts) that nobody could correct, and
 * the draft board, the character page's "Roles that fit" and the map's party
 * filter all read them.
 *
 * The roots kit's `RootPicker` (one to three of the village's own roots, read
 * from `GET /api/archetypes`), saved straight to the role (`PUT /api/admin/org/roles/:id { archetypes }`).
 * Saving clears the "suggested" mark, so no later boot overwrites the choice,
 * and the route refuses a key the cast does not hold.
 *
 * LIGHT ONLY, by ruling: the admin panel is a light workspace.
 */
import { useState } from "react";
import SaveBar, { type SaveResult } from "@/components/SaveBar";
import { useLingui } from "@lingui/react/macro";
import RootPicker from "@/components/roots/RootPicker";
import { forgetRootCast, useRootCast } from "@/components/roots/rootCast";

type Call = (path: string, body?: any, method?: string) => Promise<any>;

/** Tests start each case with a fresh read of the cast. */
export function forgetCastForTests(): void {
  forgetRootCast();
}

export default function RoleCharacterTags({
  role,
  call,
  onSaved,
}: {
  role: Record<string, any>;
  call: Call;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  const start = Array.isArray(role.archetypes) ? (role.archetypes as unknown[]).filter((k): k is string => typeof k === "string") : [];
  const [tags, setTags] = useState<string[]>(start);
  // Nothing to pick from until the cast arrives, so nothing (not even a dead save) is drawn.
  const cast = useRootCast();
  if (!cast.length) return null;

  const changed = tags.length !== start.length || tags.some((k) => !start.includes(k));

  /** Saved from the page's one save bar (components/SaveBar.tsx). */
  const save = async (): Promise<SaveResult> => {
    if (!changed) return { ok: true };
    const ok = await call(`/admin/org/roles/${encodeURIComponent(String(role.id))}`, { archetypes: tags }, "PUT");
    if (!ok) return { ok: false, reason: t({ message: "The roots did not save. The reason is in the note above.", context: "admin role roots" }) };
    onSaved();
    return { ok: true };
  };

  return (
    <div className="mt-3 rounded-lg border border-border p-3" data-role-roots={String(role.id)}>
      <RootPicker value={tags} onChange={setTags} />
      <SaveBar
        count={changed ? 1 : 0}
        onSave={save}
        onDiscard={() => setTags(start)}
        what={t({ message: `the roots of ${String(role.name ?? role.id)}`, context: "admin role roots, what the save bar saves" })}
      />
    </div>
  );
}
