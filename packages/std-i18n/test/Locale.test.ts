import { s } from "@keel/schema";
import { expect, test } from "vitest";
import { Locale } from "../src/Locale.schema.ts";

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

test("Locale accepts exactly the eleven tags", () => {
  for (const tag of TAGS) {
    const r = Locale.parse(tag);
    expect(r.ok ? r.value : undefined, tag).toBe(tag);
  }
  for (const bad of ["", "en", "de-de", "en_US", "fr-CA", "de-DE ", "EN-US", 7]) {
    const r = Locale.parse(bad);
    expect(r.ok, String(bad)).toBe(false);
  }
});

test("Locale is registered as i18n.Locale", () => {
  expect(s.registry().get("i18n.Locale")).toBe(Locale);
});
