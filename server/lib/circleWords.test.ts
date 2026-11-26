import type { Pool } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import { sourceHash } from "../repos/contentTranslations";
import { circlesInLanguage } from "./circleWords";

/** A pool that answers the one translation read with these rows, as the table stores them. */
function poolWith(rows: Array<{ field: string; text: string; english: string; status?: string }>): Pool {
  const stored = rows.map((r) => ({
    kind: "village_doc", ref_key: "circles", field: r.field, locale: "es", text: r.text,
    source_hash: sourceHash(r.english), status: r.status ?? "approved", created_by: "x", approved_by: "x", updated_at: new Date(0),
  }));
  return { query: async () => [stored, []] } as unknown as Pool;
}

const SHOWN = [
  { id: "anchor", name: "Anchor Circle", purpose: "Holds the whole." },
  { id: "garden", name: "Garden Circle", purpose: "Grows food." },
];

describe("a viewer's circles in their language (the coordinator's ruling (A), 26 Nov 2026)", () => {
  it("lays an accepted, current translation over a circle the route chose to show", async () => {
    const out = await circlesInLanguage(poolWith([{ field: "anchor.name", text: "Círculo Ancla", english: "Anchor Circle" }]), SHOWN, "es");
    expect(out[0]).toEqual({ id: "anchor", name: "Círculo Ancla", purpose: "Holds the whole." });
    expect(out[1]).toEqual(SHOWN[1]);
    expect(SHOWN[0].name).toBe("Anchor Circle");
  });

  it("never adds a circle, or a word for one, the route did not choose to show", async () => {
    const out = await circlesInLanguage(poolWith([{ field: "back-office.name", text: "Trastienda", english: "Back Office Circle" }]), SHOWN, "es");
    expect(out).toBe(SHOWN);
    expect(JSON.stringify(out)).not.toContain("Trastienda");
  });

  it("lays only what a person accepted, and only while the English it was written against is still the English", async () => {
    const pool = poolWith([
      { field: "anchor.name", text: "Borrador de máquina", english: "Anchor Circle", status: "ai_draft" },
      { field: "garden.purpose", text: "Cultiva comida.", english: "Grew food once." },
    ]);
    expect(await circlesInLanguage(pool, SHOWN, "es")).toBe(SHOWN);
  });

  it("asks nothing in English or with nothing to show", async () => {
    const throws = { query: async () => { throw new Error("asked"); } } as unknown as Pool;
    expect(await circlesInLanguage(throws, SHOWN, null)).toBe(SHOWN);
    expect(await circlesInLanguage(throws, [], "es")).toEqual([]);
  });
});
