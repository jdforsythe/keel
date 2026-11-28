type PrefsValue = { theme: string };
export function load(text: string, _fallback: PrefsValue): PrefsValue {
  return JSON.parse(text);
}
