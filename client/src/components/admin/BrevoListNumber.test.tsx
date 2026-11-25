// @vitest-environment jsdom
/**
 * The Brevo list's number lives on the Brevo card, and it is the game variable `entrance.brevo_list_id`
 * read and written through the variables route: one store, so Game Mechanics shows the same value.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BrevoListNumber, { BREVO_LIST_DIAL } from "./BrevoListNumber";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BrevoListNumber", () => {
  it("shows the saved number, and saves a new one through the variables route", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body as string | undefined });
        if ((init?.method ?? "GET") === "PUT") return { ok: true, status: 200, json: async () => ({ ok: true }) };
        return { ok: true, status: 200, json: async () => ({ categories: [{ name: "x", variables: [{ key: BREVO_LIST_DIAL, value: "3", default: "0" }] }] }) };
      }),
    );
    render(<BrevoListNumber password="pw" />);
    const field = (await screen.findByLabelText("List number")) as HTMLInputElement;
    await waitFor(() => expect(field.value).toBe("3"));
    expect(screen.getByText(/0 means nobody is sent to Brevo/)).toBeTruthy();
    fireEvent.change(field, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Save number" }));
    await screen.findByText("Saved.");
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toContain(`/admin/variables/${encodeURIComponent(BREVO_LIST_DIAL)}`);
    expect(JSON.parse(put.body!)).toEqual({ value: "7" });
  });

  it("names the refusal when the server says no", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        (init?.method ?? "GET") === "PUT"
          ? { ok: false, status: 400, json: async () => ({ error: "Must be at most 100000000" }) }
          : { ok: true, status: 200, json: async () => ({ categories: [{ name: "x", variables: [{ key: BREVO_LIST_DIAL, value: "0" }] }] }) },
      ),
    );
    render(<BrevoListNumber password="pw" />);
    const field = (await screen.findByLabelText("List number")) as HTMLInputElement;
    await waitFor(() => expect(field.value).toBe("0"));
    fireEvent.change(field, { target: { value: "999999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Save number" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Must be at most");
  });
});
