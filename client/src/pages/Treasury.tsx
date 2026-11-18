/**
 * THE TREASURY, for whoever keeps the village's books, admin or not.
 *
 * Rye, 2026-11-15: "Founders and Treasurers can mint tokens from after launch
 * ... mint tokens from pay requests and give bonuses." The server already lets
 * them (`token.mint`, `cash.pay`, `moon.approve_alone`); what stopped a
 * Treasurer who is not an admin was that the mint form and its grants lived
 * only inside /admin, which opens for admins and admin-access groups alone.
 *
 * This page draws ONLY those surfaces, each only when the gate opens it:
 *
 *   token.mint                      the hand mint and the grants waiting for a second signer (MintDesk)
 *   cash.pay or moon.approve_alone  the End of Moon review queue (ReviewQueue), where pay is confirmed
 *   cash.pay or moon.approve_alone  Pay by member (PayBoard, #1358): cash sent from escrow and the token pay to approve
 *   cash.pay                        the cash to pay out (CashPayoutsTab, the same list /cash-payouts shows)
 *
 * Which ones open is `GET /api/treasury/doors`, the same `mayAct` every write
 * asks, so the page never offers what the server would refuse. Every read and
 * write below keeps its own server gate; this page decides nothing. The mint
 * picker reads `GET /api/treasury/mint-options`, a name and a token for each
 * choice, so a Treasurer never reads the admin roster's emails.
 *
 * A lazy route, and each section a lazy chunk of its own, so none of it
 * reaches the first page or a member who holds none of these powers.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Trans } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { authToken } from "@/lib/gameApi";
import { useModules, useModuleOn } from "@/modules/ModuleProvider";
import { SignInDoors } from "@/components/modules/ModuleGate";
import { BreathingLoader } from "@/components/natural";
import { CARD, EYEBROW, H1, H2, HINT, LEDE, LINK, WORLD } from "@/components/journey/look";
import { visibleTokens } from "@/components/admin/tokenCatalog";
import { anyTreasuryDoor, useTreasuryDoors } from "@/components/treasury/useTreasuryDoors";
import type { MintMember, MintToken } from "@/components/admin/MintDesk";
import type { ModuleLifecycle } from "@shared/modules";

const MintDesk = lazy(() => import("@/components/admin/MintDesk"));
const ReviewQueue = lazy(() => import("@/components/myMoon/ReviewQueue"));
const CashPayoutsTab = lazy(() => import("@/components/admin/CashPayoutsTab"));
/** "Pay by member" (#1358): the same module the Cash payouts desk draws, its own chunk (client/src/lib/privilegedChunks.ts). */
const PayBoard = lazy(() => import("@/components/myMoon/PayBoard"));

/** `MOON_REVIEW_MODULE` in shared/moonRecap.ts, spelled here so this chunk does not carry that file. */
const MOON_REVIEW_MODULE = "moon-review";

export const TREASURY_WORDS = {
  eyebrow: "Treasury",
  title: "The village's books",
  lede: "Minting tokens for pay requests and bonuses, confirming End of Moon pay, and the cash still to send. Each part shows here only when the village has given you that power.",
  noneHeld: "None of the treasury's powers are yours right now. The village passes them by its vote, and What We Look After shows who holds each one.",
  signedOut: "Sign in to see the parts of the treasury the village has given you.",
  mintTitle: "Mint tokens",
  mintLede: "Pay a request or give a bonus in the village's own tokens. Every mint carries its reason and is recorded.",
  payTitle: "End of Moon pay",
  payLede: "The moon's recaps waiting on a pay decision. Confirm what was agreed against what was delivered.",
  optionsFailed: "The mint form could not load just now. Try again in a moment.",
} as const;

interface MintOptions {
  tokens: Array<MintToken & { kind?: string }>;
  members: MintMember[];
  mintCapPerCycle: number;
}

function MintSection({ password }: { password: string }) {
  const [options, setOptions] = useState<MintOptions | null>(null);
  const [failed, setFailed] = useState(false);
  const { modules, loaded } = useModules();
  useEffect(() => {
    let live = true;
    fetch("/api/treasury/mint-options", { headers: { Authorization: `Bearer ${password}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (live) {
          setOptions({
            tokens: Array.isArray(d?.tokens) ? d.tokens : [],
            members: Array.isArray(d?.members) ? d.members : [],
            mintCapPerCycle: Number(d?.mintCapPerCycle) || 0,
          });
        }
      })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [password]);
  // A module's own token is offered while its module is on, the same rule the admin picker follows.
  const lifecycles = useMemo<Record<string, ModuleLifecycle> | null>(
    () => (loaded ? Object.fromEntries(modules.map((m) => [m.id, m.lifecycle as ModuleLifecycle])) : null),
    [modules, loaded],
  );
  if (failed) return <p className={HINT}>{TREASURY_WORDS.optionsFailed}</p>;
  if (!options) return <BreathingLoader />;
  const tokens: MintToken[] = visibleTokens(options.tokens, lifecycles);
  return <MintDesk password={password} tokens={tokens} members={options.members} mintCap={options.mintCapPerCycle} />;
}

export default function Treasury() {
  const { user, token } = useAuth();
  const doors = useTreasuryDoors(user ? token : null);
  const password = token ?? authToken() ?? "";
  const moonReviewOn = useModuleOn(MOON_REVIEW_MODULE);

  return (
    <Layout>
      <div className={WORLD} data-world="night">
        <div className="container mx-auto max-w-5xl px-4 py-12 flex flex-col gap-8">
          <header className="flex flex-col gap-3">
            <p className={EYEBROW}>{TREASURY_WORDS.eyebrow}</p>
            <h1 className={H1}>{TREASURY_WORDS.title}</h1>
            <p className={LEDE}>{TREASURY_WORDS.lede}</p>
            <p className={HINT}>
              <Link href="/budget" className={LINK}><Trans context="link to the cash budget page">The cash budget for this moon</Trans></Link>
            </p>
          </header>

          {!user ? (
            <section className={CARD}>
              <p className={`${HINT} mb-4`}>{TREASURY_WORDS.signedOut}</p>
              <SignInDoors next="/treasury" align="start" />
            </section>
          ) : doors === undefined ? (
            <BreathingLoader />
          ) : !anyTreasuryDoor(doors) ? (
            <section className={CARD}>
              <p className={HINT}>
                {TREASURY_WORDS.noneHeld}{" "}
                <Link href="/powers" className={LINK}><Trans context="link to the powers page">What We Look After</Trans></Link>
              </p>
            </section>
          ) : (
            <Suspense fallback={<BreathingLoader />}>
              {doors?.mint && (
                <section className={CARD} aria-labelledby="treasury-mint" data-treasury="mint">
                  <h2 id="treasury-mint" className={`${H2} mb-1`}>{TREASURY_WORDS.mintTitle}</h2>
                  <p className={`${HINT} mb-5`}>{TREASURY_WORDS.mintLede}</p>
                  <MintSection password={password} />
                </section>
              )}
              {doors?.pay && moonReviewOn && (
                <section className={CARD} aria-labelledby="treasury-pay" data-treasury="pay">
                  <h2 id="treasury-pay" className={`${H2} mb-1`}>{TREASURY_WORDS.payTitle}</h2>
                  <p className={`${HINT} mb-5`}>{TREASURY_WORDS.payLede}</p>
                  <ReviewQueue />
                </section>
              )}
              {doors?.pay && (
                // Each member's cash sent from escrow and the token pay to approve or adjust.
                // GET /api/moon-review/pay-board asks a live holder of cash.pay or moon.approve_alone, no admin.
                <section className={CARD} data-treasury="pay-by-member">
                  <PayBoard password={password} />
                </section>
              )}
              {doors?.cashPay && (
                <section className={CARD} data-treasury="cash">
                  <CashPayoutsTab password={password} withPayBoard={false} />
                </section>
              )}
            </Suspense>
          )}
        </div>
      </div>
    </Layout>
  );
}
