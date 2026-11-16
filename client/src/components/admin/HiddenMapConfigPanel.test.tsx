// @vitest-environment jsdom
/**
 * The hidden map's words on its module card (QA pass 5, P5-19): a founder sets
 * the map's name, the layers' words and kinds, and the two quests, and the
 * save writes the whole document through the one config route, in a shape the
 * module's own validator accepts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { validateConfig } from "@shared/hiddenMap";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let stored: any = { title: "Hidden map" };
const puts: any[] = [];
vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
  if (init?.method === "PUT") {
    const body = JSON.parse(String(init.body));
    puts.push({ url, body });
    stored = body.config;
    return new Response(JSON.stringify({ config: stored }), { status: 200 });
  }
  return new Response(JSON.stringify({ modules: [{ id: "hidden-map", lifecycle: "off", config: stored }] }), { status: 200 });
});

import HiddenMapConfigPanel, { configFromDraft } from "./HiddenMapConfigPanel";

afterEach(cleanup);

describe("the hidden map's words on its card", () => {
  it("saves the name, a layer's words and kinds, and the planting quest, whole, through the config route", async () => {
    render(<HiddenMapConfigPanel password="x" />);
    const name = await screen.findByLabelText("The map's name");
    fireEvent.change(name, { target: { value: "Our map" } });
    const [plantingName] = screen.getAllByLabelText("Layer name");
    fireEvent.change(plantingName!, { target: { value: "Treasures" } });
    const [plantingQuestion] = screen.getAllByLabelText("Question above its kinds");
    fireEvent.change(plantingQuestion!, { target: { value: "What went in the ground?" } });
    const [plantingKinds] = screen.getAllByLabelText("Kinds, one a line");
    fireEvent.change(plantingKinds!, { target: { value: "Seeds\n\nTrees\n" } });
    fireEvent.change(screen.getByLabelText("Quest that pays when a planting is vouched (its id)"), { target: { value: "q-plant" } });
    fireEvent.change(screen.getByLabelText("The rule a voucher reads"), { target: { value: "A sworn member who saw it planted." } });
    fireEvent.click(screen.getByLabelText("The photos leave no doubt"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(puts).toHaveLength(1));
    const { url, body } = puts[0];
    expect(url).toContain("/admin/modules/hidden-map/config");
    expect(body.config).toMatchObject({
      title: "Our map",
      labels: { planting: "Treasures" },
      kindPrompts: { planting: "What went in the ground?" },
      kinds: { planting: ["Seeds", "Trees"] },
      plantingQuestId: "q-plant",
      returnVisitQuestId: null,
      vouchRule: "A sworn member who saw it planted.",
      vouchWays: ["in-person", "call"],
    });
    expect(validateConfig(body.config)).toBeNull();
  });

  it("sends blank quests as none, never as an empty id", () => {
    const out = configFromDraft({
      title: "M", labels: { planting: "P", partner: "Q", stop: "S" },
      kindPrompts: { planting: "a?", partner: "b?", stop: "c?" },
      kinds: { planting: "x", partner: "y", stop: "z" }, openLayers: [], plantingQuestId: "  ", returnVisitQuestId: "",
      vouchWays: ["in-person", "call"], vouchRule: "Somebody who saw it planted.",
    });
    expect(out.plantingQuestId).toBeNull();
    expect(out.returnVisitQuestId).toBeNull();
    expect(validateConfig(out)).toBeNull();
  });
});
