// @vitest-environment jsdom
/**
 * The Aligned tab of /season, rendered (seat settings PR6, then the season fold).
 *
 *   - the reader's own standing comes first: the texts waiting on them, each
 *     with its card, or one line saying nothing waits;
 *   - a guest answered 401 by the register reads the members line and no rows;
 *   - a member reads the record grouped by year, newest year first, with no
 *     count anywhere; each row its parties by name and capacity, its state, the
 *     day it came aligned, and the vote or the holder;
 *   - no hash is drawn, even when the server hands a party theirs;
 *   - a search asks the server with the words typed, and "Show earlier terms"
 *     asks for the next page and merges it.
 *
 * Every name is made up, and every figure is in XTS.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

let signedIn: { id: string } | null = { id: "u-hal" };

vi.mock("@/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: signedIn }),
}));
vi.mock("@/components/natural/useReducedMotion", () => ({
  useReducedMotion: () => true,
  prefersReducedMotion: () => true,
}));
vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import Aligned from "./AlignedPanel";

const HASH = "c".repeat(64);
const row = (over: Record<string, unknown>) => ({
  textId: "at-0000000000000001",
  kind: "seat_terms",
  kindLabel: "Role terms",
  title: "Terms for Orchard steward",
  body: "Terms for Orchard steward\n\nTHE TERMS\n  Pay: XTS 43,210 a month\n",
  version: 1,
  seatNames: ["Orchard steward"],
  state: "in-force",
  why: null,
  sealed: true,
  money: true,
  parties: [
    {
      partyKey: "user:u-ana",
      label: "Ana Quillfeather",
      capacity: "individually",
      required: true,
      aligned: true,
      alignedOn: "2026-10-09",
    },
    {
      partyKey: "village",
      label: "The village",
      capacity: "for the village",
      required: true,
      aligned: true,
      alignedOn: "2026-10-10",
    },
  ],
  alignedOn: "2026-10-10",
  writtenOn: "2026-10-09",
  year: "2026",
  village: { by: "holder", name: "Hal Keeper" },
  href: "/seat-applications/sa-0000000000000001",
  contentHash: null,
  ...over,
});

const ROWS = [
  row({}),
  row({
    textId: "at-0000000000000002",
    title: "Terms for Ledger keeper",
    seatNames: ["Ledger keeper"],
    money: false,
    village: {
      by: "ballot",
      ballotId: "b-0000000000000009",
      href: "/decisions/b-0000000000000009",
    },
    // A party's own hash: the server sends it to them, the page never draws it.
    contentHash: HASH,
  }),
  row({
    textId: "at-0000000000000003",
    title: "Terms for Seed librarian",
    state: "pending",
    why: "Waiting for every party to align.",
    alignedOn: null,
    writtenOn: "2025-12-30",
    year: "2025",
    village: null,
    parties: [
      {
        partyKey: "user:u-ivo",
        label: "Ivo Lantern",
        capacity: "individually",
        required: true,
        aligned: true,
        alignedOn: "2025-12-30",
      },
      {
        partyKey: "village",
        label: "The village",
        capacity: "for the village",
        required: true,
        aligned: false,
        alignedOn: null,
      },
    ],
  }),
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
let fetchMock: ReturnType<typeof vi.fn>;
let mine: unknown[] = [];
const serve = (answer: (url: string) => Response) => {
  fetchMock = vi.fn(async (url: string) =>
    url.startsWith("/api/profile/alignments")
      ? json({ alignments: mine })
      : url.startsWith("/api/confidentiality")
        ? json({ agreement: null, you: null, message: null })
        : answer(url)
  );
  vi.stubGlobal("fetch", fetchMock);
};
const page = (rows: unknown[], more = false, query: string | null = null) =>
  json({
    kinds: [{ id: "seat_terms", label: "Role terms" }],
    rows,
    more,
    query,
  });

beforeEach(() => {
  signedIn = { id: "u-hal" };
  mine = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("who reads the register", () => {
  it("a guest answered 401 reads the members line, with no doors and no rows", async () => {
    serve(() => json({ error: "auth_required" }, 401));
    render(<Aligned />);
    expect(
      await screen.findByText("Members read what the village has aligned with.")
    ).toBeTruthy();
    expect(screen.queryByText("Terms for Orchard steward")).toBeNull();
  });
});

describe("a member reads the record", () => {
  it("grouped by year, newest year first, each row with its parties, state, day and how the village aligned, and no count", async () => {
    serve(() => page(ROWS));
    render(<Aligned />);
    expect(
      await screen.findByRole("heading", { level: 3, name: "2026" })
    ).toBeTruthy();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent)
    ).toEqual(["2026", "2025"]);
    const orchard = screen.getByRole("article", {
      name: "Terms for Orchard steward",
    });
    expect(
      within(orchard).getByText("Role terms", { exact: false })
    ).toBeTruthy();
    expect(within(orchard).getByText("In force")).toBeTruthy();
    expect(
      within(orchard).getByText("Aligned on 10 October 2026")
    ).toBeTruthy();
    expect(within(orchard).getByText("Ana Quillfeather")).toBeTruthy();
    expect(orchard.textContent).toContain(
      "Ana Quillfeather, individually: aligned 9 October 2026"
    );
    expect(orchard.textContent).toContain(
      "The village, for the village: aligned 10 October 2026"
    );
    expect(orchard.textContent).toContain(
      "Aligned for the village by Hal Keeper."
    );
    expect(orchard.textContent).toContain(
      "Recorded here. Paid outside the platform."
    );
    const ledger = screen.getByRole("article", {
      name: "Terms for Ledger keeper",
    });
    expect(
      within(ledger)
        .getByRole("link", { name: "Read the vote" })
        .getAttribute("href")
    ).toBe("/decisions/b-0000000000000009");
    const seed = screen.getByRole("article", {
      name: "Terms for Seed librarian",
    });
    expect(within(seed).getByText("Waiting")).toBeTruthy();
    expect(seed.textContent).toContain("Written on 30 December 2025");
    expect(seed.textContent).toContain("The village, for the village: not yet");
    expect(document.body.textContent ?? "").not.toMatch(
      /\b\d+ (?:texts|terms|rows)\b/
    );
  });

  it("draws no hash, even the one the server sends a party", async () => {
    serve(() => page(ROWS));
    render(<Aligned />);
    await screen.findByRole("article", { name: "Terms for Ledger keeper" });
    expect(document.body.innerHTML).not.toContain(HASH);
  });

  it("a search asks the server with the words typed, and clearing it reads the record again", async () => {
    serve(url =>
      url.includes("q=") ? page([ROWS[0]], false, "XTS") : page(ROWS)
    );
    render(<Aligned />);
    await screen.findByRole("heading", { level: 3, name: "2026" });
    fireEvent.change(screen.getByLabelText("Search the register"), {
      target: { value: "XTS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(
      await screen.findByRole("heading", { name: 'Terms that match "XTS"' })
    ).toBeTruthy();
    expect(fetchMock.mock.calls.map(c => String(c[0]))).toContain(
      "/api/aligned?q=XTS"
    );
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Show the whole register" })
    );
    expect(
      await screen.findByRole("heading", { level: 3, name: "2025" })
    ).toBeTruthy();
  });

  it("Show earlier terms asks for the next page and merges it by id", async () => {
    serve(url =>
      url.includes("offset=")
        ? page([ROWS[2], ROWS[1]])
        : page(ROWS.slice(0, 2), true)
    );
    render(<Aligned />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Show earlier terms" })
    );
    expect(
      await screen.findByRole("heading", { level: 3, name: "2025" })
    ).toBeTruthy();
    expect(fetchMock.mock.calls.map(c => String(c[0]))).toContain(
      "/api/aligned?offset=2"
    );
    expect(screen.getAllByRole("article")).toHaveLength(3);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Show earlier terms" })
      ).toBeNull()
    );
  });

  it("the Membership letter kind (PR9): a filter of its own, and the village reads as the letter's author, never as waiting", async () => {
    const letter = row({
      textId: "at-0000000000000004",
      kind: "membership",
      kindLabel: "Membership letter",
      title: "Love Letter",
      body: "Dear Future Fernhollow Family Member,\n",
      seatNames: [],
      money: false,
      village: null,
      href: null,
      parties: [
        {
          partyKey: "user:u-ana",
          label: "Ana Quillfeather",
          capacity: "individually",
          required: true,
          aligned: true,
          alignedOn: "2026-10-11",
        },
        {
          partyKey: "village",
          label: "The village",
          capacity: "for the village",
          required: false,
          aligned: false,
          alignedOn: null,
        },
      ],
    });
    const kinds = [
      { id: "seat_terms", label: "Role terms" },
      { id: "membership", label: "Membership letter" },
    ];
    serve(url =>
      json({
        kinds,
        rows: url.includes("kind=membership") ? [letter] : [...ROWS, letter],
        more: false,
        query: null,
      })
    );
    render(<Aligned />);
    const filter = await screen.findByRole("group", { name: "Kinds" });
    fireEvent.click(
      within(filter).getByRole("button", { name: "Membership letter" })
    );
    await waitFor(() =>
      expect(fetchMock.mock.calls.map(c => String(c[0]))).toContain(
        "/api/aligned?kind=membership"
      )
    );
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
    const article = screen.getByRole("article", { name: "Love Letter" });
    expect(article.textContent).toContain("Membership letter");
    expect(article.textContent).toContain(
      "Ana Quillfeather, individually: aligned 11 October 2026"
    );
    expect(article.textContent).toContain(
      "The village, for the village: wrote these words"
    );
    expect(article.textContent).not.toContain("not yet");
    expect(
      within(article).queryByRole("link", { name: "Read the proposal" })
    ).toBeNull();
  });

  it("an empty register says so", async () => {
    serve(() => page([]));
    render(<Aligned />);
    expect(
      await screen.findByText(/Nothing has been aligned with yet/)
    ).toBeTruthy();
  });
});

describe("where the reader stands", () => {
  const waitingRow = {
    textId: "at-0000000000000009",
    kind: "seat_terms",
    intent: "I align with these terms.",
    title: "Terms for Gate keeper",
    body: "Terms for Gate keeper",
    version: 1,
    seatNames: ["Gate keeper"],
    href: "/seat-applications/sa-9",
    state: "pending",
    why: "Waiting for you to align.",
    sealed: false,
    money: false,
    parties: [],
    you: {
      partyKey: "user:u-hal",
      aligned: false,
      alignedAt: null,
      mayAlign: true,
    },
    contentHash: HASH,
    createdAt: "2026-11-11",
  };

  it("leads with the texts waiting on the reader, each with its card", async () => {
    mine = [
      waitingRow,
      {
        ...waitingRow,
        textId: "at-0000000000000010",
        title: "Terms for Orchard steward",
        state: "in-force",
        you: {
          partyKey: "user:u-hal",
          aligned: true,
          alignedAt: "2026-10-10",
          mayAlign: false,
        },
      },
    ];
    serve(() => page(ROWS));
    render(<Aligned />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Waiting on you" })
    ).toBeTruthy();
    const you = document.querySelector("[data-aligned-standing]")!;
    expect(you.textContent).toContain("Terms for Gate keeper");
    // CONTROL: a text already in force is not waiting, so it is not drawn here.
    expect(you.textContent).not.toContain("Terms for Orchard steward");
  });

  it("says no terms wait in green only while the agreement is not asked of the reader (QA round 3)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/confidentiality")
          ? json({
              agreement: {
                title: "Confidentiality agreement",
                body: "Keep it inside.",
                intent: "I align.",
                version: "v1",
                document: null,
              },
              you: { holds: false, confirmFresh: true },
              message: null,
            })
          : url.startsWith("/api/profile/alignments")
            ? json({ alignments: [] })
            : page(ROWS)
      )
    );
    render(<Aligned />);
    const line = await screen.findByText("No terms wait on you.");
    await waitFor(() =>
      expect(line.className).toContain("text-muted-foreground")
    );
    expect(line.className).not.toContain("text-open");
    cleanup();
    serve(() => page(ROWS));
    render(<Aligned />);
    // CONTROL: with no agreement asked, it is the held green.
    await waitFor(() =>
      expect(screen.getByText("No terms wait on you.").className).toContain(
        "text-open"
      )
    );
  });

  it("says nothing waits when nothing does", async () => {
    serve(() => page(ROWS));
    render(<Aligned />);
    expect(await screen.findByText("No terms wait on you.")).toBeTruthy();
  });

  it("tells the page how many wait, for its steps", async () => {
    mine = [waitingRow];
    serve(() => page(ROWS));
    const seen: Array<{ waiting: number | null; agreement: string | null }> =
      [];
    render(<Aligned onStatus={s => seen.push(s)} />);
    await waitFor(() =>
      expect(seen.at(-1)).toEqual({ waiting: 1, agreement: "none" })
    );
  });
});
