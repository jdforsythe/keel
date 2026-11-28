/** The `choice` themes of evaluated tokens, in `themes` order (k.themes Themes), for `schemes.json` (k.schemes First paint). */
export function choiceThemes(tokens: unknown): string[] {
  const themes = typeof tokens === "object" && tokens !== null ? Reflect.get(tokens, "themes") : undefined;
  if (typeof themes !== "object" || themes === null) return [];
  return Object.entries(themes)
    .filter(([, t]) => {
      const when: unknown = typeof t === "object" && t !== null ? Reflect.get(t, "when") : undefined;
      return when === undefined || when === "choice";
    })
    .map(([n]) => n);
}
