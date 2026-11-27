// @vitest-environment jsdom
/**
 * SHARE FEEDBACK IN THE GUIDE'S PANEL: the form that replaced /feedback. It keeps what the page did
 * (the kind, the words, the honeypot, the real disclosure, the receipt that takes focus) and adds
 * the third kind, the guide's read-back with a suggested title, and a screenshot that travels as
 * multipart beside the words.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MutableRefObject } from "react";

vi.mock("@/components/voice/VoiceArea", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "tok" }));
// The editor's canvas has no pixels in jsdom: the stand-in hands Send a finished file, as the real one does.
vi.mock("./ShotEditor", () => ({
  default: ({ exportRef, onMarks }: { exportRef: MutableRefObject<(() => Promise<File | null>) | null>; onMarks: (n: number) => void }) => {
    exportRef.current = async () => new File([new Uint8Array([1, 2, 3])], "screenshot.webp", { type: "image/webp" });
    onMarks(2);
    return <p>the drawing board</p>;
  },
}));

import GuideFeedback from "./GuideFeedback";

const face = { look: { source: "nature", art: "scarlet-macaw" }, url: null } as never;

function stubFetch(config = { relayOn: false, villageName: "Hollow Oak" }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => (url === "/api/feedback/config" ? config : { success: true, shared: false }) };
    }),
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the feedback form in the guide's panel", () => {
  it("names the guide, offers three kinds and moves the choice with aria-pressed", async () => {
    stubFetch();
    render(<GuideFeedback guide="Ceiba" face={face} onAside={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Tell Ceiba what you found" })).toBeInTheDocument();
    const broke = screen.getByRole("button", { name: /Something broke/ });
    const felt = screen.getByRole("button", { name: /How it felt/ });
    expect(broke).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(felt);
    expect(felt).toHaveAttribute("aria-pressed", "true");
    expect(broke).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("What did you notice, and how did it feel?")).toBeInTheDocument();
  });

  it("repeats back what it heard and suggests a title from the first line, which the member can change", async () => {
    stubFetch();
    const user = userEvent.setup();
    render(<GuideFeedback guide="Ceiba" face={face} onAside={() => {}} onClose={() => {}} />);
    expect(document.querySelector("[data-guide-heard]")).toBeNull();
    await user.type(screen.getByLabelText(/What happened/), "The map is blank. I tapped a circle.");
    const heard = document.querySelector("[data-guide-heard]") as HTMLElement;
    expect(heard.textContent).toContain("What Ceiba heard");
    expect(heard.textContent).toContain("Something broke on /");
    expect(screen.getByLabelText("Title")).toHaveValue("The map is blank");
    expect(heard.textContent).toContain("Ceiba suggested this from your first line");
    // The guide repeats and suggests; it never ranks the report or the person.
    expect(heard.textContent).not.toMatch(/priority|urgent|severity|score/i);
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Blank map on a phone");
    expect(screen.getByLabelText("Title")).toHaveValue("Blank map on a phone");
  });

  it("holds Send until there is enough to act on, and says why", async () => {
    stubFetch();
    render(<GuideFeedback guide="Ceiba" face={face} onAside={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /Send to/ })).toBeDisabled();
    expect(screen.getByText(/at least ten characters/)).toBeInTheDocument();
  });

  it("sends the words as JSON into the village's queue, with the page it was about, and focuses the receipt", async () => {
    const calls = stubFetch();
    const user = userEvent.setup();
    render(<GuideFeedback guide="Ceiba" face={face} onAside={() => {}} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: /An idea/ }));
    await user.type(screen.getByLabelText(/What would help/), "A way to save a quest for later.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Send to Hollow Oak's team" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Send to Hollow Oak's team" }));
    const post = calls.find((c) => c.url === "/api/feedback")!;
    const body = JSON.parse(String(post.init!.body));
    expect(body).toMatchObject({ kind: "idea", title: "A way to save a quest for later", detail: "A way to save a quest for later.", hp: "" });
    expect(body.pageUrl).toBe(`${window.location.origin}${window.location.pathname}`);
    expect((post.init!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const receipt = await screen.findByText("Received, thank you.");
    expect(document.activeElement).toBe(receipt.closest("[data-feedback-received]"));
  });

  it("sends a screenshot as multipart beside the words, and says the screenshot stays home", async () => {
    const calls = stubFetch({ relayOn: true, villageName: "Hollow Oak" });
    const user = userEvent.setup();
    render(<GuideFeedback guide="Ceiba" face={face} onAside={() => {}} onClose={() => {}} />);
    const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(picker, { target: { files: [new File(["x"], "shot.png", { type: "image/png" })] } });
    expect(await screen.findByText("the drawing board")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/What happened/), "The button sits under the tab bar.");
    expect((document.querySelector("[data-guide-heard]") as HTMLElement).textContent).toContain("With your screenshot, and 2 marks on it.");
    expect(screen.getByText(/Your name and your screenshot stay here/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send to Hollow Oak's team" }));
    const post = calls.find((c) => c.url === "/api/feedback")!;
    const form = post.init!.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("kind")).toBe("bug");
    expect(form.get("title")).toBe("The button sits under the tab bar");
    expect((form.get("screenshot") as File).name).toBe("screenshot.webp");
    // The browser sets the multipart boundary itself; a hand-set content type would break it.
    expect((post.init!.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("steps the panel aside on a phone so the member can take a screenshot", async () => {
    stubFetch();
    const onAside = vi.fn();
    render(<GuideFeedback guide="Ceiba" face={face} onAside={onAside} onClose={() => {}} />);
    // jsdom has no getDisplayMedia: the phone's way.
    fireEvent.click(screen.getByRole("button", { name: "Step aside to take one" }));
    expect(onAside).toHaveBeenCalledWith("pill");
  });
});
