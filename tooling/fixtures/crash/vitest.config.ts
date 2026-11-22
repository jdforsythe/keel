import { keelConfig } from "../../vitest-config.ts";

// Run by test/worker-crash.test.ts: each fixture kills its own worker mid-test; one more fixture fails plainly.
export default keelConfig({ test: { include: ["*.fixture.ts"] } });
