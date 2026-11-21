/**
 * Canary values for every personal-data and secret field golden-2 takes: distinctive strings that occur nowhere else,
 * so finding one in a sink is a leak. `test/canary.test.ts` and `tooling/smoke/canary.mjs` enter them.
 */
export const CANARY_NAME = "Qzvcanary Wendeline Orrth";
export const CANARY_EMAIL = "qzvcanary.orrth@example.test";
export const CANARY_PASSWORD = "qzvcanary-pass-horse-staple";
export const CANARY_WRONG = "qzvcanary-wrong-pass-gravel";
export const CANARY_OTHER_NAME = "Qzvcanary Second Signup";
export const CANARY_FAKE_TOKEN = "keelsim_qzvcanaryid_qzvcanarytokensecret";

/** Every fixed canary by the field it goes into. */
export const CANARIES: Readonly<Record<string, string>> = {
  name: CANARY_NAME,
  email: CANARY_EMAIL,
  password: CANARY_PASSWORD,
  wrongPassword: CANARY_WRONG,
  otherName: CANARY_OTHER_NAME,
  fakeToken: CANARY_FAKE_TOKEN,
};

/** The canaries `text` holds, by field: `[]` when none leaked. A value is also looked for URL-encoded and JSON-escaped. */
export function leaked(text: string, canaries: Readonly<Record<string, string>>): string[] {
  const forms = (v: string) => [
    v,
    v.toLowerCase(),
    encodeURIComponent(v),
    new URLSearchParams({ v }).toString().slice(2),
    JSON.stringify(v).slice(1, -1),
  ];
  return Object.entries(canaries)
    .filter(([, v]) => v !== "" && forms(v).some((f) => text.includes(f)))
    .map(([k]) => k);
}
