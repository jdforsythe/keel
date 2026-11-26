import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PgliteModules } from "./PgliteModules.ts";

/** The two modules compiled from `folder`; none without a folder, so PGlite loads its own files. */
export async function compiledPglite(folder: string | undefined): Promise<Partial<PgliteModules>> {
  if (folder === undefined) return {};
  const [pglite, initdb] = await Promise.all([
    readFile(join(folder, "pglite.wasm")),
    readFile(join(folder, "initdb.wasm")),
  ]);
  const [pgliteWasmModule, initdbWasmModule] = await Promise.all([
    WebAssembly.compile(pglite),
    WebAssembly.compile(initdb),
  ]);
  return { pgliteWasmModule, initdbWasmModule };
}
