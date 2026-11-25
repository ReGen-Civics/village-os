// @vitest-environment jsdom
/**
 * One way to save (the lead, 25 Nov 2026): a module settings panel raises the
 * one save bar when its draft moves, Save writes the WHOLE config document
 * through the module's one route, Discard puts the draft back, and a refusal
 * stays on the bar in the server's words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetUnsavedForTests } from "@/lib/unsavedChanges";
import { AutomationConfigEditor, CategoryListEditor, ResourcesRoutingEditor } from "./ModuleConfigPanels";

type Call = { url: string; method: string; body: any };
let calls: Call[];
let configs: Record<string, any>;
let refuse: string | null;

beforeEach(() => {
  calls = [];
  refuse = null;
  configs = {
    forum: { categories: [{ id: "village-life", label: "Village life", sortOrder: 1 }], imageUrl: "/keep-me.webp" },
    resources: { requestCategory: "village-life", measuredVisibleTo: "members" },
    automation: { youtubeChannelId: "UC123", maxReadyQueue: 15, forumCategory: "village-life" },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      const method = String(init?.method ?? "GET");
      const body = init?.body ? JSON.parse(init.body) : null;
      calls.push({ url: u, method, body });
      const answer = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json });
      const m = /\/admin\/modules\/([^/]+)\/config$/.exec(u);
      if (m && method === "PUT") {
        if (refuse) return answer(400, { error: refuse });
        configs[m[1]] = body.config;
        return answer(200, { config: body.config });
      }
      if (u.endsWith("/admin/modules")) {
        return answer(200, { modules: Object.entries(configs).map(([id, config]) => ({ id, config, lifecycle: "members", served: "members" })) });
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

const forum = () => render(<CategoryListEditor moduleId="forum" moduleName="Forum" password="pw" title="Forum categories" blurb="" icon={null} />);

describe("module settings on the one save bar", () => {
  it("shows no bar until something changes, and no Save button of its own", async () => {
    forum();
    await screen.findByDisplayValue("Village life");
    expect(screen.queryByText(/not saved yet/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Save categories/ })).toBeNull();
  });

  it("raises the bar on an edit, and Save writes the whole document through the module's route", async () => {
    forum();
    fireEvent.change(await screen.findByDisplayValue("Village life"), { target: { value: "Life in the village" } });
    expect(await screen.findByText("1 change not saved yet")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toMatch(/\/admin\/modules\/forum\/config$/);
    // Rule 1 of this file: the document is replaced whole, so imageUrl must survive.
    expect(put.body.config).toEqual({ categories: [{ id: "village-life", label: "Life in the village", sortOrder: 1 }], imageUrl: "/keep-me.webp" });
    expect(await screen.findByText("Saved")).toBeTruthy();
  });

  it("Discard puts the draft back and the bar goes", async () => {
    forum();
    const box = await screen.findByDisplayValue("Village life");
    fireEvent.change(box, { target: { value: "Something else" } });
    await screen.findByText("1 change not saved yet");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(await screen.findByDisplayValue("Village life")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/not saved yet/)).toBeNull());
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("keeps a refusal on the bar in the server's words", async () => {
    refuse = "maxReadyQueue must be between 1 and 100";
    render(<AutomationConfigEditor password="pw" />);
    fireEvent.change(await screen.findByDisplayValue("15"), { target: { value: "500" } });
    await screen.findByText("1 change not saved yet");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect((await screen.findByRole("alert")).textContent).toContain("maxReadyQueue must be between 1 and 100");
  });

  it("two panels on one screen share one bar, and Save writes both", async () => {
    render(
      <>
        <ResourcesRoutingEditor password="pw" />
        <AutomationConfigEditor password="pw" />
      </>,
    );
    fireEvent.click(await screen.findByLabelText("Admins only"));
    fireEvent.change(await screen.findByDisplayValue("UC123"), { target: { value: "UC999" } });
    expect(await screen.findByText("2 changes not saved yet")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(calls.filter((c) => c.method === "PUT")).toHaveLength(2));
    expect(configs.resources.measuredVisibleTo).toBe("admins");
    expect(configs.automation.youtubeChannelId).toBe("UC999");
  });
});
