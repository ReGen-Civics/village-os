import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { CARD, H2, LINK, NOTE } from "@/components/journey/look";

/**
 * /messages TO A NEWCOMER (the lead, 25 Nov 2026): the calm member-only words, with the way to their path.
 * Members are unchanged.
 */
export default function MessagesMembersOnly() {
  const { t } = useLingui();
  return (
    <Layout>
      <div className="container max-w-2xl py-6 sm:py-10" data-messages-members-only="">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-5">{t({ message: "Messages", context: "Messages, h1" })}</h1>
        <section className={CARD}>
          <h2 className={H2}>{t({ message: "Messages are for members", context: "Messages, newcomer refusal" })}</h2>
          <p className={`${NOTE} mt-3`}>
            {t({ message: "Once the village welcomes you as a member, you can write to anyone here. Until then, your path shows the next step.", context: "Messages, newcomer refusal" })}
          </p>
          <p className="mt-4">
            <Link href="/path" className={LINK}>{t({ message: "See my path", context: "Messages, newcomer refusal" })}</Link>
          </p>
        </section>
      </div>
    </Layout>
  );
}
