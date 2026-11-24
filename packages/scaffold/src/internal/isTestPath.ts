/** Test code: `*.test.*` / `*.spec.*` files, or anything under `test/`, `tests/`, `conformance/`, `__tests__/`. */
export function isTestPath(path: string): boolean {
  return /(?:^|\/)(?:test|tests|conformance|__tests__)\//.test(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);
}
