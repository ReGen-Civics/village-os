// @vitest-environment jsdom
/**
 * The doors into Messages: the avatar menu's entry with its unread count, the
 * phone's More tile (phone doors v4; the corner no longer carries it), and the
 * inbox's split into Shared work and everything else.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  token: "t" as string | null,
  user: null as null | { id: string; name: string; membershipGranted?: boolean },
  modules: [] as { id: string; lifecycle: string }[],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: session.user, loading: false }),
}));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({ modules: session.modules, loaded: true, failed: false }),
}));
vi.mock("@/lib/haptics", () => ({ haptic: () => false }));
vi.mock("@/lib/gameApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gameApi")>();
  const gameFetch = (path: string, init: RequestInit = {}) =>
    fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
    });
  return { ...actual, authToken: () => session.token, gameFetch };
});

import { cornerRows } from "@/components/mobile/MobileFab";
import MessageCountBadge, { MESSAGES_UNREAD_URL, readUnread, unreadWords } from "@/components/messages/MessageCountBadge";
import { sharedByTwo } from "@/components/tasks/TaskCard";
import { ACCOUNT_MENU } from "@/config/nav";
import { TASK_BOARD_PATH } from "@shared/sessionTasks";
import { isWorkThread, splitInbox, workHref, workLabel, type InboxConversation } from "@/lib/messaging";

const MESSAGING_ON = [{ id: "messaging", lifecycle: "members" }];
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn();
beforeEach(() => {
  session.token = "t";
  // A member: a newcomer is not offered Messages (the front door, 24 Nov 2026).
  session.user = { id: "u-wren", name: "Wren", membershipGranted: true };
  session.modules = MESSAGING_ON;
  fetchMock.mockReset();
  // Anything the shell asks for on its own (the brochure switch, the config) gets an empty answer.
  fetchMock.mockImplementation(async () => reply(200, {}));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());


describe("the avatar menu", () => {
  it("carries Messages, behind the messaging module, with the member's own count", () => {
    const entry = ACCOUNT_MENU.find((i) => i.href === "/messages");
    expect(entry).toMatchObject({ label: "Messages", module: "messaging", count: "messages" });
    // Beside the member's own pages, before Village Settings.
    const at = ACCOUNT_MENU.indexOf(entry!);
    expect(at).toBeGreaterThan(ACCOUNT_MENU.findIndex((i) => i.href === "/profile"));
    expect(at).toBeLessThan(ACCOUNT_MENU.findIndex((i) => i.href === "/admin"));
  });
});

describe("the phone's doors (v4)", () => {
  // Messages left the corner: the corner is companions and help now, and Messages is a tile in More
  // with its count (MoreSheet.test.tsx pins the tile).
  it("never puts Messages in the corner", () => {
    const keys = cornerRows({ signedIn: true, admin: true, army: null, guide: "the guide", t: ({ message }) => message }).map((r) => r.key);
    expect(keys).not.toContain("messages");
    expect(keys).toEqual(["ask-guide", "ask-admin"]);
  });

});

describe("MessageCountBadge", () => {
  it("reads the one-count door and shows the number, with a sentence for a screen reader", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { unreadTotal: 3 }));
    render(<MessageCountBadge who="u-wren" />);
    await waitFor(() => expect(document.querySelector("[data-message-count]")?.textContent).toBe("3"));
    expect(fetchMock.mock.calls[0][0]).toBe(MESSAGES_UNREAD_URL);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(screen.getByText(", 3 unread messages")).toHaveClass("sr-only");
    expect(document.querySelector("[data-message-count]")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows nothing at zero, on a failure, or signed out", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { unreadTotal: 0 }));
    const { unmount } = render(<MessageCountBadge who="a" />);
    await act(async () => {});
    expect(document.querySelector("[data-message-count]")).toBeNull();
    unmount();

    fetchMock.mockResolvedValueOnce(reply(500, { error: "boom" }));
    const second = render(<MessageCountBadge who="b" />);
    await act(async () => {});
    expect(document.querySelector("[data-message-count]")).toBeNull();
    second.unmount();

    fetchMock.mockReset();
    session.token = null;
    render(<MessageCountBadge who="c" />);
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the reply defensively", () => {
    expect(readUnread({ unreadTotal: 2 })).toBe(2);
    expect(readUnread({ unreadTotal: -1 })).toBeNull();
    expect(readUnread({ unreadTotal: "2" })).toBeNull();
    expect(readUnread(null)).toBeNull();
    expect(unreadWords(1)).toBe("1 unread message");
  });
});

const convo = (over: Partial<InboxConversation>): InboxConversation => ({
  id: "c",
  kind: "group",
  name: "x",
  unreadCount: 0,
  muted: false,
  role: "member",
  lastReadSeq: 0,
  latestSeq: 0,
  preview: "",
  lastAuthorId: null,
  lastMessageAt: null,
  memberCount: 2,
  members: [],
  ...over,
});

describe("the inbox's Shared work section", () => {
  it("takes quest and task chats, and leaves a crew's thread, groups and direct threads where they were", () => {
    const list = [
      convo({ id: "dm", kind: "direct" }),
      convo({ id: "quest", contextType: "quest", contextId: "q-1" }),
      convo({ id: "crew", kind: "crew", contextType: "quest", contextId: "q-1" }),
      convo({ id: "task", contextType: "task", contextId: "42" }),
      convo({ id: "group" }),
    ];
    const { work, people } = splitInbox(list);
    expect(work.map((c) => c.id), "order kept").toEqual(["quest", "task"]);
    expect(people.map((c) => c.id)).toEqual(["dm", "crew", "group"]);
    expect(isWorkThread(list[2])).toBe(false);
  });

  it("links each chat back to its work and names what it is", () => {
    expect(workHref({ contextType: "quest", contextId: "q 1" })).toBe("/quests/q%201");
    expect(workHref({ contextType: "task", contextId: "42" })).toBe(TASK_BOARD_PATH);
    expect(workHref({ contextType: "quest", contextId: null })).toBeNull();
    expect(workLabel({ contextType: "task" })).toBe("Task");
    expect(workLabel({ contextType: "quest" })).toBe("Quest");
  });
});

describe("a task card's Chat button", () => {
  it("shows when a person and a seat, or a seat of two, hold the task", () => {
    expect(sharedByTwo({ heldAs: "you", seat: { id: "s", name: "S", holders: ["Ana"] }, inSessionNow: false })).toBe(true);
    expect(sharedByTwo({ heldAs: "seat", seat: { id: "s", name: "S", holders: ["Ana", "Ben"] }, inSessionNow: false })).toBe(true);
  });

  it("stays away from a task one person holds, one back with the circle, or one still in its session", () => {
    expect(sharedByTwo({ heldAs: "you", seat: null, inSessionNow: false })).toBe(false);
    expect(sharedByTwo({ heldAs: "circle", seat: null, inSessionNow: false })).toBe(false);
    expect(sharedByTwo({ heldAs: "seat", seat: { id: "s", name: "S", holders: ["Ana", "Ben"] }, inSessionNow: true })).toBe(false);
  });
});
