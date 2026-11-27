/**
 * A role's open proposals on the player card, said by the server from the real compiled catalog
 * (shared/playerCardProposalMessages.ts): the lines the components draw, and the voting line as the template the
 * doors fill with their own day.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { PROPOSAL_MESSAGES, fixedProposalWords, proposalWordsWith, type ProposalMessageKey } from "../shared/playerCardProposalMessages";
import { forgetSpeakers, sayerFor, speakerFor } from "./lib/catalogSpeech";

beforeEach(() => forgetSpeakers());

describe("the proposal words from the Spanish catalog", () => {
  it("say the heading, the doors and Proposed on, and leave {day} in the voting template", () => {
    const i18n = speakerFor("es");
    expect(i18n, "build first: the Spanish catalog is dist/i18n/es.json").not.toBeNull();
    const say = sayerFor<ProposalMessageKey>(i18n!, PROPOSAL_MESSAGES);
    const sent = fixedProposalWords(say);
    expect(sent.heading).toBe("Propuesto, en espera de consentimiento");
    expect(sent.adoptYes).toBe("Sí, adoptarlas");
    expect(sent.votingTemplate).toBe("La aldea está votando esto hasta el {day}.");
    expect(proposalWordsWith(say).proposedOn("20 de octubre de 2026")).toBe("Propuesto el 20 de octubre de 2026");
  });
});
