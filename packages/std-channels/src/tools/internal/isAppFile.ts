/** An app source file the rules read: not a test, not under `node_modules/`, `.keel/` or `unsafe/`. */
export function isAppFile(path: string): boolean {
  if (/(?:^|\/)(?:node_modules|\.keel|unsafe|test|conformance)\//.test(path)) return false;
  return /\.[cm]?[jt]sx?$/.test(path) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);
}
