#!/usr/bin/env node
// The `keel` binary's entry. Node's on-disk compile cache comes first, so each start reuses the compiled modules of
// the last (for `.ts` sources, the stripped text too); the binary (`main.ts`) loads after it, every module it imports
// under the cache.
import { enableCompileCache } from "node:module";

enableCompileCache();
await import("./main.ts");
