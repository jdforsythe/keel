import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { check } from "@keel/check";
import keel from "@keel/compiler/vite";
// Spec: k.compiler, clause "Changing any byte of a file under `.keel/` makes `keel check --frozen` report E1005 on that file."
// k.derived In process: `check()` is frozen by nature, and a compiled view among its files that differs from its compile is E1005; `routes.json` and `surface.json` are evaluated views, compared only with a `derived` a caller passes, so the files tampered here are the compiled views.
// The test drives the k.check pipeline (check()) over the files `keel check` reads; the cli is later in deps order than testing.
// Seed: 1337.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

type File = { path: string; source: string };

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

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

async function build(): Promise<File[]> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-tamper-"));
  dirs.push(root);
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "Cart.tsx"), CART);
  fs.writeFileSync(path.join(root, "src", "Badge.tsx"), BADGE);
  const plugin = keel();
  plugin.configResolved({ root, command: "build" });
  await plugin.buildStart.call({ warn: () => {} });
  return fs
    .readdirSync(path.join(root, ".keel"))
    .sort()
    .filter((n) => !n.endsWith(".tmp"))
    .filter((n) => !["routes.json", "surface.json"].includes(n))
    .map((name) => ({ path: `.keel/${name}`, source: fs.readFileSync(path.join(root, ".keel", name), "utf8") }));
}

// `keel check` reads the sources with the artifacts: E1005 compares each artifact with what they compile to (rfc:0050).
const SOURCES: File[] = [
  { path: "src/Badge.tsx", source: BADGE },
  { path: "src/Cart.tsx", source: CART },
];

const e1005 = (files: File[]): string[] =>
  check([...files, ...SOURCES], { types: false })
    .diagnostics.filter((d) => d.code === "E1005")
    .map((d) => d.path);

describe("k.compiler: .keel/ tamper detection", () => {
  it(
    "builds real artifacts under .keel/ and a clean check reports no E1005",
    async () => {
      const files = await build();
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) expect(f.path.endsWith(".json")).toBe(true);
      expect(files.map((f) => f.path)).toEqual(
        expect.arrayContaining([".keel/a11y.json", ".keel/deps.json", ".keel/ids.json"]),
      );
      expect(e1005(files)).toEqual([]);
    },
    fixedTime(30_000),
  );

  it(
    "Changing any byte of a file under .keel/ makes keel check report E1005 on that file",
    async () => {
      const files = await build();
      const alphabet = [...Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)), "\n"];
      // seed 1337
      fc.assert(
        fc.property(
          fc.nat(files.length - 1),
          fc.nat(),
          fc.integer({ min: 1, max: alphabet.length - 1 }),
          (fi, bi, shift) => {
            const target = files[fi];
            if (target === undefined) throw new Error("no file");
            const at = bi % target.source.length;
            const original = target.source.charAt(at);
            const start = Math.max(0, alphabet.indexOf(original));
            const replacement = alphabet[(start + shift) % alphabet.length] ?? "x";
            expect(replacement).not.toBe(original);
            const tampered = files.map((f) =>
              f === target ? { path: f.path, source: f.source.slice(0, at) + replacement + f.source.slice(at + 1) } : f,
            );
            expect(e1005(tampered)).toEqual([target.path]);
          },
        ),
        { seed: 1337, numRuns: 100 },
      );
    },
    fixedTime(30_000),
  );
});
