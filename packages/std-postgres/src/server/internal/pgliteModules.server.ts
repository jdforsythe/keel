import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { attempt } from "@keel/schema";

/** What `PGlite.create` takes so that it compiles nothing: the engine's two WebAssembly modules. */
interface PgliteModules {
  readonly pgliteWasmModule: WebAssembly.Module;
  readonly initdbWasmModule: WebAssembly.Module;
}

/**
 * Shared by every evaluation of this module in the process, as the open engines are: the modules compile once.
 * Compiling them for each PGlite (each about 9 MB of code) and freeing them when it closes is what a process that
 * opens many folders, or one in memory per test, spends its time on; V8's code allocator has failed on that churn.
 */
const KEY = Symbol.for("keel.postgres.pglite-modules");

async function compile(): Promise<PgliteModules> {
  const dist = dirname(createRequire(import.meta.url).resolve("@electric-sql/pglite"));
  const [pglite, initdb] = await Promise.all([
    readFile(join(dist, "pglite.wasm")),
    readFile(join(dist, "initdb.wasm")),
  ]);
  const [pgliteWasmModule, initdbWasmModule] = await Promise.all([
    WebAssembly.compile(pglite),
    WebAssembly.compile(initdb),
  ]);
  return { pgliteWasmModule, initdbWasmModule };
}

/** The process's compiled PGlite modules; a failed compile is not kept, so the next call tries again. */
export function pgliteModules(): Promise<PgliteModules> {
  const kept: unknown = Reflect.get(globalThis, KEY);
  if (kept instanceof Promise) return kept;
  const made = compile();
  Reflect.set(globalThis, KEY, made);
  void attempt(() => made).then((r) => {
    if (!r.ok && Reflect.get(globalThis, KEY) === made) Reflect.deleteProperty(globalThis, KEY);
  });
  return made;
}
