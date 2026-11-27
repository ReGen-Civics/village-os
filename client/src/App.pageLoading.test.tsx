// @vitest-environment jsdom
/**
 * THE SHELL STAYS UP WHILE A PAGE ARRIVES (the five-reviewer QA pass, 25 Nov 2026). Every page draws its own Layout,
 * so the router's wait used to stand in for the header and the bar too, and the first tap to a page not yet loaded
 * blanked the whole screen. The wait now draws the shell with the quiet loader in the content area, except on the
 * pages that draw no shell of their own.
 */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <div data-testid="shell">{children}</div> }));
vi.mock("@/components/natural/QuietLoading", () => ({ default: ({ label }: { label: string }) => <p data-testid="quiet">{label}</p> }));

import { PageLoading } from "./App";

afterEach(() => cleanup());

const at = (path: string) => {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <PageLoading />
    </Router>,
  );
};

describe("the wait while a page arrives", () => {
  for (const path of ["/quests", "/roles/some-role", "/gratitude"]) {
    it(`keeps the header and the bar up on ${path}, the loader inside them`, () => {
      at(path);
      const shell = screen.getByTestId("shell");
      expect(shell.contains(screen.getByTestId("quiet"))).toBe(true);
    });
  }

  for (const path of ["/admin", "/admin/anything", "/oauth/authorize", "/reset"]) {
    it(`draws no shell on ${path}, a page that has none of its own`, () => {
      at(path);
      expect(screen.queryByTestId("shell")).toBeNull();
      expect(screen.getByTestId("quiet")).toBeTruthy();
    });
  }
});
