// @vitest-environment jsdom
/**
 * THE WAITLIST FORM, SUBMITTED END TO END (applicant reviewer, 24 Nov 2026: "I cannot join the waitlist").
 * What it sends, the thank-you it shows, and a refusal said in the reader's words on its own field.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/ContributorRoutes", () => ({ default: () => <div data-contributor-routes="" /> }));

import WaitlistForm from "./WaitlistForm";

let sent: any[] = [];
let answer: { status: number; body: unknown } = { status: 200, body: { ok: true } };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const serve = () => {
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } });
    }),
  );
};
const roles = [
  { id: "water", name: "Water Keeper" },
  { id: "seed", name: "Seed Keeper" },
];
const fill = () => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.org" } });
  fireEvent.change(screen.getByLabelText("WhatsApp number (optional)"), { target: { value: "‪+506 8888 8888‬" } });
  fireEvent.click(screen.getByLabelText(/Yes, write to me/));
};

describe("the waitlist form", () => {
  it("sends the address, the number, the chosen role and the tick, and says thank you", async () => {
    answer = { status: 200, body: { ok: true } };
    serve();
    render(<WaitlistForm roles={roles} chosen="water" />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/Your details are saved\. We will write when the role opens\./);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("/api/roles/waitlist");
    expect(sent[0].body).toEqual({ email: "ana@example.org", whatsapp: "‪+506 8888 8888‬", roleIds: ["water"], consent: true });
  });

  it("a refused number is said in the reader's words on its own field, and the form stays to fix it", async () => {
    answer = { status: 400, body: { error: "invalid", field: "whatsapp", message: "Server words" } };
    serve();
    render(<WaitlistForm roles={roles} chosen="water" />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Write the WhatsApp number with its country code, like +506 8888 8888, or leave it empty.");
    expect(screen.getByLabelText("WhatsApp number (optional)").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBeNull();
    expect(document.querySelector("[data-waitlist-form]")).toBeTruthy();
  });

  it("no role ticked keeps Notify me off, so nothing is sent (control)", () => {
    serve();
    render(<WaitlistForm roles={roles} chosen="water" />);
    fireEvent.click(screen.getByLabelText("Water Keeper"));
    expect((screen.getByRole("button", { name: "Notify me" }) as HTMLButtonElement).disabled).toBe(true);
    expect(sent).toHaveLength(0);
  });
});
