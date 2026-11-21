// Vitest config for mutation runs of a package with no config of its own for them: the package's
// `vitest.config.ts` with the quick-first file order.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { QuickFirst } from "./quick-first.ts";

const own = await import(pathToFileURL(path.resolve("vitest.config.ts")).href);

export default mergeConfig(own.default, defineConfig({ test: { sequence: { sequencer: QuickFirst } } }));
