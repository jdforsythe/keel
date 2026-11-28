/** The `when` a mode name implies: `print` for `print`, `contrast` for `contrast` and `highContrast` (case and separators ignored), else undefined (`choice`). */
export function themeWhen(mode: string): "print" | "contrast" | undefined {
  const key = mode.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key === "print") return "print";
  return key === "contrast" || key === "highcontrast" ? "contrast" : undefined;
}
