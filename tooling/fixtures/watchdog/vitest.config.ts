import { keelConfig } from "../../vitest-config.ts";

// Run by test/watchdog.test.ts with a short grace and tick: spin.fixture.ts never yields, orphan.fixture.ts spins
// until the test kills its parent vitest process.
export default keelConfig({ test: { include: ["*.fixture.ts"], testTimeout: 200, hookTimeout: 200 } });
