type PrefsValue = { theme: string };
export function load(text: string, fallback: PrefsValue): PrefsValue {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
