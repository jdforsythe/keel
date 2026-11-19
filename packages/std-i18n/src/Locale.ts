import { s } from "@keel/schema";

/**
 * The locale tags Keel formats text for (std.i18n), each a left-to-right language whose CLDR data ships in every
 * supported runtime; registered as `i18n.Locale`. An app serves a subset, declared as its own `s.enum` of these tags.
 */
export const Locale = s.enum([
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
]);
export type Locale = s.infer<typeof Locale>;

s.register("i18n.Locale", Locale);
