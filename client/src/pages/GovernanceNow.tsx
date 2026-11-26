/**
 * /governance: THE VILLAGE'S GOVERNANCE PAGE, its Now view (the Governance brief, approved by the lead on 26 Nov 2026,
 * build step 3). What waits for a member's voice, what closes soon, Your voice and what they brought, read from
 * `GET /api/governance/now`. Somebody who is not a member yet sees how the village decides and the one door forward,
 * and nothing that is for members. How we decide (the explainer) is /governance/how.
 */
import Layout from "@/components/Layout";
import { Trans } from "@lingui/react/macro";
import { Link } from "wouter";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CARD_FEATURED, EYEBROW, H1, HINT, LEDE, NOTE, STATEMENT, WORLD } from "@/components/journey/look";
import GovernanceTabs from "@/components/governance/now/GovernanceTabs";
import NowView from "@/components/governance/now/NowView";
import { useGovernanceNow } from "@/components/governance/now/useGovernanceNow";
import { useGameConfig } from "@/lib/gameApi";
import { authToken } from "@/lib/gameApi";

function Newcomer({ signedOut }: { signedOut: boolean }) {
  return (
    <div className="grid gap-6" data-testid="governance-newcomer">
      <section className={`${CARD_FEATURED} space-y-3`}>
        <p className={EYEBROW}>{signedOut ? <Trans context="governance now: newcomer">Signed out</Trans> : <Trans context="governance now: newcomer">You are a guest</Trans>}</p>
        <p className={STATEMENT}>
          <Trans context="governance now: newcomer">Members decide together here.</Trans>
        </p>
        <p className={NOTE}>
          <Trans context="governance now: newcomer">Members vote on village decisions, and each vote counts the same. Until you are a member, you can read how the village decides.</Trans>
        </p>
        <div className="flex flex-wrap gap-2">
          {signedOut ? (
            <Link href="/login" className={BTN_PRIMARY}>
              <Trans context="governance now: newcomer">Sign in</Trans>
            </Link>
          ) : (
            <Link href="/request-membership" className={BTN_PRIMARY}>
              <Trans context="governance now: newcomer">How to become a member</Trans>
            </Link>
          )}
          <Link href="/governance/how" className={BTN_SECONDARY}>
            <Trans context="governance now: newcomer">How we decide</Trans>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function GovernanceNow() {
  const { load, read } = useGovernanceNow();
  const cfg = useGameConfig();
  // The village's own name for a rung; with no config yet, the id read as words ("co-creator" reads "Co-creator").
  const stageName = (id: string) => (cfg?.stages ?? []).find((s: { id: string; name?: string }) => s.id === id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1);
  return (
    <Layout>
      <div className={WORLD}>
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12 xl:max-w-[1200px]">
          <header className="space-y-2">
            <p className={EYEBROW}>
              <Trans context="governance now: eyebrow">How the village decides</Trans>
            </p>
            <h1 className={H1}>
              <Trans context="governance now: h1">Governance</Trans>
            </h1>
            <p className={LEDE}>
              <Trans context="governance now: lede">What the village is deciding, what your voice is here, and what waits on you.</Trans>
            </p>
          </header>
          <GovernanceTabs signedIn={!!authToken()} />
          {load.phase === "loading" ? (
            <p className={HINT}>
              <Trans context="governance now">Reading what waits for your voice.</Trans>
            </p>
          ) : load.phase === "signedOut" || load.phase === "notMember" ? (
            <Newcomer signedOut={load.phase === "signedOut"} />
          ) : load.phase === "failed" ? (
            <div className={`${CARD} space-y-3`} role="alert">
              <p className="text-base text-foreground">
                <Trans context="governance now">This did not load. Something may be waiting for your voice.</Trans>
              </p>
              <button type="button" className={BTN_SECONDARY} onClick={() => void read()}>
                <Trans context="governance now">Try again</Trans>
              </button>
            </div>
          ) : (
            <NowView answer={load.answer} now={new Date()} stageName={stageName} onRetry={() => void read()} />
          )}
        </div>
      </div>
    </Layout>
  );
}
