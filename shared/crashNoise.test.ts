/**
 * The noise and signature rules the crash route applies (the lead, 25 Nov 2026). Every message here is one a
 * browser really sends; the noise ones came in by email before this.
 */
import { describe, expect, it } from "vitest";
import { browserKind, crashSignature, framesAreOurs, isCrashNoise, stableFrame } from "./crashNoise";
import { isNoise } from "../client/src/lib/crashReport";

const OURS = ["render@/assets/Roles-B6yHa53f.js:12:345"];
const THEIRS = ["@https://cdn.example.test/widget.js:3:4"];

describe("isCrashNoise", () => {
  it("drops what nobody can act on", () => {
    for (const m of ["", "Script error.", "ResizeObserver loop limit exceeded", "ResizeObserver loop completed with undelivered notifications.", "Failed to fetch", "TypeError: Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "The network connection was lost."]) {
      expect(isCrashNoise(m, []), m).toBe(true);
    }
    expect(isCrashNoise("x is not a function", ["run@safari-web-extension://abc/content.js:1:2"])).toBe(true);
    for (const m of ["Cannot read properties of undefined (reading 'ethereum')", "Can't find variable: __firefox__", "undefined is not an object (evaluating 'window.webkit.messageHandlers')", "__gCrWeb is not defined"]) {
      expect(isCrashNoise(m, THEIRS), m).toBe(true);
    }
  });

  it("keeps a real error, including one that only mentions a fetch, and an injected global our code reached for", () => {
    expect(isCrashNoise("Cannot access uninitialized variable.", [])).toBe(false);
    expect(isCrashNoise("Failed to fetch the role list: 500", [])).toBe(false);
    expect(isCrashNoise("window.ethereum is undefined", OURS)).toBe(false);
  });

  it("agrees with the page's own filter on everything the page already drops", () => {
    for (const [m, stack] of [["Script error.", ""], ["Load failed", ""], ["x", "chrome-extension://a/b.js"], ["ResizeObserver loop limit exceeded", ""]] as const) {
      expect(isNoise(m, stack)).toBe(true);
      expect(isCrashNoise(m, stack)).toBe(true);
    }
  });
});

describe("framesAreOurs", () => {
  it("is a frame from our /assets/ bundle, anywhere in the stack", () => {
    expect(framesAreOurs(OURS)).toBe(true);
    expect(framesAreOurs([...THEIRS, ...OURS])).toBe(true);
    expect(framesAreOurs(THEIRS)).toBe(false);
    expect(framesAreOurs([])).toBe(false);
  });
});

describe("crashSignature", () => {
  it("is stable across a deploy: the chunk's hash and the line and column come out", () => {
    expect(stableFrame("render@/assets/Roles-B6yHa53f.js:12:345")).toBe("render@/assets/Roles.js");
    expect(stableFrame("at render (/assets/Roles-Zz_9-8Yy.js:1:9)")).toBe("at render (/assets/Roles.js)");
    expect(crashSignature("n is null", ["render@/assets/Roles-B6yHa53f.js:12:345"])).toBe(crashSignature("n is null", ["render@/assets/Roles-Q1w2E3r4.js:99:1"]));
  });

  it("tells two different bugs apart, and the same message from two functions apart", () => {
    expect(crashSignature("n is null", OURS)).not.toBe(crashSignature("m is null", OURS));
    expect(crashSignature("n is null", ["a@/assets/X-B6yHa53f.js:1:1"])).not.toBe(crashSignature("n is null", ["b@/assets/X-B6yHa53f.js:1:1"]));
  });

  it("numbers in the message do not split one bug into many", () => {
    expect(crashSignature("Index 12 out of range", [])).toBe(crashSignature("Index 40 out of range", []));
  });
});

describe("browserKind", () => {
  it("names the kind a person triages by", () => {
    expect(browserKind("Safari 17 iOS")).toBe("Safari iOS");
    expect(browserKind("WebKit iOS")).toBe("in-app browser (iOS)");
    expect(browserKind("Chrome 131 Android")).toBe("Chrome Android");
    expect(browserKind("other Linux")).toBe("other browser (Linux)");
    expect(browserKind("")).toBe("unknown browser");
  });
});
