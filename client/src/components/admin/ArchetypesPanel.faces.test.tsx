// @vitest-environment jsdom
/**
 * FACES (gap G10): the class panel shows the thirty stock faces by class, and
 * "Load a set" sends each file to its own slot by name, leaving out any file
 * that is not one of the thirty and saying which.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import ArchetypesPanel from "./ArchetypesPanel";

const SLOTS = ["building", "researching"].flatMap((k) => ["f", "m"].flatMap((p) => ["deep", "olive", "light"].map((t) => `${k}-${p}-${t}`)));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stub() {
  const puts: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/admin/archetypes")) {
        return new Response(JSON.stringify({ archetypes: [{ key: "building", name: "Carpenter", subtitle: "", blurb: "", examples: [], sigil: "hammer", sortOrder: 0, customized: true }] }));
      }
      if (u.includes("/admin/characters/stock-art/") && init?.method === "PUT") {
        puts.push(decodeURIComponent(u.split("/").pop()!));
        return new Response(JSON.stringify({ success: true }));
      }
      if (u.endsWith("/admin/characters/stock-art")) {
        return new Response(JSON.stringify({ slots: SLOTS, replaced: puts }));
      }
      return new Response("{}", { status: 404 });
    }),
  );
  return puts;
}

describe("the class panel's faces", () => {
  it("loads a set by file name and leaves out a file outside the cast", async () => {
    i18n.loadAndActivate({ locale: "en", messages: {} });
    const puts = stub();
    render(
      <I18nProvider i18n={i18n}>
        <ArchetypesPanel password="pw" />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Faces" })).toBeInTheDocument());
    // The class reads by the village's own name.
    expect(screen.getAllByText("Carpenter").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img")).toHaveLength(SLOTS.length);

    const input = screen.getByText("Load a set").closest("label")!.querySelector("input")!;
    const files = [
      new File(["a"], "building-f-deep.webp", { type: "image/webp" }),
      new File(["b"], "researching-m-light.png", { type: "image/png" }),
      new File(["c"], "parrot.webp", { type: "image/webp" }),
    ];
    fireEvent.change(input, { target: { files } });
    await waitFor(() => expect(screen.getByText(/Loaded 2 faces\. Not part of the cast, so left out: parrot\.webp\./)).toBeInTheDocument());
    expect(puts).toEqual(["building-f-deep", "researching-m-light"]);
    // A face the village replaced offers the way back.
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Use the platform's" })).toHaveLength(2));
  });
});
