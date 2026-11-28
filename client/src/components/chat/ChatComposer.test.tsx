// @vitest-environment jsdom
/**
 * THE SHARED CHAT BOX (the lead, 27 Nov 2026): it grows to two thirds of what is
 * visible and then scrolls, Enter sends on a desk and adds a line on a phone,
 * the draft outlives the panel, spoken words land in the box without sending,
 * and a sent box is one line again. QA round 1 on #1885 added: Send kept in view
 * by scrolling the nearest box (never the page behind a sheet), the tab bar taken
 * off, drafts kept per signed-in member and cleared at sign-out, and the
 * journal's Enter kept for new lines.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";

const mic = vi.hoisted(() => ({ onText: null as null | ((chunk: string) => void) }));
vi.mock("@/components/MicButton", () => ({
  default: ({ onText }: { onText: (chunk: string) => void }) => {
    mic.onText = onText;
    return <button type="button">Speak instead of typing</button>;
  },
}));

const auth = vi.hoisted(() => ({ user: { id: "u-ana" } as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: auth.user }) }));

import ChatComposer, { composerCap, enterSends, fitTo, MIN_HEIGHT } from "./ChatComposer";
import { readDraft, useChatDraft } from "./chatDraft";
import { forgetChatDrafts } from "./draftStore";

/** jsdom lays nothing out: a line is 24px and the padding 20px, so the box's scrollHeight follows its lines. */
const LINE = 24;
const PAD = 20;
let phone = false;
/** The tab bar's height as the composer's probe measures it (`--tabbar-h`). */
let tabBar = 0;

let windowHeight: PropertyDescriptor | undefined;

beforeEach(() => {
  phone = false;
  tabBar = 0;
  // The window as tall as the visual viewport below: no keyboard is up unless a test raises one.
  windowHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
  auth.user = { id: "u-ana" };
  window.sessionStorage.clear();
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      return this.value.split("\n").length * LINE + PAD;
    },
  });
  // A drawn height reads back as itself; the tab bar probe reads `tabBar`.
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.hasAttribute("data-tabbar-probe")) return tabBar;
      return parseFloat(this.style.height) || 0;
    },
  });
  vi.stubGlobal("visualViewport", { height: 600, addEventListener: () => {}, removeEventListener: () => {} });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: phone && q.includes("coarse"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
  if (windowHeight) Object.defineProperty(window, "innerHeight", windowHeight);
  else delete (window as { innerHeight?: number }).innerHeight;
});

function Chat({
  draftKey = "companion:1",
  onSent = () => {},
  busy = false,
  maxLength,
  plainEnter = false,
}: {
  draftKey?: string;
  onSent?: (words: string) => void;
  busy?: boolean;
  maxLength?: number;
  plainEnter?: boolean;
}) {
  const [draft, setDraft] = useChatDraft(draftKey);
  return (
    <ChatComposer
      id="box"
      label="Message Wren"
      value={draft}
      onChange={setDraft}
      onSend={() => {
        onSent(draft);
        setDraft("");
      }}
      busy={busy}
      maxLength={maxLength}
      sendLabel="Send"
      {...(plainEnter ? { enterSends: false, minRows: 2 } : {})}
    />
  );
}

const box = () => screen.getByRole("textbox", { name: "Message Wren" }) as HTMLTextAreaElement;
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");
const rect = (top: number, bottom: number) =>
  ({ top, bottom, height: bottom - top, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

describe("the height", () => {
  it("is two thirds of what is visible, or a share of its panel when that is less, and never under 44px", () => {
    expect(composerCap(600)).toBe(400);
    expect(composerCap(600, 300)).toBe(150);
    expect(composerCap(600, 1200)).toBe(400);
    // A phone's corner panel: 0.4 of it, so the last reply keeps its room.
    expect(composerCap(600, 300, 2 / 3, 0.4)).toBe(120);
    expect(composerCap(30)).toBe(MIN_HEIGHT);
    expect(fitTo(20, 400)).toEqual({ height: MIN_HEIGHT, scrolls: false });
    expect(fitTo(900, 400)).toEqual({ height: 400, scrolls: true });
  });

  it("starts at one line, grows with each line, then stops at the cap and scrolls inside", () => {
    render(<Chat />);
    expect(box().style.height).toBe(`${LINE + PAD}px`);
    expect(box().rows).toBe(1);

    fireEvent.change(box(), { target: { value: lines(5) } });
    expect(box().style.height).toBe(`${5 * LINE + PAD}px`);
    expect(box().style.overflowY).toBe("hidden");

    fireEvent.change(box(), { target: { value: lines(40) } });
    expect(box().style.height).toBe("400px");
    expect(box().style.overflowY).toBe("auto");
  });

  it("takes the keyboard off: a smaller visible screen lowers the cap", () => {
    vi.stubGlobal("visualViewport", { height: 360, addEventListener: () => {}, removeEventListener: () => {} });
    render(<Chat />);
    fireEvent.change(box(), { target: { value: lines(40) } });
    expect(box().style.height).toBe("240px");
  });

  it("takes the tab bar off what is visible", () => {
    tabBar = 66;
    render(<Chat />);
    fireEvent.change(box(), { target: { value: lines(40) } });
    expect(box().style.height).toBe(`${Math.floor((600 - 66) * (2 / 3))}px`);
  });

  it("is one line again after a send", () => {
    const sent: string[] = [];
    render(<Chat onSent={(w) => sent.push(w)} />);
    fireEvent.change(box(), { target: { value: lines(12) } });
    expect(box().style.height).toBe(`${12 * LINE + PAD}px`);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(sent).toHaveLength(1);
    expect(box()).toHaveValue("");
    expect(box().style.height).toBe(`${LINE + PAD}px`);
  });
});

describe("Send kept in view", () => {
  let realRect: typeof Element.prototype.getBoundingClientRect;
  const page = { scrollBy: vi.fn(), scrollTo: vi.fn() };
  beforeEach(() => {
    realRect = Element.prototype.getBoundingClientRect;
    page.scrollBy = vi.fn();
    page.scrollTo = vi.fn();
    vi.stubGlobal("scrollBy", page.scrollBy);
    vi.stubGlobal("scrollTo", page.scrollTo);
  });
  afterEach(() => {
    Element.prototype.getBoundingClientRect = realRect;
  });

  /** A sheet that scrolls (its own scrollTop, which jsdom does not keep), top and bottom on screen. */
  const Sheet = ({ fixed = false }: { fixed?: boolean }) => (
    <div data-sheet="" style={{ overflowY: "auto", ...(fixed ? { position: "fixed" } : {}) }}>
      <Chat />
    </div>
  );
  const sheetScroll = () => {
    const sheet = document.querySelector("[data-sheet]") as HTMLElement;
    let top = 0;
    Object.defineProperty(sheet, "scrollTop", { configurable: true, get: () => top, set: (v: number) => (top = v) });
    return () => top;
  };
  /** The sheet sits from `top` to `bottom`; the composer's row starts at `rowTop` and is as tall as its box. */
  const layout = (top: number, bottom: number, rowTop: number) => {
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.hasAttribute("data-sheet")) return rect(top, bottom);
      const ta = this.querySelector?.("textarea");
      if (ta) return rect(rowTop, rowTop + (parseFloat(ta.style.height) || 0));
      return rect(0, 0);
    };
  };

  it("scrolls the sheet it sits in, by just as much as Send is hidden, and never the page behind it", () => {
    layout(100, 400, 250);
    render(<Sheet />);
    const scrolled = sheetScroll();
    box().focus();
    expect(scrolled()).toBe(0);
    fireEvent.change(box(), { target: { value: lines(30) } });
    // Two thirds of the sheet's 300 visible pixels, not of the window's 600.
    expect(box().style.height).toBe("200px");
    // The row now ends at 450; the sheet shows to 400, less half a rem for room: 58px.
    expect(scrolled()).toBe(58);
    expect(page.scrollBy).not.toHaveBeenCalled();
    expect(page.scrollTo).not.toHaveBeenCalled();
  });

  it("keeps Send above the tab bar", () => {
    tabBar = 66;
    layout(0, 600, 300);
    render(<Sheet />);
    const scrolled = sheetScroll();
    box().focus();
    fireEvent.change(box(), { target: { value: lines(10) } });
    // The row ends at 300 + 260 = 560; above the bar means 600 - 66 - 8 = 526.
    expect(scrolled()).toBe(34);
  });

  it("keeps Send in view when spoken words grow the box while the mic has focus", () => {
    layout(0, 400, 200);
    render(<Sheet />);
    const scrolled = sheetScroll();
    screen.getByRole("button", { name: "Speak instead of typing" }).focus();
    act(() => mic.onText?.(lines(8)));
    expect(scrolled()).toBeGreaterThan(0);
    expect(page.scrollBy).not.toHaveBeenCalled();
  });

  it("brings Send into view when the box is tapped and Send sits under it out of sight", () => {
    layout(0, 600, 580);
    render(<Sheet />);
    const scrolled = sheetScroll();
    fireEvent.focus(box());
    expect(scrolled()).toBe(580 + 44 - (600 - 8));
  });

  it("moves the page only where the page itself scrolls, and nothing behind a pinned panel", () => {
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const ta = this.querySelector?.("textarea");
      if (ta) return rect(500, 500 + (parseFloat(ta.style.height) || 0));
      return rect(0, 0);
    };
    const first = render(<Chat />);
    box().focus();
    fireEvent.change(box(), { target: { value: lines(5) } });
    expect(page.scrollBy).toHaveBeenCalledWith(0, 500 + 5 * LINE + PAD - (600 - 8));
    first.unmount();

    page.scrollBy.mockClear();
    render(
      <div style={{ position: "fixed" }}>
        <Chat draftKey="companion:2" />
      </div>,
    );
    box().focus();
    fireEvent.change(box(), { target: { value: lines(5) } });
    expect(page.scrollBy).not.toHaveBeenCalled();
  });

  it("leaves everything still when Send is already in sight, or nobody is writing in the box", () => {
    let rowTop = 100;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.hasAttribute("data-sheet")) return rect(0, 600);
      const ta = this.querySelector?.("textarea");
      if (ta) return rect(rowTop, rowTop + (parseFloat(ta.style.height) || 0));
      return rect(0, 0);
    };
    render(<Sheet />);
    const scrolled = sheetScroll();
    box().focus();
    fireEvent.change(box(), { target: { value: lines(5) } });
    box().blur();
    rowTop = 900;
    fireEvent.change(box(), { target: { value: lines(9) } });
    expect(scrolled()).toBe(0);
    expect(page.scrollBy).not.toHaveBeenCalled();
  });
});

describe("the phone keyboard", () => {
  /** A visual viewport that can shrink and pan the way iOS Safari and Android Chrome do: the layout viewport stays. */
  const fakeViewport = (height: number, offsetTop = 0) => {
    const vv = Object.assign(new EventTarget(), { height, offsetTop, width: 375, pageTop: 0, scale: 1 });
    vi.stubGlobal("visualViewport", vv);
    return {
      raise(h: number, top: number) {
        vv.height = h;
        vv.offsetTop = top;
        act(() => {
          vv.dispatchEvent(new Event("resize"));
          vv.dispatchEvent(new Event("scroll"));
        });
      },
    };
  };
  let realInner: PropertyDescriptor | undefined;
  beforeEach(() => {
    realInner = Object.getOwnPropertyDescriptor(window, "innerHeight");
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 812 });
  });
  afterEach(() => {
    if (realInner) Object.defineProperty(window, "innerHeight", realInner);
    document.documentElement.style.removeProperty("--kb");
    document.documentElement.style.removeProperty("--vvh");
  });
  const row = () => box().closest("[class*='@container']")!.querySelector(":scope > div") as HTMLElement;

  it("says how much the keyboard covers, so a pinned panel lifts above it, and keeps Send on the box's row", () => {
    phone = true;
    const kb = fakeViewport(812, 0);
    render(
      <div style={{ position: "fixed", bottom: "var(--kb, 0px)" }} data-panel="">
        <Chat />
      </div>,
    );
    expect(document.documentElement.style.getPropertyValue("--kb")).toBe("0px");
    expect(row().getAttribute("data-composer-row")).toBeNull();
    box().focus();
    // The keyboard takes 45% and the browser pans to the field: the visual viewport shows 218 to 665 of 812.
    kb.raise(447, 218);
    expect(document.documentElement.style.getPropertyValue("--kb")).toBe(`${812 - (218 + 447)}px`);
    expect(document.documentElement.style.getPropertyValue("--vvh")).toBe("447px");
    // Send rides beside the box, in the band the browser shows, never under it where the keyboard is.
    expect(row().getAttribute("data-composer-row")).toBe("beside");
    expect(row().className).toContain("flex-row");
    expect(row().contains(screen.getByRole("button", { name: "Send" }))).toBe(true);
    // The keyboard goes down: the buttons may go back under the box.
    kb.raise(812, 0);
    expect(document.documentElement.style.getPropertyValue("--kb")).toBe("0px");
    expect(row().getAttribute("data-composer-row")).toBeNull();
  });

  it("leaves a worded Send under the box when beside it would take the box's width", () => {
    phone = true;
    const kb = fakeViewport(812, 0);
    // The row is 311px wide and the mic and a worded Send take 130px: the box would keep 173px, under 60%.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.querySelector?.(":scope > textarea") ? 311 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return !this.querySelector?.("textarea") && this.querySelector?.("button") ? 130 : 0;
      },
    });
    try {
      render(
        <div style={{ position: "fixed" }}>
          <Chat />
        </div>,
      );
      box().focus();
      kb.raise(447, 218);
      expect(document.documentElement.style.getPropertyValue("--kb")).toBe("147px");
      expect(row().getAttribute("data-composer-row")).toBeNull();
    } finally {
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
    }
  });

  it("caps the box at two thirds of what the keyboard leaves, inside a pinned panel", () => {
    phone = true;
    const kb = fakeViewport(812, 0);
    render(
      <div style={{ position: "fixed" }}>
        <Chat />
      </div>,
    );
    box().focus();
    kb.raise(447, 218);
    fireEvent.change(box(), { target: { value: lines(40) } });
    expect(box().style.height).toBe(`${Math.floor(447 * (2 / 3))}px`);
  });

  it("keeps the buttons where they were on a desk, keyboard or not", () => {
    const kb = fakeViewport(812, 0);
    render(<Chat />);
    kb.raise(447, 0);
    expect(row().getAttribute("data-composer-row")).toBeNull();
  });

  it("forgets both values when the last chat box closes", () => {
    fakeViewport(447, 218);
    const first = render(<Chat />);
    expect(document.documentElement.style.getPropertyValue("--kb")).toBe("147px");
    first.unmount();
    expect(document.documentElement.style.getPropertyValue("--kb")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--vvh")).toBe("");
  });
});

describe("Enter", () => {
  it("sends on a desk, and Shift+Enter adds a line", () => {
    expect(enterSends({ key: "Enter" }, false)).toBe(true);
    expect(enterSends({ key: "Enter", shiftKey: true }, false)).toBe(false);
    expect(enterSends({ key: "Enter", isComposing: true }, false)).toBe(false);

    const sent: string[] = [];
    render(<Chat onSent={(w) => sent.push(w)} />);
    fireEvent.change(box(), { target: { value: "first thought" } });
    expect(fireEvent.keyDown(box(), { key: "Enter", shiftKey: true })).toBe(true);
    expect(sent).toEqual([]);
    expect(fireEvent.keyDown(box(), { key: "Enter" })).toBe(false);
    expect(sent).toEqual(["first thought"]);
  });

  it("adds a line on a phone, where Send sends", () => {
    phone = true;
    expect(enterSends({ key: "Enter" }, true)).toBe(false);
    const sent: string[] = [];
    render(<Chat onSent={(w) => sent.push(w)} />);
    fireEvent.change(box(), { target: { value: "on the bus" } });
    expect(fireEvent.keyDown(box(), { key: "Enter" })).toBe(true);
    expect(sent).toEqual([]);
    expect(box().getAttribute("enterkeyhint")).toBe("enter");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(sent).toEqual(["on the bus"]);
  });

  it("in the journal adds a line on a desk too, starts at two rows, and sends with Ctrl+Enter or the button", () => {
    expect(enterSends({ key: "Enter" }, false, true)).toBe(false);
    expect(enterSends({ key: "Enter", ctrlKey: true }, false, true)).toBe(true);
    const sent: string[] = [];
    render(<Chat plainEnter onSent={(w) => sent.push(w)} />);
    expect(box().rows).toBe(2);
    expect(box().getAttribute("enterkeyhint")).toBe("enter");
    fireEvent.change(box(), { target: { value: "a first paragraph" } });
    expect(fireEvent.keyDown(box(), { key: "Enter" })).toBe(true);
    expect(sent).toEqual([]);
    fireEvent.keyDown(box(), { key: "Enter", ctrlKey: true });
    expect(sent).toEqual(["a first paragraph"]);
  });
});

describe("Send", () => {
  it("waits while the box is empty or a reply is coming", () => {
    const { rerender } = render(<Chat />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.change(box(), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.change(box(), { target: { value: "hello" } });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    rerender(<Chat busy />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows a quiet count near the limit, and waits for a trim past it", () => {
    render(<Chat maxLength={100} />);
    fireEvent.change(box(), { target: { value: "a".repeat(50) } });
    expect(document.querySelector("[data-composer-count]")).toBeNull();
    fireEvent.change(box(), { target: { value: "a".repeat(85) } });
    expect(screen.getByText("85 / 100 characters")).toBeInTheDocument();
    expect(box()).toHaveAttribute("aria-describedby", "box-count");
    act(() => mic.onText?.("b".repeat(30)));
    expect(screen.getByText(/Trim 16 to send/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});

describe("the draft", () => {
  it("is still there when the panel closes and opens again, one draft per companion", () => {
    const first = render(<Chat draftKey="companion:1" />);
    fireEvent.change(box(), { target: { value: "half a long message" } });
    first.unmount();
    expect(readDraft("u-ana:companion:1")).toBe("half a long message");

    const other = render(<Chat draftKey="companion:2" />);
    expect(box()).toHaveValue("");
    other.unmount();

    render(<Chat draftKey="companion:1" />);
    expect(box()).toHaveValue("half a long message");
  });

  it("is dropped once sent", () => {
    render(<Chat />);
    fireEvent.change(box(), { target: { value: "send me" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(window.sessionStorage.getItem("chat-draft:u-ana:companion:1")).toBeNull();
  });

  it("is never read by the next person on the same tab", () => {
    const first = render(<Chat draftKey="journal-guide" />);
    fireEvent.change(box(), { target: { value: "Private: thinking of leaving after the harvest." } });
    first.unmount();

    // Ben signs in on the same tab: Ana's draft is kept under her id, so he reads nothing of it.
    auth.user = { id: "u-ben" };
    const second = render(<Chat draftKey="journal-guide" />);
    expect(box()).toHaveValue("");
    fireEvent.change(box(), { target: { value: "Ben's own words" } });
    second.unmount();

    // Ana again: her own draft, never Ben's.
    auth.user = { id: "u-ana" };
    render(<Chat draftKey="journal-guide" />);
    expect(box()).toHaveValue("Private: thinking of leaving after the harvest.");
  });

  it("is cleared, every one, at sign-out, and nothing else is", () => {
    const first = render(<Chat draftKey="journal-guide" />);
    fireEvent.change(box(), { target: { value: "Private words" } });
    first.unmount();
    window.sessionStorage.setItem("village-paper", "sea-chart");
    forgetChatDrafts();
    expect(Object.keys(window.sessionStorage).filter((k) => k.startsWith("chat-draft:"))).toEqual([]);
    expect(window.sessionStorage.getItem("village-paper")).toBe("sea-chart");
    render(<Chat draftKey="journal-guide" />);
    expect(box()).toHaveValue("");
  });

  it("switches conversation and member under StrictMode without setting state while rendering", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      window.sessionStorage.setItem("chat-draft:u-ana:talk-it-out:About you", "kept for About you");
      const view = render(
        <StrictMode>
          <Chat draftKey="talk-it-out:Bio" />
        </StrictMode>,
      );
      fireEvent.change(box(), { target: { value: "for the bio" } });
      view.rerender(
        <StrictMode>
          <Chat draftKey="talk-it-out:About you" />
        </StrictMode>,
      );
      expect(box()).toHaveValue("kept for About you");
      fireEvent.change(box(), { target: { value: "kept for About you, and more" } });
      expect(readDraft("u-ana:talk-it-out:About you")).toBe("kept for About you, and more");
      expect(readDraft("u-ana:talk-it-out:Bio")).toBe("for the bio");
      auth.user = { id: "u-ben" };
      view.rerender(
        <StrictMode>
          <Chat draftKey="talk-it-out:About you" />
        </StrictMode>,
      );
      expect(box()).toHaveValue("");
      expect(errors.mock.calls.map((c) => String(c[0])).filter((m) => /Maximum update depth|while rendering a different component|Too many re-renders/.test(m))).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it("is kept nowhere for a visitor", () => {
    auth.user = null;
    const first = render(<Chat draftKey="guide-chat:offer" />);
    fireEvent.change(box(), { target: { value: "A visitor's offer" } });
    expect(box()).toHaveValue("A visitor's offer");
    expect(window.sessionStorage.length).toBe(0);
    first.unmount();
    render(<Chat draftKey="guide-chat:offer" />);
    expect(box()).toHaveValue("");
  });

  it("works with no storage at all", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const real = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: broken });
    try {
      const sent: string[] = [];
      render(<Chat onSent={(w) => sent.push(w)} />);
      fireEvent.change(box(), { target: { value: "still typed" } });
      expect(box()).toHaveValue("still typed");
      fireEvent.keyDown(box(), { key: "Enter" });
      expect(sent).toEqual(["still typed"]);
      forgetChatDrafts();
    } finally {
      if (real) Object.defineProperty(window, "sessionStorage", real);
      else delete (window as { sessionStorage?: Storage }).sessionStorage;
    }
  });
});

describe("speaking", () => {
  it("adds each finished phrase to the box, grows it, and never sends", () => {
    const sent: string[] = [];
    render(<Chat onSent={(w) => sent.push(w)} />);
    fireEvent.change(box(), { target: { value: "I want to say" } });
    // Two phrases finished in one breath: both land.
    act(() => {
      mic.onText?.("that the kitchen needs help");
      mic.onText?.("on Thursdays");
    });
    expect(box()).toHaveValue("I want to say that the kitchen needs help on Thursdays");
    expect(sent).toEqual([]);
    act(() => mic.onText?.(lines(30)));
    expect(box().style.height).toBe("400px");
    expect(sent).toEqual([]);
  });

  it("tells the page each phrase that came by voice, and never what was typed", () => {
    const spoken: string[] = [];
    const sent: string[] = [];
    function Heard() {
      const [draft, setDraft] = useState("");
      return <ChatComposer id="box" label="Message Wren" value={draft} onChange={setDraft} onSend={() => sent.push(draft)} sendLabel="Send" onSpoken={(p) => spoken.push(p)} />;
    }
    render(<Heard />);
    fireEvent.change(box(), { target: { value: "typed by hand" } });
    expect(spoken).toEqual([]);
    act(() => mic.onText?.("and then spoken"));
    // The phrase is in the box already when the page hears of it, and nothing was sent.
    expect(box()).toHaveValue("typed by hand and then spoken");
    expect(spoken).toEqual(["and then spoken"]);
    expect(sent).toEqual([]);
  });
});
