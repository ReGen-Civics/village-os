/**
 * THE PIECES THE GUIDE'S TWO SURFACES SHARE: the helper panel
 * (AdminHelperPanel.tsx) and the guide's dock (dock/GuideDock.tsx), which
 * grew from it. Moved out of the panel whole, words and classes unchanged, so
 * both draw the same proposal card, the same off states and the same
 * remembered pick of who answers.
 *
 * Paints with the sheet tokens only (bg-card, text-foreground, border-border,
 * bg-muted, bg-primary), so it follows the Admin palette and its night look.
 */
import { Check } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { GuideRules, HelperProposal, HelperProvider } from "@shared/adminHelper";
import { adminSearchHref } from "@shared/adminSearch";
import { goTo } from "./search/adminSearchModel";

/** Where a proposed dial lives: the address admin search uses, so it lands and focuses the same way. */
export const proposalHref = (p: Pick<HelperProposal, "key">): string =>
  adminSearchHref({ id: `dial.${p.key}`, kind: "dial", tab: "variables" });

/** One proposal as a mark, so a card can tell whether this exact change is waiting or saved. */
export const proposalMarkOf = (p: Pick<HelperProposal, "key" | "to">): string => `${p.key}=${p.to}`;

/**
 * WHAT THE GUIDE SAYS SHE DOES AND READS, before the first question. The ONE
 * place these sentences live: the helper panel and the guide's dock both draw
 * this. They are true to the code as it stands (the tool layer's two readers
 * and its refusals, server/routes/adminHelper.ts). When what she may read
 * changes, change them here, once.
 *
 * THREE VARIANTS, ALL HERE, each true of one rule set (`GuideRules`, which the
 * status route sends only while the village's dock is on). No rules, or rules
 * that are not wide: the sentences as they always were. Wide: she reads money
 * and selection settings too and may advise on money, and with the village's
 * money dial on she may also prepare a village-wide money setting. Under every
 * one she reads no application, proposal, interview, role terms or pay, and a
 * person makes every change.
 */
export function WhatTheGuideReads({ rules }: { rules?: GuideRules }) {
  const first = (
    <p><Trans context="admin helper panel">Ask me how to do something in Admin, where a setting lives, or what a control does. If you want something changed, I will show you the change first and you decide.</Trans></p>
  );
  if (!rules?.wide) {
    return (
      <>
        {first}
        <p><Trans context="admin helper panel">I read settings, help text and the shape of the org chart. I never read applications, proposals, interviews, terms or pay, and I can't help with choosing people for roles. Money stays with you too.</Trans></p>
      </>
    );
  }
  return (
    <>
      {first}
      <p><Trans context="guide dock, what the guide reads under the wide rules">I read your settings, the money ones and the ones about choosing people among them, the help text and the shape of the org chart. I never read applications, proposals, interviews, or a role's terms or pay, and I never score, rank or recommend a person.</Trans></p>
      {rules.moneyDials ? (
        <p><Trans context="guide dock, what the guide may do about money, with the village's money dial on">On money, pay, votes and signatures I can say what I would do and why. I can also prepare a change to a village-wide money setting, and nothing changes until you save it. A person makes every change.</Trans></p>
      ) : (
        <p><Trans context="guide dock, what the guide may do about money, with the village's money dial off">On money, pay, votes and signatures I can say what I would do and why. Your village keeps money settings for people to set, so I prepare none of them. A person makes every change.</Trans></p>
      )}
    </>
  );
}

/** Off by the village's own switch, which ships off. Turning it on is the village's decision. */
export function SwitchedOff() {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm text-foreground">
      <h3 className="font-semibold"><Trans context="admin helper panel">Your helper is switched off</Trans></h3>
      <p className="text-muted-foreground">
        <Trans context="admin helper panel">The helper stays off until your village decides to use AI in Admin. Whoever governs that here says yes first.</Trans>
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li><Trans context="admin helper, switch step">Open Game Mechanics and find "The guide's helper in Admin" under Platform.</Trans></li>
        <li><Trans context="admin helper, switch step">Turn it on. It also needs the village's own Anthropic key on the server.</Trans></li>
      </ol>
    </div>
  );
}

/** Who answers, remembered on this device: a harmless preference, never a person's words. */
const PICK_KEY = "admin-helper-provider";
export function readPicked(): HelperProvider | null {
  try {
    const v = localStorage.getItem(PICK_KEY);
    return v === "anthropic" || v === "sera" ? v : null;
  } catch {
    return null;
  }
}
export function rememberPicked(p: HelperProvider): void {
  try {
    localStorage.setItem(PICK_KEY, p);
  } catch {
    /* a private window keeps the pick for this visit only */
  }
}

/** No AI connected yet: the simplest way in first, then the others. It turns on by itself once one is set. */
export function ConnectSteps({ onOpenIntegrations }: { onOpenIntegrations: () => void }) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm text-foreground">
      <h3 className="font-semibold"><Trans context="admin helper panel">Connect Claude to turn on your helper</Trans></h3>
      <p className="text-muted-foreground">
        <Trans context="admin helper panel">The helper runs on Claude, using an Anthropic key that belongs to your village. It turns on by itself as soon as the key is saved, and the key never comes back to your browser.</Trans>
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li><Trans context="admin helper, connect step">Sign in at console.anthropic.com and create an API key for the village.</Trans></li>
        <li><Trans context="admin helper, connect step">Open Integrations, find "Anthropic, the AI guide", paste the key and save.</Trans></li>
        <li><Trans context="admin helper, connect step">Come back here and open the helper again.</Trans></li>
      </ol>
      <button
        type="button"
        onClick={onOpenIntegrations}
        className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trans context="admin helper, opens the Integrations page">Open Integrations</Trans>
      </button>
      <p className="text-muted-foreground">
        <Trans context="admin helper panel">Prefer your hosting? Add a variable named ANTHROPIC_API_KEY to the village's service in Railway instead. Railway restarts the service, which takes roughly two minutes.</Trans>
      </p>
      <p className="text-muted-foreground">
        <Trans context="admin helper panel">If your village uses Sera for its org memory, connecting Sera also turns the helper on. A village Anthropic key is used first when both are set.</Trans>
      </p>
    </div>
  );
}

export function OpenLabel({ label }: { label: string }) {
  return <Trans context="admin helper, opens an admin page">Open {label}</Trans>;
}

export type ProposalState = "waiting" | "saved" | "dropped" | null;

export function ProposalCard({
  proposal,
  state,
  onReview,
  onUnreview,
  onDrop,
}: {
  proposal: HelperProposal;
  /** waiting: on the save bar; saved: a person's Save wrote it. */
  state: ProposalState;
  onReview: () => void;
  onUnreview: () => void;
  onDrop: () => void;
}) {
  const { t } = useLingui();
  const blank = t({ message: "(blank)", context: "admin helper, proposal: an empty value" });
  if (state === "dropped") {
    return <p className="mt-2 text-xs text-muted-foreground"><Trans context="admin helper, proposal">Left as it was.</Trans></p>;
  }
  return (
    <div data-testid="helper-proposal" className="mt-2 rounded-xl border border-border bg-card p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground"><Trans context="admin helper, proposal">Proposed change</Trans></p>
      <p className="mt-1 font-semibold text-foreground">{proposal.label}</p>
      <p className="text-xs text-muted-foreground">{proposal.category}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground"><Trans context="admin helper, proposal: current value">Now</Trans></dt>
        <dd className="break-words font-mono text-foreground line-through decoration-muted-foreground">{proposal.from || blank}</dd>
        <dt className="text-muted-foreground"><Trans context="admin helper, proposal: new value">Becomes</Trans></dt>
        <dd className="break-words font-mono font-semibold text-foreground">{proposal.to || blank}</dd>
      </dl>
      {proposal.why && <p className="mt-2 text-muted-foreground">{proposal.why}</p>}
      {state === "saved" ? (
        <p className="mt-2 flex items-center gap-1 font-medium text-open">
          <Check className="h-4 w-4" aria-hidden="true" />
          <Trans context="admin helper, proposal">Saved.</Trans>
        </p>
      ) : state === "waiting" ? (
        <>
          <p role="status" className="mt-2 text-foreground">
            <Trans context="admin helper, proposal">Waiting on the save bar at the bottom. Nothing changes until you press Save there.</Trans>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onUnreview} className={secondaryBtn}>
              <Trans context="admin helper, takes the proposed change off the save bar">Take it off the bar</Trans>
            </button>
            <TakeMeThere proposal={proposal} />
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReview}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trans context="admin helper, puts the proposed change on the save bar">Review and save</Trans>
          </button>
          <button type="button" onClick={onDrop} className={secondaryBtn}>
            <Trans context="admin helper, declines the proposed change">Not now</Trans>
          </button>
          <TakeMeThere proposal={proposal} />
        </div>
      )}
    </div>
  );
}

export const secondaryBtn =
  "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The dial's own place in Admin, through the address search uses, so it lands, focuses and asks the one leave guard.
 * Made from the dial's key alone, so a card that prepares nothing (the dock's advice) reaches the control the same way.
 */
export function TakeMeThere({ proposal }: { proposal: Pick<HelperProposal, "key"> }) {
  const href = proposalHref(proposal);
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        goTo(href);
      }}
      className={secondaryBtn}
    >
      <Trans context="admin helper, opens the setting's own place">Take me there</Trans>
    </a>
  );
}
