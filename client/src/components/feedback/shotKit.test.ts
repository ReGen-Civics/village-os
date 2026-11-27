/**
 * Where a mark lands, and the keyboard's ring (fold QA round 1).
 *
 * A phone screenshot shown letterboxed in a wide box put a mark made 90% across at 72.5%, because the
 * pointer was mapped through the element's box and not the picture inside it. And drawing was pointer-only.
 */
import { describe, expect, it } from "vitest";
import { moveRing, pictureXY } from "./shotKit";

const phone = { width: 750, height: 1624 };

describe("pictureXY", () => {
  it("maps through the picture's own rectangle when it is letterboxed in a wider box", () => {
    // A 750x1624 picture fitted into a 600x400 box: drawn 184.7 wide, centred, from x = 207.6.
    const box = { left: 0, top: 0, width: 600, height: 400 };
    const scale = 400 / 1624;
    const drawnLeft = (600 - 750 * scale) / 2;
    const ninetyAcross = drawnLeft + 0.9 * 750 * scale;
    const [x, y] = pictureXY(box, phone, ninetyAcross, 200);
    expect(x / phone.width).toBeCloseTo(0.9, 3);
    expect(y / phone.height).toBeCloseTo(0.5, 3);
  });

  it("is the plain proportion when the box has the picture's shape, as the editor draws it", () => {
    const box = { left: 10, top: 20, width: 375, height: 812 };
    const [x, y] = pictureXY(box, phone, 10 + 0.25 * 375, 20 + 0.75 * 812);
    expect(x / phone.width).toBeCloseTo(0.25, 2);
    expect(y / phone.height).toBeCloseTo(0.75, 2);
  });

  it("keeps a press in the letterbox on the picture's edge, never off it", () => {
    const box = { left: 0, top: 0, width: 600, height: 400 };
    expect(pictureXY(box, phone, 1, 200)[0]).toBe(0);
    expect(pictureXY(box, phone, 599, 200)[0]).toBe(phone.width);
  });
});

describe("moveRing", () => {
  it("moves a twentieth of the picture, a hundredth with Shift, and stays on it", () => {
    expect(moveRing([375, 812], "ArrowRight", false, phone)).toEqual([375 + 37.5, 812]);
    expect(moveRing([375, 812], "ArrowUp", true, phone)).toEqual([375, 812 - 16.24]);
    expect(moveRing([5, 5], "ArrowLeft", false, phone)).toEqual([0, 5]);
    expect(moveRing([5, 1620], "ArrowDown", false, phone)).toEqual([5, 1624]);
  });

  it("leaves every other key to the page", () => {
    expect(moveRing([1, 1], "Tab", false, phone)).toBeNull();
    expect(moveRing([1, 1], "a", false, phone)).toBeNull();
  });
});
