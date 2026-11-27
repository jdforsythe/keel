// @vitest-environment happy-dom
// Spec: k.contract, clause "In a fixture whose `client` deployable `web` serves module `a` with a `local: true` page `a.tools`, `keel check` and `keel build` each report one E1511 `a.tools: local route in client deployable web, which has no server` at `topology.ts`, `keel build` exits 1 and writes no `dist/web/`, and `createApp` for `web` throws E1511; with `web` a `static` deployable, one E1511 `a.tools: local route in static deployable web, which has no server`; with `a` served by a `node` deployable, none."
// Spec: k.api Rules: "E1511 an API entry, or a `local: true` entry (k.contract Local routes), in a module a `client` or `static` deployable serves (k.topology); reported from `topology.ts` at the module's id by `keel check` and `keel build` (which then fails and writes no `dist/<name>/`), thrown by `createApp`; message `<id>: API route in <adapter> deployable <name>, which has no server`, for a `local` page `<id>: local route in <adapter> deployable <name>, which has no server`; no fix: the remedy, serving the module from a `node` deployable, is `keel explain`'s."
// This file covers "`createApp` for `web` throws E1511"; the `keel check` half is check/conformance/local-routes-no-server.test.ts, the `keel build` half cli/conformance/local-routes-no-server-build.test.ts.
// Seed 1337 (the adapter is a property over the two with no server). ASSUMED: createApp rejects with an error whose message holds the code and the specified message (api-routes-0086.test.ts assumes the code).
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import * as server from "@keel/server";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./contract-support.ts";

const c = contract("a", { "a.tools": { path: "/tools", local: true } });
const routes = manifest(c, { "a.tools": { component: () => document.createElement("main") } });
type Adapter = "client" | "static" | "node";
const boot = async (adapter: Adapter): Promise<string> => {
  const make: unknown = Reflect.get(server, "createApp");
  if (typeof make !== "function") throw new Error("@keel/server does not export createApp");
  try {
    await Reflect.apply(make, undefined, [
      {
        topology: topology({ web: { modules: ["a"], adapter } }),
        routes,
        ctx: createCtx({ mode: "sim", seed: SEED }),
        mode: "production",
      },
    ]);
    return "built";
  } catch (e) {
    return e instanceof Error ? e.message : JSON.stringify(e);
  }
};

describe("k.contract Local routes: a `local` route with no server", () => {
  it("`createApp` for a `client` deployable `web` serving module `a` with a `local: true` page `a.tools` throws E1511 `a.tools: local route in client deployable web, which has no server`", async () => {
    const m = await boot("client");
    expect(m).toContain("E1511");
    expect(m).toContain("a.tools: local route in client deployable web, which has no server");
  });

  it("`createApp` for a `static` deployable `web` throws E1511 `a.tools: local route in static deployable web, which has no server`", async () => {
    const m = await boot("static");
    expect(m).toContain("E1511");
    expect(m).toContain("a.tools: local route in static deployable web, which has no server");
  });

  it("`createApp` for a deployable with no server throws E1511 whatever the adapter that has none", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom<Adapter>("client", "static"), async (adapter) => {
        const m = await boot(adapter);
        expect(m).toContain("E1511");
        expect(m).toContain(`a.tools: local route in ${adapter} deployable web, which has no server`);
      }),
      { seed: SEED, numRuns: 4 },
    );
  });

  it("`createApp` for a `node` deployable serving the module with the `local: true` page does not throw", async () => {
    expect(await boot("node")).toBe("built");
  });
});
