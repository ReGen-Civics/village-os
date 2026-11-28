// @vitest-environment jsdom
/**
 * THE SHARED CHAT BOX (the lead, 27 Nov 2026): it grows to two thirds of what is
 * visible and then scrolls, Enter sends on a desk and adds a line on a phone,
 * the draft outlives the panel, spoken words land in the box without sending,
 * and a sent box is one line again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

const mic = vi.hoisted(() => ({ onText: null as null | ((chunk: string) => void) }));
vi.mock("@/components/MicButton", () => ({
  default: ({ onText }: { onText: (chunk: string) => void }) => {
    mic.onText = onText;
    return <button type="button">Speak instead of typing</button>;
  },
}));

import ChatComposer, { composerCap, enterSends, fitTo, MIN_HEIGHT } from "./ChatComposer";
import { readDraft, useChatDraft } from "./chatDraft";

/** jsdom lays nothing out: a line is 24px and the padding 20px, so the box's scrollHeight follows its lines. */
const LINE = 24;
const PAD = 20;
let phone = false;

beforeEach(() => {
  phone = false;
  window.sessionStorage.clear();
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      return this.value.split("\n").length * LINE + PAD;
    },
  });
  vi.stubGlobal("visualViewport", { height: 600, addEventListener: () => {}, removeEventListener: () => {} });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: phone && q.includes("coarse"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
});

function Chat({ draftKey = "companion:1", onSent = () => {}, busy = false, maxLength }: { draftKey?: string; onSent?: (words: string) => void; busy?: boolean; maxLength?: number }) {
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
    />
  );
}

const box = () => screen.getByRole("textbox", { name: "Message Wren" }) as HTMLTextAreaElement;
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

describe("the height", () => {
  it("is two thirds of what is visible, or half its panel when that is less, and never under 44px", () => {
    expect(composerCap(600)).toBe(400);
    expect(composerCap(600, 300)).toBe(150);
    expect(composerCap(600, 1200)).toBe(400);
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
    expect(readDraft("companion:1")).toBe("half a long message");

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
    expect(window.sessionStorage.getItem("chat-draft:companion:1")).toBeNull();
  });

  it("works with no storage at all", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    const real = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: broken });
    try {
      const sent: string[] = [];
      render(<Chat onSent={(w) => sent.push(w)} />);
      fireEvent.change(box(), { target: { value: "still typed" } });
      expect(box()).toHaveValue("still typed");
      fireEvent.keyDown(box(), { key: "Enter" });
      expect(sent).toEqual(["still typed"]);
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
