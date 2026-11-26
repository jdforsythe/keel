// keelConfig's default `testTimeout` and `hookTimeout` bound the machine's own work (a cold import, a compile, a
// render): they are fixed time, so `KEEL_TEST_TIME_SCALE` does not shrink them (test-time.ts).
import { afterEach, describe, expect, it, vi } from "vitest";
import { keelConfig } from "../vitest-config.ts";

describe("keelConfig time bounds", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the default test and hook timeouts at scale 0.1", () => {
    vi.stubEnv("KEEL_TEST_TIME_SCALE", "0.1");
    const { test } = keelConfig({ test: {} });
    expect(test?.testTimeout).toBe(5000);
    expect(test?.hookTimeout).toBe(10_000);
    expect(test?.provide).toMatchObject({ keelWatchdog: { testTimeout: 5000, hookTimeout: 10_000 } });
  });

  it("keeps a configured test and hook timeout as the config states them at scale 0.1", () => {
    vi.stubEnv("KEEL_TEST_TIME_SCALE", "0.1");
    const { test } = keelConfig({ test: { testTimeout: 15_000, hookTimeout: 30_000 } });
    expect(test?.testTimeout).toBe(15_000);
    expect(test?.hookTimeout).toBe(30_000);
  });
});
