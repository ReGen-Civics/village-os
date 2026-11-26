/**
 * TERMS ON OFFER, for one seat, in the admin org chart (seat settings PR3).
 *
 * What a seat offers whoever holds it is written through the ORG DRAFT path
 * and nowhere else: Save makes a one-change draft (`update_seat` carrying
 * `termsOffer`), previews it, and publishes it. That is the same path the
 * map's arrange mode takes, so the offer gets the draft's preview, its
 * all-or-nothing apply and its revert, and the draft list is the record of
 * who put which terms on offer. A direct PUT on the seat would have none of
 * those, which is why `updateOrgRole` does not accept the field.
 *
 * Today the publish is the admin's (`isAdmin` on the draft routes). PR7 moves
 * it to the `org.decide` power, and this editor changes nothing when it does.
 *
 * LIGHT ONLY, by ruling: the admin panel is a light workspace, so the editor
 * draws in its stone inks and the admin numbered grays sit around it.
 * `compensationReality` is NOT this. It stays the admin's private note on
 * the seat and members never read it.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import SaveBar, { type SaveResult } from "@/components/SaveBar";
import type { SeatSettings } from "@shared/seatSettings";
import { parseSeatSettings } from "@shared/seatSettings";
import { OFFER_WORDS } from "@shared/seatTermsOffer";
import TermsWordsEditor from "./TermsWordsEditor";
import SeatSettingsEditor from "@/components/governance/SeatSettingsEditor";
import { useVillagePresets } from "@/lib/seatPresetsRead";

type Call = (path: string, body?: any, method?: string) => Promise<any>;

export const OFFER_EDITOR_WORDS = {
  open: "Terms on offer",
  sub: "What this role offers whoever holds it. Every member reads it; visitors and guests do not.",
  save: "Put these terms on offer",
  clear: "Take the terms off offer",
  saved: "Terms on offer saved",
  cleared: "Terms taken off offer",
  draftTitle: (seat: string) => `Terms on offer: ${seat}`,
  what: (seat: string) => `the terms on offer for ${seat}`,
  fix: "Fix the terms marked above first.",
} as const;

/** Make, preview and publish a one-change draft. Answers whether it published. */
async function publishOffer(call: Call, seatId: string, seatName: string, termsOffer: SeatSettings | null): Promise<boolean> {
  const made = await call("/admin/org/drafts", { title: OFFER_EDITOR_WORDS.draftTitle(seatName) });
  if (!made?.id) return false;
  const id = encodeURIComponent(String(made.id));
  const added = await call(`/admin/org/drafts/${id}/changes`, { op: "update_seat", orgRoleId: seatId, payload: { termsOffer } });
  if (!added) return false;
  const preview = await call(`/admin/org/drafts/${id}/preview`, undefined, "GET");
  const blocked = (preview?.lines ?? []).find((l: any) => l?.blocked);
  if (blocked) {
    toast.error(String(blocked.blocked));
    return false;
  }
  return !!(await call(`/admin/org/drafts/${id}/publish`, {}));
}

export default function SeatTermsOfferEditor({
  seat,
  call,
  onSaved,
}: {
  /** The seat's `/api/org` row, read at the editing tier. */
  seat: Record<string, any>;
  call: Call;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<unknown>(seat.termsOffer ?? undefined);
  const [busy, setBusy] = useState(false);
  const villagePresets = useVillagePresets(open);
  const parsed = parseSeatSettings(value);
  const hasOffer = seat.termsOffer !== null && seat.termsOffer !== undefined;
  const dirty = value !== undefined && JSON.stringify(value) !== JSON.stringify(seat.termsOffer ?? undefined);
  /** The edited terms, saved from the page's one save bar (components/SaveBar.tsx). Clearing stays an act of its own. */
  const saveOffer = async (): Promise<SaveResult> => {
    if (!dirty) return { ok: true };
    if (!parsed.ok) return { ok: false, reason: OFFER_EDITOR_WORDS.fix };
    if (!(await publishOffer(call, String(seat.id), String(seat.name ?? seat.id), parsed.settings))) return { ok: false, reason: "That did not save. The reason is in the note above." };
    onSaved();
    return { ok: true };
  };

  const save = async (next: SeatSettings | null, said: string) => {
    setBusy(true);
    try {
      if (await publishOffer(call, String(seat.id), String(seat.name ?? seat.id), next)) {
        toast.success(said);
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 text-left text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-deep"
      >
        <span>
          {OFFER_EDITOR_WORDS.open}
          <span className="ml-2 text-xs font-normal text-gray-500">{hasOffer ? "set" : OFFER_WORDS.none}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-gray-100 p-3">
          <p className="mb-3 text-xs text-gray-500">{OFFER_EDITOR_WORDS.sub}</p>
          <TermsWordsEditor value={value} onChange={setValue} />
          <SeatSettingsEditor value={value} onChange={setValue} villagePresets={villagePresets} />
          <div className="mt-3 flex flex-wrap gap-2">
            {hasOffer && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void save(null, OFFER_EDITOR_WORDS.cleared)}
                className="min-h-[44px] rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-teal-deep"
              >
                {OFFER_EDITOR_WORDS.clear}
              </button>
            )}
          </div>
        </div>
      )}
      <SaveBar
        count={dirty ? 1 : 0}
        onSave={saveOffer}
        onDiscard={() => setValue(seat.termsOffer ?? undefined)}
        what={OFFER_EDITOR_WORDS.what(String(seat.name ?? seat.id))}
      />
    </div>
  );
}
