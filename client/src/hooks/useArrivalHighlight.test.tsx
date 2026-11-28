// @vitest-environment jsdom
/**
 * The one hook: which moves count as landing on an anchor. The work it hands off (lib/arrivalHighlight.ts) is
 * stood in for, so these read only who is asked to arrive, and when.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const arrive = vi.hoisted(() => vi.fn());
vi.mock("@/lib/arrivalHighlight", () => ({ arrive }));

import { forgetArrival, useArrivalHighlight } from "./useArrivalHighlight";

function Probe() {
  useArrivalHighlight();
  return <a href="#reports">Reports</a>;
}

/** Lets the hook's lazy import settle. */
const settle = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

beforeEach(() => {
  forgetArrival();
  arrive.mockClear();
  window.history.replaceState(null, "", "/");
});
afterEach(cleanup);

describe("useArrivalHighlight", () => {
  it("lights the section a page opens at", async () => {
    window.history.replaceState(null, "", "/governance/treasury#cash");
    render(<Probe />);
    await settle();
    expect(arrive).toHaveBeenCalledWith("#cash", "/governance/treasury");
  });

  it("does nothing for an address with no hash", async () => {
    render(<Probe />);
    await settle();
    expect(arrive).not.toHaveBeenCalled();
  });

  it("follows a change of hash and Back and Forward", async () => {
    render(<Probe />);
    window.history.replaceState(null, "", "/rights#good-neighbor");
    window.dispatchEvent(new Event("hashchange"));
    await settle();
    expect(arrive).toHaveBeenLastCalledWith("#good-neighbor", "/rights");
    window.history.replaceState(null, "", "/rights#leaving-well");
    window.dispatchEvent(new Event("popstate"));
    await settle();
    expect(arrive).toHaveBeenLastCalledWith("#leaving-well", "/rights");
  });

  it("counts a same-page move after a link was pressed, never after a tab only wrote the hash", async () => {
    window.history.replaceState(null, "", "/places");
    const { getByText } = render(
      <>
        <Probe />
        <button type="button">Photos</button>
      </>,
    );
    getByText("Photos").click();
    window.history.pushState(null, "", "/places#photos");
    window.dispatchEvent(new Event("pushState"));
    await settle();
    expect(arrive).not.toHaveBeenCalled();
    const link = getByText("Reports");
    link.addEventListener("click", (e) => e.preventDefault());
    link.click();
    window.history.pushState(null, "", "/places#reports");
    window.dispatchEvent(new Event("pushState"));
    await settle();
    expect(arrive).toHaveBeenCalledWith("#reports", "/places");
  });

  it("asks once when the router and the history event report the same move", async () => {
    window.history.replaceState(null, "", "/season#plan");
    render(<Probe />);
    window.dispatchEvent(new Event("popstate"));
    window.dispatchEvent(new Event("hashchange"));
    await settle();
    expect(arrive).toHaveBeenCalledTimes(1);
  });
});
