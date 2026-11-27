// Spec: k.identity, clause "After `@keel/schema`, `@keel/store` and `@keel/router` are loaded, `Reflect.get(globalThis, Symbol.for('keel.kernel'))` is `undefined`, no own symbol key of `globalThis` holds a `Map`, `WeakMap` or `WeakSet`, and no export of any entry of those packages, `./internal` ones included, is a `WeakSet`, a `WeakMap` or a `Map` holding one; with `a` an action and `forged = { ...a, input: B }`, no call of an exported function makes `manifest` accept `forged`."
// @vitest-environment happy-dom
// Seed 1337 (no generated input).
// Reading of "own symbol key": a registered key starting `keel.` (k.realm The `keel.` names), since the test runner keeps registered keys of its own (`matchers-object`) on `globalThis`.
// Reading of "no own symbol key of `globalThis` holds a `Map`, `WeakMap` or `WeakSet`": the realm's census is a `Map` of names to URLs under `Symbol.for('keel.census')` (k.realm), so a `Map` is allowed there when it holds strings only; a `WeakMap`, a `WeakSet`, or a `Map` holding one, is not allowed under any key.
// The packages are loaded by importing every entry their `package.json` `exports` lists, `./internal` ones included.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";

const PACKAGES = ["@keel/schema", "@keel/store", "@keel/router"] as const;
const isWeak = (v: unknown): boolean => v instanceof WeakSet || v instanceof WeakMap;
const holdsWeak = (v: unknown): boolean => isWeak(v) || (v instanceof Map && [...v.values(), ...v.keys()].some(isWeak));

async function entriesOf(pkg: string): Promise<Map<string, Record<string, unknown>>> {
  const manifestFile: unknown = JSON.parse(
    readFileSync(join(process.cwd(), "..", pkg.slice("@keel/".length), "package.json"), "utf8"),
  );
  const exportsField: unknown =
    typeof manifestFile === "object" && manifestFile !== null ? Reflect.get(manifestFile, "exports") : undefined;
  const subpaths = typeof exportsField === "object" && exportsField !== null ? Object.keys(exportsField) : [];
  const out = new Map<string, Record<string, unknown>>();
  for (const sub of subpaths.filter((k) => k.startsWith("./") && !k.includes("*") && k !== "./package.json")) {
    const id = `${pkg}${sub.slice(1)}`;
    const mod: unknown = await import(/* @vite-ignore */ id).catch(() => undefined);
    if (typeof mod === "object" && mod !== null) out.set(id, Object.fromEntries(Object.entries(mod)));
  }
  const root: unknown = await import(/* @vite-ignore */ pkg);
  if (typeof root === "object" && root !== null) out.set(pkg, Object.fromEntries(Object.entries(root)));
  return out;
}

describe("k.identity: nothing reaches the kernel's records", () => {
  it(
    "after the three packages load, `Reflect.get(globalThis, Symbol.for('keel.kernel'))` is `undefined`",
    async () => {
      for (const p of PACKAGES) await entriesOf(p);
      expect(Reflect.get(globalThis, Symbol.for("keel.kernel"))).toBeUndefined();
    },
    testTime(120_000),
  );

  it(
    "no own symbol key of `globalThis` holds a `WeakMap`, a `WeakSet`, or a `Map` holding one",
    async () => {
      for (const p of PACKAGES) await entriesOf(p);
      for (const key of Object.getOwnPropertySymbols(globalThis).filter(
        (k) => Symbol.keyFor(k)?.startsWith("keel.") === true,
      ))
        expect(holdsWeak(Reflect.get(globalThis, key)), String(key)).toBe(false);
    },
    testTime(120_000),
  );

  it(
    "no export of any entry of those packages, `./internal` ones included, is a `WeakSet`, a `WeakMap` or a `Map` holding one",
    async () => {
      const seen: string[] = [];
      for (const p of PACKAGES) {
        for (const [id, mod] of await entriesOf(p)) {
          seen.push(id);
          for (const [name, value] of Object.entries(mod)) expect(holdsWeak(value), `${id} ${name}`).toBe(false);
        }
      }
      expect(seen.length).toBeGreaterThan(PACKAGES.length);
    },
    testTime(120_000),
  );

  it(
    "with `a` an action and `forged = { ...a, input: B }`, no call of an exported function makes `manifest` accept `forged`",
    async () => {
      const A = s.object({ a: s.int() });
      const B = s.object({ b: s.int() });
      const c = contract("p", { "p.b": { path: "/b" } });
      const a = action(c, "p.b", { input: A }, async () => ok(null));
      const forged = { ...a, input: B };
      const bind = (): unknown => {
        try {
          return Reflect.apply(manifest, undefined, [
            c,
            { "p.b": { component: () => document.createElement("main"), POST: forged } },
          ]);
        } catch (e) {
          return e;
        }
      };
      for (const p of PACKAGES) {
        for (const [, mod] of await entriesOf(p)) {
          for (const value of Object.values(mod)) {
            if (typeof value !== "function") continue;
            for (const args of [[forged], [a, forged], [c, forged]]) {
              try {
                const r: unknown = Reflect.apply(value, undefined, args);
                if (r instanceof Promise) r.catch(() => undefined);
              } catch {
                // a refusal is the expected answer
              }
            }
          }
        }
      }
      const r = bind();
      expect(r instanceof Error && r.message.startsWith("E1515")).toBe(true);
    },
    testTime(120_000),
  );
});
