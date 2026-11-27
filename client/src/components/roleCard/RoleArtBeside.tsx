/**
 * A ROLE'S OWN PAINTING beside its name in a heading (QA rounds 3 and 4: the applicant's page and the team's page
 * show the same piece), framed the way /roles frames it (RoleRowArt.tsx). The painting the village already holds for
 * that role; until it answers, and for a role with none, the seed glyph in the same frame. Decorative: the name beside
 * it says it, so a screen reader skips it.
 */
import { useState } from "react";
import { useRoleArt } from "@/lib/natureArt";
import { SeedOfLife } from "@/components/journey/nature";

export default function RoleArtBeside({ roleId, size = "sm" }: { roleId: string | null; size?: "sm" | "md" }) {
  const src = useRoleArt("sm")(roleId);
  const [failed, setFailed] = useState(false);
  const frame = size === "md" ? "w-14 sm:w-16" : "w-12";
  if (src && !failed) {
    return (
      <span className={`relative block aspect-[3/4] ${frame} shrink-0 overflow-hidden rounded-xl border border-notice/40 shadow-sm`} data-role-art="" aria-hidden="true">
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      </span>
    );
  }
  return (
    <span className={`flex aspect-square ${frame} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-notice/40 bg-card shadow-sm`} data-role-art-seed="" aria-hidden="true">
      <SeedOfLife size="sm" total={6} walked={0} label="" />
    </span>
  );
}
