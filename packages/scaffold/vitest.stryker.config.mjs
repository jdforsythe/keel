// Vitest config used only by `pnpm mutate`: the same tests in the quick-first file order, so a mutant is killed
// (bail: 1) by an example test before the slow property and biome-emitting tests are ever started.
import { QuickFirst } from "@keel/tooling/quick-first";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(base, defineConfig({ test: { sequence: { sequencer: QuickFirst } } }));
