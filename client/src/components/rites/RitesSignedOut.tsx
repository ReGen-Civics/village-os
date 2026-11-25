/**
 * A RITES PAGE TO SOMEONE NOT SIGNED IN (the every-page audit, 24 Nov 2026). Each rites page drew a bare "Sign in"
 * button with no heading for a visitor, even while the village had the module off, where a member was told the
 * room is not open yet. The module's state comes first now: off, the visitor gets the same "not open yet" notice;
 * on, the platform's sign-in page for a module, with its name, a line and the way back here.
 */
import { useLingui } from "@lingui/react/macro";
import ModuleGate, { SignInToSee } from "@/components/modules/ModuleGate";
import { useModule } from "@/modules/ModuleProvider";

export default function RitesSignedOut({ next }: { next: string }) {
  const { t } = useLingui();
  const rites = useModule("rites");
  const name = t({ message: "Rites", context: "module name" });
  if (!rites || rites.lifecycle === "off") return <ModuleGate moduleId="rites" name={name} next={next} />;
  return <SignInToSee moduleId="rites" name={name} next={next} />;
}
