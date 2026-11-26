// std.postgres Modes: a `pglite:` engine opens on the installed package's compiled modules, and in a built server,
// where no package is installed beside `server.mjs`, PGlite loads the files `keel build` copied there.
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { expect, test } from "vitest";
import { compiledPglite } from "../src/server/internal/compiledPglite.server.ts";
import { installedPglite } from "../src/server/internal/installedPglite.server.ts";

const resolve = createRequire(import.meta.url).resolve;
const none = (id: string): string => {
  throw new Error(`Cannot find module '${id}'`);
};

test("the installed package's folder is found, and nothing when no package resolves", () => {
  expect(installedPglite(resolve)).toMatch(/@electric-sql[/\\]pglite[/\\]dist$/);
  expect(installedPglite(none)).toBeUndefined();
});

test("with no installed package no module is given, and PGlite opens on its own files", async () => {
  const modules = await compiledPglite(installedPglite(none));
  expect(modules).toEqual({});
  const db = await PGlite.create(modules);
  expect((await db.query<{ one: number }>("select 1 as one")).rows).toEqual([{ one: 1 }]);
  await db.close();
});

test("from the installed package both modules compile", async () => {
  const modules = await compiledPglite(installedPglite(resolve));
  expect(modules.pgliteWasmModule).toBeInstanceOf(WebAssembly.Module);
  expect(modules.initdbWasmModule).toBeInstanceOf(WebAssembly.Module);
});
