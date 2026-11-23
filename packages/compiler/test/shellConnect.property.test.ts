// shellConnect (k.shell Origins): the keel-peer origins of the build, then the declared connect origins, once each,
// without the build's own origin. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { shellConnect } from "../src/hosting/shellConnect.ts";
import { entryCode } from "../src/internal/entryCode.ts";
import type { Topology } from "../src/types/Topology.ts";

const run = { seed: 1337, numRuns: 200 };
const host = fc.constantFrom("a", "b", "c", "d", "e", "f").map((h) => `https://${h}.example`);
const hosts = fc.uniqueArray(host, { maxLength: 4 });
const SELF = "https://app.example";

const topology = (declared: readonly string[], nodes: readonly string[]): Topology => ({
  web: {
    modules: ["c"],
    adapter: "client",
    ...(declared.length === 0 ? {} : { origins: { connect: Object.fromEntries(declared.map((o) => [o, "r"])) } }),
  },
  other: { modules: [], adapter: "client", origins: { connect: { "https://elsewhere.example": "r" } } },
  ...Object.fromEntries(nodes.map((n) => [n, { modules: [], adapter: "node" as const }])),
});

describe("shellConnect", () => {
  test("no origins and no peer is the empty list; a deployable the topology lacks too", () => {
    expect(shellConnect(topology([], []), "web", {}, SELF)).toEqual([]);
    expect(shellConnect(topology(["https://a.example"], []), "gone", {}, SELF)).toEqual([]);
    expect(shellConnect({}, "web", { KEEL_PEER_API: "https://peer.example" }, SELF)).toEqual([]);
  });

  test("peers in deployable-name order, then the declared origins in declaration order, each once", () => {
    fc.assert(
      fc.property(hosts, hosts, (declared, peers) => {
        const names = peers.map((_, i) => `n${peers.length - i}`);
        const env = Object.fromEntries(names.map((n, i) => [`KEEL_PEER_${n.toUpperCase()}`, `${peers[i]}/`]));
        const got = shellConnect(topology(declared, names), "web", env, SELF);
        const inNameOrder = [...names].sort().map((n) => peers[names.indexOf(n)]);
        expect(got).toEqual([...inNameOrder, ...declared.filter((o) => !peers.includes(o))]);
        expect(new Set(got).size).toBe(got.length);
      }),
      run,
    );
  });

  test("the build's own origin is left out, whether a peer or declared; another deployable's origins never join", () => {
    fc.assert(
      fc.property(hosts, host, (declared, self) => {
        const env = { KEEL_PEER_API: self, KEEL_PEER_WEB: "https://not-a-node.example" };
        const got = shellConnect(topology(declared, ["api"]), "web", env, self);
        expect(got).toEqual(declared.filter((o) => o !== self));
        expect(got).not.toContain("https://elsewhere.example");
      }),
      run,
    );
  });

  test("a peer value that is no origin, or a peer of a deployable that is not node, adds nothing", () => {
    const env = { KEEL_PEER_API: "https://peer.example/path", KEEL_PEER_OTHER: "https://x.example" };
    expect(shellConnect(topology(["https://a.example"], ["api"]), "web", env, SELF)).toEqual(["https://a.example"]);
  });

  test("the generated shell entry hands the list to the drivers as a JSON array, and [] when it has none", () => {
    fc.assert(
      fc.property(hosts, (connect) => {
        const code = entryCode(
          ["/modules/c/routes.ts"],
          "virtual:keel.css",
          {},
          {},
          {
            kind: "tauri",
            origin: SELF,
            connect,
          },
        );
        expect(code).toContain(
          `__keelDrivers({ origin: new URL(${JSON.stringify(SELF)}), connect: ${JSON.stringify(connect)} })`,
        );
      }),
      run,
    );
    const none = entryCode(["/modules/c/routes.ts"], "virtual:keel.css", {}, {}, { kind: "capacitor", origin: SELF });
    expect(none).toContain("connect: [] })");
  });
});
