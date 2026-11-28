import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import { compile } from "@keel/compiler";
import type { RouteEntry, SourceFile } from "@keel/compiler";
import keel from "@keel/compiler/vite";
// Spec: k.compiler, clause "Under `keel check --frozen`, a `.keel/` artifact with changed `data` and recomputed `hash`, or older than its sources, is E1005."
// Drives the real binary (packages/cli/src/bin.ts) over a temp project holding real `.keel/` artifacts built by @keel/compiler/vite.
// Forged artifacts are self-consistent: data and hash come from a public `compile` of other sources.
// Seed: 1337 (fc.assert seed below). Each spawn costs about a second; total spawns stay <= 8.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = path.join(repo, "packages/cli/src/bin.ts");

const CART = `export default function Cart() {
  return (
    <section aria-label="Cart">
      <h1 id="cart.title">Cart</h1>
      <p id="cart.note">Items</p>
      <button id="cart.add" onClick={() => {}}>Add</button>
    </section>
  )
}
`;
const BADGE = `export default function Badge() {
  return <span id="badge.count">3</span>
}
`;
const TSCONFIG = `${JSON.stringify(
  {
    extends: "@keel/compiler/tsconfig.strict.json",
    compilerOptions: { jsxImportSource: "@keel/runtime-dom" },
    include: ["src"],
  },
  null,
  2,
)}\n`;

interface Rec {
  kind: string;
  code?: unknown;
  path?: unknown;
}
function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";
}

function runCheck(cwd: string, args: string[]): { status: number | null; records: Rec[] } {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, "check", "--frozen", ...args, "--format=json"], {
    cwd,
    encoding: "utf8",
    env,
  });
  const records: Rec[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (isRec(v)) records.push(v);
    } catch {
      // non-JSON line: ignored
    }
  }
  return { status: r.status, records };
}

// Only E1005 is asserted: other codes (if the strict type check of the tiny project reports any) are not the clause under test.
const e1005 = (records: Rec[]): unknown[] =>
  records.filter((r) => r.kind === "diag" && r.code === "E1005").map((r) => r.path);

let proj = "";
const originals = new Map<string, string>();

beforeAll(async () => {
  proj = fs.mkdtempSync(path.join(os.tmpdir(), "keel-artifact-"));
  fs.mkdirSync(path.join(proj, "src"), { recursive: true });
  fs.writeFileSync(path.join(proj, "src", "Cart.tsx"), CART);
  fs.writeFileSync(path.join(proj, "src", "Badge.tsx"), BADGE);
  fs.writeFileSync(path.join(proj, "tsconfig.json"), TSCONFIG);
  fs.mkdirSync(path.join(proj, "node_modules/@keel"), { recursive: true });
  for (const pkg of fs.readdirSync(path.join(repo, "packages"))) {
    fs.symlinkSync(path.join(repo, "packages", pkg), path.join(proj, "node_modules/@keel", pkg));
  }
  for (const name of ["vitest", "vite", "typescript"]) {
    fs.symlinkSync(path.join(repo, "node_modules", name), path.join(proj, "node_modules", name));
  }
  const plugin = keel();
  plugin.configResolved({ root: proj, command: "build" });
  await plugin.buildStart.call({ warn: () => {} });
  for (const name of fs.readdirSync(path.join(proj, ".keel")).sort()) {
    if (name.endsWith(".json")) originals.set(name, fs.readFileSync(path.join(proj, ".keel", name), "utf8"));
  }
}, fixedTime(120_000));

afterAll(() => {
  fs.rmSync(proj, { recursive: true, force: true });
});

// Artifacts are written read-only; make the file writable before changing bytes.
const write = (name: string, text: string): void => {
  const file = path.join(proj, ".keel", name);
  fs.chmodSync(file, 0o644);
  fs.writeFileSync(file, text);
};
const restore = (): void => {
  for (const [n, t] of originals) write(n, t);
};
const original = (name: string): string => {
  const t = originals.get(name);
  if (t === undefined) throw new Error(`no artifact ${name}`);
  return t;
};
const flip = (text: string, at: number, shift: number): string => {
  const alphabet = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i));
  const old = text.charAt(at);
  const start = Math.max(0, alphabet.indexOf(old));
  const rep = alphabet[(start + shift) % alphabet.length] ?? "x";
  return text.slice(0, at) + rep + text.slice(at + 1);
};

const canonical = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (typeof v === "object" && v !== null) {
    return `{${Object.entries(v)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
};
const artifactText = (data: unknown, hash: string): string => `${canonical({ data, hash })}\n`;

const ENTRY: RouteEntry = { path: "/x", params: {}, search: {}, actions: [], layout: null, guard: null, module: "m" };
const sources: SourceFile[] = [
  { path: "src/Cart.tsx", source: CART },
  { path: "src/Badge.tsx", source: BADGE },
];
const OTHER_CART = CART.replace("</section>", '  <h2 id="cart.extra" aria-label="Extra">Extra</h2>\n    </section>');
const other = compile([{ path: "src/Cart.tsx", source: OTHER_CART }, sources[1] ?? { path: "", source: "" }]);

const forged = (name: "a11y.json" | "deps.json" | "ids.json"): string => {
  const data = other.artifacts[name];
  expect(JSON.stringify(data)).not.toBe(JSON.stringify(compile(sources).artifacts[name]));
  return artifactText(data, other.hashes[name]);
};

const readSrc = (n: string): string => fs.readFileSync(path.join(proj, "src", n), "utf8");
const writeSrc = (n: string, t: string): void => fs.writeFileSync(path.join(proj, "src", n), t);

describe("k.compiler: forged and stale .keel/ artifacts (real binary)", () => {
  it(
    "a clean build makes keel check report no E1005",
    () => {
      expect(originals.size).toBeGreaterThan(0);
      expect(e1005(runCheck(proj, []).records)).toEqual([]);
    },
    fixedTime(120_000),
  );

  it(
    "An artifact with changed data and a recomputed hash (ids.json) is E1005 on exactly that file (exit 1)",
    () => {
      try {
        write("ids.json", forged("ids.json"));
        const r = runCheck(proj, []);
        expect(e1005(r.records)).toEqual([".keel/ids.json"]);
        expect(r.status).toBe(1);
      } finally {
        restore();
      }
    },
    fixedTime(120_000),
  );

  it(
    "A forged a11y.json, deps.json or ids.json with recomputed hash is E1005 on exactly that file",
    () => {
      // seed 1337
      fc.assert(
        fc.property(
          fc.constantFrom<"a11y.json" | "deps.json" | "ids.json">("a11y.json", "deps.json", "ids.json"),
          (name) => {
            try {
              write(name, forged(name));
              expect(e1005(runCheck(proj, []).records)).toEqual([`.keel/${name}`]);
            } finally {
              restore();
            }
          },
        ),
        { seed: 1337, numRuns: 2 },
      );
    },
    fixedTime(120_000),
  );

  it(
    "A routes.json with data for routes that do not exist (no routes.ts) and a recomputed hash is E1005",
    () => {
      const withRoutes = compile(sources, { routes: { r: ENTRY } });
      try {
        write("routes.json", artifactText(withRoutes.artifacts["routes.json"], withRoutes.hashes["routes.json"]));
        expect(e1005(runCheck(proj, []).records)).toEqual([".keel/routes.json"]);
      } finally {
        restore();
      }
    },
    fixedTime(120_000),
  );

  it(
    "An artifact older than its sources is E1005: editing src/Badge.tsx without rebuilding flags ids.json",
    () => {
      const badge = readSrc("Badge.tsx");
      try {
        writeSrc(
          "Badge.tsx",
          `export default function Badge() {\n  return <div><span id="badge.count">3</span><span id="badge.extra">4</span></div>\n}\n`,
        );
        expect(e1005(runCheck(proj, []).records)).toContain(".keel/ids.json");
      } finally {
        writeSrc("Badge.tsx", badge);
      }
    },
    fixedTime(120_000),
  );

  it(
    "keel check .keel (paths restricted to the artifacts) still reports a forged ids.json as E1005",
    () => {
      try {
        write("ids.json", forged("ids.json"));
        expect(e1005(runCheck(proj, [".keel"]).records)).toEqual([".keel/ids.json"]);
      } finally {
        restore();
      }
    },
    fixedTime(120_000),
  );
});

describe("k.compiler: forged artifacts through the library check()", () => {
  it("a routes.json with data {r: entry} and a recomputed hash is no diagnostic of the in-memory check() without `derived`, as the genuine empty routes.json (k.derived In process)", () => {
    const withRoutes = compile([], { routes: { r: ENTRY } });
    const forgedRoutes = artifactText(withRoutes.artifacts["routes.json"], withRoutes.hashes["routes.json"]);
    expect(check([{ path: ".keel/routes.json", source: forgedRoutes }]).diagnostics.map((d) => d.code)).toEqual([]);
    const empty = compile([]);
    const genuine = artifactText(empty.artifacts["routes.json"], empty.hashes["routes.json"]);
    expect(check([{ path: ".keel/routes.json", source: genuine }]).diagnostics.map((d) => d.code)).toEqual([]);
  });
});
