// @vitest-environment jsdom
/**
 * SAVE AND FINISH LATER (the lead, 24 Nov 2026; components/fireflyPath/applySaveLater.ts, shared/applicationDrafts.ts).
 *
 * The button on every step saves the whole application, files included, and shows "Saved" with the time and
 * the private link with a copy button; the link opens the application again with every answer, file and the
 * step they stopped on, under "Your application is saved. Pick up where you left off."
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OPEN_WORDS } from "@shared/openProposals";
import { toDraft } from "@/components/fireflyPath/applyDraft";
import { SETUP, pressNext, stoneNow } from "@/test/proposeStones";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: null }) }));

import ProposeARole from "./ProposeARole";

const FORM = {
  open: true,
  village: "Test Village",
  season: { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01" },
  goals: [{ id: "g-team", text: "Build the team that can build the village" }],
  roles: [
    { id: "r-gate", name: "Gate Keeper", circle: "Anchor Circle", aim: "Open the gate at dawn." },
    { id: "r-host", name: "Welcome Host", circle: "Anchor Circle", aim: "Meet every newcomer." },
  ],
  founding: SETUP,
};
const TOKEN = "A".repeat(20) + "b_c-" + "Z".repeat(19);
const PART = `up-${"1".repeat(32)}`;
const PDF = "%PDF-1.7 a file";

let calls: Array<{ url: string; body: any }> = [];
function serve(opened?: unknown) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      const u = String(url);
      const body = init?.body instanceof FormData ? Object.fromEntries(init.body.entries()) : init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url: u, body });
      if (u === "/api/open-proposals/parts") return json({ id: PART, size: PDF.length });
      if (u === "/api/application-drafts") return json({ token: TOKEN, savedAt: "2026-11-24T15:07:00.000Z", files: [{ id: "df-0123456789abcdef", name: "cv.pdf", size: PDF.length }], emailed: "sent", emailedTo: "rowan@example.test" });
      if (u === "/api/application-drafts/open") return opened ? json(opened) : json({ error: "gone" }, 404);
      if (u === "/api/application-drafts/file") return new Response(PDF, { status: 200, headers: { "content-type": "application/pdf" } });
      if (u.startsWith("/api/membership-letter")) return json({ version: "lv-1", title: "", body: "", intent: "", parts: {} });
      if (u.startsWith("/api/profile/alignments")) return json({ alignments: [] });
      return json(FORM);
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("save and finish later", () => {
  it("is on every step, saves the whole application with its file, and shows Saved with the time, the private link and where it was emailed", async () => {
    window.history.pushState({}, "", "/propose-a-role?role=r-gate");
    serve();
    render(<ProposeARole />);
    await screen.findByRole("heading", { level: 1, name: /^Apply: / });
    // On the first step already, and on the next (loaded after the first view).
    expect(await screen.findByRole("button", { name: "Save and finish later" })).toBeTruthy();
    pressNext();
    expect(stoneNow()).toBe("about");
    expect(await screen.findByRole("button", { name: "Save and finish later" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.nameLabel), { target: { value: "Rowan Field" } });
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.emailLabel), { target: { value: "rowan@example.test" } });
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.whyLabel), { target: { value: "The gate is always shut." } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([PDF], "cv.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Save and finish later" }));

    const saved = await screen.findByText(/^Saved at /);
    expect(saved.getAttribute("role")).toBe("status");
    // The file went ahead as a part, then the draft named it, with every answer and the step.
    const part = calls.find((c) => c.url === "/api/open-proposals/parts");
    expect(part?.body.kind).toBe("files");
    const save = calls.find((c) => c.url === "/api/application-drafts")!;
    expect(save.body).toMatchObject({ roleId: "r-gate", step: 1, email: "rowan@example.test", files: { keep: [], parts: [PART] } });
    expect(save.body.draft).toMatchObject({ why: "The gate is always shut.", name: "Rowan Field", step: 1 });
    expect(save.body.token).toBeUndefined();
    const link = document.querySelector("[data-resume-link]") as HTMLInputElement;
    expect(link.value).toBe(`${window.location.origin}/propose-a-role#resume=${TOKEN}`);
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    expect(screen.getByText("We emailed this link to rowan@example.test.")).toBeTruthy();
    // The tab keeps the link in its address, so a reload opens the same draft; nothing goes to storage.
    expect(window.location.hash).toBe(`#resume=${TOKEN}`);
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TOKEN);

    // Saving again names the same draft by its token and sends the kept file by its id, never again.
    fireEvent.click(screen.getByRole("button", { name: "Save and finish later" }));
    await waitFor(() => expect(calls.filter((c) => c.url === "/api/application-drafts")).toHaveLength(2));
    const second = calls.filter((c) => c.url === "/api/application-drafts")[1];
    expect(second.body).toMatchObject({ token: TOKEN, files: { keep: ["df-0123456789abcdef"], parts: [] } });
    expect(calls.filter((c) => c.url === "/api/open-proposals/parts")).toHaveLength(1);
  });

  it("the resume link opens the application again: every answer, the file, and the step they stopped on", async () => {
    const draft = {
      ...toDraft({ step: 1, reached: 2, knowUs: [], why: "Kept on the server.", name: "Rowan Field", email: "rowan@example.test", about: { based: "San José", languages: "", story: "" }, selfKnowledge: "", links: [], aim: "", items: [], marks: {}, terms: { answers: {}, commitmentPct: null }, rampUp: false, practical: { timeZone: "UTC", windows: [], earliestStart: "" }, pieceSuggestions: [] }, new Date()),
      server: { references: [{ name: "Sol Rivers", how: "Neighbour", contact: "sol@example.test" }], consent: true, agreed: { nda: true }, early: false },
    };
    window.history.pushState({}, "", `/propose-a-role#resume=${TOKEN}`);
    serve({ roleId: "r-gate", link: null, step: 1, savedAt: new Date().toISOString(), draft, files: [{ id: "df-0123456789abcdef", name: "cv.pdf", size: PDF.length }] });
    render(<ProposeARole />);
    expect(await screen.findByText("Your application is saved. Pick up where you left off.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: OPEN_WORDS.heading("Gate Keeper") })).toBeTruthy();
    expect(stoneNow()).toBe("about");
    expect((screen.getByLabelText(OPEN_WORDS.whyLabel) as HTMLTextAreaElement).value).toBe("Kept on the server.");
    expect((screen.getByLabelText(/Where you are based/) as HTMLInputElement).value).toBe("San José");
    expect((screen.getByLabelText("Reference 1: name") as HTMLInputElement).value).toBe("Sol Rivers");
    expect(document.querySelector("[data-file-row]")?.textContent).toContain("cv.pdf");
    // The token went in a POST body, never in an address the server sees.
    const open = calls.find((c) => c.url === "/api/application-drafts/open");
    expect(open?.body).toEqual({ token: TOKEN });
    expect(calls.every((c) => !c.url.includes(TOKEN))).toBe(true);
  });

  it("a link the server no longer keeps opens the plain application and says so", async () => {
    window.history.pushState({}, "", `/propose-a-role?role=r-gate#resume=${TOKEN}`);
    serve();
    render(<ProposeARole />);
    await screen.findByRole("heading", { level: 1, name: /^Apply: / });
    expect(screen.getByRole("alert").textContent).toMatch(/no longer kept/);
    expect(document.querySelector("[data-draft-resumed]")).toBeNull();
  });
});
