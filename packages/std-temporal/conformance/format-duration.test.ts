// Spec: std.temporal, clause "`formatDuration` with `short` is `5 min`, `5 Min.` and `5 分` for `PT5M`, and `1 hr, 30 min`, `1 Std., 30 Min.` and `1 時間 30 分` for `PT1H30M`, in `en-US`, `de-DE` and `ja-JP`; in `en-US`, `-PT1H30M` is `-1 hr, 30 min`, `PT0S` is `0 sec` and `PT1.500S` is `1.5 sec`."
// Seed 1337 (no random inputs)
import { Duration, formatDuration } from "@keel/std-temporal";
import { expect, test } from "vitest";

function dur(text: string) {
  const r = Duration.parse(text);
  if (!r.ok) throw new Error(`expected ${text} to parse`);
  return r.value;
}

test.skip("`formatDuration` with `short` is `5 min`, `5 Min.` and `5 分` for `PT5M`, and `1 hr, 30 min`, `1 Std., 30 Min.` and `1 時間 30 分` for `PT1H30M`, in `en-US`, `de-DE` and `ja-JP`; in `en-US`, `-PT1H30M` is `-1 hr, 30 min`, `PT0S` is `0 sec` and `PT1.500S` is `1.5 sec`.", () => {
  const five = dur("PT5M");
  expect(formatDuration(five, "en-US", "short")).toBe("5 min");
  expect(formatDuration(five, "de-DE", "short")).toBe("5 Min.");
  expect(formatDuration(five, "ja-JP", "short")).toBe("5 分");
  const ninety = dur("PT1H30M");
  expect(formatDuration(ninety, "en-US", "short")).toBe("1 hr, 30 min");
  expect(formatDuration(ninety, "de-DE", "short")).toBe("1 Std., 30 Min.");
  expect(formatDuration(ninety, "ja-JP", "short")).toBe("1 時間 30 分");
  expect(formatDuration(dur("-PT1H30M"), "en-US", "short")).toBe("-1 hr, 30 min");
  expect(formatDuration(dur("PT0S"), "en-US", "short")).toBe("0 sec");
  expect(formatDuration(dur("PT1.500S"), "en-US", "short")).toBe("1.5 sec");
});
