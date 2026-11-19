// Spec: std.temporal, clause "`Instant.parse` rejects `2026-11-10T09:30:00Z`, `2026-02-30T00:00:00.000Z` and `2026-11-10T09:30:00.000+01:00`; `PlainDate.parse` rejects `2023-02-29`, `2026-1-05` and `0000-01-01` and accepts `2024-02-29`; `TimeZone.parse` rejects `Mars/Olympus` and `utc`; `Duration.parse` rejects `PT90M`, `PT0.5S`, `P1D` and `-PT0S`. Each rejection has rule `format` at the value's path."
// Seed 1337 (no random inputs)
import { Duration, Instant, PlainDate, TimeZone } from "@keel/std-temporal";
import { expect, test } from "vitest";

type Parser = {
  parse(
    input: unknown,
  ):
    | { ok: true }
    | { ok: false; error: { data: { issues: readonly { path: readonly (string | number)[]; rule: string }[] } } };
};

function expectFormatReject(schema: Parser, input: string): void {
  const r = schema.parse(input);
  expect(r.ok, input).toBe(false);
  if (!r.ok) expect(r.error.data.issues).toEqual([{ path: [], rule: "format" }]);
}

test("`Instant.parse` rejects `2026-11-10T09:30:00Z`, `2026-02-30T00:00:00.000Z` and `2026-11-10T09:30:00.000+01:00`; `PlainDate.parse` rejects `2023-02-29`, `2026-1-05` and `0000-01-01` and accepts `2024-02-29`; `TimeZone.parse` rejects `Mars/Olympus` and `utc`; `Duration.parse` rejects `PT90M`, `PT0.5S`, `P1D` and `-PT0S`. Each rejection has rule `format` at the value's path.", () => {
  for (const v of ["2026-11-10T09:30:00Z", "2026-02-30T00:00:00.000Z", "2026-11-10T09:30:00.000+01:00"]) {
    expectFormatReject(Instant, v);
  }
  for (const v of ["2023-02-29", "2026-1-05", "0000-01-01"]) expectFormatReject(PlainDate, v);
  expect(PlainDate.parse("2024-02-29").ok).toBe(true);
  for (const v of ["Mars/Olympus", "utc"]) expectFormatReject(TimeZone, v);
  for (const v of ["PT90M", "PT0.5S", "P1D", "-PT0S"]) expectFormatReject(Duration, v);
});
