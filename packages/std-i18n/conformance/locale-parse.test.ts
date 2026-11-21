// Spec: std.i18n, clause "`Locale.parse` accepts each of the 11 tags and rejects `en`, `de-de`, `en_US` and `fr-CA`, each with rule `enum`."
// Seed 1337 (no random inputs)
import { Locale } from "@keel/std-i18n";
import { expect, test } from "vitest";

const TAGS = [
  "de-DE",
  "en-GB",
  "en-US",
  "es-ES",
  "fr-FR",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "nl-NL",
  "pt-BR",
  "zh-CN",
] as const;

test("`Locale.parse` accepts each of the 11 tags and rejects `en`, `de-de`, `en_US` and `fr-CA`, each with rule `enum`.", () => {
  for (const tag of TAGS) {
    const r = Locale.parse(tag);
    expect(r.ok).toBe(true);
    expect(r.ok ? r.value : undefined).toBe(tag);
  }
  for (const bad of ["en", "de-de", "en_US", "fr-CA"]) {
    const r = Locale.parse(bad);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.error.data.issues).toContainEqual({ path: [], rule: "enum" });
  }
});
