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
 *   - what she says she reads follows the rules the status names, and her advice is a card with one button and no apply
 *   - in a slot the dock pins nothing, and a host that holds the state is only told what was asked for
 *   - one person's draft is never read back to the next person on the same browser
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { HelperAdvice, HelperAnswer, HelperStatus } from "@shared/adminHelper";

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
import { GUIDE_SPEAKING as SERVER_SPEAKING } from "@shared/guideSpeaking";
import { forgetPageCopy } from "../garden/gardenMemory";
import { GUIDE_SPEAKING as GARDEN_SPEAKING } from "../garden/speaking";
import GuideDock, { SHORT_TALK, type DockState, type GuideDockProps } from "./GuideDock";
import { adminTabOf, splitReply } from "./replyLinks";
import type { NavGroup } from "../adminNavGroups";

const GROUPS = [
  { title: "Today", items: [{ key: "home", label: "Home", icon: (() => null) as any }] },
  { title: "What your village runs", items: [{ key: "variables", label: "Game Mechanics", icon: (() => null) as any }] },
] as NavGroup[];

const ON: HelperStatus = { on: true, guide: "Sol", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Sol" }, dock: true };
const BOTH: HelperStatus = { ...ON, available: ["anthropic", "sera"], names: { anthropic: "Sol", sera: "Sera" } };

/** Half past seven in the evening, so her greeting is the same on any clock a test runs by. */
const EVENING = new Date(2026, 10, 28, 19, 30);

function dock(over: Partial<GuideDockProps> = {}) {
  const onClose = vi.fn();
  const onOpenTab = vi.fn();
  const view = render(
    <GuideDock surface="admin" modes={["helper", "organize"]} password="pw" groups={GROUPS} tab="home" top={88} onClose={onClose} onOpenTab={onOpenTab} initialStatus={ON} now={EVENING} {...over} />,
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
  // The garden keeps a page copy of what it remembers: each test starts as a browser just opened.
  forgetPageCopy();
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
    expect(screen.getByText(/don't read applications, proposals, interviews, terms or pay/)).toBeTruthy();
    expect(screen.getByText(/take no part in choosing people for roles/)).toBeTruthy();
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
    expect(screen.getByRole("region", { name: "Ready for your yes" })).toBeTruthy();
    expect(screen.getByText("Nothing waits for your yes.")).toBeTruthy();
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
    // Launch is open first, on her first words: a greeting, then what blocks.
    expect(screen.getByRole("button", { name: "Launch" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Evening. Ask me what blocks the launch, or about any step that is left.");
    await userEvent.type(box(), "what is blocking?{Enter}");
    expect(await talk().findByText(/Start with the closing policy/)).toBeTruthy();
    expect(calls[0].url).toBe("/api/admin/assistant/launch");
    expect(calls[0].init.headers.Authorization).toBe("Bearer pw");
    const launchSent = JSON.parse(calls[0].init.body);
    expect(Object.keys(launchSent)).toEqual(["messages"]);
    expect(launchSent.messages.map((m: any) => m.role)).toEqual(["assistant", "user"]);
    // Her first words are the first turn, as the launch guide's own greeting always was; what is sent is what was read.
    expect(launchSent.messages[0]).toEqual({ role: "assistant", content: "Evening. Ask me what blocks the launch, or about any step that is left." });
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
    // An alert, never in her voice: what happened, then the fix.
    expect((await screen.findByRole("alert")).textContent).toBe("The guide can't answer right now. Add a key under Integrations, or try again tomorrow.");
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

  it("expanded: the change is listed under Ready for your yes, and the conversation points to it", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "I can switch that for you.", proposal: PROPOSAL }) }) });
    const onReview = vi.fn();
    dock({ onReview, initialShape: "expanded" });
    await userEvent.type(box(), "show birthdays{Enter}");
    const list = screen.getByRole("region", { name: "Ready for your yes" });
    expect(await within(list).findByTestId("helper-proposal")).toBeTruthy();
    // One card, in one place.
    expect(screen.getAllByTestId("helper-proposal")).toHaveLength(1);
    expect(within(screen.getByTestId("guide-talk")).getByTestId("guide-prepared-pointer").textContent).toBe("I prepared this. It waits under Ready for your yes.");
    await userEvent.click(within(list).getByRole("button", { name: "Review and save" }));
    expect(onReview).toHaveBeenCalledWith(PROPOSAL);
  });

  it("expanded: a change still on the save bar from an earlier visit is listed too", async () => {
    const onUnreview = vi.fn();
    dock({ initialShape: "expanded", onBar: [PROPOSAL], waiting: ["feed.show_birthdays=true"], onUnreview });
    const list = screen.getByRole("region", { name: "Ready for your yes" });
    expect(within(list).getByText("Waiting for your Save at the bottom of the page. Nothing is saved until you press it.")).toBeTruthy();
    await userEvent.click(within(list).getByRole("button", { name: "Set it aside" }));
    expect(onUnreview).toHaveBeenCalledWith(PROPOSAL);
  });

  it("a waiting or saved card says so; Not now leaves it as it was", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ proposal: PROPOSAL }) }) });
    const view = dock({ waiting: ["feed.show_birthdays=true"] });
    await userEvent.type(box(), "x{Enter}");
    expect(await screen.findByText(/Waiting for your Save at the bottom of the page\./)).toBeTruthy();
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
    expect(card.textContent).toContain("A change I drafted for review");
    expect(card.textContent).toContain("Add an FAQ on parking.");
    expect(card.textContent).toContain("Resident page");
    expect(card.textContent).toContain("Where do I park?");
    expect(card.textContent).toContain("It goes to the review page. Nothing changes until a person accepts it there.");
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

  it("greets by the part of the day and the first name, then says what she can do when nothing waits, then what she reads", () => {
    const anonymous = dock();
    // Nobody told her what waits: she says what she can do, and claims nothing either way.
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Evening. Ask me where something lives, or name a change and I'll prepare it for your yes.");
    expect(screen.getByTestId("guide-first-line").textContent).not.toMatch(/nothing (is )?(waiting|needs)/i);
    anonymous.unmount();

    session.userId = "u-rye";
    session.userName = "Rye Ashby";
    const signedIn = dock();
    const line = screen.getByTestId("guide-first-line");
    expect(line.textContent).toBe("Evening, Rye. Ask me where something lives, or name a change and I'll prepare it for your yes.");
    // Warm and plain: three sentences at most, no figure of speech from the garden, nothing that scores or ranks anybody.
    expect(line.textContent!.split(/(?<=[.?])\s+/)).toHaveLength(2);
    expect(line.textContent).not.toMatch(/!|\b(tending|lantern|stone|best|top|score|rank|better than)\b/i);
    // What she reads and never reads follows, true to the code as it stands.
    expect(screen.getByTestId("guide-reads").textContent).toBe(
      "I read settings, help text and the shape of the org chart. I don't read applications, proposals, interviews, terms or pay, and I take no part in choosing people for roles. I don't move money.",
    );
    expect(line.nextElementSibling).toBe(screen.getByTestId("guide-reads"));
    signedIn.unmount();

    // A host that knows the name better says so, and the greeting follows the clock.
    const morning = dock({ personName: "Ana Maria Soto", now: new Date(2026, 10, 28, 8, 0) });
    expect(screen.getByTestId("guide-first-line").textContent).toMatch(/^Morning, Ana\. /);
    morning.unmount();
    dock({ personName: "Ana Maria Soto", now: new Date(2026, 10, 28, 14, 0) });
    expect(screen.getByTestId("guide-first-line").textContent).toMatch(/^Afternoon, Ana\. /);
  });

  it("leads with what is ready for a yes, says what she did and what she left, and never claims the save", () => {
    const PROPOSAL = { key: "feed.x", label: "X", category: "Feed", from: "1", to: "2", why: "", applyPath: "/api/admin/variables/feed.x" };
    const one = dock({ personName: "Rye", onBar: [PROPOSAL], waiting: ["feed.x=2"] });
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Evening, Rye. One change is ready for your yes. It waits at the bottom of the page, and nothing is saved until you press Save.");
    one.unmount();
    dock({ personName: "Rye", onBar: [PROPOSAL, { ...PROPOSAL, key: "feed.y" }, { ...PROPOSAL, key: "feed.z" }], waiting: [] });
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Evening, Rye. Three changes are ready for your yes. They wait at the bottom of the page, and nothing is saved until you press Save.");
  });

  it("on the road to launch she leads with what blocks, as a number the page gave her, and invents none", () => {
    const base = { surface: "journey" as const, modes: ["launch"] as const, groups: undefined, tab: undefined, onOpenTab: undefined, personName: "Rye" };
    const three = dock({ ...base, blocking: 3 });
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Evening, Rye. Three things block the launch. Shall we take the first one?");
    three.unmount();
    const one = dock({ ...base, blocking: 1 });
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Evening, Rye. One thing blocks the launch. Shall we take it now?");
    one.unmount();
    const none = dock({ ...base, blocking: 0 });
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Evening, Rye. Nothing blocks the launch. Ask me about any step that is left.");
    none.unmount();
    // The page did not say: she asks, and names no number and no deadline.
    dock(base);
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Evening, Rye. Ask me what blocks the launch, or about any step that is left.");
    expect(screen.getByTestId("guide-first-line").textContent).not.toMatch(/\d|Monday|deadline/);
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

describe("what is ready has half the dock while there is little talk", () => {
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

/**
 * BRIEF AND QUIET (the founder, 28 Nov 2026): one toggle in the dock, the quiet setting of the person's speaking
 * dial. On, every fixed line says the same facts in the fewest words, and the setting rides with each ask.
 */
describe("brief and quiet: the one toggle for the speaking dial", () => {
  const PROPOSAL = { key: "feed.show_birthdays", label: "Show birthdays", category: "Feed", from: "false", to: "true", why: "You asked for it.", applyPath: "/api/admin/variables/feed.show_birthdays" };
  const toggle = () => screen.getByRole("button", { name: "Brief and quiet" });

  it("is a real labelled control in the dock's header, a finger tall, that says whether it is on", () => {
    dock();
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    expect(toggle().className.split(/\s+/)).toContain("min-h-11");
    // The other two settings are not offered: nothing follows from them yet.
    expect(screen.queryByRole("button", { name: /walk with me|at decisions/i })).toBeNull();
  });

  it("switches every fixed line between its two forms, and back", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "I can switch that for you.", proposal: PROPOSAL }) }) });
    dock({ personName: "Rye Ashby", initialShape: "expanded", initialStatus: { ...ON, lent: true } });
    const list = () => screen.getByTestId("guide-say-yes");
    // Warm and plain.
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Evening, Rye. Ask me where something lives, or name a change and I'll prepare it for your yes.");
    expect(screen.getByTestId("guide-who-answers").textContent).toBe("Sol is answering, on Claude with a key the platform lends for now.");
    expect(within(list()).getByRole("heading", { name: "Ready for your yes" })).toBeTruthy();
    expect(within(list()).getByText("Nothing waits for your yes.")).toBeTruthy();

    await userEvent.click(toggle());
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    // Brief and quiet: the same facts, the fewest words. No greeting, and no sentence about herself.
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Ask, or name a change.");
    expect(screen.getByTestId("guide-reads").textContent).toBe("Reads settings, help text and the org chart's shape. Never applications, proposals, interviews, terms or pay. No part in choosing people for roles. Moves no money.");
    expect(screen.getByTestId("guide-reads").textContent).not.toMatch(/\bI\b/);
    expect(screen.getByTestId("guide-who-answers").textContent).toBe("Sol, on a lent key.");
    expect(within(list()).getByRole("heading", { name: "To approve" })).toBeTruthy();
    expect(within(list()).getByText("All clear.")).toBeTruthy();

    // What she prepared, in the brief form: the sheet's three labels.
    await userEvent.type(box(), "show birthdays{Enter}");
    const card = await within(list()).findByTestId("helper-proposal");
    expect(card.textContent).toContain("Change");
    expect(card.textContent).not.toContain("A change I prepared");
    expect(within(card).getByRole("button", { name: "Save" })).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Skip" })).toBeTruthy();
    expect(screen.getByTestId("guide-prepared-pointer").textContent).toBe("Under To approve.");

    await userEvent.click(toggle());
    expect(within(list()).getByRole("heading", { name: "Ready for your yes" })).toBeTruthy();
    expect(within(card).getByText("A change I prepared")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Review and save" })).toBeTruthy();
    expect(screen.getByTestId("guide-prepared-pointer").textContent).toBe("I prepared this. It waits under Ready for your yes.");
  });

  it("says an alert in its brief form too, and still never in her voice", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ status: 503, body: { error: "assistant-unavailable" } }) });
    dock();
    await userEvent.click(toggle());
    await userEvent.type(box(), "hi{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("No answers left today. Back tomorrow.");
    expect(alert.textContent).not.toMatch(/\bI\b/);
  });

  it("is remembered for this person in their own browser, and a person who never chose leaves no trace", async () => {
    const first = dock();
    expect(Object.keys(localStorage).filter((k) => k.startsWith("garden.speaking"))).toEqual([]);
    await userEvent.click(toggle());
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("garden.speaking"));
    expect(keys).toHaveLength(1);
    expect(localStorage.getItem(keys[0])).toBe("quiet");
    // Kept under a tag of the session, never the token itself.
    expect(keys[0]).not.toContain("pw");
    first.unmount();

    // Opened again in a browser that only has what was stored, it is as this person left it.
    forgetPageCopy();
    const again = dock();
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Ask, or name a change.");
    again.unmount();

    // The next person on the same browser has their own.
    dock({ password: "another-session" });
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
  });

  it("sends the person's setting with each ask, as one of the dial's closed values", async () => {
    const calls = mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer() }) });
    dock();
    await userEvent.type(box(), "one{Enter}");
    await talk().findAllByText("Here you go.");
    expect(JSON.parse(calls[0].init.body).speaking).toBe("decisions");
    await userEvent.click(toggle());
    await userEvent.type(box(), "two{Enter}");
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(JSON.parse(calls[1].init.body).speaking).toBe("quiet");
    expect(GARDEN_SPEAKING).toEqual(SERVER_SPEAKING);
  });

  it("greets briefly on the road to launch too, with what blocks", async () => {
    dock({ surface: "journey", modes: ["launch", "organize"], groups: undefined, tab: undefined, onOpenTab: undefined, personName: "Rye", blocking: 3 });
    await userEvent.click(toggle());
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Hi Rye. 3 block the launch. Start?");
    await userEvent.click(screen.getByRole("button", { name: "Organizing" }));
    // Nothing waits there that she knows of: no greeting, and no sentence about herself.
    expect(screen.getByTestId("guide-first-line").textContent).toBe("Ask about organizing. Your brief first, then your calls, then the books.");
  });
});

/**
 * WHAT THE HOST TELLS HER (the voice sheet, version 3). The dock knows what she prepared and nothing else about what
 * waits on a person, so a deadline, "nothing is waiting" and a first meeting each arrive from the host by a prop.
 */
describe("her first words follow what the host told her", () => {
  const ONE_THING = { full: "One thing has a deadline: the Team page words lapse Monday. Shall I open them?", brief: "One approval lapses Monday. Open it?" };
  const first = () => screen.getByTestId("guide-first-line").textContent;
  const toggle = () => screen.getByRole("button", { name: "Brief and quiet" });

  it("a first meeting: the welcome and the stance, under the guide's own name, and brief keeps only her name and the question", async () => {
    dock({ personName: "Rye Ashby", firstMeeting: true });
    expect(first()).toBe("Welcome. I'm Sol. You're starting a Game, and you get to design it. Tell me about the village you want to play in, and we'll set the first conditions together.");
    // What she reads still follows, true to the build.
    expect(screen.getByTestId("guide-reads").textContent).toMatch(/^I read settings, help text and the shape of the org chart\./);
    await userEvent.click(toggle());
    expect(first()).toBe("I'm Sol. What Game are you starting?");
  });

  it("a first meeting offers its own three suggestions, docked and wide; each fills the box and sends nothing", async () => {
    const FIRST = ["What should I set up first?", "What does starting a Game mean here?", "Can I change this later?"];
    const calls = mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer() }) });
    const offered = () => within(screen.getByRole("group", { name: "Suggested next steps" })).getAllByRole("button").map((b) => b.textContent);
    const docked = dock({ tab: "home", firstMeeting: true });
    expect(offered()).toEqual(FIRST);
    docked.unmount();
    dock({ tab: "home", firstMeeting: true, initialShape: "expanded" });
    expect(offered()).toEqual(FIRST);
    // A press puts the words in the box and stops there.
    await userEvent.click(screen.getByRole("button", { name: "What does starting a Game mean here?" }));
    expect(box()).toHaveValue("What does starting a Game mean here?");
    expect(document.activeElement).toBe(box());
    expect(calls).toEqual([]);
    // Sent by the person, it is a conversation like any other: the everyday ways to go on.
    await userEvent.type(box(), "{Enter}");
    await talk().findAllByText("Here you go.");
    expect(calls).toHaveLength(1);
    expect(offered()).toContain("Tell me more.");
    expect(offered()).not.toContain("Can I change this later?");
  });

  it("something waits: she greets by first name and goes straight to the one thing the host handed her, word for word", async () => {
    dock({ personName: "Rye Ashby", oneThing: ONE_THING });
    expect(first()).toBe("Evening, Rye. One thing has a deadline: the Team page words lapse Monday. Shall I open them?");
    await userEvent.click(toggle());
    // Brief keeps the deadline.
    expect(first()).toBe("Hi Rye. One approval lapses Monday. Open it?");
  });

  it("the host's one thing comes before what she prepared, and what she prepared before the host's all-clear", () => {
    const PROPOSAL = { key: "feed.x", label: "X", category: "Feed", from: "1", to: "2", why: "", applyPath: "/api/admin/variables/feed.x" };
    const both = dock({ personName: "Rye", oneThing: ONE_THING, nothingWaits: true, onBar: [PROPOSAL], waiting: ["feed.x=2"] });
    expect(first()).toBe("Evening, Rye. One thing has a deadline: the Team page words lapse Monday. Shall I open them?");
    both.unmount();
    // The host said nothing waits, and she knows of a change she prepared: she never says "nothing needs you" over it.
    dock({ personName: "Rye", nothingWaits: true, onBar: [PROPOSAL], waiting: ["feed.x=2"] });
    expect(first()).toBe("Evening, Rye. One change is ready for your yes. It waits at the bottom of the page, and nothing is saved until you press Save.");
  });

  it("nothing waits, on the host's word only: the stance line by the part of the day, and three words when brief", async () => {
    const evening = dock({ personName: "Rye Ashby", nothingWaits: true });
    expect(first()).toBe("Evening, Rye. Nothing needs you tonight. The Game is running without you, which is the point.");
    evening.unmount();
    const morning = dock({ personName: "Rye Ashby", nothingWaits: true, now: new Date(2026, 10, 28, 8, 0) });
    expect(first()).toBe("Morning, Rye. Nothing needs you this morning. The Game is running without you, which is the point.");
    morning.unmount();
    dock({ personName: "Rye Ashby", nothingWaits: true });
    await userEvent.click(toggle());
    expect(first()).toBe("Nothing needs you.");
  });

  it("an empty one thing is no one thing: she falls back to what she can do", () => {
    dock({ personName: "Rye", oneThing: { full: "  ", brief: "" } });
    expect(first()).toBe("Evening, Rye. Ask me where something lives, or name a change and I'll prepare it for your yes.");
  });

  it("a guide that did not load is the system's line, never hers, in both forms", async () => {
    mockFetch({ "GET /api/admin/helper": () => ({ status: 500, body: { error: "boom" } }) });
    dock({ initialStatus: undefined });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("The guide didn't load. Reload to try again.");
    expect(alert.textContent).not.toMatch(/\bI\b|boom/);
    await userEvent.click(toggle());
    expect(screen.getByRole("alert").textContent).toBe("Guide didn't load. Retry.");
  });
});

/**
 * THE GUIDE'S RULES IN THE DOCK (the founder, 27 Nov 2026). What she says she reads is true of the rules the status
 * names, and her advice on a setting is a card with one control that takes the person there: no apply, no save,
 * nothing waiting. Every fixed line has its brief form, and the facts are the same in both.
 */
describe("her rules and her advice", () => {
  const WIDE: HelperStatus = { ...ON, rules: { wide: true, moneyDials: true } };
  const ADVISING: HelperStatus = { ...ON, rules: { wide: true, moneyDials: false } };
  const ADVICE: HelperAdvice = { key: "ledger.cycle_cap", label: "Issuance cap per cycle", category: "Ledger", now: "10000", suggested: "8000", yours: null, why: "Issuance ran well under the cap for three cycles." };
  const toggle = () => screen.getByRole("button", { name: "Brief and quiet" });
  const reads = () => screen.getByTestId("guide-reads").textContent;
  const money = () => screen.queryByTestId("guide-money")?.textContent ?? null;

  it("says what she reads as the dock always said it when the status names no rules", () => {
    dock();
    expect(reads()).toMatch(/^I read settings, help text and the shape of the org chart\./);
    expect(money()).toBeNull();
  });

  it("under the wide rules says she reads money and selection settings, still no application or pay, and may prepare a money setting", async () => {
    dock({ initialStatus: WIDE });
    expect(reads()).toBe(
      "I read settings, the money ones and the ones about choosing people among them, help text and the shape of the org chart. I don't read applications, proposals, interviews, or a role's terms or pay, and I take no part in choosing people for roles.",
    );
    expect(money()).toBe(
      "On money, pay, votes and signatures I can say what I would do and why. I can also prepare a change to a village-wide money setting, and nothing changes until you save it. A person makes every change.",
    );
    // Brief and quiet: the same facts, and no sentence about herself.
    await userEvent.click(toggle());
    expect(reads()).toBe(
      "Reads settings, money and selection ones included, help text and the org chart's shape. Never applications, proposals, interviews, or a role's terms or pay. No part in choosing people for roles.",
    );
    expect(money()).toBe("Advises on money, pay, votes and signatures. Prepares village-wide money settings, and nothing changes until you save. A person makes every change.");
    for (const line of [reads(), money()]) expect(line).not.toMatch(/\bI\b/);
  });

  it("with the village's money dial closed says she advises on money and prepares no money setting, in both forms", async () => {
    dock({ initialStatus: ADVISING });
    expect(money()).toBe(
      "On money, pay, votes and signatures I can say what I would do and why. Your village keeps money settings for people to set, so I prepare none of them. A person makes every change.",
    );
    expect(reads()).toMatch(/the money ones and the ones about choosing people among them/);
    await userEvent.click(toggle());
    expect(money()).toBe("Advises on money, pay, votes and signatures. Prepares no money setting: your village keeps those for people. A person makes every change.");
  });

  it("reads the rules off the status route, and nothing of them from a village with the dock off", async () => {
    mockFetch({ "GET /api/admin/helper": () => ({ body: { on: true, guide: "Sol", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Sol" }, dock: true, rules: { wide: true, moneyDials: false, extra: "ignored" } } }) });
    const seen: HelperStatus[] = [];
    dock({ initialStatus: undefined, onStatus: (s) => seen.push(s) });
    await screen.findByText(/I prepare none of them/);
    expect(seen[0].rules).toEqual({ wide: true, moneyDials: false });
    cleanup();
    mockFetch({ "GET /api/admin/helper": () => ({ body: { on: true, guide: "Sol", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Sol" }, rules: { wide: true, moneyDials: true } } }) });
    const off: HelperStatus[] = [];
    dock({ initialStatus: undefined, onStatus: (s) => off.push(s) });
    await screen.findByTestId("guide-reads");
    expect("rules" in off[0]).toBe(false);
    expect(money()).toBeNull();
  });

  it("ADVICE: the setting, what it holds now, what she would set and why, and ONE control that takes the person there", async () => {
    const calls = mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ reply: "I would lower it.", refused: "Issuance cap per cycle is about money, and money settings stay in your own hands.", filing: null, advice: ADVICE }) }) });
    const onReview = vi.fn();
    dock({ initialStatus: ADVISING, onReview });
    await userEvent.type(box(), "what about the cap{Enter}");
    const card = await screen.findByTestId("guide-advice");
    expect(card.textContent).toContain("My advice");
    expect(card.textContent).toContain("Issuance cap per cycle");
    expect(card.textContent).toContain("Ledger");
    expect(card.textContent).toContain("Now10000");
    expect(card.textContent).toContain("I would set8000");
    expect(card.textContent).toContain("Issuance ran well under the cap for three cycles.");
    expect(card.textContent).toContain("I have prepared nothing here, and nothing has changed. If you agree, you make this change yourself.");
    // One control, and it is a link to the setting's own place, made from its key the way a prepared change's is.
    expect(within(card).queryAllByRole("button")).toEqual([]);
    const links = within(card).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe("Take me there");
    expect(links[0].getAttribute("href")).toBe("/admin?tab=variables&variable=ledger.cycle_cap");
    for (const never of ["Review and save", "Send to review", "Apply", "Save", "Not now"]) expect(within(card).queryByText(never), never).toBeNull();
    // The refusal's own sentence stays beside it, and nothing was prepared, saved or filed.
    expect(talk().getByText(/money settings stay in your own hands/)).toBeTruthy();
    expect(screen.queryByTestId("helper-proposal")).toBeNull();
    expect(screen.queryByTestId("guide-filing")).toBeNull();
    expect(onReview).not.toHaveBeenCalled();
    expect(posts(calls).map((c) => c.url)).toEqual(["/api/admin/helper/ask"]);
  });

  it("ADVICE: brief and quiet says the same facts in the fewest words, with no sentence about herself", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ advice: ADVICE }) }) });
    dock({ initialStatus: WIDE });
    await userEvent.click(toggle());
    await userEvent.type(box(), "what about the cap{Enter}");
    const card = await screen.findByTestId("guide-advice");
    expect(card.textContent).toContain("Advice");
    expect(card.textContent).not.toContain("My advice");
    expect(card.textContent).toContain("Now10000");
    expect(card.textContent).toContain("Suggested8000");
    expect(card.textContent).toContain("Nothing prepared. Yours to change.");
    expect(card.textContent).not.toMatch(/\bI (would|have)\b/);
    // Her reason is her own words to this person and is not cut. The control keeps its place, by the dock's brief name for it.
    expect(card.textContent).toContain("Issuance ran well under the cap for three cycles.");
    const links = within(card).getAllByRole("link");
    expect(links.map((a) => `${a.textContent} ${a.getAttribute("href")}`)).toEqual(["Open /admin?tab=variables&variable=ledger.cycle_cap"]);
    // Back to warm and plain: the same card, the full words.
    await userEvent.click(toggle());
    expect(screen.getByTestId("guide-advice").textContent).toContain("I would set8000");
  });

  it("ADVICE: with no value to suggest it shows what the setting holds and her reason, and a blank value is said as blank", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ advice: { ...ADVICE, now: "", suggested: null, why: "It reads right as it is." } }) }) });
    dock({ initialStatus: WIDE });
    await userEvent.type(box(), "x{Enter}");
    const card = await screen.findByTestId("guide-advice");
    expect(card.textContent).toContain("Now(blank)");
    expect(card.textContent).not.toContain("I would set");
    expect(card.textContent).toContain("It reads right as it is.");
    expect(within(card).getAllByRole("link")).toHaveLength(1);
  });

  it("ADVICE: free text about money shows what it holds and no value of hers, and says the value is yours to type", async () => {
    const yoursLine = () => screen.queryByTestId("guide-advice-yours")?.textContent ?? null;
    const address: HelperAdvice = { key: "hypha.treasury_address", label: "DAO treasury address on Base", category: "Hypha", now: "0x1111111111111111111111111111111111111111", suggested: null, yours: "address", why: "The old one is retired." };
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ advice: address }) }) });
    const first = dock({ initialStatus: WIDE });
    await userEvent.type(box(), "x{Enter}");
    const card = await screen.findByTestId("guide-advice");
    expect(card.textContent).toContain("Now0x1111111111111111111111111111111111111111");
    expect(card.textContent).not.toContain("I would set");
    expect(yoursLine()).toBe("An address is yours to type.");
    expect(card.textContent).toContain("The old one is retired.");
    expect(within(card).getAllByRole("link")).toHaveLength(1);
    // Brief and quiet: the same fact, the fewest words.
    await userEvent.click(toggle());
    expect(yoursLine()).toBe("Yours to type.");
    expect(screen.getByTestId("guide-advice").textContent).not.toContain("Suggested");
    // The dial is this person's and is remembered, so it is turned back before the next dock opens.
    await userEvent.click(toggle());
    expect(yoursLine()).toBe("An address is yours to type.");
    first.unmount();

    // Any other free text about money: a token name, a currency list, a line about pay.
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ advice: { ...address, key: "gratitude.pool_token", label: "Which token the pool pays", category: "Gratitude", now: "credits", yours: "text" } }) }) });
    const second = dock({ initialStatus: WIDE });
    await userEvent.type(box(), "x{Enter}");
    await screen.findByTestId("guide-advice");
    expect(yoursLine()).toBe("This one is yours to type.");
    second.unmount();

    // Her own switches and the agents' settings: no value of hers and no added line. The card's own words say the change is the person's.
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ advice: { ...address, key: "agents.lead_approved_writes", label: "Our agent may make the changes we approve in the chat", category: "Connector", now: "true", yours: "own" } }) }) });
    dock({ initialStatus: WIDE });
    await userEvent.type(box(), "x{Enter}");
    const own = await screen.findByTestId("guide-advice");
    expect(yoursLine()).toBeNull();
    expect(own.textContent).toContain("Nowtrue");
    expect(own.textContent).not.toContain("I would set");
    expect(own.textContent).toContain("If you agree, you make this change yourself.");
  });

  it("ADVICE: her reason is plain words, never a link, whatever it holds", async () => {
    const hostile = "Go to /admin?tab=tokens and https://elsewhere.example/collect now, or 0x00000000000000000000000000000000000000Aa.";
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ advice: { ...ADVICE, why: hostile } }) }) });
    dock({ initialStatus: WIDE });
    await userEvent.type(box(), "x{Enter}");
    const card = await screen.findByTestId("guide-advice");
    // Shown, whole, as text: the one link on the card is still the setting's own place.
    expect(card.textContent).toContain(hostile);
    expect(within(card).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/admin?tab=variables&variable=ledger.cycle_cap"]);
    expect(card.querySelectorAll("a, button, [href], [onclick]")).toHaveLength(1);
  });

  it("ADVICE: expanded, it stays with her words and is never listed among what waits on a yes", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ advice: ADVICE }) }) });
    dock({ initialStatus: WIDE, initialShape: "expanded" });
    await userEvent.type(box(), "x{Enter}");
    expect(await talk().findByTestId("guide-advice")).toBeTruthy();
    expect(screen.getAllByTestId("guide-advice")).toHaveLength(1);
    const list = screen.getByTestId("guide-say-yes");
    expect(within(list).queryByTestId("guide-advice")).toBeNull();
    expect(within(list).getByText("Nothing waits for your yes.")).toBeTruthy();
    expect(screen.queryByTestId("guide-prepared-pointer")).toBeNull();
  });

  it("ADVICE: drawn on tokens alone, like the cards beside it", async () => {
    mockFetch({ "POST /api/admin/helper/ask": () => ({ body: answer({ advice: ADVICE }) }) });
    dock({ initialStatus: WIDE });
    await userEvent.type(box(), "x{Enter}");
    const card = await screen.findByTestId("guide-advice");
    const classes = [card, ...Array.from(card.querySelectorAll("*"))].flatMap((el) => String(el.getAttribute("class") ?? "").split(/\s+/));
    expect(classes.filter((c) => /(?:^|:)(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|placeholder|divide|shadow)-(?:[a-z]+-)?(?:50|[1-9]00|950)(?:\/\d+)?$/.test(c))).toEqual([]);
    expect(classes.filter((c) => /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\(/i.test(c))).toEqual([]);
  });
});
