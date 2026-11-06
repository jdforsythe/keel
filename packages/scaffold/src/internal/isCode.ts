/** A JS/TS source file the codemods parse. */
export function isCode(path: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(path) && !path.endsWith(".d.ts");
}
