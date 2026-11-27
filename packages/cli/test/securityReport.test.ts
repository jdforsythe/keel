// securityReport (k.evidence security.json, k.security): per node deployable the headers sent on https and the
// document policy with `<nonce>`; per client or static one the csp.txt text. Seed 1337.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Topology } from "@keel/compiler";
import { cspPolicy, securityHeaders } from "@keel/server/csp";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { securityReport } from "../src/internal/securityReport.ts";

const run = { seed: 1337, numRuns: 50 };
const here = fileURLToPath(new URL(".", import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const cwd = (): string => {
  const d = tempDir(".tmp-securityReport-", here);
  dirs.push(d);
  return d;
};

const topo: Topology = {
  web: { modules: ["a"], adapter: "node" },
  app: { modules: ["a"], adapter: "client" },
  docs: { modules: ["a"], adapter: "static" },
  "api-two": { modules: ["a"], adapter: "node" },
};
const TITLED = [
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
];

describe("securityReport", () => {
  test("securityReport without a topology lists no deployables", async () => {
    expect(await securityReport(cwd(), undefined, {})).toEqual({ v: 1, deployables: [] });
  });

  test("deployables are in name order, each by its adapter's shape", async () => {
    const r = await securityReport(cwd(), topo, {});
    expect(r.v).toBe(1);
    expect(r.deployables.map((d) => [d.name, d.adapter])).toEqual([
      ["api-two", "node"],
      ["app", "client"],
      ["docs", "static"],
      ["web", "node"],
    ]);
  });

  test("a node deployable holds the https headers under Title-Case names and the document policy with <nonce>", async () => {
    const r = await securityReport(cwd(), topo, {});
    const web = r.deployables.find((d) => d.name === "web");
    expect(web).toBeDefined();
    if (web === undefined || web.adapter !== "node") throw new Error("web is a node deployable");
    expect(Object.keys(web.headers).sort()).toEqual(TITLED);
    expect(web.headers["Strict-Transport-Security"]).toBe("max-age=63072000");
    expect(web.headers["X-Frame-Options"]).toBe("DENY");
    expect(web.policy).toBe(cspPolicy({ nonce: "<nonce>" }));
    expect(web.policy).toContain("script-src 'nonce-<nonce>' 'strict-dynamic'");
    expect(web.headers).toEqual(
      Object.fromEntries(
        Object.entries(securityHeaders({ https: true })).map(([k, v]) => [
          k
            .split("-")
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join("-"),
          v,
        ]),
      ),
    );
    expect("csp" in web).toBe(false);
  });

  test("a client or static deployable holds the csp.txt text, script-src 'self', and no headers", async () => {
    const r = await securityReport(cwd(), topo, {});
    for (const name of ["app", "docs"]) {
      const d = r.deployables.find((x) => x.name === name);
      if (d === undefined || d.adapter === "node") throw new Error(`${name} is client or static`);
      expect(d.csp).toBe(cspPolicy({ peers: [] }));
      expect(d.csp).toContain("script-src 'self'");
      expect(d.csp).not.toContain("nonce");
      expect("headers" in d).toBe(false);
    }
  });

  test("each KEEL_PEER_<NAME> origin of a node deployable is added to a client's connect-src, and only there", async () => {
    const env = { KEEL_PEER_WEB: "https://web.example", KEEL_PEER_API_TWO: "http://localhost:4000" };
    const r = await securityReport(cwd(), topo, env);
    const app = r.deployables.find((d) => d.name === "app");
    const web = r.deployables.find((d) => d.name === "web");
    if (app === undefined || app.adapter === "node" || web === undefined || web.adapter !== "node")
      throw new Error("shape");
    expect(app.csp).toContain("connect-src 'self' http://localhost:4000 https://web.example;");
    expect(web.policy).toContain("connect-src 'self';");
    expect(web.policy).not.toContain("web.example");
  });

  test("a topology with no deployables lists none", async () => {
    expect(await securityReport(cwd(), {}, {})).toEqual({ v: 1, deployables: [] });
  });

  test("property: any set of names lists one entry per deployable in sorted order", async () => {
    const names = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/), { maxLength: 6 });
    await fc.assert(
      fc.asyncProperty(
        names,
        fc.array(fc.constantFrom<"node" | "client" | "static">("node", "client", "static"), {
          minLength: 6,
          maxLength: 6,
        }),
        async (ns, kinds) => {
          const t: Topology = Object.fromEntries(
            ns.map((n, i) => [n, { modules: ["a"], adapter: kinds[i] ?? "node" }]),
          );
          const r = await securityReport(cwd(), t, {});
          expect(r.deployables.map((d) => d.name)).toEqual([...ns].sort());
          for (const d of r.deployables) expect(d.adapter).toBe(t[d.name]?.adapter);
        },
      ),
      { ...run, numRuns: 20 },
    );
  });
});
