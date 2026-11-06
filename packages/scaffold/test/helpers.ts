// Shared arbitraries for @keel/scaffold property tests. Not a test file. Seed 1337 everywhere.
import fc from "fast-check";
import { type Op, scaffold } from "../src/index.ts";

export const SEED = 1337;
export const RUNS = 100;
export type Files = Map<string, string>;

export const lower = fc.stringMatching(/^[a-z]{3,7}$/).map((s) => `zq${s}`);
export const upper = fc.stringMatching(/^[a-z]{3,7}$/).map((s) => `Zq${s}`);

export function apply(op: Op, input: Record<string, unknown>, files: Files): Files {
  const r = scaffold(op, input, files);
  if (!r.ok) throw new Error(`${op} failed: ${JSON.stringify(r.error)}`);
  return r.value.files;
}

export function snap(files: ReadonlyMap<string, string>): string {
  return JSON.stringify([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** A generated project: modules, and per module some components, stores and routes, with distinct names. */
export type Tree = {
  files: Files;
  modules: string[];
  components: string[];
  stores: string[];
  routes: string[];
};

export const tree: fc.Arbitrary<Tree> = fc
  .record({
    modules: fc.uniqueArray(lower, { minLength: 1, maxLength: 3 }),
    components: fc.uniqueArray(upper, { minLength: 1, maxLength: 3 }),
    leaves: fc.uniqueArray(lower, { minLength: 2, maxLength: 4 }),
    pick: fc.array(fc.nat(), { minLength: 12, maxLength: 12 }),
  })
  .filter(({ modules, leaves }) => leaves.every((l) => !modules.includes(l)))
  .map(({ modules, components, leaves, pick }) => {
    let files: Files = apply("project", { name: "shop" }, new Map());
    for (const m of modules) files = apply("module", { id: m }, files);
    const at = (i: number): string => modules[(pick[i] ?? 0) % modules.length] ?? "app";
    const comps: string[] = [];
    components.forEach((c, i) => {
      files = apply("component", { id: `${at(i)}/${c}` }, files);
      comps.push(c);
    });
    const stores: string[] = [];
    const routes: string[] = [];
    leaves.forEach((l, i) => {
      const mod = at(i + 4);
      if (i % 2 === 0) {
        files = apply("store", { id: `${mod}.${l}` }, files);
        stores.push(`${mod}.${l}`);
      } else {
        files = apply("route", { id: `${mod}.${l}`, path: `/${mod}/${l}/:id` }, files);
        routes.push(`${mod}.${l}`);
      }
    });
    return { files, modules, components: comps, stores, routes };
  });
