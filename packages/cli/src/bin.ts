#!/usr/bin/env node
// The `keel` binary's entry. Node's on-disk compile cache comes first, so each start reuses the compiled modules of
// the last (for `.ts` sources, the stripped text too); the binary (`main.ts`) loads after it, every module it imports
// under the cache. The cache is used where Node has it (22.1 and later): a feature test, so the entry links on 22.0.
import nodeModule from "node:module";

if (typeof nodeModule.enableCompileCache === "function") nodeModule.enableCompileCache();
await import("./main.ts");
