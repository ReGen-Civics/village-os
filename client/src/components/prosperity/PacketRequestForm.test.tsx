// @vitest-environment jsdom
/**
 * THE PROSPERITY PACKET, ASKED FOR ON THE PAGE (24 Nov 2026): the form posts a
 * `prosperity-packet` to the public forms door with its honeypot, refuses to
 * send what is missing or wrong and says every problem at once, says a failed
 * send beside the button, and gives way to a clear sent state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const sent: Array<{ type: string; data: any; hp: string }> = [];
let answer: { ok: boolean; idea: null } = { ok: true, idea: null };
vi.mock("@/lib/proposals", () => ({
  sendProposal: async (type: string, data: unknown, hp: string) => {
    sent.push({ type, data, hp });
    return answer;
  },
}));

import PacketRequestForm from "./PacketRequestForm";
import { packetFrom, packetProblems } from "@shared/prosperityPacket";

beforeEach(() => {
  sent.length = 0;
  answer = { ok: true, idea: null };
});
afterEach(cleanup);

const fill = () => {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: " Ana Lima " } });
  fireEvent.change(screen.getByLabelText("Your email"), { target: { value: " ana@example.org " } });
  fireEvent.change(screen.getByLabelText("What you would like to build"), { target: { value: "A bakery with the village's grain" } });
};

describe("the packet request form", () => {
  it("posts a prosperity-packet with every field trimmed and an empty honeypot, then shows the sent state with focus on it", async () => {
    render(<PacketRequestForm sendLabel="Request Packet" />);
    fill();
    fireEvent.change(screen.getByLabelText(/Anything else/), { target: { value: "  We can start in spring.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Request Packet" }));
    await waitFor(() => expect(document.querySelector("[data-packet-sent]")).toBeTruthy());
    expect(sent).toEqual([{ type: "prosperity-packet", hp: "", data: { name: "Ana Lima", email: "ana@example.org", build: "A bakery with the village's grain", note: "We can start in spring." } }]);
    expect(screen.getByRole("status").textContent).toContain("Your request is on its way");
    // Focus moves in an effect after the sent state paints; wait for it rather than reading it in the same tick.
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector("[data-packet-sent]")));
    expect(document.querySelector("[data-packet-form]")).toBeNull();
  });

  it("refuses to send with nothing filled in, lists every problem, and puts the cursor in the first field", async () => {
    render(<PacketRequestForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send my request" }));
    await waitFor(() => expect(document.querySelector("[data-packet-problems]")).toBeTruthy());
    expect(sent).toEqual([]);
    expect(document.querySelector("[data-packet-problems]")?.getAttribute("data-packet-problems")).toBe("3");
    expect(Array.from(document.querySelectorAll("[data-field-problem]")).map((p) => p.getAttribute("data-field-problem"))).toEqual(["name", "email", "build"]);
    expect(screen.getByLabelText("Your email").getAttribute("aria-invalid")).toBe("true");
    await waitFor(() => expect(document.activeElement?.id).toBe("packet-name"));
  });

  it("refuses an email that is not an address, and sends once it is fixed", async () => {
    render(<PacketRequestForm />);
    fill();
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "ana at example" } });
    fireEvent.click(screen.getByRole("button", { name: "Send my request" }));
    await waitFor(() => expect(document.querySelector('[data-field-problem="email"]')).toBeTruthy());
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "ana@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Send my request" }));
    await waitFor(() => expect(document.querySelector("[data-packet-sent]")).toBeTruthy());
    expect(sent).toHaveLength(1);
  });

  it("says a failed send beside the button and keeps what was typed", async () => {
    answer = { ok: false, idea: null };
    render(<PacketRequestForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send my request" }));
    await waitFor(() => expect(document.querySelector('[data-packet-problem="send"]')).toBeTruthy());
    expect(document.querySelector("[data-packet-sent]")).toBeNull();
    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe(" Ana Lima ");
  });
});

describe("the shared check the server runs too", () => {
  it("reads a wrong shape as empty, so it fails the check", () => {
    expect(packetProblems(packetFrom({ name: ["Ana"], email: { a: 1 }, build: 7 }))).toEqual(["name", "email", "build"]);
    expect(packetProblems(packetFrom(null))).toEqual(["name", "email", "build"]);
    expect(packetProblems(packetFrom({ name: "Ana", email: "ana@example.org", build: "A bakery", note: "x".repeat(2001) }))).toEqual(["note"]);
    expect(packetProblems(packetFrom({ name: "Ana", email: "ana@example.org", build: "A bakery" }))).toEqual([]);
  });
});

describe("the email check", () => {
  const email = (e: string) => packetProblems({ name: "Ana", email: e, build: "A bakery", note: "" }).includes("email");
  it("takes an address and refuses what is not one", () => {
    expect(email("ana@example.org")).toBe(false);
    expect(email(" ana@example.org ")).toBe(false);
    for (const bad of ["", "ana", "ana@", "@example.org", "ana@example", "ana@.org", "ana@example.", "a@b@example.org", "ana @example.org"]) expect(email(bad), bad).toBe(true);
  });

  it("answers at once on a long hostile string (CodeQL: no backtracking pattern over a stranger's text)", () => {
    const hostile = "!@!." + "!.".repeat(50_000);
    const t0 = Date.now();
    expect(email(hostile)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(200);
  });
});
