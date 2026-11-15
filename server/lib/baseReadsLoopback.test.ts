/**
 * The Base RPC loopback exemption is for tests and local work only (R111).
 *
 * base-reads.ts skipped the SSRF guard for http://127.0.0.1 and localhost in
 * EVERY environment, so on a production server an admin-typed RPC address of
 * http://127.0.0.1:3306 reached the deployment's own database port.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// The RPC address is a sealed secret; here it is read from the env fallback,
// which is the shape the secret store gives with nothing typed in Admin.
vi.mock("./secrets", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  secretValue: (_key: string, env: NodeJS.ProcessEnv = process.env) => env.BASE_RPC_URL ?? "",
}));

import { baseChainClient, loopbackRpcAllowed } from "./base-reads";

describe("loopbackRpcAllowed", () => {
  it.each([
    [{ NODE_ENV: "test" }, true],
    [{ NODE_ENV: "development" }, true],
    [{ NODE_ENV: "production" }, false],
    [{ NODE_ENV: "Production " }, false],
    [{}, false], // no NODE_ENV: refused, so a deploy that forgot it is not open
    [{ NODE_ENV: "staging" }, false],
    [{ NODE_ENV: "production", VILLAGE_E2E_LOOPBACK_RPC: "1" }, true], // the acceptance suite's switch
    [{ NODE_ENV: "production", VILLAGE_E2E_LOOPBACK_RPC: "true" }, false],
    [{ NODE_ENV: "production", VILLAGE_E2E_LOOPBACK_RPC: "" }, false],
  ] as Array<[NodeJS.ProcessEnv, boolean]>)("%j -> %s", (env, want) => {
    expect(loopbackRpcAllowed(env)).toBe(want);
  });
});

describe("baseChainClient with a loopback RPC", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses it in production and builds no client", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VILLAGE_E2E_LOOPBACK_RPC", "");
    vi.stubEnv("BASE_RPC_URL", "http://127.0.0.1:3306");
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await baseChainClient()).toBeNull();
    expect(err.mock.calls.flat().join(" ")).toContain("loopback is allowed only in test and development");
    err.mockRestore();
  });

  it("refuses localhost in production too", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VILLAGE_E2E_LOOPBACK_RPC", "");
    vi.stubEnv("BASE_RPC_URL", "http://localhost:8545");
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await baseChainClient()).toBeNull();
    err.mockRestore();
  });

  it("still allows it under test, which is what a local node and the suites need", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BASE_RPC_URL", "http://127.0.0.1:8545");
    expect(await baseChainClient()).not.toBeNull();
  });
});
