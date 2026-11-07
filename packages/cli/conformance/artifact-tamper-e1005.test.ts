// Spec: k.compiler, clause "Changing any byte of a file under `.keel/` makes `keel check` report E1005 on that file."
// Drives the real binary (packages/cli/src/bin.ts) over a temp project holding real `.keel/` artifacts built by @keel/compiler/vite.
// Seed: 1337 (fc.assert seed below). Each spawn costs about a second, so numRuns is small.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import keel from "@keel/compiler/vite";
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
  const r = spawnSync(process.execPath, [BIN, "check", ...args, "--format=json"], { cwd, encoding: "utf8", env });
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
}, 120_000);

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

describe("k.compiler: keel check on .keel/ artifacts (real binary)", () => {
  it("a clean build makes keel check report no E1005", () => {
    expect(originals.size).toBeGreaterThan(0);
    const r = runCheck(proj, []);
    expect(e1005(r.records)).toEqual([]);
  }, 120_000);

  it("Changing any byte of .keel/ids.json makes keel check report E1005 on that file (exit 1)", () => {
    const text = original("ids.json");
    const at = text.indexOf('"', 2) + 1;
    try {
      write("ids.json", flip(text, at, 1));
      const r = runCheck(proj, []);
      expect(e1005(r.records)).toEqual([".keel/ids.json"]);
      expect(r.status).toBe(1);
      expect(r.records.at(-1)?.kind).toBe("summary");
    } finally {
      restore();
    }
  }, 120_000);

  it("Changing any byte of a file under .keel/ makes keel check report E1005 on that file", () => {
    const names = [...originals.keys()];
    // seed 1337
    fc.assert(
      fc.property(fc.nat(names.length - 1), fc.nat(), fc.integer({ min: 1, max: 90 }), (fi, bi, shift) => {
        const name = names[fi];
        if (name === undefined) throw new Error("no file");
        const text = original(name);
        const tampered = flip(text, bi % text.length, shift);
        expect(tampered).not.toBe(text);
        try {
          write(name, tampered);
          expect(e1005(runCheck(proj, []).records)).toEqual([`.keel/${name}`]);
        } finally {
          restore();
        }
      }),
      { seed: 1337, numRuns: 6 },
    );
  }, 120_000);

  it("keel check restricted to paths: `src` does not read tampered .keel/, `.keel` does", () => {
    const text = original("routes.json");
    try {
      write("routes.json", flip(text, text.indexOf('"', 2) + 1, 1));
      expect(e1005(runCheck(proj, ["src"]).records)).toEqual([]);
      expect(e1005(runCheck(proj, [".keel"]).records)).toEqual([".keel/routes.json"]);
    } finally {
      restore();
    }
  }, 120_000);
});
