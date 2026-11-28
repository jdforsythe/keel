import { properties } from "@keel/testing";
import { it } from "vitest";
import BarProbe from "./BarProbe.ts";
import LineProbe from "./LineProbe.ts";
import SparkProbe from "./SparkProbe.ts";

const SEED = 20261125;

// Each chart under a fixed id (the probes): an app's element id is a literal its own check reads, never any string.
// Each case renders 100 charts: about 4 ms a run here, 300 ms allowed a run on a loaded runner, so 30 s.
it("a bar chart renders and passes the a11y checks for any points and words", { timeout: 30_000 }, async () => {
  await properties(BarProbe, { runs: 100, seed: SEED });
});

it("a line chart renders and passes the a11y checks for any points and words", { timeout: 30_000 }, async () => {
  await properties(LineProbe, { runs: 100, seed: SEED });
});

it("a sparkline renders and passes the a11y checks for any points and words", { timeout: 30_000 }, async () => {
  await properties(SparkProbe, { runs: 100, seed: SEED });
});
