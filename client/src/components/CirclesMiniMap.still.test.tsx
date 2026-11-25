// @vitest-environment jsdom
/**
 * The circles picture for a reader the living map is closed to (the five-reviewer QA pass, 25 Nov 2026): the picture
 * stays, with words that say so, and nothing invites a click into a room that would refuse them.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import CirclesMiniMap from "./CirclesMiniMap";

afterEach(() => cleanup());

const circles = [{ id: "c1", name: "Land", color: null }] as any;
const seats = [{ id: "s1", circleId: "c1", vacant: true }] as any;

describe("the circles picture", () => {
  it("opens the living map for a reader it is open to", () => {
    render(<Router><CirclesMiniMap circles={circles} seats={seats} /></Router>);
    expect(document.querySelector('a[href="/map/circles"]')).toBeTruthy();
  });

  it("is a still picture with its own words, and no link, for a reader it is closed to", () => {
    render(
      <Router>
        <CirclesMiniMap circles={circles} seats={seats} door={{ opens: false, title: "How the circles sit together", detail: "The living map opens to members.", ariaLabel: "A picture of the circles" }} />
      </Router>,
    );
    expect(document.querySelector("a")).toBeNull();
    expect(document.querySelector("[data-mini-map-still]")).toBeTruthy();
    expect(screen.getByText("How the circles sit together")).toBeTruthy();
    expect(screen.queryByText(/Walk the circles/)).toBeNull();
  });
});
