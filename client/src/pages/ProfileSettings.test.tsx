// @vitest-environment jsdom
/**
 * Profile settings (Direction D): six groups, a search that narrows them, a group opened by tap or by its
 * address, and the moved panels each drawn in their group. The panels themselves have their own tests;
 * here they are stand-ins, so this file is about the page's shape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false, logout: vi.fn() }) }));
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => null, gameFetch: vi.fn() }));
vi.mock("@/i18n/LanguagePicker", () => ({ LanguagePicker: () => <div data-stub="language" /> }));
vi.mock("@/components/AccountEmailsPanel", () => ({ default: () => <div data-stub="emails" /> }));
vi.mock("@/components/TimeZoneField", () => ({ default: () => <div data-stub="time-zone" /> }));
vi.mock("@/components/BookingLinkField", () => ({ default: () => <div data-stub="booking" /> }));
vi.mock("@/components/profile/AlignedSection", () => ({ default: () => <div data-stub="agreements" /> }));
vi.mock("@/components/profile/PrivacyPanel", () => ({ default: () => <div data-stub="privacy" /> }));
vi.mock("@/components/NotifyPrefsPanel", () => ({ default: () => <div data-stub="notify" /> }));
vi.mock("@/components/guide/GuideChoiceCard", () => ({ default: () => <div data-stub="guide" /> }));
vi.mock("@/components/YourAgentPanel", () => ({ default: () => <div data-stub="agent" /> }));

import ProfileSettings, { SETTINGS_GROUPS } from "./ProfileSettings";

const stub = (name: string) => document.querySelector(`[data-stub="${name}"]`);
const panel = () => document.querySelector("[data-settings-panel]")?.getAttribute("data-settings-panel");

beforeEach(() => window.history.replaceState(null, "", "/profile/settings"));
afterEach(() => cleanup());

describe("ProfileSettings", () => {
  it("lists six groups and opens Account first", () => {
    render(<ProfileSettings />);
    expect(SETTINGS_GROUPS).toEqual(["account", "privacy", "notifications", "look", "inner", "agents"]);
    expect(document.querySelectorAll("[data-settings-group]").length).toBe(6);
    expect(panel()).toBe("account");
    expect(stub("emails")).toBeTruthy();
    expect(stub("time-zone")).toBeTruthy();
    expect(stub("booking")).toBeTruthy();
    expect(stub("agreements")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("opens a group by tap, puts it in the address, and draws its panels", () => {
    render(<ProfileSettings />);
    fireEvent.click(document.querySelector('[data-settings-group="agents"]')!);
    expect(panel()).toBe("agents");
    expect(window.location.hash).toBe("#agents");
    expect(stub("guide")).toBeTruthy();
    expect(stub("agent")).toBeTruthy();
    expect(document.getElementById("your-agent")).toBeTruthy();
  });

  it("opens the group its address names", () => {
    window.history.replaceState(null, "", "/profile/settings#privacy");
    render(<ProfileSettings />);
    expect(panel()).toBe("privacy");
    expect(stub("privacy")).toBeTruthy();
  });

  it("narrows the groups as you type, by name or by what is inside", () => {
    render(<ProfileSettings />);
    const search = screen.getByLabelText("Search settings");
    fireEvent.change(search, { target: { value: "badges" } });
    expect(Array.from(document.querySelectorAll("[data-settings-group]")).map((b) => b.getAttribute("data-settings-group"))).toEqual(["privacy"]);
    fireEvent.change(search, { target: { value: "email" } });
    expect(Array.from(document.querySelectorAll("[data-settings-group]")).map((b) => b.getAttribute("data-settings-group"))).toEqual(["account", "notifications"]);
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(document.querySelectorAll("[data-settings-group]").length).toBe(0);
    expect(screen.getByText("Nothing matches. Try email, privacy or language.")).toBeTruthy();
  });

  it("chooses light or dark, the same choice the header's switch makes", () => {
    render(<ProfileSettings />);
    fireEvent.click(document.querySelector('[data-settings-group="look"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement.dataset.mode).toBe("light");
  });
});
