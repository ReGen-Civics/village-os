// @vitest-environment jsdom
import { Trans } from "@lingui/react/macro";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { compileMessage } from "@lingui/message-utils/compileMessage";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG_RETRY_MS, LocaleProvider, useLocale, LOCALE_STORAGE_KEY } from "./LocaleProvider";

/** A compiled catalog the way the server sends it: id -> compiled message. */
function catalog(pairs: Record<string, string>) {
  const messages: Record<string, unknown> = {};
  for (const [english, spanish] of Object.entries(pairs)) messages[generateMessageId(english)] = compileMessage(spanish);
  return { messages };
}

function Hello() {
  return (
    <p>
      <Trans>Hello there</Trans> <Trans>Nobody translated me</Trans>
    </p>
  );
}

function Switcher() {
  const { setLocale } = useLocale();
  return (
    <>
      <button onClick={() => setLocale("es")}>to-es</button>
      <button onClick={() => setLocale(null)}>to-browser</button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = `${LOCALE_STORAGE_KEY}=; max-age=0; path=/`;
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
});
afterEach(() => vi.useRealTimers());

describe("LocaleProvider", () => {
  it("renders English with no catalog request when English resolves", async () => {
    const fetchCatalog = vi.fn();
    render(
      <LocaleProvider sources={{ browser: ["en-GB"], villageDefault: null }} fetchCatalog={fetchCatalog}>
        <Hello />
      </LocaleProvider>,
    );
    expect(await screen.findByText(/Hello there/)).toBeTruthy();
    expect(fetchCatalog).not.toHaveBeenCalled();
    expect(document.documentElement.lang).toBe("en");
  });

  it("renders the browser's language from the server catalog, and English for an id the catalog lacks", async () => {
    const fetchCatalog = vi.fn(async () => catalog({ "Hello there": "Hola" }));
    render(
      <LocaleProvider sources={{ browser: ["es-CR", "en"], villageDefault: null }} fetchCatalog={fetchCatalog}>
        <Hello />
      </LocaleProvider>,
    );
    expect(await screen.findByText(/Hola/)).toBeTruthy();
    expect(screen.getByText(/Nobody translated me/)).toBeTruthy();
    expect(fetchCatalog).toHaveBeenCalledWith("es");
    expect(document.documentElement.lang).toBe("es");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("shows nothing of the page while the catalog loads, then English after the timeout, with lang=en", async () => {
    vi.useFakeTimers();
    let release: (v: unknown) => void = () => {};
    const fetchCatalog = vi.fn(() => new Promise((r) => { release = r; }));
    render(
      <LocaleProvider sources={{ browser: ["es"], villageDefault: null }} fetchCatalog={fetchCatalog as never} timeoutMs={1500}>
        <Hello />
      </LocaleProvider>,
    );
    expect(screen.queryByText(/Hello there/)).toBeNull();
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(screen.getByText(/Hello there/)).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
    // It lands before anyone touched the page: switch to it.
    await act(async () => { release(catalog({ "Hello there": "Hola" })); });
    expect(screen.getByText(/Hola/)).toBeTruthy();
    expect(document.documentElement.lang).toBe("es");
  });

  it("a failed catalog request leaves the page in English, never blank", async () => {
    const fetchCatalog = vi.fn(async () => { throw new Error("offline"); });
    render(
      <LocaleProvider sources={{ browser: ["es"], villageDefault: null }} fetchCatalog={fetchCatalog}>
        <Hello />
      </LocaleProvider>,
    );
    expect(await screen.findByText(/Hello there/)).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
  });

  it("switching saves the choice for this browser, re-renders without a reload, and 'use my browser' clears it", async () => {
    const fetchCatalog = vi.fn(async () => catalog({ "Hello there": "Hola" }));
    render(
      <LocaleProvider sources={{ browser: ["en"], villageDefault: null }} fetchCatalog={fetchCatalog}>
        <Hello />
        <Switcher />
      </LocaleProvider>,
    );
    await screen.findByText(/Hello there/);
    await act(async () => { screen.getByText("to-es").click(); });
    expect(await screen.findByText(/Hola/)).toBeTruthy();
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("es");
    expect(document.cookie).toContain(`${LOCALE_STORAGE_KEY}=es`);
    await act(async () => { screen.getByText("to-browser").click(); });
    expect(await screen.findByText(/Hello there/)).toBeTruthy();
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
    expect(document.cookie).not.toContain(`${LOCALE_STORAGE_KEY}=es`);
  });

  it("a choice saved in this browser beats the browser's languages", async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "es");
    const fetchCatalog = vi.fn(async () => catalog({ "Hello there": "Hola" }));
    render(
      <LocaleProvider sources={{ browser: ["en"], villageDefault: null }} fetchCatalog={fetchCatalog}>
        <Hello />
      </LocaleProvider>,
    );
    expect(await screen.findByText(/Hola/)).toBeTruthy();
  });

  // A slow or flaky phone (Spanish phone QA, 15 Nov 2026): a whole visit used to stay in English.
  describe("a late or failed catalog on a slow phone", () => {
    function Page() {
      return (
        <>
          <Hello />
          <input aria-label="why" />
          <button>next</button>
        </>
      );
    }
    const slow = () => {
      let release: (v: unknown) => void = () => {};
      const fetchCatalog = vi.fn(() => new Promise((r) => { release = r; }));
      return { fetchCatalog, release: (v: unknown) => release(v) };
    };

    it("a late catalog is applied after a tap or a scroll: touching the page is not typing", async () => {
      vi.useFakeTimers();
      const c = slow();
      render(
        <LocaleProvider sources={{ browser: ["es"], villageDefault: null }} fetchCatalog={c.fetchCatalog as never} timeoutMs={1500}>
          <Page />
        </LocaleProvider>,
      );
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(screen.getByText(/Hello there/)).toBeTruthy();
      fireEvent.pointerDown(document.body);
      fireEvent.scroll(window);
      fireEvent.keyDown(document.body, { key: "ArrowDown" });
      await act(async () => { c.release(catalog({ "Hello there": "Hola" })); });
      expect(screen.getByText(/Hola/)).toBeTruthy();
      expect(document.documentElement.lang).toBe("es");
    });

    it("after typing in a field, a late catalog waits for the next step, and the words typed stay", async () => {
      vi.useFakeTimers();
      const c = slow();
      render(
        <LocaleProvider sources={{ browser: ["es"], villageDefault: null }} fetchCatalog={c.fetchCatalog as never} timeoutMs={1500}>
          <Page />
        </LocaleProvider>,
      );
      await act(async () => { vi.advanceTimersByTime(1500); });
      const field = screen.getByLabelText("why") as HTMLInputElement;
      fireEvent.input(field, { target: { value: "Llevo diez años" } });
      await act(async () => { c.release(catalog({ "Hello there": "Hola" })); });
      // Held: nothing changes under a sentence being written.
      expect(screen.getByText(/Hello there/)).toBeTruthy();
      expect(document.documentElement.lang).toBe("en");
      // The next step applies it.
      await act(async () => { screen.getByText("next").click(); vi.advanceTimersByTime(0); });
      expect(screen.getByText(/Hola/)).toBeTruthy();
      expect(document.documentElement.lang).toBe("es");
      expect(field.value).toBe("Llevo diez años");
    });

    it("a failed catalog is tried again with growing waits, and applied when it loads", async () => {
      vi.useFakeTimers();
      let calls = 0;
      const fetchCatalog = vi.fn(async () => {
        calls += 1;
        if (calls < 3) throw new Error("offline");
        return catalog({ "Hello there": "Hola" });
      });
      render(
        <LocaleProvider sources={{ browser: ["es"], villageDefault: null }} fetchCatalog={fetchCatalog} timeoutMs={1500}>
          <Page />
        </LocaleProvider>,
      );
      await act(async () => {});
      expect(screen.getByText(/Hello there/)).toBeTruthy();
      expect(fetchCatalog).toHaveBeenCalledTimes(1);
      await act(async () => { vi.advanceTimersByTime(CATALOG_RETRY_MS[0] - 1); });
      expect(fetchCatalog).toHaveBeenCalledTimes(1);
      await act(async () => { vi.advanceTimersByTime(1); });
      expect(fetchCatalog).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Hello there/)).toBeTruthy();
      await act(async () => { vi.advanceTimersByTime(CATALOG_RETRY_MS[1]); });
      expect(fetchCatalog).toHaveBeenCalledTimes(3);
      expect(screen.getByText(/Hola/)).toBeTruthy();
      expect(document.documentElement.lang).toBe("es");
    });

    it("coming back online tries again at once, without waiting out the backoff", async () => {
      vi.useFakeTimers();
      let up = false;
      const fetchCatalog = vi.fn(async () => {
        if (!up) throw new Error("offline");
        return catalog({ "Hello there": "Hola" });
      });
      render(
        <LocaleProvider sources={{ browser: ["es"], villageDefault: null }} fetchCatalog={fetchCatalog} timeoutMs={1500}>
          <Page />
        </LocaleProvider>,
      );
      await act(async () => {});
      expect(screen.getByText(/Hello there/)).toBeTruthy();
      up = true;
      await act(async () => { window.dispatchEvent(new Event("online")); });
      expect(fetchCatalog).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Hola/)).toBeTruthy();
    });

    it("stops after the last wait: no endless loop while the phone stays offline", async () => {
      vi.useFakeTimers();
      const fetchCatalog = vi.fn(async () => { throw new Error("offline"); });
      render(
        <LocaleProvider sources={{ browser: ["es"], villageDefault: null }} fetchCatalog={fetchCatalog} timeoutMs={1500}>
          <Page />
        </LocaleProvider>,
      );
      await act(async () => {});
      for (const wait of CATALOG_RETRY_MS) await act(async () => { vi.advanceTimersByTime(wait); });
      await act(async () => { vi.advanceTimersByTime(10 * 60_000); });
      expect(fetchCatalog).toHaveBeenCalledTimes(CATALOG_RETRY_MS.length + 1);
      expect(screen.getByText(/Hello there/)).toBeTruthy();
    });
  });
});
