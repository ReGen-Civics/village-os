/**
 * The player card's role health and handover lines, said by the server from the real compiled catalog
 * (shared/playerCardHealthMessages.ts, server/lib/catalogSpeech.ts): the same Spanish the fragment
 * client/src/locales/es.d/esb-card-health.po carries, read by the id the client macro gives each message.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { HEALTH_MESSAGES, healthWordsWith, type HealthMessageKey } from "../shared/playerCardHealthMessages";
import { forgetSpeakers, sayerFor, speakerFor } from "./lib/catalogSpeech";

beforeEach(() => forgetSpeakers());

describe("the health lines from the Spanish catalog", () => {
  it("say the dot, a fact, the meter and a handover check", () => {
    const i18n = speakerFor("es");
    expect(i18n, "build first: the Spanish catalog is dist/i18n/es.json").not.toBeNull();
    const w = healthWordsWith(sayerFor<HealthMessageKey>(i18n!, HEALTH_MESSAGES));
    expect(w.health.dot.look).toBe("Merece una mirada");
    expect(w.health.withinTerm("31 de diciembre de 2026")).toBe("Dentro del plazo, hasta el 31 de diciembre de 2026");
    expect(w.health.readyOf(2, 4)).toBe("2 de 4 listos");
    expect(w.health.decisionsN(1)).toBe("1 decisión registrada");
    expect(w.health.partsWritten(5, 5, "")).toBe("Las 5 partes están escritas");
    expect(w.handover.runbook.missing).toBe("Aún no hay manual de operación escrito");
  });
});
