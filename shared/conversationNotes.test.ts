import { describe, expect, it } from "vitest";
import { CONVERSATION_NOTE_MAX, fileFitsKind, mayReadConversationNotes, mayRemoveNote, readNoteBody, storedExtension, type NoteReader } from "./conversationNotes";

const reader = (over: Partial<NoteReader>): NoteReader => ({ isApplicant: false, recused: false, holdsPower: false, isFinalCall: false, holdsConversationRole: false, ...over });

describe("who reads a conversation's notes", () => {
  it("the conversation's role, the final-call role and the power to place roles", () => {
    expect(mayReadConversationNotes(reader({ holdsConversationRole: true }))).toBe(true);
    expect(mayReadConversationNotes(reader({ isFinalCall: true }))).toBe(true);
    expect(mayReadConversationNotes(reader({ holdsPower: true }))).toBe(true);
    // CONTROL: a member with none of these reads nothing.
    expect(mayReadConversationNotes(reader({}))).toBe(false);
  });

  it("never the applicant and never anyone who stepped out, whatever else they hold", () => {
    const everything = { holdsPower: true, isFinalCall: true, holdsConversationRole: true };
    expect(mayReadConversationNotes(reader({ ...everything, isApplicant: true }))).toBe(false);
    expect(mayReadConversationNotes(reader({ ...everything, recused: true }))).toBe(false);
  });

  it("only the author takes a note off", () => {
    expect(mayRemoveNote("u-a", "u-a")).toBe(true);
    expect(mayRemoveNote("u-a", "u-b")).toBe(false);
  });
});

describe("what a note and a file may be", () => {
  it("a written note is trimmed, and refused empty or too long", () => {
    expect(readNoteBody("  hello \r\nthere ")).toEqual({ ok: true, body: "hello \nthere" });
    expect(readNoteBody("   ")).toEqual({ ok: false, error: "empty" });
    expect(readNoteBody(42)).toEqual({ ok: false, error: "empty" });
    expect(readNoteBody("x".repeat(CONVERSATION_NOTE_MAX + 1))).toEqual({ ok: false, error: "too_long" });
  });

  it("a file fits its kind by extension, and a written note is never a file", () => {
    expect(fileFitsKind("transcript", "call.TXT")).toBe(true);
    expect(fileFitsKind("recording", "call.m4a")).toBe(true);
    expect(fileFitsKind("recording", "call.txt")).toBe(false);
    expect(fileFitsKind("file", "photo.png")).toBe(true);
    expect(fileFitsKind("text", "a.txt")).toBe(false);
    expect(fileFitsKind("transcript", "noextension")).toBe(false);
    expect(storedExtension("transcript", "Call.PDF")).toBe(".pdf");
    expect(storedExtension("recording", "x.exe")).toBeNull();
  });
});
