import { Prefs } from "./Prefs.schema.ts";
type PrefsValue = { theme: string };
export function load(text: string, fallback: PrefsValue): PrefsValue {
  const r = Prefs.parseJson(text);
  if (r.ok) return r.value;
  switch (r.error.code) {
    case "schema.invalid":
      return fallback;
  }
}
