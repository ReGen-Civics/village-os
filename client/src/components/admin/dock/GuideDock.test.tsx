// @vitest-environment jsdom
/**
 * THE GUIDE'S DOCK (./GuideDock.tsx): one surface in place of the helper panel
 * and the launch guide, drawn only while the village's dock dial is on.
 *
 *   - docked and expanded with one button, remembered; Escape contracts, then closes; a phone has one shape
 *   - words that come by voice show under "You said", sit in the box to be edited, and nothing is sent
 *   - suggestions fill the box and never send
 *   - the launch and organizing guides call their own two routes, with the launch guide's own payload
 *   - who answers is named by the village's name for its guide and by Sera's, and a lent key is never called its own
 *   - a finished reply is announced once, whole
 *   - a dial goes on the save bar; a drafted change goes to review by its ticket alone; neither is written here
 *   - in a slot the dock pins nothing, and a host that holds the state is only told what was asked for
 *   - one person's draft is never read back to the next person on the same browser
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { HelperAnswer, HelperStatus } from "@shared/adminHelper";

const mic = vi.hoisted(() => ({ onText: null as null | ((chunk: string) => void) }));
/** Who is signed in. A chat draft is kept under the member's id, and a visitor's is kept nowhere (components/chat/chatDraft.ts). */
const session = vi.hoisted(() => ({ userId: null as string | null, userName: "" }));
vi.mock("@/contexts/AuthContext", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/contexts/AuthContext")>();
  return { ...real, useOptionalAuth: () => (session.userId ? { user: { id: session.userId, name: session.userName } } : null) };
});
vi.mock("@/components/MicButton", () => ({
  default: ({ onText }: { onText: (chunk: string) => void }) => {
    mic.onText = onText;
    return <button type="button">Speak instead of typing</button>;
  },
}));

import { GARDEN_GUIDE_URL } from "@shared/gardenArt";
import GuideDock, { SHORT_TALK, type DockState, type GuideDockProps } from "./GuideDock";
import { adminTabOf, splitReply } from "./replyLinks";
import type { NavGroup } from "../adminNavGroups";

const GROUPS = [
  { title: "Today", items: [{ key: "home", label: "Home", icon: (() => null) as any }] },
  { title: "What your village runs", items: [{ key: "variables", label: "Game Mechanics", icon: (() => null) as any }] },
] as NavGroup[];

const ON: HelperStatus = { on: true, guide: "Sol", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Sol" }, dock: true };
const BOTH: HelperStatus = { ...ON, available: ["anthropic", "sera"], names: { anthropic: "Sol", sera: "Sera" } };

function dock(over: Partial<GuideDockProps> = {}) {
  const onClose = vi.fn();
  const onOpenTab = vi.fn();
  const view = render(
    <GuideDock surface="admin" modes={["helper", "organize"]} password="pw" groups={GROUPS} tab="home" top={88} onClose={onClose} onOpenTab={onOpenTab} initialStatus={ON} {...over} />,
  );
  return { onClose, onOpenTab, ...view };
}

type Hit = { status?: number; body: unknown };
function mockFetch(routes: Record<string, (init: any) => Hit | Promise<Hit>>) {
  const calls: Array<{ url: string; init: any }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any = {}) => {
    calls.push({ url, init });
    const key = `${init.method ?? "GET"} ${url}`;
    const hit = routes[key];
    if (!hit) throw new Error(`unexpected ${key}`);
    const { status = 200, body } = await hit(init);
    return { ok: status < 400, status, json: async () => body } as any;
  }));
  return calls;
}

const answer = (over: Partial<HelperAnswer> = {}): HelperAnswer => ({ reply: "Here you go.", open: null, proposal: null, refused: null, consulted: [], ...over });
const box = () => screen.getByRole("textbox", { name: "Your question" }) as HTMLTextAreaElement;
const frame = () => screen.getByTestId("guide-dock");
/** The conversation itself, apart from the quiet line that reads a finished reply to a screen reader. */
const talk = () => within(screen.getByTestId("guide-talk"));
const posts = (calls: Array<{ url: string; init: any }>) => calls.filter((c) => (c.init.method ?? "GET") !== "GET");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mic.onText = null;
  session.userId = null;
  session.userName = "";
  window.history.replaceState({}, "", "/admin?tab=home");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("docked and expanded", () => {
  it("opens docked beside Admin, under the header it was handed, and says what the guide reads", () => {
    dock();
    expect(frame().getAttribute("data-shape")).toBe("docked");
    expect(frame().style.top).toBe("88px");
    expect(screen.getByRole("heading", { name: "Sol" })).toBeTruthy();
    // What she says she reads stays as the helper always said it.
    expect(screen.getByText(/never read applications, proposals, interviews, terms or pay/)).toBeTruthy();
    expect(screen.getByText(/can't help with choosing people for roles/)).toBeTruthy();
    expect(screen.queryByTestId("guide-say-yes")).toBeNull();
  });

  it("expands and contracts with the one button, and remembers the choice on this device", async () => {
    const first = dock();
    const toggle = screen.getByRole("button", { name: "Open the guide wide" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(toggle);
    expect(frame().getAttribute("data-shape")).toBe("expanded");
    expect(localStorage.getItem("guide-dock:shape")).toBe("expanded");
    // Expanded: what she has prepared is listed beside the conversation.
    expect(screen.getByRole("region", { name: "Say yes" })).toBeTruthy();
    expect(screen.getByText("Nothing is waiting on you.")).toBeTruthy();
    // The same button, now named for what it does next, and focus stays on it.
    const back = screen.getByRole("button", { name: "Bring the guide back to the side" });
    expect(back).toBe(toggle);
    expect(document.activeElement).toBe(toggle);
    first.unmount();

    // Opened again, it is as this person left it.
    dock();
    expect(frame().getAttribute("data-shape")).toBe("expanded");
    await userEvent.click(screen.getByRole("button", { name: "Bring the guide back to the side" }));
    expect(frame().getAttribute("data-shape")).toBe("docked");
    expect(localStorage.getItem("guide-dock:shape")).toBe("docked");
  });

  it("Escape contracts an expanded dock, and closes a docked one", () => {
    const { onClose } = dock({ initialShape: "expanded" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(frame().getAttribute("data-shape")).toBe("docked");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens in the shape the surface asks for when this person never chose, and a choice beats it", () => {
    const first = dock({ defaultShape: "expanded" });
    expect(frame().getAttribute("data-shape")).toBe("expanded");
    first.unmount();
    localStorage.setItem("guide-dock:shape", "docked");
    dock({ defaultShape: "expanded" });
    expect(frame().getAttribute("data-shape")).toBe("docked");
  });

  it("has one shape on a phone, full width, and no button for a second", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    localStorage.setItem("guide-dock:shape", "expanded");
    dock();
    expect(frame().getAttribute("data-shape")).toBe("docked");
    expect(frame().className).toContain("w-full");
    expect(screen.queryByTestId("guide-dock-shape")).toBeNull();
    // Escape closes it, as it closes any docked dock.
    expect(screen.getByRole("button", { name: "Close the guide" })).toBeTruthy();
  });

  it("works where the browser will not remember anything", async () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    const real = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, value: broken });
    try {
      dock();
      await userEvent.click(screen.getByRole("button", { name: "Open the guide wide" }));
      expect(frame().getAttribute("data-shape")).toBe("expanded");
    } finally {
      if (real) Object.defineProperty(window, "localStorage", real);
    }
  });

  it("gives focus to the box when it opens, and back to what opened it when it closes", () => {
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Ask your guide</button>
          {open && <GuideDock surface="admin" modes={["helper"]} password="pw" groups={GROUPS} tab="home" top={0} onClose={() => setOpen(false)} initialStatus={ON} />}
        </>
      );
    }
    render(<Page />);
    const opener = screen.getByRole("button", { name: "Ask your guide" });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(box());
    fireEvent.click(screen.getByRole("button", { name: "Close the guide" }));
    expect(screen.queryByTestId("guide-dock")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe("the talk bar", () => {
  it("YOU SAID: words that come by voice show above the box, sit in the box to edit, and nothing is sent until Send", async () => {
    const calls = mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "The Library is under Modules." }) }) });
    dock();
    expect(screen.queryByTestId("guide-you-said")).toBeNull();
    act(() => {
      mic.onText?.("put the library");
      mic.onText?.("in preview");
    });
    // Heard, shown, and in the box to be edited. Nothing asked, nothing filled anywhere else, nothing sent.
    expect(screen.getByTestId("guide-you-said").textContent).toBe("You said put the library in preview");
    expect(box()).toHaveValue("put the library in preview");
    expect(calls).toEqual([]);
    expect(screen.queryByText("The Library is under Modules.")).toBeNull();

    // The person corrects what was heard. The line still says what was heard; the box holds what will be sent.
    fireEvent.change(box(), { target: { value: "put the Library in preview please" } });
    expect(screen.getByTestId("guide-you-said").textContent).toContain("put the library in preview");
    expect(calls).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("The Library is under Modules.")).toBeTruthy();
    expect(JSON.parse(calls[0].init.body).messages).toEqual([{ role: "user", content: "put the Library in preview please" }]);
    expect(screen.queryByTestId("guide-you-said")).toBeNull();
    expect(box()).toHaveValue("");
  });

  it("YOU SAID is only for voice: typed words show no such line, and an emptied box forgets what was heard", () => {
    dock();
    fireEvent.change(box(), { target: { value: "typed by hand" } });
    expect(screen.queryByTestId("guide-you-said")).toBeNull();
    act(() => mic.onText?.("and then spoken"));
    expect(screen.getByTestId("guide-you-said").textContent).toBe("You said and then spoken");
    fireEvent.change(box(), { target: { value: "" } });
    expect(screen.queryByTestId("guide-you-said")).toBeNull();
    fireEvent.change(box(), { target: { value: "new words" } });
    expect(screen.queryByTestId("guide-you-said")).toBeNull();
  });

  it("SUGGESTIONS: three in the narrow side column and four when opened wide", async () => {
    dock({ tab: "home" });
    const offered = () => within(screen.getByRole("group", { name: "Suggested next steps" })).getAllByRole("button").map((b) => b.textContent);
    expect(offered()).toEqual(["What needs me today?", "Where do I set the timezone?", "Which page changes the menu?"]);
    await userEvent.click(screen.getByRole("button", { name: "Open the guide wide" }));
    expect(offered()).toEqual(["What needs me today?", "Where do I set the timezone?", "Which page changes the menu?", "What can you help me with?"]);
  });

  it("SUGGESTIONS: for where the person is, each fills the box and sends nothing", async () => {
    const calls = mockFetch({});
    dock({ tab: "home" });
    const group = screen.getByRole("group", { name: "Suggested next steps" });
    const offered = within(group).getAllByRole("button").map((b) => b.textContent);
    expect(offered).toEqual(["What needs me today?", "Where do I set the timezone?", "Which page changes the menu?"]);
    await userEvent.click(within(group).getByRole("button", { name: "Where do I set the timezone?" }));
    expect(box()).toHaveValue("Where do I set the timezone?");
    expect(document.activeElement).toBe(box());
    expect(calls).toEqual([]);
    // With words in the box the suggestions step aside; emptied, they are back.
    expect(screen.queryByRole("group", { name: "Suggested next steps" })).toBeNull();
    fireEvent.change(box(), { target: { value: "" } });
    expect(screen.getByRole("group", { name: "Suggested next steps" })).toBeTruthy();
  });

  it("SUGGESTIONS follow the open tab, fall back for a tab with none, and change once the conversation has started", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer() }) });
    const first = dock({ tab: "modules" });
    expect(screen.getByRole("button", { name: "Put the Library in preview." })).toBeTruthy();
    first.unmount();
    dock({ tab: "a-tab-with-no-suggestions" });
    expect(screen.getByRole("button", { name: "What needs me today?" })).toBeTruthy();
    await userEvent.type(box(), "hello{Enter}");
    expect(await screen.findByText("Here you go.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tell me more." })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "What needs me today?" })).toBeNull();
  });

  it("keeps a person's words per person: the next person on the same browser never reads them back", () => {
    session.userId = "u-ana";
    const a = dock({ password: "token-of-ana" });
    fireEvent.change(box(), { target: { value: "half a private thought" } });
    act(() => mic.onText?.("and a spoken one"));
    a.unmount();
    // Kept the way every chat draft is kept, so a sign-out that clears chat drafts clears these too.
    const keys = Object.keys(sessionStorage);
    expect(keys.length).toBeGreaterThan(0);
    // Under the member's own id, as every chat draft is, and never under anything of the session token.
    expect(keys.every((k) => k.startsWith("chat-draft:u-ana:guide-dock:"))).toBe(true);
    expect(keys.join(" ")).not.toContain("token-of-ana");

    session.userId = "u-ben";
    const b = dock({ password: "token-of-ben" });
    expect(box()).toHaveValue("");
    expect(screen.queryByTestId("guide-you-said")).toBeNull();
    b.unmount();

    session.userId = "u-ana";
    dock({ password: "token-of-ana" });
    expect(box()).toHaveValue("half a private thought and a spoken one");
    expect(screen.getByTestId("guide-you-said").textContent).toBe("You said and a spoken one");
    session.userId = null;
  });

  it("keeps nothing for somebody who is not signed in", () => {
    session.userId = null;
    const a = dock({ password: "token-of-nobody" });
    fireEvent.change(box(), { target: { value: "words with nobody to keep them for" } });
    a.unmount();
    expect(Object.keys(sessionStorage).filter((k) => k.startsWith("chat-draft:"))).toEqual([]);
  });
});

describe("the launch and organizing guides", () => {
  const journey = (over: Partial<GuideDockProps> = {}) => dock({ surface: "journey", modes: ["launch", "organize"], groups: undefined, tab: undefined, onOpenTab: undefined, ...over });

  it("call the launch guide's own two routes, with its own payload", async () => {
    const calls = mockFetch({
      "POST /api/admin/assistant/launch": () => ({ body: { reply: "Start with the closing policy at /admin?tab=season." } }),
      "POST /api/admin/assistant/organize": () => ({ body: { reply: "Consent first.", consulted: { brief: ["How we decide"], ownRecord: [], readers: ["Decisions"], references: ["Sociocracy 3.0"] } } }),
    });
    journey();
    // Launch is open first, on the greeting the launch guide's own panel opens on.
    expect(screen.getByRole("button", { name: "Launch" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/I can see exactly where your launch stands/)).toBeTruthy();
    await userEvent.type(box(), "what is blocking?{Enter}");
    expect(await talk().findByText(/Start with the closing policy/)).toBeTruthy();
    expect(calls[0].url).toBe("/api/admin/assistant/launch");
    expect(calls[0].init.headers.Authorization).toBe("Bearer pw");
    const launchSent = JSON.parse(calls[0].init.body);
    expect(Object.keys(launchSent)).toEqual(["messages"]);
    expect(launchSent.messages.map((m: any) => m.role)).toEqual(["assistant", "user"]);
    expect(launchSent.messages[1]).toEqual({ role: "user", content: "what is blocking?" });
    // The address she was told to include is a link named for its page, never the address itself.
    expect(talk().getByRole("link", { name: "Season" }).getAttribute("href")).toBe("/admin?tab=season");
    expect(screen.getByTestId("guide-talk").textContent).not.toContain("/admin");

    await userEvent.click(screen.getByRole("button", { name: "Organizing" }));
    expect(screen.getByText(/Ask me about organizing/)).toBeTruthy();
    await userEvent.type(box(), "how do we decide?{Enter}");
    expect(await screen.findByText("Consent first.")).toBeTruthy();
    expect(calls[1].url).toBe("/api/admin/assistant/organize");
    expect(JSON.parse(calls[1].init.body).messages.at(-1)).toEqual({ role: "user", content: "how do we decide?" });
    // What she read is named under the answer, as the launch guide named it.
    expect(screen.getByText(/Your brief: How we decide\./)).toBeTruthy();
    expect(screen.getByText(/Read from the village record: Decisions\./)).toBeTruthy();
    expect(screen.getByText(/References: Sociocracy 3\.0\./)).toBeTruthy();
    // Each conversation keeps its own thread.
    await userEvent.click(screen.getByRole("button", { name: "Launch" }));
    expect(talk().getByText(/Start with the closing policy/)).toBeTruthy();
    expect(talk().queryByText("Consent first.")).toBeNull();
  });

  it("offer only organizing once the village is live, with no tabs", () => {
    journey({ modes: ["organize"] });
    expect(screen.queryByRole("button", { name: "Launch" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Organizing" })).toBeNull();
    expect(screen.getByText(/Ask me about organizing/)).toBeTruthy();
  });

  it("move to organizing when the launch guide leaves the list while open", () => {
    const view = journey();
    view.rerender(<GuideDock surface="journey" modes={["organize"]} password="pw" top={0} onClose={vi.fn()} initialStatus={ON} />);
    expect(screen.getByText(/Ask me about organizing/)).toBeTruthy();
  });

  it("say so plainly when no key can answer, and keep everything else working", async () => {
    mockFetch({ "POST /api/admin/assistant/launch": () => ({ status: 503, body: { error: "assistant-unavailable" } }) });
    journey();
    await userEvent.type(box(), "hi{Enter}");
    expect(await screen.findByText(/The guide cannot answer just now/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Integrations" }).getAttribute("href")).toBe("/admin?tab=integrations");
    expect(screen.queryByRole("textbox")).toBeNull();
    // Organizing is its own conversation and still has its box.
    await userEvent.click(screen.getByRole("button", { name: "Organizing" }));
    expect(box()).toBeTruthy();
  });

  it("do not need the helper to be on: the launch guide answers on whatever key the engine has", () => {
    journey({ initialStatus: { on: false, guide: "Sol", off: "key", provider: null, available: [], names: {}, dock: true } });
    expect(box()).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sol" })).toBeTruthy();
    expect(screen.queryByText("Connect Claude to turn on your helper")).toBeNull();
  });

  it("are offered beside Admin too, and the helper stays off there until a key can answer", async () => {
    dock({ initialStatus: { on: false, guide: "Sol", off: "key", provider: null, available: [], names: {}, dock: true } });
    expect(screen.getByText("Connect Claude to turn on your helper")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Organizing" }));
    expect(box()).toBeTruthy();
  });
});

describe("who answers", () => {
  it("is said, on the village's own key, by the name the village gave its guide", () => {
    dock();
    expect(screen.getByTestId("guide-who-answers").textContent).toBe("Sol is answering, on Claude with your village's own Anthropic key.");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("never calls a lent key the village's own", () => {
    dock({ initialStatus: { ...ON, lent: true } });
    const line = screen.getByTestId("guide-who-answers").textContent ?? "";
    expect(line).toBe("Sol is answering, on Claude with a key the platform lends for now.");
    expect(line).not.toContain("own");
  });

  it("offers the village's guide or Sera by their names, never the model's, and sends the pick", async () => {
    const calls = mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "Hi from Sera." }) }) });
    dock({ initialStatus: BOTH });
    const choice = screen.getByRole("radiogroup", { name: "Who you're talking to" });
    expect(within(choice).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Sol", "Sera"]);
    expect(screen.queryByRole("radio", { name: "Claude" })).toBeNull();
    expect(within(choice).getByRole("radio", { name: "Sol" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(within(choice).getByRole("radio", { name: "Sera" }));
    expect(screen.getByRole("heading", { name: "Sera" })).toBeTruthy();
    expect(screen.getByTestId("guide-who-answers").textContent).toBe("Sera is answering, through your village's org memory connection.");
    await userEvent.type(box(), "hi{Enter}");
    expect(await screen.findByText("Hi from Sera.")).toBeTruthy();
    expect(JSON.parse(calls[0].init.body).provider).toBe("sera");
    // The pick is the one the helper panel remembers, so both surfaces agree.
    expect(localStorage.getItem("admin-helper-provider")).toBe("sera");
  });

  it("names an unnamed guide plainly, and never hides it", () => {
    dock({ initialStatus: { ...ON, guide: "your village guide", names: { anthropic: "your village guide" } } });
    expect(screen.getByRole("heading", { name: "Your village guide" })).toBeTruthy();
    expect(screen.getByTestId("guide-who-answers").textContent).toContain("Your village guide is answering");
  });

  it("shows the helper's own off states: switched off by the village, or no key yet", () => {
    const off = dock({ initialStatus: { on: false, guide: "Sol", off: "switch", provider: null, available: [], names: {}, dock: true }, modes: ["helper"] });
    expect(screen.getByText("Your helper is switched off")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    off.unmount();
    const { onOpenTab } = dock({ initialStatus: { on: false, guide: "Sol", off: "key", provider: null, available: [], names: {}, dock: true }, modes: ["helper"] });
    fireEvent.click(screen.getByRole("button", { name: "Open Integrations" }));
    expect(onOpenTab).toHaveBeenCalledWith("integrations");
  });
});

describe("a finished reply", () => {
  it("is announced once, whole, when it is finished, and the conversation itself is not a live region", async () => {
    let release: (hit: Hit) => void = () => {};
    mockFetch({ "POST /api/admin/helper/ask": () => new Promise<Hit>((resolve) => (release = resolve)) });
    dock();
    const said = screen.getByTestId("guide-announce");
    expect(said.getAttribute("role")).toBe("status");
    expect(said.getAttribute("aria-live")).toBe("polite");
    expect(said.getAttribute("aria-atomic")).toBe("true");
    expect(said.textContent).toBe("");
    // The talk is plain: no live region that would read each line as it lands.
    expect(screen.getByTestId("guide-talk").closest("[aria-live]")).toBeNull();

    await userEvent.type(box(), "where are the rules?{Enter}");
    // While she is thinking, nothing is announced.
    expect(await screen.findByText("Sol is thinking")).toBeTruthy();
    expect(said.textContent).toBe("");
    await act(async () => release({ body: answer({ reply: "Game Mechanics holds every rule." }) }));
    await waitFor(() => expect(said.textContent).toBe("Sol says: Game Mechanics holds every rule."));
    // Exactly one live region holds the reply.
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
  });

  it("puts the day's limit in plain words", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ status: 503, body: { error: "assistant-unavailable" } }) });
    dock();
    await userEvent.type(box(), "hi{Enter}");
    expect((await screen.findByRole("alert")).textContent).toBe("The guide has answered all it can for today. It starts again tomorrow.");
  });

  it("opens the page it names", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "Game Mechanics holds every rule.", open: { key: "variables", label: "Game Mechanics" } }) }) });
    const { onOpenTab } = dock();
    await userEvent.type(box(), "where are the rules?{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: /Open Game Mechanics/ }));
    expect(onOpenTab).toHaveBeenCalledWith("variables");
  });

  it("names every control", () => {
    dock({ initialStatus: BOTH, initialShape: "expanded" });
    for (const b of screen.getAllByRole("button")) expect((b.getAttribute("aria-label") || b.textContent || "").trim(), b.outerHTML).not.toBe("");
    for (const r of screen.getAllByRole("radio")) expect((r.textContent || "").trim()).not.toBe("");
    expect(box()).toBeTruthy();
  });
});

describe("what she prepared", () => {
  const PROPOSAL = { key: "feed.show_birthdays", label: "Show birthdays", category: "Feed", from: "false", to: "true", why: "You asked for it.", applyPath: "/api/admin/variables/feed.show_birthdays" };
  const FILING = { summary: "Add an FAQ on parking.", where: "Resident page", fields: [{ label: "Question", value: "Where do I park?" }, { label: "Answer", value: "By the barn." }], ticket: "signed.ticket" };

  it("a dial: the helper's own card, handed to the save bar, and written by nobody here", async () => {
    const calls = mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "I can switch that for you.", proposal: PROPOSAL }) }) });
    const onReview = vi.fn();
    dock({ onReview });
    await userEvent.type(box(), "show birthdays{Enter}");
    const card = await screen.findByTestId("helper-proposal");
    expect(card.textContent).toContain("Show birthdays");
    expect(screen.getByRole("link", { name: "Take me there" }).getAttribute("href")).toBe("/admin?tab=variables&variable=feed.show_birthdays");
    await userEvent.click(screen.getByRole("button", { name: "Review and save" }));
    expect(onReview).toHaveBeenCalledWith(PROPOSAL);
    expect(calls.filter((c) => c.init.method === "PUT")).toEqual([]);
  });

  it("expanded: the card is listed under Say yes, and the conversation points to it", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "I can switch that for you.", proposal: PROPOSAL }) }) });
    const onReview = vi.fn();
    dock({ onReview, initialShape: "expanded" });
    await userEvent.type(box(), "show birthdays{Enter}");
    const list = screen.getByRole("region", { name: "Say yes" });
    expect(await within(list).findByTestId("helper-proposal")).toBeTruthy();
    // One card, in one place.
    expect(screen.getAllByTestId("helper-proposal")).toHaveLength(1);
    expect(within(screen.getByTestId("guide-talk")).getByTestId("guide-prepared-pointer").textContent).toBe("Prepared for you. It waits under Say yes.");
    await userEvent.click(within(list).getByRole("button", { name: "Review and save" }));
    expect(onReview).toHaveBeenCalledWith(PROPOSAL);
  });

  it("expanded: a change still on the save bar from an earlier visit is listed too", async () => {
    const onUnreview = vi.fn();
    dock({ initialShape: "expanded", onBar: [PROPOSAL], waiting: ["feed.show_birthdays=true"], onUnreview });
    const list = screen.getByRole("region", { name: "Say yes" });
    expect(within(list).getByText(/Waiting on the save bar at the bottom\./)).toBeTruthy();
    await userEvent.click(within(list).getByRole("button", { name: "Take it off the bar" }));
    expect(onUnreview).toHaveBeenCalledWith(PROPOSAL);
  });

  it("a waiting or saved card says so; Not now leaves it as it was", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ proposal: PROPOSAL }) }) });
    const view = dock({ waiting: ["feed.show_birthdays=true"] });
    await userEvent.type(box(), "x{Enter}");
    expect(await screen.findByText(/Waiting on the save bar at the bottom\./)).toBeTruthy();
    view.rerender(<GuideDock surface="admin" modes={["helper", "organize"]} password="pw" groups={GROUPS} tab="home" top={88} onClose={vi.fn()} initialStatus={ON} saved={["feed.show_birthdays=true"]} />);
    expect(await screen.findByText("Saved.")).toBeTruthy();
  });

  it("SEND TO REVIEW: a drafted change is filed by its ticket alone, and the card says nothing has changed", async () => {
    const calls = mockFetch({
      "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "I drafted it for review.", filing: FILING }) }),
      "POST /api/admin/helper/file": () => ({ body: { state: "filed", code: "B-3.1", words: "", reviewAt: "/admin/proposals" } }),
    });
    dock();
    await userEvent.type(box(), "add an FAQ about parking{Enter}");
    const card = await screen.findByTestId("guide-filing");
    expect(card.textContent).toContain("Drafted for review");
    expect(card.textContent).toContain("Add an FAQ on parking.");
    expect(card.textContent).toContain("Resident page");
    expect(card.textContent).toContain("Where do I park?");
    expect(card.textContent).toContain("This goes to the review page. Nothing changes until a person accepts it there.");
    // Drawn, and nothing filed yet.
    expect(posts(calls).map((c) => c.url)).toEqual(["/api/admin/helper/ask"]);

    await userEvent.click(within(card).getByRole("button", { name: "Send to review" }));
    expect(await within(card).findByText("Sent to review as B-3.1. Nothing changes until a person accepts it there.")).toBeTruthy();
    const filed = posts(calls)[1];
    expect(filed.url).toBe("/api/admin/helper/file");
    // The ticket and nothing else: the browser never sends a body of its own.
    expect(JSON.parse(filed.init.body)).toEqual({ ticket: "signed.ticket" });
    expect(filed.init.headers.Authorization).toBe("Bearer pw");
    expect(within(card).getByRole("link", { name: "Open the review page" }).getAttribute("href")).toBe("/admin/proposals");
    expect(within(card).queryByRole("button", { name: "Send to review" })).toBeNull();
    // The guide applied nothing.
    expect(calls.filter((c) => c.init.method === "PUT")).toEqual([]);
  });

  it("SEND TO REVIEW: the queue's refusal stays on the card in its own words, and the change can be sent again", async () => {
    let refuse = true;
    mockFetch({
      "POST /api/admin/helper/ask": () => ({ body: answer({ filing: FILING }) }),
      "POST /api/admin/helper/file": () => (refuse ? { status: 400, body: { error: "An FAQ needs its question." } } : { body: { state: "waiting", code: "B-2.4", words: "", reviewAt: "/admin/proposals" } }),
    });
    dock();
    await userEvent.type(box(), "add an FAQ{Enter}");
    const card = await screen.findByTestId("guide-filing");
    await userEvent.click(within(card).getByRole("button", { name: "Send to review" }));
    expect((await within(card).findByRole("alert")).textContent).toBe("An FAQ needs its question.");
    refuse = false;
    await userEvent.click(within(card).getByRole("button", { name: "Send to review" }));
    expect(await within(card).findByText("The same change already waits on the review page, as B-2.4.")).toBeTruthy();
  });

  it("SEND TO REVIEW: Not now leaves it as it was, and files nothing", async () => {
    const calls = mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ filing: FILING }) }) });
    dock();
    await userEvent.type(box(), "add an FAQ{Enter}");
    const card = await screen.findByTestId("guide-filing");
    await userEvent.click(within(card).getByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("guide-filing")).toBeNull();
    expect(screen.getByText("Left as it was.")).toBeTruthy();
    expect(posts(calls).map((c) => c.url)).toEqual(["/api/admin/helper/ask"]);
  });

  it("says why when the guide may not make a change", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "That one is yours.", refused: "A role's terms and pay stay in your own hands, so the guide does not draft them." }) }) });
    dock();
    await userEvent.type(box(), "raise the pay{Enter}");
    expect(await screen.findByText(/stay in your own hands/)).toBeTruthy();
    expect(screen.queryByTestId("guide-filing")).toBeNull();
    expect(screen.queryByTestId("helper-proposal")).toBeNull();
  });
});

describe("in a slot, with the host holding the state", () => {
  function Slot({ start = "docked" as "docked" | "expanded", heard }: { start?: "docked" | "expanded"; heard: (next: DockState) => void }) {
    const [state, setState] = useState<DockState>(start);
    if (state === "closed") return <p>closed by the host</p>;
    return (
      <div style={{ width: 320, height: 480 }}>
        <GuideDock
          surface="admin"
          placement="slot"
          modes={["helper"]}
          password="pw"
          groups={GROUPS}
          tab="home"
          initialStatus={ON}
          state={state}
          onStateChange={(next) => {
            heard(next);
            setState(next);
          }}
        />
      </div>
    );
  }

  it("fills its container and pins nothing: no fixed position, no top or bottom, no layer of its own", () => {
    render(<Slot heard={vi.fn()} />);
    const el = frame();
    expect(el.getAttribute("data-placement")).toBe("slot");
    const classes = el.className.split(/\s+/);
    expect(classes).not.toContain("fixed");
    expect(classes.some((c) => /^z-/.test(c))).toBe(false);
    expect(classes.some((c) => /^(top|bottom|left|right|inset)-/.test(c))).toBe(false);
    expect(el.style.top).toBe("");
    expect(el.style.bottom).toBe("");
    expect(el.getAttribute("style")).toBeNull();
    // It fills what it is given, never wider, and keeps its inside from spilling sideways.
    expect(classes).toEqual(expect.arrayContaining(["h-full", "w-full", "min-w-0", "min-h-0", "overflow-hidden"]));
  });

  it("the buttons and Escape only tell the host what was asked, in the three words, and nothing is remembered here", async () => {
    const heard = vi.fn();
    render(<Slot heard={heard} />);
    await userEvent.click(screen.getByRole("button", { name: "Open the guide wide" }));
    expect(heard).toHaveBeenLastCalledWith("expanded");
    expect(frame().getAttribute("data-shape")).toBe("expanded");
    await userEvent.click(screen.getByRole("button", { name: "Bring the guide back to the side" }));
    expect(heard).toHaveBeenLastCalledWith("docked");
    expect(frame().getAttribute("data-shape")).toBe("docked");
    await userEvent.click(screen.getByRole("button", { name: "Open the guide wide" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(heard).toHaveBeenLastCalledWith("docked");
    await userEvent.click(screen.getByRole("button", { name: "Close the guide" }));
    expect(heard).toHaveBeenLastCalledWith("closed");
    expect(screen.getByText("closed by the host")).toBeTruthy();
    expect(heard.mock.calls.map((c) => c[0])).toEqual(["expanded", "docked", "expanded", "docked", "closed"]);
    expect(localStorage.getItem("guide-dock:shape")).toBeNull();
  });

  it("draws the state the host holds, whatever this browser remembered, and does not move without it", async () => {
    localStorage.setItem("guide-dock:shape", "expanded");
    const heard = vi.fn();
    render(<GuideDock surface="admin" placement="slot" modes={["helper"]} password="pw" groups={GROUPS} tab="home" initialStatus={ON} state="docked" onStateChange={heard} />);
    expect(frame().getAttribute("data-shape")).toBe("docked");
    await userEvent.click(screen.getByRole("button", { name: "Open the guide wide" }));
    // Told, and unmoved until the host says so.
    expect(heard).toHaveBeenCalledWith("expanded");
    expect(frame().getAttribute("data-shape")).toBe("docked");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(heard).toHaveBeenLastCalledWith("closed");
  });

  it("keeps both shapes on a narrow window: the host decides, never the window's width", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<Slot start="expanded" heard={vi.fn()} />);
    expect(frame().getAttribute("data-shape")).toBe("expanded");
    expect(screen.getByRole("button", { name: "Bring the guide back to the side" })).toBeTruthy();
  });
});

describe("night first, a face, and a warm first line", () => {
  it("carries the garden's scope on its own root in both placements, so it is night whatever the page is", () => {
    const fixed = dock();
    expect(frame().className.split(/\s+/)).toContain("garden");
    fixed.unmount();
    render(<GuideDock surface="admin" placement="slot" modes={["helper"]} password="pw" groups={GROUPS} tab="home" initialStatus={ON} state="docked" onStateChange={vi.fn()} />);
    expect(frame().className.split(/\s+/)).toContain("garden");
  });

  it("holds itself to tokens in every state: no numbered palette class and no literal colour anywhere in it", async () => {
    mockFetch({
      "POST /api/admin/helper/ask": () => ({
        body: answer({
          reply: "Here.",
          open: { key: "variables", label: "Game Mechanics" },
          proposal: { key: "feed.x", label: "X", category: "Feed", from: "1", to: "2", why: "Asked.", applyPath: "/api/admin/variables/feed.x" },
          refused: "A reason.",
        }),
      }),
    });
    dock({ initialStatus: { ...BOTH, lent: true }, initialShape: "expanded" });
    await userEvent.type(box(), "x{Enter}");
    await screen.findByTestId("helper-proposal");
    const classes = [frame(), ...Array.from(frame().querySelectorAll("*"))].flatMap((el) => String(el.getAttribute("class") ?? "").split(/\s+/));
    const numbered = classes.filter((c) => /(?:^|:)(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|placeholder|divide|shadow)-(?:[a-z]+-)?(?:50|[1-9]00|950)(?:\/\d+)?$/.test(c));
    expect(numbered).toEqual([]);
    expect(classes.filter((c) => /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\(/i.test(c))).toEqual([]);
  });

  it("shows her portrait in a ring beside her name, as decoration, and a letter when the painting will not load", () => {
    dock();
    const face = screen.getByTestId("guide-face");
    const img = face.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(GARDEN_GUIDE_URL);
    // Her name is beside it, so the picture says nothing of its own.
    expect(img.getAttribute("alt")).toBe("");
    expect(face.className.split(/\s+/)).toContain("gd-ring");
    expect(screen.getByRole("heading", { name: "Sol" })).toBeTruthy();
    fireEvent.error(img);
    expect(face.querySelector("img")).toBeNull();
    expect(face.textContent).toBe("S");
    expect(face.querySelector("[aria-hidden='true']")).toBeTruthy();
  });

  it("does not put the village guide's face on Sera", async () => {
    dock({ initialStatus: BOTH });
    await userEvent.click(screen.getByRole("radio", { name: "Sera" }));
    const face = screen.getByTestId("guide-face");
    expect(face.querySelector("img")).toBeNull();
    expect(face.textContent).toBe("S");
  });

  it("says who is answering under her name, for the launch and organizing guides too", async () => {
    dock({ initialStatus: { ...ON, lent: true } });
    expect(screen.getByTestId("guide-who-answers").textContent).toBe("Sol is answering, on Claude with a key the platform lends for now.");
    await userEvent.click(screen.getByRole("button", { name: "Organizing" }));
    expect(screen.getByTestId("guide-who-answers").textContent).toBe("Sol is answering, on Claude with a key the platform lends for now.");
    cleanup();
    // With no key that can answer, nothing is claimed.
    dock({ modes: ["organize"], initialStatus: { on: false, guide: "Sol", off: "key", provider: null, available: [], names: {}, dock: true } });
    expect(screen.queryByTestId("guide-who-answers")).toBeNull();
  });

  it("opens with one warm line in her voice, by first name when the page knows it, then what she does and reads", () => {
    const anonymous = dock();
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Hello. What are we tending today?");
    anonymous.unmount();

    session.userId = "u-rye";
    session.userName = "Rye Ashby";
    const signedIn = dock();
    const line = screen.getByTestId("guide-first-line");
    expect(line.textContent).toBe("Hello, Rye. What are we tending today?");
    // One line, plain, and nothing that scores or ranks anybody.
    expect(line.textContent).not.toMatch(/!|\b(best|top|score|rank|better than)\b/i);
    // What she reads and never reads follows it, from its one place, word for word as before.
    expect(line.nextElementSibling?.textContent).toMatch(/^Ask me how to do something in Admin/);
    expect(screen.getByText(/never read applications, proposals, interviews, terms or pay/)).toBeTruthy();
    signedIn.unmount();

    // A host that knows the name better says so.
    dock({ personName: "Ana Maria Soto" });
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Hello, Ana. What are we tending today?");
  });

  it("drops the first line once the conversation has started", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer() }) });
    dock();
    await userEvent.type(box(), "hi{Enter}");
    expect(await talk().findByText("Here you go.")).toBeTruthy();
    expect(screen.queryByTestId("guide-first-line")).toBeNull();
  });
});

describe("never a raw address in her words", () => {
  const says = (reply: string) => mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply }) }) });
  const bubble = () => screen.getByTestId("guide-talk");

  it("she names the control and links it", async () => {
    says("The season's dates live at /admin?tab=variables, under Village. Open /admin?tab=variables and I will show you.");
    dock();
    await userEvent.type(box(), "where are the dates?{Enter}");
    const links = await talk().findAllByRole("link", { name: "Game Mechanics" });
    // Named by the Admin map the dock was handed, and linked to the tab itself.
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("/admin?tab=variables");
    // The address is nowhere in what she is seen to say, or in what is read aloud.
    expect(bubble().textContent).not.toContain("/admin");
    expect(bubble().textContent).toContain("The season's dates live at Game Mechanics, under Village.");
    expect(screen.getByTestId("guide-announce").textContent).toBe("Sol says: The season's dates live at Game Mechanics, under Village. Open Game Mechanics and I will show you.");
    // Inside Admin the link is Admin's own navigation: the tab changes in place.
    await userEvent.click(links[0]);
    expect(window.location.search).toBe("?tab=variables");
  });

  it("names a tab the dock's map does not carry from Admin's own table of tabs", async () => {
    says("Set the closing policy at /admin?tab=season.");
    dock();
    await userEvent.type(box(), "x{Enter}");
    expect((await talk().findByRole("link", { name: "Season" })).getAttribute("href")).toBe("/admin?tab=season");
    expect(bubble().textContent).not.toContain("/admin");
  });

  it("names a launch row's Admin tab by the tab's name, and keeps the row's own label for an address nothing else names", async () => {
    mockFetch({
      "POST /api/admin/assistant/launch": () => ({ body: { reply: "Next, go to /admin?tab=season and say how a season ends. Then read /governance/how#game-mechanics with the others." } }),
    });
    dock({
      surface: "journey", modes: ["launch"], groups: undefined, tab: undefined, onOpenTab: undefined,
      // A launch row's label is written for a button, so it starts with a verb.
      linkNames: { "/admin?tab=season": "Open Season", "/governance/how#game-mechanics": "Open the game mechanics" },
    });
    await userEvent.type(box(), "what next?{Enter}");
    // The tab's own name, a noun, reads as a place inside her sentence.
    expect((await talk().findByRole("link", { name: "Season" })).getAttribute("href")).toBe("/admin?tab=season");
    expect(bubble().textContent).toContain("Next, go to Season and say how a season ends.");
    expect(bubble().textContent).not.toContain("Open Season");
    // No tab and no known page names this one, so the row's label does.
    expect(talk().getByRole("link", { name: "Open the game mechanics" }).getAttribute("href")).toBe("/governance/how#game-mechanics");
    expect(bubble().textContent).not.toContain("/admin");
    expect(bubble().textContent).not.toContain("/governance");
  });

  it("names the pages it knows, and says Open the page for an address nothing names", async () => {
    says("It waits at /admin/proposals. The checklist is at /journey-to-launch, and there is more at /somewhere/new.");
    dock();
    await userEvent.type(box(), "x{Enter}");
    expect((await talk().findByRole("link", { name: "the review page" })).getAttribute("href")).toBe("/admin/proposals");
    expect(talk().getByRole("link", { name: "the road to launch" }).getAttribute("href")).toBe("/journey-to-launch");
    expect(talk().getByRole("link", { name: "Open the page" }).getAttribute("href")).toBe("/somewhere/new");
    expect(bubble().textContent).not.toMatch(/\/admin|\/journey|\/somewhere/);
  });

  it("leaves a reply with no address exactly as it was, and an outside link as plain text", async () => {
    const plain = "Turn it on and/or leave it. See https://example.org/admin?tab=season for 3/4 of the detail.";
    says(plain);
    dock();
    await userEvent.type(box(), "x{Enter}");
    expect(await talk().findByText(plain)).toBeTruthy();
    expect(talk().queryAllByRole("link")).toEqual([]);
    expect(screen.getByTestId("guide-announce").textContent).toBe(`Sol says: ${plain}`);
  });

  it("cuts a reply into its words and its internal addresses, and nothing else", () => {
    expect(splitReply("Open /admin?tab=season, then (see /journey-to-launch).")).toEqual([
      { text: "Open " },
      { href: "/admin?tab=season" },
      { text: ", then (see " },
      { href: "/journey-to-launch" },
      { text: ")." },
    ]);
    expect(splitReply("/governance/how#mechanics is first")).toEqual([{ href: "/governance/how#mechanics" }, { text: " is first" }]);
    for (const none of ["and/or", "3/4 done", "https://example.org/a/b", "a path like x/y/z", "mailto:someone", "//cdn.example/x"]) {
      expect(splitReply(none), none).toEqual([{ text: none }]);
    }
    expect(splitReply("")).toEqual([]);
    expect(adminTabOf("/admin?tab=org-chart&x=1")).toBe("org-chart");
    expect(adminTabOf("/admin?tab=../x")).toBeNull();
    expect(adminTabOf("/journey-to-launch?tab=season")).toBeNull();
  });
});

describe("Say yes has half the dock while there is little talk", () => {
  const PROPOSAL = { key: "feed.show_birthdays", label: "Show birthdays", category: "Feed", from: "false", to: "true", why: "You asked for it.", applyPath: "/api/admin/variables/feed.show_birthdays" };
  const list = () => screen.getByTestId("guide-say-yes");
  const widths = () => list().className.split(/\s+/).filter((c) => /:w-/.test(c));

  it("takes half the width with something prepared and one question and its answer, and the narrow column once the talk grows", async () => {
    let n = 0;
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: n++ === 0 ? answer({ reply: "I can switch that for you.", proposal: PROPOSAL }) : answer({ reply: "Gladly." }) }) });
    dock({ initialShape: "expanded" });
    // Nothing prepared yet: the narrow column, quiet beside the conversation.
    expect(list().hasAttribute("data-roomy")).toBe(false);
    expect(widths()).toEqual(["@min-[44rem]:w-[19rem]", "@min-[64rem]:w-[24rem]"]);

    await userEvent.type(box(), "show birthdays{Enter}");
    await within(list()).findByTestId("helper-proposal");
    // One question and its answer is a short talk.
    expect(SHORT_TALK).toBe(2);
    expect(list().getAttribute("data-roomy")).toBe("true");
    expect(widths()).toEqual(["@min-[44rem]:w-1/2"]);

    await userEvent.type(box(), "thank you{Enter}");
    expect(await talk().findByText("Gladly.")).toBeTruthy();
    // The talk has grown: the conversation has the room again, and the card is still listed.
    expect(list().hasAttribute("data-roomy")).toBe(false);
    expect(widths()).toEqual(["@min-[44rem]:w-[19rem]", "@min-[64rem]:w-[24rem]"]);
    expect(within(list()).getByTestId("helper-proposal")).toBeTruthy();
  });

  it("holds for a change still on the save bar from an earlier visit, before anything is said", () => {
    dock({ initialShape: "expanded", onBar: [PROPOSAL], waiting: ["feed.show_birthdays=true"] });
    expect(list().getAttribute("data-roomy")).toBe("true");
  });

  it("is a rule of the wide view only: no numbered palette class comes with it", () => {
    dock({ initialShape: "expanded", onBar: [PROPOSAL], waiting: ["feed.show_birthdays=true"] });
    expect(list().className).not.toMatch(/(?:bg|text|border)-[a-z]+-\d{2,3}\b/);
  });
});
