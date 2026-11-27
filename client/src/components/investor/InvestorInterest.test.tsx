// @vitest-environment jsdom
/**
 * THE INVESTOR GATE ON THE PAGE (the lead, 27 Nov 2026: "hide all the wording on investor for now to just give a
 * form for investors to give their information if they are interested").
 *
 * A reader without access sees a welcome line and the interest form, and none of the investor page: nothing asks
 * for the summary, and none of the page's words are drawn. What the village already holds comes filled in and
 * locked. The form sends its answers, with the privacy words the reader saw, and says thank you.
 * (The whole page for a reader the team let in is pages/JourneyPages.test.tsx, "/investor".)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/hooks/useVillageName", () => ({ useVillageName: () => "Riverbend" }));
vi.mock("@/lib/gameApi", async (orig) => ({ ...(await orig<object>()), authToken: () => null, useVillageLinks: () => ({ contactEmail: "hello@riverbend.example" }) }));
vi.mock("@/components/InvestorSummary", () => ({ default: () => <p>THE SUMMARY</p> }));

import InvestorJourney from "@/pages/InvestorJourney";

type Answer = { access: boolean; prefill: { name: string; email: string; whatsapp: string; link: string; locked: boolean }; request: null | { sentAt: string; status: string } };
let answer: Answer;
const asked: { url: string; method: string; body: any }[] = [];

beforeEach(() => {
  asked.length = 0;
  answer = { access: false, prefill: { name: "Ana Prueba", email: "ana@example.test", whatsapp: "+506 8888 0000", link: "", locked: true }, request: null };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    asked.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url === "/api/investor/access") return new Response(JSON.stringify(answer), { status: 200 });
    if (url === "/api/investor/interest") return new Response(JSON.stringify({ ok: true, id: "s1" }), { status: 200 });
    return new Response("{}", { status: 404 });
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the investor page for a reader the team has not let in", () => {
  it("draws only the welcome and the form, and asks for none of the page", async () => {
    render(<InvestorJourney />);
    expect(await screen.findByRole("heading", { level: 1, name: "Investor interest" })).toBeTruthy();
    expect(screen.getByText(/opens the investor page of Riverbend to the people it accepts/)).toBeTruthy();
    expect(screen.queryByText("THE SUMMARY")).toBeNull();
    expect(screen.queryByText(/Capital Contributor Journey/)).toBeNull();
    expect(asked.map((a) => a.url)).toEqual(["/api/investor/access"]);
  });

  it("fills in and locks what the village already holds, and keeps every other question optional", async () => {
    render(<InvestorJourney />);
    const name = (await screen.findByLabelText("Name")) as HTMLInputElement;
    expect(name.value).toBe("Ana Prueba");
    expect(name.readOnly).toBe(true);
    expect((screen.getByLabelText("Email") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText(/WhatsApp number/) as HTMLInputElement).value).toBe("+506 8888 0000");
    expect(screen.getByText("We already have these from when you came in.")).toBeTruthy();
    for (const q of [/Accreditation status/, /Your typical check size/, /Your investment thesis/, /What kind of investor are you/]) {
      expect(screen.getByText(q).textContent).toMatch(/\(optional\)/);
    }
    expect(document.querySelectorAll("[required]")).toHaveLength(2);
  });

  it("sends the answers with the words the reader saw, and says thank you", async () => {
    render(<InvestorJourney />);
    fireEvent.change(await screen.findByLabelText(/Accreditation status/), { target: { value: "accredited" } });
    fireEvent.change(screen.getByLabelText(/Your typical check size/), { target: { value: "100k-250k" } });
    fireEvent.change(screen.getByLabelText(/Your investment thesis/), { target: { value: "Land kept whole." } });
    fireEvent.click(screen.getByLabelText("Land"));
    fireEvent.click(screen.getByRole("button", { name: /Send my interest/ }));
    expect(await screen.findByText("Thank you.")).toBeTruthy();
    const sent = asked.find((a) => a.url === "/api/investor/interest")!;
    expect(sent.method).toBe("POST");
    expect(sent.body).toMatchObject({ name: "Ana Prueba", email: "ana@example.test", accreditation: "accredited", checkSize: "100k-250k", thesis: "Land kept whole.", interests: ["land"], website: "" });
    expect(sent.body.consent).toMatch(/expression of interest/);
    expect(sent.body.consent).toMatch(/hello@riverbend\.example/);
  });

  it("asks for a name and an email when nothing is held, and sends nothing without them", async () => {
    answer = { access: false, prefill: { name: "", email: "", whatsapp: "", link: "", locked: false }, request: null };
    render(<InvestorJourney />);
    fireEvent.click(await screen.findByRole("button", { name: /Send my interest/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(asked.some((a) => a.url === "/api/investor/interest")).toBe(false);
    expect((screen.getByLabelText("Name") as HTMLInputElement).readOnly).toBe(false);
  });

  it("says when a form was already sent", async () => {
    answer = { ...answer, request: { sentAt: "2026-11-20T12:00:00.000Z", status: "new" } };
    render(<InvestorJourney />);
    await waitFor(() => expect(document.querySelector("[data-investor-sent-before]")?.textContent).toMatch(/Send it again to add or change anything/));
  });
});
