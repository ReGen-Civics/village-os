export type GeneratedFile = {
  path: string;
  kind: "whole" | "regions";
  generator: string;
  seen: boolean;
};
export const GENERATED_FILES: GeneratedFile[];
export const BOT_COMMIT_SUBJECT: string;
export const BOT_COMMIT_PATHS: string[];
export function isBotCommitPath(p: string): boolean;
export function isBotCommit(c: { subject: string; parents: number; paths: string[] }): boolean;
export const REGION_RE: RegExp;
export function docsMode(env?: Record<string, string | undefined>): "strict" | "pr";
export function unifiedDiff(label: string, found: string, wanted: string): string;
export function writeSummary(markdown: string, env?: Record<string, string | undefined>): void;
export function driftIsFatal(
  args: { label: string; found: string; wanted: string; seen?: boolean; regenerate: string },
  env?: Record<string, string | undefined>,
): boolean;
