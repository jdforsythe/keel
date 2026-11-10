// Spec: std.i18n, clause "`localeName` is `English (United States)`, `Deutsch (Deutschland)` and `日本語 (日本)` for `en-US`, `de-DE` and `ja-JP`."
// Seed 1337 (no random inputs)
import { localeName } from "@keel/std-i18n";
import { expect, test } from "vitest";

test.skip("`localeName` is `English (United States)`, `Deutsch (Deutschland)` and `日本語 (日本)` for `en-US`, `de-DE` and `ja-JP`.", () => {
  expect(localeName("en-US")).toBe("English (United States)");
  expect(localeName("de-DE")).toBe("Deutsch (Deutschland)");
  expect(localeName("ja-JP")).toBe("日本語 (日本)");
  for (const l of ["en-GB", "fr-FR", "zh-CN"] as const) {
    expect(localeName(l)).toBe(new Intl.DisplayNames([l], { type: "language", languageDisplay: "standard" }).of(l));
  }
});
