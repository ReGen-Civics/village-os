// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { kindWordsOf } from "@shared/notificationKindWords";
import { loadNoticeKindWords, useNoticeKindWords } from "./noticeKindWords";

describe("the bell's notice words", () => {
  it("are nothing until the panel wants them, then the platform's words", async () => {
    const { result, rerender } = renderHook(({ open }) => useNoticeKindWords(open), { initialProps: { open: false } });
    expect(result.current).toBeNull();
    rerender({ open: true });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!("gratitude")).toEqual(kindWordsOf("gratitude"));
  });

  it("load once and are kept, so a second bell starts with them", async () => {
    const first = await loadNoticeKindWords();
    await act(async () => {});
    expect(await loadNoticeKindWords()).toBe(first);
    const { result } = renderHook(() => useNoticeKindWords(false));
    expect(result.current).toBe(first);
  });
});
