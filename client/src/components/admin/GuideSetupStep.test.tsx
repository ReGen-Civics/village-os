// @vitest-environment jsdom
/**
 * STEP 1 OF MAKE THIS YOURS (the lead, 26 Nov 2026): "Bring your agent or
 * guide". The step reads the guide's own status, takes the village's
 * Anthropic key on the one save bar (written through the same route
 * Integrations uses), counts Sera on its own, and opens the guide.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { resetUnsavedForTests } from "@/lib/unsavedChanges";
import GuideSetupStep, { useSetupObservations } from "./GuideSetupStep";
import { measureSetup } from "./setupProgress";

type Call = { url: string; method: string; body: any };
let calls: Call[];
let helper: Record<string, unknown>;
let refuse: string | null;

const OFF = { on: false, guide: "Guide", off: "key", provider: null, available: [], names: {} };
const ON = { on: true, guide: "Guide", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Guide" } };

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  calls = [];
  helper = OFF;
  refuse = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      const method = String(init?.method ?? "GET");
      calls.push({ url: u, method, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
      const answer = (status: number, json: unknown) => new Response(JSON.stringify(json), { status });
      if (method === "GET" && u === "/api/admin/helper") return answer(200, helper);
      if (method === "GET" && u === "/api/needs/scope") return answer(200, { summary: { answered: true, adopted: 2, customAdopted: 0 } });
      if (method === "PUT" && u === "/api/admin/integrations/assistant_api_key") {
        if (refuse) return answer(403, { error: refuse });
        helper = ON;
        return answer(200, { success: true });
      }
      return answer(404, {});
    }),
  );
});
afterEach(() => {
  cleanup();
  resetUnsavedForTests();
  vi.unstubAllGlobals();
});

/** The step as SetupWizard mounts it: rows from measureSetup, status from the same read. */
function Wizard({ onOpenHelper }: { onOpenHelper?: () => void }) {
  const seen = useSetupObservations("pw");
  const rows = measureSetup({ project: {}, images: {}, setup: {} }, seen.observations);
  return (
    <GuideSetupStep
      rows={rows}
      setup={{}}
      onToggleStep={() => {}}
      password="pw"
      status={seen.guide.status}
      onRead={seen.guide.reread}
      onOpenHelper={onOpenHelper}
    />
  );
}
const show = (onOpenHelper?: () => void) => render(<I18nProvider i18n={i18n}><Wizard onOpenHelper={onOpenHelper} /></I18nProvider>);
const puts = () => calls.filter((c) => c.method === "PUT");

describe("Make this yours, step 1: bring your agent or guide", () => {
  it("is step 1, says nothing is connected, and has no Save button of its own", async () => {
    show();
    expect(screen.getByRole("heading", { name: "Bring your agent or guide" })).toBeTruthy();
    expect(await screen.findByText("No agent or guide is connected yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("puts a typed key on the one save bar, writes it through the Integrations route, then reads the guide again", async () => {
    show();
    await screen.findByText("No agent or guide is connected yet.");
    fireEvent.change(screen.getByLabelText("Your village's Anthropic key"), { target: { value: "sk-ant-test" } });
    expect(await screen.findByText("1 change not saved yet")).toBeTruthy();
    expect(puts()).toHaveLength(0);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(puts()).toEqual([{ url: "/api/admin/integrations/assistant_api_key", method: "PUT", body: { value: "sk-ant-test" } }]);
    expect(await screen.findByText("Claude answers on the village's own Anthropic key.")).toBeTruthy();
    expect(calls.filter((c) => c.url === "/api/admin/helper")).toHaveLength(2);
    expect((screen.getByLabelText("Replace your village's Anthropic key") as HTMLInputElement).value).toBe("");
  });

  it("keeps a refused key on the bar, in the server's words", async () => {
    refuse = "Only a founder-steward can change this key.";
    show();
    await screen.findByText("No agent or guide is connected yet.");
    fireEvent.change(screen.getByLabelText("Your village's Anthropic key"), { target: { value: "sk-ant-test" } });
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    });
    expect(await screen.findByText(/Only a founder-steward can change this key\./)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("1 change not saved yet")).toBeTruthy());
  });

  it("counts Sera on its own, and opens the guide", async () => {
    helper = { ...ON, provider: "sera", available: ["sera"], names: { sera: "Sera" } };
    const open = vi.fn();
    show(open);
    expect(await screen.findByText("Sera is connected and answers as the guide.")).toBeTruthy();
    expect(screen.getByText(/Sera, your org memory, is connected/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Connect Sera" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open the guide" }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("offers Sera's own settings when Sera is not connected", async () => {
    show();
    const link = await screen.findByRole("link", { name: "Connect Sera" });
    expect(link.getAttribute("href")).toBe("/admin?tab=modules&module=saberra");
  });
});
