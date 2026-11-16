// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LetterSamples from "@/components/admin/comms/LetterSamples";
import CommsWords from "@/components/admin/comms/CommsWords";

/**
 * Letters as they arrive, rendered against a stubbed server: the six letters
 * with their subjects in sandboxed frames, one test per letter, and all six at
 * once. The route behind it has its own tests (server/routes/commsWords.test.ts).
 */

type Call = { url: string; method: string; body: any };

const IDS = ["not-invited", "not-invited-es", "declined", "join-declined", "invited", "member-footer"];
const LETTERS = IDS.map((id) => ({
  id,
  label: `Label ${id}`,
  subject: `Subject ${id}`,
  preheader: "",
  html: `<!DOCTYPE html><html><body><p>Body ${id}</p></body></html>`,
  text: `Body ${id}`,
}));

function stub(calls: Call[], sendStatus = "sent") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      const method = String(init?.method ?? "GET");
      const body = init?.body ? JSON.parse(init.body) : null;
      calls.push({ url: u, method, body });
      const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
      if (u.endsWith("/admin/comms/letter-previews")) return ok({ letters: LETTERS });
      if (u.endsWith("/admin/comms/letter-previews/send")) {
        const keys: string[] = body?.keys ?? IDS;
        return ok({
          sentTo: "ada@village.example",
          results: keys.map((key) => ({ key, status: sendStatus, reason: sendStatus === "sent" ? null : "no_api_key", messageId: "msg_1" })),
        });
      }
      if (u.endsWith("/admin/comms/words")) return ok({ groups: [], postalAddressSet: true });
      return { ok: false, status: 404, json: async () => ({ error: "nothing here" }) };
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Letters as they arrive", () => {
  it("lists the six letters with their subjects, each in a frame with no permissions", async () => {
    const calls: Call[] = [];
    stub(calls);
    render(<LetterSamples password="pw" />);
    expect(await screen.findByText("Label declined")).toBeInTheDocument();
    for (const id of IDS) expect(screen.getByText(`Subject ${id}`)).toBeInTheDocument();
    const frame = screen.getByTitle("Label invited") as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toContain("Body invited");
    expect(screen.getAllByRole("button", { name: "Send me a test" })).toHaveLength(6);
  });

  it("sends one letter, naming only its key and never an address", async () => {
    const calls: Call[] = [];
    stub(calls);
    render(<LetterSamples password="pw" />);
    const row = (await screen.findByText("Label join-declined")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Send me a test" }));
    expect(await screen.findByText("Sent to ada@village.example. It should arrive in a minute or two.")).toBeInTheDocument();
    const sends = calls.filter((c) => c.method === "POST");
    expect(sends).toHaveLength(1);
    expect(sends[0].url).toMatch(/\/admin\/comms\/letter-previews\/send$/);
    expect(sends[0].body).toEqual({ keys: ["join-declined"] });
  });

  it("sends all six at once, and says plainly when the village cannot send yet", async () => {
    const calls: Call[] = [];
    stub(calls);
    render(<LetterSamples password="pw" />);
    await screen.findByText("Label declined");
    await userEvent.click(screen.getByRole("button", { name: "Send all to me" }));
    expect(await screen.findByText("6 letters sent to ada@village.example. They should arrive in a minute or two.")).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST")[0].body).toEqual({});

    const later: Call[] = [];
    stub(later, "skipped");
    render(<LetterSamples password="pw" />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Send all to me" })[1]).not.toBeDisabled());
    await userEvent.click(screen.getAllByRole("button", { name: "Send all to me" })[1]);
    expect(await screen.findByText(/no email provider key yet/)).toBeInTheDocument();
  });

  it("shows on the Words screen", async () => {
    const calls: Call[] = [];
    stub(calls);
    render(<CommsWords password="pw" />);
    expect(await screen.findByRole("heading", { name: "Letters as they arrive" })).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith("/admin/comms/letter-previews"))).toBe(true);
  });
});
