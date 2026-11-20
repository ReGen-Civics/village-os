// @vitest-environment jsdom
/**
 * THE SAFETY NET (apply safety net, 19 Nov 2026): a send that fails offers a
 * way out. The error state on a 500 and on a network failure, the download
 * holding every answer, the draft surviving a failure, success still clearing
 * it, and no email line while the village has set no contact address.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OPEN_WORDS } from "@shared/openProposals";
import { draftKey } from "@/components/fireflyPath/applyDraft";
import { SETUP, fillValue, pressNext, sendNow } from "@/test/proposeStones";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: null }) }));
const links = vi.hoisted(() => ({ contactEmail: "" }));
vi.mock("@/lib/gameApi", async (orig) => ({
  ...(await orig<typeof import("@/lib/gameApi")>()),
  useVillageLinks: () => ({ siteUrl: "", eventsUrl: "", contactEmail: links.contactEmail, mailTo: () => "" }),
}));

import ProposeARole from "./ProposeARole";

const FORM = {
  open: true,
  village: "Test Village",
  season: { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01" },
  goals: [{ id: "g-team", text: "Build the team that can build the village" }, { id: "g-water", text: "Water" }],
  roles: [
    { id: "r-gate", name: "Gate Keeper", circle: "Anchor Circle", aim: "Open the gate at dawn." },
    { id: "r-host", name: "Welcome Host", circle: "Anchor Circle", aim: "Meet every newcomer." },
  ],
  founding: SETUP,
};
const LETTER = { version: "lv-0123456789abcdef", title: "Membership agreement", body: "Dear friend, welcome home.", intent: "I align with the Membership agreement.", parts: {} };

type Answer = { status: number; body: unknown } | "network";
let answers: Answer[] = [];
let posts = 0;

function serve(list: Answer[]) {
  answers = list;
  posts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const a = answers[Math.min(posts, answers.length - 1)];
        posts += 1;
        if (a === "network") throw new TypeError("Failed to fetch");
        return new Response(JSON.stringify(a.body), { status: a.status, headers: { "content-type": "application/json" } });
      }
      if (String(url).startsWith("/api/membership-letter")) return new Response(JSON.stringify(LETTER), { status: 200 });
      if (String(url).startsWith("/api/profile/alignments")) return new Response(JSON.stringify({ alignments: [] }), { status: 200 });
      return new Response(JSON.stringify(FORM), { status: 200 });
    }),
  );
}

const open = async (list: Answer[]) => {
  window.history.pushState({}, "", "/propose-a-role?role=r-gate");
  serve(list);
  render(<ProposeARole />);
  await screen.findByRole("heading", { level: 1, name: /^Apply: / });
};

const completeAll = async () => {
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.nameLabel), { target: { value: "Rowan" } });
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.emailLabel), { target: { value: "rowan@example.test" } });
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.whyLabel), { target: { value: "The gate is always shut." } });
  fireEvent.click(screen.getByLabelText(/agree to the background check/i));
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.aimLabel), { target: { value: "The gate opens at dawn." } });
  fillValue();
  fireEvent.change(screen.getByLabelText("Your commitment"), { target: { value: "50" } });
  fireEvent.click(await screen.findByLabelText(LETTER.intent));
  fireEvent.click(screen.getByLabelText(/confidentiality agreement before I see/));
};

const net = () => screen.findByText(/Something went wrong sending your application/);

/** The file the download hands the browser, read back as text. */
let saved: Blob[] = [];
beforeEach(() => {
  saved = [];
  (URL as any).createObjectURL = vi.fn((b: Blob) => {
    saved.push(b);
    return "blob:test";
  });
  (URL as any).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  links.contactEmail = "";
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("the safety net", () => {
  it("a 500: the calm words, Try again, the download and the email link to the village's own address", async () => {
    links.contactEmail = "hello@village.test";
    await open([{ status: 500, body: { error: OPEN_WORDS.notSent } }]);
    // Unticked (it starts ticked since 19 Nov 2026), so this device keeps nothing.
    fireEvent.click(screen.getByLabelText("Remember my answers on this device"));
    await completeAll();
    sendNow();
    const words = (await net()).textContent ?? "";
    // Nothing was kept on the device (Remember is off), so the words never say it was (surface audit, 19 Nov 2026).
    expect(words).toContain("Your answers are still on this page, so keep it open.");
    expect(words).not.toContain("safe on this device");
    expect(words).toContain("email the file to hello@village.test so nothing is lost.");
    expect(words).toContain("You can also try again.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download my application" })).toBeTruthy();
    const mail = screen.getByRole("link", { name: "Email it to us" }).getAttribute("href") ?? "";
    expect(mail.startsWith("mailto:hello@village.test?subject=")).toBe(true);
    const subject = decodeURIComponent(/subject=([^&]*)/.exec(mail)?.[1] ?? "");
    expect(subject).toBe("Role application backup - Gate Keeper");
    expect(subject).not.toMatch(/[–—]/);
    expect(decodeURIComponent(/body=([^&]*)/.exec(mail)?.[1] ?? "")).toMatch(/attach the application file I downloaded[\s\S]*CV/);
  });

  it("a network failure: the same way out, and Try again sends once more and can succeed", async () => {
    await open(["network", { status: 200, body: { sent: true } }]);
    await completeAll();
    sendNow();
    await net();
    expect(posts).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Check your email" });
    expect(posts).toBe(2);
  });

  it("no contact address set: no email sentence and no email link, the download stays", async () => {
    await open([{ status: 503, body: {} }]);
    await completeAll();
    sendNow();
    const words = (await net()).textContent ?? "";
    expect(words).toContain("Download them so nothing is lost.");
    expect(words).not.toMatch(/email the file/);
    expect(screen.queryByRole("link", { name: "Email it to us" })).toBeNull();
    expect(document.querySelector("[data-safety-mail]")).toBeNull();
    expect(screen.getByRole("button", { name: "Download my application" })).toBeTruthy();
  });

  it("the download holds the village, the role, every answer, the time, the page and the raw draft", async () => {
    await open(["network"]);
    await completeAll();
    fireEvent.change(screen.getByLabelText(/Your Human Design or Gene Keys/), { target: { value: "Projector 2/4" } });
    sendNow();
    await net();
    fireEvent.click(screen.getByRole("button", { name: "Download my application" }));
    expect(saved).toHaveLength(1);
    const html = await saved[0].text();
    for (const s of ["Test Village", "Gate Keeper", "Rowan", "rowan@example.test", "The gate is always shut.", "The gate opens at dawn.", "Projector 2/4", "50%", "/propose-a-role?role=r-gate"]) expect(html).toContain(s);
    expect(html).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(html).toContain("&quot;draft&quot;");
    expect(html).toContain("References, the background-check consent, files and voice recordings are never kept");
  });

  it("the saved draft survives a failed send, and a later success clears it", async () => {
    await open([{ status: 500, body: {} }, { status: 200, body: { sent: true } }]);
    // The box starts ticked (the lead, 19 Nov 2026).
    expect((screen.getByLabelText("Remember my answers on this device") as HTMLInputElement).checked).toBe(true);
    pressNext();
    await completeAll();
    sendNow();
    expect((await net()).textContent).toContain("Your answers are safe on this device.");
    const kept = window.localStorage.getItem(draftKey("r-gate", "")) ?? "";
    expect(kept).toContain("The gate is always shut.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Check your email" });
    await waitFor(() => expect(window.localStorage.getItem(draftKey("r-gate", ""))).toBeNull());
  });

  it("a refusal of one answer the applicant can fix lands on its field with no safety net (control)", async () => {
    await open([{ status: 400, body: { error: OPEN_WORDS.needWhy, field: "why" } }]);
    await completeAll();
    sendNow();
    expect((await screen.findByRole("alert")).textContent).toContain(OPEN_WORDS.needWhy);
    expect(document.querySelector("[data-safety-net]")).toBeNull();
  });
});
