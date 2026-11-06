// Vitest config used only by `pnpm mutate`: the same tests, but run cheapest first so a mutant is killed
// (bail: 1) by an example test before the slow property and biome-emitting tests are ever started.
import { BaseSequencer } from "vitest/node";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

const SLOW = /property|emitted-code|determinism|rename-references/;

class CheapFirst extends BaseSequencer {
  async sort(files) {
    const rank = (f) => (SLOW.test(f.moduleId ?? f[1] ?? "") ? 1 : 0);
    return [...files].sort((a, b) => rank(a) - rank(b));
  }
}

export default mergeConfig(base, defineConfig({ test: { sequence: { sequencer: CheapFirst } } }));
