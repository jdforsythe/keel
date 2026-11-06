/** A JS/TS module the checker parses (`.d.ts` declarations excluded). */
export function isCodePath(path: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(path) && !/\.d\.[cm]?ts$/.test(path);
}
