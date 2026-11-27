/**
 * "Join the Core Team" (the lead, 26 Nov 2026) has its Spanish, in usted, read from es.po with the fragments in
 * client/src/locales/es.d/ folded in, the way the build reads it.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatter } from "@lingui/format-po";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../scripts/lib/poFragments.mjs";

describe("the team path's verb in Spanish", () => {
  it("is Únase al equipo central", async () => {
    const dir = path.resolve(__dirname, "../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    expect(es[generateMessageId("Join the Core Team", "four ways to build: a role")]?.translation).toBe("Únase al equipo central");
  });
});
