import { useVillageDoc } from "@/hooks/useVillageDocTranslation";

/** The footer line from Identity, in the reader's language where the village has translated it; nothing when blank. */
export default function FooterBlurb({ text }: { text: string | undefined }) {
  const words = useVillageDoc("brand", { project: { footerBlurb: text ?? "" } }).project.footerBlurb;
  return words ? <p className="text-white text-sm leading-relaxed">{words}</p> : null;
}
