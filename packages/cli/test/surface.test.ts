// Seed 1337. `surfaceOf` (the `.keel/surface.json` data, k.compat Surface) and `--base` reading (`baseInput`).
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { bindingsOf } from "@keel/router/internal";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { baseInput } from "../src/internal/baseInput.ts";
import { surfaceOf } from "../src/internal/surfaceOf.ts";

const SEED = 1337;
const Page = () => document.createElement("div");
const Item = s.object({ id: s.string(), title: s.string() });
const Note = s.object({ text: s.string({ max: 80 }) });
const Id = s.object({ id: s.string() });

function evaluated() {
  const y = contract("y", {
    "y.shell": { layout: true },
    "y.item": { path: "/y/:id", params: Id },
    "y.get": { method: "GET", path: "/api/y/:id", params: Id, output: Item },
    "y.note": {
      method: "POST",
      path: "/api/y/:id",
      params: Id,
      body: Note,
      output: s.json(),
      errors: { 409: s.json() },
    },
  });
  const routes = manifest(y, {
    "y.shell": { component: Page },
    "y.item": { component: Page, layout: "y.shell" },
    "y.get": { loader: loader(y, "y.get", {}, async () => ok({ id: "i", title: "t" })) },
    "y.note": { action: action(y, "y.note", {}, async () => ok(null)) },
  });
  const pages = contract("p", { "p.home": { path: "/p" } });
  return {
    contracts: [y, pages, ...routes.contracts],
    bindings: [...bindingsOf(routes).values()].map((b) => b.binding),
    callers: { y: ["b", "a"] },
    sources: { "modules/y/y.contract.ts": "fnv1a:00000000" },
  };
}

describe("surfaceOf", () => {
  it("records each contract with an API entry by module: its callers sorted and each API entry by id", () => {
    const d = surfaceOf(evaluated());
    expect(d).toMatchObject({
      version: 2,
      contracts: {
        y: {
          module: "y",
          callers: ["a", "b"],
          entries: {
            "y.get": {
              method: "GET",
              path: "/api/y/:id",
              params: { type: "object", required: ["id"] },
              query: null,
              body: null,
              output: { type: "object", required: ["id", "title"] },
              errors: {},
            },
            "y.note": { method: "POST", body: { properties: { text: { maxLength: 80 } } }, errors: { "409": {} } },
          },
        },
      },
      stores: {},
      sources: { "modules/y/y.contract.ts": "fnv1a:00000000" },
    });
    expect(Object.keys(d.contracts ?? {})).toEqual(["y"]);
    const y = d.contracts;
    expect(typeof y === "object" && y !== null ? Object.keys(Reflect.get(Reflect.get(y, "y"), "entries")) : []).toEqual(
      ["y.get", "y.note"],
    );
  });

  it("a module without callers has `callers: []`", () => {
    const d = surfaceOf({ ...evaluated(), callers: {} });
    expect(d.contracts).toMatchObject({ y: { callers: [] } });
  });

  it("is deterministic: the same evaluation gives the same JSON", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(JSON.stringify(surfaceOf(evaluated()))).toBe(JSON.stringify(surfaceOf(evaluated())));
      }),
      { seed: SEED, numRuns: 3 },
    );
  });
});

describe("baseInput", () => {
  const surface = JSON.stringify({ data: { version: 2, contracts: {}, stores: {}, sources: {} }, hash: "fnv1a:0" });
  const io = (files: Record<string, string>, outside: Record<string, string> = {}) => ({
    cwd: "/w",
    files: Object.entries(files).map(([path, source]) => ({ path: `/w/${path}`, source })),
    read: (p: string) => outside[p],
  });

  it("is undefined without --base, the parsed file from the project or outside it, else one W1568 at the file", () => {
    expect(baseInput({}, io({}))).toEqual({ value: undefined });
    expect(baseInput({ base: "base.json" }, io({ "base.json": surface }))).toEqual({ value: JSON.parse(surface) });
    expect(baseInput({ base: "../b.json" }, io({}, { "../b.json": surface })).warn).toBeUndefined();
    const other = surface.replace('"version":2', '"version":3');
    const noContracts = JSON.stringify({ data: { version: 2, routes: {} } });
    for (const files of [
      {},
      { "base.json": "{" },
      { "base.json": "{}" },
      { "base.json": other },
      { "base.json": noContracts },
    ]) {
      const r = baseInput({ base: "base.json" }, io(files));
      expect(r.value).toBeUndefined();
      expect([r.warn?.code, r.warn?.path, r.warn?.message]).toEqual([
        "W1568",
        "base.json",
        "no base surface of version 2; E1562 not checked",
      ]);
    }
  });
});
