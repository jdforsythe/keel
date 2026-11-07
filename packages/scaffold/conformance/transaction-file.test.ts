// Spec: k.scaffold, Generators "`store` / `transaction`: `*.schema.ts`, store or transaction file, invariant test."
// Spec: k.scaffold, Rules "E1351 target id already exists (fix: use a codemod)"
// RFC 0036: `transaction { id: "<module>.<store>.<name>" }` needs the store <module>.<store> and writes
// modules/<module>/<Name>Payload.schema.ts, modules/<module>/<name>.transaction.ts, modules/<module>/<name>.transaction.test.ts.
// seed 1337
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  RUNS,
  SEED,
  apply,
  errText,
  fresh,
  lowerName,
  pascalName,
  planOf,
  read,
  scaffoldRaw,
  snap,
  withStoreCart,
} from "./fixtures.ts";

const cap = (n: string) => `${n.charAt(0).toUpperCase()}${n.slice(1)}`;
const distinct = fc.tuple(lowerName, lowerName).filter(([a, b]) => a !== b);

describe("scaffold transaction", () => {
  it("writes <Name>Payload.schema.ts, <name>.transaction.ts and its test, and nothing else", () => {
    fc.assert(
      fc.property(distinct, ([store, name]) => {
        const base = apply("store", { id: `orders.${store}` }, fresh()).files;
        const id = `orders.${store}.${name}`;
        const out = apply("transaction", { id }, base);
        const want = [
          `modules/orders/${cap(name)}Payload.schema.ts`,
          `modules/orders/${name}.transaction.ts`,
          `modules/orders/${name}.transaction.test.ts`,
        ];
        expect(out.created).toEqual([...want].sort());
        expect(out.changed.filter((p) => !p.startsWith("."))).toEqual([]);
        expect(out.removed).toEqual([]);
        expect(read(out.files, want[0] ?? "")).toContain(`export const ${cap(name)}Payload`);
        const tx = read(out.files, want[1] ?? "");
        expect(tx).toContain(`export const ${name}`);
        expect(tx).toContain("transaction(");
        expect(tx).toContain(`"${id}"`);
        expect(tx).toContain(`${cap(name)}Payload`);
        const test = read(out.files, want[2] ?? "");
        expect(test).toContain("properties");
        expect(test).toContain("@keel/testing");
        expect(test).toMatch(/\b100\b/);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("the transaction file imports the store and the payload schema from files that exist", () => {
    const out = apply("transaction", { id: "orders.cart.addItem" }, withStoreCart()).files;
    const tx = read(out, "modules/orders/addItem.transaction.ts");
    expect(tx).toContain("AddItemPayload");
    for (const m of tx.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)) {
      const spec = m[1] ?? "";
      expect(
        [spec, `${spec}.ts`].some((c) => out.has(`modules/orders/${c}`)),
        spec,
      ).toBe(true);
    }
  });
  it("transaction --dry-run (plan) yields exactly the edit set the following apply writes", () => {
    fc.assert(
      fc.property(lowerName, (name) => {
        const files = withStoreCart();
        const before = snap(files);
        const p = planOf("transaction", { id: `orders.cart.${name}` }, files);
        expect(snap(files)).toBe(before);
        expect(p.ok).toBe(true);
        const a = apply("transaction", { id: `orders.cart.${name}` }, files);
        if (p.ok) {
          expect(p.value.created).toEqual(a.created);
          expect(p.value.changed).toEqual(a.changed);
          expect(p.value.removed).toEqual(a.removed);
          expect(snap(p.value.files)).toBe(snap(a.files));
        }
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

describe("transaction rules", () => {
  it("E1351: running transaction twice reports E1351 the second time and writes nothing", () => {
    fc.assert(
      fc.property(lowerName, (name) => {
        const once = apply("transaction", { id: `orders.cart.${name}` }, withStoreCart()).files;
        const before = snap(once);
        const second = scaffoldRaw("transaction", { id: `orders.cart.${name}` }, once);
        expect(second.ok).toBe(false);
        expect(errText(second)).toContain("E1351");
        expect(snap(once)).toBe(before);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("E1352: an id that is not three dotted lowerCamel segments prefixed by the module id writes nothing", () => {
    fc.assert(
      fc.property(lowerName, pascalName, (n, P) => {
        const f = withStoreCart();
        const before = snap(f);
        for (const id of [
          "orders.cart",
          `orders.cart.${P}`,
          `orders.cart.${n}_x`,
          `orders..${n}`,
          `orders.cart.${n}.${n}`,
          `orders.${P}.${n}`,
          `${P}.cart.${n}`,
        ]) {
          const r = scaffoldRaw("transaction", { id }, f);
          expect(errText(r), id).toContain("E1352");
          expect(snap(f), id).toBe(before);
        }
        expect(scaffoldRaw("transaction", { id: `orders.cart.${n}` }, f).ok).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("E1052: a transaction on an unknown store or unknown module is refused and writes nothing", () => {
    fc.assert(
      fc.property(lowerName, lowerName, (store, name) => {
        const f = withStoreCart();
        const before = snap(f);
        for (const id of [`orders.${store}x.${name}`, `${store}x.cart.${name}`]) {
          expect(errText(scaffoldRaw("transaction", { id }, f)), id).toContain("E1052");
          expect(snap(f), id).toBe(before);
        }
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
