// Properties of the deploy generator (k.topology Deploy files) and `place` (k.scaffold Codemods). Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type DeployTopology, deployDrift, deployFiles, scaffold } from "../src/index.ts";
import { RUNS, SEED, apply, lower, snap } from "./helpers.ts";

const adapter = fc.constantFrom("node" as const, "client" as const, "static" as const);
const topologyArb: fc.Arbitrary<DeployTopology> = fc
  .uniqueArray(fc.tuple(lower, adapter, fc.uniqueArray(lower, { maxLength: 3 })), {
    minLength: 1,
    maxLength: 4,
    selector: ([n]) => n,
  })
  .map((ds) => Object.fromEntries(ds.map(([n, a, ms]) => [n, { modules: ms, adapter: a }])));
const reversed = (t: DeployTopology): DeployTopology =>
  Object.fromEntries(
    Object.entries(t)
      .reverse()
      .map(([n, d]) => [n, { modules: [...d.modules].reverse(), adapter: d.adapter }]),
  );
const nodes = (t: DeployTopology): string[] =>
  Object.keys(t)
    .filter((n) => t[n]?.adapter === "node")
    .sort();

describe("deployFiles", () => {
  it("is independent of the order of deployables and modules", () => {
    fc.assert(
      fc.property(topologyArb, fc.boolean(), (t, ci) => {
        expect(snap(deployFiles(reversed(t), { ci }))).toBe(snap(deployFiles(t, { ci })));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("writes one pinned Dockerfile per node deployable, compose iff one exists, and every peer key", () => {
    fc.assert(
      fc.property(topologyArb, fc.boolean(), (t, ci) => {
        const out = deployFiles(t, { ci });
        const docker = [...out.keys()].filter((p) => p.endsWith("/Dockerfile"));
        expect(docker).toEqual(nodes(t).map((n) => `deploy/${n}/Dockerfile`));
        for (const p of docker) expect(out.get(p)).toMatch(/^FROM node:22-slim@sha256:[0-9a-f]{64}$/m);
        expect(out.has("deploy/compose.yaml")).toBe(nodes(t).length > 0);
        expect(out.has(".github/workflows/ci.yml")).toBe(ci);
        const compose = out.get("deploy/compose.yaml") ?? "";
        for (const n of nodes(t)) {
          const peers = compose.split(`KEEL_PEER_${n.toUpperCase()}:`).length - 1;
          expect(peers).toBe(nodes(t).length - 1);
        }
        expect(compose).not.toMatch(/KEEL_SECRET: [^$]/);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("names every deployable as a CI job and no module of another deployable in its paths", () => {
    fc.assert(
      fc.property(topologyArb, (t) => {
        const ci = deployFiles(t, { ci: true }).get(".github/workflows/ci.yml") ?? "";
        for (const [n, d] of Object.entries(t)) {
          expect(ci).toContain(`\n  ${n}:\n`);
          const line = ci.split("\n").find((l) => l.includes(`echo "${n}=true"`)) ?? "";
          for (const m of d.modules) expect(line).toContain(`modules/${m}/`);
        }
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

describe("deployDrift", () => {
  it("is empty for a tree holding the generator's output and names exactly a changed file", () => {
    fc.assert(
      fc.property(fc.constantFrom("client" as const, "node" as const), lower, fc.nat(), (a, m, at) => {
        let files = apply("project", { name: "shop", adapter: a }, new Map());
        files = apply("module", { id: m }, files);
        expect(deployDrift(files)).toEqual([]);
        const paths = [...files.keys()].filter((p) => p.startsWith("deploy/") || p.startsWith(".github/"));
        const target = paths[at % paths.length] ?? "";
        const text = files.get(target) ?? "";
        const i = at % text.length;
        const tampered = new Map(files).set(target, `${text.slice(0, i)}\u0000${text.slice(i + 1)}`);
        const drift = deployDrift(tampered);
        expect(drift.map((d) => d.path)).toEqual([target]);
        expect(drift[0]?.want).toBe(text);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

describe("place", () => {
  it("any sequence of placements, undone in reverse, restores the tree", () => {
    const start = (): Map<string, string> => {
      let f = apply("project", { name: "shop", adapter: "node" }, new Map());
      for (const id of ["orders", "catalog", "billing"]) f = apply("module", { id }, f);
      return f;
    };
    const moves = fc.array(fc.tuple(fc.constantFrom("app", "orders", "catalog", "billing"), lower, adapter), {
      maxLength: 5,
    });
    fc.assert(
      fc.property(moves, (ms) => {
        const begin = start();
        let files = begin;
        const undo: { module: string; to: string; adapter: string }[] = [];
        for (const [module, to, a] of ms) {
          const src = files.get("topology.ts") ?? "";
          const line = src.split("\n").find((l) => new RegExp(`["']${module}["']`).test(l)) ?? "";
          const from = /^\s*(\w+):/.exec(line)?.[1] ?? "";
          const fromAdapter = /adapter: "(\w+)"/.exec(line)?.[1] ?? "";
          const target = new RegExp(`^\\s*${to}:.*adapter: "(\\w+)"`, "m").exec(src)?.[1];
          const r = scaffold("place", { module, to, adapter: target ?? a }, files);
          if (!r.ok) throw new Error(JSON.stringify(r.error));
          for (const p of [...r.value.created, ...r.value.changed, ...r.value.removed])
            expect(p === "topology.ts" || p.startsWith("deploy/") || p.startsWith(".github/workflows/"), p).toBe(true);
          files = r.value.files;
          undo.unshift({ module, to: from, adapter: fromAdapter });
        }
        for (const u of undo) files = apply("place", u, files);
        expect(snap(files)).toBe(snap(begin));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("refuses a new deployable without an adapter, an unknown module and a non-lowerCamel name, writing nothing", () => {
    const f = apply("project", { name: "shop" }, new Map());
    const code = (input: Record<string, unknown>): string => {
      const r = scaffold("place", input, f);
      return r.ok ? "ok" : r.error.data.code;
    };
    expect(code({ module: "app", to: "jobs" })).toBe("E1052");
    expect(code({ module: "nope", to: "jobs", adapter: "node" })).toBe("E1052");
    expect(code({ module: "app", to: "web", adapter: "node" })).toBe("E1052");
    expect(code({ module: "app", to: "Jobs", adapter: "node" })).toBe("E1352");
    expect(code({ module: "app", to: "web" })).toBe("ok");
  });
});
