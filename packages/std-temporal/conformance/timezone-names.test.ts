// Spec: std.temporal, clause "`TimeZone.parse` accepts `Asia/Kolkata`, `Asia/Calcutta` and `Europe/Kyiv` and rejects `asia/kolkata`; one seed gives equal `gen` values on every host."
// Seed 1337. Host independence is pinned by drawing under seed 1337 with the host's zone list as is and again with
// `Intl.supportedValuesOf` stubbed to a one-name list: the draws must be equal, so `gen` does not read the host's list.
import { gen } from "@keel/schema/gen";
import { TimeZone } from "@keel/std-temporal";
import fc from "fast-check";
import { expect, test, vi } from "vitest";

const draw = (): readonly string[] => fc.sample(gen(TimeZone), { seed: 1337, numRuns: 50 });

test("`TimeZone.parse` accepts `Asia/Kolkata`, `Asia/Calcutta` and `Europe/Kyiv` and rejects `asia/kolkata`", () => {
  for (const name of ["Asia/Kolkata", "Asia/Calcutta", "Europe/Kyiv"]) {
    const r = TimeZone.parse(name);
    expect(r.ok, name).toBe(true);
    if (r.ok) expect(r.value).toBe(name);
  }
  const bad = TimeZone.parse("asia/kolkata");
  expect(bad.ok).toBe(false);
  if (!bad.ok) expect(bad.error.data.issues).toEqual([{ path: [], rule: "format" }]);
});

test("one seed gives equal `gen` values on every host", () => {
  const asHosted = draw();
  const spy = vi.spyOn(Intl, "supportedValuesOf").mockReturnValue(["Mars/Olympus"]);
  try {
    expect(draw()).toEqual(asHosted);
  } finally {
    spy.mockRestore();
  }
  expect(asHosted).toHaveLength(50);
  for (const v of asHosted) expect(TimeZone.parse(v).ok, v).toBe(true);
});
