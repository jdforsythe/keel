/** The first version of each browser that reads `color()` (CSS Color 4); Safari and iOS have read it since before 15. */
const FIRST: Readonly<Record<string, number>> = {
  chrome: 111,
  edge: 111,
  firefox: 113,
  opera: 97,
  samsung: 22,
  safari: 15,
  ios: 15,
};

/**
 * Whether a browser build's resolved `build.cssTarget` names a browser older than `color()` (k.gamut CSS): one that
 * may match `(color-gamut: p3)` and drop a P3 form. An `es*` target, `esnext` and `false` name no browser.
 */
export function lacksColorFunction(target: unknown): boolean {
  const list = Array.isArray(target) ? target : [target];
  return list.some((t) => {
    if (typeof t !== "string") return false;
    const m = /^([a-z]+)(\d+(?:\.\d+)?)/.exec(t.trim().toLowerCase());
    const first = m === null ? undefined : FIRST[m[1] ?? ""];
    return first !== undefined && Number(m?.[2]) < first;
  });
}
