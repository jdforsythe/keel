type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A shipped tokens value with each `contrast` and `print` theme given its `when` (k.themes Library themes), the
 * shape `TokenSchema` judges and the app's themes take; any other theme is left as written.
 */
export function withWhen(value: Rec): Rec {
  const themes = value.themes;
  if (!isRec(themes)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, theme] of Object.entries(themes))
    out[key] = (key === "contrast" || key === "print") && isRec(theme) ? { ...theme, when: key } : theme;
  return { ...value, themes: out };
}
