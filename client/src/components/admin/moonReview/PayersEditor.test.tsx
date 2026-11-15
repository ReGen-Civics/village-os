// @vitest-environment jsdom
/**
 * The payers editor keeps a payer someone has started adding (14 Nov 2026).
 *
 * The editor used to seed its drafts from the loaded document in an effect keyed on the
 * hook's state. "Name who you pay first" renders in the same commit as the loaded state,
 * but that effect runs in a later passive flush, so an "add" pressed in between was wiped
 * when the effect replaced the drafts with the (empty) loaded list. On a loaded CI runner
 * that is what made MoonReviewSettingsPanel.test.tsx lose its Legal name field.
 *
 * The case below presses "add" from a MutationObserver callback, the first moment the
 * button is in the document and before React has flushed passive effects, then waits past
 * that flush and asks for the new payer's field. It failed on the effect-seeded editor.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PayersEditor from "./PayersEditor";
import { ADMIN_WORDS } from "@shared/moonRecap";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const W = ADMIN_WORDS.payers;

function servePayers(payers: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && String(url).endsWith("/moon-review/payers")) {
        return { ok: true, status: 200, json: async () => ({ document: { payers }, gaps: payers.length ? [] : [{ key: "payer", words: "Name who you pay" }] }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: "no route" }) };
    }),
  );
}

/** Press "add" in the same task the editor first commits it, before passive effects run. */
function addAsSoonAsItAppears(): Promise<void> {
  return new Promise((resolve) => {
    const press = () => {
      const button = screen.queryByText(W.add);
      if (!button) return false;
      observer.disconnect();
      fireEvent.click(button);
      resolve();
      return true;
    };
    const observer = new MutationObserver(() => void press());
    observer.observe(document.body, { childList: true, subtree: true });
    press();
  });
}

describe("the payers editor", () => {
  it("keeps a payer pressed into being before the loaded list finished seeding", async () => {
    servePayers([]);
    const pressed = addAsSoonAsItAppears();
    render(<PayersEditor password="tok" />);
    await pressed;
    // Let every queued effect and task run, the old reset included.
    await new Promise((r) => setTimeout(r, 50));
    expect(await screen.findByLabelText(W.legalName)).toBeInTheDocument();
  });

  it("CONTROL: a loaded payer is shown, and adding one more keeps both", async () => {
    servePayers([{ key: "p1", legalName: "First Payer", address: "", taxId: null, country: "", currencies: [], invoiceTo: "", invoiceCc: [], invoicing: false, routes: [], authority: {} }]);
    render(<PayersEditor password="tok" />);
    expect(await screen.findByDisplayValue("First Payer")).toBeInTheDocument();
    fireEvent.click(screen.getByText(W.add));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getAllByLabelText(W.legalName)).toHaveLength(2);
  });
});
