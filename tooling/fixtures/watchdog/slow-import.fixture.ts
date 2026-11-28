import { it } from "vitest";
import { fixedTime } from "../../test-time.ts";
import "./slow-module.ts";

// The run sets a time scale of 0.01, which would leave this empty test 2 ms: its own bound is fixed, so the run's
// exit code speaks for the watchdog alone.
it("passes after a slow import", () => {}, fixedTime(5_000));
