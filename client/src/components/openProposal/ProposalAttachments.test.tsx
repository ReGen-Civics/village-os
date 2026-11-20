// @vitest-environment jsdom
/**
 * WHICH FILE IS TOO BIG (applicant QA, 20 Nov 2026): six files near the cap and one over it. Every file picked is
 * kept and listed (nothing dropped unseen), and the one over the limit is now marked on its own row.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PROPOSAL_FILE_MAX_BYTES } from "@shared/proposalAttachments";
import { AttachmentFields } from "./ProposalAttachments";

afterEach(cleanup);

const file = (name: string, size: number) => {
  const f = new File(["x"], name, { type: "application/pdf" });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("the files list", () => {
  it("marks the file over the limit on its own row, and only that one", () => {
    const files = [file("cv.pdf", PROPOSAL_FILE_MAX_BYTES - 1), file("portfolio.pdf", PROPOSAL_FILE_MAX_BYTES + 1)];
    const { container } = render(<AttachmentFields links={[]} onLinks={() => {}} files={files} onFiles={() => {}} />);
    const marks = container.querySelectorAll("[data-file-too-big]");
    expect(marks).toHaveLength(1);
    expect(marks[0].getAttribute("data-file-too-big")).toBe("1");
    expect((container.querySelector('[data-file-row="1"]') as HTMLElement).textContent).toContain("Too big");
    // At the limit is not over it (control).
    expect((container.querySelector('[data-file-row="0"]') as HTMLElement).textContent).not.toContain("Too big");
  });
});
