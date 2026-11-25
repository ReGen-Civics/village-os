// @vitest-environment jsdom
/**
 * A module settings panel's boxes take the stored config in the render that
 * first shows them (useSeedFrom, ModuleConfigPanels.tsx). Server rendering
 * runs no effects, so it shows exactly what the first paint would: with the
 * old `useEffect(reset, [config])` this paints "default" and an edit made in
 * that frame was lost; with useSeedFrom it paints the stored value.
 */
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useSeedFrom } from "./ModuleConfigPanels";

function Probe({ config }: { config: { queue: string } | null }) {
  const [queue, setQueue] = useState("default");
  useSeedFrom(config, () => setQueue(config?.queue ?? "default"));
  return <input aria-label="queue" value={queue} onChange={(e) => setQueue(e.target.value)} />;
}

describe("useSeedFrom", () => {
  it("fills the box in the first paint, with no frame showing the default", () => {
    expect(renderToString(<Probe config={{ queue: "15" }} />)).toContain('value="15"');
  });

  it("keeps an edit until the stored config itself changes, then takes the new one", () => {
    const stored = { queue: "15" };
    const { rerender } = render(<Probe config={stored} />);
    const box = screen.getByLabelText("queue") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "500" } });
    rerender(<Probe config={stored} />);
    expect(box.value).toBe("500");
    rerender(<Probe config={{ queue: "20" }} />);
    expect(box.value).toBe("20");
  });
});
