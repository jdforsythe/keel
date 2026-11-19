// `keel build`'s k.hosting errors (k.hosting Rules): E1566 per bad host; E1565 per KEEL_PEER_<NAME> that is not an
// http(s) origin, only when a client deployable is built, naming the key and never the value.
import { describe, expect, it } from "vitest";
import { hostingDiags } from "../src/internal/hostingDiags.ts";
import { run } from "../src/run.ts";

const n = { modules: ["a"], adapter: "node" } as const;
const web = { modules: ["w"], adapter: "client" } as const;

describe("hostingDiags", () => {
  it("is empty for a good host and good peers", () => {
    expect(hostingDiags({ api: n, web: { ...web, host: "api" } }, { KEEL_PEER_API: "https://api.test" })).toEqual([]);
  });

  it("E1565 names the key of a bad peer, never the value", () => {
    const d = hostingDiags({ api: n, web }, { KEEL_PEER_API: "secret-value" });
    expect(d.map((x) => x.code)).toEqual(["E1565"]);
    expect(JSON.stringify(d)).toContain("KEEL_PEER_API");
    expect(JSON.stringify(d)).not.toContain("secret-value");
  });

  it("checks no peer without a client deployable", () => {
    expect(hostingDiags({ api: n }, { KEEL_PEER_API: "nope" })).toEqual([]);
  });

  it("E1566 for a host on a node deployable", () => {
    expect(hostingDiags({ api: { ...n, host: "api" } }, {}).map((x) => x.code)).toEqual(["E1566"]);
  });

  it("E1566 for a host that is not a string literal in the source", () => {
    const source =
      'const H = "api";\nexport default topology({ api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client", host: H } })';
    const d = hostingDiags({ api: n, web }, {}, source);
    expect(d.map((x) => [x.code, x.message])).toEqual([["E1566", "web: host must be a string literal"]]);
  });

  it("fails keel build on a host that is not a string literal", async () => {
    const r = await run(["build", "--format=json"], {
      cwd: "/p",
      env: {},
      files: [
        {
          path: "topology.ts",
          source:
            'export default topology({ api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client", host: `api` } })',
        },
      ],
    });
    expect(r.code).not.toBe(0);
    expect(r.stdout).toContain("E1566");
  });

  it("fails keel build with E1552 on an adapter, modules or name the static read cannot take", async () => {
    for (const [deployable, message] of [
      [
        'api: { modules: ["a"], adapter: ADAPTER }',
        "api: needs modules: [...] and adapter: 'node' | 'static' | 'client'",
      ],
      [
        'api: { modules: MODULES, adapter: "node" }',
        "api: needs modules: [...] and adapter: 'node' | 'static' | 'client'",
      ],
      [
        'Api: { modules: ["a"], adapter: "node" }',
        "Api: name must be lowercase letters, digits and -, starting with a letter",
      ],
    ]) {
      const source = `export default topology({ ${deployable} })`;
      const r = await run(["build", "--format=json"], { cwd: "/p", env: {}, files: [{ path: "topology.ts", source }] });
      expect(r.code, deployable).not.toBe(0);
      const diags = r.stdout
        .split("\n")
        .filter((l) => l.includes('"E1552"'))
        .map((l) => JSON.parse(l));
      expect(diags.map((d) => [d.path, d.see, d.message])).toEqual([["topology.ts", "k.topology", message]]);
    }
  });

  it("fails keel build with no writes", async () => {
    const r = await run(["build", "--format=json"], {
      cwd: "/p",
      env: { KEEL_PEER_API: "nope" },
      files: [
        {
          path: "topology.ts",
          source:
            'declare const topology: (t: object) => object\nexport default topology({ api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client" } })',
        },
      ],
    });
    expect(r.code).not.toBe(0);
    expect(r.stdout).toContain("E1565");
    expect(r.stdout).not.toContain("nope");
  });
});
