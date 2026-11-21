/**
 * The painted animal or plant at the head of a role's row on /roles (the roles opening next and the open
 * ventures; Rye, 20 Nov 2026). Until the painting answers, and for a role that has none, the row keeps the
 * village's own icon on its own colour.
 */
import { useState, type ComponentType } from "react";
import { useRoleArt } from "@/lib/natureArt";

export default function RoleRowArt({ roleId, Icon, swatch }: { roleId: string; Icon: ComponentType<{ className?: string }>; swatch: { bg: string; ink: string } }) {
  const src = useRoleArt()(roleId);
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <span className="relative mt-0.5 block aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-xl border border-notice/40 shadow-sm sm:w-16" data-role-art="">
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      </span>
    );
  }
  return (
    <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg ${swatch.bg}`}>
      <Icon className={`size-5 ${swatch.ink}`} />
    </span>
  );
}
